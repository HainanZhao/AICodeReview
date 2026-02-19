import { ConfigLoader } from '../config/configLoader.js';
import { postDiscussion } from '../services/gitlabService.js';
import {
  type FileDiff,
  type GitLabMRDetails,
  type MrReviewOptions,
  MrReviewService,
  type ParsedFileDiff,
  type ReviewFeedback,
  Severity,
  createReviewSummary,
} from '../shared/index.js';
import { CLIConfigValidator } from './configValidator.js';
import { CLIOutputFormatter } from './outputFormatter.js';
import type { CLIReviewOptions } from './types.js';

/**
 * Main CLI review command orchestrator
 */
export class CLIReviewCommand {
  /**
   * Executes a complete MR review in CLI mode
   */
  static async executeReview(options: CLIReviewOptions): Promise<void> {
    const reviewResults: { mrUrl: string; success: boolean; summary?: string; error?: string }[] =
      [];

    try {
      if (options.verbose) {
        console.log(CLIOutputFormatter.formatProgress('Starting CLI review mode...'));
      }

      // Load and validate configuration once for all reviews
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

      // Process each MR URL with limited concurrency
      const CONCURRENCY_LIMIT = 4; // Cap to 4 concurrent reviews

      const processInBatches = async () => {
        const queue = [...options.mrUrl];
        const activePromises: Promise<void>[] = [];

        const executeNext = async () => {
          if (queue.length === 0 && activePromises.length === 0) {
            return; // All done
          }

          while (queue.length > 0 && activePromises.length < CONCURRENCY_LIMIT) {
            const singleMrUrl = queue.shift()!;
            const promise = (async () => {
              try {
                const result = await CLIReviewCommand._executeSingleReview(
                  singleMrUrl,
                  options,
                  config
                );
                reviewResults.push({ mrUrl: singleMrUrl, success: true, summary: result.summary });
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                reviewResults.push({ mrUrl: singleMrUrl, success: false, error: errorMessage });
                console.error(
                  CLIOutputFormatter.formatError(
                    `Review for ${singleMrUrl} failed: ${errorMessage}`
                  )
                );
              }
            })();
            activePromises.push(promise);
            promise.finally(() => {
              activePromises.splice(activePromises.indexOf(promise), 1);
              executeNext(); // Try to process next once one is done
            });
          }
        };

        // Start initial batch
        executeNext();
        // Wait for all promises to settle
        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (queue.length === 0 && activePromises.length === 0) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
      };

      await processInBatches();

      // Display overall summary
      console.log('\n--- Overall Review Summary ---');
      for (const result of reviewResults) {
        if (result.success) {
          console.log(
            CLIOutputFormatter.formatSuccess(`Review for ${result.mrUrl} completed successfully.`)
          );
        } else {
          console.log(
            CLIOutputFormatter.formatError(`Review for ${result.mrUrl} failed: ${result.error}`)
          );
        }
        console.log(''); // Add a blank line for readability
      }

      // Exit with non-zero code if any review failed
      if (reviewResults.some((result) => !result.success)) {
        process.exit(1);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('configuration') || errorMessage.includes('GitLab')) {
        console.error(CLIOutputFormatter.formatError(errorMessage));
        console.log('');
        console.log(CLIConfigValidator.getConfigSetupInstructions());
      } else {
        console.error(CLIOutputFormatter.formatError(`CLI execution failed: ${errorMessage}`));
        if (options.verbose && error instanceof Error && error.stack) {
          console.error(error.stack);
        }
      }
      process.exit(1);
    }
  }

