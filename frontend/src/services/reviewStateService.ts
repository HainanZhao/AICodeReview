import { GitLabMRDetails, ReviewFeedback } from '../../../types';

const REVIEW_STATE_KEY = 'ai-code-reviewer-review-state';
const REVIEW_STATE_TIMESTAMP_KEY = 'ai-code-reviewer-review-state-timestamp';

export interface ReviewState {
  mrDetails: GitLabMRDetails;
  feedback: ReviewFeedback[];
  timestamp: number;
  url: string;
}

/**
 * Save the current review state to localStorage
 */
export const saveReviewState = (
  mrDetails: GitLabMRDetails,
  feedback: ReviewFeedback[],
  url: string
): void => {
  try {
    const state: ReviewState = {
      mrDetails,
      feedback,
      timestamp: Date.now(),
      url,
    };

    localStorage.setItem(REVIEW_STATE_KEY, JSON.stringify(state));
    localStorage.setItem(REVIEW_STATE_TIMESTAMP_KEY, state.timestamp.toString());
  } catch (error) {
    console.error('Failed to save review state to localStorage', error);
  }
};

/**
 * Load the review state from localStorage
 * Returns null if no state exists or if the state is too old (older than 1 week)
 */
export const loadReviewState = (): ReviewState | null => {
  try {
    const stateStr = localStorage.getItem(REVIEW_STATE_KEY);
    const timestampStr = localStorage.getItem(REVIEW_STATE_TIMESTAMP_KEY);

    if (!stateStr || !timestampStr) {
      return null;
    }

    const timestamp = parseInt(timestampStr, 10);
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

    // Check if the state is older than 1 week
    if (Date.now() - timestamp > ONE_WEEK) {
      clearReviewState();
      return null;
    }

    const state = JSON.parse(stateStr) as ReviewState;

    // Validate the state structure
    if (!state.mrDetails || !state.feedback || !state.url) {
      clearReviewState();
      return null;
    }

    return state;
  } catch (error) {
    console.error('Failed to load review state from localStorage', error);
    clearReviewState();
    return null;
  }
};

/**
 * Clear the saved review state from localStorage
 */
export const clearReviewState = (): void => {
  try {
    localStorage.removeItem(REVIEW_STATE_KEY);
    localStorage.removeItem(REVIEW_STATE_TIMESTAMP_KEY);
  } catch (error) {
    console.error('Failed to clear review state from localStorage', error);
  }
};

/**
 * Check if a saved review state exists and is still valid
 */
export const hasValidReviewState = (): boolean => {
  const state = loadReviewState();
  return state !== null;
};

/**
 * Get the URL from the saved review state
 */
export const getSavedReviewUrl = (): string | null => {
  const state = loadReviewState();
  return state?.url || null;
};

/**
 * Update only the feedback in the current review state
 * This is useful for preserving state during feedback modifications
 */
export const updateReviewStateFeedback = (feedback: ReviewFeedback[]): void => {
  const state = loadReviewState();
  if (state) {
    saveReviewState(state.mrDetails, feedback, state.url);
  }
};
