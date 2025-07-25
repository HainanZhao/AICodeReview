import React, { useState, useEffect } from 'react';
import { Config } from '../types';
import { saveConfig } from '../services/configService';
import { CloseIcon } from './icons';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Config) => void;
  initialConfig: Config | null;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
}) => {
  const [gitlabUrl, setGitlabUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');

  useEffect(() => {
    if (isOpen) {
      setGitlabUrl(initialConfig?.gitlabUrl || 'https://gitlab.com');
      setAccessToken(initialConfig?.accessToken || '');
    }
  }, [isOpen, initialConfig]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    const newConfig = {
      gitlabUrl: gitlabUrl.trim().replace(/\/$/, ''),
      accessToken: accessToken.trim(),
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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Configuration</h2>
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
              onChange={(e) => setGitlabUrl(e.target.value)}
              placeholder="https://gitlab.com"
              className="w-full p-3 bg-gray-100 dark:bg-brand-primary border border-gray-300 dark:border-brand-primary/50 text-gray-800 dark:text-brand-text font-mono text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-brand-secondary"
            />
            <p className="text-xs text-gray-500 dark:text-brand-subtle mt-1">
              The base URL of your GitLab instance.
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
        <div className="px-6 py-4 bg-gray-50 dark:bg-brand-bg/50 border-t border-gray-200 dark:border-brand-primary/20 flex justify-end">
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
