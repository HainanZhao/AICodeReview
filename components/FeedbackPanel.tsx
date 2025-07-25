import React, { useMemo, useState, useEffect } from 'react';
import {
  ReviewFeedback,
  GitLabMRDetails,
  ParsedFileDiff,
  ParsedDiffLine,
  Severity,
} from '../shared/src/types';
import { FileDiffCard } from './FileDiffCard';
import { FeedbackCard } from './FeedbackCard';
import { Spinner } from './Spinner';
import { ArrowUpIcon, ArrowDownIcon, ApproveIcon, RefreshIcon } from './icons';

interface FeedbackPanelProps {
  onRedoReview?: () => void;
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
  onExpandHunkContext: (
    filePath: string,
    hunkIndex: number,
    direction: 'up' | 'down',
    lines: number
  ) => void;
  onToggleIgnoreFeedback: (id: string) => void;
  isAiAnalyzing: boolean;
  onApproveMR?: () => Promise<void>;
}

const InitialState = () => (
  <div className="text-center">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto h-16 w-16 text-gray-300 dark:text-brand-primary"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.94,10.94a1,1,0,0,0-1.42,0l-2.29,2.29a1.44,1.44,0,0,0-.41,1V16.5a.5.5,0,0,0,.5.5h2.25a1.44,1.44,0,0,0,1-.41l2.29-2.29a1,1,0,0,0,0-1.42Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.06,13.06a1,1,0,0,0,1.42,0l2.29-2.29a1.44,1.44,0,0,0,.41-1V7.5a.5.5,0,0,0-.5-.5H7.41a1.44,1.44,0,0,0-1,.41L4.09,9.68a1,1,0,0,0,0,1.42Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12,3a9,9,0,0,0-9,9,1,1,0,0,0,1,1h.5a1,1,0,0,1,1,1v.5a1,1,0,0,0,1,1h5a1,1,0,0,0,1-1v-.5a1,1,0,0,1,1-1h.5a1,1,0,0,0,1-1A9,9,0,0,0,12,3Z"
      />
    </svg>
    <h3 className="mt-2 text-base font-semibold text-gray-900 dark:text-white">
      Awaiting Analysis
    </h3>
    <p className="mt-1 text-sm text-gray-500 dark:text-brand-subtle">
      Select a Merge Request from the dashboard to begin.
    </p>
  </div>
);

const NoIssuesFound = () => (
  <div className="text-center">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto h-16 w-16 text-green-500 dark:text-green-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
    <h3 className="mt-2 text-base font-semibold text-gray-900 dark:text-white">Excellent Work!</h3>
    <p className="mt-1 text-sm text-gray-500 dark:text-brand-subtle">
      Our AI reviewer found no issues in the provided changes. Keep up the great coding!
    </p>
  </div>
);

