import { LLMProvider, ReviewRequest, ReviewResponse } from './types.js';
import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ReviewPromptBuilder } from './promptBuilder.js';

export class GeminiProvider implements LLMProvider {
  private ai: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
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
      const model = this.ai.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent(this.buildPrompt(diffForPrompt));
      const response = await result.response;
      const text = response.text().trim();

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
          filePath: String(item.filePath).replace(/\\/g, '/'), // Normalize path separators
          lineNumber: Number(item.lineNumber),
          severity: item.severity as ReviewResponse['severity'],
          title: String(item.title),
          description: String(item.description),
        })
      );

      // With the simplified approach, line numbers should be accurate from the start
      // No need for complex line mapping and correction
      res.json(validatedResponse);
    } catch (error) {
      console.error('Error calling LLM API:', error);
      res.status(500).json({ error: 'Failed to get review from LLM API.' });
    }
  }
}
