import type React from 'react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

interface ResizablePaneProps {
  children: [ReactNode, ReactNode];
  defaultSizePercent?: number;
  minSizePercent?: number;
  maxSizePercent?: number;
  direction?: 'horizontal' | 'vertical';
  className?: string;
  storageKey?: string; // Unique key for localStorage
}

// localStorage utility functions
const STORAGE_PREFIX = 'resizable-pane-';

const saveToLocalStorage = (key: string, value: number): void => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, value.toString());
  } catch (error) {
    console.warn('Failed to save resizable pane state to localStorage:', error);
  }
};

const loadFromLocalStorage = (key: string, defaultValue: number): number => {
  try {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (saved !== null) {
      const parsed = Number.parseFloat(saved);
      return Number.isNaN(parsed) ? defaultValue : parsed;
    }
  } catch (error) {
    console.warn('Failed to load resizable pane state from localStorage:', error);
  }
  return defaultValue;
};

// Debounce utility
const useDebounce = (callback: () => void, delay: number, deps: React.DependencyList) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(callback, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, deps);
};

export const ResizablePane: React.FC<ResizablePaneProps> = ({
  children,
  defaultSizePercent = 30,
  minSizePercent = 15,
  maxSizePercent = 85,
  direction = 'horizontal',
  className = '',
  storageKey,
}) => {
  // Generate a default storage key if none provided
  const finalStorageKey = storageKey || `${direction}-${defaultSizePercent}-${Date.now()}`;

  // Initialize state with saved value or default
  const [leftSize, setLeftSize] = useState(() => {
    if (storageKey) {
      return loadFromLocalStorage(finalStorageKey, defaultSizePercent);
    }
    return defaultSizePercent;
  });

  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced save to localStorage
  useDebounce(
    () => {
      if (storageKey) {
        saveToLocalStorage(finalStorageKey, leftSize);
      }
    },
    300, // 300ms debounce delay
    [leftSize, finalStorageKey, storageKey]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return;

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
    },
    [direction, minSizePercent, maxSizePercent]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

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
  }, [isResizing, direction, handleMouseMove, handleMouseUp]);

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
