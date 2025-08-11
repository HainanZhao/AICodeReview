import React from 'react';
import ReactDOM from 'react-dom';
import { CloseIcon, SendIcon } from './icons';
import { ChatMessage } from '../types';

interface ExplanationPopupProps {
  messages: ChatMessage[];
  lineContent: string;
  filePath: string;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSendMessage: (message: string) => void;
  position: { x: number; y: number };
}

export const ExplanationPopup: React.FC<ExplanationPopupProps> = ({
  messages,
  lineContent,
  filePath,
  isLoading,
  error,
  onClose,
  onSendMessage,
  position,
}) => {
  const popupRef = React.useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = React.useState(position);
  const [newMessage, setNewMessage] = React.useState('');
  const chatHistoryRef = React.useRef<HTMLDivElement>(null);
  const portalRoot = document.getElementById('portal-root');

  React.useEffect(() => {
    if (popupRef.current) {
      const popup = popupRef.current;
      const rect = popup.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let { x, y } = position;

      if (x + rect.width > viewportWidth - 20) {
        x = viewportWidth - rect.width - 20;
      }
      if (x < 20) {
        x = 20;
      }
      if (y + rect.height > viewportHeight - 20) {
        y = position.y - rect.height - 10;
      }
      if (y < 20) {
        y = 20;
      }

      setAdjustedPosition({ x, y });
    }
  }, [position, messages, isLoading, error]);

  // Scroll to bottom of chat history when new messages are added
  React.useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const popupContent = (
    <div
      ref={popupRef}
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-w-2xl w-[640px] flex flex-col"
      role="dialog"
      aria-labelledby="explanation-popup-title"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        maxHeight: '80vh', // Set max height
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-600 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h3
            id="explanation-popup-title"
            className="text-sm font-medium text-gray-900 dark:text-white truncate"
          >
            AI Chat
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

      {/* Content */}
      <div
        className="flex-grow p-3 overflow-y-auto"
        id="explanation-popup-content"
        ref={chatHistoryRef}
      >
        {/* Code line */}
        <div className="mb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Code line:</p>
          <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded block break-all">
            {lineContent}
          </code>
        </div>

        {/* Chat history */}
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex items-start gap-2.5 ${
                message.author === 'user' ? 'justify-end' : ''
              }`}
            >
              {message.author === 'ai' && (
                <div className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  AI
                </div>
              )}
              <div
                className={`p-3 rounded-lg max-w-md ${
                  message.author === 'ai'
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    : 'bg-blue-500 text-white'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center space-x-2">
              <div className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                AI
              </div>
              <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>
      </div>

      {/* Footer Input */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-600 flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a follow-up question..."
            className="w-full pl-3 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !newMessage.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send message"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );

  if (!portalRoot) {
    console.error(
      "Portal root element not found. Make sure you have a <div id='portal-root'></div> in your index.html"
    );
    return popupContent; // Fallback to rendering inline
  }

  return ReactDOM.createPortal(popupContent, portalRoot);
};
