/**
 * Shared types for AICodeReview project
 * This file contains all the types that are used across frontend, backend, and CLI
 */

export interface GitLabConfig {
  url: string;
  accessToken: string;
}

export interface GitLabPosition {
  base_sha: string;
  start_sha: string;
  head_sha: string;
  position_type: 'text';
  old_path: string;
  new_path: string;
  new_line?: number;
  old_line?: number;
  line_code?: string;
}

export interface FileDiff {
  old_path: string;
  new_path: string;
  new_file: boolean;
  deleted_file: boolean;
  renamed_file: boolean;
  diff: string;
}

export enum Severity {
  Critical = 'Critical',
  Warning = 'Warning',
  Suggestion = 'Suggestion',
  Info = 'Info',
}

export interface ReviewFeedback {
  id: string;
  lineNumber: number;
  filePath: string;
  severity: Severity;
  title: string;
  description: string;
  lineContent: string;
  position: GitLabPosition | null;
  status: 'pending' | 'submitted' | 'submitting' | 'error';
  isExisting?: boolean;
  isEditing?: boolean;
  isIgnored?: boolean;
  isNewlyAdded?: boolean;
  submissionError?: string;
}

export interface ParsedDiffLine {
  type: 'add' | 'remove' | 'context' | 'meta';
  oldLine?: number;
  newLine?: number;
  content: string;
}

export interface ParsedHunk {
  header: string;
  oldStartLine: number;
  oldLineCount: number;
  newStartLine: number;
  newLineCount: number;
  lines: ParsedDiffLine[];
  isCollapsed: boolean;
  oldLineOffset?: number;
  newLineOffset?: number;
}

export interface ParsedFileDiff {
  filePath: string;
  oldPath: string;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
  hunks: ParsedHunk[];
}

export interface GitLabNote {
  id: number;
  body: string;
  author: {
    name?: string;
    username: string;
  };
  system: boolean;
  position?: GitLabPosition;
  created_at: string;
}

export interface GitLabDiscussion {
  id: string;
  notes: GitLabNote[];
}

export interface LineMapping {
  newToOld: Record<number, number>;
  oldToNew: Record<number, number>;
}

export interface GitLabMRDetails {
  projectPath: string;
  mrIid: string;
  projectId: number;
  title: string;
  authorName: string;
  webUrl: string;
  sourceBranch: string;
  targetBranch: string;
  base_sha: string;
  start_sha: string;
  head_sha: string;
  fileDiffs: FileDiff[];
  diffForPrompt: string;
  parsedDiffs: ParsedFileDiff[];
  fileContents: Record<string, { oldContent?: string[]; newContent?: string[] }>;
  discussions: GitLabDiscussion[];
  existingFeedback: ReviewFeedback[];
  lineMappings: Record<string, LineMapping>;
  approvals?: {
    approved_by: Array<{ user: { name: string; username: string } }>;
    approvals_left: number;
    approvals_required: number;
  };
}

export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path_with_namespace: string;
  last_activity_at: string;
  web_url: string;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  title: string;
  author: {
    name: string;
    username: string;
  };
  updated_at: string;
  web_url: string;
  project_name?: string;
  source_branch: string;
  target_branch: string;
}

// AI Review related types
export interface AIReviewResponse {
  feedback: ReviewFeedback[];
}

export interface GeminiReviewRequest {
  diffForPrompt: string;
  discussions: GitLabDiscussion[];
}

export interface GeminiReviewResponse {
  filePath: string;
  lineNumber: number;
  severity: Severity;
  title: string;
  description: string;
}

// Context range for expanded diff hunks
export interface ContextRange {
  startLine: number; // 1-based line number
  endLine: number; // 1-based line number
  fileStartBoundary: boolean;
  fileEndBoundary: boolean;
}

// Enhanced hunk with context lines
export interface ExpandedHunk extends ParsedHunk {
  preContext: ParsedDiffLine[]; // Lines before the actual changes
  postContext: ParsedDiffLine[]; // Lines after the actual changes
  contextRange: ContextRange;
}

// Config types for frontend
export interface Config {
  gitlabUrl: string;
  accessToken: string;
}

export interface PostDiscussionRequest {
  gitlabConfig: GitLabConfig;
  mrDetails: GitLabMRDetails;
  reviewFeedback: ReviewFeedback;
}

export interface PostDiscussionResponse {
  success: boolean;
  result?: any;
  error?: string;
}
