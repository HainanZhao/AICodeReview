import React, { useEffect, useMemo, useState } from 'react';
import {
  GitLabMRDetails,
  ParsedFileDiff,
  ParsedHunk,
  ReviewFeedback,
  Severity,
} from '../../../types';
import { ParsedDiffLine } from '../types';
import { getStoredViewMode, setStoredViewMode } from '../utils/viewModeStorage';
import { FeedbackCard } from './FeedbackCard';
import { FileDiffCard } from './FileDiffCard';
import { ApproveIcon, ArrowDownIcon, ArrowUpIcon, CheckmarkIcon, RefreshIcon } from './icons';
import { Spinner } from './Spinner';
import { SyntaxHighlightedCode } from './SyntaxHighlightedCode';
import { ViewMode, ViewModeToggle } from './ViewModeToggle';

interface FeedbackPanelProps {
  codeTheme?: string;
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
  isApprovingMR?: boolean;
  isRevokingApproval?: boolean;
  onApproveMR?: () => void;
  onRevokeApproval?: () => void;
  onClearError?: () => void;
}

const InitialState = ({ codeTheme, isDarkMode }: { codeTheme?: string, isDarkMode?: boolean }) => {
  const sampleCode = `interface User {
  id: number;
  name: string;
  email?: string;
}

const createUser = (data: Partial<User>): User => {
  return {
    id: Date.now(),
    name: data.name || 'Anonymous',
    ...data
  };
};

// Example usage
const user = createUser({ 
  name: 'John Doe', 
  email: 'john@example.com' 
});
console.log('Created user:', user);`;

  return (
    <div className="text-center space-y-6">
      <div>
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
      
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-brand-surface border border-gray-200 dark:border-brand-primary rounded-lg overflow-hidden">
          <div className="bg-gray-100 dark:bg-brand-primary px-4 py-2 border-b border-gray-200 dark:border-brand-primary">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-gray-800 dark:text-white">
                example.tsx
              </span>
              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                TypeScript
              </span>
            </div>
          </div>
          <div className="bg-white dark:bg-brand-surface p-4 overflow-x-auto">
            <pre className="font-mono text-sm">
              <SyntaxHighlightedCode
                code={sampleCode}
                filePath="example.tsx"
                isDarkMode={isDarkMode}
                codeTheme={codeTheme}
                className="whitespace-pre-wrap"
              />
            </pre>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-brand-subtle mt-2">
          Preview: Syntax highlighting theme is active. Select a theme from the header dropdown to test different styles.
        </p>
      </div>
    </div>
  );
};

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
    codeTheme,
    feedback,
    mrDetails,
    isLoading,
    error,
    onPostComment,
    onPostAllComments,
    onToggleIgnoreFeedback,
    isAiAnalyzing,
    isApprovingMR,
    isRevokingApproval,
    onApproveMR,
    onRevokeApproval,
    onRedoReview,
    onClearError,
    ...handlers
  } = props;
  const [currentCommentIndex, setCurrentCommentIndex] = useState(-1);
  const [globalViewMode, setGlobalViewMode] = useState<ViewMode>(() => getStoredViewMode());
  
  // Detect dark mode from document class
  const [isDarkMode, setIsDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  );
  
  // Listen for theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const handleGlobalViewModeChange = (newMode: ViewMode) => {
    setGlobalViewMode(newMode);
    setStoredViewMode(newMode);
  };

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
          const direction =
            comment.lineNumber <
            (bestHunk as { hunk: ParsedHunk; hunkIndex: number }).hunk.newStartLine
              ? 'up'
              : 'down';
          const linesToExpand = Math.min(minDistance + 5, 20); // Expand enough to show the line plus some context, max 20 lines

          handlers.onExpandHunkContext(comment.filePath, hunkIndex, direction, linesToExpand);
        }
      }
    });
  }, [feedback, mrDetails, handlers]);

  const pendingComments = useMemo(() => {
    if (!feedback || !mrDetails) return []; // Need mrDetails for file order

    const pending = feedback.filter(
      (f: ReviewFeedback) => f.status === 'pending' && !f.isEditing && !f.isIgnored
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

  const renderMainContent = () => {
    if (!mrDetails) {
      return (
        <div className="flex items-center justify-center py-10">
          <div className="text-gray-500 dark:text-brand-subtle text-center">
            <p>No MR details available</p>
          </div>
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
          <div className="p-3 bg-white/20 dark:bg-gray-900/20 border border-white/30 dark:border-gray-700/30 rounded-xl flex items-center justify-between sticky top-0 z-10 backdrop-blur-md shadow-lg shadow-black/5 dark:shadow-black/20">
            <p className="text-sm text-orange-800 dark:text-orange-300 font-semibold px-2 py-1">
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
          <div className="space-y-2 mb-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-brand-subtle mb-2">
              General Comments
            </h3>
            {generalComments.map((item) => (
              <FeedbackCard
                key={item.id}
                feedback={item}
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
              codeTheme={props.codeTheme}
              fileDiff={fileDiff}
              feedbackForFile={feedbackForThisFile}
              onPostComment={onPostComment}
              activeFeedbackId={activeFeedbackId}
              mrDetails={mrDetails}
              onToggleIgnoreFeedback={onToggleIgnoreFeedback}
              viewMode={globalViewMode}
              {...handlers}
            />
          );
        })}
      </div>
    );
  };

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
      // Check if this is an AI review error but MR details are available for manual review
      const isAiErrorWithManualReview = error.includes('AI Review Error:') && mrDetails;

      if (isAiErrorWithManualReview) {
        // Show a dismissible warning but allow manual review to continue
        return (
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 rounded-lg shadow-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                    You can still review the code manually and add comments below.
                  </p>
                </div>
                {onClearError && (
                  <div className="ml-auto pl-3">
                    <button
                      onClick={onClearError}
                      className="inline-flex rounded-md bg-red-50 dark:bg-red-900/30 p-1.5 text-red-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
                      aria-label="Dismiss error"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
            {renderMainContent()}
          </div>
        );
      }

      // Critical error - show full error screen
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
          <InitialState codeTheme={codeTheme} isDarkMode={isDarkMode} />
        </div>
      );
    }

    return renderMainContent();
  };

  return (
    <div className="bg-white dark:bg-brand-surface rounded-lg shadow-xl h-full flex flex-col">
      <div className="border-b border-gray-200 dark:border-brand-primary flex items-center justify-between px-4 py-2">
        <div className="flex items-center space-x-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Review Feedback</h2>
          <ViewModeToggle currentMode={globalViewMode} onModeChange={handleGlobalViewModeChange} />
        </div>
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
          {mrDetails &&
            (onApproveMR || onRevokeApproval) &&
            (() => {
              const isApproved = mrDetails.approvals && mrDetails.approvals.approved_by.length > 0;

              if (isApproved && onRevokeApproval) {
                return (
                  <div className="flex items-center space-x-2">
                    <div className="h-[28px] px-2.5 flex items-center bg-green-200/80 dark:bg-green-800/40 text-green-900 dark:text-green-200 rounded text-sm font-medium">
                      <CheckmarkIcon className="w-4 h-4 mr-1.5" />
                      <span>Approved</span>
                    </div>
                    <button
                      onClick={onRevokeApproval}
                      disabled={isRevokingApproval}
                      className="h-[28px] px-2.5 flex items-center bg-red-100/50 dark:bg-red-900/20 text-red-800 dark:text-red-300 group hover:bg-black/5 dark:hover:bg-white/10 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Revoke approval"
                    >
                      {isRevokingApproval ? (
                        <>
                          <Spinner size="sm" />
                          <span className="ml-1.5">Revoking...</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4 mr-1.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                          <span>Revoke</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              }

              if (!isApproved && onApproveMR) {
                return (
                  <button
                    onClick={onApproveMR}
                    disabled={isApprovingMR}
                    className="h-[28px] px-2.5 flex items-center bg-green-100/50 dark:bg-green-900/20 text-green-800 dark:text-green-300 group hover:bg-black/5 dark:hover:bg-white/10 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Approve merge request"
                  >
                    {isApprovingMR ? (
                      <>
                        <Spinner size="sm" />
                        <span className="ml-1.5">Approving...</span>
                      </>
                    ) : (
                      <>
                        <ApproveIcon className="w-4 h-4 mr-1.5" />
                        <span>Approve MR</span>
                      </>
                    )}
                  </button>
                );
              }

              return null;
            })()}
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
