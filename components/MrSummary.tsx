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
       <div className="p-4 border-b border-gray-200 dark:border-brand-primary">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Reviewing MR !{mrDetails.mrIid}</h2>
      </div>
      <div className="p-6 space-y-4 flex-grow flex flex-col">
        <div className="flex-grow space-y-4">
            <div>
                <h3 className="font-bold text-gray-900 dark:text-brand-text break-words text-base">{mrDetails.title}</h3>
                <p className="text-xs text-gray-500 dark:text-brand-subtle mt-1">by {mrDetails.authorName}</p>
            </div>
            <div className="flex items-center text-sm font-mono bg-gray-100 dark:bg-brand-primary/50 p-3 rounded-md">
                <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full truncate">{mrDetails.sourceBranch}</span>
                <span className="text-gray-500 dark:text-brand-subtle mx-2">→</span>
                <span className="bg-gray-200 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full truncate">{mrDetails.targetBranch}</span>
            </div>
             <a 
              href={mrDetails.webUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block w-full text-center bg-gray-100 dark:bg-brand-primary hover:bg-gray-200 dark:hover:bg-brand-primary/70 text-gray-600 dark:text-brand-subtle font-bold py-2 px-4 rounded-md transition-colors text-sm"
            >
              View on GitLab
            </a>
        </div>
       
        <div className="flex-shrink-0">
            <button
            onClick={onNewReview}
            className="w-full flex items-center justify-center bg-brand-secondary hover:bg-red-600 text-white font-bold py-1.5 px-3 rounded-md transition-colors text-sm"
            >
            <PlusIcon />
            <span className="ml-2">Start New Review</span>
            </button>
        </div>
      </div>
    </div>
  );
};