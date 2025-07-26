// Re-export only browser-safe types from shared package
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
  AIReviewRequest,
} from 'aicodereview-shared';

// Re-export enums that need to be imported as values
export { Severity } from 'aicodereview-shared';

// Frontend-specific types
export interface Config {
  gitlabUrl: string;
  gitlabAccessToken: string;
  accessToken: string; // alias for gitlabAccessToken
  llmProvider: 'gemini-cli' | 'gemini' | 'anthropic';
  llmApiKey?: string;
  theme: 'light' | 'dark';
  selectedProjectIds: number[];
}

export interface ParsedDiffLine {
  type: 'context' | 'addition' | 'deletion' | 'meta' | 'add' | 'remove';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  lineNumber: number; // For display purposes
  oldLine?: number; // alias for oldLineNumber
  newLine?: number; // alias for newLineNumber
}
