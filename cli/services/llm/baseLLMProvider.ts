import { Request, Response } from 'express';
import { LLMProvider, MrUrlRequest } from './types.js';
import { MrReviewService, type MrReviewOptions } from '../../shared/index.js';

/**
 * Base LLM provider that implements unified MR review logic
 * All provider implementations can extend this class
 */
export abstract class BaseLLMProvider implements LLMProvider {
  protected apiKey?: string;
  protected abstract providerName: 'gemini' | 'anthropic' | 'gemini-cli';

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  /**
   * New unified method for MR URL-based reviews
   * This uses the shared MrReviewService for consistency
   */
  public async reviewMr(req: Request, res: Response): Promise<void> {
    try {
      const requestData = req.body as MrUrlRequest;

      if (!requestData.mrUrl) {
        res.status(400).json({ error: 'Missing mrUrl in request body.' });
        return;
      }

      if (!requestData.gitlabConfig?.gitlabUrl || !requestData.gitlabConfig?.accessToken) {
        res.status(400).json({ error: 'Missing GitLab configuration in request body.' });
        return;
      }

      // Use unified MR review service
      const options: MrReviewOptions = {
        provider: this.providerName,
        apiKey: this.apiKey,
        verbose: false, // Server mode doesn't need verbose logging
      };

      const result = await MrReviewService.reviewMr(
        requestData.mrUrl,
        requestData.gitlabConfig,
        options
      );

      // Return the full result with feedback, summary, and overall rating
      res.json({
        feedback: result.feedback.map((item) => ({
          filePath: item.filePath,
          lineNumber: item.lineNumber,
          severity: item.severity,
          title: item.title,
          description: item.description,
          id: item.id,
          status: item.status,
          lineContent: item.lineContent,
          position: item.position,
        })),
        summary: result.summary,
        overallRating: result.overallRating,
      });
    } catch (error) {
      console.error(`Error in ${this.providerName} reviewMr:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        error: `${this.providerName} review failed: ${errorMessage}`,
      });
    }
  }

  /**
   * Abstract method for traditional diff-based reviews
   * Each provider must implement this
   */
  public abstract reviewCode(req: Request, res: Response): Promise<void>;
}
