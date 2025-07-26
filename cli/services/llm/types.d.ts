import { Request, Response } from 'express';
export interface ReviewRequest {
    diffForPrompt: string;
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
}
export interface LLMConfig {
    provider: string;
    apiKey: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
}
