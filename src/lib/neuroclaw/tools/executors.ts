/**
 * NeuroClaw - Tool Executors
 * Implementation of tool execution logic
 */

import type { ToolExecutionResult } from '../types';
import ZAI from 'z-ai-web-dev-sdk';

// ============================================
// Web Search Executor
// ============================================

export async function executeWebSearch(
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const query = args.query as string;
    const numResults = (args.num_results as number) || 5;

    const zai = await ZAI.create();
    const results = await zai.functions.invoke('web_search', {
      query,
      num: numResults
    });

    return {
      success: true,
      data: {
        query,
        results: results.map((r: { url: string; name: string; snippet: string }) => ({
          title: r.name,
          url: r.url,
          snippet: r.snippet
        }))
      },
      permissionsUsed: [],
      duration: 0
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Web search failed',
      permissionsUsed: [],
      duration: 0
    };
  }
}

// ============================================
// Web Page Reader Executor
// ============================================

export async function executeWebPageReader(
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const url = args.url as string;

    const zai = await ZAI.create();
    const result = await zai.functions.invoke('page_reader', { url });

    return {
      success: true,
      data: {
        title: result.data?.title || 'Unknown',
        url: result.data?.url || url,
        content: result.data?.html || '',
        publishedTime: result.data?.publishedTime
      },
      permissionsUsed: [],
      duration: 0
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Page reading failed',
      permissionsUsed: [],
      duration: 0
    };
  }
}

// ============================================
// Calculator Executor
// ============================================

export async function executeCalculator(
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const expression = args.expression as string;
    
    // Safe math expression evaluator
    // Only allow basic math operations
    const safeExpression = expression.replace(/[^0-9+\-*/().%\s^]/g, '');
    
    // Use Function constructor for safe evaluation
    // This is still safer than eval as we've stripped dangerous characters
    const result = Function(`"use strict"; return (${safeExpression})`)();

    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Invalid calculation result');
    }

    return {
      success: true,
      data: {
        expression,
        result,
        formatted: `${expression} = ${result}`
      },
      permissionsUsed: [],
      duration: 0
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Calculation failed',
      permissionsUsed: [],
      duration: 0
    };
  }
}

// ============================================
// Code Execution Executor (Sandboxed)
// ============================================

export async function executeCode(
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const code = args.code as string;
    const language = (args.language as string) || 'javascript';
    const timeout = (args.timeout as number) || 5000;

    // Only support JavaScript/TypeScript for now
    if (language !== 'javascript' && language !== 'typescript') {
      return {
        success: false,
        error: `Language '${language}' is not supported. Only JavaScript and TypeScript are allowed.`,
        permissionsUsed: [],
        duration: 0
      };
    }

    // Simple sandboxed execution
    // In production, this should use a proper sandbox like vm2 or isolated-vm
    const sandbox = {
      console: {
        log: (...msgs: unknown[]) => msgs,
        error: (...msgs: unknown[]) => msgs,
        warn: (...msgs: unknown[]) => msgs
      },
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      JSON
    };

    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Execution timeout')), timeout);
    });

    // Execute with timeout
    const result = await Promise.race([
      executeInSandbox(code, sandbox),
      timeoutPromise
    ]);

    return {
      success: true,
      data: {
        result,
        language,
        executedAt: new Date().toISOString()
      },
      permissionsUsed: [],
      duration: 0
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Code execution failed',
      permissionsUsed: [],
      duration: 0
    };
  }
}

/**
 * Execute code in a sandboxed environment
 */
