import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { AppConfig } from './configSchema.js';
import { DEFAULT_CONFIG } from './defaultConfig.js';

export interface CLIOptions {
  config?: string;
  port?: string;
  host?: string;
  provider?: string;
  apiKey?: string;
  googleCloudProject?: string;
  open?: boolean;
}

export class ConfigLoader {
  private static CONFIG_FILENAMES = [
    'aicodereview.config.json',
    '.aicodereview.json',
    'aicodereview.json'
  ];

  static loadConfig(cliOptions: CLIOptions = {}): AppConfig {
    let config = { ...DEFAULT_CONFIG };

    // 1. Load from config file
    const configFile = this.findConfigFile(cliOptions.config);
    if (configFile) {
      try {
        const fileConfig = JSON.parse(readFileSync(configFile, 'utf8'));
        config = this.mergeConfigs(config, fileConfig);
        console.log(`✓ Loaded config from: ${configFile}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`⚠ Warning: Could not load config file ${configFile}: ${errorMessage}`);
      }
    }

    // 2. Override with environment variables
    config = this.applyEnvironmentVariables(config);

    // 3. Override with CLI options
    config = this.applyCLIOptions(config, cliOptions);

    // 4. Validate config
    this.validateConfig(config);

    return config;
  }

  private static findConfigFile(customPath?: string): string | null {
    if (customPath) {
      if (existsSync(customPath)) {
        return customPath;
      } else {
        throw new Error(`Config file not found: ${customPath}`);
      }
    }

    // Check current directory
    for (const filename of this.CONFIG_FILENAMES) {
      const path = join(process.cwd(), filename);
      if (existsSync(path)) {
        return path;
      }
    }

    // Check user home directory
    const homeConfigDir = join(homedir(), '.aicodereview');
    const homeConfigPath = join(homeConfigDir, 'config.json');
    if (existsSync(homeConfigPath)) {
      return homeConfigPath;
    }

    return null;
  }

  private static applyEnvironmentVariables(config: AppConfig): AppConfig {
    const envConfig = { ...config };

    if (process.env.LLM_PROVIDER) {
      envConfig.llm.provider = process.env.LLM_PROVIDER as any;
    }

    if (process.env.LLM_API_KEY || process.env.GEMINI_API_KEY) {
      envConfig.llm.apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY;
    }

    if (process.env.GOOGLE_CLOUD_PROJECT) {
      envConfig.llm.googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
    }

    if (process.env.PORT) {
      envConfig.server.port = parseInt(process.env.PORT, 10);
    }

    if (process.env.HOST) {
      envConfig.server.host = process.env.HOST;
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
      newConfig.llm.provider = options.provider as any;
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

    return newConfig;
  }

  private static mergeConfigs(base: AppConfig, override: Partial<AppConfig>): AppConfig {
    return {
      server: { ...base.server, ...override.server },
      llm: { ...base.llm, ...override.llm },
      ui: { ...base.ui, ...override.ui }
    };
  }

  private static validateConfig(config: AppConfig): void {
    // Validate provider-specific requirements
    if (config.llm.provider === 'gemini-cli' && !config.llm.googleCloudProject) {
      console.warn('⚠ Warning: GOOGLE_CLOUD_PROJECT not set for gemini-cli provider');
    }

    if ((config.llm.provider === 'gemini' || config.llm.provider === 'anthropic') && !config.llm.apiKey) {
      throw new Error(`API key is required for ${config.llm.provider} provider. Set it via --api-key flag, config file, or LLM_API_KEY environment variable.`);
    }

    // Validate port range
    if (config.server.port < 1 || config.server.port > 65535) {
      throw new Error(`Invalid port number: ${config.server.port}. Must be between 1 and 65535.`);
    }
  }
}
