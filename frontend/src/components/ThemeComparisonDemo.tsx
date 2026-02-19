import type React from 'react';
import { useState } from 'react';
import { SyntaxHighlightedCode } from './SyntaxHighlightedCode';

const testCode = `interface User {
  id: number;
  name: string;
  email?: string;
}

const createUser = (data: Partial<User>): User => {
  return {
    id: Date.now(),
    name: data.name || 'Anonymous',
    ...data
  };
};

// This is a comment
function processUsers(users: User[]): void {
  users.forEach(user => {
    console.log(\`Processing user: \${user.name}\`);
  });
}`;

const availableThemes = [
  'default',
  'prism',
  'github',
  'vscDarkPlus',
  'oneDark',
  'atomDark',
  'duotoneDark',
  'duotoneLight',
  'materialDark',
  'materialLight',
  'nord',
  'dracula',
  'gruvboxDark',
  'gruvboxLight',
];

interface ThemeComparisonDemoProps {
  isDarkMode?: boolean;
}

export const ThemeComparisonDemo: React.FC<ThemeComparisonDemoProps> = ({ isDarkMode = false }) => {
  const [selectedTheme, setSelectedTheme] = useState('default');

  return (
    <div className="p-6 space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          Theme Override Fix Demo
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          This demo shows how reducing overrides allows individual React themes to display properly
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-4">
          Select Theme:
        </label>
        {availableThemes.map((theme) => (
          <button
            key={theme}
            onClick={() => setSelectedTheme(theme)}
            className={`px-3 py-1 text-xs rounded-md border transition-colors ${
              selectedTheme === theme
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {theme}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
          <div className="bg-red-50 dark:bg-red-900/20 px-4 py-2 border-b border-red-200 dark:border-red-800">
            <h3 className="font-semibold text-red-800 dark:text-red-200 text-sm">
              ❌ Before: Heavy Overrides (Simulated)
            </h3>
            <p className="text-xs text-red-600 dark:text-red-300 mt-1">
              Custom themes would be masked by extensive layout/style overrides
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 p-4">
            <pre
              className="font-mono text-sm text-gray-800 dark:text-gray-200 text-left"
              style={{ textAlign: 'left' }}
            >
              <code>{testCode}</code>
            </pre>
          </div>
        </div>

        <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
          <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2 border-b border-green-200 dark:border-green-800">
            <h3 className="font-semibold text-green-800 dark:text-green-200 text-sm">
              ✅ After: Minimal Overrides (Current: {selectedTheme})
            </h3>
            <p className="text-xs text-green-600 dark:text-green-300 mt-1">
              Individual themes show their intended colors while maintaining diff compatibility
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 p-4">
            <pre className="font-mono text-sm text-left" style={{ textAlign: 'left' }}>
              <SyntaxHighlightedCode
                code={testCode}
                filePath="example.tsx"
                isDarkMode={isDarkMode}
                codeTheme={selectedTheme}
                className="whitespace-pre-wrap"
              />
            </pre>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
          🔧 Technical Changes Made
        </h3>
        <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
          <li>
            • <strong>Moved layout properties</strong> from theme objects to customStyle and
            codeTagProps
          </li>
          <li>
            • <strong>Reduced theme objects</strong> to only essential syntax token colors
          </li>
          <li>
            • <strong>Added theme merging</strong> to preserve individual theme colors while
            maintaining diff compatibility
          </li>
          <li>
            • <strong>Preserved diff highlighting</strong> by keeping background transparency in CSS
          </li>
          <li>
            • <strong>Enhanced theme selection</strong> to properly apply individual React themes
          </li>
        </ul>
      </div>
    </div>
  );
};
