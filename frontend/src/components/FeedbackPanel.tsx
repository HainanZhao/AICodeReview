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
import { FeedbackCard } from './FeedbackCard';
import { CombinedFeedbackCard, FileDiffCard } from './FileDiffCard';
import { Spinner } from './Spinner';
import { type ViewMode, ViewModeToggle } from './ViewModeToggle';
import { ApproveIcon, ArrowDownIcon, ArrowUpIcon, CheckmarkIcon } from './icons';

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
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#00f0ff]/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#ff2a6d]/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative mb-10 group">
        <div className="absolute inset-0 rounded-full border-2 border-[#00f0ff]/20 scale-150 animate-ping opacity-30" />
        <div className="absolute inset-0 rounded-full border border-[#00f0ff]/10 scale-[2] animate-ping opacity-15 delay-700" />

        <div className="relative p-8 cyber-card cyber-card--interactive rounded-full border-2 border-[#00f0ff] shadow-[0_0_30px_rgba(0,240,255,0.3)] transform transition-transform group-hover:scale-105 duration-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-20 w-20 text-[#00f0ff]"
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
        <h3
          className="cyber-glitch text-3xl font-extrabold text-[#00f0ff] tracking-tight"
          data-text="AWAITING TARGET"
        >
          AWAITING TARGET
        </h3>
        <p className="max-w-md mx-auto text-[15px] font-medium text-[#b4b4b4] leading-relaxed">
          The intelligence engine is on standby. Select a Merge Request from the workspace dashboard
          to initiate deep code analysis.
        </p>
      </div>

      <div className="mt-16 grid grid-cols-4 gap-4 opacity-30">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-1 w-16 bg-[#00f0ff] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00f0ff] animate-progress"
              style={{ animationDelay: `${i * 150}ms`, width: '100%' }}
            />
          </div>
        ))}
      </div>

      <div className="mt-12 flex items-center space-x-3 text-[11px] font-bold text-[#05ffa1] uppercase tracking-[0.2em]">
        <span className="w-2 h-2 rounded-full bg-[#05ffa1] animate-pulse shadow-[0_0_10px_#05ffa1]" />
        <span>NEURAL CORE ONLINE</span>
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
      className="mx-auto h-16 w-16 text-[#05ffa1]"
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
    <h3 className="mt-2 text-base font-semibold text-[#05ffa1]">EXCELLENT WORK!</h3>
    <p className="mt-1 text-sm text-[#b4b4b4]">
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
  const [setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  // Listen for theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
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
          <div className="text-[#a1a1aa] text-center">
            <p className="uppercase tracking-widest text-[10px] font-bold">
              {/* // NO_MR_DETAILS_LOADED */}
            </p>
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
      <div className="space-y-6">
        {/* Display general MR comments first */}
        {generalComments.length > 0 && (
          <div className="space-y-3 mb-6">
            <h3 className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-widest ml-1">
              {/* // GENERAL FEEDBACK */}
            </h3>
            {/* Render pending (new AI) feedbacks individually */}
            {generalComments
              .filter((item) => item.status === 'pending')
              .map((item) => (
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

            {/* Render all submitted (existing) feedbacks grouped together */}
            {(() => {
              const submittedGeneral = generalComments.filter(
                (item) => item.status === 'submitted'
              );
              if (submittedGeneral.length === 0) return null;
              return (
                <CombinedFeedbackCard
                  feedbacks={submittedGeneral}
                  onPostComment={onPostComment}
                  onUpdateFeedback={handlers.onUpdateFeedback}
                  onDeleteFeedback={handlers.onDeleteFeedback}
                  onSetEditing={handlers.onSetEditing}
                  onToggleIgnoreFeedback={onToggleIgnoreFeedback}
                  activeFeedbackId={activeFeedbackId}
                />
              );
            })()}
          </div>
        )}

        {/* Show the "No Issues" message as a banner if there's no feedback, but always show the diffs below */}
        {shouldShowNoIssuesMessage &&
          (!mrDetails.parsedDiffs || mrDetails.parsedDiffs.length === 0) && (
            <div className="flex items-center justify-center py-20">
              <NoIssuesFound />
            </div>
          )}

        {mrDetails.parsedDiffs.map((fileDiff) => {
          const feedbackForThisFile = feedbackByFile.get(fileDiff.filePath) || [];

          return (
            <div key={fileDiff.filePath} className="mb-8">
              <FileDiffCard
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
            </div>
          );
        })}
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading && !isAiAnalyzing) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center py-20">
          <Spinner size="lg" />
          <p className="mt-6 text-[14px] font-bold text-[#00f0ff] cyber-text-glow uppercase tracking-widest animate-pulse">
            LOADING MR_DATASTREAM...
          </p>
          <p className="mt-2 text-[10px] text-[#a1a1aa] font-mono uppercase tracking-tighter">
            ESTABLISHING CONNECTION TO GITLAB CORE
          </p>
        </div>
      );
    }

    if (isLoading && isAiAnalyzing) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center py-20">
          <Spinner size="lg" />
          <p className="mt-6 text-[14px] font-bold text-[#ff2a6d] cyber-text-glow uppercase tracking-widest animate-pulse">
            AI_ANALYSIS IN PROGRESS...
          </p>
          <p className="mt-2 text-[10px] text-[#a1a1aa] font-mono uppercase tracking-tighter">
            SCANNING CODEBLOCKS FOR ANOMALIES
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
          <div className="space-y-6">
            <div className="cyber-card cyber-neon-border--magenta bg-[#ff2a6d]/10 p-4 shadow-[0_0_15px_rgba(255,42,109,0.1)]">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-[#ff2a6d]" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-[11px] font-bold text-[#ff2a6d] uppercase tracking-widest mb-1" >Error</h3>
                  <p className="text-[12px] text-[#ececec] font-mono leading-snug">{error}</p>
                  <p className="mt-2 text-[10px] text-[#a1a1aa] font-bold uppercase tracking-tight italic">
                    {/* MANUAL REVIEW INTERFACE ACTIVE. AI_SUBSYSTEMS OFFLINE. */}
                  </p>
                </div>
                {onClearError && (
                  <div className="ml-auto pl-3">
                    <button
                      onClick={onClearError}
                      className="cyber-btn cyber-btn--ghost cyber-btn--xs opacity-70 hover:opacity-100"
                      aria-label="Dismiss error"
                    >
                      X
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
        <div className="text-center py-20 cyber-card cyber-neon-border--magenta bg-[#ff2a6d]/10 m-4">
          <h3
            className="font-bold text-[#ff2a6d] cyber-glitch uppercase tracking-widest text-lg"
            data-text="CRITICAL_SYSTEM_FAILURE"
          >
            CRITICAL_SYSTEM_FAILURE
          </h3>
          <p className="mt-4 text-[12px] text-[#ececec] font-mono max-w-md mx-auto">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-8 cyber-btn cyber-btn--magenta cyber-btn--sm"
          >
            REBOOT_SYSTEM
          </button>
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
    <div className="h-full flex flex-col bg-transparent">
      <div className="border-b border-[#ececec]/10 flex items-center justify-between px-4 py-2">
        <div className="flex items-center space-x-4">
          <h2 className="text-sm font-bold text-[#ececec]">Review</h2>
          <ViewModeToggle currentMode={globalViewMode} onModeChange={handleGlobalViewModeChange} />
          {pendingComments.length > 0 && (
            <div className="flex items-center space-x-2 px-2 py-1 bg-[#05ffa1]/10">
              <span className="text-[10px] font-bold text-[#05ffa1]">
                {pendingComments.length} pending
              </span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => handleNavigate('up')}
                  className="p-0.5 text-[#05ffa1]/60 hover:text-[#05ffa1] disabled:opacity-20"
                  disabled={pendingComments.length === 0}
                  aria-label="Previous comment"
                >
                  <ArrowUpIcon className="w-3 h-3" />
                </button>
                <span className="text-[10px] text-[#05ffa1]">
                  {currentCommentIndex > -1 ? `${currentCommentIndex + 1}` : '--'}/
                  {pendingComments.length}
                </span>
                <button
                  onClick={() => handleNavigate('down')}
                  className="p-0.5 text-[#05ffa1]/60 hover:text-[#05ffa1] disabled:opacity-20"
                  disabled={pendingComments.length === 0}
                  aria-label="Next comment"
                >
                  <ArrowDownIcon className="w-3 h-3" />
                </button>
              </div>
              <button
                onClick={onPostAllComments}
                className="px-2 py-0.5 text-[10px] font-bold bg-[#05ffa1]/20 text-[#05ffa1] hover:bg-[#05ffa1]/30 transition-colors"
              >
                Submit
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {onRedoReview && !isAiAnalyzing && mrDetails && (
            <button
              onClick={onRedoReview}
              className="px-2 py-1 text-[10px] font-bold text-[#a1a1aa] hover:text-[#00f0ff] transition-colors"
              aria-label="Redo review"
            >
              Re-scan
            </button>
          )}
          {isAiAnalyzing && (
            <div className="flex items-center space-x-2 text-[#a1a1aa]">
              <Spinner size="sm" />
              <span className="text-[10px]">Analyzing...</span>
            </div>
          )}
          {mrDetails &&
            (onApproveMR || onRevokeApproval) &&
            (() => {
              const isApproved = mrDetails.approvals && mrDetails.approvals.approved_by.length > 0;

              if (isApproved && onRevokeApproval) {
                return (
                  <div className="flex items-center space-x-3">
                    <div className="px-3 py-1 flex items-center bg-[#05ffa1]/10 text-[#05ffa1] border border-[#05ffa1]/30 text-[10px] font-bold uppercase tracking-widest shadow-[0_0_10px_rgba(5,255,161,0.1)]">
                      <CheckmarkIcon className="w-3.5 h-3.5 mr-2" />
                      <span>APPROVED</span>
                    </div>
                    <button
                      onClick={onRevokeApproval}
                      disabled={isRevokingApproval}
                      className="cyber-btn cyber-btn--magenta cyber-btn--xs"
                      aria-label="Revoke approval"
                    >
                      {isRevokingApproval ? (
                        <>
                          <Spinner size="sm" />
                          <span className="ml-2">REVOKING...</span>
                        </>
                      ) : (
                        <>
                          <span className="mr-2">X</span>
                          <span>REVOKE</span>
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
                    className="cyber-btn cyber-btn--green cyber-btn--xs"
                    aria-label="Approve merge request"
                  >
                    {isApprovingMR ? (
                      <>
                        <Spinner size="sm" />
                        <span className="ml-2">APPROVING...</span>
                      </>
                    ) : (
                      <>
                        <ApproveIcon className="w-3.5 h-3.5 mr-2" />
                        <span>APPROVE_MR</span>
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
        className="p-1 sm:p-5 flex-grow overflow-y-auto bg-transparent scrollbar-cyber"
        style={{ maxHeight: 'calc(100vh - 120px)' }}
      >
        {renderContent()}
      </div>
    </div>
  );
};
