import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const STATE_FILE_PATH = join(homedir(), '.aicodereview_state.json');

export interface ReviewedMrState {
  head_sha: string;
  reviewed_at: string;
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
  writeFileSync(STATE_FILE_PATH, JSON.stringify(newState, null, 2));
  state = newState;
}

export function getReviewedMr(mrId: number): ReviewedMrState | undefined {
  const currentState = loadState();
  return currentState[mrId];
}

export function updateReviewedMr(mrId: number, head_sha: string): void {
  const currentState = loadState();
  currentState[mrId] = {
    head_sha,
    reviewed_at: new Date().toISOString(),
  };
  saveState(currentState);
}
