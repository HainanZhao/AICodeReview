// Re-export all GitLab functions directly from the shared core
export {
  fetchMrData,
  postDiscussion,
  fetchProjects,
  fetchMergeRequestsForProjects,
  approveMergeRequest,
  parseDiffsToHunks,
} from '../../../cli/shared/services/gitlabCore.js';
