import React from 'react';
import { explainLine } from '../services/aiReviewService';
import { ParsedDiffLine } from '../types';
import { ExplanationPopup } from './ExplanationPopup';
import { AIExplainIcon, PlusIcon } from './icons';
import { SyntaxHighlightedCode } from './SyntaxHighlightedCode';

interface DiffLineProps {
  line: ParsedDiffLine;
  onAddComment: () => void;
  filePath?: string;
  fileContent?: string;
  oldFileContent?: string;
}

const getLineClasses = (type: ParsedDiffLine['type']) => {
  switch (type) {
    case 'add':
      return 'bg-green-100/50 dark:bg-green-900/20 text-green-800 dark:text-green-300';
    case 'remove':
      return 'bg-red-100/50 dark:bg-red-900/20 text-red-800 dark:text-red-400';
    case 'meta':
      return 'bg-blue-100/50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
    default:
      return 'bg-transparent text-gray-500 dark:text-brand-subtle';
  }
};

export const DiffLine: React.FC<DiffLineProps> = ({
  line,
  onAddComment,
  filePath = 'unknown',
  fileContent,
  oldFileContent,
}) => {
  const lineClasses = getLineClasses(line.type);
  const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
  const canComment = line.type === 'add' || line.type === 'remove' || line.type === 'context';
  const canExplain = line.type !== 'meta' && line.content.trim().length > 0;

  // Detect dark mode from document class
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  // Listen for theme changes
  React.useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          setIsDarkMode(document.documentElement.classList.contains('dark'));
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // AI Explain state
  const [showExplanation, setShowExplanation] = React.useState(false);
  const [explanation, setExplanation] = React.useState('');
  const [isLoadingExplanation, setIsLoadingExplanation] = React.useState(false);
  const [explanationError, setExplanationError] = React.useState<string | undefined>();
  const [popupPosition, setPopupPosition] = React.useState({ x: 0, y: 0 });

  const handleExplainClick = async (event: React.MouseEvent) => {
    if (!canExplain) return;

    event.stopPropagation();

    // Set popup position near the click
    const rect = event.currentTarget.getBoundingClientRect();
    setPopupPosition({
      x: rect.right + 10,
      y: rect.top,
    });

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
  };

  // Close popup when clicking outside or pressing Escape
  React.useEffect(() => {
    if (!showExplanation) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click is outside the popup
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
      <tr className={`${lineClasses} group hover:bg-black/5 dark:hover:bg-white/10 h-4`}>
        <td className="w-8 text-center align-middle h-4">
          {/* Action buttons container */}
          <div className="flex items-center justify-center space-x-1">
            {/* Add comment button */}
            <button
              onClick={onAddComment}
              title={canComment ? 'Add comment' : ''}
              disabled={!canComment}
              className={`
                        opacity-0 bg-brand-secondary text-white rounded-full p-[3px] leading-none shadow-lg hover:bg-red-600 transition-opacity duration-150
                        ${canComment ? 'group-hover:opacity-100' : 'pointer-events-none'}
                      `}
            >
              <PlusIcon className="w-3 h-3" />
            </button>

            {/* AI Explain button */}
            {canExplain && (
              <button
                onClick={handleExplainClick}
                title="AI Explain this line"
                className="opacity-0 bg-purple-600 text-white rounded-full p-[3px] leading-none shadow-lg hover:bg-purple-700 transition-opacity duration-150 group-hover:opacity-100"
              >
                <AIExplainIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        </td>
        <td className="w-10 text-right px-1 select-none opacity-70 align-middle h-4 text-xs">
          {line.oldLine || ''}
        </td>
        <td className="w-10 text-right px-1 select-none opacity-70 align-middle h-4 text-xs">
          {line.newLine || ''}
        </td>
        <td className="w-full pr-2 align-middle font-mono text-xs h-4">
          {line.type !== 'meta' && <span className="mr-1 select-none">{prefix}</span>}
          <SyntaxHighlightedCode
            code={line.content}
            filePath={filePath}
            isDarkMode={isDarkMode}
            className="whitespace-pre-wrap break-words bg-transparent"
          />
        </td>
      </tr>

      {/* AI Explanation Popup */}
      {showExplanation && (
        <ExplanationPopup
          explanation={explanation}
          lineContent={line.content}
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
