import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  type GitLabMRDetails,
  type ParsedFileDiff,
  type ParsedHunk,
  type ReviewFeedback,
  Severity,
} from '../../../types';
import type { ParsedDiffLine } from '../types';
import { getStoredViewMode, setStoredViewMode } from '../utils/viewModeStorage';
import { Button } from './Button';
import { FeedbackCard } from './FeedbackCard';
import { FileDiffCard } from './FileDiffCard';
import { Spinner } from './Spinner';
import { type ViewMode, ViewModeToggle } from './ViewModeToggle';
import { ApproveIcon, ArrowDownIcon, ArrowUpIcon, CheckmarkIcon, RefreshIcon } from './icons';

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

const InitialState = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] text-center px-6 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#1f75cb]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#6b4fbb]/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative mb-10 group">
        {/* Radar/Scanner Animation */}
        <div className="absolute inset-0 rounded-full border-2 border-[#1f75cb]/20 scale-150 animate-ping opacity-20" />
        <div className="absolute inset-0 rounded-full border border-[#1f75cb]/10 scale-[2] animate-ping opacity-10 delay-700" />

        <div className="relative p-8 bg-white dark:bg-[#1f1e24] rounded-full border border-[#dbdbdb] dark:border-[#404040] shadow-xl transform transition-transform group-hover:scale-105 duration-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-20 w-20 text-[#1f75cb] dark:text-[#428fdc]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
            <circle
              cx="12"
              cy="9"
              r="3"
              strokeDasharray="2 2"
              className="animate-spin-slow origin-center"
            />
          </svg>
        </div>
      </div>

      <div className="relative z-10 space-y-4">
        <h3 className="text-3xl font-extrabold text-[#111111] dark:text-[#ececec] tracking-tight">
          Awaiting Target
        </h3>
        <p className="max-w-md mx-auto text-[15px] font-medium text-[#444444] dark:text-[#a1a1aa] leading-relaxed">
          The intelligence engine is on standby. Select a Merge Request from the workspace dashboard
          to initiate deep code analysis.
        </p>
      </div>

      {/* Modern Animated 'Code Grid' Decoration */}
      <div className="mt-16 grid grid-cols-4 gap-4 opacity-20">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="h-1 w-16 bg-[#dbdbdb] dark:bg-[#404040] rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-[#1f75cb] animate-progress"
              style={{ animationDelay: `${i * 150}ms`, width: '100%' }}
            />
          </div>
        ))}
      </div>

      <div className="mt-12 flex items-center space-x-3 text-[11px] font-bold text-[#8c8c8c] dark:text-[#666666] uppercase tracking-[0.2em]">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span>Neural Core Online</span>
      </div>

      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-progress {
          animation: progress 2s infinite linear;
        }
        .animate-spin-slow {
          animation: spin 8s infinite linear;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
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
        let minDistance = Number.POSITIVE_INFINITY;

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
      <div className="space-y-4">
        {pendingComments.length > 0 && (
          <div className="px-3 py-2 bg-brand-secondary/5 dark:bg-brand-secondary/10 rounded-lg border border-brand-secondary/10 dark:border-brand-secondary/20">
            <p className="text-xs font-medium text-brand-secondary">
              {pendingComments.length} review item{pendingComments.length !== 1 ? 's' : ''} ready
              for submission
            </p>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClearError}
                      className="!p-1.5 !text-red-400 hover:!text-red-500 hover:!bg-red-100 dark:hover:!bg-red-900/50"
                      aria-label="Dismiss error"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </Button>
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
          <InitialState />
        </div>
      );
    }

    return renderMainContent();
  };

  return (
    <div className="bg-white dark:bg-brand-surface rounded-lg shadow-xl h-full flex flex-col">
      <div className="border-b border-gray-200 dark:border-brand-primary flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Review Feedback
            </h2>
            {pendingComments.length > 0 && (
              <div className="flex items-center px-2.5 py-1 bg-brand-secondary/10 dark:bg-brand-secondary/20 rounded-full">
                <span className="text-xs font-bold text-brand-secondary">
                  {pendingComments.length}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1.5">pending</span>
              </div>
            )}
          </div>
          <ViewModeToggle currentMode={globalViewMode} onModeChange={handleGlobalViewModeChange} />
        </div>
        <div className="flex items-center space-x-3">
          {pendingComments.length > 0 && (
            <>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleNavigate('up')}
                  disabled={pendingComments.length === 0}
                  className="!p-1"
                  aria-label="Previous comment"
                >
                  <ArrowUpIcon />
                </Button>
                <span className="text-[10px] font-bold font-mono text-gray-500 dark:text-brand-subtle min-w-[45px] text-center">
                  {currentCommentIndex > -1 ? `${currentCommentIndex + 1}` : '-'}/
                  {pendingComments.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleNavigate('down')}
                  disabled={pendingComments.length === 0}
                  className="!p-1"
                  aria-label="Next comment"
                >
                  <ArrowDownIcon />
                </Button>
              </div>
              <Button
                variant="success"
                size="sm"
                onClick={onPostAllComments}
                leftIcon={<CheckmarkIcon className="w-3.5 h-3.5" />}
              >
                Submit All
              </Button>
            </>
          )}
          {onRedoReview && !isAiAnalyzing && mrDetails && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRedoReview}
              leftIcon={<RefreshIcon className="w-4 h-4" />}
            >
              Redo Review
            </Button>
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
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={onRevokeApproval}
                      disabled={isRevokingApproval}
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
                    </Button>
                  </div>
                );
              }

              if (!isApproved && onApproveMR) {
                return (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={onApproveMR}
                    disabled={isApprovingMR}
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
                  </Button>
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
