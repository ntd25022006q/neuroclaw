/**
 * Skill Ecosystem - Extensible Skill System
 */

import ZAI from 'z-ai-web-dev-sdk';

export class SkillEcosystem {
    constructor(router, config = {}) {
        this.router = router;
        this.skills = new Map();
        this.categories = new Map();
        this.zai = null;
        
        this.stats = {
            totalSkills: 0,
            executions: 0,
            successfulExecutions: 0,
            failedExecutions: 0
        };

        this._init();
        this._registerBuiltins();
    }

    async _init() {
        try {
            this.zai = await ZAI.create();
        } catch {}
    }

    _registerBuiltins() {
        // Summarize
        this.register({
            name: 'summarize',
            description: 'Summarize text',
            category: 'text',
            execute: async (text, options = {}) => {
                const response = await this.router.chat({
                    messages: [
                        { role: 'system', content: 'Summarize concisely.' },
                        { role: 'user', content: `Summarize in ${options.maxSentences || 3} sentences:\n\n${text}` }
                    ]
                });
                return { summary: response.content, originalLength: text.length, summaryLength: response.content.length };
            }
        });

        // Translate
        this.register({
            name: 'translate',
            description: 'Translate text',
            category: 'language',
            execute: async (text, options = {}) => {
                const targetLang = options.targetLang || 'English';
                const response = await this.router.chat({
                    messages: [
                        { role: 'system', content: `Translate to ${targetLang}.` },
                        { role: 'user', content: text }
                    ]
                });
                return { original: text, translated: response.content, targetLang };
            }
        });

        // Code Analyze
        this.register({
            name: 'code-analyze',
            description: 'Analyze code',
            category: 'code',
            execute: async (code, options = {}) => {
                const response = await this.router.chat({
                    messages: [
                        { role: 'system', content: 'Analyze code for issues and improvements.' },
                        { role: 'user', content: `Analyze:\n\`\`\`${options.language || 'javascript'}\n${code}\n\`\`\`` }
                    ]
                });
                return { analysis: response.content, language: options.language || 'javascript' };
            }
        });

        // Code Generate
        this.register({
            name: 'code-generate',
            description: 'Generate code',
            category: 'code',
            execute: async (description, options = {}) => {
                const response = await this.router.chat({
                    messages: [
                        { role: 'system', content: 'Generate clean code.' },
                        { role: 'user', content: `Generate ${options.language || 'JavaScript'}:\n${description}` }
                    ]
                });
                return { code: response.content, language: options.language || 'JavaScript' };
            }
        });

        // Sentiment
        this.register({
            name: 'sentiment',
            description: 'Analyze sentiment',
            category: 'analysis',
            execute: async (text, options = {}) => {
                const response = await this.router.chat({
                    messages: [
                        { role: 'system', content: 'Output JSON only.' },
                        { role: 'user', content: `Sentiment of "${text}":\n{"sentiment":"positive|negative|neutral","score":0.0-1.0}` }
                    ],
                    temperature: 0.3
                });
                try {
                    const match = response.content.match(/\{[\s\S]*\}/);
                    return match ? JSON.parse(match[0]) : { sentiment: 'neutral', score: 0.5 };
                } catch {
                    return { sentiment: 'neutral', score: 0.5 };
                }
            }
        });

        // Keywords
        this.register({
            name: 'keyword-extract',
            description: 'Extract keywords',
            category: 'analysis',
            execute: async (text, options = {}) => {
                const response = await this.router.chat({
                    messages: [
                        { role: 'system', content: 'Output JSON array only.' },
                        { role: 'user', content: `Extract ${options.limit || 10} keywords:\n${text}\n["word1","word2"]` }
                    ],
                    temperature: 0.3
                });
                try {
                    const match = response.content.match(/\[[\s\S]*\]/);
                    return { keywords: match ? JSON.parse(match[0]) : [] };
                } catch {
                    return { keywords: [] };
                }
            }
        });

        // JSON Format
        this.register({
            name: 'json-format',
            description: 'Format JSON',
            category: 'data',
            execute: async (input, options = {}) => {
                try {
                    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
                    return { valid: true, formatted: JSON.stringify(parsed, null, 2) };
                } catch (error) {
                    return { valid: false, error: error.message };
                }
            }
        });

        // Math
        this.register({
            name: 'math',
            description: 'Evaluate math',
            category: 'math',
            execute: async (expression, options = {}) => {
                try {
                    const sanitized = expression.replace(/[^0-9+\-*/().%\s^]/g, '');
                    const result = Function(`"use strict"; return (${sanitized})`)();
                    return { expression, result, valid: true };
                } catch (error) {
                    return { expression, error: error.message, valid: false };
                }
            }
        });

        // Text Stats
        this.register({
            name: 'text-stats',
            description: 'Text statistics',
            category: 'analysis',
            execute: async (text, options = {}) => {
                const words = text.split(/\s+/).filter(w => w.length > 0);
                const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
                return {
                    characters: text.length,
                    words: words.length,
                    sentences: sentences.length,
                    avgWordLength: (text.replace(/\s/g, '').length / words.length || 0).toFixed(2),
                    readingTime: Math.ceil(words.length / 200)
                };
            }
        });

        // Web Search
        this.register({
            name: 'web-search',
            description: 'Search web',
            category: 'web',
            execute: async (query, options = {}) => {
                try {
                    if (!this.zai) this.zai = await ZAI.create();
                    const results = await this.zai.functions.invoke('web_search', {
                        query,
                        num: options.limit || 5
                    });
                    return { query, results: results || [], count: results?.length || 0 };
                } catch (error) {
                    return { query, results: [], count: 0, error: error.message };
                }
            }
        });

        console.log(`🎯 Skill Ecosystem: ${this.skills.size} skills`);
    }

