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
import { GitLabSnippet } from '../shared/types/gitlab.js';

export interface ReviewedMrState {
  head_sha: string;
  reviewed_at: string;
}

export interface ProjectReviewState {
  [mrIid: string]: ReviewedMrState;
}

export interface StateProvider {
  loadState(projectId: number): Promise<ProjectReviewState>;
  saveState(projectId: number, state: ProjectReviewState): Promise<boolean>;
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
        const parsedState = JSON.parse(fileContent) as GlobalReviewState;
        if (parsedState && typeof parsedState === 'object' && !Array.isArray(parsedState)) {
            this.globalState = parsedState;
            return this.globalState;
        }
        console.warn('Local review state file is in an old, unsupported format and will be ignored.');
      } catch (e) {
        console.warn('Could not parse local review state file. It will be ignored.', e);
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

  async saveState(projectId: number, state: ProjectReviewState): Promise<boolean> {
    try {
        const globalState = this.readGlobalState();
        globalState[String(projectId)] = state;
        this.writeGlobalState(globalState);
        return true;
    } catch (e) {
        console.error(`Failed to save local state for project ${projectId}`, e);
        return false;
    }
  }
}

export class GitLabSnippetStateProvider implements StateProvider {
  private config: GitLabConfig;
  private snippetCache: Record<number, GitLabSnippet | null> = {};

  constructor(config: GitLabConfig) {
    this.config = config;
  }

  private async findStateSnippet(projectId: number): Promise<GitLabSnippet | null> {
      if (this.snippetCache[projectId] !== undefined) {
          return this.snippetCache[projectId];
      }
      const snippet = await findStateSnippet(this.config, projectId);
      this.snippetCache[projectId] = snippet;
      return snippet;
  }

  async loadState(projectId: number): Promise<ProjectReviewState> {
    try {
      const snippet = await this.findStateSnippet(projectId);
      if (snippet) {
        const content = await getSnippetContent(this.config, projectId, snippet.id);
        if (content) {
            return JSON.parse(content) as ProjectReviewState;
        }
      }
    } catch (e) {
      // Error is logged in the helper, returning empty state is enough here.
    }
    return {};
  }

  async saveState(projectId: number, state: ProjectReviewState): Promise<boolean> {
    const content = JSON.stringify(state, null, 2);
    try {
      const snippet = await this.findStateSnippet(projectId);
      if (snippet) {
        const currentContent = await getSnippetContent(this.config, projectId, snippet.id);
        if (currentContent !== content) {
          await updateSnippetContent(this.config, projectId, snippet.id, content);
        }
      } else {
        const newSnippet = await createStateSnippet(this.config, projectId, content);
        this.snippetCache[projectId] = newSnippet;
      }
      return true;
    } catch (e) {
      console.error(`Failed to save state to snippet for project ${projectId}. Please ensure the project exists and you have developer or higher permissions.`, e);
      return false;
    }
  }
}

export function getStateProvider(config: AppConfig): StateProvider {
  if (config.state?.storage === 'snippet' && config.gitlab) {
    return new GitLabSnippetStateProvider(config.gitlab);
  }
  return new LocalFileStateProvider();
}
