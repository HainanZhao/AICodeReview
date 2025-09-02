/**
 * Unified MR Review Service
 * Handles the complete flow from MR URL to AI review feedback
 * Used by both CLI and server modes for consistency
 */

import {
  AIProviderCore,
  buildReviewPrompt,
  fetchMrData,
  filterAndDeduplicateFeedback,
  GeminiCliCore,
  GitLabConfig,
  parseAIResponse,
  Severity,
  type AIReviewRequest,
  type AIReviewResponse,
  type GeminiCliItem,
  type GitLabMRDetails,
  type ReviewFeedback,
} from '../index.js';
import { normalizeGitLabConfig, type FrontendGitLabConfig } from '../types/unifiedConfig.js';

export interface MrReviewOptions {
  provider: 'gemini' | 'anthropic' | 'gemini-cli';
  apiKey?: string;
  verbose?: boolean;
}

export interface MrReviewResult {
  feedback: ReviewFeedback[];
  summary: string;
  overallRating: 'approve' | 'request_changes' | 'comment';
  mrDetails: GitLabMRDetails;
}

/**
 * Unified service for processing MR reviews
 * Handles both frontend and CLI configurations
 */
export class MrReviewService {
  /**
   * Complete MR review flow: URL → GitLab data → AI review → Feedback
   */
  static async reviewMr(
    mrUrl: string,
    gitlabConfig: FrontendGitLabConfig | GitLabConfig,
    options: MrReviewOptions
  ): Promise<MrReviewResult> {
    // Normalize config format
    const normalizedConfig = normalizeGitLabConfig(gitlabConfig);

    if (options.verbose) {
      console.log(`🔍 Fetching MR data from: ${mrUrl}`);
    }

    // Fetch MR data using unified GitLab service
    const mrDetails = await fetchMrData(normalizedConfig, mrUrl);

    if (options.verbose) {
      console.log(`📄 Found ${mrDetails.fileDiffs.length} changed files`);
      console.log(`💬 Found ${mrDetails.existingFeedback.length} existing comments`);
    }

    // Check if there are changes to review
    if (mrDetails.fileDiffs.length === 0) {
      return {
        feedback: [],
        summary: 'No file changes found in this merge request.',
        overallRating: 'approve',
        mrDetails,
      };
    }

    // Build AI review request
    const reviewRequest: AIReviewRequest = {
      title: mrDetails.title,
      description: `Merge Request: ${mrDetails.webUrl}`,
      sourceBranch: mrDetails.sourceBranch,
      targetBranch: mrDetails.targetBranch,
      diffContent: mrDetails.diffForPrompt,
      parsedDiffs: mrDetails.parsedDiffs,
      existingFeedback: mrDetails.existingFeedback,
      authorName: mrDetails.authorName,
    };

    if (options.verbose) {
      console.log(`🤖 Generating AI review using ${options.provider}...`);
      console.log(`📊 Diff content: ${mrDetails.diffForPrompt.length} characters`);
    }

    // Generate AI review
    const aiResponse = await this.generateAIReview(reviewRequest, options);

    // Filter and deduplicate feedback
    const filteredFeedback = filterAndDeduplicateFeedback(
      aiResponse.feedback,
      mrDetails.existingFeedback
    );

    // Populate position information for feedback items
    const feedbackWithPositions = this.populateFeedbackPositions(filteredFeedback, mrDetails);

    if (options.verbose) {
      console.log(`✅ Generated ${feedbackWithPositions.length} review comments`);
    }

    return {
      feedback: feedbackWithPositions,
      summary: aiResponse.summary || 'AI review completed',
      overallRating: aiResponse.overallRating || 'comment',
      mrDetails,
    };
  }

  /**
   * Generates AI review using the specified provider
   */
  private static async generateAIReview(
    request: AIReviewRequest,
    options: MrReviewOptions
  ): Promise<AIReviewResponse> {
    const prompt = buildReviewPrompt(request);

    switch (options.provider) {
      case 'gemini':
        return this.generateGeminiReview(prompt, options);
      case 'anthropic':
        return this.generateAnthropicReview(prompt, options);
      case 'gemini-cli':
        return this.generateGeminiCliReview(prompt, options);
      default:
        throw new Error(`Unsupported AI provider: ${options.provider}`);
    }
  }

