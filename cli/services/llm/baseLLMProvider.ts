import type { Request, Response } from 'express';
import {
  type AIReviewRequest,
  type MrReviewOptions,
  MrReviewService,
  buildReviewPrompt,
} from '../../shared/index.js';
import type { LLMProvider, MrUrlRequest, ReviewRequest } from './types.js';

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

      // Remove large fields from mrDetails that are not needed by frontend
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { diffForPrompt, ...mrDetailsForFrontend } = result.mrDetails;

      // Return the result with lightweight mrDetails
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
        mrDetails: mrDetailsForFrontend,
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
   * Shared method to build review prompt from ReviewRequest
   * Converts ReviewRequest to AIReviewRequest format and uses shared buildReviewPrompt
   */
  protected async buildPrompt(request: ReviewRequest): Promise<string> {
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
      changedFiles: request.changedFiles,
      projectId: request.projectId,
      headSha: request.headSha,
      gitlabConfig: request.gitlabConfig,
      provider: this.providerName,
      lineMappings: request.lineMappings, // Pass line mappings for accurate line number translation
    };

    return buildReviewPrompt(aiRequest);
  }

  /**
   * Abstract method for traditional diff-based reviews
   * Each provider must implement this
   */
  public abstract reviewCode(req: Request, res: Response): Promise<void>;
}
