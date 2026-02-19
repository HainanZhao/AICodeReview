export interface LLMConfig {
  provider: 'gemini-cli' | 'gemini' | 'anthropic';
  apiKey?: string;
  googleCloudProject?: string;
  timeout?: number; // Timeout in milliseconds for AI requests (default: 240000ms = 4 minutes)
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
  promptFile?: string; // Global fallback prompt file
  promptStrategy?: 'append' | 'prepend' | 'replace'; // Global fallback strategy
  projectPrompts?: Record<
    string,
    {
      promptFile?: string;
      promptStrategy?: 'append' | 'prepend' | 'replace';
    }
  >; // Per-project prompts: { "project-name": { promptFile: "path", strategy: "append" } }
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
        timeout: { type: 'number', minimum: 30000, maximum: 600000 }, // 30s to 10min
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
        promptStrategy: {
          type: 'string',
          enum: ['append', 'prepend', 'replace'],
          default: 'append',
        }, // How to merge custom prompt with default
        projectPrompts: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              promptFile: { type: 'string' },
              promptStrategy: {
                type: 'string',
                enum: ['append', 'prepend', 'replace'],
                default: 'append',
              },
            },
          },
        }, // Per-project custom prompts
      },
      required: ['enabled', 'projects', 'interval'],
    },
  },
  required: ['server', 'llm', 'ui'],
};
