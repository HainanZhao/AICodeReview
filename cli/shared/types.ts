export interface Config {
  gitlabUrl: string;
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
}

export interface FileDiff {
  old_path: string;
  new_path: string;
  new_file: boolean;
  deleted_file: boolean;
  renamed_file: boolean;
  diff: string;
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
  fileContents: Map<string, { oldContent?: string[]; newContent?: string[] }>;
  discussions: GitLabDiscussion[];
  existingFeedback: ReviewFeedback[];
  approvals?: {
    approved_by: Array<{ user: { name: string; username: string } }>;
    approvals_left: number;
    approvals_required: number;
  };
}

export interface ParsedDiff {
  filePath: string;
  oldPath: string;
  hunks: Hunk[];
}

export interface Hunk {
  lines: HunkLine[];
}

export interface HunkLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLine?: number;
  newLine?: number;
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
  isExisting?: boolean; // Indicates if this is an existing GitLab comment
  isEditing?: boolean;
  isIgnored?: boolean;
  isNewlyAdded?: boolean;
  submissionError?: string;
}

export interface GitLabNote {
  id: number;
  body: string;
  author: {
    username: string;
    name: string;
  };
  created_at: string;
  system?: boolean;
  position: {
    new_path: string;
    new_line: number;
    old_path?: string;
    old_line?: number;
  } | null;
}

export interface GitLabDiscussion {
  id: string;
  notes: GitLabNote[];
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

// Represents a project from the GitLab API
export interface GitLabProject {
  id: number;
  name_with_namespace: string;
  web_url: string;
  last_activity_at: string;
}

// Represents a fully parsed file diff with structured hunks
export interface ParsedFileDiff {
  filePath: string;
  oldPath: string;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
  hunks: ParsedHunk[];
}

// Represents a single parsed line from a diff string
export interface ParsedDiffLine {
  type: 'add' | 'remove' | 'context' | 'meta';
  oldLine?: number;
  newLine?: number;
  content: string;
}

// Represents a collapsible and expandable section of a diff
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

// Represents a merge request from the GitLab API for list views
export interface GitLabMergeRequest {
  iid: number;
  project_id: number;
  title: string;
  author: {
    name: string;
    username: string;
  };
  web_url: string;
  updated_at: string;
  source_branch: string;
  target_branch: string;
  project_name?: string; // Manually added after fetching
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
