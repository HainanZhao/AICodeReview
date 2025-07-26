import { Config } from '../types';
import { GitLabConfig, GitLabProject } from '../../../types';

const CONFIG_KEY = 'ai-code-reviewer-config-override';
const PROJECTS_KEY = 'ai-code-reviewer-selected-projects';
const PROJECTS_CACHE_KEY = 'ai-code-reviewer-projects-cache';
const PROJECTS_CACHE_TIMESTAMP_KEY = 'ai-code-reviewer-projects-cache-timestamp';
const THEME_KEY = 'ai-code-reviewer-theme';

export type ConfigSource = 'localStorage' | 'backend' | 'none';

export const saveConfig = (config: Config): void => {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save config to localStorage', error);
  }
};

export const loadConfig = (): Config | null => {
  try {
    const configStr = localStorage.getItem(CONFIG_KEY);
    if (!configStr) {
      return null;
    }
    return JSON.parse(configStr) as Config;
  } catch (error) {
    console.error('Failed to load config from localStorage', error);
    return null;
  }
};

export const hasLocalStorageConfig = (): boolean => {
  try {
    const configStr = localStorage.getItem(CONFIG_KEY);
    return configStr !== null;
  } catch (error) {
    console.error('Failed to check localStorage config', error);
    return false;
  }
};

export const clearLocalStorageConfig = (): void => {
  try {
    localStorage.removeItem(CONFIG_KEY);
  } catch (error) {
    console.error('Failed to clear localStorage config', error);
  }
};

export const getConfigSource = async (): Promise<ConfigSource> => {
  const hasLocalConfig = hasLocalStorageConfig();
  if (hasLocalConfig) {
    return 'localStorage';
  }

  const backendConfig = await fetchBackendConfig();
  if (backendConfig?.url) {
    return 'backend';
  }

  return 'none';
};

export const hasLocalStorageOverride = async (): Promise<boolean> => {
  const hasLocal = hasLocalStorageConfig();
  const backendConfig = await fetchBackendConfig();

  return hasLocal && backendConfig?.url !== undefined;
};

export const resetToBackendConfig = (): void => {
  clearLocalStorageConfig();
};

export const createConfigFromBackend = async (accessToken: string): Promise<Config | null> => {
  const backendConfig = await fetchBackendConfig();
  if (backendConfig?.url) {
    return {
      gitlabUrl: backendConfig.url,
      accessToken: accessToken,
    };
  }
  return null;
};

export const fetchBackendConfig = async (
  retries = 3,
  delay = 1000
): Promise<
  (Partial<GitLabConfig> & { hasAccessToken?: boolean; configSource?: string }) | null
> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return {
        url: data.gitlabUrl,
        hasAccessToken: data.hasAccessToken,
        configSource: data.configSource,
        // Include accessToken if backend provides it (CLI config case)
        accessToken: data.accessToken,
      };
    } catch (error) {
      console.warn(`Failed to fetch backend config (attempt ${attempt}/${retries}):`, error);

      if (attempt === retries) {
        console.error('All attempts to fetch backend config failed:', error);
        return null;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return null;
};

export const saveSelectedProjectIds = (ids: number[]): void => {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(ids));
  } catch (error) {
    console.error('Failed to save selected project IDs', error);
  }
};

export const loadSelectedProjectIds = (): number[] | null => {
  try {
    const idsStr = localStorage.getItem(PROJECTS_KEY);
    if (!idsStr) {
      return null;
    }
    return JSON.parse(idsStr);
  } catch (error) {
    console.error('Failed to load selected project IDs', error);
    return null;
  }
};

export const saveTheme = (theme: 'light' | 'dark'): void => {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    console.error('Failed to save theme to localStorage', error);
  }
};

export const loadTheme = (): 'light' | 'dark' | null => {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    if (theme === 'light' || theme === 'dark') {
      return theme;
    }
    return null;
  } catch (error) {
    console.error('Failed to load theme from localStorage', error);
    return null;
  }
};

export const saveProjectsToCache = (projects: GitLabProject[]): void => {
  try {
    localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(projects));
    localStorage.setItem(PROJECTS_CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error('Failed to save projects to cache', error);
  }
};

export const loadProjectsFromCache = (): GitLabProject[] | null => {
  try {
    const projectsStr = localStorage.getItem(PROJECTS_CACHE_KEY);
    const timestampStr = localStorage.getItem(PROJECTS_CACHE_TIMESTAMP_KEY);

    if (!projectsStr || !timestampStr) {
      return null;
    }

    const cachedTimestamp = parseInt(timestampStr, 10);
    const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

    if (Date.now() - cachedTimestamp > CACHE_DURATION) {
      return null;
    }

    return JSON.parse(projectsStr) as GitLabProject[];
  } catch (error) {
    console.error('Failed to load projects from cache', error);
    return null;
  }
};
