import type React from 'react';
import { useEffect, useState } from 'react';
import { resetToBackendConfig, saveConfig } from '../services/configService';
import type { Config } from '../types';
import { Button } from './Button';
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
  const [isBackendConfigUsed, setIsBackendConfigUsed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const loadInitialConfig = async () => {
        // Priority: localStorage config > backend config > defaults
        if (configSource === 'localStorage' && initialConfig) {
          // User has localStorage config
          setGitlabUrl(initialConfig.url);
          setAccessToken(initialConfig.accessToken);
          setIsBackendConfigUsed(false);
        } else if (backendConfig?.url) {
          // Use backend config
          setGitlabUrl(backendConfig.url);
          setAccessToken(initialConfig?.accessToken || '');
          setIsBackendConfigUsed(true);
        } else {
          // No config available, use defaults
          setGitlabUrl(initialConfig?.url || 'https://gitlab.com');
          setAccessToken(initialConfig?.accessToken || '');
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
    };
    saveConfig(newConfig);
    onSave(newConfig);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center items-center px-4 md:px-0"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-brand-bg/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      ></div>
      <div className="relative bg-white dark:bg-brand-surface rounded-3xl shadow-2xl dark:shadow-black/50 w-full max-w-lg overflow-hidden transform transition-all border border-gray-200 dark:border-white/5 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center p-8 border-b border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-brand-primary/20">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Configuration
            </h2>
            <div className="mt-2 flex items-center">
              <div
                className={`w-2 h-2 rounded-full mr-2 ${configSource !== 'none' ? 'bg-brand-success shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-brand-warning animate-pulse'}`}
              ></div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-brand-subtle">
                {configSource === 'localStorage' && 'Session: Persistence Enabled'}
                {configSource === 'backend' && 'System: Remote Config Loaded'}
                {configSource === 'none' && 'Status: Connection Required'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="!p-2.5 !rounded-xl"
            aria-label="Close settings"
          >
            <CloseIcon className="w-5 h-5" />
          </Button>
        </div>
        <div className="p-8 space-y-8">
          <div className="space-y-3">
            <label
              htmlFor="gitlab-url"
              className="block text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-brand-subtle ml-1"
            >
              GitLab Instance Endpoint
            </label>
            <div className="relative group">
              <input
                id="gitlab-url"
                type="text"
                value={gitlabUrl}
                onChange={(e) => {
                  setGitlabUrl(e.target.value);
                  setIsBackendConfigUsed(false);
                }}
                placeholder="https://gitlab.example.com"
                className="w-full pl-4 pr-4 py-3.5 bg-gray-50 dark:bg-brand-primary/30 border border-gray-200 dark:border-white/5 text-gray-900 dark:text-white font-mono text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-secondary/50 shadow-inner transition-all disabled:opacity-50"
                disabled={isBackendConfigUsed}
              />
              {isBackendConfigUsed && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-secondary/10 text-brand-secondary px-2 py-0.5 rounded-full border border-brand-secondary/20">
                    Locked
                  </span>
                </div>
              )}
            </div>

            {isBackendConfigUsed ? (
              <div className="flex items-center text-[10px] font-medium text-gray-500 dark:text-brand-subtle bg-gray-50 dark:bg-brand-primary/20 p-2.5 rounded-xl border border-gray-100 dark:border-white/5">
                <svg
                  className="w-3.5 h-3.5 mr-2 text-brand-secondary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Managed by backend environment variables.
              </div>
            ) : (
              backendConfig?.url && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setGitlabUrl(backendConfig.url!);
                    setIsBackendConfigUsed(true);
                  }}
                  className="!text-[11px] !font-bold !text-brand-secondary hover:!text-brand-accent !no-underline !decoration-brand-secondary/30 !underline-offset-4"
                >
                  Restore to Backend Configuration ({backendConfig.url})
                </Button>
              )
            )}
          </div>

          <div className="space-y-3">
            <label
              htmlFor="access-token"
              className="block text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-brand-subtle ml-1"
            >
              Secure Access Token
            </label>
            <div className="relative group">
              <input
                id="access-token"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Paste your personal access token..."
                className="w-full pl-4 pr-4 py-3.5 bg-gray-50 dark:bg-brand-primary/30 border border-gray-200 dark:border-white/5 text-gray-900 dark:text-white font-mono text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-secondary/50 shadow-inner transition-all"
              />
            </div>
            <div className="flex items-start bg-blue-50/50 dark:bg-blue-500/5 p-4 rounded-2xl border border-blue-100 dark:border-blue-500/10">
              <svg
                className="w-4 h-4 mr-3 text-blue-500 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <p className="text-[11px] font-medium text-blue-700/80 dark:text-blue-300/60 leading-relaxed">
                Requires <span className="font-bold text-blue-800 dark:text-blue-300">api</span> and{' '}
                <span className="font-bold text-blue-800 dark:text-blue-300">read_api</span>{' '}
                permissions. Your token remains encrypted in browser local storage and is never
                transmitted outside your GitLab instance.
              </p>
            </div>
          </div>
        </div>
        <div className="px-8 py-6 bg-gray-50/50 dark:bg-brand-primary/20 border-t border-gray-100 dark:border-white/5 flex justify-between items-center backdrop-blur-sm">
          <Button variant="ghost" onClick={onClose}>
            Discard
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleSave}
            disabled={!gitlabUrl.trim() || !accessToken.trim()}
          >
            Apply Configuration
          </Button>
        </div>
      </div>
    </div>
  );
};
