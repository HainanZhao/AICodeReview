import React from 'react';
import { explainLine, chat } from '../services/aiReviewService';
import { ParsedDiffLine } from '../types';
import { ChatPopup } from './ChatPopup';
import { AIExplainIcon, PlusIcon } from './icons';

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

  // AI Chat state
  const [showChat, setShowChat] = React.useState(false);
  const [initialMessage, setInitialMessage] = React.useState('');
  const [isLoadingInitialMessage, setIsLoadingInitialMessage] = React.useState(false);
  const [chatError, setChatError] = React.useState<string | undefined>();
  const [popupPosition, setPopupPosition] = React.useState({ x: 0, y: 0 });

  const handleExplainClick = async (event: React.MouseEvent) => {
    if (!canExplain) return;

    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    setPopupPosition({
      x: rect.right + 10,
      y: rect.top,
    });

    setShowChat(true);
    setIsLoadingInitialMessage(true);
    setChatError(undefined);
    setInitialMessage('');

    try {
      const contentToUse = line.type === 'remove' ? oldFileContent ?? '' : fileContent ?? '';
      const lineNumberToUse = line.type === 'remove' ? line.oldLine : line.newLine || line.oldLine;
      const result = await explainLine(line.content, filePath, lineNumberToUse, contentToUse, 5);
      setInitialMessage(result);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Failed to get explanation');
    } finally {
      setIsLoadingInitialMessage(false);
    }
  };

  const handleSendMessage = async (history: { role: 'user' | 'model'; content: string }[]) => {
    const contentToUse = line.type === 'remove' ? oldFileContent ?? '' : fileContent ?? '';
    const lineNumberToUse = line.type === 'remove' ? line.oldLine : line.newLine || line.oldLine;
    return await chat(
      history,
      filePath,
      contentToUse,
      lineNumberToUse,
      line.content,
      5
    );
  };

  const handleCloseChat = () => {
    setShowChat(false);
    setInitialMessage('');
    setChatError(undefined);
  };

  React.useEffect(() => {
    if (!showChat) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (target.closest('[role="dialog"]')) return;
      setShowChat(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowChat(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showChat]);

  return (
    <>
      <tr className={`${lineClasses} group hover:bg-black/5 dark:hover:bg-white/10 h-4`}>
        <td className="w-8 text-center align-middle h-4">
          <div className="flex items-center justify-center space-x-1">
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
          <span className="whitespace-pre-wrap break-words">{line.content}</span>
        </td>
      </tr>

      {showChat && (
        <>
          {isLoadingInitialMessage ? (
            // You can replace this with a more sophisticated loading indicator inside the popup
            <div
              className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-4"
              style={{ left: popupPosition.x, top: popupPosition.y }}
            >
              Loading...
            </div>
          ) : chatError ? (
            <div
              className="fixed z-50 bg-white dark:bg-gray-800 border border-red-500 rounded-lg shadow-lg p-4"
              style={{ left: popupPosition.x, top: popupPosition.y }}
            >
              Error: {chatError}
            </div>
          ) : (
            <ChatPopup
              initialMessage={initialMessage}
              lineContent={line.content}
              filePath={filePath}
              onSendMessage={handleSendMessage}
              onClose={handleCloseChat}
              position={popupPosition}
            />
          )}
        </>
      )}
    </>
  );
};