    register(skill) {
        if (!skill.name || typeof skill.execute !== 'function') return false;
        
        this.skills.set(skill.name, {
            name: skill.name,
            description: skill.description || '',
            category: skill.category || 'general',
            execute: skill.execute,
            executions: 0
        });
        
        if (!this.categories.has(skill.category || 'general')) {
            this.categories.set(skill.category || 'general', []);
        }
        this.categories.get(skill.category || 'general').push(skill.name);
        
        this.stats.totalSkills++;
        return true;
    }

    async execute(name, input, options = {}) {
        const skill = this.skills.get(name);
        
        if (!skill) {
            return { success: false, error: `Skill not found: ${name}`, available: Array.from(this.skills.keys()) };
        }
        
        this.stats.executions++;
        skill.executions++;
        
        try {
            const result = await skill.execute(input, options);
            this.stats.successfulExecutions++;
            return { success: true, skill: name, result };
        } catch (error) {
            this.stats.failedExecutions++;
            return { success: false, skill: name, error: error.message };
        }
    }

    async learn(name, examples, options = {}) {
        if (this.skills.has(name)) return { success: false, error: `Skill exists: ${name}` };
        if (!examples || examples.length < 2) return { success: false, error: 'Need 2+ examples' };
        
        this.register({
            name,
            description: options.description || `Learned: ${name}`,
            category: options.category || 'learned',
            execute: async (input, execOptions = {}) => {
                const prompt = `Examples:\n${examples.map((e, i) => `Input: ${JSON.stringify(e.input)}\nOutput: ${JSON.stringify(e.output)}`).join('\n\n')}\n\nNow:\nInput: ${JSON.stringify(input)}\nOutput:`;
                
                const response = await this.router.chat({
                    messages: [{ role: 'user', content: prompt }]
                });
                return { output: response.content, learned: true };
            }
        });
        
        return { success: true, name, examplesLearned: examples.length };
    }

    list(category) {
        const skills = Array.from(this.skills.values());
        return category ? skills.filter(s => s.category === category) : skills;
    }

    search(query) {
        const lower = query.toLowerCase();
        return Array.from(this.skills.values()).filter(s =>
            s.name.toLowerCase().includes(lower) ||
            s.description.toLowerCase().includes(lower)
        );
    }

    count() { return this.skills.size; }

    getCategories() {
        return Array.from(this.categories.entries()).map(([name, skills]) => ({ name, count: skills.length }));
    }

    export() {
        return {
            skills: Array.from(this.skills.values()).map(s => ({ name: s.name, description: s.description, category: s.category })),
            stats: this.stats
        };
    }

    getStats() {
        return { ...this.stats, categories: this.getCategories() };
    }
}

export default SkillEcosystem;
