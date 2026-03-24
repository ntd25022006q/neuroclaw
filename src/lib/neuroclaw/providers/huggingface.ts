/**
 * NeuroClaw - HuggingFace Provider
 * Free API access to open-source models via HuggingFace Inference API
 */

import { BaseLLMProvider } from './base';
import type { 
  LLMConfig, 
  ChatMessage, 
  ChatCompletionResponse, 
  ToolDefinition 
} from '../types';

interface HuggingFaceResponse {
  generated_text: string;
  token?: {
    id: number;
    text: string;
    logprob: number;
    special: boolean;
  };
  details?: {
    finish_reason: string;
    generated_tokens: number;
    seed: number;
    prefill: Array<{
      id: number;
      text: string;
      logprob: number;
    }>;
    tokens: Array<{
      id: number;
      text: string;
      logprob: number;
      special: boolean;
    }>;
    best_of_sequences?: unknown[];
  };
}

interface HuggingFaceModel {
  id: string;
  author: string;
  sha: string;
  pipeline_tag?: string;
  tags: string[];
  private: boolean;
  gated: boolean;
  downloads: number;
  likes: number;
}

export class HuggingFaceProvider extends BaseLLMProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: LLMConfig) {
    super(config);
    this.apiKey = config.apiKey || process.env.HUGGINGFACE_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://api-inference.huggingface.co/models';
  }

  getProviderName(): string {
    return 'huggingface';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    
    try {
      // Test with a simple request to a free model
      const response = await fetch(`${this.baseUrl}/microsoft/DialoGPT-small`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ inputs: 'test' }),
        signal: AbortSignal.timeout(10000)
      });
      return response.ok || response.status === 503; // 503 means model is loading but API works
    } catch {
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    // Return popular free models for chat/text generation
    const freeChatModels = [
      // Meta Llama models
      'meta-llama/Llama-3.2-1B-Instruct',
      'meta-llama/Llama-3.2-3B-Instruct',
      'meta-llama/Llama-3.1-8B-Instruct',
      
      // Mistral models
      'mistralai/Mistral-7B-Instruct-v0.3',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
      
      // Qwen models
      'Qwen/Qwen2.5-1.5B-Instruct',
      'Qwen/Qwen2.5-3B-Instruct',
      'Qwen/Qwen2.5-7B-Instruct',
      
      // Google models
      'google/gemma-2-2b-it',
      'google/gemma-2-9b-it',
      
      // Microsoft models
      'microsoft/Phi-3-mini-4k-instruct',
      'microsoft/Phi-3-small-8k-instruct',
      
      // Other popular models
      'HuggingFaceH4/zephyr-7b-beta',
      'tiiuae/falcon-7b-instruct',
      'openchat/openchat-3.5-0106',
      'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO'
    ];

    return freeChatModels;
  }

  async createChatCompletion(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: Record<string, unknown>
  ): Promise<ChatCompletionResponse> {
    const url = `${this.baseUrl}/${this.config.model}`;
    
    // Format messages for chat template
    const prompt = this.formatChatPrompt(messages);

    const requestBody: Record<string, unknown> = {
      inputs: prompt,
      parameters: {
        temperature: this.config.temperature ?? 0.7,
        max_new_tokens: this.config.maxTokens ?? 1024,
        return_full_text: false,
        do_sample: true,
        top_p: 0.95,
        top_k: 50,
        ...options
      },
      options: {
        wait_for_model: true, // Wait if model is loading
        use_cache: true
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(this.config.timeout ?? 60000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Handle specific errors
      if (response.status === 503) {
        throw new Error('Model is loading, please try again in a few minutes');
      }
      if (response.status === 401) {
        throw new Error('Invalid HuggingFace API key');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded, please try again later');
      }
      
      throw new Error(`HuggingFace API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as HuggingFaceResponse | HuggingFaceResponse[];

    // Handle array response (can be returned as array)
    const resultData = Array.isArray(data) ? data[0] : data;

    // Note: HuggingFace Inference API doesn't support native tool calling
    // Tools would need to be implemented via prompt engineering
    const toolCalls = this.extractToolCallsFromText(resultData.generated_text, tools);

    return {
      id: `hf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: this.cleanGeneratedText(resultData.generated_text),
      model: this.config.model,
      provider: 'huggingface',
      usage: {
        promptTokens: this.estimateTokens(messages),
        completionTokens: Math.ceil(resultData.generated_text.length / 4),
        totalTokens: this.estimateTokens(messages) + Math.ceil(resultData.generated_text.length / 4)
      },
      ...(toolCalls && toolCalls.length > 0 && { toolCalls })
    };
  }

  /**
   * Get headers for API requests
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Format chat messages into a prompt string
   */
  private formatChatPrompt(messages: ChatMessage[]): string {
    // Try to use chat template if the model supports it
    // For models that support chat templates, we format appropriately
    
    const formattedMessages = messages.map(msg => {
      switch (msg.role) {
        case 'system':
          return `<|system|>\n${msg.content}</s>\n`;
        case 'user':
          return `<|user|>\n${msg.content}</s>\n`;
        case 'assistant':
          return `<|assistant|\n${msg.content}</s>\n`;
        case 'tool':
          return `<|tool|>\n${msg.content}</s>\n`;
        default:
          return `${msg.content}\n`;
      }
    });

    // Add assistant prefix for continuation
    return formattedMessages.join('') + '<|assistant|]\n';
  }

  /**
   * Clean generated text from artifacts
   */
  private cleanGeneratedText(text: string): string {
    // Remove common artifacts
    return text
      .replace(/<\|.*?\|>/g, '') // Remove special tokens
      .replace(/<\/s>/g, '') // Remove end of sequence
      .trim();
  }

  /**
   * Extract tool calls from generated text (via prompt engineering)
   * This is a fallback since HuggingFace doesn't support native tool calling
   */
  private extractToolCallsFromText(
    text: string, 
    tools?: ToolDefinition[]
  ): undefined | ToolDefinition[] {
    if (!tools || tools.length === 0) return undefined;

    // Look for JSON-like tool call patterns in the text
    const toolCallPattern = /\[TOOL_CALL\]\s*(\{[\s\S]*?\})\s*\[\/TOOL_CALL\]/g;
    const matches = text.matchAll(toolCallPattern);
    
    const toolCalls: ToolDefinition[] = [];
    
    for (const match of matches) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.name && parsed.arguments) {
          // Validate against available tools
          const tool = tools.find(t => t.id === parsed.name || t.name === parsed.name);
          if (tool) {
            toolCalls.push(tool);
          }
        }
      } catch {
        // Skip invalid JSON
      }
    }

    return toolCalls.length > 0 ? toolCalls : undefined;
  }

  /**
   * Search for models on HuggingFace Hub
   */
  async searchModels(query: string, limit = 10): Promise<HuggingFaceModel[]> {
    try {
      const searchUrl = new URL('https://huggingface.co/api/models');
      searchUrl.searchParams.set('search', query);
      searchUrl.searchParams.set('limit', String(limit));
      searchUrl.searchParams.set('filter', 'text-generation');

      const response = await fetch(searchUrl.toString(), {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}
      });

      if (!response.ok) return [];

      return await response.json() as HuggingFaceModel[];
    } catch {
      return [];
    }
  }

  /**
   * Check if a model is available for inference
   */
  async checkModelAvailability(modelId: string): Promise<{
    available: boolean;
    loading: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/${modelId}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ inputs: 'test' }),
        signal: AbortSignal.timeout(30000)
      });

      if (response.ok) {
        return { available: true, loading: false };
      }

      if (response.status === 503) {
        const data = await response.json() as { error?: string; estimated_time?: number };
        return {
          available: false,
          loading: true,
          error: `Model is loading. Estimated time: ${data.estimated_time || 'unknown'} seconds`
        };
      }

      return {
        available: false,
        loading: false,
        error: `Error: ${response.status}`
      };
    } catch (error) {
      return {
        available: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
