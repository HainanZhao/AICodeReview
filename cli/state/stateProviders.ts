import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { AppConfig, GitLabConfig } from '../config/configSchema.js';
import {
  createStateSnippet,
  findStateSnippet,
  getSnippetContent,
  updateSnippetContent,
} from '../shared/services/gitlabCore.js';

export interface ReviewedMrState {
  head_sha: string;
  reviewed_at: string;
}

export interface ProjectReviewState {
  [mrIid: string]: ReviewedMrState;
}

export interface StateProvider {
  loadState(projectId: number): Promise<ProjectReviewState>;
  saveState(projectId: number, state: ProjectReviewState): Promise<void>;
}

const STATE_FILE_PATH = join(homedir(), '.aicodereview', 'review-state.json');

interface GlobalReviewState {
    [projectId: string]: ProjectReviewState;
}

export class LocalFileStateProvider implements StateProvider {
  private globalState: GlobalReviewState | null = null;

  private readGlobalState(): GlobalReviewState {
    if (this.globalState) {
      return this.globalState;
    }
    if (existsSync(STATE_FILE_PATH)) {
      try {
        const fileContent = readFileSync(STATE_FILE_PATH, 'utf-8');
        this.globalState = JSON.parse(fileContent) as GlobalReviewState;
        return this.globalState!;
      } catch (e) {
        console.warn('Could not parse local review state file. Starting fresh.', e);
      }
    }
    this.globalState = {};
    return this.globalState;
  }

  private writeGlobalState(state: GlobalReviewState): void {
    const stateDir = join(homedir(), '.aicodereview');
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true });
    }
    writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2));
    this.globalState = state;
  }

  async loadState(projectId: number): Promise<ProjectReviewState> {
    const globalState = this.readGlobalState();
    return globalState[String(projectId)] || {};
  }

  async saveState(projectId: number, state: ProjectReviewState): Promise<void> {
    const globalState = this.readGlobalState();
    globalState[String(projectId)] = state;
    this.writeGlobalState(globalState);
  }
}

export class GitLabSnippetStateProvider implements StateProvider {
  private config: GitLabConfig;

  constructor(config: GitLabConfig) {
    this.config = config;
  }

  async loadState(projectId: number): Promise<ProjectReviewState> {
    try {
      const snippet = await findStateSnippet(this.config, projectId);
      if (snippet) {
        const content = await getSnippetContent(this.config, projectId, snippet.id);
        return JSON.parse(content) as ProjectReviewState;
      }
    } catch (e) {
      console.error(`Failed to load state from snippet for project ${projectId}`, e);
    }
    return {};
  }

  async saveState(projectId: number, state: ProjectReviewState): Promise<void> {
    const content = JSON.stringify(state, null, 2);
    try {
      const snippet = await findStateSnippet(this.config, projectId);
      if (snippet) {
        // Only update if content has changed to avoid unnecessary API calls
        const currentContent = await getSnippetContent(this.config, projectId, snippet.id);
        if (currentContent !== content) {
          await updateSnippetContent(this.config, projectId, snippet.id, content);
        }
      } else {
        await createStateSnippet(this.config, projectId, content);
      }
    } catch (e) {
      console.error(`Failed to save state to snippet for project ${projectId}`, e);
    }
  }
}

export function getStateProvider(config: AppConfig): StateProvider {
  if (config.state?.storage === 'snippet' && config.gitlab) {
    return new GitLabSnippetStateProvider(config.gitlab);
  }
  return new LocalFileStateProvider();
}
