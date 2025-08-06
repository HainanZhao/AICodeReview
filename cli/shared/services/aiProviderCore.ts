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
   * Generate explanation for a specific line of code using Gemini API
   */
  public static async generateGeminiExplanation(
    apiKey: string,
    lineContent: string,
    filePath: string,
    fileContent?: string,
    contextLines: number = 3,
    lineNumber?: number,
    options: RetryOptions = {}
  ): Promise<string> {
    return this.retryWithCondition(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = (await this.createGeminiClient(apiKey)) as any;
        const model = client.getGenerativeModel({ model: 'gemini-1.5-pro' });

        const prompt = this.createExplanationPrompt(
          lineContent,
          filePath,
          fileContent,
          contextLines,
          lineNumber
        );

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return this.extractExplanationFromJson(text);
      } catch (error) {
        throw new Error(
          `Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }, options);
  }

  /**
   * Extract explanation from JSON response, handling mixed content
   */
  private static extractExplanationFromJson(output: string): string {
    try {
      // First try to extract JSON from the output
      const jsonMatch = output.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const jsonContent = jsonMatch[0];
        const parsed = JSON.parse(jsonContent);

        // Check if it has an explanation field
        if (parsed.explanation && typeof parsed.explanation === 'string') {
          return parsed.explanation;
        }
      }

      // Fallback: return the original text cleaned up
      return output.trim();
    } catch {
      // JSON parsing failed, return original text
      return output.trim();
    }
  }

  /**
   * Generate explanation for a specific line of code using Anthropic Claude API
   */
  public static async generateAnthropicExplanation(
    apiKey: string,
    lineContent: string,
    filePath: string,
    fileContent?: string,
    contextLines: number = 3,
    lineNumber?: number,
    options: RetryOptions = {}
  ): Promise<string> {
    return this.retryWithCondition(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = (await this.createAnthropicClient(apiKey)) as any;

        const prompt = this.createExplanationPrompt(
          lineContent,
          filePath,
          fileContent,
          contextLines,
          lineNumber
        );

        const response = await client.messages.create({
          model: 'claude-3-5-sonnet-20241010',
          max_tokens: 1024,
          temperature: 0.1,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
        return this.extractExplanationFromJson(text);
      } catch (error) {
        throw new Error(
          `Anthropic API error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }, options);
  }

  /**
   * Create a prompt for explaining a specific line of code
   */
  private static createExplanationPrompt(
    lineContent: string,
    filePath: string,
    fileContent?: string,
    contextLines: number = 3,
    lineNumber?: number
  ): string {
    const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
    const language = this.getLanguageFromExtension(fileExtension);

    let prompt = `You are a helpful code assistant. Please explain what the following code does in a clear, concise manner. If it's a function or code block, explain its overall purpose and functionality. If it's a single line, explain what that line accomplishes.

**File:** ${filePath}
**Language:** ${language}
**Code:** \`${lineContent}\``;

    if (lineNumber) {
      prompt += `\n**Line number:** ${lineNumber}`;
    }

    prompt += '\n\n';

    if (fileContent) {
      // If we have full file content, try to extract context around the line
      const lines = fileContent.split('\n');
      let targetLineIndex = -1;

      // Try to find the line by line number first (more reliable)
      if (lineNumber && lineNumber > 0 && lineNumber <= lines.length) {
        targetLineIndex = lineNumber - 1; // Convert to 0-based index
      } else {
        // Fallback to content match
        targetLineIndex = lines.findIndex((line) => line.trim() === lineContent.trim());
      }

      if (targetLineIndex >= 0) {
        const start = Math.max(0, targetLineIndex - contextLines);
        const end = Math.min(lines.length, targetLineIndex + contextLines + 1);
        const contextCode = lines
          .slice(start, end)
          .map((line, index) => {
            const lineNumber = start + index + 1;
            const isTargetLine = start + index === targetLineIndex;
            return `${lineNumber.toString().padStart(3, ' ')}: ${
              isTargetLine ? '>>> ' : '    '
            }${line}`;
          })
          .join('\n');

        prompt += `**Context (lines ${start + 1}-${end}):**
\`\`\`${language}
${contextCode}
\`\`\`

`;
      }
    }

    prompt += `Please provide a brief explanation focusing on:
1. What this code does (whether it's a single line, function, or code block)
2. Its purpose in the context
3. Any important technical details

Keep the explanation concise but informative, suitable for a developer reviewing the code.

IMPORTANT: Return your response as a JSON object with the following format:
{
  "explanation": "Your detailed explanation here..."
}

Make sure to return only valid JSON with no additional text before or after.`;

    return prompt;
  }

  /**
   * Get programming language from file extension
   */
  private static getLanguageFromExtension(extension: string): string {
    const languageMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      hpp: 'cpp',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      kt: 'kotlin',
      swift: 'swift',
      scala: 'scala',
      sh: 'shell',
      bash: 'shell',
      ps1: 'powershell',
      sql: 'sql',
      html: 'html',
      css: 'css',
      scss: 'scss',
      less: 'less',
      json: 'json',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      dockerfile: 'dockerfile',
    };

    return languageMap[extension] || extension || 'text';
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
