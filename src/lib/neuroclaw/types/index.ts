/**
 * NeuroClaw - Multi-Agent AI Framework with Security-First Design
 * Core Type Definitions
 */

// ============================================
// LLM Provider Types
// ============================================

export type LLMProviderType = 'huggingface' | 'ollama' | 'openai' | 'anthropic' | 'google' | 'custom';

export interface LLMConfig {
  provider: LLMProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface ChatCompletionResponse {
  id: string;
  content: string;
  model: string;
  provider: LLMProviderType;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// ============================================
// Tool System Types
// ============================================

export type PermissionLevel = 'read' | 'write' | 'execute' | 'admin' | 'dangerous';

export interface ToolPermission {
  level: PermissionLevel;
  requiresConfirmation: boolean;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  allowedInSandbox: boolean;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  version: string;
  permissions: ToolPermission;
  parameters: ToolParameter[];
  enabled: boolean;
  trusted: boolean;
}

export type ToolCategory = 
  | 'filesystem'
  | 'web'
  | 'code'
  | 'communication'
  | 'data'
  | 'system'
  | 'ai'
  | 'custom';

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  default?: unknown;
  enum?: string[];
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
  permissionsUsed: PermissionLevel[];
  duration: number;
}

// ============================================
// Permission System Types
// ============================================

export interface PermissionRequest {
  id: string;
  toolId: string;
  action: string;
  parameters: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  timestamp: Date;
}

export interface PermissionResponse {
  requestId: string;
  granted: boolean;
  reason?: string;
  grantedBy: 'user' | 'auto' | 'policy';
  grantedAt: Date;
}

export interface PermissionPolicy {
  toolId: string;
  allowedActions: string[];
  autoApprove: string[];
  requireConfirmation: string[];
  denied: string[];
  maxCallsPerHour?: number;
  maxCallsPerDay?: number;
}

export interface SessionPermissions {
  sessionId: string;
  policies: Map<string, PermissionPolicy>;
  approvedActions: Set<string>;
  deniedActions: Set<string>;
  callCounts: Map<string, { hour: number; day: number; lastReset: Date }>;
}

// ============================================
// Agent Types
// ============================================

export type AgentRole = 
  | 'coordinator'
  | 'researcher'
  | 'coder'
  | 'analyst'
  | 'writer'
  | 'assistant'
  | 'custom';

export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  systemPrompt: string;
  llmConfig: LLMConfig;
  enabledTools: string[];
  permissions: SessionPermissions;
  memory: AgentMemory;
  maxIterations: number;
  timeout: number;
}

export interface AgentMemory {
  shortTerm: Map<string, unknown>;
  longTerm: Map<string, unknown>;
  conversationHistory: ChatMessage[];
  maxHistoryLength: number;
}

export interface AgentState {
  status: 'idle' | 'thinking' | 'executing' | 'waiting_approval' | 'error';
  currentTask?: string;
  lastAction?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface AgentTask {
  id: string;
  description: string;
  assignedTo: string;
  status: 'pending' | 'in_progress' | 'waiting_approval' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dependencies: string[];
  result?: unknown;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// ============================================
// Team Types
// ============================================

export interface TeamConfig {
  id: string;
  name: string;
  description: string;
  agents: AgentConfig[];
  coordinator: string;
  sharedMemory: Map<string, unknown>;
  communicationLog: CommunicationMessage[];
}

export interface CommunicationMessage {
  id: string;
  from: string;
  to: string | 'all';
  content: string;
  type: 'task' | 'result' | 'query' | 'notification' | 'approval_request';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ============================================
// Session Types
// ============================================

export interface Session {
  id: string;
  userId: string;
  teamConfig?: TeamConfig;
  activeAgent: string;
  messages: ChatMessage[];
  permissions: SessionPermissions;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

// ============================================
// Configuration Types
// ============================================

export interface NeuroClawConfig {
  version: string;
  defaultLLM: LLMConfig;
  fallbackLLM?: LLMConfig;
  security: SecurityConfig;
  agents: AgentConfig[];
  tools: ToolDefinition[];
  logging: LoggingConfig;
}

export interface SecurityConfig {
  sandboxEnabled: boolean;
  requireConfirmationFor: PermissionLevel[];
  autoApproveLowRisk: boolean;
  maxIterationsPerTask: number;
  sessionTimeout: number;
  rateLimitPerMinute: number;
  allowedDomains?: string[];
  blockedDomains?: string[];
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  logToolExecutions: boolean;
  logPermissionRequests: boolean;
  logLLMCalls: boolean;
  retentionDays: number;
}
