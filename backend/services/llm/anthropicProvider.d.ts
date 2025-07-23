import { LLMProvider } from './types';
import { Request, Response } from 'express';
export declare class AnthropicProvider implements LLMProvider {
    private client;
    constructor(apiKey: string);
    private buildPrompt;
    reviewCode(req: Request, res: Response): Promise<void>;
}
