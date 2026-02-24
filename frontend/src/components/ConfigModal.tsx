import type React from 'react';
import { useEffect, useState } from 'react';
import { saveConfig } from '../services/configService';
import type { Config } from '../types';
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
        className="absolute inset-0 bg-[#0a0a0f]/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      <div className="relative cyber-card cyber-neon-border--cyan w-full max-w-lg overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-300 shadow-[0_0_30px_rgba(0,240,255,0.2)]">
        <div className="cyber-card__header flex justify-between items-center p-6 border-b border-[#00f0ff]/20 bg-[#00f0ff]/5">
          <div>
            <h2
              className="text-xl font-bold text-[#ececec] tracking-widest uppercase cyber-glitch"
              data-text="CONFIGURATION"
            >
              CONFIGURATION
            </h2>
            <div className="mt-2 flex items-center">
              <div
                className={`w-2 h-2 mr-2 ${configSource !== 'none' ? 'bg-[#05ffa1] shadow-[0_0_8px_rgba(5,255,161,0.6)]' : 'bg-[#fdee06] animate-pulse shadow-[0_0_8px_rgba(253,238,6,0.6)]'}`}
              />
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa] cyber-text-glow">
                {configSource === 'localStorage' && '// SESSION: PERSISTENCE_ACTIVE'}
                {configSource === 'backend' && '// SYSTEM: REMOTE_CONFIG_SYNCED'}
                {configSource === 'none' && '// STATUS: AWAITING_CONNECTION'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cyber-btn cyber-btn--ghost cyber-btn--xs opacity-70 hover:opacity-100"
            aria-label="Close settings"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-6 bg-transparent">
          <div className="space-y-3">
            <label
              htmlFor="gitlab-url"
              className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#00f0ff] ml-1"
            >
              GITLAB_INSTANCE_ENDPOINT
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
                placeholder="HTTPS://GITLAB.EXAMPLE.COM"
                className="cyber-input w-full p-3 bg-transparent text-[#00f0ff] font-mono text-sm focus:outline-none transition-all disabled:opacity-50"
                disabled={isBackendConfigUsed}
              />
              {isBackendConfigUsed && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <span className="text-[9px] font-bold uppercase tracking-widest bg-[#00f0ff]/10 text-[#00f0ff] px-2 py-0.5 border border-[#00f0ff]/30 shadow-[0_0_5px_rgba(0,240,255,0.2)]">
                    LOCKED
                  </span>
                </div>
              )}
            </div>

            {isBackendConfigUsed ? (
              <div className="flex items-center text-[10px] font-bold text-[#a1a1aa] bg-[#00f0ff]/5 p-3 border border-[#00f0ff]/10 uppercase tracking-tight">
                <svg
                  className="w-4 h-4 mr-3 text-[#00f0ff] opacity-60"
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
                {/* // MANAGED_BY_ENVIRONMENT_VARIABLES */}
              </div>
            ) : (
              backendConfig?.url && (
                <button
                  type="button"
                  onClick={() => {
                    setGitlabUrl(backendConfig.url!);
                    setIsBackendConfigUsed(true);
                  }}
                  className="text-[10px] font-bold text-[#00f0ff] hover:text-[#00f0ff]/80 transition-colors ml-1 uppercase tracking-widest underline underline-offset-4"
                >
                  RESTORE_TO_BACKEND_DEFAULTS ({backendConfig.url})
                </button>
              )
            )}
          </div>

          <div className="space-y-3">
            <label
              htmlFor="access-token"
              className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#00f0ff] ml-1"
            >
              SECURE_ACCESS_TOKEN
            </label>
            <div className="relative group">
              <input
                id="access-token"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="PASTE_PERSONAL_ACCESS_TOKEN..."
                className="cyber-input w-full p-3 bg-transparent text-[#00f0ff] font-mono text-sm focus:outline-none transition-all"
              />
            </div>
            <div className="flex items-start bg-[#00f0ff]/5 p-4 border border-[#00f0ff]/10">
              <svg
                className="w-4 h-4 mr-4 text-[#00f0ff] opacity-60 flex-shrink-0 mt-0.5"
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
              <p className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-widest leading-relaxed">
                REQUIRES <span className="text-[#00f0ff]">API</span> AND{' '}
                <span className="text-[#00f0ff]">READ_API</span> PERMISSIONS.
                TOKENS_ENCRYPTED_IN_LOCAL_STORAGE.
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-[#00f0ff]/5 border-t border-[#00f0ff]/20 flex justify-between items-center backdrop-blur-sm">
          <button
            onClick={onClose}
            className="text-[10px] font-bold text-[#a1a1aa] hover:text-[#ececec] transition-all px-4 py-2 uppercase tracking-[0.3em]"
          >
            DISCARD
          </button>
          <button
            onClick={handleSave}
            disabled={!gitlabUrl.trim() || !accessToken.trim()}
            className="cyber-btn cyber-btn--magenta cyber-btn--sm"
          >
            APPLY_CHANGES
          </button>
        </div>
      </div>
    </div>
  );
};
