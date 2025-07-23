import { AppConfig } from './configSchema.js';

export const DEFAULT_CONFIG: AppConfig = {
  server: {
    port: 5960,
    host: 'localhost'
  },
  llm: {
    provider: 'gemini-cli'
  },
  ui: {
    theme: 'light',
    autoOpen: true
  }
};
