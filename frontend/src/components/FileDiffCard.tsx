import React, { useState, useMemo } from 'react';
import {
  ParsedFileDiff,
  ReviewFeedback,
  ParsedDiffLine,
  Severity,
  ParsedHunk,
  GitLabMRDetails,
} from '../types';
import { ChevronDownIcon, ChevronUpIcon, AddCommentIcon } from './icons';
import { DiffLine } from './DiffLine';
import { FeedbackCard } from './FeedbackCard';

interface FileDiffCardProps {
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
}

const HunkHeader: React.FC<{ hunk: ParsedHunk; onClick: () => void }> = ({ hunk, onClick }) => (
  <tr className="bg-blue-50 dark:bg-blue-900/30 sticky top-0 z-[1]">
    <td colSpan={4} className="p-0">
      <button
        onClick={onClick}
        className="w-full flex items-center p-2 text-left hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
      >
        {hunk.isCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
        <span className="ml-2 font-mono text-xs text-blue-600 dark:text-blue-300 select-all">
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
      <td colSpan={4} className="text-center p-0">
        <button
          onClick={onClick}
          className="w-full text-center py-1 text-xs text-gray-500 dark:text-brand-subtle bg-gray-100/50 dark:bg-brand-primary/20 hover:bg-gray-200 dark:hover:bg-brand-primary/50 transition-colors"
        >
          <ChevronDownIcon className="inline-block h-4 w-4 mr-2" />
          Expand {hiddenLineCount} hidden lines
        </button>
      </td>
    </tr>
  );
};

