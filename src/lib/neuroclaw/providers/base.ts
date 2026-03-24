/**
 * NeuroClaw - LLM Provider Base Interface
 * Abstract base class for all LLM providers
 */

import type { 
  LLMConfig, 
  ChatMessage, 
  ChatCompletionResponse, 
  ToolDefinition,
  ToolCall 
} from '../types';

export abstract class BaseLLMProvider {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * Get the provider name
   */
  abstract getProviderName(): string;

  /**
   * Check if the provider is available and configured correctly
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Get available models from this provider
   */
  abstract getAvailableModels(): Promise<string[]>;

  /**
   * Create a chat completion
   */
  abstract createChatCompletion(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: Record<string, unknown>
  ): Promise<ChatCompletionResponse>;

  /**
   * Create a streaming chat completion
   */
  abstract createStreamingChatCompletion?(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    onChunk: (chunk: string) => void,
    options?: Record<string, unknown>
  ): Promise<ChatCompletionResponse>;

  /**
   * Validate the configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.model) {
      errors.push('Model name is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Build tool definitions for the LLM
   */
  protected buildToolDefinitions(tools?: ToolDefinition[]): unknown[] | undefined {
    if (!tools || tools.length === 0) return undefined;

    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.id,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            tool.parameters.map(param => [
              param.name,
              {
                type: param.type,
                description: param.description,
                enum: param.enum,
                ...(param.default !== undefined && { default: param.default })
              }
            ])
          ),
          required: tool.parameters
            .filter(param => param.required)
            .map(param => param.name)
        }
      }
    }));
  }

  /**
   * Parse tool calls from the response
   */
  protected parseToolCalls(toolCallsData: unknown[]): ToolCall[] {
    return toolCallsData.map((tc: unknown) => {
      const tcRecord = tc as Record<string, unknown>;
      const func = tcRecord.function as Record<string, unknown>;
      return {
        id: tcRecord.id as string,
        name: func.name as string,
        arguments: typeof func.arguments === 'string' 
          ? JSON.parse(func.arguments) 
          : func.arguments as Record<string, unknown>
      };
    });
  }

  /**
   * Estimate token count for messages (rough approximation)
   */
  protected estimateTokens(messages: ChatMessage[]): number {
    const totalContent = messages.map(m => m.content).join(' ');
    // Rough approximation: ~4 characters per token
    return Math.ceil(totalContent.length / 4);
  }
}
