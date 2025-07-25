export interface LLMConfig {
  provider: 'gemini-cli' | 'gemini' | 'anthropic';
  apiKey?: string;
  googleCloudProject?: string;
}

export interface ServerConfig {
  port: number;
  host: string;
}

export interface UIConfig {
  theme: 'light' | 'dark' | 'auto';
  autoOpen: boolean;
}

export interface AppConfig {
  server: ServerConfig;
  llm: LLMConfig;
  ui: UIConfig;
}

export const CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    server: {
      type: 'object',
      properties: {
        port: { type: 'number', minimum: 1, maximum: 65535 },
        host: { type: 'string' },
      },
      required: ['port', 'host'],
    },
    llm: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['gemini-cli', 'gemini', 'anthropic'],
        },
        apiKey: { type: 'string' },
        googleCloudProject: { type: 'string' },
      },
      required: ['provider'],
    },
    ui: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          enum: ['light', 'dark', 'auto'],
        },
        autoOpen: { type: 'boolean' },
      },
      required: ['theme', 'autoOpen'],
    },
  },
  required: ['server', 'llm', 'ui'],
};
