import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const STATE_FILE_PATH = join(homedir(), '.aicodereview', 'review-state.json');

export interface ReviewedMrState {
  head_sha: string;
  reviewed_at: string;
  project_id: number;
  mr_iid: number;
}

export interface ReviewState {
  [mrId: string]: ReviewedMrState;
}

let state: ReviewState | null = null;

export function loadState(): ReviewState {
  if (state) {
    return state;
  }

  if (existsSync(STATE_FILE_PATH)) {
    const fileContent = readFileSync(STATE_FILE_PATH, 'utf-8');
    state = JSON.parse(fileContent) as ReviewState;
    return state!;
  }

  state = {};
  return state;
}

export function saveState(newState: ReviewState): void {
  const stateDir = join(homedir(), '.aicodereview');
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  writeFileSync(STATE_FILE_PATH, JSON.stringify(newState, null, 2));
  state = newState;
}

export function getReviewedMr(mrId: number): ReviewedMrState | undefined {
  const currentState = loadState();
  return currentState[mrId];
}

export function updateReviewedMr(
  mrId: number,
  head_sha: string,
  projectId: number,
  mrIid: number
): void {
  const currentState = loadState();
  currentState[mrId] = {
    head_sha,
    reviewed_at: new Date().toISOString(),
    project_id: projectId,
    mr_iid: mrIid,
  };
  saveState(currentState);
}
