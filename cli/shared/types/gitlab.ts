/**
 * Shared types for GitLab integration
 */

/**
 * Line mapping interface to track old/new line number relationships
 * Using plain objects for serialization compatibility
 */
export interface LineMapping {
  newToOld: Record<number, number>; // Map new line numbers to old line numbers
  oldToNew: Record<number, number>; // Map old line numbers to new line numbers
}

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
  line_code?: string; // Generated when posting comments
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

export interface ParsedHunk {
  header: string;
  oldStartLine: number;
  oldLineCount: number;
  newStartLine: number;
  newLineCount: number;
  lines: Array<{
    type: 'add' | 'remove' | 'context';
    oldLine?: number;
    newLine?: number;
    content: string;
  }>;
  isCollapsed: boolean;
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
}

export interface GitLabDiscussion {
  id: string;
  notes: GitLabNote[];
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
  fileContents: Record<string, { oldContent?: string[]; newContent?: string[] }>; // Serializable object instead of Map
  lineMappings: Record<string, LineMapping>; // Pre-computed line mappings for each file, serializable
  discussions: GitLabDiscussion[];
  existingFeedback: ReviewFeedback[];
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
}
