import React from 'react';
import ReactDOM from 'react-dom';
import type { ChatMessage } from '../types';
import { Spinner } from './Spinner';
import { CloseIcon, SendIcon } from './icons';

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
  }, [position]);

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
      className="fixed z-50 cyber-card cyber-neon-border--magenta max-w-2xl w-[640px] flex flex-col shadow-[0_0_30px_rgba(255,42,109,0.3)]"
      role="dialog"
      aria-labelledby="explanation-popup-title"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        maxHeight: '80vh',
      }}
    >
      <div className="cyber-card__header flex items-center justify-between p-4 border-b border-[#ff2a6d]/30 bg-[#ff2a6d]/5">
        <div className="flex-1 min-w-0">
          <h3
            id="explanation-popup-title"
            className="text-sm font-bold text-[#ff2a6d] uppercase tracking-wider cyber-text-glow"
          >
            AI EXPLAIN
          </h3>
          <p className="text-[10px] font-mono text-[#a1a1aa] truncate mt-1">{filePath}</p>
        </div>
        <button
          onClick={onClose}
          className="cyber-btn cyber-btn--ghost cyber-btn--xs"
          title="Close chat"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>

      <div
        className="flex-grow p-4 overflow-y-auto bg-[#0a0a0f]"
        id="explanation-popup-content"
        ref={chatHistoryRef}
      >
        <div className="mb-4">
          <p className="text-[10px] font-bold text-[#00f0ff] uppercase tracking-wider mb-2">
            CODE LINE:
          </p>
          <code className="text-xs bg-[#00f0ff]/10 text-[#00f0ff] px-3 py-2 border border-[#00f0ff]/20 block break-all font-mono">
            {lineContent}
          </code>
        </div>

        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={`${message.author}-${index}`}
              className={`flex items-start gap-3 ${message.author === 'user' ? 'justify-end' : ''}`}
            >
              {message.author === 'ai' && (
                <div className="flex-shrink-0 w-8 h-8 bg-[#ff2a6d] text-[#0a0a0f] text-[10px] font-bold flex items-center justify-center border border-[#ff2a6d] shadow-[0_0_10px_rgba(255,42,109,0.5)]">
                  AI
                </div>
              )}
              <div
                className={`p-3 max-w-md ${
                  message.author === 'ai'
                    ? 'cyber-card bg-[#1a1a20] text-[#ececec] border border-[#00f0ff]/20'
                    : 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap font-mono">{message.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-[#ff2a6d] text-[#0a0a0f] text-[10px] font-bold flex items-center justify-center border border-[#ff2a6d] shadow-[0_0_10px_rgba(255,42,109,0.5)]">
                AI
              </div>
              <div className="p-3 cyber-card border border-[#00f0ff]/20">
                <Spinner size="sm" />
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-[#ff2a6d] bg-[#ff2a6d]/10 border border-[#ff2a6d]/30 p-3">
              <span className="font-bold uppercase">ERROR:</span> {error}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-[#ff2a6d]/30 bg-[#0a0a0f]">
        <div className="relative">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="ASK FOLLOW-UP..."
            className="cyber-input w-full px-4 py-2 pr-12 bg-transparent text-[#00f0ff] text-sm font-mono focus:outline-none"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !newMessage.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 cyber-btn cyber-btn--cyan cyber-btn--xs"
            title="Send message"
          >
            <SendIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  if (!portalRoot) {
    console.error('Portal root element not found');
    return popupContent;
  }

  return ReactDOM.createPortal(popupContent, portalRoot);
};
