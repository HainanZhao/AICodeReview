// Re-export types from root types file
export type {
  ReviewFeedback,
  GitLabMRDetails,
  GitLabProject,
  ParsedFileDiff,
  GitLabPosition,
  FileDiff,
  GitLabMergeRequest,
  ParsedHunk,
  GitLabDiscussion,
  GitLabConfig,
  AIReviewResponse,
  ParsedDiffLine,
  PostDiscussionRequest,
  PostDiscussionResponse,
} from '../../types';

// Re-export enums that need to be imported as values
export { Severity } from '../../types';

// For backward compatibility, re-export GitLabConfig as Config
export type { GitLabConfig as Config } from '../../types';

// Chat functionality types
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

export interface StartChatResponse {
  success: boolean;
  sessionId?: string;
  explanation?: string;
  messages?: ChatMessage[];
  error?: string;
}

export interface ChatResponse {
  success: boolean;
  sessionId?: string;
  response?: string;
  messages?: ChatMessage[];
  error?: string;
}

export interface GetChatResponse {
  success: boolean;
  sessionId?: string;
  messages?: ChatMessage[];
  lineContent?: string;
  filePath?: string;
  error?: string;
}