export const FeedbackPanel: React.FC<FeedbackPanelProps> = (props) => {
  const {
    feedback,
    mrDetails,
    isLoading,
    error,
    onPostComment,
    onPostAllComments,
    onToggleIgnoreFeedback,
    isAiAnalyzing,
    onApproveMR,
    onRedoReview,
    ...handlers
  } = props;
  const [currentCommentIndex, setCurrentCommentIndex] = useState(-1);

  const feedbackByFile = useMemo(() => {
    const result = new Map<string, ReviewFeedback[]>();

    // Add all feedback (including existing feedback from GitLab which is already in feedback state)
    if (feedback) {
      feedback.forEach((item) => {
        const fileFeedback = result.get(item.filePath) || [];
        fileFeedback.push(item);
        result.set(item.filePath, fileFeedback);
      });
    }

    return result;
  }, [feedback]);

  const generalComments = useMemo(() => {
    const general = feedbackByFile.get('') || [];
    return general;
  }, [feedbackByFile]);

  // Auto-expand hunks to show lines with AI comments
  useEffect(() => {
    if (!mrDetails || !feedback) return;

    feedback.forEach((comment) => {
      // Only auto-expand for new AI comments (pending status)
      if (comment.status !== 'pending' || comment.lineNumber === 0) return;

      const fileDiff = mrDetails.parsedDiffs.find((f) => f.filePath === comment.filePath);
      if (!fileDiff) return;

      // Check if the comment line is visible in any hunk
      const isLineVisible = fileDiff.hunks.some((hunk) =>
        hunk.lines.some((line) => line.newLine === comment.lineNumber)
      );

      if (!isLineVisible) {
        // Find the best hunk to expand (closest to the comment line)
        let bestHunk: { hunk: ParsedHunk; hunkIndex: number } | null = null;
        let minDistance = Infinity;

        fileDiff.hunks.forEach((hunk, hunkIndex) => {
          const hunkStart = hunk.newStartLine;
          const hunkEnd = hunk.newStartLine + hunk.newLineCount - 1;

          let distance;
          if (comment.lineNumber < hunkStart) {
            distance = hunkStart - comment.lineNumber;
          } else if (comment.lineNumber > hunkEnd) {
            distance = comment.lineNumber - hunkEnd;
          } else {
            distance = 0; // Line is within hunk (shouldn't happen if we got here)
          }

          if (distance < minDistance) {
            minDistance = distance;
            bestHunk = { hunk, hunkIndex };
          }
        });

        if (bestHunk && minDistance > 0) {
          const { hunkIndex } = bestHunk;
          const direction = comment.lineNumber < bestHunk.hunk.newStartLine ? 'up' : 'down';
          const linesToExpand = Math.min(minDistance + 5, 20); // Expand enough to show the line plus some context, max 20 lines

          handlers.onExpandHunkContext(comment.filePath, hunkIndex, direction, linesToExpand);
        }
      }
    });
  }, [feedback, mrDetails, handlers]);

  const pendingComments = useMemo(() => {
    if (!feedback || !mrDetails) return []; // Need mrDetails for file order

    const pending = feedback.filter(
      (f: ReviewFeedback) =>
        f.status === 'pending' && f.severity !== 'Info' && !f.isEditing && !f.isIgnored
    );

    // Sort comments based on their visual order
    pending.sort((a, b) => {
      // 1. General comments first (filePath === '')
      if (a.filePath === '' && b.filePath !== '') return -1;
      if (a.filePath !== '' && b.filePath === '') return 1;

      // 2. If both are general comments, no specific order (they are rendered together)
      if (a.filePath === '' && b.filePath === '') return 0;

      // 3. For file-specific comments, sort by file path order as they appear in parsedDiffs
      const fileAIndex = mrDetails.parsedDiffs.findIndex((diff) => diff.filePath === a.filePath);
      const fileBIndex = mrDetails.parsedDiffs.findIndex((diff) => diff.filePath === b.filePath);

      if (fileAIndex !== fileBIndex) {
        return fileAIndex - fileBIndex;
      }

      // 4. Within the same file, sort by lineNumber (0 for general file comments first)
      return a.lineNumber - b.lineNumber;
    });

    return pending;
  }, [feedback, mrDetails]); // Add mrDetails to dependencies

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

  const activeFeedbackId =
    currentCommentIndex > -1 ? pendingComments[currentCommentIndex]?.id : null;

  const renderContent = () => {
    if (isLoading && !isAiAnalyzing) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-lg text-gray-500 dark:text-brand-subtle">Loading MR details...</p>
          <p className="text-sm text-gray-500/70 dark:text-brand-subtle/70">
            Fetching merge request information.
          </p>
        </div>
      );
    }

    if (isLoading && isAiAnalyzing) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-lg text-gray-500 dark:text-brand-subtle">AI is thinking...</p>
          <p className="text-sm text-gray-500/70 dark:text-brand-subtle/70">
            Analyzing your merge request for quality and improvements.
          </p>
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
      return (
        <div className="flex items-center justify-center h-full">
          <InitialState />
        </div>
      );
    }

    // Determine if we should show the "No Issues Found" message. This can happen if the AI finds nothing,
    // or if the only feedback item is the "No Code Changes" info message.
    const shouldShowNoIssuesMessage =
      !feedback ||
      feedback.length === 0 ||
      (feedback.length === 1 &&
        feedback[0].severity === Severity.Info &&
        feedback[0].status === 'submitted');

    return (
      <div className="space-y-1.5">
        {pendingComments.length > 0 && (
          <div className="p-1.5 bg-gray-100/80 dark:bg-brand-primary/50 rounded-lg flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
            <p className="text-xs text-gray-600 dark:text-brand-subtle">
              {pendingComments.length} comments to post.
            </p>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <span className="text-xs font-mono text-gray-500 dark:text-brand-subtle w-10 text-center">
                  {currentCommentIndex > -1
                    ? `${String(currentCommentIndex + 1).padStart(2, '0')}`
                    : '--'}
                  /{`${String(pendingComments.length).padStart(2, '0')}`}
                </span>
                <button
                  onClick={() => handleNavigate('up')}
                  className="p-0.5 rounded-md bg-gray-200 dark:bg-brand-primary hover:bg-brand-secondary text-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={pendingComments.length === 0}
                  aria-label="Previous comment"
                >
                  <ArrowUpIcon />
                </button>
                <button
                  onClick={() => handleNavigate('down')}
                  className="p-0.5 rounded-md bg-gray-200 dark:bg-brand-primary hover:bg-brand-secondary text-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={pendingComments.length === 0}
                  aria-label="Next comment"
                >
                  <ArrowDownIcon />
                </button>
              </div>
              <button
                onClick={onPostAllComments}
                className="bg-brand-secondary hover:bg-red-600 text-white text-xs font-semibold py-1 px-2 rounded-md transition-colors"
              >
                Add All Comments
              </button>
            </div>
          </div>
        )}

        {/* Display general MR comments first */}
        {generalComments.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 px-2">
              General Comments
            </h3>
            {generalComments.map((comment) => (
              <FeedbackCard
                key={comment.id}
                feedback={comment}
                onPostComment={onPostComment}
                onUpdateFeedback={handlers.onUpdateFeedback}
                onDeleteFeedback={handlers.onDeleteFeedback}
                onSetEditing={handlers.onSetEditing}
                onToggleIgnoreFeedback={onToggleIgnoreFeedback}
              />
            ))}
          </div>
        )}

        {/* Show the "No Issues" message as a banner if there's no feedback, but always show the diffs below */}
        {shouldShowNoIssuesMessage &&
          (!mrDetails.parsedDiffs || mrDetails.parsedDiffs.length === 0) && (
            <div className="flex items-center justify-center py-10">
              <NoIssuesFound />
            </div>
          )}

        {mrDetails.parsedDiffs.map((fileDiff) => {
          const feedbackForThisFile = feedbackByFile.get(fileDiff.filePath) || [];

          return (
            <FileDiffCard
              key={fileDiff.filePath}
              fileDiff={fileDiff}
              feedbackForFile={feedbackForThisFile}
              onPostComment={onPostComment}
              activeFeedbackId={activeFeedbackId}
              mrDetails={mrDetails}
              onToggleIgnoreFeedback={onToggleIgnoreFeedback}
              {...handlers}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-brand-surface rounded-lg shadow-xl h-full flex flex-col">
      <div className="border-b border-gray-200 dark:border-brand-primary flex items-center justify-between px-4 py-2">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Review Feedback</h2>
        <div className="flex items-center space-x-4">
          {onRedoReview && !isAiAnalyzing && mrDetails && (
            <button
              onClick={onRedoReview}
              className="h-[28px] px-2.5 flex items-center bg-gray-100 dark:bg-brand-primary text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-brand-secondary rounded text-sm font-medium transition-colors"
              aria-label="Redo review"
            >
              <RefreshIcon className="w-4 h-4 mr-1.5" />
              <span>Redo Review</span>
            </button>
          )}
          {isAiAnalyzing && (
            <div className="flex items-center space-x-2 text-brand-secondary">
              <Spinner size="sm" />
              <span className="text-sm font-medium">AI Analyzing...</span>
            </div>
          )}
          {mrDetails && onApproveMR && (
            <button
              onClick={onApproveMR}
              className="h-[28px] px-2.5 flex items-center bg-green-100/50 dark:bg-green-900/20 text-green-800 dark:text-green-300 group hover:bg-black/5 dark:hover:bg-white/10 rounded text-sm font-medium transition-colors"
              aria-label="Approve merge request"
            >
              <ApproveIcon className="w-4 h-4 mr-1.5" />
              <span>Approve MR</span>
            </button>
          )}
        </div>
      </div>
      <div
        className="p-1 sm:p-4 flex-grow overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 150px)' }}
      >
        {renderContent()}
      </div>
    </div>
  );
};
