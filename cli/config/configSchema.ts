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
  autoOpen: boolean;
}

export interface GitLabConfig {
  url: string;
  accessToken: string;
  defaultProject?: string;
}

export interface AutoReviewConfig {
  enabled: boolean;
  projects: string[];
  interval: number;
  state?: StateConfig;
  promptFile?: string; // Optional path to custom prompt file
}

export interface StateConfig {
  storage: 'local' | 'snippet';
}

export interface AppConfig {
  server: ServerConfig;
  llm: LLMConfig;
  ui: UIConfig;
  gitlab?: GitLabConfig; // Optional GitLab section
  autoReview?: AutoReviewConfig;
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
        autoOpen: { type: 'boolean' },
      },
      required: ['autoOpen'],
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
    autoReview: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        projects: {
          type: 'array',
          items: { type: 'string' }, // Changed from number to string
        },
        interval: { type: 'number', minimum: 30 }, // Minimum 30 seconds
        state: {
          type: 'object',
          properties: {
            storage: {
              type: 'string',
              enum: ['local', 'snippet'],
            },
          },
          required: ['storage'],
        },
        dryRun: { type: 'boolean' },
        verbose: { type: 'boolean' },
        promptFile: { type: 'string' }, // Optional path to custom prompt file
      },
      required: ['enabled', 'projects', 'interval'],
    },
  },
  required: ['server', 'llm', 'ui'],
};
