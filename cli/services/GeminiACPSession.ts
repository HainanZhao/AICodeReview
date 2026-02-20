import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';
import {
  ClientSideConnection,
  ndJsonStream,
  type Client,
  type SessionNotification,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type ReadTextFileRequest,
  type ReadTextFileResponse,
} from '@agentclientprotocol/sdk';

export class GeminiACPSession extends EventEmitter implements Client {
  private static instance: GeminiACPSession;
  private process: ChildProcess | null = null;
  private sessionId: string | null = null;
  private connection: ClientSideConnection | null = null;
  private initialized = false;
  public baseUrl: string | null = null;
  public mrContext: {
    projectId: number;
    headSha: string;
    gitlabConfig: {
      url: string;
      accessToken: string;
    };
  } | null = null;

  private constructor() {
    super();
  }

  public static getInstance(): GeminiACPSession {
    if (!GeminiACPSession.instance) {
      GeminiACPSession.instance = new GeminiACPSession();
    }
    return GeminiACPSession.instance;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  public async start(): Promise<void> {
    if (this.process) return;

    console.log('🚀 Starting Gemini ACP Session...');
    this.process = spawn('gemini', ['--experimental-acp', '--approval-mode', 'yolo'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stderr?.on('data', (data) => console.error(`[Gemini ACP stderr] ${data}`));
    this.process.on('exit', (code) => {
      console.log(`Gemini ACP process exited with code ${code}`);
      this.process = null;
      this.sessionId = null;
      this.connection = null;
      this.initialized = false;
    });

    if (this.process.stdout && this.process.stdin) {
      const acpStream = ndJsonStream(
        Writable.toWeb(this.process.stdin) as WritableStream<Uint8Array>,
        Readable.toWeb(this.process.stdout) as ReadableStream<Uint8Array>
      );
      this.connection = new ClientSideConnection(() => this, acpStream);
    } else {
      throw new Error('Failed to establish pipes to gemini process');
    }

    try {
      // 1. Initialize
      await this.connection.initialize({
        protocolVersion: 1,
        clientCapabilities: {
          fs: {
            readTextFile: true, // Restore standard capability
          },
          terminal: true,
        },
      });

      // 2. Create Session
      const sessionResult = await this.connection.newSession({
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
    this.connection = null;
    this.initialized = false;
  }

  public async chat(message: string): Promise<string> {
    if (!this.initialized || !this.connection || !this.sessionId) {
      await this.start();
    }

    let responseText = '';

    const onUpdate = (params: SessionNotification) => {
      const update = params.update;
      if (update.sessionUpdate === 'agent_message_chunk' && update.content?.type === 'text') {
        responseText += update.content.text;
      }
    };
    
    this.on('session/update_internal', onUpdate);

    try {
      console.log(`[Gemini ACP] Sending prompt to session ${this.sessionId} (${message.length} chars)...`);
      const response = await this.connection!.prompt({
        sessionId: this.sessionId!,
        prompt: [{ type: 'text', text: message }],
      });

      console.log(`[Gemini ACP] Turn finished with reason: ${response.stopReason}. Captured ${responseText.length} characters.`);
    } catch (error) {
      console.error('[Gemini ACP] Chat error:', error);
      throw error;
    } finally {
      this.off('session/update_internal', onUpdate);
    }

    return responseText;
  }

  // --- Client interface implementation ---

  async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    console.log(`[Gemini ACP ←] Permission requested for session: ${params.sessionId}`);
    
    // Auto-approve in yolo mode by selecting the first option
    return { outcome: 'selected', optionId: params.options[0].optionId } as any;
  }

  async sessionUpdate(params: SessionNotification): Promise<void> {
    const update = params.update;
    // Log incoming session updates for debugging
    if (update.sessionUpdate === 'agent_message_chunk') {
      if (update.content?.type === 'text') {
        // Optional: log chunk size if needed
        // console.log(`[Gemini ACP ←] Message chunk: ${update.content.text.length} chars`);
      }
    } else if (update.sessionUpdate === 'agent_thought_chunk') {
      if (update.content?.type === 'text') {
        console.log(`[Gemini Thought] ${update.content.text}`);
      }
    } else if (update.sessionUpdate === 'tool_call') {
      const tool = update as any;
      console.log(`[Gemini ACP ←] Tool Call: ${tool.title || 'unknown'} (ID: ${tool.toolCallId})`);
    } else if (update.sessionUpdate === 'tool_call_update') {
      const toolUpdate = update as any;
      const cmd = toolUpdate.rawInput || (toolUpdate.content?.[0] as any)?.text;
      console.log(`[Gemini ACP ←] Tool Call Update (ID: ${toolUpdate.toolCallId}): ${cmd || ''}`);
    } else {
      console.log(`[Gemini ACP ←] Session Update: ${update.sessionUpdate}`);
    }
    
    // Emit internally for chat() to handle
    this.emit('session/update_internal', params);
  }

  async extMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (method === 'fs/list_directory') {
      const dirPath = (params.path as string) || '';
      console.log(`🔍 AI is listing directory: ${dirPath}`);

      if (!this.mrContext) {
        throw new Error('MR context not set.');
      }

      try {
        const { fetchRepositoryTree } = await import('../shared/services/gitlabCore.js');
        const items = await fetchRepositoryTree(
          this.mrContext.gitlabConfig,
          this.mrContext.projectId,
          dirPath,
          this.mrContext.headSha
        );

        if (items) {
          return {
            items: items.map((item) => ({
              path: item.path,
              name: item.name,
              type: item.type === 'tree' ? 'directory' : 'file',
            })),
          };
        }
        throw new Error(`Directory not found in GitLab: ${dirPath}`);
      } catch (e: any) {
        console.error('Gemini ACP list_directory error:', e);
        throw e;
      }
    }

    if (method === 'fs/read_file') {
      const filePath = params.path as string;
      return this.handleReadFile(filePath);
    }

    throw new Error(`Method not implemented: ${method}`);
  }

  // Standard ACP standard method
  async readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    return this.handleReadFile(params.path);
  }

  private async handleReadFile(filePath: string): Promise<{ content: string }> {
    console.log(`🔍 AI is reading file: ${filePath}`);

    if (!this.mrContext) {
      throw new Error('MR context not set. Ensure review context is initialized before reading files.');
    }

    try {
      const { fetchFileContentAsLines } = await import('../shared/services/gitlabCore.js');
      const lines = await fetchFileContentAsLines(
        this.mrContext.gitlabConfig,
        this.mrContext.projectId,
        filePath,
        this.mrContext.headSha
      );

      if (lines) {
        return { content: lines.join('\n') };
      }
      throw new Error(`File not found in GitLab: ${filePath}`);
    } catch (e: any) {
      console.error('Gemini ACP read_file error:', e);
      throw e;
    }
  }
}
