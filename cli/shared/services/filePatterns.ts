/**
 * File patterns for identifying non-meaningful files to exclude from AI prompts
 */

/**
 * Patterns for files that typically don't contain meaningful code logic
 * and should be excluded from full file content in prompts
 */
export const NON_MEANINGFUL_FILE_PATTERNS = [
  // Package managers
  'package-lock.json',
  'package.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'composer.lock',
  'pipfile.lock',
  'poetry.lock',
  'cargo.lock',
  'gemfile.lock',
  'go.sum',

  // Build artifacts and dependencies
  'node_modules/',
  'vendor/',
  'target/',
  'build/',
  'dist/',
  '.next/',
  '.nuxt/',

  // IDE and editor files
  '.vscode/',
  '.idea/',
  '*.iml',

  // Version control
  '.git/',
  '.gitignore',

  // Large data files
  '*.min.js',
  '*.min.css',
  '*.bundle.js',
  '*.chunk.js',

  // Binary or media files (though these shouldn't be in diffs usually)
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.ico',
  '*.pdf',
  '*.zip',
  '*.tar.gz',

  // Generated documentation
  'docs/api/',
  'coverage/',

  // Common text/documentation files
  '*.md',
  '*.txt',
  '*.rst',
  '*.adoc',
  'readme',
  'license',
  'changelog',
  'contributing',

  // Configuration files that are typically large and auto-generated
  'webpack.config.js',
  'vite.config.js',
  'rollup.config.js',

  // Test files
  '*.test.js',
  '*.test.ts',
  '*.test.jsx',
  '*.test.tsx',
  '*.spec.js',
  '*.spec.ts',
  '*.spec.jsx',
  '*.spec.tsx',
  '*.snap',
  '__tests__/',
  '__mocks__/',
  'test/',
  'tests/',
  'e2e/',
  'cypress/',
  'playwright.config.ts',
  'playwright.config.js',
  'jest.config.js',
  'jest.config.ts',
  'vitest.config.js',
  'vitest.config.ts',
  'karma.conf.js',
  'protractor.conf.js',

  // Storybook files
  '*.stories.ts',
  '*.stories.tsx',
  '*.stories.js',
  '*.stories.jsx',
  '*.story.ts',
  '*.story.tsx',
  '*.story.js',
  '*.story.jsx',
  '.storybook/',

  // CSS/preprocessor files
  '*.css',
  '*.scss',
  '*.sass',
  '*.less',
  '*.styl',

  // Stylesheet config files
  'postcss.config.js',
  'postcss.config.ts',
  'tailwind.config.js',
  'tailwind.config.ts',

  // Type declaration files
  '*.d.ts',

  // Environment files
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',

  // i18n/locale files
  '*.json', // Often translation files
  'locales/',
  'i18n/',
  'translations/',

  // Database migrations and seeds
  'migrations/',
  'seeds/',
  '*.migration.ts',
  '*.seed.ts',
] as const;

/**
 * Checks if a file path matches non-meaningful file patterns
 * @param filePath - The file path to check
 * @returns true if the file should be skipped (is non-meaningful)
 */
export function isNonMeaningfulFile(filePath: string): boolean {
  const fileName = filePath.toLowerCase();
  const baseName = fileName.split('/').pop() || '';

  // Lock files
  if (
    baseName.includes('lock') &&
    (baseName.endsWith('.json') || baseName.endsWith('.yaml') || baseName.endsWith('.yml'))
  ) {
    return true;
  }

  return NON_MEANINGFUL_FILE_PATTERNS.some((pattern) => {
    if (pattern.endsWith('/')) {
      return fileName.includes(pattern);
    }
    if (pattern.startsWith('*.')) {
      return baseName.endsWith(pattern.substring(1));
    }
    return baseName === pattern || fileName.endsWith(`/${pattern}`);
  });
}
