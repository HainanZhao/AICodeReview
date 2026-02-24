import React from 'react';
import { getAiChatResponse } from '../services/aiReviewService';
import type { ParsedDiffLine } from '../types';
import type { ChatMessage } from '../types';
import { ExplanationPopup } from './ExplanationPopup';
import { SyntaxHighlightedCode } from './SyntaxHighlightedCode';
import { AIExplainIcon, PlusIcon } from './icons';

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
      return 'bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-l-2 border-green-500/50';
    case 'remove':
      return 'bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-l-2 border-red-500/50';
    case 'meta':
      return 'bg-brand-secondary/10 dark:bg-brand-secondary/20 text-brand-secondary dark:text-brand-secondary/80 border-l-2 border-brand-secondary/50';
    default:
      return 'bg-transparent text-gray-600 dark:text-brand-subtle border-l-2 border-transparent';
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
      <tr className={`${lineClasses} group hover:bg-black/5 dark:hover:bg-white/5 transition-all h-4`}>
        <td className="w-12 text-center align-middle h-4 pr-1">
          {/* Action buttons container */}
          <div className="flex items-center justify-center space-x-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200">
            {/* Add comment button */}
            <button
              onClick={onAddComment}
              title={canComment ? 'Add Comment' : ''}
              disabled={!canComment}
              className={`
                        bg-brand-secondary text-white rounded-lg p-[4px] leading-none shadow-glass hover:scale-110 active:scale-95 transition-transform
                        ${canComment ? '' : 'pointer-events-none opacity-0'}
                      `}
            >
              <PlusIcon className="w-3 h-3" />
            </button>

            {/* AI Explain button */}
            {canExplain && (
              <button
                onClick={handleExplainClick}
                title="AI Explain"
                className="bg-brand-accent text-white rounded-lg p-[4px] leading-none shadow-glass hover:scale-110 active:scale-95 transition-transform"
              >
                <AIExplainIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        </td>
        <td className="w-10 text-right px-1 select-none text-[11px] font-mono text-[#444444] dark:text-[#a1a1aa] align-middle h-4 leading-none tabular-nums">
          {line.oldLine || ''}
        </td>
        <td className="w-10 text-right px-1 select-none text-[11px] font-mono text-[#444444] dark:text-[#a1a1aa] align-middle h-4 border-r border-[#dbdbdb] dark:border-[#404040] leading-none tabular-nums">
          {line.newLine || ''}
        </td>
        <td className="w-full pl-2 pr-2 align-middle font-mono text-[12px] font-medium h-4 leading-[1.6] tracking-normal">
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
