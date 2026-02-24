import type React from 'react';

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
    <div className="relative" role="status" aria-live="polite">
      <div
        className={`${sizeClasses[size]} rounded-full border-2 border-[#00f0ff]/20 border-t-[#00f0ff] animate-spin shadow-[0_0_10px_rgba(0,240,255,0.3)]`}
      />
      <div
        className={`absolute inset-0 ${sizeClasses[size]} rounded-full border border-[#ff2a6d]/10 animate-spin`}
        style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
};
