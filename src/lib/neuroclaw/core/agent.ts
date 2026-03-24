/**
 * NeuroClaw - Core Agent
 * The brain of the AI agent system with security-first design
 */

import type {
  AgentConfig,
  AgentState,
  AgentTask,
  AgentMemory,
  ChatMessage,
  ChatCompletionResponse,
  ToolDefinition,
  ToolExecutionResult,
  ToolCall,
  LLMConfig,
  PermissionResponse
} from '../types';
import { LLMProviderFactory } from '../providers/factory';
import { PermissionManager } from '../permissions/manager';

export interface AgentExecutionOptions {
  maxIterations?: number;
  timeout?: number;
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
  onPermissionRequest?: (request: PermissionManager['requestPermission']) => Promise<PermissionResponse>;
  onThinking?: (thought: string) => void;
  onStatusChange?: (state: AgentState) => void;
}

export interface AgentExecutionResult {
  success: boolean;
  response: string;
  toolCallsExecuted: number;
  iterations: number;
  duration: number;
  errors: string[];
  metadata?: Record<string, unknown>;
}

export class CoreAgent {
  private config: AgentConfig;
  private state: AgentState;
  private memory: AgentMemory;
  private tools: Map<string, ToolDefinition> = new Map();
  private toolExecutors: Map<string, (args: Record<string, unknown>) => Promise<ToolExecutionResult>> = new Map();
  private permissionManager: PermissionManager;
  private sessionId: string;

  constructor(
    config: AgentConfig,
    permissionManager: PermissionManager,
    sessionId: string
  ) {
    this.config = config;
    this.permissionManager = permissionManager;
    this.sessionId = sessionId;
    
    this.state = {
      status: 'idle'
    };

    this.memory = {
      shortTerm: new Map(),
      longTerm: new Map(),
      conversationHistory: [],
      maxHistoryLength: config.memory.maxHistoryLength || 100
    };
  }

