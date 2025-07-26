import { AppConfig } from '../config/configSchema.js';
import { ConfigLoader } from '../config/configLoader.js';

/**
 * Validates configuration for CLI review mode
 */
export class CLIConfigValidator {
  /**
   * Validates that all required configuration is present for CLI review
   */
  static validateForReview(config: AppConfig): void {
    // Validate GitLab configuration
    ConfigLoader.validateGitLabConfig(config);

    // Validate LLM configuration
    this.validateLLMConfig(config);
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
  export GITLAB_URL=https://gitlab.p.ghpr.asia
  export GITLAB_ACCESS_TOKEN=glpat-your-token-here
  export LLM_PROVIDER=gemini
  export LLM_API_KEY=your-api-key-here
`;
  }
}
