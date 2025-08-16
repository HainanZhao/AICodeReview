import { ConfigLoader } from '../config/configLoader.js';
import { AppConfig } from '../config/configSchema.js';
import { ProjectCacheService } from '../services/projectCacheService.js';
import {
  fetchMergeRequestsByIids,
  fetchMrData,
  fetchOpenMergeRequests,
} from '../shared/services/gitlabCore.js';
import { GitLabMergeRequest, GitLabProject } from '../shared/types/gitlab.js';
import {
  loadLocalState,
  loadSnippetState,
  LocalState,
  ReviewedMrState,
  saveLocalState,
  saveSnippetState,
  SnippetState,
} from '../state/state.js';
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
    console.log(
      CLIOutputFormatter.formatProgress(
        `Using state storage: ${this.config.state?.storage || 'local'}`
      )
    );

    const interval = this.config.autoReview.interval * 1000;
    this.runReviewLoop();
    setInterval(() => this.runReviewLoop(), interval);
  }

  private async runReviewLoop(): Promise<void> {
    const storageMode = this.config.state?.storage || 'local';
    if (storageMode === 'snippet') {
      await this.runSnippetReviewLoop();
    } else {
      await this.runLocalFileReviewLoop();
    }
  }

  private async runLocalFileReviewLoop(): Promise<void> {
    console.log(
      CLIOutputFormatter.formatProgress('Checking for new and updated merge requests...')
    );
    if (!this.config.autoReview?.projects || !this.config.gitlab) return;

    const allProjects = await this.projectCacheService.resolveProjectNamesToIds(
      this.config.autoReview.projects,
      this.config.gitlab
    );
    if (allProjects.length === 0) {
      console.log(
        CLIOutputFormatter.formatWarning(`No projects found matching your configuration.`)
      );
      return;
    }

    const localState = loadLocalState();

    // Prune state
    const mrsToPruneByProject: Record<string, string[]> = {};
    for (const mrId in localState) {
      const mrState = localState[mrId];
      if (mrState.projectId) {
        if (!mrsToPruneByProject[mrState.projectId]) {
          mrsToPruneByProject[mrState.projectId] = [];
        }
        mrsToPruneByProject[mrState.projectId].push(String(mrState.mrIid));
      }
    }
    for (const projectIdStr in mrsToPruneByProject) {
      const projectId = parseInt(projectIdStr, 10);
      const iids = mrsToPruneByProject[projectIdStr];
      const fetchedMrs = await fetchMergeRequestsByIids(this.config.gitlab, projectId, iids);
      for (const mr of fetchedMrs) {
        const globalMrId = Object.keys(localState).find(
          (id) => localState[id].mrIid === mr.iid && localState[id].projectId === projectId
        );
        if (globalMrId && (mr.state === 'closed' || mr.state === 'merged')) {
          delete localState[globalMrId];
        }
      }
    }

    for (const project of allProjects) {
      const openMrs = await fetchOpenMergeRequests(this.config.gitlab, project.id);
      for (const mr of openMrs) {
        const reviewedMr = localState[mr.id];
        const mrDetails = await fetchMrData(this.config.gitlab, mr.web_url);
        if (reviewedMr && reviewedMr.head_sha === mrDetails.head_sha) {
          continue;
        }
        console.log(CLIOutputFormatter.formatProgress(`New or updated MR found: ${mr.web_url}`));
        try {
          await CLIReviewCommand.executeReview({ mrUrl: [mr.web_url] /* ... other options */ });
          localState[mr.id] = {
            head_sha: mrDetails.head_sha,
            reviewed_at: new Date().toISOString(),
            projectId: project.id,
            mrIid: mr.iid,
          };
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

    saveLocalState(localState);
  }

  private async runSnippetReviewLoop(): Promise<void> {
    console.log(
      CLIOutputFormatter.formatProgress('Checking for new and updated merge requests...')
    );
    if (!this.config.autoReview?.projects || !this.config.gitlab) return;

    const allProjects = await this.projectCacheService.resolveProjectNamesToIds(
      this.config.autoReview.projects,
      this.config.gitlab
    );
    if (allProjects.length === 0) {
      console.log(
        CLIOutputFormatter.formatWarning(`No projects found matching your configuration.`)
      );
      return;
    }

    for (const project of allProjects) {
      try {
        const projectState = await loadSnippetState(this.config.gitlab, project.id);
        const iidsToPrune = Object.keys(projectState);
        if (iidsToPrune.length > 0) {
          const fetchedMrs = await fetchMergeRequestsByIids(
            this.config.gitlab,
            project.id,
            iidsToPrune
          );
          for (const mr of fetchedMrs) {
            if (mr.state === 'closed' || mr.state === 'merged') {
              delete projectState[mr.iid];
            }
          }
        }

        const openMrs = await fetchOpenMergeRequests(this.config.gitlab, project.id);
        for (const mr of openMrs) {
          const mrDetails = await fetchMrData(this.config.gitlab, mr.web_url);
          const reviewedMr = projectState[mr.iid];
          if (reviewedMr && reviewedMr.head_sha === mrDetails.head_sha) {
            continue;
          }
          console.log(CLIOutputFormatter.formatProgress(`New or updated MR found: ${mr.web_url}`));
          try {
            await CLIReviewCommand.executeReview({ mrUrl: [mr.web_url] /* ... other options */ });
            projectState[mr.iid] = {
              head_sha: mrDetails.head_sha,
              reviewed_at: new Date().toISOString(),
            };
            console.log(
              CLIOutputFormatter.formatSuccess(`Successfully reviewed MR: ${mr.web_url}`)
            );
          } catch (error) {
            console.error(
              CLIOutputFormatter.formatError(
                `Failed to review MR ${mr.web_url}: ${error instanceof Error ? error.message : String(error)}`
              )
            );
          }
        }
        await saveSnippetState(this.config.gitlab, project.id, projectState);
      } catch (error) {
        console.error(
          CLIOutputFormatter.formatError(
            `Failed to process project ${project.name}: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    }
  }
}
