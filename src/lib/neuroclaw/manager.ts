/**
 * NeuroClaw - NeuroClaw Manager
 * Main orchestrator for the multi-agent AI system
 */

import type {
  NeuroClawConfig,
  AgentConfig,
  Session,
  LLMConfig,
  SecurityConfig,
  ToolDefinition,
  ChatMessage,
  AgentExecutionResult
} from './types';
import { CoreAgent, AgentExecutionOptions } from './core/agent';
import { PermissionManager, PermissionAuditLog } from './permissions/manager';
import { LLMProviderFactory } from './providers/factory';
import { 
  BUILTIN_TOOLS, 
  TOOL_EXECUTORS, 
  getToolById,
  ToolDefinition as ImportedToolDefinition
} from './tools/index';

export interface NeuroClawManagerOptions {
  defaultLLM?: LLMConfig;
  security?: Partial<SecurityConfig>;
  enableBuiltinTools?: boolean;
}

export interface CreateSessionOptions {
  userId: string;
  systemPrompt?: string;
  tools?: string[];
  llmConfig?: LLMConfig;
}

export interface ChatOptions extends AgentExecutionOptions {
  rememberDecision?: boolean;
}

export class NeuroClawManager {
  private config: NeuroClawConfig;
  private permissionManager: PermissionManager;
  private sessions: Map<string, Session> = new Map();
  private agents: Map<string, CoreAgent> = new Map();

  constructor(options: NeuroClawManagerOptions = {}) {
    // Initialize default configuration
    const defaultLLM: LLMConfig = options.defaultLLM || {
      provider: 'ollama',
      model: 'llama3.2:latest',
      baseUrl: 'http://localhost:11434',
      temperature: 0.7,
      maxTokens: 4096
    };

    const security: SecurityConfig = {
      sandboxEnabled: true,
      requireConfirmationFor: ['execute', 'admin', 'dangerous'],
      autoApproveLowRisk: options.security?.autoApproveLowRisk ?? true,
      maxIterationsPerTask: 10,
      sessionTimeout: 3600000, // 1 hour
      rateLimitPerMinute: 60,
      ...options.security
    };

    this.config = {
      version: '1.0.0',
      defaultLLM,
      security,
      agents: [],
      tools: options.enableBuiltinTools !== false ? BUILTIN_TOOLS : [],
      logging: {
        level: 'info',
        logToolExecutions: true,
        logPermissionRequests: true,
        logLLMCalls: true,
        retentionDays: 30
      }
    };

    // Initialize permission manager
    this.permissionManager = new PermissionManager({
      autoApproveLowRisk: security.autoApproveLowRisk,
      requireConfirmationFor: security.requireConfirmationFor,
      maxCallsPerToolPerHour: 100,
      maxCallsPerToolPerDay: 1000,
      auditLogRetention: 30
    });
  }

  /**
   * Get the current configuration
   */
  getConfig(): NeuroClawConfig {
    return { ...this.config };
  }

  /**
   * Check if LLM providers are available
   */
  async checkProviders(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    // Check Ollama
    try {
      const ollamaConfig = { ...this.config.defaultLLM, provider: 'ollama' as const };
      const ollamaProvider = LLMProviderFactory.createProvider(ollamaConfig);
      results.ollama = await ollamaProvider.isAvailable();
    } catch {
      results.ollama = false;
    }

    // Check HuggingFace
    try {
      const hfConfig = { ...this.config.defaultLLM, provider: 'huggingface' as const };
      const hfProvider = LLMProviderFactory.createProvider(hfConfig);
      results.huggingface = await hfProvider.isAvailable();
    } catch {
      results.huggingface = false;
    }

    return results;
  }

  /**
   * Get available models for a provider
   */
  async getAvailableModels(provider: string): Promise<string[]> {
    try {
      const config = { ...this.config.defaultLLM, provider: provider as LLMConfig['provider'] };
      const providerInstance = LLMProviderFactory.createProvider(config);
      return await providerInstance.getAvailableModels();
    } catch {
      return LLMProviderFactory.getRecommendedModels(provider as LLMConfig['provider']);
    }
  }

  /**
   * Create a new session
   */
  async createSession(options: CreateSessionOptions): Promise<Session> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create session permissions
    const sessionPermissions = this.permissionManager.createSession(sessionId);

    // Determine tools to enable
    const enabledToolIds = options.tools || this.config.tools.filter(t => t.enabled).map(t => t.id);
    
    // Create agent config
    const agentConfig: AgentConfig = {
      id: `agent-${sessionId}`,
      name: 'NeuroClaw Assistant',
      role: 'assistant',
      description: 'Main AI assistant',
      systemPrompt: options.systemPrompt || this.getDefaultSystemPrompt(),
      llmConfig: options.llmConfig || this.config.defaultLLM,
      enabledTools: enabledToolIds,
      permissions: sessionPermissions,
      memory: {
        shortTerm: new Map(),
        longTerm: new Map(),
        conversationHistory: [],
        maxHistoryLength: 100
      },
      maxIterations: this.config.security.maxIterationsPerTask,
      timeout: 120000
    };