  /**
   * Register a tool with the agent
   */
  registerTool(
    definition: ToolDefinition,
    executor: (args: Record<string, unknown>) => Promise<ToolExecutionResult>
  ): void {
    this.tools.set(definition.id, definition);
    this.toolExecutors.set(definition.id, executor);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(toolId: string): void {
    this.tools.delete(toolId);
    this.toolExecutors.delete(toolId);
  }

  /**
   * Get all registered tools
   */
  getTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Get agent memory
   */
  getMemory(): AgentMemory {
    return this.memory;
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.memory.conversationHistory = [];
  }

  /**
   * Execute a task
   */
  async execute(
    userMessage: string,
    options: AgentExecutionOptions = {}
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const maxIterations = options.maxIterations || this.config.maxIterations || 10;
    const errors: string[] = [];
    let iterations = 0;
    let toolCallsExecuted = 0;
    let finalResponse = '';

    try {
      // Add user message to history
      this.addMessage({ role: 'user', content: userMessage });

      // Main execution loop
      while (iterations < maxIterations) {
        iterations++;
        
        // Update state
        this.updateState({ status: 'thinking' });
        options.onStatusChange?.(this.state);

        // Get LLM response
        const response = await this.getLLMResponse(options);
        
        // Add assistant message to history
        this.addMessage({ 
          role: 'assistant', 
          content: response.content,
          ...(response.toolCalls && response.toolCalls.length > 0 && { 
            toolCallId: response.toolCalls[0].id 
          })
        });

        // Check if we're done (no tool calls)
        if (!response.toolCalls || response.toolCalls.length === 0) {
          finalResponse = response.content;
          break;
        }

        // Execute tool calls
        this.updateState({ status: 'executing' });
        options.onStatusChange?.(this.state);

        for (const toolCall of response.toolCalls) {
          try {
            const toolResult = await this.executeToolCall(
              toolCall,
              options.onPermissionRequest
            );

            toolCallsExecuted++;

            // Add tool result to history
            this.addMessage({
              role: 'tool',
              content: JSON.stringify(toolResult),
              name: toolCall.name,
              toolCallId: toolCall.id
            });

            // Notify callback
            options.onToolCall?.(toolCall.name, toolCall.arguments);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Tool '${toolCall.name}' failed: ${errorMsg}`);
            
            // Add error as tool result
            this.addMessage({
              role: 'tool',
              content: JSON.stringify({ success: false, error: errorMsg }),
              name: toolCall.name,
              toolCallId: toolCall.id
            });
          }
        }
      }

      // Check if we hit iteration limit
      if (iterations >= maxIterations && !finalResponse) {
        finalResponse = 'I was unable to complete the task within the iteration limit. Please try again with a simpler request.';
        errors.push('Maximum iterations reached');
      }

      this.updateState({ 
        status: 'idle', 
        completedAt: new Date() 
      });
      options.onStatusChange?.(this.state);

      return {
        success: errors.length === 0,
        response: finalResponse,
        toolCallsExecuted,
        iterations,
        duration: Date.now() - startTime,
        errors
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMsg);

      this.updateState({ 
        status: 'error', 
        error: errorMsg 
      });
      options.onStatusChange?.(this.state);

      return {
        success: false,
        response: `An error occurred: ${errorMsg}`,
        toolCallsExecuted,
        iterations,
        duration: Date.now() - startTime,
        errors
      };
    }
  }

  /**
   * Get response from LLM
   */
  private async getLLMResponse(
    options: AgentExecutionOptions
  ): Promise<ChatCompletionResponse> {
    const provider = LLMProviderFactory.createProvider(this.config.llmConfig);
    
    // Build system message
    const systemPrompt = this.buildSystemPrompt();
    
    // Prepare messages
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...this.memory.conversationHistory
    ];

    // Notify thinking
    options.onThinking?.('Thinking...');

    // Get enabled tools
    const enabledTools = this.getTools().filter(t => t.enabled);

    // Make API call
    return provider.createChatCompletion(messages, enabledTools);
  }

  /**
   * Execute a tool call
   */
  private async executeToolCall(
    toolCall: ToolCall,
    onPermissionRequest?: (request: PermissionManager['requestPermission']) => Promise<PermissionResponse>
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolCall.name);
    
    if (!tool) {
      return {
        success: false,
        error: `Unknown tool: ${toolCall.name}`,
        permissionsUsed: [],
        duration: 0
      };
    }

    const executor = this.toolExecutors.get(toolCall.name);
    if (!executor) {
      return {
        success: false,
        error: `No executor registered for tool: ${toolCall.name}`,
        permissionsUsed: [],
        duration: 0
      };
    }

    // Request permission
    const action = this.inferActionFromToolCall(toolCall);
    
    let permissionGranted = true;
    let permissionReason = '';

    if (tool.permissions.requiresConfirmation) {
      try {
        const response = await this.permissionManager.requestPermission(
          this.sessionId,
          tool,
          action,
          toolCall.arguments
        );
        
        permissionGranted = response.granted;
        permissionReason = response.reason || '';
      } catch (error) {
        // If no callback is registered, check auto-approve rules
        if (!this.permissionManager.isActionApproved(this.sessionId, tool.id, action)) {
          permissionGranted = false;
          permissionReason = 'Permission denied - no confirmation callback available';
        }
      }
    }

    if (!permissionGranted) {
      return {
        success: false,
        error: `Permission denied: ${permissionReason}`,
        permissionsUsed: [],
        duration: 0
      };
    }

    // Execute tool
    const startTime = Date.now();
    try {
      const result = await executor(toolCall.arguments);
      result.duration = Date.now() - startTime;
      result.permissionsUsed = [tool.permissions.level];
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        permissionsUsed: [tool.permissions.level],
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Build system prompt for the agent
   */
  private buildSystemPrompt(): string {
    const toolsDescription = this.getTools()
      .filter(t => t.enabled)
      .map(t => `- ${t.id}: ${t.description}`)
      .join('\n');

    let prompt = this.config.systemPrompt;

    // Add tools information
    prompt += '\n\n## Available Tools\n';
    prompt += 'You have access to the following tools:\n';
    prompt += toolsDescription;
    prompt += '\n\nImportant: Always ask for user confirmation before executing potentially dangerous actions.';

    // Add memory context
    if (this.memory.shortTerm.size > 0) {
      prompt += '\n\n## Context\n';
      prompt += 'Current context:\n';
      for (const [key, value] of this.memory.shortTerm.entries()) {
        prompt += `- ${key}: ${JSON.stringify(value)}\n`;
      }
    }

    return prompt;
  }

  /**
   * Add message to history
   */
  private addMessage(message: ChatMessage): void {
    this.memory.conversationHistory.push(message);
    
    // Trim history if needed
    if (this.memory.conversationHistory.length > this.memory.maxHistoryLength) {
      this.memory.conversationHistory = this.memory.conversationHistory.slice(
        -this.memory.maxHistoryLength
      );
    }
  }

  /**
   * Update agent state
   */
  private updateState(updates: Partial<AgentState>): void {
    this.state = { ...this.state, ...updates };
  }

  /**
   * Infer action name from tool call
   */
  private inferActionFromToolCall(toolCall: ToolCall): string {
    // Simple heuristic: use the tool name as the action
    // Could be enhanced with parameter-based action inference
    return `execute_${toolCall.name}`;
  }
}
