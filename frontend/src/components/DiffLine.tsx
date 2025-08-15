import React from 'react';
import { getAiChatResponse } from '../services/aiReviewService';
import { ParsedDiffLine } from '../types';
import { ExplanationPopup } from './ExplanationPopup';
import { ChatMessage } from '../types';
import { AIExplainIcon, PlusIcon } from './icons';
import { SyntaxHighlightedCode } from './SyntaxHighlightedCode';

interface DiffLineProps {
  line: ParsedDiffLine;
  onAddComment: () => void;
  filePath?: string;
  fileContent?: string;
  oldFileContent?: string;
  codeTheme?: string;
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
  codeTheme,
}) => {
  const lineClasses = getLineClasses(line.type);
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

  // AI Chat state
  const [showChat, setShowChat] = React.useState(false);
  const [chatHistory, setChatHistory] = React.useState<ChatMessage[]>([]);
  const [isLoadingResponse, setIsLoadingResponse] = React.useState(false);
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
    setIsLoadingResponse(true);
    setChatError(undefined);
    setChatHistory([]);

    try {
      const contentToUse = line.type === 'remove' ? (oldFileContent ?? '') : (fileContent ?? '');
      const lineNumberToUse = line.type === 'remove' ? line.oldLine : line.newLine || line.oldLine;
      const result = await getAiChatResponse(
        [],
        filePath,
        lineNumberToUse,
        contentToUse,
        line.content
      );
      setChatHistory([{ author: 'ai', content: result }]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Failed to get explanation');
    } finally {
      setIsLoadingResponse(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    const newUserMessage: ChatMessage = { author: 'user', content: message };
    const newChatHistory = [...chatHistory, newUserMessage];
    setChatHistory(newChatHistory);
    setIsLoadingResponse(true);
    setChatError(undefined);

    try {
      const contentToUse = line.type === 'remove' ? (oldFileContent ?? '') : (fileContent ?? '');
      const lineNumberToUse = line.type === 'remove' ? line.oldLine : line.newLine || line.oldLine;
      const response = await getAiChatResponse(
        newChatHistory,
        filePath,
        lineNumberToUse,
        contentToUse,
        line.content
      );
      const aiResponse: ChatMessage = { author: 'ai', content: response };
      setChatHistory((prev) => [...prev, aiResponse]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Failed to get response');
    } finally {
      setIsLoadingResponse(false);
    }
  };

  const handleCloseChat = () => {
    setShowChat(false);
    setChatHistory([]);
    setChatError(undefined);
  };

  // Close popup when clicking outside or pressing Escape
  React.useEffect(() => {
    if (!showChat) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const popupElement = document.querySelector(
        '[role="dialog"][aria-labelledby="explanation-popup-title"]'
      );

      if (popupElement && !popupElement.contains(target)) {
        setShowChat(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowChat(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showChat]);

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
          <SyntaxHighlightedCode
            code={line.content}
            filePath={filePath}
            isDarkMode={isDarkMode}
            className="whitespace-pre-wrap break-words bg-transparent"
            codeTheme={codeTheme}
          />
        </td>
      </tr>

      {/* AI Chat Popup */}
      {showChat && (
        <ExplanationPopup
          messages={chatHistory}
          lineContent={line.content}
          filePath={filePath}
          isLoading={isLoadingResponse}
          error={chatError}
          onClose={handleCloseChat}
          onSendMessage={handleSendMessage}
          position={popupPosition}
        />
      )}
    </>
  );
};
