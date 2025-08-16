import { ConfigLoader } from '../config/configLoader.js';
import { AppConfig } from '../config/configSchema.js';
import { ProjectCacheService } from '../services/projectCacheService.js';
import {
  fetchMergeRequestsByIids,
  fetchMrData,
  fetchOpenMergeRequests,
} from '../shared/services/gitlabCore.js';
import { GitLabMergeRequest, GitLabMRDetails } from '../shared/types/gitlab.js';
import {
  getStateProvider,
  ProjectReviewState,
  StateProvider,
} from '../state/stateProviders.js';
import { CLIOutputFormatter } from './outputFormatter.js';
import { CLIReviewCommand } from './reviewCommand.js';

export class AutoReviewCommand {
  private config: AppConfig;
  private running = false;
  private projectCacheService: ProjectCacheService;
  private stateProvider: StateProvider;

  constructor() {
    this.config = ConfigLoader.loadConfig({});
    this.projectCacheService = new ProjectCacheService();
    this.stateProvider = getStateProvider(this.config);
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
    console.log(
      CLIOutputFormatter.formatInfo(
        `Using state storage: ${this.config.state?.storage || 'local'}`
      )
    );

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

      console.log(
        CLIOutputFormatter.formatProgress(
          `Monitoring ${resolvedProjects.length} project(s): ${resolvedProjects.map((p) => p.name).join(', ')}`
        )
      );

      for (const project of resolvedProjects) {
        try {
          console.log(
            CLIOutputFormatter.formatProgress(`Processing project: ${project.name_with_namespace}`)
          );

          // Prune state for the current project
          let projectState = await this.stateProvider.loadState(project.id);
          const originalStateSize = Object.keys(projectState).length;

          const mrIidsToPrune = Object.keys(projectState);
          if (mrIidsToPrune.length > 0) {
            const fetchedMrs = await fetchMergeRequestsByIids(
              this.config.gitlab,
              project.id,
              mrIidsToPrune
            );
            for (const mr of fetchedMrs) {
              if (mr.state === 'closed' || mr.state === 'merged') {
                delete projectState[mr.iid];
              }
            }
          }

          const newStateSize = Object.keys(projectState).length;
          if (newStateSize < originalStateSize) {
              console.log(CLIOutputFormatter.formatInfo(`Pruned ${originalStateSize - newStateSize} closed/merged MR(s) from state for project ${project.name_with_namespace}`));
          }

          // Fetch open MRs and process them
          const openMrs = await fetchOpenMergeRequests(this.config.gitlab, project.id);
          for (const mr of openMrs) {
            projectState = await this.processMergeRequest(mr, projectState);
          }

          // Save the final state for the project
          await this.stateProvider.saveState(project.id, projectState);
        } catch (error) {
          console.error(
            CLIOutputFormatter.formatError(
              `Failed to process project ${project.name}: ${error instanceof Error ? error.message : String(error)}`
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

  private async processMergeRequest(
    mr: GitLabMergeRequest,
    projectState: ProjectReviewState
  ): Promise<ProjectReviewState> {
    // Fetch detailed MR info to get the head_sha
    const mrDetails = await fetchMrData(this.config.gitlab!, mr.web_url);

    const reviewedMr = projectState[mr.iid];
    if (reviewedMr && reviewedMr.head_sha === mrDetails.head_sha) {
      // Already reviewed and no new changes
      return projectState;
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

      const newState = { ...projectState };
      newState[mr.iid] = {
        head_sha: mrDetails.head_sha,
        reviewed_at: new Date().toISOString(),
      };
      console.log(CLIOutputFormatter.formatSuccess(`Successfully reviewed MR: ${mr.web_url}`));
      return newState;
    } catch (error) {
      console.error(
        CLIOutputFormatter.formatError(
          `Failed to review MR ${mr.web_url}: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      return projectState; // Return original state on error
    }
  }
}
