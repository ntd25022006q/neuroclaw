/**
 * Hybrid LLM Router - Multi-Provider Support with Rate Limit Handling
 */

import ZAI from 'z-ai-web-dev-sdk';

const delay = ms => new Promise(r => setTimeout(r, ms));

export class HybridRouter {
    constructor(config = {}) {
        this.config = config;
        this.zai = null;
        this.initialized = false;
        
        this.providers = new Map();
        this.providerStatus = new Map();
        
        this.requestTimestamps = [];
        this.maxRequestsPerMinute = config.maxRequestsPerMinute || 30;
        this.minRequestInterval = config.minRequestInterval || 2000; // 2 seconds between requests
        this.lastRequestTime = 0;
        
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            retriedRequests: 0,
            totalTokens: 0
        };

        this._init();
    }

    async _init() {
        try {
            this.zai = await ZAI.create();
            this.initialized = true;
            
            this.providers.set('zai', {
                name: 'ZAI SDK',
                available: true,
                priority: 1
            });
            
            this.providerStatus.set('zai', {
                healthy: true,
                lastCheck: Date.now(),
                failures: 0
            });
            
            console.log('🔀 Hybrid Router initialized');
        } catch (error) {
            console.error('Router initialization failed:', error.message);
            throw error;
        }
    }

    async chat(params, retryCount = 0) {
        const startTime = Date.now();
        const maxRetries = 5;
        const baseDelay = 3000;
        
        // Enforce minimum interval between requests
        const timeSinceLastRequest = Date.now() - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
            await delay(this.minRequestInterval - timeSinceLastRequest);
        }
        
        if (!this._checkRateLimit()) {
            const waitTime = 60000 - (Date.now() - this.requestTimestamps[0]);
            console.log(`Rate limit reached, waiting ${Math.round(waitTime/1000)}s...`);
            await delay(waitTime + 1000);
        }
        
        this.stats.totalRequests++;
        this.lastRequestTime = Date.now();
        
        try {
            if (!this.zai) {
                this.zai = await ZAI.create();
            }
            
            const response = await this.zai.chat.completions.create({
                messages: params.messages,
                temperature: params.temperature ?? 0.7,
                max_tokens: params.maxTokens ?? 2048
            });
            
            const latency = Date.now() - startTime;
            const usage = response.usage || {};
            
            this.stats.successfulRequests++;
            this.stats.totalTokens += usage.total_tokens || 0;
            
            const status = this.providerStatus.get('zai');
            if (status) {
                status.healthy = true;
                status.lastCheck = Date.now();
                status.failures = 0; // Reset failures on success
            }
            
            return {
                success: true,
                content: response.choices[0]?.message?.content || '',
                provider: 'zai',
                model: response.model || 'default',
                usage: {
                    prompt_tokens: usage.prompt_tokens || 0,
                    completion_tokens: usage.completion_tokens || 0,
                    total_tokens: usage.total_tokens || 0
                },
                latency
            };
            
        } catch (error) {
            const errorMsg = error.message || '';
            const isRateLimit = errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('Too many');
            
            this.stats.failedRequests++;
            
            const status = this.providerStatus.get('zai');
            if (status) {
                status.failures++;
                if (status.failures >= 5) status.healthy = false;
            }
            
            // Exponential backoff retry for rate limits
            if (isRateLimit && retryCount < maxRetries) {
                const backoffDelay = baseDelay * Math.pow(2, retryCount);
                console.log(`Rate limited, retry ${retryCount + 1}/${maxRetries} in ${backoffDelay/1000}s...`);
                
                await delay(backoffDelay);
                this.stats.retriedRequests++;
                
                try {
                    this.zai = await ZAI.create();
                    const retry = await this.zai.chat.completions.create({
                        messages: params.messages,
                        temperature: params.temperature ?? 0.7,
                        max_tokens: params.maxTokens ?? 2048
                    });
                    
                    this.stats.successfulRequests++;
                    return {
                        success: true,
                        content: retry.choices[0]?.message?.content || '',
                        provider: 'zai',
                        usage: retry.usage || {},
                        latency: Date.now() - startTime,
                        retried: true,
                        retryCount: retryCount + 1
                    };
                } catch (retryError) {
                    // Recursive retry with exponential backoff
                    return this.chat(params, retryCount + 1);
                }
            }
            
            // Final failure
            if (retryCount >= maxRetries) {
                console.log(`Max retries (${maxRetries}) exceeded`);
            }
            
            return {
                success: false,
                content: '',
                error: error.message,
                provider: 'zai',
                latency: Date.now() - startTime
            };
        }
    }

    async streamChat(params, onChunk) {
        const response = await this.chat(params);
        if (onChunk && response.content) {
            const words = response.content.split(' ');
            for (const word of words) {
                await new Promise(r => setTimeout(r, 30));
                onChunk(word + ' ');
            }
        }
        return response;
    }

    _checkRateLimit() {
        const now = Date.now();
        this.requestTimestamps = this.requestTimestamps.filter(t => t > now - 60000);
        if (this.requestTimestamps.length >= this.maxRequestsPerMinute) return false;
        this.requestTimestamps.push(now);
        return true;
    }

    getAvailableProviders() {
        return Array.from(this.providers.entries())
            .filter(([key]) => this.providerStatus.get(key)?.healthy)
            .map(([key, provider]) => ({ key, name: provider.name, priority: provider.priority }))
            .sort((a, b) => a.priority - b.priority);
    }

    async checkHealth() {
        const health = {};
        for (const [key] of this.providers) {
            try {
                const start = Date.now();
                await this.zai.chat.completions.create({
                    messages: [{ role: 'user', content: 'ping' }],
                    max_tokens: 5
                });
                health[key] = { healthy: true, latency: Date.now() - start };
                this.providerStatus.get(key).healthy = true;
            } catch (error) {
                health[key] = { healthy: false, error: error.message };
                this.providerStatus.get(key).healthy = false;
            }
        }
        return health;
    }

    getStats() {
        return { ...this.stats, providerStatus: Object.fromEntries(this.providerStatus) };
    }

    resetStats() {
        this.stats = { totalRequests: 0, successfulRequests: 0, failedRequests: 0, totalTokens: 0 };
    }
}

export default HybridRouter;
