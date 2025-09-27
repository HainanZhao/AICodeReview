/**
 * Types for CLI functionality
 */

export enum Severity {
  Critical = 'Critical',
  Warning = 'Warning',
  Suggestion = 'Suggestion',
  Info = 'Info',
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

export interface CLIReviewOptions {
  mrUrl: string[];
  dryRun?: boolean;
  mock?: boolean;
  verbose?: boolean;
  customPromptFile?: string;
  promptStrategy?: 'append' | 'prepend' | 'replace'; // How to merge custom prompt with default
  projectPrompts?: Record<
    string,
    {
      promptFile?: string;
      promptStrategy?: 'append' | 'prepend' | 'replace';
    }
  >; // Per-project prompt configurations
  canonicalProjectName?: string; // Canonical project path from GitLab API (e.g., "ghpr-tech/js/jsgh-lib")
  // CLI options that can override config
  provider?: string;
  apiKey?: string;
  googleCloudProject?: string;
  port?: string;
  host?: string;
}