  /**
   * Generates review using Gemini API
   */
  private static async generateGeminiReview(
    prompt: string,
    options: MrReviewOptions
  ): Promise<AIReviewResponse> {
    if (!options.apiKey) {
      throw new Error('API key is required for Gemini provider');
    }

    try {
      const aiResponse = await AIProviderCore.generateGeminiReview(options.apiKey, prompt);
      return parseAIResponse(JSON.stringify(aiResponse));
    } catch (error) {
      throw new Error(
        `Gemini review failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generates review using Anthropic Claude
   */
  private static async generateAnthropicReview(
    prompt: string,
    options: MrReviewOptions
  ): Promise<AIReviewResponse> {
    if (!options.apiKey) {
      throw new Error('API key is required for Anthropic provider');
    }

    try {
      const aiResponse = await AIProviderCore.generateAnthropicReview(options.apiKey, prompt);
      return parseAIResponse(JSON.stringify(aiResponse));
    } catch (error) {
      throw new Error(
        `Anthropic review failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generates review using Gemini CLI tool
   */
  private static async generateGeminiCliReview(
    prompt: string,
    options: MrReviewOptions
  ): Promise<AIReviewResponse> {
    try {
      if (options.verbose) {
        console.log('Calling gemini CLI...');
      }

      const geminiItems = await GeminiCliCore.executeReview(prompt, { verbose: !!options.verbose });

      // Convert to our expected format
      const feedback = geminiItems.map((item: GeminiCliItem, index: number) => ({
        id: `gemini-cli-${Date.now()}-${index}`,
        filePath: String(item.filePath || '').replace(/\\/g, '/'),
        lineNumber: Number(item.lineNumber || 0),
        severity:
          item.severity === 'error'
            ? Severity.Critical
            : item.severity === 'warning'
              ? Severity.Warning
              : item.severity === 'info'
                ? Severity.Info
                : Severity.Suggestion,
        title: String(item.title || 'Code Review Comment'),
        description: String(item.description || ''),
        lineContent: '',
        position: null,
        status: 'pending' as const,
        isExisting: false,
      }));

      return {
        feedback,
        summary: `Gemini CLI review completed with ${feedback.length} recommendations.`,
        overallRating: feedback.length > 0 ? 'comment' : 'approve',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Provide clearer error messages for common issues
      if (
        errorMessage.includes('not found') ||
        errorMessage.includes('command not found') ||
        errorMessage.includes('aliased or linked to "gcloud"') ||
        errorMessage.includes('part of the Google Cloud SDK') ||
        errorMessage.includes('Could not verify the "gemini" CLI')
      ) {
        throw new Error(
          'Gemini CLI tool not found or misconfigured. Please ensure it is installed ' +
            '(npm install -g @google-ai/generative-ai-cli) and that the "gemini" command ' +
            'is available in your PATH and not conflicting with "gcloud".'
        );
      }

      throw new Error(`Gemini CLI review failed: ${errorMessage}`);
    }
  }

  /**
   * Populates position information for feedback items based on MR data
   */
  private static populateFeedbackPositions(
    feedback: ReviewFeedback[],
    mrDetails: GitLabMRDetails
  ): ReviewFeedback[] {
    return feedback.map((item) => {
      if (item.position) {
        return item; // Already has position
      }

      // For general file comments (line 0), don't add position
      if (item.lineNumber === 0) {
        return item;
      }

      // Find the file in parsed diffs to create position
      const parsedFile = mrDetails.parsedDiffs.find(
        (p: { filePath: string }) => p.filePath === item.filePath
      );
      if (!parsedFile) {
        return item; // File not found in diffs
      }

      // Create position for inline comment
      // Trust the line number from AI since it comes from full file content
      return {
        ...item,
        position: {
          base_sha: mrDetails.base_sha,
          start_sha: mrDetails.start_sha,
          head_sha: mrDetails.head_sha,
          position_type: 'text',
          old_path: parsedFile.oldPath,
          new_path: parsedFile.filePath,
          new_line: item.lineNumber,
          old_line: undefined, // Will be determined by GitLab
        },
      };
    });
  }
}
