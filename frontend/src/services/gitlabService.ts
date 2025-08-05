// Re-export necessary functions, but not postDiscussion
export {
  approveMergeRequest,
  fetchMergeRequestsForProjects,
  fetchMrData,
  fetchProjects,
  parseDiffsToHunks
} from '../../../cli/shared/services/gitlabCore.js';
import { GitLabConfig, GitLabMRDetails, ReviewFeedback } from '../types';

// Add new API-based method
export const postDiscussion = async (
  gitlabConfig: GitLabConfig,
  mrDetails: GitLabMRDetails,
  reviewFeedback: ReviewFeedback
): Promise<any> => {
  try {
    // Remove large fields that are not needed for posting discussions
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { diffForPrompt, fileDiffs, fileContents, parsedDiffs, ...mrDetailsForPosting } =
      mrDetails;

    const response = await fetch('/api/post-discussion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gitlabConfig,
        mrDetails: mrDetailsForPosting,
        feedbackItem: reviewFeedback,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Unknown server error');
    }

    return result.result;
  } catch (error) {
    // Re-throw with better context
    if (error instanceof Error) {
      throw new Error(`Failed to post discussion: ${error.message}`);
    }
    throw new Error('Failed to post discussion: Unknown error');
  }
};
