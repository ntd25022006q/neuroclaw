/**
 * NeuroClaw - LLM Provider Factory
 * Creates and manages LLM provider instances
 */

import { BaseLLMProvider } from './base';
import { OllamaProvider } from './ollama';
import { HuggingFaceProvider } from './huggingface';
import type { LLMConfig, LLMProviderType } from '../types';

export class LLMProviderFactory {
  private static providers: Map<string, BaseLLMProvider> = new Map();
  private static defaultTimeout = 60000;

  /**
   * Create or get a provider instance
   */
  static createProvider(config: LLMConfig): BaseLLMProvider {
    const key = this.getProviderKey(config);
    
    // Return cached provider if exists
    if (this.providers.has(key)) {
      return this.providers.get(key)!;
    }

    // Create new provider based on type
    const provider = this.instantiateProvider(config);
    this.providers.set(key, provider);
    
    return provider;
  }

  /**
   * Get provider instance by name
   */
  static getProvider(config: LLMConfig): BaseLLMProvider | undefined {
    const key = this.getProviderKey(config);
    return this.providers.get(key);
  }

  /**
   * Clear all cached providers
   */
  static clearProviders(): void {
    this.providers.clear();
  }

  /**
   * Get all available provider types
   */
  static getAvailableProviderTypes(): LLMProviderType[] {
    return ['huggingface', 'ollama', 'openai', 'anthropic', 'google', 'custom'];
  }

  /**
   * Get free provider types (no API key required)
   */
  static getFreeProviderTypes(): LLMProviderType[] {
    return ['huggingface', 'ollama'];
  }

  /**
   * Check if a provider type requires an API key
   */
  static requiresApiKey(providerType: LLMProviderType): boolean {
    return !['ollama'].includes(providerType);
  }

  /**
   * Validate provider configuration
   */
  static validateConfig(config: LLMConfig): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check model
    if (!config.model) {
      errors.push('Model name is required');
    }

    // Check API key for providers that need it
    if (this.requiresApiKey(config.provider)) {
      if (!config.apiKey && config.provider !== 'huggingface') {
        // HuggingFace can work without API key (with rate limits)
        if (config.provider !== 'huggingface') {
          errors.push(`API key is required for ${config.provider}`);
        } else {
          warnings.push('No API key provided for HuggingFace - rate limits will apply');
        }
      }
    }

    // Check base URL for Ollama
    if (config.provider === 'ollama') {
      if (!config.baseUrl) {
        warnings.push('No base URL specified for Ollama, using default (http://localhost:11434)');
      }
    }

    // Validate timeout
    if (config.timeout && config.timeout < 1000) {
      warnings.push('Timeout is very short, may cause issues with slow models');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get recommended models for a provider
   */
  static getRecommendedModels(providerType: LLMProviderType): string[] {
    switch (providerType) {
      case 'ollama':
        return [
          'llama3.2:latest',
          'llama3.1:8b',
          'mistral:latest',
          'qwen2.5:7b',
          'gemma2:9b',
          'phi3:mini',
          'deepseek-coder:6.7b'
        ];
      
      case 'huggingface':
        return [
          'meta-llama/Llama-3.2-3B-Instruct',
          'mistralai/Mistral-7B-Instruct-v0.3',
          'Qwen/Qwen2.5-7B-Instruct',
          'google/gemma-2-9b-it',
          'microsoft/Phi-3-mini-4k-instruct',
          'HuggingFaceH4/zephyr-7b-beta'
        ];
      
      case 'openai':
        return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
      
      case 'anthropic':
        return ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'];
      
      case 'google':
        return ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'];
      
      default:
        return [];
    }
  }

  /**
   * Instantiate the correct provider class
   */
  private static instantiateProvider(config: LLMConfig): BaseLLMProvider {
    switch (config.provider) {
      case 'ollama':
        return new OllamaProvider(config);
      
      case 'huggingface':
        return new HuggingFaceProvider(config);
      
      // Placeholder for other providers - would need implementation
      case 'openai':
      case 'anthropic':
      case 'google':
      case 'custom':
        throw new Error(
          `Provider '${config.provider}' is not yet implemented. ` +
          `Currently supported: ollama, huggingface`
        );
      
      default:
        throw new Error(`Unknown provider type: ${config.provider}`);
    }
  }

  /**
   * Generate a unique key for caching providers
   */
  private static getProviderKey(config: LLMConfig): string {
    return `${config.provider}:${config.model}:${config.baseUrl || 'default'}`;
  }
}

// Export provider classes
export { BaseLLMProvider } from './base';
export { OllamaProvider } from './ollama';
export { HuggingFaceProvider } from './huggingface';
