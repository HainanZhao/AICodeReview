import React, { useState, useRef, useEffect } from 'react';
import { CloseIcon, SendIcon } from './icons';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

interface ChatPopupProps {
  initialMessage: string;
  lineContent: string;
  filePath: string;
  onSendMessage: (history: ChatMessage[]) => Promise<string>;
  onClose: () => void;
  position: { x: number; y: number };
}

export const ChatPopup: React.FC<ChatPopupProps> = ({
  initialMessage,
  lineContent,
  filePath,
  onSendMessage,
  onClose,
  position,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', content: initialMessage },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const popupRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
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
  }, [position]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: inputValue }];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);
    setError(undefined);

    try {
      const response = await onSendMessage(newMessages);
      setMessages([...newMessages, { role: 'model', content: response }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-w-2xl w-[640px] flex flex-col"
      role="dialog"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        height: '400px',
      }}
    >
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-600">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
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

      <div className="flex-grow p-3 overflow-y-auto">
        <div className="mb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Code line:</p>
          <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded block break-all">
            {lineContent}
          </code>
        </div>
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}
            >
              <div
                className={`p-3 rounded-lg ${
                  msg.role === 'model'
                    ? 'bg-gray-100 dark:bg-gray-700'
                    : 'bg-blue-500 text-white'
                }`}
              >
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                AI is thinking...
              </span>
            </div>
          )}
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
              <strong>Error:</strong> {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-3 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSend()}
            placeholder="Ask a follow-up question..."
            className="flex-grow p-2 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !inputValue.trim()}
            className="p-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
