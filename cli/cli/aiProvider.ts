import type { AppConfig } from '../config/configSchema.js';
import {
  AIProviderCore,
  type AIReviewRequest,
  type AIReviewResponse,
  GeminiCliCore,
  type GeminiCliItem,
  Severity,
  buildReviewPrompt,
  parseAIResponse,
} from '../shared/index.js';

/**
 * AI provider integration for CLI mode
 */
export class CLIAIProvider {
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  /**
   * Generates an AI review using the configured provider
   */
  async generateReview(request: AIReviewRequest): Promise<AIReviewResponse> {
    // Build a comprehensive prompt that includes original file content
    const prompt = buildReviewPrompt(request);

    // Validate configuration first
    this.validateConfig();

    switch (this.config.llm.provider) {
      case 'gemini':
        return this.generateGeminiReview(prompt);
      case 'anthropic':
        return this.generateAnthropicReview(prompt);
      case 'gemini-cli':
        return this.generateGeminiCliReview(prompt);
      default:
        throw new Error(`Unsupported AI provider: ${this.config.llm.provider}`);
    }
  }

  /**
   * Generates review using Gemini API (direct Google AI)
   */
  private async generateGeminiReview(prompt: string): Promise<AIReviewResponse> {
    try {
      const aiResponse = await AIProviderCore.generateGeminiReview(this.config.llm.apiKey!, prompt);
      return parseAIResponse(JSON.stringify(aiResponse));
    } catch (error) {
      console.error('Gemini provider error:', error);
      throw new Error(
        `Gemini review failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generates review using Anthropic Claude
   */
  private async generateAnthropicReview(prompt: string): Promise<AIReviewResponse> {
    try {
      const aiResponse = await AIProviderCore.generateAnthropicReview(
        this.config.llm.apiKey!,
        prompt
      );
      return parseAIResponse(JSON.stringify(aiResponse));
    } catch (error) {
      console.error('Anthropic provider error:', error);
      throw new Error(
        `Anthropic review failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generates review using Gemini CLI tool
   */
  private async generateGeminiCliReview(prompt: string): Promise<AIReviewResponse> {
    try {
      console.log('Calling gemini CLI with --yolo flag...');

      // Use the shared GeminiCliCore directly
      const geminiItems = await GeminiCliCore.executeReview(prompt, { verbose: true });

      // Convert to our expected format
      const feedback = geminiItems.map((item: GeminiCliItem, index: number) => ({
        id: `gemini-cli-${Date.now()}-${index}`,
        filePath: String(item.filePath || '').replace(/\\/g, '/'),
        lineNumber: Number(item.lineNumber || 0),
        severity:
          item.severity === 'error'
            ? Severity.Critical
            : item.severity === 'warning'
              ? Severity.Warning
              : item.severity === 'info'
                ? Severity.Info
                : Severity.Suggestion,
        title: String(item.title || 'Code Review Comment'),
        description: String(item.description || ''),
        lineContent: '',
        position: null,
        status: 'pending' as const,
        isExisting: false,
      }));

      return {
        feedback,
        summary: `Gemini CLI review completed with ${feedback.length} recommendations.`,
        overallRating: feedback.length > 0 ? 'comment' : 'approve',
      };
    } catch (error) {
      console.error('Gemini CLI provider error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Provide a clearer error message
      if (
        errorMessage.includes('not found') ||
        errorMessage.includes('command not found') ||
        errorMessage.includes('aliased or linked to "gcloud"') ||
        errorMessage.includes('part of the Google Cloud SDK') ||
        errorMessage.includes('Could not verify the "gemini" CLI')
      ) {
        throw new Error(
          'Gemini CLI tool not found or misconfigured. Please ensure it is installed ' +
            '(npm install -g @google-ai/generative-ai-cli) and that the "gemini" command ' +
            'is available in your PATH and not conflicting with "gcloud".'
        );
      }
      throw new Error(`Gemini CLI review failed: ${errorMessage}`);
    }
  }

  /**
   * Validates that the required configuration is available for the provider
   */
  validateConfig(): void {
    switch (this.config.llm.provider) {
      case 'gemini-cli':
        // No additional config required for gemini CLI tool
        // Just need the gemini CLI tool to be installed and available
        break;
      case 'gemini':
        AIProviderCore.validateApiKey(
          this.config.llm.apiKey,
          'Gemini (use --api-key or set GOOGLE_API_KEY environment variable)'
        );
        break;
      case 'anthropic':
        AIProviderCore.validateApiKey(
          this.config.llm.apiKey,
          'Anthropic (use --api-key or set ANTHROPIC_API_KEY environment variable)'
        );
        break;
      default:
        throw new Error(`Unsupported AI provider: ${this.config.llm.provider}`);
    }
  }
}
