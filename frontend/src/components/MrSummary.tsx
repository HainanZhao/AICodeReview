import type React from 'react';
import type { GitLabMRDetails } from '../types';
import { FileTree } from './FileTree';
import { PlusIcon } from './icons';

interface MrSummaryProps {
  mrDetails: GitLabMRDetails;
  onNewReview: () => void;
  isRestoredFromCache?: boolean;
}

export const MrSummary: React.FC<MrSummaryProps> = ({
  mrDetails,
  onNewReview,
  isRestoredFromCache = false,
}) => {
  const scrollToFile = (filePath: string) => {
    // Find the FileDiffCard element by its data-file-path attribute
    const fileElement = document.querySelector(`[data-file-path="${filePath}"]`);
    if (fileElement) {
      // Scroll to the element
      fileElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest',
      });

      // Add a brief highlight effect
      const originalClasses = fileElement.className;
      fileElement.className += ' ring-2 ring-blue-500 ring-opacity-75';

      // Remove highlight after 2 seconds
      setTimeout(() => {
        fileElement.className = originalClasses;
      }, 2000);
    } else {
      // Fallback: try to find element by key if data attribute doesn't work
      const allFileDiffs = document.querySelectorAll('[data-file-path]');
      const targetElement = Array.from(allFileDiffs).find(
        (el) => el.getAttribute('data-file-path') === filePath
      );

      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }
  };

  return (
    <div className="cyber-card h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-left duration-500">
      <div className="p-4 border-b border-[#00f0ff]/20 bg-[#00f0ff]/5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#00f0ff] cyber-text-glow">
            {/* // MERGE REQUEST */}
          </h2>
          <div className="px-2 py-0.5 rounded bg-[#00f0ff]/10 text-[#00f0ff] text-[11px] font-bold border border-[#00f0ff]/30 shadow-[0_0_8px_rgba(0,240,255,0.2)]">
            !{mrDetails.mrIid}
          </div>
        </div>
        <h3
          className="font-bold text-[#ececec] break-words text-[14px] leading-tight cyber-glitch"
          data-text={mrDetails.title}
        >
          {mrDetails.title}
        </h3>
        <div className="mt-3 flex items-center">
          <div className="w-5 h-5 rounded bg-[#00f0ff]/20 border border-[#00f0ff]/40 flex items-center justify-center text-[10px] font-bold text-[#00f0ff] mr-2 shadow-[0_0_5px_rgba(0,240,255,0.1)]">
            {mrDetails.authorName.charAt(0)}
          </div>
          <p className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">
            {mrDetails.authorName}
          </p>
        </div>

        {isRestoredFromCache && (
          <div className="mt-3 px-2 py-1 bg-[#ff2a6d]/10 text-[10px] font-bold text-[#ff2a6d] flex items-center border border-[#ff2a6d]/30 animate-pulse">
            <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
            SESSION RESTORED
          </div>
        )}
      </div>
      <div className="p-4 flex-grow flex flex-col min-h-0 bg-transparent">
        <div className="flex-grow flex flex-col min-h-0 space-y-4">
          <div className="flex items-center space-x-2 text-[10px] font-mono bg-[#00f0ff]/5 p-2 border border-[#00f0ff]/20 flex-shrink-0">
            <span
              className="text-[#00f0ff] font-bold truncate max-w-[80px]"
              title={mrDetails.sourceBranch}
            >
              {mrDetails.sourceBranch}
            </span>
            <span className="text-[#a1a1aa] mx-1 opacity-50">{'>>'}</span>
            <span
              className="text-[#a1a1aa] font-medium truncate max-w-[80px]"
              title={mrDetails.targetBranch}
            >
              {mrDetails.targetBranch}
            </span>
          </div>

          <div className="flex-grow flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa]">
                {/* // FILESYSTEM */}
              </h4>
              <span className="text-[10px] font-bold text-[#00f0ff] bg-[#00f0ff]/10 px-1.5 rounded">
                {mrDetails.parsedDiffs.length}
              </span>
            </div>
            <FileTree fileDiffs={mrDetails.parsedDiffs} onFileClick={scrollToFile} />
          </div>

          <div className="space-y-3 pt-3 border-t border-[#00f0ff]/20">
            <a
              href={mrDetails.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cyber-btn cyber-btn--ghost cyber-btn--sm w-full flex items-center justify-center text-[10px]"
            >
              <span>OPEN IN GITLAB</span>
            </a>

            <button
              onClick={onNewReview}
              className="cyber-btn cyber-btn--magenta cyber-btn--sm w-full flex items-center justify-center"
            >
              <PlusIcon className="w-3.5 h-3.5 mr-2" />
              <span className="text-[10px] font-bold">RE-INIT CYCLE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
