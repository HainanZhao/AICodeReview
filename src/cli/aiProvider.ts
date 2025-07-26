import { AppConfig } from '../config/configSchema.js';
import {
  buildReviewPrompt,
  parseAIResponse,
  Severity,
  type AIReviewRequest,
  type AIReviewResponse,
} from '@aireview/shared';

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
  }

  /**
   * Generates review using Anthropic Claude
   */
  private async generateAnthropicReview(prompt: string): Promise<AIReviewResponse> {
    try {
      const { Anthropic } = await import('@anthropic-ai/sdk');
      
      const client = new Anthropic({
        apiKey: this.config.llm.apiKey!,
      });

      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
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
  }

  /**
   * Generates review using Gemini CLI (Google Cloud Vertex AI)
   */
  private async generateGeminiCliReview(prompt: string): Promise<AIReviewResponse> {
    try {
      // Use the exec command to call gcloud vertex-ai
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Create a temporary file for the prompt
      const { writeFileSync, unlinkSync } = await import('fs');
      const { join } = await import('path');
      const { tmpdir } = await import('os');
      
      const tempFile = join(tmpdir(), `prompt-${Date.now()}.txt`);
      writeFileSync(tempFile, prompt);

      const projectId = this.config.llm.googleCloudProject;
      const region = 'us-central1'; // Default region
      const model = 'gemini-1.5-pro';

      // Build the gcloud command
      const gcloudCommand = [
        'gcloud', 'ai', 'models', 'predict',
        `projects/${projectId}/locations/${region}/models/${model}`,
        '--json-request', `'{"instances":[{"content":"$(cat ${tempFile})"}]}'`,
        '--format', 'json'
      ].join(' ');

      console.log('Calling Google Cloud Vertex AI...');
      
      try {
        const { stdout, stderr } = await execAsync(gcloudCommand, { 
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });
        
        if (stderr) {
          console.warn('gcloud stderr:', stderr);
        }

        // Clean up temp file
        unlinkSync(tempFile);

        // Parse the response
        const response = JSON.parse(stdout);
        const generatedText = response.predictions?.[0]?.content || response.predictions?.[0]?.candidates?.[0]?.content || 'No response generated';
        
        return parseAIResponse(generatedText);
      } catch (execError) {
        // Clean up temp file on error
        try { unlinkSync(tempFile); } catch {}
        
        console.error('gcloud command failed:', execError);
        
        // Check if gcloud is installed
        try {
          await execAsync('gcloud --version');
          throw new Error(`Google Cloud CLI command failed: ${execError instanceof Error ? execError.message : 'Unknown error'}. Make sure you're authenticated with 'gcloud auth login' and have the correct project set.`);
        } catch (versionError) {
          throw new Error('Google Cloud CLI not found. Please install gcloud CLI and authenticate with your Google Cloud project.');
        }
      }
    } catch (error) {
      console.error('Gemini CLI provider error:', error);
      
      // Provide more helpful error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('not found') || errorMessage.includes('command not found')) {
        throw new Error('Google Cloud CLI not installed. Please install gcloud CLI, authenticate with "gcloud auth login", and set your project with "gcloud config set project YOUR_PROJECT_ID"');
      } else if (errorMessage.includes('permission') || errorMessage.includes('authentication')) {
        throw new Error('Google Cloud authentication failed. Please run "gcloud auth login" and ensure you have access to the Vertex AI API.');
      } else {
        throw new Error(`Gemini CLI review failed: ${errorMessage}`);
      }
    }
  }

  /**
   * Validates that the required configuration is available for the provider
   */
  validateConfig(): void {
    switch (this.config.llm.provider) {
      case 'gemini-cli':
        if (!this.config.llm.googleCloudProject) {
          throw new Error(
            'Google Cloud project ID is required for gemini-cli provider. Use --google-cloud-project or set in config.'
          );
        }
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
