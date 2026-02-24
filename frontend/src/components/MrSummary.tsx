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
    <div className="bg-white dark:bg-[#18191d] rounded-md shadow-sm h-full flex flex-col border border-[#dbdbdb] dark:border-[#404040] overflow-hidden">
      <div className="p-4 border-b border-[#dbdbdb] dark:border-[#404040] bg-[#fbfbfb] dark:bg-[#1f1e24]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#444444] dark:text-[#a1a1aa]">
            Merge Request
          </h2>
          <div className="px-1.5 py-0.5 rounded bg-[#1f75cb]/10 text-[#1f75cb] dark:text-[#428fdc] text-[11px] font-bold border border-[#1f75cb]/20">
            !{mrDetails.mrIid}
          </div>
        </div>
        <h3 className="font-bold text-[#111111] dark:text-[#ececec] break-words text-[13px] leading-snug">
          {mrDetails.title}
        </h3>
        <div className="mt-2 flex items-center">
          <div className="w-4 h-4 rounded-full bg-[#e5e5e5] dark:bg-[#2e2e33] flex items-center justify-center text-[9px] font-bold text-[#444444] dark:text-[#a1a1aa] mr-1.5">
            {mrDetails.authorName.charAt(0)}
          </div>
          <p className="text-[11px] font-semibold text-[#444444] dark:text-[#a1a1aa]">
            {mrDetails.authorName}
          </p>
        </div>
        
        {isRestoredFromCache && (
          <div className="mt-3 px-2 py-1 rounded bg-[#1f75cb]/5 text-[10px] font-bold text-[#1f75cb] dark:text-[#428fdc] flex items-center">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            Session Restored
          </div>
        )}
      </div>
      <div className="p-4 flex-grow flex flex-col min-h-0 bg-white dark:bg-[#18191d]">
        <div className="flex-grow flex flex-col min-h-0 space-y-4">
          <div className="flex items-center space-x-2 text-[10px] font-mono bg-[#fbfbfb] dark:bg-[#1f1e24] p-2 rounded border border-[#dbdbdb] dark:border-[#404040] flex-shrink-0">
            <span className="text-[#1f75cb] dark:text-[#428fdc] font-bold truncate max-w-[80px]" title={mrDetails.sourceBranch}>
              {mrDetails.sourceBranch}
            </span>
            <span className="text-[#444444] dark:text-[#a1a1aa] mx-1">→</span>
            <span className="text-[#444444] dark:text-[#a1a1aa] font-medium truncate max-w-[80px]" title={mrDetails.targetBranch}>
              {mrDetails.targetBranch}
            </span>
          </div>

          <div className="flex-grow flex flex-col min-h-0">
             <div className="flex items-center justify-between mb-1.5">
               <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#444444] dark:text-[#a1a1aa]">Files</h4>
               <span className="text-[10px] font-bold text-[#444444] dark:text-[#a1a1aa]">{mrDetails.parsedDiffs.length}</span>
             </div>
             <FileTree fileDiffs={mrDetails.parsedDiffs} onFileClick={scrollToFile} />
          </div>

          <div className="space-y-2 pt-2 border-t border-[#dbdbdb] dark:border-[#404040]">
            <a
              href={mrDetails.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full px-3 py-1.5 rounded bg-[#fbfbfb] dark:bg-[#1f1e24] border border-[#dbdbdb] dark:border-[#404040] text-[#111111] dark:text-[#ececec] hover:bg-[#f0f0f0] dark:hover:bg-[#2e2e33] transition-all text-[11px] font-bold"
            >
              <span>Open in GitLab</span>
            </a>
            
            <button
              onClick={onNewReview}
              className="flex items-center justify-center w-full px-3 py-2 rounded bg-[#1f75cb] text-white hover:bg-[#1068bf] transition-all active:scale-[0.98] shadow-sm"
            >
              <PlusIcon className="w-3.5 h-3.5 mr-1.5" />
              <span className="text-[11px] font-bold">New Review Cycle</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
