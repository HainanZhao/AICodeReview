import { AppConfig } from './configSchema.js';

export const DEFAULT_CONFIG: AppConfig = {
  server: {
    port: 5960,
    host: 'localhost',
    subPath: '',
  },
  llm: {
    provider: 'gemini-cli',
  },
  ui: {
    autoOpen: true,
  },
  // gitlab config is optional and will be added via --init wizard
};
