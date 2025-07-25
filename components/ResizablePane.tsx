import React, { useState, useEffect, useRef, ReactNode } from 'react';

interface ResizablePaneProps {
  children: [ReactNode, ReactNode];
  defaultSizePercent?: number;
  minSizePercent?: number;
  maxSizePercent?: number;
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

export const ResizablePane: React.FC<ResizablePaneProps> = ({
  children,
  defaultSizePercent = 30,
  minSizePercent = 15,
  maxSizePercent = 85,
  direction = 'horizontal',
  className = '',
}) => {
  const [leftSize, setLeftSize] = useState(defaultSizePercent);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    let newSize;

    if (direction === 'horizontal') {
      const x = e.clientX - rect.left;
      newSize = (x / rect.width) * 100;
    } else {
      const y = e.clientY - rect.top;
      newSize = (y / rect.height) * 100;
    }

    newSize = Math.max(minSizePercent, Math.min(maxSizePercent, newSize));
    setLeftSize(newSize);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, direction]);

  const rightSize = 100 - leftSize;

  return (
    <div
      ref={containerRef}
      className={`flex ${direction === 'horizontal' ? 'flex-row' : 'flex-col'} ${className}`}
    >
      {/* Left/Top Pane */}
      <div
        style={{
          [direction === 'horizontal' ? 'width' : 'height']: `${leftSize}%`,
        }}
        className="overflow-hidden"
      >
        {children[0]}
      </div>

      {/* Resizer */}
      <div
        onMouseDown={handleMouseDown}
        className={`
          ${direction === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
          bg-gray-300 dark:bg-gray-600 hover:bg-blue-400 dark:hover:bg-blue-500 
          transition-colors flex-shrink-0 select-none
          ${isResizing ? 'bg-blue-400 dark:bg-blue-500' : ''}
        `}
        style={{
          minWidth: direction === 'horizontal' ? '4px' : undefined,
          minHeight: direction === 'vertical' ? '4px' : undefined,
        }}
      />

      {/* Right/Bottom Pane */}
      <div
        style={{
          [direction === 'horizontal' ? 'width' : 'height']: `${rightSize}%`,
        }}
        className="overflow-hidden"
      >
        {children[1]}
      </div>
    </div>
  );
};
