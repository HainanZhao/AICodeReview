import React from 'react';
import { getAiChatResponse } from '../services/aiReviewService';
import type { ChatMessage, ParsedDiffLine } from '../types';
import { ExplanationPopup } from './ExplanationPopup';
import { SyntaxHighlightedCode } from './SyntaxHighlightedCode';
import { AIExplainIcon, PlusIcon } from './icons';

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
      return 'bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-l-2 border-green-500/50';
    case 'remove':
      return 'bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-l-2 border-red-500/50';
    case 'meta':
      return 'bg-brand-secondary/10 dark:bg-brand-secondary/20 text-brand-secondary dark:text-brand-secondary/80 border-l-2 border-brand-secondary/50';
    case 'context':
      return 'bg-transparent text-gray-600 dark:text-brand-subtle border-l-2 border-transparent';
    default:
      return 'bg-gray-50/50 dark:bg-brand-primary/5 text-gray-400 dark:text-brand-subtle/50 border-l-2 border-transparent';
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
      className={`w-1/2 border-r border-gray-200 dark:border-white/5 ${lineClasses} group hover:bg-black/5 dark:hover:bg-white/5 transition-all`}
    >
      <div className="flex h-4">
        {/* Action buttons */}
        <div className="w-12 flex items-center justify-center pl-1 pr-1">
          <div className="flex items-center justify-center space-x-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-x-1 group-hover:translate-x-0">
            {/* Add comment button */}
            {canComment && (
              <button
                onClick={onAddComment}
                title="Add Comment"
                className="bg-brand-secondary text-white rounded-lg p-[3.5px] leading-none shadow-glass hover:scale-110 active:scale-95 transition-all"
              >
                <PlusIcon className="w-2.5 h-2.5" />
              </button>
            )}

            {/* AI Explain button */}
            {canExplain && line && (
              <button
                onClick={(e) => onExplainClick(e, line)}
                title="AI Explain"
                className="bg-brand-accent text-white rounded-lg p-[3.5px] leading-none shadow-glass hover:scale-110 active:scale-95 transition-all"
              >
                <AIExplainIcon className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>

        {/* Line number */}
        <div className="w-10 text-right px-1 select-none text-[11px] font-mono text-[#444444] dark:text-[#a1a1aa] align-middle leading-none tabular-nums mt-[3px]">
          {lineNumber || ''}
        </div>

        {/* Line content */}
        <div className="flex-1 pl-2 pr-2 font-mono text-[12px] font-medium leading-[1.6] tracking-normal">
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
