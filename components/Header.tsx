import React from 'react';
import { SettingsIcon, SunIcon, MoonIcon } from './icons';

const BrainCircuitIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-brand-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.874 5.126A2.25 2.25 0 017.125 3h9.75a2.25 2.25 0 012.25 2.25v9.75a2.25 2.25 0 01-2.25 2.25H7.125a2.25 2.25 0 01-2.25-2.25V5.126zM12 9.75v4.5m-4.5-2.25h9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21m-4.5-9H3m18 0h-4.5M5.625 5.625l2.25 2.25m10.5 10.5l-2.25-2.25m10.5-2.25l-2.25 2.25M5.625 18.375l2.25-2.25" />
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
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-4">
            <BrainCircuitIcon />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Gemini Code Reviewer
              </h1>
              <p className="text-sm text-gray-500 dark:text-brand-subtle">
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