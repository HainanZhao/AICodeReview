import type React from 'react';
import { Button } from './Button';
import { SettingsIcon } from './icons';

const BrainCircuitIcon = () => (
  <div className="relative group cursor-default select-none">
    {/* Dynamic Background Glow */}
    <div className="absolute -inset-1 bg-gradient-to-tr from-[#1f75cb] via-[#6b4fbb] to-[#428fdc] rounded-xl blur-md opacity-20 group-hover:opacity-40 transition duration-500" />

    <div className="relative flex items-center justify-center w-10 h-10 bg-white dark:bg-[#1f1e24] rounded-xl border border-[#dbdbdb] dark:border-[#404040] shadow-sm overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
        <svg width="100%" height="100%">
          <pattern id="grid" width="4" height="4" patternUnits="userSpaceOnUse">
            <path d="M 4 0 L 0 0 0 4" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Main Logo Mark */}
      <svg
        viewBox="0 0 24 24"
        className="w-6 h-6 text-[#1f75cb] dark:text-[#428fdc]"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Hexagonal Outer Frame */}
        <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" className="opacity-20" />

        {/* Central Intelligence Node */}
        <circle cx="12" cy="12" r="3" className="fill-current opacity-20 animate-pulse" />
        <circle cx="12" cy="12" r="1" className="fill-current" />

        {/* Connection Lines */}
        <path
          d="M12 2v7M12 15v7M3 7l6 3.5M15 13.5l6 3.5M3 17l6-3.5M15 10.5l6-3.5"
          className="animate-draw"
        />
      </svg>

      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
    </div>

    <style>{`
      @keyframes draw {
        0% { stroke-dasharray: 0 100; opacity: 0; }
        50% { opacity: 1; }
        100% { stroke-dasharray: 100 0; }
      }
      .animate-draw {
        stroke-dasharray: 100;
        animation: draw 2s ease-out forwards;
      }
    `}</style>
  </div>
);

interface HeaderProps {
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  return (
    <header className="bg-white/70 dark:bg-brand-bg/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/5 sticky top-0 z-30">
      <div className="w-full px-4 md:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <BrainCircuitIcon />
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
                AI Code Review
              </h1>
              <p className="text-[11px] font-medium text-gray-500 dark:text-brand-subtle tracking-wide uppercase">
                Intelligence Engine
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenSettings}
              className="!p-2"
              aria-label="Open settings"
            >
              <SettingsIcon />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
