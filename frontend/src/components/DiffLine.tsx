import React from 'react';
import { explainLine, startChat, continueChat } from '../services/aiReviewService';
import { ParsedDiffLine, ChatMessage } from '../types';
import { ExplanationPopup } from './ExplanationPopup';
import { ChatInterface } from './ChatInterface';
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

  // UI state - both explanation and chat
  const [showPopup, setShowPopup] = React.useState(false);
  const [popupMode, setPopupMode] = React.useState<'explanation' | 'chat'>('explanation');
  const [popupPosition, setPopupPosition] = React.useState({ x: 0, y: 0 });

  // Explanation state (original feature)
  const [explanation, setExplanation] = React.useState('');
  const [isLoadingExplanation, setIsLoadingExplanation] = React.useState(false);
  const [explanationError, setExplanationError] = React.useState<string | undefined>();

  // Chat state (new feature)
  const [chatSessionId, setChatSessionId] = React.useState<string | undefined>();
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const [isLoadingChat, setIsLoadingChat] = React.useState(false);
  const [chatError, setChatError] = React.useState<string | undefined>();

  const handleExplainClick = async (event: React.MouseEvent) => {
    if (!canExplain) return;

    event.stopPropagation();

    // Set popup position near the click
    const rect = event.currentTarget.getBoundingClientRect();
    setPopupPosition({
      x: rect.right + 10,
      y: rect.top,
    });

    // Start with explanation mode
    setPopupMode('explanation');
    setShowPopup(true);
    setIsLoadingExplanation(true);
    setExplanationError(undefined);
    setExplanation('');

    // Reset chat state
    setChatSessionId(undefined);
    setChatMessages([]);
    setChatError(undefined);

    try {
      // For deleted lines, use old file content; for other lines, use new file content
      const contentToUse = line.type === 'remove' ? (oldFileContent ?? '') : (fileContent ?? '');
      const lineNumberToUse = line.type === 'remove' ? line.oldLine : line.newLine || line.oldLine;

      // Get initial explanation using original API
      const result = await explainLine(line.content, filePath, lineNumberToUse, contentToUse, 5);
      setExplanation(result);
    } catch (error) {
      console.error('Failed to get explanation:', error);
      setExplanationError(error instanceof Error ? error.message : 'Failed to get explanation');
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  const handleStartChat = async () => {
    setPopupMode('chat');
    setIsLoadingChat(true);
    setChatError(undefined);
    setChatMessages([]);

    try {
      // For deleted lines, use old file content; for other lines, use new file content
      const contentToUse = line.type === 'remove' ? (oldFileContent ?? '') : (fileContent ?? '');
      const lineNumberToUse = line.type === 'remove' ? line.oldLine : line.newLine || line.oldLine;

      const result = await startChat(line.content, filePath, lineNumberToUse, contentToUse, 5);
      setChatSessionId(result.sessionId);
      setChatMessages(result.messages);
    } catch (error) {
      console.error('Failed to start chat:', error);
      setChatError(error instanceof Error ? error.message : 'Failed to start chat');
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!chatSessionId) {
      throw new Error('No active chat session');
    }

    try {
      const result = await continueChat(chatSessionId, message);
      setChatMessages(result.messages);
    } catch (error) {
      console.error('Failed to send message:', error);
      setChatError(error instanceof Error ? error.message : 'Failed to send message');
      throw error; // Re-throw to let ChatInterface handle the error state
    }
  };

  const handleClosePopup = () => {
    setShowPopup(false);
    setPopupMode('explanation');
    setExplanation('');
    setExplanationError(undefined);
    setChatMessages([]);
    setChatSessionId(undefined);
    setChatError(undefined);
  };

  // Close popup when clicking outside or pressing Escape
  React.useEffect(() => {
    if (!showPopup) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const popupElement = document.querySelector(
        '[role="dialog"][aria-labelledby="explanation-popup-title"], [role="dialog"][aria-labelledby="chat-interface-title"]'
      );

      if (popupElement && !popupElement.contains(target)) {
        handleClosePopup();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClosePopup();
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPopup]);

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
                title="Get AI explanation for this line"
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

      {/* AI Explanation Popup (Original Feature Enhanced) */}
      {showPopup && popupMode === 'explanation' && (
        <ExplanationPopup
          explanation={explanation}
          lineContent={line.content}
          filePath={filePath}
          isLoading={isLoadingExplanation}
          error={explanationError}
          onClose={handleClosePopup}
          onStartChat={handleStartChat}
          position={popupPosition}
        />
      )}

      {/* AI Chat Interface (New Feature) */}
      {showPopup && popupMode === 'chat' && (
        <ChatInterface
          sessionId={chatSessionId}
          messages={chatMessages}
          lineContent={line.content}
          filePath={filePath}
          isLoading={isLoadingChat}
          error={chatError}
          onClose={handleClosePopup}
          onSendMessage={handleSendMessage}
          position={popupPosition}
        />
      )}
    </>
  );
};
