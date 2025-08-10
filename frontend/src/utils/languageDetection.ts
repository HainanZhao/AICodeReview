/**
 * Language detection utility for syntax highlighting
 */

export interface LanguageMap {
  [key: string]: string;
}

const extensionToLanguage: LanguageMap = {
  // TypeScript/JavaScript
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.mjs': 'javascript',
  '.cjs': 'javascript',

  // Web languages
  '.html': 'html',
  '.htm': 'html',
  '.xml': 'xml',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',

  // Python
  '.py': 'python',
  '.pyw': 'python',
  '.py3': 'python',

  // C/C++
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c++': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.hxx': 'cpp',
  '.h++': 'cpp',

  // Rust
  '.rs': 'rust',

  // Other common languages
  '.java': 'java',
  '.go': 'go',
  '.php': 'php',
  '.rb': 'ruby',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',

  // Data/Config formats
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.ini': 'ini',
  '.cfg': 'ini',
  '.conf': 'ini',

  // Markup
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.tex': 'latex',

  // Shell/Scripts
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'zsh',
  '.fish': 'fish',
  '.ps1': 'powershell',
  '.bat': 'batch',
  '.cmd': 'batch',

  // SQL
  '.sql': 'sql',

  // Docker
  dockerfile: 'dockerfile',
  '.dockerfile': 'dockerfile',

  // Other
  '.r': 'r',
  '.R': 'r',
  '.m': 'matlab',
  '.pl': 'perl',
  '.vim': 'vim',
  '.lua': 'lua',
  '.dart': 'dart',
  '.elm': 'elm',
  '.clj': 'clojure',
  '.fs': 'fsharp',
  '.vb': 'vbnet',
};

/**
 * Detects the programming language from a file path
 * @param filePath - The path to the file
 * @returns The language identifier for syntax highlighting, or null if not supported
 */
export function detectLanguageFromPath(filePath: string): string | null {
  if (!filePath) return null;

  const fileName = filePath.toLowerCase();

  // Check for special cases first
  if (fileName.includes('dockerfile') || fileName.endsWith('/dockerfile')) {
    return 'dockerfile';
  }

  if (fileName.includes('makefile') || fileName.endsWith('/makefile')) {
    return 'makefile';
  }

  if (fileName.includes('gemfile') || fileName.endsWith('/gemfile')) {
    return 'ruby';
  }

  if (fileName.includes('podfile') || fileName.endsWith('/podfile')) {
    return 'ruby';
  }

  // Extract file extension
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) return null;

  const extension = fileName.substring(lastDotIndex);
  return extensionToLanguage[extension] || null;
}

/**
 * Gets the list of supported languages
 * @returns Array of supported language identifiers
 */
export function getSupportedLanguages(): string[] {
  return Array.from(new Set(Object.values(extensionToLanguage)));
}

/**
 * Checks if a language is supported for syntax highlighting
 * @param language - Language identifier
 * @returns True if the language is supported
 */
export function isLanguageSupported(language: string | null): boolean {
  if (!language) return false;
  return getSupportedLanguages().includes(language);
}
