import type { AppConfig } from './configSchema.js';

export const DEFAULT_CONFIG: AppConfig = {
  server: {
    port: 5959,
    host: 'localhost',
    subPath: '',
  },
  llm: {
    provider: 'gemini-cli',
    timeout: 600000, // 10 minutes default timeout for AI requests
  },
  ui: {
    autoOpen: true,
  },
  autoReview: {
    enabled: false,
    projects: [],
    interval: 120,
  },
  // gitlab config is optional and will be added via --init wizard
};
