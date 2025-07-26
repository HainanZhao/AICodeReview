import { LLMProvider } from './types.js';
import { GeminiProvider } from './geminiProvider.js';
import { AnthropicProvider } from './anthropicProvider.js';
import { GeminiCliProvider } from './geminiCliProvider.js';

export async function createLLMProvider(type: string, apiKey?: string): Promise<LLMProvider> {
  const providerType = type.toLowerCase();

  // Special handling for gemini-cli
  if (providerType === 'gemini-cli') {
    const isCliAvailable = await GeminiCliProvider.isAvailable();
    if (!isCliAvailable) {
      throw new Error('gemini command is not installed or not available in PATH');
    }
    const provider = new GeminiCliProvider();
    await provider.initializeWithCleanup();
    return provider;
  }

  // Check if API key is required but not provided
  if (!apiKey) {
    throw new Error(`API key is required for provider: ${type}`);
  }

  switch (providerType) {
    case 'gemini':
      return new GeminiProvider(apiKey);
    case 'anthropic':
      return new AnthropicProvider(apiKey);
    default:
      throw new Error(`Unsupported LLM provider: ${type}`);
  }
}
