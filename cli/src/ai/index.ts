import { AIModelClient } from '../models/ai';
import { GeminiClient } from './gemini-client';
import { OpenAIClient } from './openai-client';

export function getAIClient(provider = 'gemini'): AIModelClient {
    switch (provider.toLowerCase()) {
      case 'gemini':
        return new GeminiClient();
      case 'openai':
        return new OpenAIClient();
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
}

export * from './gemini-client';
export * from './openai-client';