export const FileDiffCard: React.FC<FileDiffCardProps> = (props) => {
  const {
    fileDiff,
    feedbackForFile,
    onPostComment,
    activeFeedbackId,
    mrDetails,
    onToggleIgnoreFeedback,
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
        } else if (fb.position) {
          // Check if this position actually exists in the diff
          const positionExists = fileDiff.hunks.some((hunk) =>
            hunk.lines.some((line) => {
              const matchesNewLine = fb.position?.new_line && line.newLine === fb.position.new_line;
              const matchesOldLine = fb.position?.old_line && line.oldLine === fb.position.old_line;
              return matchesNewLine || matchesOldLine;
            })
          );

          console.log(`Position check for feedback ${fb.id}:`, {
            lineNumber: fb.lineNumber,
            position: fb.position,
            positionExists,
          });

          if (positionExists) {
            // Position is valid, show as inline comment
            // Handle cases where old_line or new_line might be missing
            let key = `${fb.position.old_line || ''}_${fb.position.new_line || ''}`;

            // If we only have new_line, try to find the corresponding old_line in the hunks
            if (!fb.position.old_line && fb.position.new_line) {
              const matchingLine = fileDiff.hunks
                .flatMap((hunk) => hunk.lines)
                .find((line) => line.newLine === fb.position?.new_line);

              if (matchingLine && matchingLine.oldLine) {
                key = `${matchingLine.oldLine}_${fb.position.new_line}`;
                console.log(
                  `Updated key from "_${fb.position.new_line}" to "${key}" using hunk data`
                );
              }
            }

            // If we only have old_line, try to find the corresponding new_line in the hunks
            if (fb.position.old_line && !fb.position.new_line) {
              const matchingLine = fileDiff.hunks
                .flatMap((hunk) => hunk.lines)
                .find((line) => line.oldLine === fb.position?.old_line);

              if (matchingLine && matchingLine.newLine) {
                key = `${fb.position.old_line}_${matchingLine.newLine}`;
                console.log(
                  `Updated key from "${fb.position.old_line}_" to "${key}" using hunk data`
                );
              }
            }

            const existing = lineLevel.get(key) || [];
            existing.push(fb);
            lineLevel.set(key, existing);
            console.log(`Added to lineLevel with key "${key}":`, {
              id: fb.id,
              title: fb.title,
              position: fb.position,
              existingCount: existing.length,
            });
          } else {
            // Position not found in diff, but let's try to find a nearby line based on lineNumber
            // This handles cases where AI line numbers are slightly off
            const nearbyLine = fileDiff.hunks
              .flatMap((hunk) => hunk.lines)
              .find((line) => {
                // Try to match by line number with a small tolerance
                const lineNum = fb.lineNumber;
                return (
                  (line.newLine && Math.abs(line.newLine - lineNum) <= 1) ||
                  (line.oldLine && Math.abs(line.oldLine - lineNum) <= 1)
                );
              });

            if (nearbyLine) {
              console.log(`Found nearby line for feedback ${fb.id}:`, {
                originalLineNumber: fb.lineNumber,
                nearbyLine: {
                  oldLine: nearbyLine.oldLine,
                  newLine: nearbyLine.newLine,
                  content: nearbyLine.content.substring(0, 50),
                },
              });

              // Use the nearby line's position
              const key = `${nearbyLine.oldLine || ''}_${nearbyLine.newLine || ''}`;
              const existing = lineLevel.get(key) || [];
              existing.push(fb);
              lineLevel.set(key, existing);
              console.log(`Added to lineLevel with nearby key "${key}"`);
            } else {
              // Position not found in diff, treat as file-level comment
              // This handles cases where the AI suggested a line that doesn't exist in the actual diff
              console.log(
                `Comment for ${fb.filePath}:${fb.lineNumber} not found in diff hunks, showing as file-level comment`,
                { position: fb.position, title: fb.title }
              );
              fileLevel.push(fb);
            }
          }
        } else {
          // Has lineNumber but no position - treat as file-level comment
          // This handles cases where inline posting failed and was posted as general comment
          console.log(
            `Comment for ${fb.filePath}:${fb.lineNumber} has no position, showing as file-level comment`,
            { title: fb.title }
          );
          fileLevel.push(fb);
        }
      }
    }

    // Debug logging to help troubleshoot missing comments
    if (feedbackForFile && feedbackForFile.length > 0) {
      console.log(`FileDiffCard for ${fileDiff.filePath}:`, {
        totalFeedback: feedbackForFile.length,
        fileLevelCount: fileLevel.length,
        lineLevelCount: lineLevel.size,
        feedbackItems: feedbackForFile.map((fb) => ({
          id: fb.id,
          lineNumber: fb.lineNumber,
          hasPosition: !!fb.position,
          title: fb.title,
          status: fb.status,
        })),
      });

      // Log all available hunk lines for comparison
      const allHunkLines = fileDiff.hunks.flatMap((hunk, hunkIdx) =>
        hunk.lines.map((line, lineIdx) => ({
          hunkIndex: hunkIdx,
          lineIndex: lineIdx,
          oldLine: line.oldLine,
          newLine: line.newLine,
          type: line.type,
          key: `${line.oldLine || ''}_${line.newLine || ''}`,
          content: line.content.substring(0, 30),
        }))
      );
      console.log(`Available hunk lines for ${fileDiff.filePath}:`, allHunkLines);
      console.log(`Line level map keys:`, Array.from(lineLevel.keys()));
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

  const fileContents = mrDetails.fileContents.get(fileDiff.filePath);
  const newFileContentLines = fileContents?.newContent || [];

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
            const key = `${line.oldLine || ''}_${line.newLine || ''}`;
            const feedbackItems = lineLevelFeedbackMap.get(key) || [];
            // Show all feedback items (both pending and submitted/existing)
            const allFeedbackItems = feedbackItems;

            // Debug logging for key matching
            if (feedbackItems.length > 0) {
              console.log(
                `Found ${feedbackItems.length} feedback items for key "${key}" at line:`,
                {
                  oldLine: line.oldLine,
                  newLine: line.newLine,
                  content: line.content.substring(0, 50),
                  feedbackIds: feedbackItems.map((fb) => fb.id),
                }
              );
            }

            elements.push(
              <React.Fragment key={`${fileDiff.filePath}-${hunkIndex}-${lineIndex}`}>
                <DiffLine
                  line={line}
                  onAddComment={() => handlers.onAddCustomFeedback(fileDiff, line)}
                />
                {allFeedbackItems.map((fb) => {
                  const isActive = fb.id === activeFeedbackId;
                  return (
                    <tr
                      key={fb.id}
                      id={`feedback-wrapper-${fb.id}`}
                      className={`transition-colors duration-300 ${isActive ? 'bg-blue-100/50 dark:bg-brand-primary/40' : 'bg-white dark:bg-brand-surface'}`}
                    >
                      <td className="text-brand-secondary align-top text-center pt-1 pl-1">
                        <AddCommentIcon />
                      </td>
                      <td colSpan={3} className="p-0.5">
                        <FeedbackCard
                          feedback={fb}
                          onPostComment={onPostComment}
                          onToggleIgnoreFeedback={onToggleIgnoreFeedback}
                          {...handlers}
                        />
                      </td>
                    </tr>
                  );
                })}
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
            />
          );
        }
      } else {
        elements.push(
          <GapExpanderRow
            key={`gap-expander-final`}
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
      className="border border-gray-200 dark:border-brand-primary/50 rounded-lg bg-gray-50/50 dark:bg-brand-primary/20 overflow-hidden transition-all duration-300"
      data-file-path={fileDiff.filePath}
    >
      <div className="w-full flex items-center justify-between p-3 text-left bg-gray-100 dark:bg-brand-primary/30 border-b border-gray-200 dark:border-brand-primary/50">
        <div className="flex items-center space-x-3 truncate">
          <span
            className="font-mono text-sm text-gray-800 dark:text-brand-text font-semibold truncate"
            title={filePathDisplay}
          >
            {filePathDisplay}
          </span>
          {fileDiff.isNew && (
            <span className="text-xs font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded-full flex-shrink-0">
              ADDED
            </span>
          )}
          {fileDiff.isDeleted && (
            <span className="text-xs font-bold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded-full flex-shrink-0">
              DELETED
            </span>
          )}
          {fileDiff.isRenamed && (
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full flex-shrink-0">
              RENAMED
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2 font-mono text-sm flex-shrink-0">
          <span className="text-green-600 dark:text-green-400 font-bold">+{additions}</span>
          <span className="text-red-600 dark:text-red-400 font-bold">-{deletions}</span>
        </div>
      </div>
      {fileLevelFeedback.length > 0 && (
        <div className="p-4 border-b border-gray-200 dark:border-brand-primary/50 bg-white dark:bg-brand-surface space-y-4 text-sm">
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
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-sm border-separate" style={{ borderSpacing: 0 }}>
          <tbody>{renderFileContent()}</tbody>
        </table>
      </div>
    </div>
  );
};
