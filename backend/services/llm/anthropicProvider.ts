import { LLMProvider, ReviewRequest, ReviewResponse } from './types.js';
import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { ReviewPromptBuilder } from './promptBuilder.js';
import { ReviewResponseProcessor } from './reviewResponseProcessor.js';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
    });
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
      const message = await this.client.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages: [{ role: 'user', content: this.buildPrompt(diffForPrompt) }],
      });

      const text = message.content[0].text.trim();

      if (!text) {
        res.json([]);
        return;
      }

      const parsedResponse = JSON.parse(text);
      if (!Array.isArray(parsedResponse)) {
        console.warn('Unexpected JSON structure from API:', parsedResponse);
        res.status(500).json({ error: 'Unexpected response format from LLM API.' });
        return;
      }

      const validatedResponse = parsedResponse.map(
        (item: ReviewResponse): ReviewResponse => ({
          filePath: String(item.filePath),
          lineNumber: Number(item.lineNumber),
          severity: item.severity as ReviewResponse['severity'],
          title: String(item.title),
          description: String(item.description),
        })
      );

      // Process and correct line numbers based on the diff mapping
      const correctedResponse = ReviewResponseProcessor.processReviewResponse(
        validatedResponse,
        diffForPrompt
      );

      res.json(correctedResponse);
    } catch (error) {
      console.error('Error calling LLM API:', error);
      res.status(500).json({ error: 'Failed to get review from LLM API.' });
    }
  }
}
