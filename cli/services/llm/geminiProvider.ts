import { LLMProvider, ReviewRequest, ReviewResponse } from './types.js';
import { Request, Response } from 'express';
import { AIProviderCore } from '../../shared/index.js';
import { ReviewPromptBuilder } from './promptBuilder.js';

export class GeminiProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private buildPrompt(diff: string): string {
    return ReviewPromptBuilder.buildPrompt(diff, { modelType: 'gemini' });
  }

  public async reviewCode(req: Request, res: Response): Promise<void> {
    const { diffForPrompt } = req.body as ReviewRequest;

    if (!diffForPrompt) {
      res.status(400).json({ error: 'Missing diffForPrompt in request body.' });
      return;
    }

    try {
      // Validate API key
      AIProviderCore.validateApiKey(this.apiKey, 'Gemini');

      // Build prompt and generate review using shared core
      const prompt = this.buildPrompt(diffForPrompt);
      const aiResponse = await AIProviderCore.generateGeminiReview(this.apiKey, prompt);

      // Convert to backend response format
      const validatedResponse: ReviewResponse[] = aiResponse.map((item) => ({
        filePath: item.filePath,
        lineNumber: item.lineNumber,
        severity: item.severity as ReviewResponse['severity'],
        title: item.title,
        description: item.description,
      }));

      res.json(validatedResponse);
    } catch (error) {
      console.error('Error calling Gemini API:', error);

      try {
        AIProviderCore.handleAPIError(error, 'Gemini');
      } catch (handledError) {
        res.status(500).json({
          error:
            handledError instanceof Error
              ? handledError.message
              : 'Failed to get review from Gemini API.',
        });
      }
    }
  }
}
