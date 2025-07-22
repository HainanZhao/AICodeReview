import React, { useMemo, useState, useEffect } from 'react';
import { ReviewFeedback, GitLabMRDetails, ParsedFileDiff, ParsedDiffLine, Severity } from '../types';
import { FileDiffCard } from './FileDiffCard';
import { Spinner } from './Spinner';
import { ArrowUpIcon, ArrowDownIcon } from './icons';

interface FeedbackPanelProps {
  feedback: ReviewFeedback[] | null;
  mrDetails: GitLabMRDetails | null;
  isLoading: boolean;
  error: string | null;
  onPostComment: (id: string) => void;
  onPostAllComments: () => void;
  onUpdateFeedback: (id: string, title: string, description: string, severity: Severity) => void;
  onDeleteFeedback: (id: string) => void;
  onSetEditing: (id: string, isEditing: boolean) => void;
  onAddCustomFeedback: (fileDiff: ParsedFileDiff, line: ParsedDiffLine) => void;
  onToggleHunkCollapse: (filePath: string, hunkIndex: number) => void;
  onExpandHunkContext: (filePath: string, hunkIndex: number, direction: 'up' | 'down', lines: number) => void;
  onToggleIgnoreFeedback: (id: string) => void;
}

const InitialState = () => (
    <div className="text-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-gray-300 dark:text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.94,10.94a1,1,0,0,0-1.42,0l-2.29,2.29a1.44,1.44,0,0,0-.41,1V16.5a.5.5,0,0,0,.5.5h2.25a1.44,1.44,0,0,0,1-.41l2.29-2.29a1,1,0,0,0,0-1.42Z"/>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.06,13.06a1,1,0,0,0,1.42,0l2.29-2.29a1.44,1.44,0,0,0,.41-1V7.5a.5.5,0,0,0-.5-.5H7.41a1.44,1.44,0,0,0-1,.41L4.09,9.68a1,1,0,0,0,0,1.42Z"/>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12,3a9,9,0,0,0-9,9,1,1,0,0,0,1,1h.5a1,1,0,0,1,1,1v.5a1,1,0,0,0,1,1h5a1,1,0,0,0,1-1v-.5a1,1,0,0,1,1-1h.5a1,1,0,0,0,1-1A9,9,0,0,0,12,3Z"/>
        </svg>
        <h3 className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">Awaiting Analysis</h3>
        <p className="mt-1 text-md text-gray-500 dark:text-brand-subtle">
            Select a Merge Request from the dashboard to begin.
        </p>
    </div>
);

const NoIssuesFound = () => (
    <div className="text-center">
         <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-green-500 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">Excellent Work!</h3>
        <p className="mt-1 text-md text-gray-500 dark:text-brand-subtle">
            Our AI reviewer found no issues in the provided changes. Keep up the great coding!
        </p>
    </div>
);


