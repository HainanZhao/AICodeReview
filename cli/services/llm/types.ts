import { Request, Response } from 'express';
import { ReviewFeedback, ParsedFileDiff } from '../../shared/index.js';

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
