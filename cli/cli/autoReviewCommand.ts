import { ConfigLoader } from '../config/configLoader.js';
import { AppConfig } from '../config/configSchema.js';
import { ProjectCacheService } from '../services/projectCacheService.js';
import {
  fetchMergeRequestsByIids,
  fetchMrData,
  fetchOpenMergeRequests,
} from '../shared/services/gitlabCore.js';
import {
  loadLocalState,
  loadSnippetState,
  LocalState,
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
        `Using state storage: ${this.config.autoReview?.state?.storage || 'local'}`
      )
    );

    const interval = this.config.autoReview.interval * 1000;
    this.runReviewLoop();
    setInterval(() => this.runReviewLoop(), interval);
  }

  private async runReviewLoop(): Promise<void> {
    const storageMode = this.config.autoReview?.state?.storage || 'local';
    await this.runUnifiedReviewLoop(storageMode);
    console.log(
      CLIOutputFormatter.formatProgress(
        `Finished one review loop. Next cycle starts in ${this.config.autoReview?.interval}s`
      )
    );
  }

  private async runUnifiedReviewLoop(storageMode: 'local' | 'snippet'): Promise<void> {
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

    if (storageMode === 'local') {
      await this.processLocalStorage(allProjects);
    } else {
      await this.processSnippetStorage(allProjects);
    }
  }

  private async processLocalStorage(
    allProjects: Array<{ id: number; name: string }>
  ): Promise<void> {
    const localState = loadLocalState();

    // Prune state for all projects at once
    const mrsToPruneByProject: Record<string, string[]> = {};
    for (const mrId in localState) {
      const mrState = localState[mrId];
      if (mrState.project_id) {
        if (!mrsToPruneByProject[mrState.project_id]) {
          mrsToPruneByProject[mrState.project_id] = [];
        }
        mrsToPruneByProject[mrState.project_id].push(String(mrState.mr_iid));
      }
    }

    for (const projectIdStr in mrsToPruneByProject) {
      const projectId = parseInt(projectIdStr, 10);
      const iids = mrsToPruneByProject[projectIdStr];
      const fetchedMrs = await fetchMergeRequestsByIids(this.config.gitlab!, projectId, iids);
      for (const mr of fetchedMrs) {
        const globalMrId = Object.keys(localState).find(
          (id) => localState[id].mr_iid === mr.iid && localState[id].project_id === projectId
        );
        if (globalMrId && (mr.state === 'closed' || mr.state === 'merged')) {
          delete localState[globalMrId];
        }
      }
    }

    // Process new/updated MRs for all projects
    for (const project of allProjects) {
      await this.processProjectMRs(project, localState, 'local');
    }

    saveLocalState(localState);
  }

  private async processSnippetStorage(
    allProjects: Array<{ id: number; name: string }>
  ): Promise<void> {
    for (const project of allProjects) {
      try {
        const projectState = await loadSnippetState(this.config.gitlab!, project.id);

        // Prune state for this project
        const stateKeys = Object.keys(projectState);
        if (stateKeys.length > 0) {
          // Extract IIDs from the state entries to check MR status
          const iidsToPrune: string[] = [];
          const globalIdToIidMap: Record<string, string> = {};

          for (const globalId of stateKeys) {
            const stateEntry = projectState[globalId];
            if (stateEntry && stateEntry.mr_iid) {
              const iid = stateEntry.mr_iid.toString();
              iidsToPrune.push(iid);
              globalIdToIidMap[iid] = globalId;
            }
          }

          if (iidsToPrune.length > 0) {
            const fetchedMrs = await fetchMergeRequestsByIids(
              this.config.gitlab!,
              project.id,
              iidsToPrune
            );
            for (const mr of fetchedMrs) {
              if (mr.state === 'closed' || mr.state === 'merged') {
                // Remove by global MR ID (consistent with both storage modes)
                const globalId = globalIdToIidMap[mr.iid.toString()];
                if (globalId) {
                  delete projectState[globalId];
                }
              }
            }
          }
        }

        // Process new/updated MRs for this project
        await this.processProjectMRs(project, projectState, 'snippet');

        await saveSnippetState(this.config.gitlab!, project.id, projectState);
      } catch (error) {
        console.error(
          CLIOutputFormatter.formatError(
            `Failed to process project ${project.name}: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    }
  }

  private async processProjectMRs(
    project: { id: number; name: string },
    state: LocalState | SnippetState,
    storageMode: 'local' | 'snippet'
  ): Promise<void> {
    const openMrs = await fetchOpenMergeRequests(this.config.gitlab!, project.id);

    for (const mr of openMrs) {
      const mrDetails = await fetchMrData(this.config.gitlab!, mr.web_url);

      // Get the key and check if already reviewed (both storage modes use global MR ID)
      const stateKey = mr.id;
      const reviewedMr = state[stateKey];

      if (reviewedMr && reviewedMr.head_sha === mrDetails.head_sha) {
        continue;
      }

      console.log(CLIOutputFormatter.formatProgress(`New or updated MR found: ${mr.web_url}`));
      try {
        await CLIReviewCommand.executeReview({
          mrUrl: [mr.web_url],
          dryRun: this.config.dryRun,
          mock: this.config.mock,
          verbose: this.config.verbose,
          provider: this.config.provider,
          apiKey: this.config.apiKey,
          googleCloudProject: this.config.googleCloudProject,
        });

        // Store the reviewed MR state
        state[stateKey] = {
          head_sha: mrDetails.head_sha,
          reviewed_at: new Date().toISOString(),
          project_id: project.id,
          mr_iid: mr.iid,
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
}
