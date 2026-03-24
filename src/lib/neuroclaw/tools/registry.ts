/**
 * NeuroClaw - Built-in Tools Registry
 * Predefined tools with security considerations
 */

import type {
  ToolDefinition,
  ToolExecutionResult,
  ToolCategory
} from '../types';

// ============================================
// Tool Category Definitions
// ============================================

export const TOOL_CATEGORIES: Record<ToolCategory, { name: string; description: string }> = {
  filesystem: {
    name: 'File System',
    description: 'Tools for reading and writing files'
  },
  web: {
    name: 'Web',
    description: 'Tools for web browsing and searching'
  },
  code: {
    name: 'Code',
    description: 'Tools for code generation and execution'
  },
  communication: {
    name: 'Communication',
    description: 'Tools for messaging and notifications'
  },
  data: {
    name: 'Data',
    description: 'Tools for data processing and analysis'
  },
  system: {
    name: 'System',
    description: 'Tools for system operations'
  },
  ai: {
    name: 'AI',
    description: 'Tools for AI-powered operations'
  },
  custom: {
    name: 'Custom',
    description: 'Custom user-defined tools'
  }
};

// ============================================
// Web Search Tool
// ============================================

export const webSearchTool: ToolDefinition = {
  id: 'web_search',
  name: 'Web Search',
  description: 'Search the web for information. Returns relevant search results with URLs and snippets.',
  category: 'web',
  version: '1.0.0',
  permissions: {
    level: 'read',
    requiresConfirmation: false,
    description: 'Search the web for information',
    riskLevel: 'low',
    allowedInSandbox: true
  },
  parameters: [
    {
      name: 'query',
      type: 'string',
      required: true,
      description: 'The search query'
    },
    {
      name: 'num_results',
      type: 'number',
      required: false,
      description: 'Number of results to return',
      default: 5
    }
  ],
  enabled: true,
  trusted: true
};

// ============================================
// Web Page Reader Tool
// ============================================

export const webPageReaderTool: ToolDefinition = {
  id: 'web_page_reader',
  name: 'Web Page Reader',
  description: 'Read and extract content from a web page URL.',
  category: 'web',
  version: '1.0.0',
  permissions: {
    level: 'read',
    requiresConfirmation: false,
    description: 'Read content from web pages',
    riskLevel: 'low',
    allowedInSandbox: true
  },
  parameters: [
    {
      name: 'url',
      type: 'string',
      required: true,
      description: 'The URL to read'
    }
  ],
  enabled: true,
  trusted: true
};

// ============================================
// Text Analysis Tool
// ============================================

export const textAnalysisTool: ToolDefinition = {
  id: 'text_analysis',
  name: 'Text Analysis',
  description: 'Analyze text for sentiment, key phrases, and summary.',
  category: 'ai',
  version: '1.0.0',
  permissions: {
    level: 'read',
    requiresConfirmation: false,
    description: 'Analyze text content',
    riskLevel: 'low',
    allowedInSandbox: true
  },
  parameters: [
    {
      name: 'text',
      type: 'string',
      required: true,
      description: 'The text to analyze'
    },
    {
      name: 'analysis_type',
      type: 'string',
      required: false,
      description: 'Type of analysis to perform',
      enum: ['sentiment', 'summary', 'keywords', 'all'],
      default: 'all'
    }
  ],
  enabled: true,
  trusted: true
};

// ============================================
// Code Execution Tool (Sandboxed)
// ============================================

export const codeExecutionTool: ToolDefinition = {
  id: 'code_execution',
  name: 'Code Execution',
  description: 'Execute code in a sandboxed environment. Supports JavaScript/TypeScript.',
  category: 'code',
  version: '1.0.0',
  permissions: {
    level: 'execute',
    requiresConfirmation: true,
    description: 'Execute code in sandboxed environment',
    riskLevel: 'medium',
    allowedInSandbox: true
  },
  parameters: [
    {
      name: 'code',
      type: 'string',
      required: true,
      description: 'The code to execute'
    },
    {
      name: 'language',
      type: 'string',
      required: false,
      description: 'Programming language',
      enum: ['javascript', 'typescript', 'python'],
      default: 'javascript'
    },
    {
      name: 'timeout',
      type: 'number',
      required: false,
      description: 'Execution timeout in milliseconds',
      default: 5000
    }
  ],
  enabled: true,
  trusted: false
};

// ============================================
// File Read Tool
// ============================================

export const fileReadTool: ToolDefinition = {
  id: 'file_read',
  name: 'File Read',
  description: 'Read content from a file.',
  category: 'filesystem',
  version: '1.0.0',
  permissions: {
    level: 'read',
    requiresConfirmation: true,
    description: 'Read file contents',
    riskLevel: 'medium',
    allowedInSandbox: false
  },
  parameters: [
    {
      name: 'path',
      type: 'string',
      required: true,
      description: 'The file path to read'
    }
  ],
  enabled: true,
  trusted: false
};

// ============================================
// File Write Tool
// ============================================

