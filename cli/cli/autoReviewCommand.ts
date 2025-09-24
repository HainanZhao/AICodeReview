import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigLoader } from '../config/configLoader.js';
import { AppConfig } from '../config/configSchema.js';
import { ProjectCacheService } from '../services/projectCacheService.js';
import {
  fetchMergeRequestsByIids,
  fetchMrHeadSha,
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

const META_STATE_PATH = path.join(os.homedir(), '.aicodereview', 'auto_review_meta.json');

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

    const loop = async () => {
      if (!this.running) {
        return;
      }
      try {
        await this.runReviewLoop();
      } catch (error) {
        console.error(
          CLIOutputFormatter.formatError(`An error occurred during the review loop: ${error}`)
        );
      } finally {
        if (this.running) {
          setTimeout(loop, interval);
        }
      }
    };

    loop();
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

    if (this.isPruningNeeded()) {
      console.log(CLIOutputFormatter.formatProgress('Pruning stale MRs from local state...'));
      const allProjectIds = allProjects.map((p) => p.id);
      await this.pruneStaleMrsFromState(localState, allProjectIds);
      this.updateLastPrunedTimestamp();
      console.log(CLIOutputFormatter.formatSuccess('Pruning complete.'));
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
    const needsPruning = this.isPruningNeeded();
    if (needsPruning) {
      console.log(CLIOutputFormatter.formatProgress('Pruning stale MRs from snippet state...'));
    }

    for (const project of allProjects) {
      try {
        const projectState = await loadSnippetState(this.config.gitlab!, project.id);

        if (needsPruning) {
          await this.pruneStaleMrsFromState(projectState, [project.id]);
        }

        // Process new/updated MRs for this project
        await this.processProjectMRs(project, projectState, 'snippet');

        await saveSnippetState(this.config.gitlab!, project.id, projectState);
      } catch (error) {
        console.error(
          CLIOutputFormatter.formatError(
            `Failed to process project ${project.name}: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        );
      }
    }

    if (needsPruning) {
      this.updateLastPrunedTimestamp();
      console.log(CLIOutputFormatter.formatSuccess('Pruning complete.'));
    }
  }

  private async pruneStaleMrsFromState(
    state: LocalState | SnippetState,
    projectIds: number[]
  ): Promise<void> {
    const mrsToPruneByProject: Record<string, string[]> = {};
    const globalIdToIidMap: Record<string, Record<string, string>> = {}; // { [projectId]: { [iid]: globalMrId } }

    // Collect MRs to check from the state
    for (const globalMrId in state) {
      const mrState = state[globalMrId];
      if (mrState.project_id && projectIds.includes(mrState.project_id)) {
        const projectIdStr = mrState.project_id.toString();
        if (!mrsToPruneByProject[projectIdStr]) {
          mrsToPruneByProject[projectIdStr] = [];
          globalIdToIidMap[projectIdStr] = {};
        }
        const iid = String(mrState.mr_iid);
        mrsToPruneByProject[projectIdStr].push(iid);
        globalIdToIidMap[projectIdStr][iid] = globalMrId;
      }
    }

    // Fetch MRs and prune
    for (const projectIdStr in mrsToPruneByProject) {
      const projectId = parseInt(projectIdStr, 10);
      const iids = mrsToPruneByProject[projectIdStr];
      const fetchedMrs = await fetchMergeRequestsByIids(this.config.gitlab!, projectId, iids);
      for (const mr of fetchedMrs) {
        if (mr.state === 'closed' || mr.state === 'merged') {
          const globalMrId = globalIdToIidMap[projectIdStr][String(mr.iid)];
          if (globalMrId) {
            delete state[globalMrId];
          }
        }
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
      const stateKey = mr.id;
      const reviewedMr = state[stateKey];

      // If we have reviewed it before, check if it has been updated since.
      if (reviewedMr && new Date(mr.updated_at) <= new Date(reviewedMr.reviewed_at)) {
        continue;
      }

      const headSha = await fetchMrHeadSha(this.config.gitlab!, mr.web_url);

      // If the SHA is the same, it was a non-code update.
      // Update our timestamp and skip the review.
      if (reviewedMr && reviewedMr.head_sha === headSha) {
        state[stateKey].reviewed_at = new Date().toISOString();
        continue;
      }

      console.log(CLIOutputFormatter.formatProgress(`New or updated MR found: ${mr.web_url}`));
      try {
        await CLIReviewCommand.executeReview({
          mrUrl: [mr.web_url],
          dryRun: false,
          mock: false, // mock should not be used in auto-review
          verbose: false,
          provider: this.config.llm.provider,
          apiKey: this.config.llm.apiKey,
          googleCloudProject: this.config.llm.googleCloudProject,
          customPromptFile: this.config.autoReview?.promptFile,
        });

        // Store the reviewed MR state
        state[stateKey] = {
          head_sha: headSha,
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

  private loadAutoReviewMeta(): { lastPrunedAt?: string } {
    if (!fs.existsSync(META_STATE_PATH)) {
      return {};
    }
    try {
      const content = fs.readFileSync(META_STATE_PATH, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(
        CLIOutputFormatter.formatError(`Failed to read or parse auto-review metadata: ${error}`)
      );
      return {};
    }
  }

  private saveAutoReviewMeta(meta: { lastPrunedAt?: string }): void {
    try {
      const dir = path.dirname(META_STATE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(META_STATE_PATH, JSON.stringify(meta, null, 2));
    } catch (error) {
      console.error(
        CLIOutputFormatter.formatError(`Failed to save auto-review metadata: ${error}`)
      );
    }
  }

  private isPruningNeeded(): boolean {
    const meta = this.loadAutoReviewMeta();
    if (!meta.lastPrunedAt) {
      return true; // Prune if never pruned before
    }
    const lastPrunedDate = new Date(meta.lastPrunedAt);
    const now = new Date();
    const hoursSinceLastPrune = (now.getTime() - lastPrunedDate.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastPrune >= 24;
  }

  private updateLastPrunedTimestamp(): void {
    const meta = this.loadAutoReviewMeta();
    meta.lastPrunedAt = new Date().toISOString();
    this.saveAutoReviewMeta(meta);
  }
}
