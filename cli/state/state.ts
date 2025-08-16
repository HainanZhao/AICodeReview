import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { GitLabConfig } from '../config/configSchema.js';
import {
  createStateSnippet,
  findStateSnippet,
  getSnippetContent,
  updateSnippetContent,
} from '../shared/services/gitlabCore.js';

// The basic state for a single reviewed MR.
export interface ReviewedMrState {
  head_sha: string;
  reviewed_at: string;
  project_id: number;
  mr_iid: number;
}
export interface LocalState {
  [mrId: string]: ReviewedMrState;
}

// The structure of a GitLab snippet for a single project.
// Keyed by global MR ID for consistency with LocalState.
export interface SnippetState {
  [mrId: string]: ReviewedMrState;
}

const STATE_FILE_PATH = join(homedir(), '.aicodereview', 'review-state.json');

// --- Local State Functions ---

export function loadLocalState(): LocalState {
  if (existsSync(STATE_FILE_PATH)) {
    try {
      const fileContent = readFileSync(STATE_FILE_PATH, 'utf-8');
      const state = JSON.parse(fileContent) as LocalState;
      // A simple validation to ensure it's a dictionary-like object
      if (state && typeof state === 'object' && !Array.isArray(state)) {
        return state;
      }
      console.warn('Local review state file is malformed and will be ignored.');
    } catch (e) {
      console.warn('Could not parse local review state file. It will be ignored.', e);
    }
  }
  return {};
}

export function saveLocalState(state: LocalState): void {
  try {
    const stateDir = join(homedir(), '.aicodereview');
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true });
    }
    writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Failed to save local state file.', e);
  }
}

// --- Snippet State Functions ---

export async function loadSnippetState(
  config: GitLabConfig,
  projectId: number
): Promise<SnippetState> {
  try {
    const snippet = await findStateSnippet(config, projectId);
    if (snippet) {
      const content = await getSnippetContent(config, projectId, snippet.id);
      if (content) {
        return JSON.parse(content) as SnippetState;
      }
    }
  } catch (e) {
    console.error(`Failed to load state from snippet for project ${projectId}.`, e);
  }
  return {};
}

export async function saveSnippetState(
  config: GitLabConfig,
  projectId: number,
  state: SnippetState
): Promise<boolean> {
  const content = JSON.stringify(state, null, 2);
  try {
    const snippet = await findStateSnippet(config, projectId);
    if (snippet) {
      // To prevent unnecessary writes, we could fetch and compare, but for simplicity, we just update.
      // Let's add the check to be efficient.
      const currentContent = await getSnippetContent(config, projectId, snippet.id);
      if (currentContent !== content) {
        const result = await updateSnippetContent(config, projectId, snippet.id, content);
        return !!result;
      }
      return true; // Content was already up-to-date
    } else {
      const result = await createStateSnippet(config, projectId, content);
      return !!result;
    }
  } catch (e) {
    console.error(`Failed to save state to snippet for project ${projectId}.`, e);
    return false;
  }
}
