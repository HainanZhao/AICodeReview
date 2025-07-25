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
  parsedDiffs: ParsedDiff[];
  fileContents: Map<string, { oldContent?: string[]; newContent?: string[] }>;
  discussions: GitLabDiscussion[];
  existingFeedback: ReviewFeedback[];
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
  status: 'pending' | 'submitted';
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
  };
  created_at: string;
  position: {
    new_path: string;
    new_line: number;
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
