import React from 'react';
import { MoonIcon, SettingsIcon, SunIcon } from './icons';

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
  onToggleTheme: () => void;
  currentTheme: 'light' | 'dark';
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, onToggleTheme, currentTheme }) => {
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
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-full text-gray-500 dark:text-brand-subtle hover:bg-gray-200 dark:hover:bg-brand-primary hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label="Toggle theme"
            >
              {currentTheme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
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
