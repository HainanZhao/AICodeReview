import { LLMProvider, ReviewRequest, ReviewResponse } from './types.js';
import { Request, Response } from 'express';
import { AIProviderCore } from 'aicodereview-shared';
import { ReviewPromptBuilder } from './promptBuilder.js';
import { ReviewResponseProcessor } from './reviewResponseProcessor.js';

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private buildPrompt(diff: string): string {
    return ReviewPromptBuilder.buildPrompt(diff, { modelType: 'claude' });
  }

  public async reviewCode(req: Request, res: Response): Promise<void> {
    const { diffForPrompt } = req.body as ReviewRequest;

    if (!diffForPrompt) {
      res.status(400).json({ error: 'Missing diffForPrompt in request body.' });
      return;
    }

    try {
      // Validate API key
      AIProviderCore.validateApiKey(this.apiKey, 'Anthropic');

      // Build prompt and generate review using shared core
      const prompt = this.buildPrompt(diffForPrompt);
      const aiResponse = await AIProviderCore.generateAnthropicReview(this.apiKey, prompt);

      // Convert to backend response format
      const validatedResponse: ReviewResponse[] = aiResponse.map((item) => ({
        filePath: item.filePath,
        lineNumber: item.lineNumber,
        severity: item.severity as ReviewResponse['severity'],
        title: item.title,
        description: item.description,
      }));

      // Process and correct line numbers based on the diff mapping (Anthropic-specific)
      const correctedResponse = ReviewResponseProcessor.processReviewResponse(
        validatedResponse,
        diffForPrompt
      );

      res.json(correctedResponse);
    } catch (error) {
      console.error('Error calling Anthropic API:', error);

      try {
        AIProviderCore.handleAPIError(error, 'Anthropic');
      } catch (handledError) {
        res.status(500).json({
          error:
            handledError instanceof Error
              ? handledError.message
              : 'Failed to get review from Anthropic API.',
        });
      }
    }
  }
}
