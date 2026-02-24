import type React from 'react';

export type ViewMode = 'inline' | 'split';

interface ViewModeToggleProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

const InlineViewIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M2 3.75A.75.75 0 012.75 3h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 3.75zM2 8a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 8zm0 4.25a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z"
    />
  </svg>
);

const SplitViewIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M7.25 2a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5h-1.5zM2 6.75A.75.75 0 012.75 6h4.5a.75.75 0 010 1.5h-4.5A.75.75 0 012 6.75zM2 10.25a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zM2 13.75A.75.75 0 012.75 13h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zM8.75 6a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zM8 10.25a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zM8.75 13a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z"
    />
  </svg>
);

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ currentMode, onModeChange }) => {
  return (
    <div className="flex items-center bg-[#00f0ff]/10 border border-[#00f0ff]/20 p-1">
      <button
        onClick={() => onModeChange('inline')}
        className={`flex items-center space-x-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
          currentMode === 'inline'
            ? 'cyber-btn cyber-btn--cyan cyber-btn--xs'
            : 'text-[#a1a1aa] hover:text-[#00f0ff]'
        }`}
        title="Inline view"
      >
        <InlineViewIcon className="w-3.5 h-3.5" />
        <span>INLINE</span>
      </button>
      <button
        onClick={() => onModeChange('split')}
        className={`flex items-center space-x-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
          currentMode === 'split'
            ? 'cyber-btn cyber-btn--cyan cyber-btn--xs'
            : 'text-[#a1a1aa] hover:text-[#00f0ff]'
        }`}
        title="Split view"
      >
        <SplitViewIcon className="w-3.5 h-3.5" />
        <span>SPLIT</span>
      </button>
    </div>
  );
};
