/**
 * Type adapters to unify different configuration formats
 * between frontend and CLI
 */

import { GitLabConfig } from '../types/gitlab.js';

// Frontend configuration format (from UI)
export interface FrontendGitLabConfig {
  gitlabUrl: string;
  accessToken: string;
}

// Re-export GitLabConfig for convenience
export { GitLabConfig } from '../types/gitlab.js';

/**
 * Converts frontend config format to CLI GitLabConfig format
 */
export function adaptFrontendConfig(frontendConfig: FrontendGitLabConfig): GitLabConfig {
  return {
    url: frontendConfig.gitlabUrl,
    accessToken: frontendConfig.accessToken,
  };
}

/**
 * Validates that a config object has the required GitLab properties
 */
export function validateGitLabConfig(
  config: unknown
): config is FrontendGitLabConfig | GitLabConfig {
  if (!config || typeof config !== 'object') {
    return false;
  }

  const configObj = config as Record<string, unknown>;

  // Check for frontend format
  if (typeof configObj.gitlabUrl === 'string' && typeof configObj.accessToken === 'string') {
    return true;
  }

  // Check for CLI format
  if (typeof configObj.url === 'string' && typeof configObj.accessToken === 'string') {
    return true;
  }

  return false;
}

/**
 * Normalizes any config format to CLI GitLabConfig format
 */
export function normalizeGitLabConfig(config: FrontendGitLabConfig | GitLabConfig): GitLabConfig {
  // If it's already in CLI format
  if ('url' in config) {
    return config as GitLabConfig;
  }

  // Convert from frontend format
  return adaptFrontendConfig(config as FrontendGitLabConfig);
}
