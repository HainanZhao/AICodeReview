/**
 * Shared core functionality for AI providers
 * Used by both CLI and backend implementations
 */

export interface AIProviderResponse {
  filePath: string;
  lineNumber: number;
  severity: string;
  title: string;
  description: string;
}

export interface ResponseValidationOptions {
  normalizePaths?: boolean;
  validateTypes?: boolean;
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  retryCondition?: (error: Error) => boolean;
}

/**
 * Shared utilities for AI provider implementations
 */
export class AIProviderCore {
  /**
   * Generic retry mechanism with configurable conditions
   */
  public static async retryWithCondition<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 5,
      initialDelayMs = 1000,
      retryCondition = (error: Error) => {
        const errorMessage = error.message.toLowerCase();
        return errorMessage.includes('429') || errorMessage.includes('rate limit');
      },
    } = options;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        if (i < maxRetries - 1 && retryCondition(err)) {
          const delayTime = initialDelayMs * Math.pow(2, i); // Exponential backoff
          console.warn(
            `Retry condition met. Retrying in ${delayTime / 1000} seconds... (${i + 1}/${maxRetries})`
          );
          await this.delay(delayTime);
        } else {
          throw err; // Re-throw if not retryable or max retries reached
        }
      }
    }
    throw new Error('Max retries reached');
  }

  /**
   * Parse and validate AI response text as JSON array
   */
  public static parseAIResponseArray(responseText: string): AIProviderResponse[] {
    if (!responseText || !responseText.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(responseText.trim());

      if (!Array.isArray(parsed)) {
        console.warn('Unexpected JSON structure from AI API - not an array:', typeof parsed);
        return [];
      }

      return parsed;
    } catch (error) {
      console.warn('Failed to parse AI response as JSON:', error);
      return [];
    }
  }

  /**
   * Validate and normalize AI response items
   */
  public static validateAndNormalizeResponse(
    responses: unknown[],
    options: ResponseValidationOptions = {}
  ): AIProviderResponse[] {
    const { normalizePaths = true, validateTypes = true } = options;

    return responses
      .filter((item): item is Record<string, unknown> => {
        // Basic validation
        if (!item || typeof item !== 'object') {
          console.warn('Skipping invalid response item:', item);
          return false;
        }

        if (validateTypes) {
          const obj = item as Record<string, unknown>;
          const hasRequired =
            typeof obj.title === 'string' &&
            typeof obj.description === 'string' &&
            (typeof obj.filePath === 'string' ||
              obj.filePath === null ||
              obj.filePath === undefined);

          if (!hasRequired) {
            console.warn('Skipping response item missing required fields:', item);
            return false;
          }
        }

        return true;
      })
      .map(
        (item): AIProviderResponse => ({
          filePath: normalizePaths
            ? String(item.filePath || '').replace(/\\/g, '/')
            : String(item.filePath || ''),
          lineNumber: Number(item.lineNumber) || 0,
          severity: String(item.severity || 'info'),
          title: String(item.title || 'AI Review Comment'),
          description: String(item.description || ''),
        })
      );
  }

  /**
   * Create a Gemini API client instance
   */
  public static async createGeminiClient(apiKey: string): Promise<unknown> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    return new GoogleGenerativeAI(apiKey);
  }

  /**
   * Create an Anthropic API client instance
   */
  public static async createAnthropicClient(apiKey: string): Promise<unknown> {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    return new Anthropic({ apiKey });
  }

  /**
   * Generate review using Gemini API with standard configuration
   */
  public static async generateGeminiReview(
    apiKey: string,
    prompt: string,
    options: RetryOptions = {}
  ): Promise<AIProviderResponse[]> {
    return this.retryWithCondition(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = (await this.createGeminiClient(apiKey)) as any;
        const model = client.getGenerativeModel({ model: 'gemini-1.5-pro' });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const parsedResponse = this.parseAIResponseArray(text);
        return this.validateAndNormalizeResponse(parsedResponse);
      } catch (error) {
        throw new Error(
          `Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }, options);
  }

  /**
   * Generate review using Anthropic Claude API with standard configuration
   */
  public static async generateAnthropicReview(
    apiKey: string,
    prompt: string,
    options: RetryOptions = {}
  ): Promise<AIProviderResponse[]> {
    return this.retryWithCondition(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = (await this.createAnthropicClient(apiKey)) as any;

        const response = await client.messages.create({
          model: 'claude-3-5-sonnet-20241010',
          max_tokens: 8192,
          temperature: 0.1,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
        const parsedResponse = this.parseAIResponseArray(text);
        return this.validateAndNormalizeResponse(parsedResponse);
      } catch (error) {
        throw new Error(
          `Anthropic API error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }, options);
  }

  /**
   * Helper for creating delays
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate API key configuration
   */
  public static validateApiKey(apiKey: string | undefined, providerName: string): void {
    if (!apiKey) {
      throw new Error(
        `API key is required for ${providerName} provider. Please set the appropriate environment variable or configuration.`
      );
    }
  }

  /**
   * Handle common API error scenarios
   */
  public static handleAPIError(error: unknown, providerName: string): never {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Rate limiting
    if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      throw new Error(`${providerName} API rate limit exceeded. Please try again later.`);
    }

    // Authentication
    if (errorMessage.includes('401') || errorMessage.includes('authentication')) {
      throw new Error(`${providerName} API authentication failed. Please check your API key.`);
    }

    // Generic error
    throw new Error(`${providerName} API error: ${errorMessage}`);
  }
}
