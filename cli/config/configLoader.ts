import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { AppConfig } from './configSchema.js';
import { DEFAULT_CONFIG } from './defaultConfig.js';

export interface CLIOptions {
  port?: string;
  host?: string;
  provider?: string;
  apiKey?: string;
  googleCloudProject?: string;
  open?: boolean;
  apiOnly?: boolean;
  subPath?: string;
}

export class ConfigLoader {
  private static getConfigPaths(): string[] {
    return [join(homedir(), '.aicodereview', 'config.json')];
  }

  hasConfig(): boolean {
    return ConfigLoader.getConfigPaths().some(existsSync);
  }

  static loadConfig(cliOptions: CLIOptions = {}): AppConfig {
    let config = { ...DEFAULT_CONFIG };
    let loadedConfigPath: string | null = null;

    // Load config from the first path that exists
    for (const configPath of this.getConfigPaths()) {
      if (existsSync(configPath)) {
        try {
          const fileConfig = JSON.parse(readFileSync(configPath, 'utf8'));
          config = this.mergeConfigs(config, fileConfig);
          loadedConfigPath = configPath;
          break; // Stop after finding the first valid config
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`⚠ Warning: Could not load config file ${configPath}: ${errorMessage}`);
        }
      }
    }

    if (loadedConfigPath) {
      console.log(`✓ Loaded config from: ${loadedConfigPath}`);
    }

    // Override with environment variables
    config = this.applyEnvironmentVariables(config);

    // Override with CLI options
    config = this.applyCLIOptions(config, cliOptions);

    // Validate config
    this.validateConfig(config);

    return config;
  }

  private static applyEnvironmentVariables(config: AppConfig): AppConfig {
    const envConfig = { ...config };

    if (process.env.LLM_PROVIDER) {
      envConfig.llm.provider = process.env.LLM_PROVIDER as 'gemini-cli' | 'gemini' | 'anthropic';
    }

    if (process.env.LLM_API_KEY || process.env.GEMINI_API_KEY) {
      envConfig.llm.apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY;
    }

    if (process.env.GOOGLE_CLOUD_PROJECT) {
      envConfig.llm.googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
    }

    if (process.env.AICR_PORT) {
      envConfig.server.port = parseInt(process.env.AICR_PORT, 10);
    }

    if (process.env.AICR_HOST) {
      envConfig.server.host = process.env.AICR_HOST;
    }

    if (process.env.AICR_SUB_PATH) {
      envConfig.server.subPath = process.env.AICR_SUB_PATH;
    }

    // GitLab environment variables
    if (process.env.GITLAB_URL || process.env.GITLAB_ACCESS_TOKEN) {
      if (!envConfig.gitlab) {
        envConfig.gitlab = { url: '', accessToken: '' };
      }
      if (process.env.GITLAB_URL) {
        envConfig.gitlab.url = process.env.GITLAB_URL;
      }
      if (process.env.GITLAB_ACCESS_TOKEN) {
        envConfig.gitlab.accessToken = process.env.GITLAB_ACCESS_TOKEN;
      }
    }

    return envConfig;
  }

  private static applyCLIOptions(config: AppConfig, options: CLIOptions): AppConfig {
    const newConfig = { ...config };

    if (options.port) {
      newConfig.server.port = parseInt(options.port, 10);
    }

    if (options.host) {
      newConfig.server.host = options.host;
    }

    if (options.provider) {
      newConfig.llm.provider = options.provider as 'gemini-cli' | 'gemini' | 'anthropic';
    }

    if (options.apiKey) {
      newConfig.llm.apiKey = options.apiKey;
    }

    if (options.googleCloudProject) {
      newConfig.llm.googleCloudProject = options.googleCloudProject;
    }

    if (options.open !== undefined) {
      newConfig.ui.autoOpen = options.open;
    }

    if (options.subPath) {
      newConfig.server.subPath = options.subPath;
    }

    return newConfig;
  }

  private static mergeConfigs(base: AppConfig, override: Partial<AppConfig>): AppConfig {
    const merged: AppConfig = {
      server: { ...base.server, ...override.server },
      llm: { ...base.llm, ...override.llm },
      ui: { ...base.ui, ...override.ui },
    };

    // Handle optional gitlab config
    if (override.gitlab && override.gitlab.url && override.gitlab.accessToken) {
      merged.gitlab = {
        url: override.gitlab.url,
        accessToken: override.gitlab.accessToken,
        defaultProject: override.gitlab.defaultProject,
      };
    } else if (base.gitlab) {
      merged.gitlab = base.gitlab;
    }

    // Handle optional autoReview config
    if (override.autoReview) {
      merged.autoReview = {
        enabled: override.autoReview.enabled,
        projects: override.autoReview.projects,
        interval: override.autoReview.interval,
        state: override.autoReview.state,
        promptFile: override.autoReview.promptFile,
      };
    } else if (base.autoReview) {
      merged.autoReview = base.autoReview;
    }

    return merged;
  }

  private static validateConfig(config: AppConfig): void {
    // Validate provider-specific requirements
    if (config.llm.provider === 'gemini-cli' && !config.llm.googleCloudProject) {
      console.warn('⚠ Warning: GOOGLE_CLOUD_PROJECT not set for gemini-cli provider');
    }

    if (
      (config.llm.provider === 'gemini' || config.llm.provider === 'anthropic') &&
      !config.llm.apiKey
    ) {
      throw new Error(
        `API key is required for ${config.llm.provider} provider. Set it via --api-key flag, config file, or LLM_API_KEY environment variable.`
      );
    }

    // Validate port range
    if (config.server.port < 1 || config.server.port > 65535) {
      throw new Error(`Invalid port number: ${config.server.port}. Must be between 1 and 65535.`);
    }
  }

  /**
   * Validate GitLab configuration is present and valid for CLI review mode
   */
  static validateGitLabConfig(config: AppConfig): void {
    if (!config.gitlab) {
      throw new Error(
        'GitLab configuration is missing. Please run `aicodereview --init` to configure GitLab access, or set GITLAB_URL and GITLAB_ACCESS_TOKEN environment variables.'
      );
    }

    if (!config.gitlab.url) {
      throw new Error(
        'GitLab URL is missing. Please set it via config file or GITLAB_URL environment variable.'
      );
    }

    if (!config.gitlab.accessToken) {
      throw new Error(
        'GitLab access token is missing. Please set it via config file or GITLAB_ACCESS_TOKEN environment variable.'
      );
    }

    // Basic URL validation
    try {
      new URL(config.gitlab.url);
    } catch {
      throw new Error(`Invalid GitLab URL: ${config.gitlab.url}`);
    }
  }
}
