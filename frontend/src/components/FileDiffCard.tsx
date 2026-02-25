import React, { useMemo, useState } from 'react';
import {
  type GitLabMRDetails,
  type ParsedDiffLine,
  type ParsedFileDiff,
  type ParsedHunk,
  type ReviewFeedback,
  Severity,
} from '../types';
import { Button } from './Button';
import { DiffLine } from './DiffLine';
import { FeedbackCard } from './FeedbackCard';
import { SplitDiffView } from './SplitDiffView';
import type { ViewMode } from './ViewModeToggle';
import { AddCommentIcon, ChevronDownIcon, ChevronUpIcon } from './icons';

interface CombinedFeedbackCardProps {
  feedbacks: ReviewFeedback[];
  onPostComment: (id: string) => void;
  onUpdateFeedback: (id: string, title: string, description: string, severity: Severity) => void;
  onDeleteFeedback: (id: string) => void;
  onSetEditing: (id: string, isEditing: boolean) => void;
  onToggleIgnoreFeedback: (id: string) => void;
  activeFeedbackId?: string | null;
}

export const SEVERITY_CONFIG = {
  [Severity.Critical]: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-3.5 w-3.5 text-[#db3b21]"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M10 2a8 8 0 100 16 8 8 0 000-16zM6.343 6.343a.75.75 0 011.06 0L10 8.94l2.597-2.597a.75.75 0 111.06 1.06L11.06 10l2.597 2.597a.75.75 0 11-1.06 1.06L10 11.06l-2.597 2.597a.75.75 0 01-1.06-1.06L8.94 10 6.343 7.403a.75.75 0 010-1.06z"
          clipRule="evenodd"
        />
      </svg>
    ),
    labelClass: 'text-[#db3b21] bg-[#db3b21]/10',
  },
  [Severity.Warning]: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-3.5 w-3.5 text-[#e75e00]"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.623-1.08 2.041-1.08 2.664 0l5.857 10.143a1.625 1.625 0 01-1.332 2.458H3.732a1.625 1.625 0 01-1.332-2.458L8.257 3.099zM10 12.5a1 1 0 100-2 1 1 0 000 2zm0-5a1 1 0 00-1 1v2a1 1 0 102 0V8.5a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
    labelClass: 'text-[#e75e00] bg-[#e75e00]/10',
  },
  [Severity.Suggestion]: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-3.5 w-3.5 text-[#1f75cb]"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.657a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 14.95a1 1 0 001.414 1.414l.707-.707a1 1 0 00-1.414-1.414l-.707.707zM4 10a1 1 0 01-1-1H2a1 1 0 110-2h1a1 1 0 011 1zM10 18a1 1 0 001-1v-1a1 1 0 10-2 0v1a1 1 0 001 1zM8.94 6.553a1 1 0 00-1.88 0l-1.023 2.046A3.5 3.5 0 005.5 12.5a1.5 1.5 0 003 0 3.5 3.5 0 00-1.477-2.901L8.94 6.553zM12 11.5a1.5 1.5 0 01-3 0 3.5 3.5 0 015.953-2.901l-1.023-2.046a1 1 0 01-1.88 0L12 6.553V11.5z" />
      </svg>
    ),
    labelClass: 'text-[#1f75cb] bg-[#1f75cb]/10',
  },
  [Severity.Info]: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-3.5 w-3.5 text-[#444444] dark:text-[#a1a1aa]"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    ),
    labelClass: 'text-[#444444] dark:text-[#a1a1aa] bg-gray-100 dark:bg-gray-800',
  },
};

