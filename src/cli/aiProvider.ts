import { AppConfig } from '../config/configSchema.js';
import {
  buildReviewPrompt,
  parseAIResponse,
  Severity,
  type AIReviewRequest,
  type AIReviewResponse,
} from '@aireview/shared';
import { GeminiCliExecutor, GeminiCliItem } from '../shared/geminiCliExecutor.js';
import { spawn } from 'child_process';

// Helper for delay
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// Generic retry mechanism for AI API calls with rate limit handling
async function retryWithRateLimit<T>(
  fn: () => Promise<T>,
  retries: number = 5,
  initialDelayMs: number = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRateLimitError = errorMessage.includes('429') || errorMessage.includes('rate limit');

      if (i < retries - 1 && isRateLimitError) {
        const delayTime = initialDelayMs * Math.pow(2, i); // Exponential backoff
        console.warn(`Rate limit hit. Retrying in ${delayTime / 1000} seconds... (${i + 1}/${retries})`);
        await delay(delayTime);
      } else {
        throw error; // Re-throw if not a rate limit error or max retries reached
      }
    }
  }
  throw new Error('Max retries reached for AI API call.');
}

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
    return retryWithRateLimit(async () => {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        
        const genAI = new GoogleGenerativeAI(this.config.llm.apiKey!);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        return parseAIResponse(text);
      } catch (error) {
        console.error('Gemini provider error:', error);
        throw new Error(
          `Gemini review failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  /**
   * Generates review using Anthropic Claude
   */
  private async generateAnthropicReview(prompt: string): Promise<AIReviewResponse> {
    return retryWithRateLimit(async () => {
      try {
        const { Anthropic } = await import('@anthropic-ai/sdk');
        
        const client = new Anthropic({
          apiKey: this.config.llm.apiKey!,
        });

        const response = await client.messages.create({
          model: 'claude-3-5-sonnet-20241010',
          max_tokens: 8192,
          temperature: 0.1,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
        return parseAIResponse(text);
      } catch (error) {
        console.error('Anthropic provider error:', error);
        throw new Error(
          `Anthropic review failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  /**
   * Generates review using Gemini CLI tool
   */
  private async generateGeminiCliReview(prompt: string): Promise<AIReviewResponse> {
    try {
      console.log('Calling gemini CLI with --yolo flag...');
      
      // Use the shared GeminiCliExecutor
      const geminiItems = await GeminiCliExecutor.executeReview(prompt, { verbose: true });
      
      // Convert to our expected format
      const feedback = geminiItems.map((item, index) => ({
        id: `gemini-cli-${Date.now()}-${index}`,
        filePath: String(item.filePath || '').replace(/\\/g, '/'),
        lineNumber: Number(item.lineNumber || 0),
        severity: item.severity === 'error' ? Severity.Critical : (item.severity === 'warning' ? Severity.Warning : (item.severity === 'info' ? Severity.Info : Severity.Suggestion)),
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
      if (errorMessage.includes('not found') || errorMessage.includes('command not found') || errorMessage.includes('aliased or linked to "gcloud"') || errorMessage.includes('part of the Google Cloud SDK') || errorMessage.includes('Could not verify the "gemini" CLI')) {
        throw new Error(
          'Gemini CLI tool not found or misconfigured. Please ensure it is installed ' +
            '(npm install -g @google-ai/generative-ai-cli) and that the "gemini" command ' +
            'is available in your PATH and not conflicting with "gcloud".'
        );
      } else {
        throw new Error(`Gemini CLI review failed: ${errorMessage}`);
      }
    }
  }

  /**
   * Execute gemini CLI with stdin (same as backend implementation)
   */
  private executeGeminiWithStdin(prompt: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn('gemini', ['--yolo'], {
        stdio: 'pipe',
        shell: process.platform === 'win32',
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code: number | null) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`gemini command failed with exit code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error: Error) => {
        reject(error);
      });

      // Send prompt via stdin
      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  /**
   * Extract JSON from gemini CLI output (same as backend implementation)
   */
  private async extractJsonFromGeminiOutput(output: string): Promise<GeminiCliItem[]> {
    // Log the raw output for debugging
    console.log('Raw Gemini CLI output received:', output.substring(0, 200) + '...');

    const jsonMatch = output.match(/[[\s\S]*]/);
    if (!jsonMatch) {
      console.warn('No JSON array found in output. Assuming no recommendations.');
      return [];
    }

    try {
      const jsonContent = jsonMatch[0];
      console.log('Extracted JSON string:', jsonContent.substring(0, 100) + '...');

      const parsed = JSON.parse(jsonContent);
      if (!Array.isArray(parsed)) {
        console.warn('Parsed output is not an array. Assuming no recommendations.');
        return [];
      }
      return parsed;
    } catch {
      console.warn('Failed to parse JSON, assuming no recommendations.');
      return [];
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
        if (!this.config.llm.apiKey) {
          throw new Error(
            'API key is required for gemini provider. Use --api-key or set GOOGLE_API_KEY environment variable.'
          );
        }
        break;
      case 'anthropic':
        if (!this.config.llm.apiKey) {
          throw new Error(
            'API key is required for anthropic provider. Use --api-key or set ANTHROPIC_API_KEY environment variable.'
          );
        }
        break;
      default:
        throw new Error(`Unsupported AI provider: ${this.config.llm.provider}`);
    }
  }
}
