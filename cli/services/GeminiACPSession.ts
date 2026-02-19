import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: any;
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

export class GeminiACPSession extends EventEmitter {
  private static instance: GeminiACPSession;
  private process: ChildProcess | null = null;
  private sessionId: string | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: (value: any) => void; reject: (reason?: any) => void }>();
  private initialized = false;
  private buffer = '';

  private constructor() {
    super();
  }

  public static getInstance(): GeminiACPSession {
    if (!GeminiACPSession.instance) {
      GeminiACPSession.instance = new GeminiACPSession();
    }
    return GeminiACPSession.instance;
  }

  public async start(): Promise<void> {
    if (this.process) return;

    console.log('🚀 Starting Gemini ACP Session...');
    this.process = spawn('gemini', ['--experimental-acp'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data) => this.handleData(data));
    this.process.stderr?.on('data', (data) => console.error(`[Gemini ACP stderr] ${data}`));
    this.process.on('exit', (code) => {
      console.log(`Gemini ACP process exited with code ${code}`);
      this.process = null;
      this.sessionId = null;
      this.initialized = false;
    });

    try {
      // 1. Initialize
      await this.sendRequest('initialize', {
        protocolVersion: 1,
        clientCapabilities: {},
      });

      // 2. Create Session
      const sessionResult = await this.sendRequest('session/new', {
        cwd: process.cwd(),
        mcpServers: [], 
      });
      
      this.sessionId = sessionResult.sessionId;
      this.initialized = true;
      console.log(`✅ Gemini ACP Session started. ID: ${this.sessionId}`);
    } catch (error) {
      console.error('Failed to start Gemini ACP session:', error);
      this.stop();
      throw error;
    }
  }

  public stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.sessionId = null;
    this.initialized = false;
  }

  public async chat(message: string): Promise<string> {
    if (!this.initialized || !this.sessionId) {
      await this.start();
    }

    // Using session/prompt
    // The result from session/prompt is usually a stop reason, 
    // but the content comes via session/update notifications or directly in the result depending on implementation.
    // Based on ACP spec, we should listen for notifications or check the result.
    // However, for simplicity in this bridge, we'll see what the prompt returns.
    // Actually, prompt returns { stopReason: ... } and we need to collect the output from `session/update`.
    
    // We need to capture the output during this specific prompt turn.
    // This simple implementation might have race conditions if multiple chats happen at once,
    // but for a CLI tool, it's likely sequential.
    
    let responseText = '';
    const onUpdate = (params: any) => {
        if (params.sessionUpdate === 'agent_message_chunk' && params.content?.type === 'text') {
            responseText += params.content.text;
        }
    };

    this.on('session/update', onUpdate);

    try {
      await this.sendRequest('session/prompt', {
        sessionId: this.sessionId,
        prompt: [{ type: 'text', text: message }],
      });
    } finally {
      this.off('session/update', onUpdate);
    }

    return responseText;
  }

  private handleData(data: Buffer) {
    this.buffer += data.toString();
    const lines = this.buffer.split('
');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if ('id' in msg && msg.id !== undefined) {
            // Response
            if ('result' in msg) {
                this.pendingRequests.get(msg.id)?.resolve(msg.result);
            } else {
                this.pendingRequests.get(msg.id)?.reject(msg.error);
            }
            this.pendingRequests.delete(msg.id);
        } else if ('method' in msg) {
            // Notification
            this.emit(msg.method, msg.params);
        }
      } catch (e) {
        console.error('Error parsing JSON-RPC message:', e);
      }
    }
  }

  private sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process) {
        reject(new Error('Process not running'));
        return;
      }
      const id = ++this.requestId;
      this.pendingRequests.set(id, { resolve, reject });
      const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
      this.process.stdin?.write(JSON.stringify(req) + '
');
    });
  }
}