async function executeInSandbox(
  code: string,
  sandbox: Record<string, unknown>
): Promise<unknown> {
  try {
    // Wrap code to capture return value
    const wrappedCode = `
      (function() {
        ${code}
      })()
    `;

    // Create function with sandbox context
    const sandboxKeys = Object.keys(sandbox);
    const sandboxValues = Object.values(sandbox);
    
    const fn = new Function(...sandboxKeys, wrappedCode);
    const result = fn(...sandboxValues);

    return result;
  } catch (error) {
    throw new Error(
      `Execution error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================
// Text Analysis Executor
// ============================================

export async function executeTextAnalysis(
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const text = args.text as string;
    const analysisType = (args.analysis_type as string) || 'all';

    const result: Record<string, unknown> = {
      textLength: text.length,
      wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
      sentenceCount: text.split(/[.!?]+/).filter(s => s.trim().length > 0).length
    };

    // Simple sentiment analysis (basic keyword-based)
    if (analysisType === 'sentiment' || analysisType === 'all') {
      const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'best', 'love', 'happy', 'joy', 'beautiful'];
      const negativeWords = ['bad', 'terrible', 'awful', 'worst', 'hate', 'sad', 'angry', 'horrible', 'poor', 'disappointing'];
      
      const lowerText = text.toLowerCase();
      const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
      const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;
      
      result.sentiment = {
        score: (positiveCount - negativeCount) / Math.max(positiveCount + negativeCount, 1),
        label: positiveCount > negativeCount ? 'positive' : (negativeCount > positiveCount ? 'negative' : 'neutral')
      };
    }

    // Extract keywords (simple frequency-based)
    if (analysisType === 'keywords' || analysisType === 'all') {
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3);
      
      const frequency: Record<string, number> = {};
      words.forEach(w => {
        frequency[w] = (frequency[w] || 0) + 1;
      });

      const keywords = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));

      result.keywords = keywords;
    }

    // Simple summary (first 200 chars + last 100 chars for long texts)
    if (analysisType === 'summary' || analysisType === 'all') {
      if (text.length > 300) {
        result.summary = text.substring(0, 200) + '... ' + text.substring(text.length - 100);
      } else {
        result.summary = text;
      }
    }

    return {
      success: true,
      data: result,
      permissionsUsed: [],
      duration: 0
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Text analysis failed',
      permissionsUsed: [],
      duration: 0
    };
  }
}

// ============================================
// Notification Executor
// ============================================

export async function executeNotification(
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const message = args.message as string;
    const type = (args.type as string) || 'info';

    // This would typically integrate with the UI notification system
    // For now, we just return success
    return {
      success: true,
      data: {
        message,
        type,
        sentAt: new Date().toISOString()
      },
      permissionsUsed: [],
      duration: 0
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Notification failed',
      permissionsUsed: [],
      duration: 0
    };
  }
}

// ============================================
// Memory Executor
// ============================================

export async function executeMemory(
  args: Record<string, unknown>,
  shortTermMemory: Map<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const action = args.action as string;
    const key = args.key as string | undefined;
    const value = args.value as string | undefined;

    switch (action) {
      case 'store':
        if (!key || value === undefined) {
          return {
            success: false,
            error: 'Key and value are required for store action',
            permissionsUsed: [],
            duration: 0
          };
        }
        shortTermMemory.set(key, value);
        return {
          success: true,
          data: { stored: true, key },
          permissionsUsed: [],
          duration: 0
        };

      case 'retrieve':
        if (!key) {
          return {
            success: false,
            error: 'Key is required for retrieve action',
            permissionsUsed: [],
            duration: 0
          };
        }
        const retrieved = shortTermMemory.get(key);
        return {
          success: true,
          data: { key, value: retrieved || null },
          permissionsUsed: [],
          duration: 0
        };

      case 'list':
        const keys = Array.from(shortTermMemory.keys());
        return {
          success: true,
          data: { keys, count: keys.length },
          permissionsUsed: [],
          duration: 0
        };

      case 'delete':
        if (!key) {
          return {
            success: false,
            error: 'Key is required for delete action',
            permissionsUsed: [],
            duration: 0
          };
        }
        const deleted = shortTermMemory.delete(key);
        return {
          success: true,
          data: { deleted, key },
          permissionsUsed: [],
          duration: 0
        };

      default:
        return {
          success: false,
          error: `Unknown action: ${action}`,
          permissionsUsed: [],
          duration: 0
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Memory operation failed',
      permissionsUsed: [],
      duration: 0
    };
  }
}

// ============================================
// Image Generation Executor
// ============================================

export async function executeImageGeneration(
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const prompt = args.prompt as string;
    const size = (args.size as string) || '1024x1024';

    const zai = await ZAI.create();
    const response = await zai.images.generations.create({
      prompt,
      size: size as '1024x1024' | '768x1344' | '864x1152' | '1344x768' | '1152x864' | '1440x720' | '720x1440'
    });

    return {
      success: true,
      data: {
        prompt,
        size,
        imageBase64: response.data[0]?.base64,
        generatedAt: new Date().toISOString()
      },
      permissionsUsed: [],
      duration: 0
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Image generation failed',
      permissionsUsed: [],
      duration: 0
    };
  }
}

// ============================================
// Executor Registry
// ============================================

export const TOOL_EXECUTORS: Record<string, (args: Record<string, unknown>) => Promise<ToolExecutionResult>> = {
  web_search: executeWebSearch,
  web_page_reader: executeWebPageReader,
  calculator: executeCalculator,
  code_execution: executeCode,
  text_analysis: executeTextAnalysis,
  notification: executeNotification,
  image_generation: executeImageGeneration
};

export function getExecutor(toolId: string): ((args: Record<string, unknown>) => Promise<ToolExecutionResult>) | undefined {
  return TOOL_EXECUTORS[toolId];
}
