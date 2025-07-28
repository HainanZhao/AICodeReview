import {
  GitLabMRDetails,
  ReviewFeedback,
  GitLabProject,
  GitLabMergeRequest,
  GitLabDiscussion,
} from '../../../types';
import { Config } from '../types';

// Re-export the parseDiffsToHunks function from gitlabCore
export { parseDiffsToHunks } from '../../../cli/shared/services/gitlabCore.js';

/**
 * Convert frontend Config to backend GitLabConfig format
 */
const convertConfig = (config: Config) => ({
  url: config.gitlabUrl,
  accessToken: config.accessToken,
});

export const fetchMrData = async (config: Config, mrUrl: string): Promise<GitLabMRDetails> => {
  const { fetchMrData: coreFetchMrData } = await import(
    '../../../cli/shared/services/gitlabCore.js'
  );
  const result = await coreFetchMrData(convertConfig(config), mrUrl);
  // Type assertion since the core types are compatible but not identical
  return result as GitLabMRDetails;
};

export const postDiscussion = async (
  config: Config,
  mrDetails: GitLabMRDetails,
  feedback: ReviewFeedback
): Promise<GitLabDiscussion> => {
  const { postDiscussion: corePostDiscussion } = await import(
    '../../../cli/shared/services/gitlabCore.js'
  );
  const result = await corePostDiscussion(convertConfig(config), mrDetails, feedback);
  return result as GitLabDiscussion;
};

export const fetchProjects = async (config: Config): Promise<GitLabProject[]> => {
  const { fetchProjects: coreFetchProjects } = await import(
    '../../../cli/shared/services/gitlabCore.js'
  );
  const result = await coreFetchProjects(convertConfig(config));
  return result as GitLabProject[];
};

export const fetchMergeRequestsForProjects = async (
  config: Config,
  projects: GitLabProject[],
  projectIds: number[]
): Promise<GitLabMergeRequest[]> => {
  const { fetchMergeRequestsForProjects: coreFetchMergeRequestsForProjects } = await import(
    '../../../cli/shared/services/gitlabCore.js'
  );
  const result = await coreFetchMergeRequestsForProjects(
    convertConfig(config),
    projects,
    projectIds
  );
  return result as GitLabMergeRequest[];
};

export const approveMergeRequest = async (
  config: Config,
  projectId: number,
  mrIid: string
): Promise<void> => {
  const { approveMergeRequest: coreApproveMergeRequest } = await import(
    '../../../cli/shared/services/gitlabCore.js'
  );
  return coreApproveMergeRequest(convertConfig(config), projectId, mrIid);
};
