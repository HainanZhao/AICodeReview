import { ReviewRequest, ReviewResponse } from './types.js';
import { Request, Response } from 'express';
import { BaseLLMProvider } from './baseLLMProvider.js';
import {
  AIProviderCore,
  buildReviewPrompt,
  parseAIResponse,
  type AIReviewRequest,
} from '../../shared/index.js';

export class GeminiProvider extends BaseLLMProvider {
  protected providerName = 'gemini' as const;

  constructor(apiKey: string) {
    super(apiKey);
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

  public async reviewCode(req: Request, res: Response): Promise<void> {
    const requestData = req.body as ReviewRequest;

    if (!requestData.diffForPrompt) {
      res.status(400).json({ error: 'Missing diffForPrompt in request body.' });
      return;
    }

    try {
      // Validate API key
      AIProviderCore.validateApiKey(this.apiKey!, 'Gemini');

      // Build prompt using the better prompt builder
      const prompt = this.buildPrompt(requestData);

      // Generate review using shared core - but we need to parse differently
      const rawResponse = await this.generateRawGeminiReview(prompt);

      // Parse using the better parser from aiReviewCore
      const aiReviewResponse = parseAIResponse(JSON.stringify(rawResponse));

      // Convert to backend response format
      const validatedResponse: ReviewResponse[] = aiReviewResponse.feedback.map((item) => ({
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

  private async generateRawGeminiReview(prompt: string): Promise<unknown> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = (await AIProviderCore.createGeminiClient(this.apiKey!)) as any;
      const model = client.getGenerativeModel({ model: 'gemini-1.5-pro' });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(
        `Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
