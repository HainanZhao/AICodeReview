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
   * Continue a chat conversation using Gemini API
   */
  public static async continueGeminiChat(
    apiKey: string,
    messages: { author: 'user' | 'ai'; content: string }[],
    filePath: string,
    fileContent?: string,
    lineNumber?: number,
    options: RetryOptions = {}
  ): Promise<string> {
    return this.retryWithCondition(async () => {
      try {
        const client = (await this.createGeminiClient(apiKey)) as any;
        const model = client.getGenerativeModel({ model: 'gemini-1.5-pro' });

        const prompt = this.createChatPrompt(
          messages,
          filePath,
          fileContent,
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
   * Continue a chat conversation using Anthropic Claude API
   */
  public static async continueAnthropicChat(
    apiKey: string,
    messages: { author: 'user' | 'ai'; content: string }[],
    filePath: string,
    fileContent?: string,
    lineNumber?: number,
    options: RetryOptions = {}
  ): Promise<string> {
    return this.retryWithCondition(async () => {
      try {
        const client = (await this.createAnthropicClient(apiKey)) as any;

        const prompt = this.createChatPrompt(
          messages,
          filePath,
          fileContent,
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
    contextLines: number = 5,
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
    contextLines: number = 5,
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
   * Create a prompt for explaining a specific line of code with enhanced context awareness
   */
  private static createExplanationPrompt(
    lineContent: string,
    filePath: string,
    fileContent?: string,
    contextLines: number = 5,
    lineNumber?: number
  ): string {
    const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
    const language = this.getLanguageFromExtension(fileExtension);

    let prompt = `You are a helpful code assistant. When explaining code, prioritize context and broader understanding over line-by-line analysis.

**File:** ${filePath}
**Language:** ${language}
**Target line:** \`${lineContent}\``;

    if (lineNumber) {
      prompt += `\n**Line number:** ${lineNumber}`;
    }

    prompt += '\n\n';

    let contextCode = '';
    let hasContext = false;

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
        contextCode = lines
          .slice(start, end)
          .map((line, index) => {
            const lineNumber = start + index + 1;
            const isTargetLine = start + index === targetLineIndex;
            return `${lineNumber.toString().padStart(3, ' ')}: ${
              isTargetLine ? '>>> ' : '    '
            }${line}`;
          })
          .join('\n');

        hasContext = true;
        prompt += `**Code context (lines ${start + 1}-${end}):**
\`\`\`${language}
${contextCode}
\`\`\`

`;
      }
    }

    if (hasContext) {
      prompt += `**Instructions:**
Analyze the code context above and provide an explanation that prioritizes broader understanding:

1. **Context Analysis**: First, identify what broader code structure this line belongs to (e.g., SQL query, function definition, loop, conditional block, class method, etc.)

2. **Primary Explanation**: 
   - If this line is part of a larger logical unit (like a multi-line SQL query, function body, or complex expression), explain the overall purpose and functionality of that unit
   - If this line is standalone, explain what it does and why

3. **Specific Line Details**: Then provide details about the specific line's role within that broader context

4. **Technical Context**: Include any important technical details about how this fits into the overall logic

**For SQL queries specifically**: Explain what data is being retrieved/modified and the business purpose, not just the syntax.
**For function calls**: Explain what the function accomplishes and how this line contributes.
**For complex expressions**: Break down the logic and the intended outcome.

Prioritize usefulness to a developer trying to understand the code's purpose over detailed syntax explanation.`;
    } else {
      prompt += `**Instructions:**
Since limited context is available, provide the best explanation possible for this line:

1. **What it does**: Explain the line's functionality
2. **Likely purpose**: Based on the content, infer the probable purpose or business logic
3. **Technical details**: Any important implementation details

Focus on helping a developer understand both the "what" and the "why" of this code.`;
    }

    prompt += `

IMPORTANT: Return your response as a JSON object with the following format:
{
  "explanation": "Your detailed explanation here..."
}

Make sure to return only valid JSON with no additional text before or after.`;

    return prompt;
  }

  private static createChatPrompt(
    messages: { author: 'user' | 'ai'; content: string }[],
    filePath: string,
    fileContent?: string,
    lineNumber?: number
  ): string {
    const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
    const language = this.getLanguageFromExtension(fileExtension);

    const initialMessage = messages[0]?.content || '';
    const followUpMessages = messages.slice(1);

    let prompt = `You are a helpful code assistant continuing a conversation about a piece of code.

**File:** ${filePath}
**Language:** ${language}
`;

    if (lineNumber) {
      prompt += `**Line number:** ${lineNumber}\n`;
    }

    if (fileContent) {
      prompt += `\n**Full File Content:**\n\`\`\`${language}\n${fileContent}\n\`\`\`\n`;
    }

    prompt += `
The user was initially asking about a line of code, and you provided the following explanation:
---
${initialMessage}
---

Now, the user has follow-up questions. Here is the conversation history:
`;

    followUpMessages.forEach(message => {
      prompt += `**${message.author === 'user' ? 'User' : 'AI'}:** ${message.content}\n`;
    });

    prompt += `
**Instructions:**
Based on the full file content and the conversation history, please provide a concise and helpful response to the last user message.
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
