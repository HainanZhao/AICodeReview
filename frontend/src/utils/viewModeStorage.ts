import type { ViewMode } from '../components/ViewModeToggle';

const STORAGE_KEY = 'aicodereview-view-mode';
const DEFAULT_VIEW_MODE: ViewMode = 'inline';

/**
 * Safely read view mode preference from localStorage
 */
export const getStoredViewMode = (): ViewMode => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_VIEW_MODE;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'inline' || stored === 'split') {
      return stored;
    }

    return DEFAULT_VIEW_MODE;
  } catch (error) {
    console.warn('Failed to read view mode from localStorage:', error);
    return DEFAULT_VIEW_MODE;
  }
};

/**
 * Safely save view mode preference to localStorage
 */
export const setStoredViewMode = (mode: ViewMode): void => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  } catch (error) {
    console.warn('Failed to save view mode to localStorage:', error);
  }
};
