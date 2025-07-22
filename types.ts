import { v4 as uuidv4 } from 'uuid';

export enum Severity {
  Critical = 'Critical',
  Warning = 'Warning',
  Suggestion = 'Suggestion',
  Info = 'Info',
}

export type SubmissionStatus = 'pending' | 'submitting' | 'submitted' | 'error';

// Position data required by the GitLab API to post a comment on a diff.
export interface GitLabPosition {
  base_sha: string;
  start_sha: string;
  head_sha: string;
  position_type: 'text';
  old_path: string;
  new_path: string;
  old_line?: number;
  new_line?: number;
}

export interface ReviewFeedback {
  id: string; // Unique identifier for each feedback item
  lineNumber: number;
  severity: Severity;
  title: string;
  description: string;
  filePath: string;
  lineContent: string;
  position: GitLabPosition | null;
  status: SubmissionStatus;
  submissionError?: string;
  isEditing?: boolean;
  isNewlyAdded?: boolean;
  isIgnored?: boolean;
}

export interface Config {
  gitlabUrl: string;
  accessToken: string;
}

// Represents a project from the GitLab API
export interface GitLabProject {
  id: number;
  name_with_namespace: string;
  web_url: string;
  last_activity_at: string;
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


// Represents a file diff from GitLab API
export interface FileDiff {
  diff: string;
  new_path: string;
  old_path: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
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

// Contains all the necessary details fetched from GitLab for a merge request.
export interface GitLabMRDetails {
    projectPath: string;
    mrIid: string;
    projectId: number;
    title: string;
    authorName: string;
    webUrl: string;
    sourceBranch: string;
    targetBranch: string;
    head_sha: string;
    base_sha: string;
    start_sha:string;
    fileDiffs: FileDiff[];
    diffForPrompt: string;
    parsedDiffs: ParsedFileDiff[];
    fileContents: Map<string, { oldContent?: string[]; newContent?: string[] }>;
}
