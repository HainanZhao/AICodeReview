import type React from 'react';
import type {
  GitLabMRDetails,
  ParsedDiffLine,
  ParsedFileDiff,
  ReviewFeedback,
  Severity,
} from '../types';
import { FeedbackCard } from './FeedbackCard';
import { CombinedFeedbackCard, SEVERITY_CONFIG } from './FileDiffCard';
import { SplitDiffLine } from './SplitDiffLine';
import { AddCommentIcon, ChevronDownIcon } from './icons';

interface SplitDiffViewProps {
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
  onToggleIgnoreFeedback: (id: string) => void;
  lineLevelFeedbackMap: Map<string, ReviewFeedback[]>;
  expandedGaps: [number, number][];
  onExpandGap: (startLine: number, endLine: number) => void;
  isGapExpanded: (startLine: number, endLine: number) => boolean;
}

const GapExpanderRow: React.FC<{ hiddenLineCount: number; onClick: () => void }> = ({
  hiddenLineCount,
  onClick,
}) => {
  if (hiddenLineCount <= 0) return null;
  return (
    <tr className="group">
      <td colSpan={2} className="text-center p-0">
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

// Helper function to create split line pairs from hunk lines
const createSplitLinePairs = (
  lines: ParsedDiffLine[]
): Array<{
  left?: ParsedDiffLine;
  right?: ParsedDiffLine;
  key: string;
}> => {
  const pairs: Array<{ left?: ParsedDiffLine; right?: ParsedDiffLine; key: string }> = [];
  let leftIndex = 0;
  let rightIndex = 0;

  // First pass: handle removed and added lines
  const removedLines: ParsedDiffLine[] = [];
  const addedLines: ParsedDiffLine[] = [];

  for (const line of lines) {
    if (line.type === 'remove') {
      removedLines.push(line);
    } else if (line.type === 'add') {
      addedLines.push(line);
    } else if (line.type === 'context') {
      // Process any pending removed/added lines first
      const maxPending = Math.max(removedLines.length, addedLines.length);
      for (let i = 0; i < maxPending; i++) {
        pairs.push({
          left: removedLines[i],
          right: addedLines[i],
          key: `pair-${leftIndex++}-${rightIndex++}`,
        });
      }
      removedLines.length = 0;
      addedLines.length = 0;

      // Add context line
      pairs.push({
        left: line,
        right: line,
        key: `context-${line.oldLine}-${line.newLine}`,
      });
    }
  }

  // Process any remaining removed/added lines
  const maxRemaining = Math.max(removedLines.length, addedLines.length);
  for (let i = 0; i < maxRemaining; i++) {
    pairs.push({
      left: removedLines[i],
      right: addedLines[i],
      key: `final-pair-${leftIndex++}-${rightIndex++}`,
    });
  }

  return pairs;
};

export const SplitDiffView: React.FC<SplitDiffViewProps> = ({
  codeTheme,
  fileDiff,
  // biome-ignore lint/correctness/noUnusedVariables: Part of interface, may be used in future
  feedbackForFile,
  onPostComment,
  activeFeedbackId,
  mrDetails,
  onUpdateFeedback,
  onDeleteFeedback,
  onSetEditing,
  onAddCustomFeedback,
  onToggleIgnoreFeedback,
  lineLevelFeedbackMap,
  // biome-ignore lint/correctness/noUnusedVariables: Part of interface, may be used in future
  expandedGaps,
  onExpandGap,
  isGapExpanded,
}) => {
  const fileContents = mrDetails.fileContents[fileDiff.filePath];
  const newFileContentLines = fileContents?.newContent || [];
  const oldFileContentLines = fileContents?.oldContent || [];
  const fullFileContent = newFileContentLines.join('\n');
  const fullOldFileContent = oldFileContentLines.join('\n');

  const handleAddComment = (line: ParsedDiffLine, _side: 'left' | 'right') => {
    onAddCustomFeedback(fileDiff, line);
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
            };
            elements.push(
              <SplitDiffLine
                key={`gap-${gapStartLine}-line-${i}`}
                leftLine={line}
                rightLine={line}
                onAddComment={handleAddComment}
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
              onClick={() => onExpandGap(gapStartLine, gapEndLine)}
            />
          );
        }
      }

      // --- 2. Render Hunk Lines ---
      const linePairs = createSplitLinePairs(hunk.lines.filter((l) => l.type !== 'meta'));

      linePairs.forEach((pair, pairIndex) => {
        // Add the split diff line
        elements.push(
          <SplitDiffLine
            key={`${fileDiff.filePath}-${hunkIndex}-${pairIndex}`}
            leftLine={pair.left}
            rightLine={pair.right}
            onAddComment={handleAddComment}
            filePath={fileDiff.filePath}
            fileContent={fullFileContent}
            oldFileContent={fullOldFileContent}
            codeTheme={codeTheme}
          />
        );

        // Add feedback for lines in this pair
        const feedbacksToShow: ReviewFeedback[] = [];
        const seenFeedbackIds = new Set<string>();

        // Check for feedback on left line (removed lines)
        if (pair.left?.newLine) {
          const leftKey = pair.left.newLine.toString();
          const leftFeedbacks = lineLevelFeedbackMap.get(leftKey) || [];
          leftFeedbacks.forEach((fb) => {
            if (!seenFeedbackIds.has(fb.id)) {
              feedbacksToShow.push(fb);
              seenFeedbackIds.add(fb.id);
            }
          });
        }

        // Check for feedback on right line (added/context lines)
        if (pair.right?.newLine) {
          const rightKey = pair.right.newLine.toString();
          const rightFeedbacks = lineLevelFeedbackMap.get(rightKey) || [];
          rightFeedbacks.forEach((fb) => {
            if (!seenFeedbackIds.has(fb.id)) {
              feedbacksToShow.push(fb);
              seenFeedbackIds.add(fb.id);
            }
          });
        }

        // Render feedback cards - span across both panes for better visibility
        if (feedbacksToShow.length === 1) {
          const feedback = feedbacksToShow[0];
          const isActive = feedback.id === activeFeedbackId;
          elements.push(
            <tr
              key={`feedback-${feedback.id}`}
              id={`feedback-wrapper-${feedback.id}`}
              className={`transition-colors duration-300 ${
                isActive
                  ? 'bg-blue-100/50 dark:bg-brand-primary/40'
                  : 'bg-white dark:bg-brand-surface'
              }`}
            >
              <td colSpan={2} className="py-1 px-2">
                <div className="flex items-start space-x-2">
                  <div className="text-brand-secondary mt-1 flex-shrink-0">
                    <AddCommentIcon />
                  </div>
                  <div className="flex-1">
                    <FeedbackCard
                      feedback={feedback}
                      onPostComment={onPostComment}
                      onToggleIgnoreFeedback={onToggleIgnoreFeedback}
                      onUpdateFeedback={onUpdateFeedback}
                      onDeleteFeedback={onDeleteFeedback}
                      onSetEditing={onSetEditing}
                    />
                  </div>
                </div>
              </td>
            </tr>
          );
        } else if (feedbacksToShow.length > 1) {
          elements.push(
            <tr
              key={`feedback-combined-${pair.left?.newLine || pair.right?.newLine}`}
              className="bg-white dark:bg-brand-surface"
            >
              <td colSpan={2} className="py-1 px-2">
                <div className="flex items-start space-x-2">
                  <div className="text-brand-secondary mt-1 flex-shrink-0">
                    <AddCommentIcon />
                  </div>
                  <div className="flex-1">
                    <CombinedFeedbackCard
                      feedbacks={feedbacksToShow}
                      onPostComment={onPostComment}
                      onUpdateFeedback={onUpdateFeedback}
                      onDeleteFeedback={onDeleteFeedback}
                      onSetEditing={onSetEditing}
                      onToggleIgnoreFeedback={onToggleIgnoreFeedback}
                      activeFeedbackId={activeFeedbackId}
                    />
                  </div>
                </div>
              </td>
            </tr>
          );
        }
      });

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
          };
          elements.push(
            <SplitDiffLine
              key={`gap-final-line-${i}`}
              leftLine={line}
              rightLine={line}
              onAddComment={handleAddComment}
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
            key="gap-expander-final"
            hiddenLineCount={finalGapSize}
            onClick={() => onExpandGap(finalGapStartLine, finalGapEndLine)}
          />
        );
      }
    }

    return elements;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-sm border-separate" style={{ borderSpacing: 0 }}>
        <tbody>{renderFileContent()}</tbody>
      </table>
    </div>
  );
};
