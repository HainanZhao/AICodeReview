import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coy, dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
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

  // Use oneDark for dark mode (better font rendering than vscDarkPlus) and prism for light mode
  const style = isDarkMode ? dracula : coy;

  return (
    <SyntaxHighlighter
      language={language}
      style={style}
      customStyle={{
        margin: 0,
        padding: 0,
        background: 'transparent',
        backgroundColor: 'transparent',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        lineHeight: 'inherit',
        // Fix font rendering issues in dark mode
        textShadow: 'none',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
      codeTagProps={{
        style: {
          background: 'transparent',
          backgroundColor: 'transparent',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          textShadow: 'none',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      }}
      PreTag={({ children, ...props }) => (
        <span
          {...props}
          className={className}
          style={{ background: 'transparent', backgroundColor: 'transparent' }}
        >
          {children}
        </span>
      )}
      CodeTag={({ children, ...props }) => (
        <span
          {...props}
          className={className}
          style={{ background: 'transparent', backgroundColor: 'transparent' }}
        >
          {children}
        </span>
      )}
    >
      {code}
    </SyntaxHighlighter>
  );
};