    // Create agent
    const agent = new CoreAgent(
      agentConfig,
      this.permissionManager,
      sessionId
    );

    // Register enabled tools
    for (const toolId of enabledToolIds) {
      const tool = getToolById(toolId) || this.config.tools.find(t => t.id === toolId);
      if (tool) {
        const executor = this.getToolExecutor(toolId);
        if (executor) {
          agent.registerTool(tool, executor);
        }
      }
    }

    // Create session
    const session: Session = {
      id: sessionId,
      userId: options.userId,
      activeAgent: agentConfig.id,
      messages: [],
      permissions: sessionPermissions,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.security.sessionTimeout)
    };

    this.sessions.set(sessionId, session);
    this.agents.set(sessionId, agent);

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get agent for a session
   */
  getAgent(sessionId: string): CoreAgent | undefined {
    return this.agents.get(sessionId);
  }

  /**
   * End a session
   */
  endSession(sessionId: string): void {
    this.permissionManager.removeSession(sessionId);
    this.sessions.delete(sessionId);
    this.agents.delete(sessionId);
  }

  /**
   * Send a message and get a response
   */
  async chat(
    sessionId: string,
    message: string,
    options: ChatOptions = {}
  ): Promise<AgentExecutionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      this.endSession(sessionId);
      throw new Error('Session expired');
    }

    const agent = this.agents.get(sessionId);
    if (!agent) {
      throw new Error(`Agent for session ${sessionId} not found`);
    }

    // Register permission callback if provided
    if (options.onPermissionRequest) {
      this.permissionManager.registerPermissionCallback(
        sessionId,
        options.onPermissionRequest
      );
    }

    // Execute the message
    const result = await agent.execute(message, options);

    // Update session
    session.updatedAt = new Date();
    session.messages.push(
      { role: 'user', content: message },
      { role: 'assistant', content: result.response }
    );

    return result;
  }

  /**
   * Register a custom tool
   */
  registerTool(
    tool: ToolDefinition,
    executor: (args: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>
  ): void {
    this.config.tools.push(tool);
    // Store executor for later use
    (TOOL_EXECUTORS as Record<string, unknown>)[tool.id] = executor;
  }

  /**
   * Get all available tools
   */
  getAvailableTools(): ToolDefinition[] {
    return this.config.tools;
  }

  /**
   * Get audit logs for a session
   */
  getAuditLogs(sessionId: string): PermissionAuditLog[] {
    return this.permissionManager.getAuditLogs(sessionId);
  }

  /**
   * Set tool policy for a session
   */
  setToolPolicy(
    sessionId: string,
    toolId: string,
    policy: {
      allowedActions?: string[];
      autoApprove?: string[];
      requireConfirmation?: string[];
      denied?: string[];
    }
  ): void {
    this.permissionManager.setToolPolicy(sessionId, toolId, policy);
  }

  /**
   * Respond to a permission request
   */
  respondToPermissionRequest(
    requestId: string,
    granted: boolean,
    reason?: string
  ): void {
    this.permissionManager.respondToRequest(requestId, granted, reason);
  }

  /**
   * Get default system prompt
   */
  private getDefaultSystemPrompt(): string {
    return `You are NeuroClaw, an intelligent AI assistant designed to help users with a wide range of tasks.

## Core Principles
1. **Safety First**: Always prioritize user safety and data security
2. **Transparency**: Explain what you're doing and why
3. **Permission Respect**: Ask for confirmation before performing sensitive actions
4. **Helpful**: Be proactive in assisting while staying within safe boundaries

## Capabilities
You have access to various tools for:
- Searching the web for information
- Reading web pages
- Analyzing text
- Performing calculations
- Generating images
- Managing memory

## Guidelines
- Always explain your reasoning
- When uncertain, ask for clarification
- For sensitive operations, clearly explain what will happen and ask for confirmation
- Never attempt to access or modify files without explicit permission
- Report any errors or issues clearly

Remember: You are here to help, but safety and user control come first.`;
  }

  /**
   * Get tool executor by ID
   */
  private getToolExecutor(toolId: string): ((args: Record<string, unknown>) => Promise<unknown>) | undefined {
    // Check built-in executors
    const executor = TOOL_EXECUTORS[toolId];
    if (executor) {
      return executor;
    }

    // Return a default executor for tools without specific implementation
    return async (args: Record<string, unknown>) => ({
      success: false,
      error: `No executor implemented for tool: ${toolId}`
    });
  }
}

// Export singleton instance
let neuroClawInstance: NeuroClawManager | null = null;

export function getNeuroClaw(options?: NeuroClawManagerOptions): NeuroClawManager {
  if (!neuroClawInstance) {
    neuroClawInstance = new NeuroClawManager(options);
  }
  return neuroClawInstance;
}

export function resetNeuroClaw(): void {
  neuroClawInstance = null;
}
