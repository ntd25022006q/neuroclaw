/**
 * NeuroClaw - Ollama Provider
 * Local LLM support via Ollama
 * Zero cost, runs entirely on local hardware
 */

import { BaseLLMProvider } from './base';
import type { 
  LLMConfig, 
  ChatMessage, 
  ChatCompletionResponse, 
  ToolDefinition 
} from '../types';

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      id?: string;
      function: {
        name: string;
        arguments: string | Record<string, unknown>;
      };
    }>;
  };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export class OllamaProvider extends BaseLLMProvider {
  private baseUrl: string;

  constructor(config: LLMConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
  }

  getProviderName(): string {
    return 'ollama';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];

      const data = await response.json() as { models: OllamaModel[] };
      return data.models?.map((m) => m.name) || [];
    } catch {
      return [];
    }
  }

  async createChatCompletion(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: Record<string, unknown>
  ): Promise<ChatCompletionResponse> {
    const url = `${this.baseUrl}/api/chat`;
    
    // Convert messages to Ollama format
    const ollamaMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.name && { name: msg.name })
    }));

    const requestBody: Record<string, unknown> = {
      model: this.config.model,
      messages: ollamaMessages,
      stream: false,
      options: {
        temperature: this.config.temperature ?? 0.7,
        num_predict: this.config.maxTokens ?? 4096,
        ...options
      }
    };

    // Add tools if provided (Ollama supports tool calling)
    if (tools && tools.length > 0) {
      requestBody.tools = this.buildToolDefinitions(tools);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(this.config.timeout ?? 120000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as OllamaResponse;

    const result: ChatCompletionResponse = {
      id: `ollama-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: data.message?.content || '',
      model: data.model,
      provider: 'ollama',
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
      }
    };

    // Parse tool calls if present
    if (data.message?.tool_calls && data.message.tool_calls.length > 0) {
      result.toolCalls = data.message.tool_calls.map(tc => ({
        id: tc.id || `tc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: tc.function.name,
        arguments: typeof tc.function.arguments === 'string'
          ? JSON.parse(tc.function.arguments)
          : tc.function.arguments
      }));
    }

    return result;
  }

  async createStreamingChatCompletion(
    messages: ChatMessage[],
    tools: ToolDefinition[] | undefined,
    onChunk: (chunk: string) => void,
    options?: Record<string, unknown>
  ): Promise<ChatCompletionResponse> {
    const url = `${this.baseUrl}/api/chat`;
    
    const ollamaMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.name && { name: msg.name })
    }));

    const requestBody: Record<string, unknown> = {
      model: this.config.model,
      messages: ollamaMessages,
      stream: true,
      options: {
        temperature: this.config.temperature ?? 0.7,
        num_predict: this.config.maxTokens ?? 4096,
        ...options
      }
    };

    if (tools && tools.length > 0) {
      requestBody.tools = this.buildToolDefinitions(tools);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(this.config.timeout ?? 120000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response stream');
    }

    let fullContent = '';
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    try {
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as OllamaResponse;
            if (parsed.message?.content) {
              fullContent += parsed.message.content;
              onChunk(parsed.message.content);
            }
            if (parsed.prompt_eval_count) totalPromptTokens = parsed.prompt_eval_count;
            if (parsed.eval_count) totalCompletionTokens = parsed.eval_count;
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      id: `ollama-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: fullContent,
      model: this.config.model,
      provider: 'ollama',
      usage: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens
      }
    };
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: modelName }),
        signal: AbortSignal.timeout(600000) // 10 minutes timeout for model download
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(modelName: string): Promise<Record<string, unknown> | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/show`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: modelName })
      });
      
      if (!response.ok) return null;
      return await response.json() as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
