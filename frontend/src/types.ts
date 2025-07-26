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
} from '../../types';

// Re-export enums that need to be imported as values
export { Severity } from '../../types';

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
