/**
 * NeuroClaw - Main Entry Point
 * Export all modules for easy access
 */

// Types
export * from './types';

// Providers
export * from './providers/factory';
export { BaseLLMProvider } from './providers/base';
export { OllamaProvider } from './providers/ollama';
export { HuggingFaceProvider } from './providers/huggingface';

// Permissions
export { PermissionManager } from './permissions/manager';
export type { PermissionAuditLog, PermissionManagerConfig, PermissionCallback } from './permissions/manager';

// Core
export { CoreAgent } from './core/agent';
export type { AgentExecutionOptions, AgentExecutionResult } from './core/agent';

// Tools
export * from './tools/registry';
export * from './tools/executors';
