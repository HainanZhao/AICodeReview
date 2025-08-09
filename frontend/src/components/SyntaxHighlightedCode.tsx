import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight, vscDarkPlus, vs, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { detectLanguageFromPath } from '../utils/languageDetection';

interface SyntaxHighlightedCodeProps {
  code: string;
  filePath?: string;
  isDarkMode?: boolean;
  className?: string;
}

export const SyntaxHighlightedCode: React.FC<SyntaxHighlightedCodeProps> = ({
  code,
  filePath,
  isDarkMode = false,
  className = '',
}) => {
  const language = filePath ? detectLanguageFromPath(filePath) : null;
  
  // If no language detected, render plain text
  if (!language) {
    return <span className={className}>{code}</span>;
  }
  
  // Use vscDarkPlus for dark mode and prism for light mode (better contrast than oneLight/vs)
  const style = isDarkMode ? vscDarkPlus : prism;
  
  return (
    <SyntaxHighlighter
      language={language}
      style={style}
      customStyle={{
        margin: 0,
        padding: 0,
        background: 'transparent',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        lineHeight: 'inherit',
      }}
      codeTagProps={{
        style: {
          background: 'transparent',
          fontFamily: 'inherit',
          fontSize: 'inherit',
        },
      }}
      PreTag={({ children, ...props }) => (
        <span {...props} className={className}>
          {children}
        </span>
      )}
      CodeTag={({ children, ...props }) => (
        <span {...props} className={className}>
          {children}
        </span>
      )}
    >
      {code}
    </SyntaxHighlighter>
  );
};