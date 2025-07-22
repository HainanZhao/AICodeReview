import { Config } from '../types';

const CONFIG_KEY = 'gemini-code-reviewer-config';
const PROJECTS_KEY = 'gemini-code-reviewer-selected-projects';
const THEME_KEY = 'gemini-code-reviewer-theme';


export const saveConfig = (config: Config): void => {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("Failed to save config to localStorage", error);
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
    console.error("Failed to load config from localStorage", error);
    return null;
  }
};

export const saveSelectedProjectIds = (ids: number[]): void => {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(ids));
  } catch (error) {
    console.error("Failed to save selected project IDs", error);
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
    console.error("Failed to load selected project IDs", error);
    return null;
  }
};

export const saveTheme = (theme: 'light' | 'dark'): void => {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    console.error("Failed to save theme to localStorage", error);
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
    console.error("Failed to load theme from localStorage", error);
    return null;
  }
};