import { GitLabConfig, GitLabMRDetails, ReviewFeedback } from '../shared/types/gitlab';

export const postDiscussion = async (
  config: GitLabConfig,
  mrDetails: GitLabMRDetails,
  feedback: ReviewFeedback
): Promise<any> => {
  const body = {
    gitlabConfig: config,
    mrDetails: mrDetails,
    reviewFeedback: feedback,
  };

  const response = await fetch(`http://localhost:3000/api/post-discussion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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
};