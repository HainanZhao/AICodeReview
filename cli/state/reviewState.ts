import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const STATE_FILE_PATH = join(homedir(), '.aicodereview', 'review-state.json');

export interface ReviewedMrState {
  head_sha: string;
  reviewed_at: string;
  // New optional fields for backward compatibility
  projectId?: number;
  mrIid?: number;
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
    try {
      const fileContent = readFileSync(STATE_FILE_PATH, 'utf-8');
      state = JSON.parse(fileContent) as ReviewState;
      return state!;
    } catch (e) {
      console.warn('Could not parse existing review state file. Starting fresh.', e);
    }
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
  return currentState[String(mrId)];
}

export function updateReviewedMr(
  mrId: number,
  head_sha: string,
  details: { projectId: number; mrIid: number }
): void {
  const currentState = loadState();
  currentState[String(mrId)] = {
    head_sha,
    reviewed_at: new Date().toISOString(),
    projectId: details.projectId,
    mrIid: details.mrIid,
  };
  saveState(currentState);
}

export async function pruneClosedMrStates(
  config: { gitlab: { url: string; accessToken: string } },
  fetcher: (
    config: { url:string; accessToken: string },
    projectId: number,
    mrIids: string[]
  ) => Promise<Array<{ iid: number; state: string; id: number }>>
): Promise<void> {
  const currentState = loadState();
  let stateChanged = false;

  const enrichedMrsByProject: Record<string, { iid: string; id: string }[]> = {};

  // Collect all enriched MRs and group them by project
  for (const mrId in currentState) {
    const mrState = currentState[mrId];
    if (mrState.projectId && mrState.mrIid) {
      const projectIdStr = String(mrState.projectId);
      if (!enrichedMrsByProject[projectIdStr]) {
        enrichedMrsByProject[projectIdStr] = [];
      }
      enrichedMrsByProject[projectIdStr].push({ iid: String(mrState.mrIid), id: mrId });
    }
  }

  // For each project, fetch the status of its tracked MRs
  for (const projectIdStr in enrichedMrsByProject) {
    const projectId = parseInt(projectIdStr, 10);
    const mrsInProject = enrichedMrsByProject[projectIdStr];
    const mrIids = mrsInProject.map((mr) => mr.iid);

    if (mrIids.length === 0) {
      continue;
    }

    try {
      const fetchedMrs = await fetcher(config.gitlab, projectId, mrIids);
      const closedOrMergedMrs = fetchedMrs.filter(
        (mr) => mr.state === 'closed' || mr.state === 'merged'
      );

      for (const mr of closedOrMergedMrs) {
        const globalMrId = String(mr.id);
        if (currentState[globalMrId]) {
          console.log(
            `Pruning closed/merged MR !${mr.iid} (ID: ${globalMrId}) from project ${projectId}`
          );
          delete currentState[globalMrId];
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
