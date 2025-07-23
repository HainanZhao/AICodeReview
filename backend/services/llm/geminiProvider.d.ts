import { LLMProvider } from './types';
import { Request, Response } from 'express';
export declare class GeminiProvider implements LLMProvider {
    private ai;
    constructor(apiKey: string);
    private buildPrompt;
    reviewCode(req: Request, res: Response): Promise<void>;
}
