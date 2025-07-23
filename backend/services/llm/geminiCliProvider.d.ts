import { LLMProvider } from './types';
import { Request, Response } from 'express';
export declare class GeminiCliProvider implements LLMProvider {
    private static cleanupTmpFolder;
    static isAvailable(): Promise<boolean>;
    private buildPrompt;
    private getTmpDir;
    initializeWithCleanup(): Promise<void>;
    private extractJsonFromOutput;
    reviewCode(req: Request, res: Response): Promise<void>;
}
