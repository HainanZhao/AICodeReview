import type React from 'react';
import { useEffect, useState } from 'react';

interface NotificationProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  onClose?: () => void;
}

export const Notification: React.FC<NotificationProps> = ({
  message,
  type = 'info',
  duration = 5000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onClose?.();
      }, 200);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) {
    return null;
  }

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'border-[#05ffa1] text-[#05ffa1]';
      case 'warning':
        return 'border-[#fcee0a] text-[#fcee0a]';
      case 'error':
        return 'border-[#ff2a6d] text-[#ff2a6d]';
      default:
        return 'border-[#00f0ff] text-[#00f0ff]';
    }
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-4 py-2 border-l-2 bg-[#0a0a0f]/95 backdrop-blur-sm ${getTypeStyles()} transition-all duration-200 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <div className="flex items-center space-x-3">
        <span className="text-[11px] font-bold uppercase tracking-wider">{message}</span>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onClose?.(), 200);
          }}
          className="opacity-50 hover:opacity-100 transition-opacity"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};
