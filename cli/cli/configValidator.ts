import { ConfigLoader } from '../config/configLoader.js';
import type { AppConfig } from '../config/configSchema.js';
import { testGitLabConnection } from '../shared/index.js';

/**
 * Validates configuration for CLI review mode
 */
export class CLIConfigValidator {
  /**
   * Validates that all required configuration is present for CLI review
   */
  static async validateForReview(config: AppConfig): Promise<void> {
    // Validate GitLab configuration
    ConfigLoader.validateGitLabConfig(config);

    // Test GitLab connection (warn but don't fail if connection test fails)
    if (config.gitlab?.url && config.gitlab?.accessToken) {
      try {
        // Add timeout to prevent hanging on network issues
        const connectionPromise = testGitLabConnection(config.gitlab);
        const timeoutPromise = new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Connection test timeout after 10 seconds')), 10000)
        );

        const isConnected = await Promise.race([connectionPromise, timeoutPromise]);
        if (!isConnected) {
          console.warn(
            '⚠️  Warning: GitLab connection test failed. This may be due to network issues. Proceeding with review attempt...'
          );
        }
      } catch (error) {
        console.warn(
          '⚠️  Warning: GitLab connection test encountered an error. This may be due to network issues. Proceeding with review attempt...'
        );
        console.warn(
          `   Connection test error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Validate LLM configuration
    CLIConfigValidator.validateLLMConfig(config);
  }

  /**
   * Validates LLM configuration is complete
   */
  private static validateLLMConfig(config: AppConfig): void {
    if (!config.llm.provider) {
      throw new Error(
        'LLM provider is not configured. Please run `aicodereview --init` to set up.'
      );
    }

    switch (config.llm.provider) {
      case 'gemini':
      case 'anthropic':
        if (!config.llm.apiKey) {
          throw new Error(
            `API key is required for ${config.llm.provider} provider. Please set it via config file or LLM_API_KEY environment variable.`
          );
        }
        break;

      case 'gemini-cli':
        if (!config.llm.googleCloudProject) {
          console.warn(
            '⚠ Warning: GOOGLE_CLOUD_PROJECT not set for gemini-cli provider. This may cause issues.'
          );
        }
        break;

      default:
        throw new Error(`Unsupported LLM provider: ${config.llm.provider}`);
    }
  }

  /**
   * Provides helpful error messages for missing configuration
   */
  static getConfigSetupInstructions(): string {
    return `
To use CLI review mode, you need to configure:

1. GitLab access:
   - Run: aicodereview --init
   - Or set environment variables: GITLAB_URL and GITLAB_ACCESS_TOKEN

2. LLM provider:
   - Run: aicodereview --init
   - Or set environment variables: LLM_PROVIDER and LLM_API_KEY (if needed)

Example:
  export GITLAB_URL=https://gitlab.example.com
  export GITLAB_ACCESS_TOKEN=glpat-your-token-here
  export LLM_PROVIDER=gemini
  export LLM_API_KEY=your-api-key-here
`;
  }
}
