import type React from 'react';
import { SettingsIcon } from './icons';

interface HeaderProps {
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  return (
    <header className="bg-[#0a0a0f] border-b border-[#ececec]/10 sticky top-0 z-30">
      <div className="w-full px-4 md:px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center space-x-3">
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6 text-[#00f0ff]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" opacity={0.3} />
              <circle cx="12" cy="12" r="3" opacity={0.3} />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
              <path d="M12 2v7M12 15v7M3 7l6 3.5M15 13.5l6 3.5M3 17l6-3.5M15 10.5l6-3.5" />
            </svg>
            <h1 className="text-sm font-bold text-[#ececec] tracking-tight">AI CODE REVIEW</h1>
          </div>
          <button
            onClick={onOpenSettings}
            className="p-2 text-[#a1a1aa] hover:text-[#00f0ff] transition-colors"
            aria-label="Open settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
