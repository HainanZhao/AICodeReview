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

// Add the ChatMessage interface
export interface ChatMessage {
  author: 'user' | 'ai';
  content: string;
}
