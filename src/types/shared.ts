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
    new_line: number;
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
    Info = 'Info'
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
