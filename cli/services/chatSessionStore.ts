import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  lineContent: string;
  filePath: string;
  lineNumber?: number;
  fileContent?: string;
  contextLines: number;
  messages: ChatMessage[];
  createdAt: number;
  lastActivity: number;
}

export class ChatSessionStore {
  private sessions: Map<string, ChatSession> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  createSession(
    lineContent: string,
    filePath: string,
    lineNumber?: number,
    fileContent?: string,
    contextLines: number = 5
  ): string {
    const sessionId = uuidv4();
    const now = Date.now();

    const session: ChatSession = {
      id: sessionId,
      lineContent,
      filePath,
      lineNumber,
      fileContent,
      contextLines,
      messages: [],
      createdAt: now,
      lastActivity: now,
    };

    this.sessions.set(sessionId, session);
    this.cleanupExpiredSessions();

    return sessionId;
  }

  getSession(sessionId: string): ChatSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
    return session;
  }

  addMessage(sessionId: string, role: 'user' | 'assistant', content: string): ChatMessage | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const message: ChatMessage = {
      id: uuidv4(),
      role,
      content,
      timestamp: Date.now(),
    };

    session.messages.push(message);
    session.lastActivity = Date.now();

    return message;
  }

  getMessages(sessionId: string): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    return session ? session.messages : [];
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
      }
    }
  }

  // Get session statistics for debugging
  getStats(): { totalSessions: number; activeSessions: number } {
    this.cleanupExpiredSessions();
    return {
      totalSessions: this.sessions.size,
      activeSessions: this.sessions.size,
    };
  }
}

// Singleton instance
export const chatSessionStore = new ChatSessionStore();
