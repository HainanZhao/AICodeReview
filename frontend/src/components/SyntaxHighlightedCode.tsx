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

// Minimal diff-optimized themes with only essential color overrides
const diffLightTheme: { [key: string]: React.CSSProperties } = {
  // Only override base colors, let individual themes handle specific syntax highlighting
  'code[class*="language-"]': {
    color: '#24292e', // Base text color
  },
  'pre[class*="language-"]': {
    color: '#24292e', // Base text color
  },
  // Essential syntax colors - kept minimal to allow theme variations
  comment: { color: '#6a737d' },
  prolog: { color: '#6a737d' },
  doctype: { color: '#6a737d' },
  cdata: { color: '#6a737d' },
  punctuation: { color: '#586069' },
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
  // Only override base colors, let individual themes handle specific syntax highlighting
  'code[class*="language-"]': {
    color: '#f8f8f2', // Base text color for dark mode
  },
  'pre[class*="language-"]': {
    color: '#f8f8f2', // Base text color for dark mode
  },
  // Essential syntax colors - kept minimal to allow theme variations
  token: { color: '#f8f8f2' }, // Base token color - fallback for unspecified tokens
  comment: { color: '#6272a4' },
  prolog: { color: '#6272a4' },
  doctype: { color: '#6272a4' },
  cdata: { color: '#6272a4' },
  punctuation: { color: '#8292a2' },
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
  string: { color: '#e6db74' },
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
};

const kebabToCamel = (s: string): string => {
  return s.replace(/-./g, (x) => x[1].toUpperCase());
};

// Merge diff-specific overrides with individual themes
const mergeThemeWithDiffSupport = (baseTheme: any, diffTheme: any) => {
  if (!baseTheme || typeof baseTheme !== 'object') {
    return diffTheme;
  }

  // Create a merged theme that preserves individual theme colors while maintaining diff compatibility
  const merged = { ...baseTheme };

  // Only override essential properties for diff compatibility
  if (diffTheme['code[class*="language-"]']) {
    merged['code[class*="language-"]'] = {
      ...baseTheme['code[class*="language-"]'],
      // Only override background to maintain transparency for diff highlighting
      background: 'transparent',
      backgroundColor: 'transparent',
    };
  }

  if (diffTheme['pre[class*="language-"]']) {
    merged['pre[class*="language-"]'] = {
      ...baseTheme['pre[class*="language-"]'],
      // Only override background to maintain transparency for diff highlighting
      background: 'transparent',
      backgroundColor: 'transparent',
    };
  }

  return merged;
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
        theme =
          (prismThemes as any)[codeTheme + 'light'] ||
          (prismThemes as any)[kebabToCamel(codeTheme + 'light')];
      }

      if (theme) {
        // Merge individual theme with diff support
        const mergedTheme = mergeThemeWithDiffSupport(
          theme,
          isDarkMode ? diffDarkTheme : diffLightTheme
        );
        setStyle(mergedTheme);
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
        // Layout properties moved from theme objects to ensure consistent diff display
        margin: 0,
        padding: 0,
        background: 'transparent',
        backgroundColor: 'transparent',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        lineHeight: 'inherit',
        display: 'inline',
        // Additional layout properties for diff compatibility
        textShadow: 'none',
        direction: 'ltr',
        textAlign: 'left',
        whiteSpace: 'pre',
        wordSpacing: 'normal',
        wordBreak: 'normal',
        overflow: 'visible',
        // Improved font rendering
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
      codeTagProps={{
        style: {
          // Layout properties for diff compatibility
          background: 'transparent',
          backgroundColor: 'transparent',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          display: 'inline',
          textShadow: 'none',
          direction: 'ltr',
          textAlign: 'left',
          whiteSpace: 'pre',
          wordSpacing: 'normal',
          wordBreak: 'normal',
          lineHeight: 'inherit',
          padding: '0',
          margin: '0',
          // Improved font rendering
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
