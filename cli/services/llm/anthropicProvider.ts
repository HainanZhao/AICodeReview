import type { Request, Response } from 'express';
import { AIProviderCore, parseAIResponse } from '../../shared/index.js';
import { BaseLLMProvider } from './baseLLMProvider.js';
import { ReviewResponseProcessor } from './reviewResponseProcessor.js';
import type { ReviewRequest, ReviewResponse } from './types.js';

export class AnthropicProvider extends BaseLLMProvider {
  readonly providerName = 'anthropic';

  public async reviewCode(req: Request, res: Response): Promise<void> {
    const requestData = req.body as ReviewRequest;

    if (!requestData.diffForPrompt) {
      res.status(400).json({ error: 'Missing diffForPrompt in request body.' });
      return;
    }

    try {
      // Validate API key
      AIProviderCore.validateApiKey(this.apiKey, 'Anthropic');

      // Build prompt using the better prompt builder
      const prompt = await this.buildPrompt(requestData);

      // Generate review using shared core - but we need to parse differently
      const rawResponse = await this.generateRawAnthropicReview(prompt);

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

      // Process and correct line numbers based on the diff mapping (Anthropic-specific)
      const correctedResponse = ReviewResponseProcessor.processReviewResponse(
        validatedResponse,
        requestData.diffForPrompt
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

  private async generateRawAnthropicReview(prompt: string): Promise<unknown> {
    try {
      if (!this.apiKey) {
        throw new Error('Anthropic API key not provided');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = (await AIProviderCore.createAnthropicClient(this.apiKey)) as any;

      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241010',
        max_tokens: 8192,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';

      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(
        `Anthropic API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