export const CombinedFeedbackCard: React.FC<CombinedFeedbackCardProps> = ({
  feedbacks,
  onPostComment,
  onSetEditing,
  onToggleIgnoreFeedback,
  activeFeedbackId,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const pendingCount = feedbacks.filter((f) => f.status === 'pending').length;
  const submittedCount = feedbacks.filter((f) => f.status === 'submitted').length;

  const highestSeverity = useMemo(() => {
    const order = [Severity.Critical, Severity.Warning, Severity.Suggestion, Severity.Info];
    return feedbacks.reduce((highest, fb) => {
      return order.indexOf(fb.severity) < order.indexOf(highest) ? fb.severity : highest;
    }, feedbacks[0].severity);
  }, [feedbacks]);

  const severityConfig: Record<Severity, { labelClass: string; bgClass: string }> = {
    [Severity.Critical]: {
      labelClass: 'text-[#db3b21] bg-[#db3b21]/10',
      bgClass: 'bg-[#db3b21]/5',
    },
    [Severity.Warning]: { labelClass: 'text-[#e75e00] bg-[#e75e00]/10', bgClass: 'bg-[#e75e00]/5' },
    [Severity.Suggestion]: {
      labelClass: 'text-[#1f75cb] bg-[#1f75cb]/10',
      bgClass: 'bg-[#1f75cb]/5',
    },
    [Severity.Info]: {
      labelClass: 'text-[#444444] dark:text-[#a1a1aa] bg-gray-100 dark:bg-gray-800',
      bgClass: 'bg-gray-50 dark:bg-gray-800/50',
    },
  };

  const config = severityConfig[highestSeverity];

  return (
    <div className="bg-white dark:bg-[#1f1e24] border border-[#dbdbdb] dark:border-[#404040] rounded-lg overflow-hidden mb-2 shadow-md hover:shadow-lg transition-all duration-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-[#fafafa] dark:hover:bg-[#252529] transition-colors"
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          <div
            className={`w-6 h-6 rounded-full ${config.bgClass} flex items-center justify-center text-xs font-bold ${config.labelClass}`}
          >
            {feedbacks.length}
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-[12px] font-bold text-[#111111] dark:text-[#ececec] truncate leading-tight">
                {feedbacks.length} {feedbacks.length === 1 ? 'comment' : 'comments'} at this line
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-tight ${config.labelClass}`}
              >
                {highestSeverity}
              </span>
            </div>
            {!isExpanded && (
              <p className="text-[11px] text-[#666666] dark:text-[#a1a1aa] truncate mt-0.5">
                {pendingCount > 0 && `${pendingCount} pending`}
                {pendingCount > 0 && submittedCount > 0 && ' • '}
                {submittedCount > 0 && `${submittedCount} submitted`}
              </p>
            )}
          </div>
        </div>
        <span
          className={`text-[#444444] dark:text-[#a1a1aa] transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {isExpanded && (
        <div className="px-2 pb-2 space-y-0">
          {feedbacks.map((fb, idx) => {
            const isActive = fb.id === activeFeedbackId;
            const fbConfig = SEVERITY_CONFIG[fb.severity];
            const isLast = idx === feedbacks.length - 1;
            return (
              <div
                key={fb.id}
                id={`feedback-wrapper-${fb.id}`}
                className={`py-2 ${!isLast ? 'border-b border-[#e5e5e5] dark:border-[#404040]' : ''} ${isActive ? 'bg-brand-secondary/5 dark:bg-brand-secondary/10 -mx-1 px-1 rounded' : ''}`}
              >
                <div className="flex items-start space-x-2">
                  <div className="flex-shrink-0 mt-0.5">{fbConfig.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-[11px] font-bold text-[#111111] dark:text-[#ececec] truncate">
                        {fb.title}
                      </h4>
                      <span
                        className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-tight ml-2 ${fbConfig.labelClass}`}
                      >
                        {fb.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#444444] dark:text-[#a1a1aa] whitespace-pre-wrap leading-relaxed">
                      {fb.description}
                    </p>
                    {fb.status === 'pending' && !fb.isEditing && (
                      <div className="mt-1.5 flex items-center space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => onSetEditing(fb.id, true)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggleIgnoreFeedback(fb.id)}
                        >
                          Ignore
                        </Button>
                        <Button variant="success" size="sm" onClick={() => onPostComment(fb.id)}>
                          Post
                        </Button>
                      </div>
                    )}
                    {fb.status === 'submitted' && (
                      <div className="mt-1 flex items-center space-x-1 text-[10px] text-[#108548] font-bold">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>Posted to GitLab</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface FileDiffCardProps {
  codeTheme?: string;
  fileDiff: ParsedFileDiff;
  feedbackForFile: ReviewFeedback[];
  onPostComment: (id: string) => void;
  activeFeedbackId: string | null;
  mrDetails: GitLabMRDetails;
  onUpdateFeedback: (id: string, title: string, description: string, severity: Severity) => void;
  onDeleteFeedback: (id: string) => void;
  onSetEditing: (id: string, isEditing: boolean) => void;
  onAddCustomFeedback: (fileDiff: ParsedFileDiff, line: ParsedDiffLine) => void;
  onToggleHunkCollapse: (filePath: string, hunkIndex: number) => void;
  // This prop is no longer used but kept for API consistency with App.tsx for now.
  onExpandHunkContext: (
    filePath: string,
    hunkIndex: number,
    direction: 'up' | 'down',
    lines: number
  ) => void;
  onToggleIgnoreFeedback: (id: string) => void;
  viewMode: ViewMode;
}

const HunkHeader: React.FC<{ hunk: ParsedHunk; onClick: () => void }> = ({ hunk, onClick }) => (
  <tr className="bg-brand-secondary/5 dark:bg-brand-secondary/10 sticky top-0 z-[1] backdrop-blur-md">
    <td colSpan={4} className="p-0 border-y border-brand-secondary/10 dark:border-white/5">
      <button
        onClick={onClick}
        className="w-full flex items-center px-4 py-2 text-left hover:bg-brand-secondary/10 dark:hover:bg-brand-secondary/20 transition-all group"
      >
        <div className="text-brand-secondary transform group-hover:scale-110 transition-transform">
          {hunk.isCollapsed ? (
            <ChevronDownIcon className="w-4 h-4" />
          ) : (
            <ChevronUpIcon className="w-4 h-4" />
          )}
        </div>
        <span className="ml-3 font-mono text-[11px] font-bold select-all text-brand-secondary/70 tracking-tight">
          {hunk.header}
        </span>
      </button>
    </td>
  </tr>
);

const GapExpanderRow: React.FC<{ hiddenLineCount: number; onClick: () => void }> = ({
  hiddenLineCount,
  onClick,
}) => {
  if (hiddenLineCount <= 0) return null;
  return (
    <tr className="group">
      <td colSpan={4} className="p-0">
        <button
          onClick={onClick}
          className="w-full flex items-center justify-center py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-brand-subtle bg-gray-50/50 dark:bg-brand-primary/10 hover:bg-brand-secondary/10 dark:hover:bg-brand-secondary/20 transition-all border-y border-transparent hover:border-brand-secondary/20"
        >
          <div className="flex items-center space-x-3">
            <div className="h-[1px] w-8 bg-gray-200 dark:bg-white/10" />
            <span>Reveal {hiddenLineCount} lines</span>
            <div className="h-[1px] w-8 bg-gray-200 dark:bg-white/10" />
          </div>
        </button>
      </td>
    </tr>
  );
};

export const FileDiffCard: React.FC<FileDiffCardProps> = (props) => {
  const {
    codeTheme,
    fileDiff,
    feedbackForFile,
    onPostComment,
    activeFeedbackId,
    mrDetails,
    onToggleIgnoreFeedback,
    viewMode,
    ...handlers
  } = props;
  const [expandedGaps, setExpandedGaps] = useState<[number, number][]>([]);

  const { fileLevelFeedback, lineLevelFeedbackMap } = useMemo(() => {
    const fileLevel: ReviewFeedback[] = [];
    const lineLevel = new Map<string, ReviewFeedback[]>();

    if (feedbackForFile) {
      for (const fb of feedbackForFile) {
        if (fb.lineNumber === 0) {
          // Explicit file-level comments
          fileLevel.push(fb);
        } else if (fb.position?.new_line) {
          // Use new_line as the key since backend consistently uses new_line
          const key = fb.position.new_line.toString();

          // Check if this new_line exists in the diff
          const lineExists = fileDiff.hunks.some((hunk) =>
            hunk.lines.some((line) => line.newLine === fb.position?.new_line)
          );

          if (lineExists) {
            const existing = lineLevel.get(key) || [];
            existing.push(fb);
            lineLevel.set(key, existing);
          } else {
            // Line not found in diff, treat as file-level comment
            fileLevel.push(fb);
          }
        } else if (fb.lineNumber > 0) {
          // Has lineNumber but no position - try to find matching line in diff
          const matchingLine = fileDiff.hunks
            .flatMap((hunk) => hunk.lines)
            .find((line) => line.newLine === fb.lineNumber);

          if (matchingLine) {
            // Found matching line, use as inline comment
            const key = fb.lineNumber.toString();
            const existing = lineLevel.get(key) || [];
            existing.push(fb);
            lineLevel.set(key, existing);
          } else {
            // No matching line found, treat as file-level comment
            fileLevel.push(fb);
          }
        } else {
          // No position and lineNumber is 0 or negative - treat as file-level comment
          fileLevel.push(fb);
        }
      }
    }

    return { fileLevelFeedback: fileLevel, lineLevelFeedbackMap: lineLevel };
  }, [feedbackForFile, fileDiff.filePath, fileDiff.hunks]);

  const additions = fileDiff.hunks.flatMap((h) => h.lines).filter((l) => l.type === 'add').length;
  const deletions = fileDiff.hunks
    .flatMap((h) => h.lines)
    .filter((l) => l.type === 'remove').length;

  const filePathDisplay = fileDiff.isRenamed
    ? `${fileDiff.oldPath} → ${fileDiff.filePath}`
    : fileDiff.filePath;

  const fileContents = mrDetails.fileContents[fileDiff.filePath];
  const newFileContentLines = fileContents?.newContent || [];
  const oldFileContentLines = fileContents?.oldContent || [];
  const fullFileContent = newFileContentLines.join('\n');
  const fullOldFileContent = oldFileContentLines.join('\n');

  const handleExpandGap = (startLine: number, endLine: number) => {
    setExpandedGaps((prev) => [...prev, [startLine, endLine]]);
  };

  const isGapExpanded = (startLine: number, endLine: number) => {
    return expandedGaps.some(([start, end]) => start === startLine && end === endLine);
  };

  const renderFileContent = () => {
    const elements: React.ReactNode[] = [];
    let lastRenderedNewLine = 0;

    fileDiff.hunks.forEach((hunk, hunkIndex) => {
      // --- 1. Render Gap Before Current Hunk ---
      const gapStartLine = lastRenderedNewLine + 1;
      const gapEndLine = hunk.newStartLine - 1;
      const gapSize = gapEndLine - gapStartLine + 1;

      if (gapSize > 0) {
        if (isGapExpanded(gapStartLine, gapEndLine)) {
          for (let i = gapStartLine; i <= gapEndLine; i++) {
            const line: ParsedDiffLine = {
              type: 'context',
              content: newFileContentLines[i - 1] || '',
              newLine: i,
              oldLine: i,
            }; // Approximation for oldLine
            elements.push(
              <DiffLine
                key={`gap-${gapStartLine}-line-${i}`}
                line={line}
                onAddComment={() => handlers.onAddCustomFeedback(fileDiff, line)}
                filePath={fileDiff.filePath}
                fileContent={fullFileContent}
                oldFileContent={fullOldFileContent}
                codeTheme={codeTheme}
              />
            );
          }
        } else {
          elements.push(
            <GapExpanderRow
              key={`gap-expander-${gapStartLine}`}
              hiddenLineCount={gapSize}
              onClick={() => handleExpandGap(gapStartLine, gapEndLine)}
            />
          );
        }
      }

      // --- 2. Render Hunk ---
      elements.push(
        <HunkHeader
          key={hunk.header}
          hunk={hunk}
          onClick={() => handlers.onToggleHunkCollapse(fileDiff.filePath, hunkIndex)}
        />
      );
      if (!hunk.isCollapsed) {
        hunk.lines
          .filter((l) => l.type !== 'meta')
          .forEach((line, lineIndex) => {
            const key = line.newLine?.toString() || '';
            const feedbackItems = lineLevelFeedbackMap.get(key) || [];
            // Show all feedback items (both pending and submitted/existing)
            const allFeedbackItems = feedbackItems;

            elements.push(
              <React.Fragment key={`${fileDiff.filePath}-${hunkIndex}-${lineIndex}`}>
                <DiffLine
                  line={line}
                  onAddComment={() => handlers.onAddCustomFeedback(fileDiff, line)}
                  filePath={fileDiff.filePath}
                  fileContent={fullFileContent}
                  oldFileContent={fullOldFileContent}
                  codeTheme={codeTheme}
                />
                {allFeedbackItems.length === 1 && (
                  <tr
                    key={allFeedbackItems[0].id}
                    id={`feedback-wrapper-${allFeedbackItems[0].id}`}
                    className={`transition-all duration-500 ${allFeedbackItems[0].id === activeFeedbackId ? 'bg-brand-secondary/5 dark:bg-brand-secondary/10' : 'bg-white dark:bg-brand-surface'}`}
                  >
                    <td className="text-brand-secondary align-top text-center pt-2 pl-2">
                      <div className="w-6 h-6 rounded-full bg-brand-secondary/10 flex items-center justify-center animate-bounce-slow">
                        <AddCommentIcon className="w-3.5 h-3.5" />
                      </div>
                    </td>
                    <td colSpan={3} className="py-1 px-2">
                      <FeedbackCard
                        feedback={allFeedbackItems[0]}
                        onPostComment={onPostComment}
                        onToggleIgnoreFeedback={onToggleIgnoreFeedback}
                        {...handlers}
                      />
                    </td>
                  </tr>
                )}
                {allFeedbackItems.length > 1 && (
                  <tr key={`combined-${key}`} className="bg-white dark:bg-brand-surface">
                    <td className="text-brand-secondary align-top text-center pt-2 pl-2">
                      <div className="w-6 h-6 rounded-full bg-brand-secondary/10 flex items-center justify-center animate-bounce-slow">
                        <AddCommentIcon className="w-3.5 h-3.5" />
                      </div>
                    </td>
                    <td colSpan={3} className="py-1 px-2">
                      <CombinedFeedbackCard
                        feedbacks={allFeedbackItems}
                        onPostComment={onPostComment}
                        onUpdateFeedback={handlers.onUpdateFeedback}
                        onDeleteFeedback={handlers.onDeleteFeedback}
                        onSetEditing={handlers.onSetEditing}
                        onToggleIgnoreFeedback={onToggleIgnoreFeedback}
                        activeFeedbackId={activeFeedbackId}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          });
      }

      // --- 3. Update last rendered line ---
      const lastHunkLine = hunk.lines[hunk.lines.length - 1];
      if (lastHunkLine?.newLine) {
        lastRenderedNewLine = lastHunkLine.newLine;
      } else {
        lastRenderedNewLine = hunk.newStartLine + hunk.newLineCount - 1;
      }
    });

    // --- 4. Render Gap After Last Hunk ---
    const finalGapStartLine = lastRenderedNewLine + 1;
    const finalGapEndLine = newFileContentLines.length;
    const finalGapSize = finalGapEndLine - finalGapStartLine + 1;

    if (finalGapSize > 0) {
      if (isGapExpanded(finalGapStartLine, finalGapEndLine)) {
        for (let i = finalGapStartLine; i <= finalGapEndLine; i++) {
          const line: ParsedDiffLine = {
            type: 'context',
            content: newFileContentLines[i - 1] || '',
            newLine: i,
            oldLine: i,
          }; // Approximation for oldLine
          elements.push(
            <DiffLine
              key={`gap-final-line-${i}`}
              line={line}
              onAddComment={() => handlers.onAddCustomFeedback(fileDiff, line)}
              filePath={fileDiff.filePath}
              fileContent={fullFileContent}
              oldFileContent={fullOldFileContent}
              codeTheme={codeTheme}
            />
          );
        }
      } else {
        elements.push(
          <GapExpanderRow
            key={'gap-expander-final'}
            hiddenLineCount={finalGapSize}
            onClick={() => handleExpandGap(finalGapStartLine, finalGapEndLine)}
          />
        );
      }
    }

    return elements;
  };

  return (
    <div
      className="border border-[#dbdbdb] dark:border-[#404040] rounded bg-white dark:bg-[#18191d] shadow-sm overflow-hidden transition-all duration-300 mb-4 group/card"
      data-file-path={fileDiff.filePath}
    >
      <div className="w-full flex items-center justify-between px-3 py-2 text-left bg-[#fbfbfb] dark:bg-[#1f1e24] border-b border-[#dbdbdb] dark:border-[#404040]">
        <div className="flex items-center space-x-3 truncate">
          <div className="p-1.5 bg-white dark:bg-[#2e2e33] rounded border border-[#dbdbdb] dark:border-[#404040] shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-[#1f75cb] dark:text-[#428fdc]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div className="flex flex-col min-w-0">
            <span
              className="font-mono text-[14px] font-extrabold text-[#111111] dark:text-[#ffffff] truncate tracking-tight"
              title={filePathDisplay}
            >
              {filePathDisplay}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-3 flex-shrink-0">
          <div className="flex items-center space-x-2 font-mono text-[11px] font-bold">
            <span className="text-[#108548]">+{additions}</span>
            <span className="text-[#db3b21]">-{deletions}</span>
          </div>
        </div>
      </div>
      {fileLevelFeedback.length > 0 && (
        <div className="p-3 border-b border-[#dbdbdb] dark:border-[#404040] bg-white dark:bg-[#18191d] space-y-2 text-sm">
          {fileLevelFeedback.map((fb) => {
            const isActive = fb.id === activeFeedbackId;
            const hasLineNumber = fb.lineNumber > 0;
            return (
              <div
                key={fb.id}
                id={`feedback-wrapper-${fb.id}`}
                className={`transition-colors duration-300 rounded-lg ${isActive ? 'ring-2 ring-brand-secondary' : ''}`}
              >
                {hasLineNumber && (
                  <div className="mb-2 flex items-center space-x-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                      📍 Line {fb.lineNumber}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      (shown as file comment due to line positioning)
                    </span>
                  </div>
                )}
                <FeedbackCard
                  feedback={fb}
                  onPostComment={onPostComment}
                  onToggleIgnoreFeedback={onToggleIgnoreFeedback}
                  {...handlers}
                />
              </div>
            );
          })}
        </div>
      )}
      {viewMode === 'inline' ? (
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-sm border-separate" style={{ borderSpacing: 0 }}>
            <tbody>{renderFileContent()}</tbody>
          </table>
        </div>
      ) : (
        <SplitDiffView
          codeTheme={codeTheme}
          fileDiff={fileDiff}
          feedbackForFile={feedbackForFile}
          onPostComment={onPostComment}
          activeFeedbackId={activeFeedbackId}
          mrDetails={mrDetails}
          onUpdateFeedback={handlers.onUpdateFeedback}
          onDeleteFeedback={handlers.onDeleteFeedback}
          onSetEditing={handlers.onSetEditing}
          onAddCustomFeedback={handlers.onAddCustomFeedback}
          onToggleIgnoreFeedback={onToggleIgnoreFeedback}
          lineLevelFeedbackMap={lineLevelFeedbackMap}
          expandedGaps={expandedGaps}
          onExpandGap={handleExpandGap}
          isGapExpanded={isGapExpanded}
        />
      )}
    </div>
  );
};
