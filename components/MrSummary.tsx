import React from 'react';
import { GitLabMRDetails } from '../types';
import { PlusIcon } from './icons';

interface MrSummaryProps {
  mrDetails: GitLabMRDetails;
  onNewReview: () => void;
}

export const MrSummary: React.FC<MrSummaryProps> = ({ mrDetails, onNewReview }) => {
  return (
    <div className="bg-white dark:bg-brand-surface rounded-lg shadow-xl h-full flex flex-col">
       <div className="p-3 border-b border-gray-200 dark:border-brand-primary">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Reviewing MR !{mrDetails.mrIid}</h2>
      </div>
      <div className="p-4 space-y-3 flex-grow flex flex-col">
        <div className="flex-grow space-y-3">
            <div>
                <h3 className="font-semibold text-gray-900 dark:text-brand-text break-words text-sm">{mrDetails.title}</h3>
                <p className="text-xs text-gray-500 dark:text-brand-subtle mt-0.5">by {mrDetails.authorName}</p>
            </div>
            <div className="flex items-center text-xs font-mono bg-gray-100 dark:bg-brand-primary/50 p-2 rounded-md">
                <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded-full truncate">{mrDetails.sourceBranch}</span>
                <span className="text-gray-500 dark:text-brand-subtle mx-2">→</span>
                <span className="bg-gray-200 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded-full truncate">{mrDetails.targetBranch}</span>
            </div>
             <a 
              href={mrDetails.webUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block w-full text-center bg-gray-100 dark:bg-brand-primary hover:bg-gray-200 dark:hover:bg-brand-primary/70 text-gray-600 dark:text-brand-subtle font-semibold py-1.5 px-3 rounded-md transition-colors text-xs"
            >
              View on GitLab
            </a>
        </div>
       
        <div className="flex-shrink-0">
            <button
            onClick={onNewReview}
            className="w-full flex items-center justify-center bg-brand-secondary hover:bg-red-600 text-white font-semibold py-1.5 px-3 rounded-md transition-colors text-xs"
            >
            <PlusIcon />
            <span className="ml-2">Start New Review</span>
            </button>
        </div>
      </div>
    </div>
  );
};