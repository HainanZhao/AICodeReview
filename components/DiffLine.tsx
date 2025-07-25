import React from 'react';
import { ParsedDiffLine } from '../types';
import { PlusIcon } from './icons';

interface DiffLineProps {
  line: ParsedDiffLine;
  onAddComment: () => void;
}

const getLineClasses = (type: ParsedDiffLine['type']) => {
  switch (type) {
    case 'add':
      return 'bg-green-100/50 dark:bg-green-900/20 text-green-800 dark:text-green-300';
    case 'remove':
      return 'bg-red-100/50 dark:bg-red-900/20 text-red-800 dark:text-red-400';
    case 'meta':
      return 'bg-blue-100/50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
    default:
      return 'bg-transparent text-gray-500 dark:text-brand-subtle';
  }
};

export const DiffLine: React.FC<DiffLineProps> = ({ line, onAddComment }) => {
  const lineClasses = getLineClasses(line.type);
  const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
  const canComment = line.type === 'add' || line.type === 'remove' || line.type === 'context';

  return (
    <tr className={`${lineClasses} group hover:bg-black/5 dark:hover:bg-white/10 h-4`}>
      <td className="w-8 text-center align-middle h-4">
        {/* 
                  The button is always rendered to maintain a consistent column width, preventing layout shifts.
                  It is only made visible and interactive via CSS on hover for commentable lines.
                */}
        <button
          onClick={onAddComment}
          title={canComment ? 'Add comment' : ''}
          disabled={!canComment}
          className={`
                      opacity-0 bg-brand-secondary text-white rounded-full p-[3px] leading-none shadow-lg hover:bg-red-600 transition-opacity duration-150
                      ${canComment ? 'group-hover:opacity-100' : 'pointer-events-none'}
                    `}
        >
          <PlusIcon className="w-3 h-3" />
        </button>
      </td>
      <td className="w-10 text-right px-1 select-none opacity-70 align-middle h-4 text-xs">
        {line.oldLine || ''}
      </td>
      <td className="w-10 text-right px-1 select-none opacity-70 align-middle h-4 text-xs">
        {line.newLine || ''}
      </td>
      <td className="w-full pr-2 align-middle font-mono text-xs h-4">
        {line.type !== 'meta' && <span className="mr-1 select-none">{prefix}</span>}
        <span className="whitespace-pre-wrap break-words">{line.content}</span>
      </td>
    </tr>
  );
};
