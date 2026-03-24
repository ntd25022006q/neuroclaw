/**
 * NeuroClaw Providers API
 * Check provider availability and get models
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNeuroClaw } from '@/lib/neuroclaw/manager';
import { LLMProviderFactory } from '@/lib/neuroclaw/providers/factory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    const neuroClaw = getNeuroClaw();

    switch (action) {
      case 'status':
        // Check provider availability
        const providerStatus = await neuroClaw.checkProviders();
        
        return NextResponse.json({
          success: true,
          providers: {
            ollama: {
              available: providerStatus.ollama,
              free: true,
              local: true,
              description: 'Local LLM via Ollama - Zero cost, runs on your hardware'
            },
            huggingface: {
              available: providerStatus.huggingface,
              free: true,
              local: false,
              description: 'HuggingFace Inference API - Free tier available with rate limits'
            },
            openai: {
              available: false, // Would need API key
              free: false,
              local: false,
              requiresApiKey: true,
              description: 'OpenAI GPT models - Requires API key'
            },
            anthropic: {
              available: false, // Would need API key
              free: false,
              local: false,
              requiresApiKey: true,
              description: 'Anthropic Claude models - Requires API key'
            }
          }
        });

      case 'models':
        // Get available models for a provider
        const provider = searchParams.get('provider');
        
        if (!provider) {
          // Return recommended models for all providers
          const allModels = {
            ollama: LLMProviderFactory.getRecommendedModels('ollama'),
            huggingface: LLMProviderFactory.getRecommendedModels('huggingface'),
            openai: LLMProviderFactory.getRecommendedModels('openai'),
            anthropic: LLMProviderFactory.getRecommendedModels('anthropic')
          };

          return NextResponse.json({
            success: true,
            models: allModels
          });
        }

        // Get models for specific provider
        try {
          const models = await neuroClaw.getAvailableModels(provider);
          return NextResponse.json({
            success: true,
            provider,
            models
          });
        } catch {
          // Return recommended models if fetch fails
          const recommended = LLMProviderFactory.getRecommendedModels(provider as 'ollama' | 'huggingface' | 'openai' | 'anthropic');
          return NextResponse.json({
            success: true,
            provider,
            models: recommended,
            note: 'Using recommended models (could not fetch live models)'
          });
        }

      case 'config':
        // Get current configuration
        const config = neuroClaw.getConfig();
        
        return NextResponse.json({
          success: true,
          config: {
            version: config.version,
            defaultLLM: {
              provider: config.defaultLLM.provider,
              model: config.defaultLLM.model
            },
            security: {
              sandboxEnabled: config.security.sandboxEnabled,
              autoApproveLowRisk: config.security.autoApproveLowRisk,
              maxIterationsPerTask: config.security.maxIterationsPerTask
            },
            toolsCount: config.tools.length,
            enabledToolsCount: config.tools.filter(t => t.enabled).length
          }
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Providers API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process request' 
      },
      { status: 500 }
    );
  }
}
