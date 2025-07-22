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

export interface GitLabMRDetails {
    base_sha: string;
    start_sha: string;
    head_sha: string;
    diffForPrompt: string;
    parsedDiffs: ParsedDiff[];
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
}

export interface GeminiReviewRequest {
    diffForPrompt: string;
}

export interface GeminiReviewResponse {
    filePath: string;
    lineNumber: number;
    severity: Severity;
    title: string;
    description: string;
}