export const fileWriteTool: ToolDefinition = {
  id: 'file_write',
  name: 'File Write',
  description: 'Write content to a file.',
  category: 'filesystem',
  version: '1.0.0',
  permissions: {
    level: 'write',
    requiresConfirmation: true,
    description: 'Write content to file',
    riskLevel: 'high',
    allowedInSandbox: false
  },
  parameters: [
    {
      name: 'path',
      type: 'string',
      required: true,
      description: 'The file path to write'
    },
    {
      name: 'content',
      type: 'string',
      required: true,
      description: 'The content to write'
    },
    {
      name: 'mode',
      type: 'string',
      required: false,
      description: 'Write mode',
      enum: ['overwrite', 'append'],
      default: 'overwrite'
    }
  ],
  enabled: true,
  trusted: false
};

// ============================================
// Calculator Tool
// ============================================

export const calculatorTool: ToolDefinition = {
  id: 'calculator',
  name: 'Calculator',
  description: 'Perform mathematical calculations.',
  category: 'data',
  version: '1.0.0',
  permissions: {
    level: 'read',
    requiresConfirmation: false,
    description: 'Perform calculations',
    riskLevel: 'low',
    allowedInSandbox: true
  },
  parameters: [
    {
      name: 'expression',
      type: 'string',
      required: true,
      description: 'Mathematical expression to evaluate'
    }
  ],
  enabled: true,
  trusted: true
};

// ============================================
// Image Generation Tool
// ============================================

export const imageGenerationTool: ToolDefinition = {
  id: 'image_generation',
  name: 'Image Generation',
  description: 'Generate images from text descriptions using AI.',
  category: 'ai',
  version: '1.0.0',
  permissions: {
    level: 'execute',
    requiresConfirmation: false,
    description: 'Generate AI images',
    riskLevel: 'low',
    allowedInSandbox: true
  },
  parameters: [
    {
      name: 'prompt',
      type: 'string',
      required: true,
      description: 'Text description of the image to generate'
    },
    {
      name: 'size',
      type: 'string',
      required: false,
      description: 'Image size',
      enum: ['1024x1024', '768x1344', '864x1152', '1344x768', '1152x864', '1440x720', '720x1440'],
      default: '1024x1024'
    }
  ],
  enabled: true,
  trusted: true
};

// ============================================
// Notification Tool
// ============================================

export const notificationTool: ToolDefinition = {
  id: 'notification',
  name: 'Notification',
  description: 'Send a notification to the user.',
  category: 'communication',
  version: '1.0.0',
  permissions: {
    level: 'execute',
    requiresConfirmation: false,
    description: 'Send user notifications',
    riskLevel: 'low',
    allowedInSandbox: true
  },
  parameters: [
    {
      name: 'message',
      type: 'string',
      required: true,
      description: 'The notification message'
    },
    {
      name: 'type',
      type: 'string',
      required: false,
      description: 'Notification type',
      enum: ['info', 'success', 'warning', 'error'],
      default: 'info'
    }
  ],
  enabled: true,
  trusted: true
};

// ============================================
// Memory Tool
// ============================================

export const memoryTool: ToolDefinition = {
  id: 'memory',
  name: 'Memory',
  description: 'Store or retrieve information from agent memory.',
  category: 'ai',
  version: '1.0.0',
  permissions: {
    level: 'read',
    requiresConfirmation: false,
    description: 'Manage agent memory',
    riskLevel: 'low',
    allowedInSandbox: true
  },
  parameters: [
    {
      name: 'action',
      type: 'string',
      required: true,
      description: 'Action to perform',
      enum: ['store', 'retrieve', 'list', 'delete']
    },
    {
      name: 'key',
      type: 'string',
      required: false,
      description: 'Memory key'
    },
    {
      name: 'value',
      type: 'string',
      required: false,
      description: 'Value to store'
    }
  ],
  enabled: true,
  trusted: true
};

// ============================================
// All Built-in Tools
// ============================================

export const BUILTIN_TOOLS: ToolDefinition[] = [
  webSearchTool,
  webPageReaderTool,
  textAnalysisTool,
  codeExecutionTool,
  fileReadTool,
  fileWriteTool,
  calculatorTool,
  imageGenerationTool,
  notificationTool,
  memoryTool
];

// ============================================
// Tool Helpers
// ============================================

export function getToolById(toolId: string): ToolDefinition | undefined {
  return BUILTIN_TOOLS.find(t => t.id === toolId);
}

export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return BUILTIN_TOOLS.filter(t => t.category === category);
}

export function getEnabledTools(): ToolDefinition[] {
  return BUILTIN_TOOLS.filter(t => t.enabled);
}

export function getTrustedTools(): ToolDefinition[] {
  return BUILTIN_TOOLS.filter(t => t.trusted);
}

export function getToolsByRiskLevel(riskLevel: 'low' | 'medium' | 'high' | 'critical'): ToolDefinition[] {
  return BUILTIN_TOOLS.filter(t => t.permissions.riskLevel === riskLevel);
}
