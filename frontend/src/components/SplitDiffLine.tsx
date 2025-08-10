import React from 'react';
import { explainLine } from '../services/aiReviewService';
import { ParsedDiffLine } from '../types';
import { ExplanationPopup } from './ExplanationPopup';
import { AIExplainIcon, PlusIcon } from './icons';
import { SyntaxHighlightedCode } from './SyntaxHighlightedCode';

interface SplitDiffLineProps {
  leftLine?: ParsedDiffLine;
  rightLine?: ParsedDiffLine;
  onAddComment: (line: ParsedDiffLine, side: 'left' | 'right') => void;
  filePath?: string;
  fileContent?: string;
  oldFileContent?: string;
}

const getLineClasses = (type?: ParsedDiffLine['type']) => {
  switch (type) {
    case 'add':
      return 'bg-green-100/50 dark:bg-green-900/20 text-green-800 dark:text-green-300';
    case 'remove':
      return 'bg-red-100/50 dark:bg-red-900/20 text-red-800 dark:text-red-400';
    case 'meta':
      return 'bg-blue-100/50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
    case 'context':
      return 'bg-transparent text-gray-500 dark:text-brand-subtle';
    default:
      return 'bg-gray-50 dark:bg-brand-primary/10 text-gray-400 dark:text-brand-subtle';
  }
};

const SplitDiffSide: React.FC<{
  line?: ParsedDiffLine;
  side: 'left' | 'right';
  onAddComment: () => void;
  onExplainClick: (event: React.MouseEvent, line: ParsedDiffLine) => void;
  filePath: string;
  isDarkMode: boolean;
}> = ({ line, side, onAddComment, onExplainClick, filePath, isDarkMode }) => {
  const lineClasses = getLineClasses(line?.type);
  const canComment =
    line && (line.type === 'add' || line.type === 'remove' || line.type === 'context');
  const canExplain = line && line.type !== 'meta' && line.content.trim().length > 0;

  const lineNumber = side === 'left' ? line?.oldLine : line?.newLine;
  const prefix = line?.type === 'add' ? '+' : line?.type === 'remove' ? '-' : ' ';

  return (
    <td
      className={`w-1/2 border-r border-gray-200 dark:border-brand-primary/30 ${lineClasses} group hover:bg-black/5 dark:hover:bg-white/10`}
    >
      <div className="flex">
        {/* Action buttons */}
        <div className="w-12 flex items-center justify-center pl-2">
          <div className="flex items-center justify-center space-x-1">
            {/* Add comment button */}
            {canComment && (
              <button
                onClick={onAddComment}
                title="Add comment"
                className="opacity-0 bg-brand-secondary text-white rounded-full p-[3px] leading-none shadow-lg hover:bg-red-600 transition-opacity duration-150 group-hover:opacity-100"
              >
                <PlusIcon className="w-3 h-3" />
              </button>
            )}

            {/* AI Explain button */}
            {canExplain && line && (
              <button
                onClick={(e) => onExplainClick(e, line)}
                title="AI Explain this line"
                className="opacity-0 bg-purple-600 text-white rounded-full p-[3px] leading-none shadow-lg hover:bg-purple-700 transition-opacity duration-150 group-hover:opacity-100"
              >
                <AIExplainIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Line number */}
        <div className="w-10 text-right px-1 select-none opacity-70 text-xs">
          {lineNumber || ''}
        </div>

        {/* Line content */}
        <div className="flex-1 pr-2 font-mono text-xs">
          {line ? (
            <>
              {line.type !== 'meta' && <span className="mr-1 select-none">{prefix}</span>}
              <SyntaxHighlightedCode
                code={line.content}
                filePath={filePath}
                isDarkMode={isDarkMode}
                className="whitespace-pre-wrap break-words bg-transparent"
              />
            </>
          ) : (
            <div className="h-4">&nbsp;</div>
          )}
        </div>
      </div>
    </td>
  );
};

export const SplitDiffLine: React.FC<SplitDiffLineProps> = ({
  leftLine,
  rightLine,
  onAddComment,
  filePath = 'unknown',
  fileContent,
  oldFileContent,
}) => {
  // Detect dark mode from document class
  const isDarkMode = React.useMemo(() => {
    return document.documentElement.classList.contains('dark');
  }, []);

  // AI Explain state
  const [showExplanation, setShowExplanation] = React.useState(false);
  const [explanation, setExplanation] = React.useState('');
  const [isLoadingExplanation, setIsLoadingExplanation] = React.useState(false);
  const [explanationError, setExplanationError] = React.useState<string | undefined>();
  const [popupPosition, setPopupPosition] = React.useState({ x: 0, y: 0 });
  const [currentExplainLine, setCurrentExplainLine] = React.useState<ParsedDiffLine | null>(null);

  const handleExplainClick = async (event: React.MouseEvent, line: ParsedDiffLine) => {
    event.stopPropagation();

    // Set popup position near the click
    const rect = event.currentTarget.getBoundingClientRect();
    setPopupPosition({
      x: rect.right + 10,
      y: rect.top,
    });

    setCurrentExplainLine(line);
    setShowExplanation(true);
    setIsLoadingExplanation(true);
    setExplanationError(undefined);
    setExplanation('');

    try {
      // For deleted lines, use old file content; for other lines, use new file content
      const contentToUse = line.type === 'remove' ? (oldFileContent ?? '') : (fileContent ?? '');
      const lineNumberToUse = line.type === 'remove' ? line.oldLine : line.newLine || line.oldLine;

      const result = await explainLine(line.content, filePath, lineNumberToUse, contentToUse, 5);
      setExplanation(result);
    } catch (error) {
      setExplanationError(error instanceof Error ? error.message : 'Failed to get explanation');
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  const handleCloseExplanation = () => {
    setShowExplanation(false);
    setExplanation('');
    setExplanationError(undefined);
    setCurrentExplainLine(null);
  };

  // Close popup when clicking outside or pressing Escape
  React.useEffect(() => {
    if (!showExplanation) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const popupElement = document.querySelector(
        '[role="dialog"][aria-labelledby="explanation-popup-title"]'
      );

      if (popupElement && !popupElement.contains(target)) {
        setShowExplanation(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowExplanation(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showExplanation]);

  return (
    <>
      <tr className="h-4">
        <SplitDiffSide
          line={leftLine}
          side="left"
          onAddComment={() => leftLine && onAddComment(leftLine, 'left')}
          onExplainClick={handleExplainClick}
          filePath={filePath}
          isDarkMode={isDarkMode}
        />
        <SplitDiffSide
          line={rightLine}
          side="right"
          onAddComment={() => rightLine && onAddComment(rightLine, 'right')}
          onExplainClick={handleExplainClick}
          filePath={filePath}
          isDarkMode={isDarkMode}
        />
      </tr>

      {/* AI Explanation Popup */}
      {showExplanation && currentExplainLine && (
        <ExplanationPopup
          explanation={explanation}
          lineContent={currentExplainLine.content}
          filePath={filePath}
          isLoading={isLoadingExplanation}
          error={explanationError}
          onClose={handleCloseExplanation}
          position={popupPosition}
        />
      )}
    </>
  );
};
