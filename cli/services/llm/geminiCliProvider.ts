import { ReviewRequest, ReviewResponse } from './types.js';
import { Request, Response } from 'express';
import {
  GeminiCliCore,
  GeminiCliItem,
  buildReviewPrompt,
  type AIReviewRequest,
} from '../../shared/index.js';
import { BaseLLMProvider } from './baseLLMProvider.js';

export class GeminiCliProvider extends BaseLLMProvider {
  readonly providerName = 'gemini-cli';

  constructor() {
    super(); // No API key needed for CLI provider
  }
  public static async isAvailable(): Promise<boolean> {
    try {
      return await GeminiCliCore.isAvailable();
    } catch {
      return false;
    }
  }

  private buildPrompt(request: ReviewRequest): string {
    // Convert ReviewRequest to AIReviewRequest format
    const aiRequest: AIReviewRequest = {
      title: request.title || 'Code Review',
      description: request.description || '',
      sourceBranch: request.sourceBranch || 'feature-branch',
      targetBranch: request.targetBranch || 'main',
      diffContent: request.diffForPrompt, // This already includes file contents when appropriate
      parsedDiffs: request.parsedDiffs || [],
      existingFeedback: request.existingFeedback || [],
      authorName: request.authorName || 'Unknown',
    };

    return buildReviewPrompt(aiRequest);
  }

  public async initializeWithCleanup(): Promise<void> {
    // No temporary files to clean up since we use stdin
    console.log('Temporary folder cleanup completed');
  }

  public async reviewCode(req: Request, res: Response): Promise<void> {
    const requestData = req.body as ReviewRequest;

    if (!requestData.diffForPrompt) {
      res.status(400).json({ error: 'Missing diffForPrompt in request body.' });
      return;
    }

    try {
      // Build the prompt using the better prompt builder
      const prompt = this.buildPrompt(requestData);

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
