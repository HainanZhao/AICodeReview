import React from 'react';
import { CloseIcon } from './icons';

interface ExplanationPopupProps {
  explanation: string;
  lineContent: string;
  filePath: string;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onStartChat?: () => void; // New prop to start chat mode
  position: { x: number; y: number };
}

export const ExplanationPopup: React.FC<ExplanationPopupProps> = ({
  explanation,
  lineContent,
  filePath,
  isLoading,
  error,
  onClose,
  onStartChat, // New prop
  position,
}) => {
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
  }, [position, explanation, isLoading, error]);

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-w-2xl w-[640px]"
      role="dialog"
      aria-labelledby="explanation-popup-title"
      aria-describedby="explanation-popup-content"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-600">
        <div className="flex-1 min-w-0">
          <h3
            id="explanation-popup-title"
            className="text-sm font-medium text-gray-900 dark:text-white truncate"
          >
            AI Explanation
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">{filePath}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          title="Close explanation"
        >
          <CloseIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3" id="explanation-popup-content">
        {/* Code line */}
        <div className="mb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Code line:</p>
          <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded block break-all">
            {lineContent}
          </code>
        </div>

        {/* Explanation content */}
        <div className="space-y-2">
          {isLoading && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                AI is analyzing the code...
              </span>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
              <strong>Error:</strong> {error}
            </div>
          )}

          {!isLoading && !error && explanation && (
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {explanation}
            </div>
          )}

          {!isLoading && !error && !explanation && (
            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
              No explanation available.
            </div>
          )}
        </div>
      </div>

      {/* Footer with actions */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Click outside to close or press Escape
        </p>
        {!isLoading && !error && explanation && onStartChat && (
          <button
            onClick={onStartChat}
            className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            💬 Start Chat
          </button>
        )}
      </div>
    </div>
  );
};
