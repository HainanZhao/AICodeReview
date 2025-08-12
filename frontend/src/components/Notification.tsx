import React, { useEffect, useState } from 'react';

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
      }, 300); // Wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) {
    return null;
  }

  const getTypeClasses = () => {
    switch (type) {
      case 'success':
        return 'bg-green-100 border-green-500 text-green-800 dark:bg-green-900/20 dark:border-green-400 dark:text-green-300';
      case 'warning':
        return 'bg-yellow-100 border-yellow-500 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-400 dark:text-yellow-300';
      case 'error':
        return 'bg-red-100 border-red-500 text-red-800 dark:bg-red-900/20 dark:border-red-400 dark:text-red-300';
      default:
        return 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900/20 dark:border-blue-400 dark:text-blue-300';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.365-.63.766-1.049 1.408-1.049.64 0 1.042.42 1.408 1.049l8.183 14.17c.365.63.365 1.049-.407 1.049H.57c-.772 0-.772-.42-.407-1.049L8.257 3.1zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  // Inline styles for fallback when Tailwind CSS is not available
  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: '16px',
    left: '50%',
    transform: isVisible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-100%)',
    zIndex: 50,
    transition: 'all 0.3s ease',
    opacity: isVisible ? 1 : 0,
  };

  const notificationStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    borderRadius: '8px',
    borderLeft: '4px solid',
    borderLeftColor:
      type === 'success'
        ? '#10b981'
        : type === 'warning'
          ? '#f59e0b'
          : type === 'error'
            ? '#ef4444'
            : '#3b82f6',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    maxWidth: '384px',
    backgroundColor:
      type === 'success'
        ? '#ecfdf5'
        : type === 'warning'
          ? '#fffbeb'
          : type === 'error'
            ? '#fef2f2'
            : '#eff6ff',
    color:
      type === 'success'
        ? '#065f46'
        : type === 'warning'
          ? '#92400e'
          : type === 'error'
            ? '#991b1b'
            : '#1e40af',
  };

  const iconStyle: React.CSSProperties = {
    flexShrink: 0,
    width: '16px',
    height: '16px',
  };

  const messageStyle: React.CSSProperties = {
    marginLeft: '12px',
    flex: 1,
    fontSize: '14px',
    fontWeight: 500,
  };

  const buttonStyle: React.CSSProperties = {
    marginLeft: '12px',
    flexShrink: 0,
    opacity: 0.7,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    color: 'inherit',
    transition: 'opacity 0.2s ease',
  };

  return (
    <div
      style={containerStyle}
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
    >
      <div
        style={notificationStyle}
        className={`flex items-center p-3 rounded-lg border-l-4 shadow-lg max-w-sm ${getTypeClasses()}`}
      >
        <div style={iconStyle} className="flex-shrink-0">
          {getIcon()}
        </div>
        <div style={messageStyle} className="ml-3 flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onClose?.(), 300);
          }}
          style={buttonStyle}
          className="ml-3 flex-shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity"
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
        >
          <svg style={iconStyle} fill="currentColor" viewBox="0 0 20 20">
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
