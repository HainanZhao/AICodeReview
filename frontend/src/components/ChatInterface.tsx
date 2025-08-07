import React from 'react';
import { CloseIcon } from './icons';
import { ChatMessage } from '../types';

interface ChatInterfaceProps {
  sessionId?: string;
  messages: ChatMessage[];
  lineContent: string;
  filePath: string;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSendMessage: (message: string) => void;
  position: { x: number; y: number };
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  sessionId,
  messages,
  lineContent,
  filePath,
  isLoading,
  error,
  onClose,
  onSendMessage,
  position,
}) => {
  const [inputMessage, setInputMessage] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Calculate position to keep popup within viewport
  const popupRef = React.useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = React.useState(position);

  React.useEffect(() => {
    if (popupRef.current) {
      const popup = popupRef.current;
      const rect = popup.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let { x, y } = position;

      // Adjust horizontal position if popup would overflow right edge
      if (x + rect.width > viewportWidth - 20) {
        x = viewportWidth - rect.width - 20;
      }

      // Adjust horizontal position if popup would overflow left edge
      if (x < 20) {
        x = 20;
      }

      // Adjust vertical position if popup would overflow bottom edge
      if (y + rect.height > viewportHeight - 20) {
        y = position.y - rect.height - 10; // Position above the cursor
      }

      // Adjust vertical position if popup would overflow top edge
      if (y < 20) {
        y = 20;
      }

      setAdjustedPosition({ x, y });
    }
  }, [position, messages, isLoading, error]);

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat is ready
  React.useEffect(() => {
    if (sessionId && !isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [sessionId, isLoading]);

  const handleSendMessage = async () => {
    const message = inputMessage.trim();
    if (!message || !sessionId || isSending) return;

    setIsSending(true);
    setInputMessage('');

    try {
      await onSendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
      // On error, restore the message to the input
      setInputMessage(message);
    } finally {
      setIsSending(false);
      // Focus back to input after sending
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-w-2xl w-[640px] flex flex-col max-h-[500px]"
      role="dialog"
      aria-labelledby="chat-interface-title"
      aria-describedby="chat-interface-content"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-600 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h3
            id="chat-interface-title"
            className="text-sm font-medium text-gray-900 dark:text-white truncate"
          >
            AI Chat Assistant
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">{filePath}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          title="Close chat"
        >
          <CloseIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Code context */}
      <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Code line:</p>
        <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded block break-all">
          {lineContent}
        </code>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[300px]"
        id="chat-interface-content"
      >
        {/* Initial loading state */}
        {isLoading && messages.length === 0 && (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              AI is analyzing the code...
            </span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Messages */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white ml-auto'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
              <div
                className={`text-xs mt-1 opacity-70 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {formatTimestamp(message.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator for new messages */}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-400 border-t-transparent"></div>
                <span className="text-gray-600 dark:text-gray-300">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {sessionId && (
        <div className="border-t border-gray-200 dark:border-gray-600 p-3 flex-shrink-0">
          <div className="flex space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a follow-up question..."
              disabled={isSending}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isSending}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Send
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Press Enter to send • Click outside to close
          </p>
        </div>
      )}
    </div>
  );
};
