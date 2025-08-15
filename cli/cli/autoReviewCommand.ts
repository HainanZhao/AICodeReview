import { ConfigLoader } from '../config/configLoader.js';
import { AppConfig } from '../config/configSchema.js';
import { ProjectCacheService } from '../services/projectCacheService.js';
import { fetchMrData, fetchOpenMergeRequests } from '../shared/services/gitlabCore.js';
import { GitLabMergeRequest } from '../shared/types/gitlab.js';
import { getReviewedMr, loadState, updateReviewedMr } from '../state/reviewState.js';
import { CLIOutputFormatter } from './outputFormatter.js';
import { CLIReviewCommand } from './reviewCommand.js';

export class AutoReviewCommand {
  private config: AppConfig;
  private running = false;
  private projectCacheService: ProjectCacheService;

  constructor() {
    this.config = ConfigLoader.loadConfig({});
    this.projectCacheService = new ProjectCacheService();
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
    const projectNames = this.config.autoReview!.projects;

    if (!this.config.gitlab) {
      console.error(CLIOutputFormatter.formatError('GitLab configuration is missing.'));
      return;
    }

    try {
      // Resolve project names to IDs using the cache
      const resolvedProjects = await this.projectCacheService.resolveProjectNamesToIds(
        projectNames,
        this.config.gitlab
      );

      if (resolvedProjects.length === 0) {
        console.log(
          CLIOutputFormatter.formatWarning(
            `No projects found matching: ${projectNames.join(', ')}. Please check your configuration.`
          )
        );
        return;
      }

      if (resolvedProjects.length !== projectNames.length) {
        const foundNames = resolvedProjects.map((p) => p.name);
        const notFoundNames = projectNames.filter(
          (name) =>
            !foundNames.some(
              (foundName) =>
                foundName.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(foundName.toLowerCase())
            )
        );
        console.log(
          CLIOutputFormatter.formatWarning(
            `Some projects could not be found: ${notFoundNames.join(', ')}`
          )
        );
      }

      console.log(
        CLIOutputFormatter.formatProgress(
          `Monitoring ${resolvedProjects.length} project(s): ${resolvedProjects.map((p) => p.name).join(', ')}`
        )
      );

      for (const project of resolvedProjects) {
        try {
          const mrs = await fetchOpenMergeRequests(this.config.gitlab!, project.id);
          for (const mr of mrs) {
            await this.processMergeRequest(mr);
          }
        } catch (error) {
          console.error(
            CLIOutputFormatter.formatError(
              `Failed to fetch MRs for project ${project.name} (ID: ${project.id}): ${error instanceof Error ? error.message : String(error)}`
            )
          );
        }
      }
    } catch (error) {
      console.error(
        CLIOutputFormatter.formatError(
          `Failed to resolve project names: ${error instanceof Error ? error.message : String(error)}`
        )
      );
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
