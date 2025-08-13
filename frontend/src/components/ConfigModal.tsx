import React, { useState, useEffect } from 'react';
import { Config } from '../types';
import { saveConfig, resetToBackendConfig } from '../services/configService';
import { CloseIcon } from './icons';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Config) => void;
  initialConfig: Config | null;
  backendConfig?: {
    url?: string;
    hasAccessToken?: boolean;
    configSource?: string;
  } | null;
  configSource?: 'localStorage' | 'backend' | 'none';
}

const availableThemes = [
  'a11y-dark', 'a11y-one-light', 'atom-dark', 'base16-ateliersulphurpool.light', 'cb', 'coldark-cold', 'coldark-dark', 'coy-without-shadows', 'coy', 'darcula', 'dark', 'dracula', 'duotone-dark', 'duotone-earth', 'duotone-forest', 'duotone-light', 'duotone-sea', 'duotone-space', 'funky', 'ghcolors', 'gruvbox-dark', 'gruvbox-light', 'holi-theme', 'hopscotch', 'lucario', 'material-dark', 'material-light', 'material-oceanic', 'night-owl', 'nord', 'okaidia', 'one-dark', 'one-light', 'pojoaque', 'prism', 'shades-of-purple', 'solarized-dark-atom', 'solarizedlight', 'synthwave84', 'tomorrow', 'twilight', 'vs-dark', 'vs', 'vsc-dark-plus', 'xonokai', 'z-touch'
];

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
  backendConfig,
  configSource,
}) => {
  const [gitlabUrl, setGitlabUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [codeTheme, setCodeTheme] = useState('');
  const [isBackendConfigUsed, setIsBackendConfigUsed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const loadInitialConfig = async () => {
        // Priority: localStorage config > backend config > defaults
        if (configSource === 'localStorage' && initialConfig) {
          // User has localStorage config
          setGitlabUrl(initialConfig.url);
          setAccessToken(initialConfig.accessToken);
          setCodeTheme(initialConfig.codeTheme || 'default');
          setIsBackendConfigUsed(false);
        } else if (backendConfig?.url) {
          // Use backend config
          setGitlabUrl(backendConfig.url);
          setAccessToken(initialConfig?.accessToken || '');
          setCodeTheme(initialConfig?.codeTheme || 'default');
          setIsBackendConfigUsed(true);
        } else {
          // No config available, use defaults
          setGitlabUrl(initialConfig?.url || 'https://gitlab.com');
          setAccessToken(initialConfig?.accessToken || '');
          setCodeTheme(initialConfig?.codeTheme || 'default');
          setIsBackendConfigUsed(false);
        }
      };
      loadInitialConfig();
    }
  }, [isOpen, initialConfig, backendConfig, configSource]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    const newConfig: Config = {
      url: gitlabUrl.trim().replace(/\/$/, ''),
      accessToken: accessToken.trim(),
      codeTheme: codeTheme,
    };
    saveConfig(newConfig);
    onSave(newConfig);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center"
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-white dark:bg-brand-surface rounded-lg shadow-2xl w-full max-w-md m-4 transform transition-all">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-brand-primary">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Configuration</h2>
            {configSource === 'localStorage' && (
              <p className="text-xs text-gray-500 dark:text-brand-subtle">
                Using your saved configuration
              </p>
            )}
            {configSource === 'backend' && (
              <p className="text-xs text-gray-500 dark:text-brand-subtle">
                Backend configuration available
              </p>
            )}
            {configSource === 'none' && (
              <p className="text-xs text-gray-500 dark:text-brand-subtle">
                Please configure your GitLab connection
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-brand-subtle hover:text-gray-900 dark:hover:text-white transition-colors"
            aria-label="Close settings"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label
              htmlFor="gitlab-url"
              className="block text-sm font-medium text-gray-600 dark:text-brand-subtle mb-2"
            >
              GitLab URL
            </label>
            <input
              id="gitlab-url"
              type="text"
              value={gitlabUrl}
              onChange={(e) => {
                setGitlabUrl(e.target.value);
                setIsBackendConfigUsed(false); // User is overriding backend config
              }}
              placeholder="https://gitlab.com"
              className="w-full p-3 bg-gray-100 dark:bg-brand-primary border border-gray-300 dark:border-brand-primary/50 text-gray-800 dark:text-brand-text font-mono text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary"
              disabled={isBackendConfigUsed} // Disable if loaded from backend
            />
            {isBackendConfigUsed && (
              <p className="text-xs text-gray-500 dark:text-brand-subtle mt-1">
                Pre-configured from backend environment variables.
                {configSource === 'localStorage' && ' You can override this by changing the URL.'}
              </p>
            )}
            {!isBackendConfigUsed && backendConfig?.url && (
              <button
                type="button"
                onClick={() => {
                  setGitlabUrl(backendConfig.url!);
                  setIsBackendConfigUsed(true);
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
              >
                Use backend configuration ({backendConfig.url})
              </button>
            )}
            <p className="text-xs text-gray-500 dark:text-brand-subtle mt-1">
              The base URL of your GitLab instance.
            </p>
          </div>
          <div>
            <label
              htmlFor="code-theme"
              className="block text-sm font-medium text-gray-600 dark:text-brand-subtle mb-2"
            >
              Code Highlighting Theme
            </label>
            <select
              id="code-theme"
              value={codeTheme}
              onChange={(e) => setCodeTheme(e.target.value)}
              className="w-full p-3 bg-gray-100 dark:bg-brand-primary border border-gray-300 dark:border-brand-primary/50 text-gray-800 dark:text-brand-text font-mono text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary"
            >
              <option value="default">Default</option>
              {availableThemes.map((theme) => (
                <option key={theme} value={theme}>
                  {theme}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-brand-subtle mt-1">
              Select your preferred theme for syntax highlighting.
            </p>
          </div>
          <div>
            <label
              htmlFor="access-token"
              className="block text-sm font-medium text-gray-600 dark:text-brand-subtle mb-2"
            >
              Personal Access Token
            </label>
            <input
              id="access-token"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
              className="w-full p-3 bg-gray-100 dark:bg-brand-primary border border-gray-300 dark:border-brand-primary/50 text-gray-800 dark:text-brand-text font-mono text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary"
            />
            <p className="text-xs text-gray-500 dark:text-brand-subtle mt-1">
              Requires &apos;api&apos; and &apos;read_api&apos; scopes. Your token is stored in your
              browser&apos;s local storage.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 dark:bg-brand-bg/50 border-t border-gray-200 dark:border-brand-primary/20 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="text-xs text-gray-500 dark:text-brand-subtle">
              {configSource === 'localStorage' && 'Configuration will be saved to browser'}
              {configSource === 'backend' && 'Using backend configuration'}
              {configSource === 'none' && 'New configuration will be saved to browser'}
            </div>
            {configSource === 'localStorage' && backendConfig?.url && (
              <button
                onClick={() => {
                  resetToBackendConfig();
                  setGitlabUrl(backendConfig.url!);
                  setAccessToken('');
                  setIsBackendConfigUsed(true);
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Reset to backend config
              </button>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={!gitlabUrl.trim() || !accessToken.trim()}
            className="bg-brand-secondary hover:bg-red-600 disabled:bg-gray-300 dark:disabled:bg-brand-primary disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-md transition-all duration-300"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
