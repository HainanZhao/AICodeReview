import React from 'react';
import { SYNTAX_THEMES } from '../constants';
import { SettingsIcon } from './icons';

const BrainCircuitIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-8 w-8 text-brand-secondary"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75l6 4.5-6 4.5" />
    <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface HeaderProps {
  onOpenSettings: () => void;
  onSyntaxThemeChange: (theme: string) => void;
  currentSyntaxTheme: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onSyntaxThemeChange,
  currentSyntaxTheme,
}) => {
  return (
    <header className="bg-white/80 dark:bg-brand-surface/50 backdrop-blur-sm border-b border-gray-200 dark:border-brand-primary/50 sticky top-0 z-20">
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <BrainCircuitIcon />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                AI Code Review
              </h1>
              <p className="text-xs text-gray-500 dark:text-brand-subtle">
                AI-powered Merge Request analysis
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <label
              htmlFor="syntax-theme-select"
              className="text-sm text-gray-600 dark:text-brand-subtle"
            >
              Theme:
            </label>
            <select
              id="syntax-theme-select"
              value={currentSyntaxTheme}
              onChange={(e) => onSyntaxThemeChange(e.target.value)}
              className="p-2 text-sm bg-gray-100 dark:bg-brand-primary border border-gray-300 dark:border-brand-primary/50 text-gray-800 dark:text-brand-text rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary hover:bg-gray-200 dark:hover:bg-brand-primary/80 transition-colors"
              aria-label="Select syntax highlighting theme"
            >
              {SYNTAX_THEMES.map((theme) => (
                <option key={theme.value} value={theme.value}>
                  {theme.label}
                </option>
              ))}
            </select>
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-full text-gray-500 dark:text-brand-subtle hover:bg-gray-200 dark:hover:bg-brand-primary hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label="Open settings"
            >
              <SettingsIcon />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
