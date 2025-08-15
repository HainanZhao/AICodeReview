import { ConfigLoader } from '../config/configLoader.js';
import { AppConfig } from '../config/configSchema.js';
import { fetchOpenMergeRequests, fetchMrData } from '../shared/services/gitlabCore.js';
import { GitLabMergeRequest } from '../shared/types/gitlab.js';
import { getReviewedMr, updateReviewedMr, loadState } from '../state/reviewState.js';
import { CLIReviewCommand } from './reviewCommand.js';
import { CLIOutputFormatter } from './outputFormatter.js';

export class AutoReviewCommand {
  private config: AppConfig;
  private running = false;

  constructor() {
    this.config = ConfigLoader.loadConfig({});
  }

  public async run(): Promise<void> {
    if (!this.config.autoReview?.enabled) {
      console.log(
        CLIOutputFormatter.formatWarning('Auto review mode is disabled in the configuration.')
      );
      return;
    }

    if (!this.config.gitlab) {
      console.log(CLIOutputFormatter.formatError('GitLab configuration is missing.'));
      return;
    }

    if (this.running) {
      console.log(CLIOutputFormatter.formatWarning('Auto review mode is already running.'));
      return;
    }

    this.running = true;
    console.log(CLIOutputFormatter.formatProgress('Starting auto review mode...'));
    loadState(); // Initial load of state

    const interval = this.config.autoReview.interval * 1000;
    this.runReviewLoop();
    setInterval(() => this.runReviewLoop(), interval);
  }

  private async runReviewLoop(): Promise<void> {
    console.log(
      CLIOutputFormatter.formatProgress('Checking for new and updated merge requests...')
    );
    const projects = this.config.autoReview!.projects;

    for (const projectId of projects) {
      try {
        const mrs = await fetchOpenMergeRequests(this.config.gitlab!, projectId);
        for (const mr of mrs) {
          await this.processMergeRequest(mr);
        }
      } catch (error) {
        console.error(
          CLIOutputFormatter.formatError(
            `Failed to fetch MRs for project ${projectId}: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    }
  }

  private async processMergeRequest(mr: GitLabMergeRequest): Promise<void> {
    // Fetch detailed MR info to get the head_sha
    const mrDetails = await fetchMrData(this.config.gitlab!, mr.web_url);
    
    const reviewedMr = getReviewedMr(mr.id);
    if (reviewedMr && reviewedMr.head_sha === mrDetails.head_sha) {
      // Already reviewed and no new changes
      return;
    }

    console.log(CLIOutputFormatter.formatProgress(`New or updated MR found: ${mr.web_url}`));

    try {
      await CLIReviewCommand.executeReview({
        mrUrl: [mr.web_url],
        dryRun: false,
        mock: false,
        verbose: true,
        provider: this.config.llm.provider,
        apiKey: this.config.llm.apiKey,
        googleCloudProject: this.config.llm.googleCloudProject,
      });
      updateReviewedMr(mr.id, mrDetails.head_sha);
      console.log(CLIOutputFormatter.formatSuccess(`Successfully reviewed MR: ${mr.web_url}`));
    } catch (error) {
      console.error(
        CLIOutputFormatter.formatError(
          `Failed to review MR ${mr.web_url}: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }
}
