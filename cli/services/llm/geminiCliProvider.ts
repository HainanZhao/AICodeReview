import { LLMProvider, ReviewRequest, ReviewResponse } from './types.js';
import { Request, Response } from 'express';
import { GeminiCliCore, GeminiCliItem } from '../../shared/index.js';
import { ReviewPromptBuilder } from './promptBuilder.js';

export class GeminiCliProvider implements LLMProvider {
  public static async isAvailable(): Promise<boolean> {
    try {
      return await GeminiCliCore.isAvailable();
    } catch {
      return false;
    }
  }

  private buildPrompt(diff: string): string {
    return ReviewPromptBuilder.buildPrompt(diff, { modelType: 'gemini' });
  }

  public async initializeWithCleanup(): Promise<void> {
    // No temporary files to clean up since we use stdin
    console.log('Temporary folder cleanup completed');
  }

  public async reviewCode(req: Request, res: Response): Promise<void> {
    const { diffForPrompt } = req.body as ReviewRequest;

    if (!diffForPrompt) {
      res.status(400).json({ error: 'Missing diffForPrompt in request body.' });
      return;
    }

    try {
      // Build the prompt
      const prompt = this.buildPrompt(diffForPrompt);

      try {
        // Use shared core for execution with backend-appropriate options
        const parsedResponse = await GeminiCliCore.executeReview(prompt, { verbose: false });

        // Convert to backend response format
        const validatedResponse = parsedResponse.map(
          (item: GeminiCliItem): ReviewResponse => ({
            filePath: String(item.filePath).replace(/\\/g, '/'), // Normalize path separators
            lineNumber: Number(item.lineNumber),
            severity: item.severity as ReviewResponse['severity'],
            title: String(item.title),
            description: String(item.description),
          })
        );

        res.json(validatedResponse);
      } catch (execError) {
        console.error('Error executing gemini:', execError);
        // Return empty array for execution errors
        res.json([]);
      }
    } catch (error) {
      console.error('Error preparing prompt:', error);
      // Return empty array for preparation errors
      res.json([]);
    }
  }
}