  /**
   * Executes a single MR review in CLI mode
   */
  private static async _executeSingleReview(
    mrUrl: string,
    options: CLIReviewOptions,
    config: ReturnType<typeof ConfigLoader.loadConfig>
  ): Promise<{ summary: string }> {
    if (options.verbose) {
      console.log(CLIOutputFormatter.formatProgress(`\n--- Starting review for ${mrUrl} ---`));
    } else {
      console.log(CLIOutputFormatter.formatProgress(`Starting review for ${mrUrl}...`));
    }

    // Parse MR URL
    const gitlabUrl = config.gitlab?.url;
    if (!gitlabUrl) {
      throw new Error('GitLab URL is not configured. Please run --init to configure.');
    }
    const mrInfo = CLIReviewCommand.parseMrUrl(mrUrl, gitlabUrl, options.mock || false);
    if (options.verbose) {
      console.log(
        CLIOutputFormatter.formatProgress(
          `Parsed MR: ${mrInfo.projectPath}/merge_requests/${mrInfo.mrIid}`
        )
      );
    }

    // Fetch MR data and generate AI review using unified service
    if (options.verbose) {
      console.log(
        CLIOutputFormatter.formatProgress('Fetching MR details and generating review...')
      );
    }

    let reviewResult;

    if (options.mock) {
      // Use mock response for testing without AI API calls
      reviewResult = CLIReviewCommand.generateMockReviewResult(mrUrl);
      if (options.verbose) {
        console.log(CLIOutputFormatter.formatProgress('Using mock response (testing mode)'));
      }
    } else {
      // Use unified MR review service
      const reviewOptions: MrReviewOptions = {
        provider: config.llm.provider as 'gemini' | 'anthropic' | 'gemini-cli',
        apiKey: config.llm.apiKey,
        verbose: !!options.verbose,
        customPromptFile: options.customPromptFile,
        promptStrategy: options.promptStrategy,
        projectPrompts: options.projectPrompts,
        canonicalProjectName: options.canonicalProjectName, // Pass through canonical project name
      };

      try {
        if (options.verbose) {
          console.log(CLIOutputFormatter.formatProgress('Using unified MR review service...'));
        }
        reviewResult = await MrReviewService.reviewMr(mrUrl, config.gitlab!, reviewOptions);

        if (options.verbose) {
          if (options.dryRun) {
            console.log(
              CLIOutputFormatter.formatProgress(
                '✅ Received AI response (dry-run mode - no comments will be posted)'
              )
            );
          } else {
            console.log(CLIOutputFormatter.formatProgress('✅ Received AI response'));
          }
        }
      } catch (error) {
        console.error(
          CLIOutputFormatter.formatError(
            `AI review failed for ${mrUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        if (options.verbose) {
          console.log(CLIOutputFormatter.formatProgress('Falling back to mock response...'));
        }
        reviewResult = CLIReviewCommand.generateMockReviewResult(mrUrl);
      }
    }

    const { feedback: filteredFeedback, mrDetails, overallRating } = reviewResult;

    // Check if there are changes to review
    if (mrDetails.fileDiffs.length === 0) {
      const warning = CLIOutputFormatter.formatWarning(
        `No file changes found in merge request ${mrUrl}`
      );
      console.log(warning);
      return { summary: warning };
    }

    // Create summary
    const reviewSummary = createReviewSummary(filteredFeedback, overallRating);

    // Format and display results for this MR
    const output = CLIOutputFormatter.formatReview(filteredFeedback, mrUrl, !!options.dryRun);
    console.log(output);

    if (!options.dryRun) {
      if (filteredFeedback.length > 0) {
        if (options.verbose) {
          console.log(CLIOutputFormatter.formatProgress('Posting comments to GitLab...'));
        }
        for (const feedbackItem of filteredFeedback) {
          try {
            const _result = await postDiscussion(config.gitlab!, mrDetails, feedbackItem);
            if (options.verbose) {
              console.log(
                CLIOutputFormatter.formatSuccess(
                  `Posted comment for ${feedbackItem.filePath}:${feedbackItem.lineNumber}`
                )
              );
            } else {
              // In non-verbose mode, just show a success message for each posted comment
              console.log(
                CLIOutputFormatter.formatSuccess(
                  `Posted comment for ${feedbackItem.filePath}:${feedbackItem.lineNumber} on ${mrUrl}`
                )
              );
            }
          } catch (postError) {
            console.error(
              CLIOutputFormatter.formatError(
                `Failed to post comment for ${feedbackItem.filePath}:${feedbackItem.lineNumber} on ${mrUrl}: ${postError instanceof Error ? postError.message : String(postError)}`
              )
            );
          }
        }
        if (options.verbose) {
          console.log(CLIOutputFormatter.formatSuccess('All comments processed for this MR.'));
        }
      } else {
        // No feedback generated, post an "All looks good" comment
        const allGoodFeedback: ReviewFeedback = {
          id: 'all-good',
          lineNumber: 0,
          filePath: '',
          severity: Severity.Info,
          title: 'No issues found',
          description:
            'All looks good. No specific issues or suggestions were identified by the AI code reviewer.',
          lineContent: '',
          position: null,
          status: 'pending',
          isExisting: false,
        };
        try {
          await postDiscussion(config.gitlab!, mrDetails, allGoodFeedback);
          console.log(
            CLIOutputFormatter.formatSuccess(`Posted "All looks good" comment to ${mrUrl}.`)
          );
        } catch (postError) {
          console.error(
            CLIOutputFormatter.formatError(
              `Failed to post "All looks good" comment to ${mrUrl}: ${postError instanceof Error ? postError.message : String(postError)}`
            )
          );
        }
      }
    }

    // Always display the overall summary for this MR
    console.log(`\n${reviewSummary}`);
    return { summary: reviewSummary };
  }

  /**
   * Parses a GitLab MR URL to extract project and MR information
   */
  private static parseMrUrl(
    mrUrl: string,
    gitlabBaseUrl: string,
    isMockMode: boolean // Add isMockMode parameter
  ): { projectPath: string; mrIid: string } {
    try {
      const url = new URL(mrUrl);
      const baseUrl = new URL(gitlabBaseUrl);

      // Bypass hostname validation in mock mode
      if (!isMockMode && url.hostname !== baseUrl.hostname) {
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
   * Generates a mock review result for testing purposes
   */
  private static generateMockReviewResult(mrUrl: string) {
    const mockMrDetails = CLIReviewCommand._fetchMockMrData(mrUrl, 'mock/project', '123');

    const feedback: ReviewFeedback[] = [];

    // Simulate no feedback for MR 999
    if (mrUrl.includes('/merge_requests/999')) {
      return {
        feedback: [],
        summary: 'Mock AI review completed. No issues found.',
        overallRating: 'approve' as const,
        mrDetails: mockMrDetails,
      };
    }

    // Generate some sample feedback based on the files
    if (mockMrDetails.parsedDiffs.length > 0) {
      const firstFile = mockMrDetails.parsedDiffs[0];

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
      if (mockMrDetails.parsedDiffs.length > 10) {
        feedback.push({
          id: 'mock-2',
          filePath: '',
          lineNumber: 0,
          severity: Severity.Warning,
          title: 'Large changeset detected',
          description: `This merge request modifies ${mockMrDetails.parsedDiffs.length} files. Consider breaking this into smaller, more focused changes for easier review and testing.`,
          lineContent: '',
          position: null,
          status: 'pending' as const,
          isExisting: false,
        });
      }
    }

    return {
      feedback,
      summary: 'Mock AI review completed. This is a simulated response for development/testing.',
      overallRating: 'comment' as const,
      mrDetails: mockMrDetails,
    };
  }

  /**
   * Generates mock MR data for testing purposes
   */
  private static _fetchMockMrData(
    mrUrl: string,
    projectPath: string,
    mrIid: string
  ): GitLabMRDetails {
    const mockFileDiff: FileDiff = {
      old_path: 'src/main.ts',
      new_path: 'src/main.ts',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `--- a/src/main.ts
+++ b/src/main.ts
@@ -1,3 +1,4 @@
 class MyClass {
   constructor() {
     console.log('Hello, world!');
+    // Added a new line
   }
 }
 `,
    };

    const mockParsedDiff: ParsedFileDiff = {
      filePath: 'src/main.ts',
      oldPath: 'src/main.ts',
      isNew: false,
      isDeleted: false,
      isRenamed: false,
      hunks: [
        {
          header: '@@ -1,3 +1,4 @@',
          oldStartLine: 1,
          oldLineCount: 3,
          newStartLine: 1,
          newLineCount: 4,
          lines: [
            { type: 'context', oldLine: 1, newLine: 1, content: 'class MyClass {' },
            { type: 'context', oldLine: 2, newLine: 2, content: '  constructor() {' },
            {
              type: 'context',
              oldLine: 3,
              newLine: 3,
              content: '    console.log("Hello, world!");',
            },
            { type: 'add', newLine: 4, content: '    // Added a new line' },
            { type: 'context', oldLine: 3, newLine: 3, content: '  }' },
          ],
          isCollapsed: false,
        },
      ],
    };

    return {
      projectPath,
      mrIid,
      projectId: 12345,
      title: `Mock MR ${mrIid}: Add new feature`,
      authorName: 'Mock User',
      webUrl: mrUrl,
      sourceBranch: 'feature/mock-branch',
      targetBranch: 'main',
      head_sha: 'mock_head_sha',
      base_sha: 'mock_base_sha',
      start_sha: 'mock_start_sha',
      fileDiffs: [mockFileDiff],
      diffForPrompt: mockFileDiff.diff,
      parsedDiffs: [mockParsedDiff],
      fileContents: {
        'src/main.ts': {
          oldContent: [
            'class MyClass {',
            '  constructor() {',
            '    console.log("Hello, world!");',
            '  }',
          ],
          newContent: [
            'class MyClass {',
            '  constructor() {',
            '    console.log("Hello, world!");',
            '    // Added a new line',
            '  }',
          ],
        },
      },
      lineMappings: {}, // Empty for mock
      discussions: [],
      existingFeedback: [],
      approvals: undefined,
    };
  }
}
