import { CLIReviewOptions } from './types.js';
import { CLIConfigValidator } from './configValidator.js';
import { CLIOutputFormatter } from './outputFormatter.js';
import { CLIAIProvider } from './aiProvider.js';
import { ConfigLoader } from '../config/configLoader.js';
import {
  fetchMrData,
  filterAndDeduplicateFeedback,
  createReviewSummary,
  Severity,
  type AIReviewRequest,
  type AIReviewResponse,
  type ReviewFeedback,
  postDiscussion,
} from 'aicodereview-shared';

/**
 * Main CLI review command orchestrator
 */
export class CLIReviewCommand {
  /**
   * Executes a complete MR review in CLI mode
   */
  static async executeReview(options: CLIReviewOptions): Promise<void> {
    try {
      if (options.verbose) {
        console.log(CLIOutputFormatter.formatProgress('Starting CLI review mode...'));
      }

      // Load and validate configuration
      const config = ConfigLoader.loadConfig({
        provider: options.provider,
        apiKey: options.apiKey,
        googleCloudProject: options.googleCloudProject,
        port: options.port,
        host: options.host,
      });
      CLIConfigValidator.validateForReview(config);

      if (options.verbose) {
        console.log(CLIOutputFormatter.formatProgress('Configuration validated'));
        console.log(CLIOutputFormatter.formatProgress(`GitLab URL: ${config.gitlab?.url}`));
        console.log(CLIOutputFormatter.formatProgress(`LLM Provider: ${config.llm.provider}`));
      }

      // Parse MR URL
      const mrInfo = this.parseMrUrl(options.mrUrl, config.gitlab!.url);
      if (options.verbose) {
        console.log(
          CLIOutputFormatter.formatProgress(
            `Parsed MR: ${mrInfo.projectPath}/merge_requests/${mrInfo.mrIid}`
          )
        );
      }

      // Fetch MR data from GitLab
      console.log(CLIOutputFormatter.formatProgress('Fetching MR details...'));
      const mrData = await fetchMrData(config.gitlab!, options.mrUrl);

      if (options.verbose) {
        console.log(CLIOutputFormatter.formatProgress(`MR Title: ${mrData.title}`));
        console.log(CLIOutputFormatter.formatProgress(`Author: ${mrData.authorName}`));
        console.log(CLIOutputFormatter.formatProgress(`Files changed: ${mrData.fileDiffs.length}`));
        console.log(
          CLIOutputFormatter.formatProgress(`Existing feedback: ${mrData.existingFeedback.length}`)
        );
      }

      // Check if there are changes to review
      if (mrData.fileDiffs.length === 0) {
        console.log(
          CLIOutputFormatter.formatWarning('No file changes found in this merge request')
        );
        return;
      }

      // Generate AI review
      console.log(CLIOutputFormatter.formatProgress('Generating AI review...'));

      const reviewRequest: AIReviewRequest = {
        title: mrData.title,
        description: `Merge Request: ${mrData.webUrl}`,
        sourceBranch: mrData.sourceBranch,
        targetBranch: mrData.targetBranch,
        diffContent: mrData.diffForPrompt,
        parsedDiffs: mrData.parsedDiffs,
        existingFeedback: mrData.existingFeedback,
        authorName: mrData.authorName,
      };

      if (options.verbose) {
        console.log(
          CLIOutputFormatter.formatProgress(
            `Diff content length: ${mrData.diffForPrompt.length} characters`
          )
        );
      }

      let aiResponse: AIReviewResponse;

      if (options.mock) {
        // Use mock response for testing without AI API calls
        aiResponse = this.generateMockAIResponse(reviewRequest);
        console.log(CLIOutputFormatter.formatProgress('Using mock AI response (testing mode)'));
      } else {
        // Use actual AI provider for both dry-run and live modes
        const aiProvider = new CLIAIProvider(config);
        try {
          console.log(CLIOutputFormatter.formatProgress('Sending request to AI provider...'));
          aiResponse = await aiProvider.generateReview(reviewRequest);

          if (options.dryRun) {
            console.log(
              CLIOutputFormatter.formatProgress(
                '✅ Received real AI response (dry-run mode - no comments will be posted)'
              )
            );
          } else {
            console.log(CLIOutputFormatter.formatProgress('✅ Received real AI response'));
          }
        } catch (error) {
          console.error(
            CLIOutputFormatter.formatError(
              `AI review failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          );
          console.log(CLIOutputFormatter.formatProgress('Falling back to mock response...'));
          aiResponse = this.generateMockAIResponse(reviewRequest);
        }
      }

      // Filter and process feedback
      let filteredFeedback = filterAndDeduplicateFeedback(
        aiResponse.feedback,
        mrData.existingFeedback
      );

      // Populate position for new feedback items
      filteredFeedback = filteredFeedback.map((feedback: ReviewFeedback) => {
        if (!feedback.position) {
          return {
            ...feedback,
            position: {
              base_sha: mrData.base_sha,
              start_sha: mrData.start_sha,
              head_sha: mrData.head_sha,
              position_type: 'text',
              old_path: feedback.filePath, // Assuming old_path is same as new_path for new comments
              new_path: feedback.filePath,
              new_line: feedback.lineNumber,
              old_line: undefined, // Not applicable for new comments on new lines
            },
          };
        }
        return feedback;
      });

      // Create summary
      const reviewSummary = createReviewSummary(filteredFeedback, aiResponse.overallRating);

      // Format and display results
      const output = CLIOutputFormatter.formatReview(
        filteredFeedback,
        options.mrUrl,
        !!options.dryRun
      );
      console.log(output);

      if (!options.dryRun && filteredFeedback.length > 0) {
        // Proceed directly with posting comments without confirmation
        {
          console.log(CLIOutputFormatter.formatProgress('Posting comments to GitLab...'));
          for (const feedbackItem of filteredFeedback) {
            try {
              await postDiscussion(config.gitlab!, mrData, feedbackItem);
              console.log(
                CLIOutputFormatter.formatSuccess(
                  `Posted comment for ${feedbackItem.filePath}:${feedbackItem.lineNumber}`
                )
              );
            } catch (postError) {
              console.error(
                CLIOutputFormatter.formatError(
                  `Failed to post comment for ${feedbackItem.filePath}:${feedbackItem.lineNumber}: ${postError instanceof Error ? postError.message : String(postError)}`
                )
              );
            }
          }
          console.log(CLIOutputFormatter.formatSuccess('All comments processed.'));
        }
      }

      // Always display the overall summary
      console.log('\n' + reviewSummary);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('configuration') || errorMessage.includes('GitLab')) {
        console.error(CLIOutputFormatter.formatError(errorMessage));
        console.log('');
        console.log(CLIConfigValidator.getConfigSetupInstructions());
      } else {
        console.error(CLIOutputFormatter.formatError(`Review failed: ${errorMessage}`));
        if (options.verbose && error instanceof Error && error.stack) {
          console.error(error.stack);
        }
      }
      process.exit(1);
    }
  }

  /**
   * Parses a GitLab MR URL to extract project and MR information
   */
  private static parseMrUrl(
    mrUrl: string,
    gitlabBaseUrl: string
  ): { projectPath: string; mrIid: string } {
    try {
      const url = new URL(mrUrl);
      const baseUrl = new URL(gitlabBaseUrl);

      if (url.hostname !== baseUrl.hostname) {
        throw new Error('MR URL hostname does not match the configured GitLab instance hostname.');
      }

      const path = url.pathname;
      const mrPathSegment = '/-/merge_requests/';
      const mrPathIndex = path.indexOf(mrPathSegment);

      if (mrPathIndex === -1) {
        throw new Error("Could not find '/-/merge_requests/' in the URL path.");
      }

      const mrIidMatch = path.substring(mrPathIndex + mrPathSegment.length).match(/^(\d+)/);
      if (!mrIidMatch) {
        throw new Error('Could not parse Merge Request IID from the URL.');
      }
      const mrIid = mrIidMatch[1];

      const projectPath = path.substring(1, mrPathIndex);
      if (!projectPath) {
        throw new Error('Could not parse project path from the URL.');
      }

      return { projectPath, mrIid };
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      throw new Error(
        `Invalid URL format. Please check your MR URL and GitLab instance URL. Details: ${errorMessage}`
      );
    }
  }

  /**
   * Validates that the provided URL looks like a GitLab MR URL
   */
  static validateMrUrl(url: string): boolean {
    try {
      new URL(url);
      return url.includes('/-/merge_requests/');
    } catch {
      return false;
    }
  }

  /**
   * Generates a mock AI response for testing purposes
   */
  private static generateMockAIResponse(request: AIReviewRequest): AIReviewResponse {
    const feedback: ReviewFeedback[] = [];

    // Generate some sample feedback based on the files
    if (request.parsedDiffs.length > 0) {
      const firstFile = request.parsedDiffs[0];

      feedback.push({
        id: 'mock-1',
        filePath: firstFile.filePath,
        lineNumber: 1,
        severity: Severity.Info,
        title: 'Mock Review Comment',
        description: `This is a mock review comment for demonstration purposes. In a real scenario, this would be generated by an AI provider analyzing the code changes in ${firstFile.filePath}.`,
        lineContent: '',
        position: null,
        status: 'pending' as const,
        isExisting: false,
      });

      // Add a warning if there are many files changed
      if (request.parsedDiffs.length > 10) {
        feedback.push({
          id: 'mock-2',
          filePath: '',
          lineNumber: 0,
          severity: Severity.Warning,
          title: 'Large changeset detected',
          description: `This merge request modifies ${request.parsedDiffs.length} files. Consider breaking this into smaller, more focused changes for easier review and testing.`,
          lineContent: '',
          position: null,
          status: 'pending' as const,
          isExisting: false,
        });
      }
    }

    return {
      feedback,
      summary: `Mock AI review completed for MR: ${request.title}. This is a simulated response for development/testing.`,
      overallRating: 'comment',
    };
  }
}
