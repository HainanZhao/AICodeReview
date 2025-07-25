import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  return (
    <div
      className={`animate-spin rounded-full border-t-2 border-b-2 border-gray-900 dark:border-white ${sizeClasses[size]}`}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};
