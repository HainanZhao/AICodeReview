import type { Request, Response } from 'express';
import type { LineMapping, ParsedFileDiff, ReviewFeedback } from '../../shared/index.js';

export interface ReviewRequest {
  diffForPrompt: string;
  // Enhanced with rich context for better AI reviews
  title?: string;
  description?: string;
  sourceBranch?: string;
  targetBranch?: string;
  authorName?: string;
  existingFeedback?: ReviewFeedback[];
  parsedDiffs?: ParsedFileDiff[];
  // File contents for better AI context
  fileContents?: Record<string, { oldContent?: string[]; newContent?: string[] }>;
  // List of changed file paths
  changedFiles?: string[];
  // GitLab context for on-demand file fetching
  projectId?: number;
  headSha?: string;
  gitlabConfig?: {
    url: string;
    accessToken: string;
  };
  // Line mappings for translating between git diff and full file line numbers
  lineMappings?: Record<string, LineMapping>;
}

// New interface for MR URL-based requests
export interface MrUrlRequest {
  mrUrl: string;
  gitlabConfig: {
    gitlabUrl: string;
    accessToken: string;
  };
}

export interface ReviewResponse {
  filePath: string;
  lineNumber: number;
  severity: 'Critical' | 'Warning' | 'Suggestion' | 'Info';
  title: string;
  description: string;
}

export interface LLMProvider {
  reviewCode(req: Request, res: Response): Promise<void>;
  // New method for MR URL-based reviews
  reviewMr?(req: Request, res: Response): Promise<void>;
}

export interface LLMConfig {
  provider: string;
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}
