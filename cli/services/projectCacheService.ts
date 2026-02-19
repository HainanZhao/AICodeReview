import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fetchProjects } from '../shared/services/gitlabCore.js';
import type { GitLabConfig, GitLabProject } from '../shared/types/gitlab.js';
import { Util } from '../shared/utils/Util.js';

export interface ProjectCacheEntry {
  id: number;
  name: string;
  nameWithNamespace: string;
  lastUpdated: string;
}

export interface ProjectCache {
  projects: ProjectCacheEntry[];
  lastFullUpdate: string;
}

export class ProjectCacheService {
  private readonly cacheFilePath: string;
  private readonly maxCacheAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  constructor() {
    const homeConfigDir = join(homedir(), '.aicodereview');
    if (!existsSync(homeConfigDir)) {
      mkdirSync(homeConfigDir, { recursive: true });
    }
    this.cacheFilePath = join(homeConfigDir, 'projects-cache.json');
  }

  /**
   * Loads the project cache from disk
   */
  private loadCache(): ProjectCache {
    if (!existsSync(this.cacheFilePath)) {
      return {
        projects: [],
        lastFullUpdate: new Date(0).toISOString(), // Very old date to force initial update
      };
    }

    try {
      const content = readFileSync(this.cacheFilePath, 'utf-8');
      return JSON.parse(content) as ProjectCache;
    } catch (error) {
      console.warn('Failed to load project cache, starting fresh:', error);
      return {
        projects: [],
        lastFullUpdate: new Date(0).toISOString(),
      };
    }
  }

  /**
   * Saves the project cache to disk
   */
  private saveCache(cache: ProjectCache): void {
    try {
      writeFileSync(this.cacheFilePath, JSON.stringify(cache, null, 2));
    } catch (error) {
      console.warn('Failed to save project cache:', error);
    }
  }

  /**
   * Checks if the cache needs to be updated
   */
  private shouldUpdateCache(cache: ProjectCache): boolean {
    const lastUpdate = new Date(cache.lastFullUpdate);
    const now = new Date();
    return now.getTime() - lastUpdate.getTime() > this.maxCacheAge;
  }

  /**
   * Updates the cache with fresh project data from GitLab
   */
  private async updateCacheFromGitLab(config: GitLabConfig): Promise<ProjectCache> {
    try {
      console.log('🔄 Updating project cache from GitLab...');
      const projects = await fetchProjects(config);

      const cache: ProjectCache = {
        projects: projects.map((project: GitLabProject) => ({
          id: project.id,
          name: project.name,
          nameWithNamespace: Util.normalizeProjectName(project.name_with_namespace),
          lastUpdated: new Date().toISOString(),
        })),
        lastFullUpdate: new Date().toISOString(),
      };

      this.saveCache(cache);
      console.log(`✅ Updated cache with ${cache.projects.length} projects`);
      return cache;
    } catch (error) {
      console.warn('Failed to update project cache from GitLab:', error);
      // Return the existing cache even if update failed
      return this.loadCache();
    }
  }

  /**
   * Resolves project names to project IDs using the cache
   * Updates cache if needed
   */
  async resolveProjectNamesToIds(
    projectNames: string[],
    config: GitLabConfig
  ): Promise<{ id: number; name: string }[]> {
    let cache = this.loadCache();

    // Update cache if it's too old or empty
    if (this.shouldUpdateCache(cache) || cache.projects.length === 0) {
      cache = await this.updateCacheFromGitLab(config);
    }

    const resolvedProjects: { id: number; name: string }[] = [];
    const notFoundNames: string[] = [];

    for (const projectName of projectNames) {
      const normalizedSearchName = Util.normalizeProjectName(projectName).toLowerCase().trim();

      // Try to find exact match first (by name or name_with_namespace)
      // Support both normalized and original formats for backward compatibility
      let found = cache.projects.find(
        (project) =>
          project.name.toLowerCase() === normalizedSearchName ||
          project.nameWithNamespace.toLowerCase() === normalizedSearchName ||
          Util.normalizeProjectName(project.nameWithNamespace).toLowerCase() ===
            normalizedSearchName
      );

      // If no exact match, try partial match
      if (!found) {
        found = cache.projects.find(
          (project) =>
            project.name.toLowerCase().includes(normalizedSearchName) ||
            project.nameWithNamespace.toLowerCase().includes(normalizedSearchName) ||
            Util.normalizeProjectName(project.nameWithNamespace)
              .toLowerCase()
              .includes(normalizedSearchName)
        );
      }

      if (found) {
        resolvedProjects.push({ id: found.id, name: found.nameWithNamespace });
      } else {
        notFoundNames.push(projectName);
      }
    }

    // If some projects weren't found, try updating the cache and search again
    if (notFoundNames.length > 0 && !this.shouldUpdateCache(cache)) {
      console.log(
        `🔍 Projects not found in cache: ${notFoundNames.join(', ')}. Refreshing cache...`
      );
      cache = await this.updateCacheFromGitLab(config);

      // Try to resolve the not found projects again with fresh cache
      for (const projectName of notFoundNames) {
        const normalizedSearchName = Util.normalizeProjectName(projectName).toLowerCase().trim();

        let found = cache.projects.find(
          (project) =>
            project.name.toLowerCase() === normalizedSearchName ||
            project.nameWithNamespace.toLowerCase() === normalizedSearchName ||
            Util.normalizeProjectName(project.nameWithNamespace).toLowerCase() ===
              normalizedSearchName
        );

        if (!found) {
          found = cache.projects.find(
            (project) =>
              project.name.toLowerCase().includes(normalizedSearchName) ||
              project.nameWithNamespace.toLowerCase().includes(normalizedSearchName) ||
              Util.normalizeProjectName(project.nameWithNamespace)
                .toLowerCase()
                .includes(normalizedSearchName)
          );
        }

        if (found && !resolvedProjects.some((p) => p.id === found.id)) {
          resolvedProjects.push({ id: found.id, name: found.nameWithNamespace });
        }
      }
    }

    return resolvedProjects;
  }

  /**
   * Gets project names from project IDs (for migration purposes)
   */
  async getProjectNamesFromIds(
    projectIds: number[],
    config: GitLabConfig
  ): Promise<{ id: number; name: string }[]> {
    let cache = this.loadCache();

    // Update cache if it's too old or empty
    if (this.shouldUpdateCache(cache) || cache.projects.length === 0) {
      cache = await this.updateCacheFromGitLab(config);
    }

    const result: { id: number; name: string }[] = [];

    for (const id of projectIds) {
      const found = cache.projects.find((project) => project.id === id);
      if (found) {
        result.push({ id: found.id, name: found.nameWithNamespace });
      }
    }

    return result;
  }

  /**
   * Lists all cached projects for display purposes
   */
  async listAllProjects(config: GitLabConfig): Promise<ProjectCacheEntry[]> {
    let cache = this.loadCache();

    // Update cache if it's too old or empty
    if (this.shouldUpdateCache(cache) || cache.projects.length === 0) {
      cache = await this.updateCacheFromGitLab(config);
    }

    return cache.projects;
  }

  /**
   * Forces a cache refresh (useful for troubleshooting)
   */
  async refreshCache(config: GitLabConfig): Promise<void> {
    await this.updateCacheFromGitLab(config);
  }

  /**
   * Clears the cache (useful for troubleshooting)
   */
  clearCache(): void {
    if (existsSync(this.cacheFilePath)) {
      try {
        unlinkSync(this.cacheFilePath);
        console.log('✅ Project cache cleared');
      } catch (error) {
        console.warn('Failed to clear project cache:', error);
      }
    }
  }
}