export const FeedbackPanel: React.FC<FeedbackPanelProps> = (props) => {
  const { feedback, mrDetails, isLoading, error, onPostComment, onPostAllComments, onToggleIgnoreFeedback, ...handlers } = props;
  const [currentCommentIndex, setCurrentCommentIndex] = useState(-1);

  const feedbackByFile = useMemo(() => {
    if (!feedback) return new Map<string, ReviewFeedback[]>();
    return feedback.reduce((acc, item) => {
        const fileFeedback = acc.get(item.filePath) || [];
        fileFeedback.push(item);
        acc.set(item.filePath, fileFeedback);
        return acc;
    }, new Map<string, ReviewFeedback[]>());
  }, [feedback]);

  const pendingComments = useMemo(() => {
    if (!feedback) return [];
    return feedback.filter(f => f.status === 'pending' && f.severity !== 'Info' && !f.isEditing && !f.isIgnored);
  }, [feedback]);

  useEffect(() => {
    setCurrentCommentIndex(-1);
  }, [feedback]);

  const handleNavigate = (direction: 'up' | 'down') => {
    if (pendingComments.length === 0) return;

    let nextIndex;
    if (direction === 'down') {
      nextIndex = (currentCommentIndex + 1) % pendingComments.length;
    } else {
      nextIndex = (currentCommentIndex - 1 + pendingComments.length) % pendingComments.length;
    }

    setCurrentCommentIndex(nextIndex);

    const targetId = pendingComments[nextIndex]?.id;
    if (targetId) {
      const element = document.getElementById(`feedback-wrapper-${targetId}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const activeFeedbackId = currentCommentIndex > -1 ? pendingComments[currentCommentIndex]?.id : null;
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-lg text-gray-500 dark:text-brand-subtle">AI is thinking...</p>
          <p className="text-sm text-gray-500/70 dark:text-brand-subtle/70">Analyzing your merge request for quality and improvements.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-4 rounded-lg">
          <h3 className="font-bold">An Error Occurred</h3>
          <p>{error}</p>
        </div>
      );
    }
    
    if (!mrDetails) {
        return <div className="flex items-center justify-center h-full"><InitialState /></div>;
    }

    // Determine if we should show the "No Issues Found" message. This can happen if the AI finds nothing,
    // or if the only feedback item is the "No Code Changes" info message.
    const shouldShowNoIssuesMessage = !feedback || feedback.length === 0 || (feedback.length === 1 && feedback[0].severity === Severity.Info && feedback[0].status === 'submitted');

    return (
      <div className="space-y-4">
        {pendingComments.length > 0 && (
            <div className="p-3 bg-gray-100/80 dark:bg-brand-primary/50 rounded-lg flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
                <p className="text-sm text-gray-600 dark:text-brand-subtle">{pendingComments.length} comments to post.</p>
                <div className="flex items-center space-x-4">
                     <div className="flex items-center space-x-2">
                         <span className="text-sm font-mono text-gray-500 dark:text-brand-subtle w-14 text-center">
                           {currentCommentIndex > -1 ? `${String(currentCommentIndex + 1).padStart(2, '0')}` : '--'}/{`${String(pendingComments.length).padStart(2, '0')}`}
                         </span>
                        <button onClick={() => handleNavigate('up')} className="p-1 rounded-md bg-gray-200 dark:bg-brand-primary hover:bg-brand-secondary text-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed" disabled={pendingComments.length === 0} aria-label="Previous comment">
                            <ArrowUpIcon/>
                        </button>
                        <button onClick={() => handleNavigate('down')} className="p-1 rounded-md bg-gray-200 dark:bg-brand-primary hover:bg-brand-secondary text-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed" disabled={pendingComments.length === 0} aria-label="Next comment">
                            <ArrowDownIcon/>
                        </button>
                    </div>
                    <button 
                        onClick={onPostAllComments}
                        className="bg-brand-secondary hover:bg-red-600 text-white text-sm font-bold py-2 px-4 rounded-md transition-colors"
                    >
                        Add All Comments
                    </button>
                </div>
            </div>
        )}

        {/* Show the "No Issues" message as a banner if there's no feedback, but always show the diffs below */}
        {shouldShowNoIssuesMessage && (!mrDetails.parsedDiffs || mrDetails.parsedDiffs.length === 0) && (
            <div className="flex items-center justify-center py-10">
                <NoIssuesFound />
            </div>
        )}

        {mrDetails.parsedDiffs.map((fileDiff) => (
          <FileDiffCard
            key={fileDiff.filePath}
            fileDiff={fileDiff}
            feedbackForFile={feedbackByFile.get(fileDiff.filePath) || []}
            onPostComment={onPostComment}
            activeFeedbackId={activeFeedbackId}
            mrDetails={mrDetails}
            onToggleIgnoreFeedback={onToggleIgnoreFeedback}
            {...handlers}
          />
        ))}
      </div>
    );
  };
  
  return (
    <div className="bg-white dark:bg-brand-surface rounded-lg shadow-xl h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-brand-primary">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Review Feedback</h2>
      </div>
      <div className="p-1 sm:p-4 flex-grow overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {renderContent()}
      </div>
    </div>
  );
};
