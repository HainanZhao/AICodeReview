import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReactConfig from 'eslint-plugin-react/configs/recommended.js';
import { fixupConfigRules } from '@eslint/compat';
import prettierConfig from 'eslint-config-prettier';
import pluginPrettier from 'eslint-plugin-prettier';

export default tseslint.config(
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
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
        project: ['./tsconfig.json', './backend/tsconfig.json', './shared/tsconfig.json'],
      },
    },
    plugins: {
      prettier: pluginPrettier,
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^' }],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    ignores: [
      'dist',
      'node_modules',
      'backend/dist',
      'backend/node_modules',
      'shared/dist',
      'shared/node_modules',
      '**/*.d.ts', // Ignore all declaration files
      '.prettierrc.cjs', // Ignore prettier config file
    ],
  }
);
