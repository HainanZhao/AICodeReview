import React from 'react';
import { getAiChatResponse } from '../services/aiReviewService';
import { ChatMessage, ParsedDiffLine } from '../types';
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
  codeTheme?: string;
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
  codeTheme?: string;
}> = ({ line, side, onAddComment, onExplainClick, filePath, isDarkMode, codeTheme }) => {
  const lineClasses = getLineClasses(line?.type);
  const canComment =
    line && (line.type === 'add' || line.type === 'remove' || line.type === 'context');
  const canExplain = line && line.type !== 'meta' && line.content.trim().length > 0;

  const lineNumber = side === 'left' ? line?.oldLine : line?.newLine;

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
              <SyntaxHighlightedCode
                code={line.content}
                filePath={filePath}
                isDarkMode={isDarkMode}
                className="whitespace-pre-wrap break-words bg-transparent"
                codeTheme={codeTheme}
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
  codeTheme,
}) => {
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
  const [currentChatLine, setCurrentChatLine] = React.useState<ParsedDiffLine | null>(null);

  const handleExplainClick = async (event: React.MouseEvent, line: ParsedDiffLine) => {
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    setPopupPosition({
      x: rect.right + 10,
      y: rect.top,
    });

    setCurrentChatLine(line);
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
      const line = currentChatLine;
      if (!line) throw new Error('No line selected for chat.');

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
    setCurrentChatLine(null);
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
      <tr className="h-4">
        <SplitDiffSide
          line={leftLine}
          side="left"
          onAddComment={() => leftLine && onAddComment(leftLine, 'left')}
          onExplainClick={handleExplainClick}
          filePath={filePath}
          isDarkMode={isDarkMode}
          codeTheme={codeTheme}
        />
        <SplitDiffSide
          line={rightLine}
          side="right"
          onAddComment={() => rightLine && onAddComment(rightLine, 'right')}
          onExplainClick={handleExplainClick}
          filePath={filePath}
          isDarkMode={isDarkMode}
          codeTheme={codeTheme}
        />
      </tr>

      {/* AI Chat Popup */}
      {showChat && currentChatLine && (
        <ExplanationPopup
          messages={chatHistory}
          lineContent={currentChatLine.content}
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
