import type React from 'react';
import { Button } from './Button';

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
    <div className="flex items-center bg-gray-100 dark:bg-brand-primary/30 rounded-lg p-1">
      <Button
        variant={currentMode === 'inline' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('inline')}
        className={currentMode === 'inline' ? '!shadow-sm' : ''}
        title="Inline view"
        leftIcon={<InlineViewIcon className="w-3 h-3" />}
      >
        Inline
      </Button>
      <Button
        variant={currentMode === 'split' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('split')}
        className={currentMode === 'split' ? '!shadow-sm' : ''}
        title="Split view"
        leftIcon={<SplitViewIcon className="w-3 h-3" />}
      >
        Split
      </Button>
    </div>
  );
};
