/**
 * Shared configuration service for both backend and CLI standalone servers
 * Provides unified configuration loading and API endpoint handling
 */

import { Request, Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { GitLabConfig } from '../types/gitlab.js';

export interface ConfigServiceOptions {
  /**
   * Override CLI config path (useful for testing)
   */
  cliConfigPath?: string;
  /**
   * Whether this is running in CLI standalone mode vs backend service mode
   */
  isStandalone?: boolean;
}

export interface ConfigResponse {
  gitlabUrl: string;
  hasGitlabUrl: boolean;
  hasAccessToken: boolean;
  configSource: string;
  accessToken?: string;
}

export interface CLIConfig {
  gitlab?: GitLabConfig;
  server?: {
    port?: number;
    host?: string;
  };
  llm?: {
    provider?: string;
    apiKey?: string;
    googleCloudProject?: string;
  };
  ui?: {
    theme?: string;
    autoOpen?: boolean;
  };
}

/**
 * Shared configuration service that handles:
 * 1. Loading configuration from CLI config files and environment variables
 * 2. Providing unified /api/config endpoint handler
 * 3. Determining configuration source and metadata
 */
export class ConfigService {
  private cliConfig: CLIConfig | null = null;
  private gitlabConfig: GitLabConfig = { url: '', accessToken: '' };
  private options: ConfigServiceOptions;

  constructor(options: ConfigServiceOptions = {}) {
    this.options = options;
    this.loadConfiguration();
  }

  /**
   * Load configuration from CLI config file and environment variables
   */
  private loadConfiguration(): void {
    // Load CLI config from ~/.aicodereview/config.json
    this.cliConfig = this.loadCLIConfig();

    // Load GitLab configuration with priority: CLI config > environment variables
    this.gitlabConfig = {
      url: this.cliConfig?.gitlab?.url || process.env.GITLAB_URL || '',
      accessToken: this.cliConfig?.gitlab?.accessToken || process.env.GITLAB_ACCESS_TOKEN || '',
    };
  }

  /**
   * Load CLI config from file system
   */
  private loadCLIConfig(): CLIConfig | null {
    try {
      const configPath =
        this.options.cliConfigPath || join(homedir(), '.aicodereview', 'config.json');
      if (existsSync(configPath)) {
        const configData = readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.warn(
        'Warning: Could not load CLI config:',
        error instanceof Error ? error.message : error
      );
    }
    return null;
  }

  /**
   * Get current GitLab configuration
   */
  public getGitLabConfig(): GitLabConfig {
    return this.gitlabConfig;
  }

  /**
   * Get CLI configuration (if available)
   */
  public getCLIConfig(): CLIConfig | null {
    return this.cliConfig;
  }

  /**
   * Generate configuration response for API endpoint
   */
  public getConfigResponse(): ConfigResponse {
    const response: ConfigResponse = {
      gitlabUrl: this.gitlabConfig.url,
      hasGitlabUrl: Boolean(this.gitlabConfig.url),
      hasAccessToken: Boolean(this.gitlabConfig.accessToken),
      configSource: this.determineConfigSource(),
    };

    // Include access token if it comes from CLI config (user's local config)
    // This is safe because the user has already configured it locally
    if (this.cliConfig?.gitlab && this.gitlabConfig.accessToken) {
      response.accessToken = this.gitlabConfig.accessToken;
    }

    return response;
  }

  /**
   * Determine the source of the current configuration
   */
  private determineConfigSource(): string {
    if (this.options.isStandalone) {
      return 'cli-config';
    }
    return this.cliConfig?.gitlab ? 'cli-config' : 'backend-env';
  }

  /**
   * Express middleware handler for /api/config endpoint
   */
  public getConfigHandler() {
    return (req: Request, res: Response) => {
      const response = this.getConfigResponse();
      res.json(response);
    };
  }

  /**
   * Refresh configuration (reload from files and environment)
   */
  public refresh(): void {
    this.loadConfiguration();
  }

  /**
   * Check if configuration is valid (has required GitLab settings)
   */
  public isValid(): boolean {
    return Boolean(this.gitlabConfig.url && this.gitlabConfig.accessToken);
  }

  /**
   * Get configuration source description for logging
   */
  public getConfigSourceDescription(): string {
    if (this.cliConfig?.gitlab) {
      return 'CLI config file (~/.aicodereview/config.json)';
    }
    if (process.env.GITLAB_URL || process.env.GITLAB_ACCESS_TOKEN) {
      return 'Environment variables (GITLAB_URL, GITLAB_ACCESS_TOKEN)';
    }
    return 'No configuration found';
  }
}

/**
 * Factory function to create ConfigService instance
 */
export function createConfigService(options: ConfigServiceOptions = {}): ConfigService {
  return new ConfigService(options);
}
