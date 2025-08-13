import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import * as prismThemes from 'react-syntax-highlighter/dist/esm/styles/prism';
import { detectLanguageFromPath } from '../utils/languageDetection';

interface SyntaxHighlightedCodeProps {
  code: string;
  filePath?: string;
  isDarkMode?: boolean;
  className?: string;
  codeTheme?: string;
}

// Custom diff-optimized themes with only foreground colors
const diffLightTheme: { [key: string]: React.CSSProperties } = {
  'code[class*="language-"]': {
    color: '#000000',
    background: 'transparent',
    textShadow: 'none',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    direction: 'ltr' as const,
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    lineHeight: 'inherit',
    padding: '0',
    margin: '0',
  },
  'pre[class*="language-"]': {
    color: '#000000',
    background: 'transparent',
    textShadow: 'none',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    direction: 'ltr' as const,
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    lineHeight: 'inherit',
    padding: '0',
    margin: '0',
    overflow: 'visible',
  },
  comment: { color: '#6a737d' },
  prolog: { color: '#6a737d' },
  doctype: { color: '#6a737d' },
  cdata: { color: '#6a737d' },
  punctuation: { color: '#586069' }, // Slightly lighter than main text for visibility
  namespace: { opacity: '0.7' },
  property: { color: '#005cc5' },
  tag: { color: '#d73a49' },
  boolean: { color: '#005cc5' },
  number: { color: '#005cc5' },
  constant: { color: '#005cc5' },
  symbol: { color: '#005cc5' },
  deleted: { color: '#d73a49' },
  selector: { color: '#6f42c1' },
  'attr-name': { color: '#6f42c1' },
  string: { color: '#032f62' },
  char: { color: '#032f62' },
  builtin: { color: '#e36209' },
  inserted: { color: '#28a745' },
  variable: { color: '#e36209' },
  operator: { color: '#d73a49' },
  entity: { color: '#22863a' },
  url: { color: '#22863a' },
  keyword: { color: '#d73a49' },
  atrule: { color: '#d73a49' },
  'attr-value': { color: '#032f62' },
  function: { color: '#6f42c1' },
  'class-name': { color: '#6f42c1' },
  regex: { color: '#032f62' },
  important: { color: '#d73a49', fontWeight: 'bold' },
  // Additional bracket/brace related tokens
  brace: { color: '#586069' },
  bracket: { color: '#586069' },
  paren: { color: '#586069' },
  token: { color: '#24292e' },
};

const diffDarkTheme: { [key: string]: React.CSSProperties } = {
  'code[class*="language-"]': {
    color: '#f8f8f2',
    background: 'transparent',
    textShadow: 'none',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    direction: 'ltr' as const,
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    lineHeight: 'inherit',
  },
  'pre[class*="language-"]': {
    color: '#f8f8f2',
    background: 'transparent',
    textShadow: 'none',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    direction: 'ltr' as const,
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    lineHeight: 'inherit',
    padding: '0',
    margin: '0',
    overflow: 'visible',
  },
  // Base token color - fallback for unspecified tokens
  token: { color: '#f8f8f2' },
  comment: { color: '#6272a4' },
  prolog: { color: '#6272a4' },
  doctype: { color: '#6272a4' },
  cdata: { color: '#6272a4' },
  punctuation: { color: '#8292a2' }, // Lighter than main text for visibility
  namespace: { opacity: '0.7' },
  property: { color: '#50fa7b' },
  tag: { color: '#ff79c6' },
  boolean: { color: '#bd93f9' },
  number: { color: '#bd93f9' },
  constant: { color: '#bd93f9' },
  symbol: { color: '#bd93f9' },
  deleted: { color: '#ff5555' },
  selector: { color: '#50fa7b' },
  'attr-name': { color: '#50fa7b' },
  string: { color: '#e6db74' }, // Brighter yellow for better contrast
  char: { color: '#e6db74' },
  builtin: { color: '#8be9fd' },
  inserted: { color: '#50fa7b' },
  variable: { color: '#f8f8f2' },
  operator: { color: '#ff79c6' },
  entity: { color: '#50fa7b' },
  url: { color: '#8be9fd' },
  keyword: { color: '#ff79c6' },
  atrule: { color: '#ff79c6' },
  'attr-value': { color: '#e6db74' },
  function: { color: '#50fa7b' },
  'class-name': { color: '#8be9fd' },
  regex: { color: '#e6db74' },
  important: { color: '#ff5555', fontWeight: 'bold' },
  // Additional bracket/brace related tokens
  brace: { color: '#8292a2' },
  bracket: { color: '#8292a2' },
  paren: { color: '#8292a2' },
  'language-javascript': { color: '#f8f8f2' },
  'language-typescript': { color: '#f8f8f2' },
  'language-jsx': { color: '#f8f8f2' },
  'language-tsx': { color: '#f8f8f2' },
};

const kebabToCamel = (s: string): string => {
  return s.replace(/-./g, (x) => x[1].toUpperCase());
};

export const SyntaxHighlightedCode: React.FC<SyntaxHighlightedCodeProps> = ({
  code,
  filePath,
  isDarkMode = false,
  className = '',
  codeTheme,
}) => {
  const [style, setStyle] = useState<any>(isDarkMode ? diffDarkTheme : diffLightTheme);

  useEffect(() => {
    if (codeTheme && codeTheme !== 'default') {
      // First try direct name
      let theme = (prismThemes as any)[codeTheme];
      
      if (!theme) {
        // Try camelCase conversion
        const themeName = kebabToCamel(codeTheme);
        theme = (prismThemes as any)[themeName];
      }
      
      if (!theme) {
        // Try with 'light' suffix for some themes
        theme = (prismThemes as any)[codeTheme + 'light'] || (prismThemes as any)[kebabToCamel(codeTheme + 'light')];
      }
      
      if (theme) {
        setStyle(theme);
      } else {
        // Fallback to default theme
        console.warn(`Theme "${codeTheme}" not found, using default theme`);
        setStyle(isDarkMode ? diffDarkTheme : diffLightTheme);
      }
    } else {
      setStyle(isDarkMode ? diffDarkTheme : diffLightTheme);
    }
  }, [codeTheme, isDarkMode]);

  const language = filePath ? detectLanguageFromPath(filePath) : null;

  // If no language detected, render plain text
  if (!language) {
    return <span className={className}>{code}</span>;
  }

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
        display: 'inline',
        // Improved font rendering
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
          display: 'inline',
          textShadow: 'none',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      }}
      PreTag={({ children, ...props }) => (
        <span
          {...props}
          className={className}
          style={{
            background: 'transparent',
            backgroundColor: 'transparent',
            display: 'inline',
            whiteSpace: 'pre-wrap',
          }}
        >
          {children}
        </span>
      )}
      CodeTag={({ children, ...props }) => (
        <span
          {...props}
          className={className}
          style={{
            background: 'transparent',
            backgroundColor: 'transparent',
            display: 'inline',
          }}
        >
          {children}
        </span>
      )}
    >
      {code}
    </SyntaxHighlighter>
  );
};
