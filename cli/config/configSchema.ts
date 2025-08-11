export interface LLMConfig {
  provider: 'gemini-cli' | 'gemini' | 'anthropic';
  apiKey?: string;
  googleCloudProject?: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  subPath?: string;
}

export interface UIConfig {
  theme: 'light' | 'dark' | 'auto';
  autoOpen: boolean;
}

export interface GitLabConfig {
  url: string;
  accessToken: string;
  defaultProject?: string;
}

export interface AppConfig {
  server: ServerConfig;
  llm: LLMConfig;
  ui: UIConfig;
  gitlab?: GitLabConfig; // Optional GitLab section
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
    gitlab: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        accessToken: { type: 'string' },
        defaultProject: { type: 'string' },
      },
      required: ['url', 'accessToken'],
    },
  },
  required: ['server', 'llm', 'ui'],
};
