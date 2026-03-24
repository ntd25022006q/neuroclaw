/**
 * Neural Memory - Vector-based Memory System
 */

import ZAI from 'z-ai-web-dev-sdk';

export class NeuralMemory {
    constructor(config = {}) {
        this.maxSize = config.maxSize || 10000;
        this.embeddingDim = 384;
        
        this.memories = [];
        this.idCounter = 0;
        this.zai = null;
        
        this.stats = {
            stored: 0,
            retrieved: 0,
            embeddingsGenerated: 0
        };

        this._init();
    }

    async _init() {
        try {
            this.zai = await ZAI.create();
            console.log('🧬 Neural Memory initialized');
        } catch (error) {
            console.log('🧬 Neural Memory initialized (local mode)');
        }
    }

    async generateEmbedding(text) {
        this.stats.embeddingsGenerated++;
        return this._textToVector(text);
    }

    _textToVector(text) {
        const vector = new Array(this.embeddingDim).fill(0);
        const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 1);
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            for (let j = 0; j < 3; j++) {
                const hash = this._hash(word + j);
                const idx = Math.abs(hash) % this.embeddingDim;
                vector[idx] += (1 / (i + 1)) * (j + 1) * 0.33;
            }
        }
        
        const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
        return norm > 0 ? vector.map(v => v / norm) : vector;
    }

    _hash(str) {
        let h = 0xdeadbeef;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
            h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
            h ^= h >>> 16;
        }
        return h >>> 0;
    }

    async store(content, metadata = {}) {
        const id = `mem_${++this.idCounter}_${Date.now()}`;
        const embedding = await this.generateEmbedding(content);
        
        this.memories.push({
            id,
            content,
            embedding,
            metadata: {
                ...metadata,
                timestamp: Date.now(),
                accessCount: 0,
                importance: this._calculateImportance(content, metadata)
            }
        });
        
        this.stats.stored++;
        
        if (this.memories.length > this.maxSize) {
            this._consolidate();
        }
        
        return id;
    }

    async retrieve(query, limit = 5) {
        if (this.memories.length === 0) return [];
        
        const queryEmbedding = await this.generateEmbedding(query);
        
        const scored = this.memories.map(mem => ({
            memory: mem,
            score: this._cosineSimilarity(queryEmbedding, mem.embedding)
        }));
        
        scored.sort((a, b) => b.score - a.score);
        
        const results = scored.slice(0, limit).map(s => {
            s.memory.metadata.accessCount++;
            return {
                id: s.memory.id,
                content: s.memory.content,
                score: s.score,
                metadata: { ...s.memory.metadata }
            };
        });
        
        this.stats.retrieved += results.length;
        return results;
    }

    async findNeedle(needle) {
        const results = await this.retrieve(needle, 50);
        for (const result of results) {
            if (result.content.toLowerCase().includes(needle.toLowerCase())) {
                return result;
            }
        }
        return null;
    }

    _cosineSimilarity(a, b) {
        let dotProduct = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom > 0 ? dotProduct / denom : 0;
    }

    _calculateImportance(content, metadata) {
        let importance = 0.5;
        if (content.length > 200) importance += 0.1;
        if (content.length > 500) importance += 0.1;
        if (metadata.type === 'critical') importance += 0.3;
        if (metadata.type === 'error') importance += 0.15;
        return Math.min(importance, 1.0);
    }

    get(id) {
        const memory = this.memories.find(m => m.id === id);
        if (memory) memory.metadata.accessCount++;
        return memory || null;
    }

    async update(id, updates) {
        const memory = this.memories.find(m => m.id === id);
        if (!memory) return false;
        
        if (updates.content) {
            memory.content = updates.content;
            memory.embedding = await this.generateEmbedding(updates.content);
        }
        if (updates.metadata) {
            memory.metadata = { ...memory.metadata, ...updates.metadata };
        }
        return true;
    }

    delete(id) {
        const index = this.memories.findIndex(m => m.id === id);
        if (index === -1) return false;
        this.memories.splice(index, 1);
        return true;
    }

    size() { return this.memories.length; }

    clear() { this.memories = []; }

    _consolidate() {
        const scored = this.memories.map(m => ({
            memory: m,
            score: m.metadata.importance * 0.7 + Math.min(m.metadata.accessCount / 10, 0.3)
        }));
        scored.sort((a, b) => b.score - a.score);
        this.memories = scored.slice(0, this.maxSize * 0.9).map(s => s.memory);
    }

    testPoisoning() {
        const suspicious = [];
        const patterns = [/ignore\s+(all\s+)?previous/i, /forget\s+everything/i];
        
        for (const memory of this.memories) {
            for (const pattern of patterns) {
                if (pattern.test(memory.content)) {
                    suspicious.push({ id: memory.id, content: memory.content.substring(0, 100) });
                    break;
                }
            }
        }
        
        return { safe: suspicious.length === 0, suspiciousCount: suspicious.length, details: suspicious };
    }

    export() {
        return {
            memories: this.memories.map(m => ({ id: m.id, content: m.content, metadata: m.metadata })),
            stats: this.stats
        };
    }

    async import(data) {
        if (data.memories) {
            for (const mem of data.memories) {
                await this.store(mem.content, mem.metadata);
            }
        }
        if (data.stats) this.stats = { ...this.stats, ...data.stats };
    }

    getStats() {
        return {
            ...this.stats,
            totalMemories: this.memories.length,
            avgImportance: this.memories.reduce((sum, m) => sum + m.metadata.importance, 0) / this.memories.length || 0
        };
    }
}

export default NeuralMemory;
