import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const STATE_FILE_PATH = join(homedir(), '.aicodereview', 'review-state.json');

export interface ReviewedMrState {
  head_sha: string;
  reviewed_at: string;
}

const STATE_FILE_VERSION = 2;

export interface ReviewState {
  version: number;
  project_mrs: {
    [projectId: string]: {
      [mrIid: string]: ReviewedMrState;
    };
  };
}

let state: ReviewState | null = null;

export function loadState(): ReviewState {
  if (state) {
    return state;
  }

  if (existsSync(STATE_FILE_PATH)) {
    try {
      const fileContent = readFileSync(STATE_FILE_PATH, 'utf-8');
      const parsedState = JSON.parse(fileContent) as ReviewState;

      // Check if the state is in the new format
      if (parsedState.version === STATE_FILE_VERSION && parsedState.project_mrs) {
        state = parsedState;
        return state;
      }
    } catch (e) {
      console.warn('Could not parse existing review state file. Starting fresh.', e);
    }
  }

  // If file doesn't exist, is invalid, or is old format, start with a fresh state
  state = {
    version: STATE_FILE_VERSION,
    project_mrs: {},
  };
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

export function getReviewedMr(
  projectId: number,
  mrIid: number
): ReviewedMrState | undefined {
  const currentState = loadState();
  return currentState.project_mrs[projectId]?.[mrIid];
}

export function updateReviewedMr(
  projectId: number,
  mrIid: number,
  head_sha: string
): void {
  const currentState = loadState();
  if (!currentState.project_mrs[projectId]) {
    currentState.project_mrs[projectId] = {};
  }
  currentState.project_mrs[projectId][mrIid] = {
    head_sha,
    reviewed_at: new Date().toISOString(),
  };
  saveState(currentState);
}

export async function pruneClosedMrStates(
  config: { gitlab: { url: string; accessToken: string } },
  fetcher: (
    config: { url: string; accessToken: string },
    projectId: number,
    mrIids: string[]
  ) => Promise<Array<{ iid: number; state: string }>>
): Promise<void> {
  const currentState = loadState();
  let stateChanged = false;

  for (const projectIdStr in currentState.project_mrs) {
    const projectId = parseInt(projectIdStr, 10);
    const mrsInProject = currentState.project_mrs[projectIdStr];
    const mrIids = Object.keys(mrsInProject);

    if (mrIids.length === 0) {
      continue;
    }

    try {
      const fetchedMrs = await fetcher(config.gitlab, projectId, mrIids);
      for (const mr of fetchedMrs) {
        if (mr.state === 'closed' || mr.state === 'merged') {
          console.log(`Pruning closed/merged MR !${mr.iid} from project ${projectId}`);
          delete currentState.project_mrs[projectIdStr][mr.iid];
          stateChanged = true;
        }
      }
    } catch (error) {
      console.error(
        `Failed to fetch MR statuses for project ${projectId} during cleanup:`,
        error
      );
    }
  }

  if (stateChanged) {
    saveState(currentState);
  }
}
