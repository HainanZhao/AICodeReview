import { fixupConfigRules } from '@eslint/compat';
import pluginJs from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import pluginPrettier from 'eslint-plugin-prettier';
import pluginReactConfig from 'eslint-plugin-react/configs/recommended.js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // TypeScript files that are part of projects
    files: ['cli/**/*.{ts,tsx}', 'frontend/**/*.{ts,tsx}', 'types.ts'],
    extends: [
      pluginJs.configs.recommended,
      ...tseslint.configs.recommended,
      ...fixupConfigRules(pluginReactConfig),
      prettierConfig,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.json', './cli/tsconfig.json', './frontend/tsconfig.json'],
      },
    },
    plugins: {
      prettier: pluginPrettier,
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    // JavaScript files (non-TypeScript projects)
    files: ['**/*.{js,mjs,cjs,jsx}'],
    ignores: ['debug/**/*', 'scripts/**/*'], // Will be handled by separate config
    extends: [pluginJs.configs.recommended, prettierConfig],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      prettier: pluginPrettier,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },
  {
    // Override for debug files and scripts - simple JavaScript linting only
    files: ['debug/**/*.js', 'scripts/**/*.{js,cjs}'],
    extends: [pluginJs.configs.recommended],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-redeclare': 'off', // Allow redeclaring built-ins in debug scripts
    },
  },
  {
    ignores: [
      'dist',
      'node_modules',
      'frontend/dist',
      'frontend/node_modules',
      'debug/**/*.js',
      'scripts/**/*.{js,cjs}',
      '**/*.d.ts', // Ignore all declaration files
      '.prettierrc.cjs', // Ignore prettier config file
    ],
  }
);
