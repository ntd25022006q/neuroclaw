/**
 * Self-Reflection - LLM-based Self Improvement
 */

export class SelfReflection {
    constructor(router, config = {}) {
        this.router = router;
        this.enabled = config.enabled !== false;
        this.minScoreThreshold = config.minScoreThreshold || 0.7;
        
        this.history = [];
        this.stats = {
            totalReflections: 0,
            improvements: 0,
            avgScore: 0,
            scores: []
        };

        console.log('🪞 Self-Reflection initialized');
    }

    async reflect(params) {
        const { input, output } = params;
        
        if (!this.enabled) return { needsImprovement: false, score: 1.0 };
        
        this.stats.totalReflections++;
        
        const evaluation = await this._evaluate(input, output);
        const suggestions = await this._generateSuggestions(input, output, evaluation);
        
        const score = evaluation.score || 0.5;
        
        this.stats.scores.push(score);
        this.stats.avgScore = this.stats.scores.reduce((a, b) => a + b, 0) / this.stats.scores.length;
        
        const result = {
            score,
            needsImprovement: score < this.minScoreThreshold,
            evaluation,
            issues: evaluation.issues || [],
            suggestions,
            feedback: this._formatFeedback(evaluation, suggestions)
        };
        
        this.history.push({
            timestamp: Date.now(),
            inputPreview: input?.substring(0, 100),
            score,
            needsImprovement: result.needsImprovement
        });
        
        return result;
    }

    async _evaluate(input, output) {
        const prompt = `Evaluate this AI response (0.0-1.0):

User: ${input}
AI: ${output}

Rate: relevance, accuracy, completeness, clarity, helpfulness.

JSON format: {"score": 0.0-1.0, "relevance": 0.0-1.0, "accuracy": 0.0-1.0, "completeness": 0.0-1.0, "clarity": 0.0-1.0, "helpfulness": 0.0-1.0, "issues": [], "summary": ""}`;

        try {
            const response = await this.router.chat({
                messages: [
                    { role: 'system', content: 'Output only valid JSON.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3
            });
            
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
            
            const scoreMatch = response.content.match(/(\d+\.?\d*)/);
            return { score: scoreMatch ? parseFloat(scoreMatch[1]) : 0.5 };
        } catch (error) {
            return this._heuristicEvaluation(input, output);
        }
    }

    _heuristicEvaluation(input, output) {
        let score = 0.5;
        
        if (output.length > 50) score += 0.1;
        if (output.length > 200) score += 0.1;
        
        const inputWords = new Set(input.toLowerCase().split(/\W+/));
        const outputWords = new Set(output.toLowerCase().split(/\W+/));
        const overlap = [...inputWords].filter(w => outputWords.has(w)).length;
        score += Math.min(overlap / inputWords.size * 0.2, 0.2);
        
        const issues = [];
        if (output.includes('I cannot') || output.includes('I am unable')) {
            issues.push('Response indicates limitation');
        }
        if (output.length < 30) {
            issues.push('Response is very short');
        }
        
        return { score: Math.max(0, Math.min(1, score)), issues };
    }

    async _generateSuggestions(input, output, evaluation) {
        if (evaluation.score >= 0.8) return [];
        
        const prompt = `Improve this response:
User: ${input}
AI: ${output}
Issues: ${evaluation.issues?.join(', ') || 'Quality could be better'}
Score: ${evaluation.score}

JSON array of 2-3 suggestions: ["suggestion1", "suggestion2"]`;

        try {
            const response = await this.router.chat({
                messages: [
                    { role: 'system', content: 'Output only a JSON array.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.5
            });
            
            const jsonMatch = response.content.match(/\[[\s\S]*\]/);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        } catch {
            return [];
        }
    }

    async improve(output, reflection) {
        const prompt = `Improve this response:
Original: ${output}
Feedback: ${reflection.feedback}
Suggestions: ${reflection.suggestions?.join('\n') || 'Make it better'}

Output only the improved response:`;

        try {
            const response = await this.router.chat({
                messages: [
                    { role: 'system', content: 'Output only improved text.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7
            });
            
            this.stats.improvements++;
            return response.content;
        } catch {
            return output;
        }
    }

    async qualityCheck(input, output) {
        const reflection = await this.reflect({ input, output });
        return reflection.score >= this.minScoreThreshold;
    }

    _formatFeedback(evaluation, suggestions) {
        let feedback = `Score: ${(evaluation.score || 0.5).toFixed(2)}/1.00\n`;
        if (evaluation.summary) feedback += `\nSummary: ${evaluation.summary}\n`;
        if (evaluation.issues?.length > 0) {
            feedback += `\nIssues:\n`;
            evaluation.issues.forEach((issue, i) => { feedback += `  ${i + 1}. ${issue}\n`; });
        }
        if (suggestions?.length > 0) {
            feedback += `\nSuggestions:\n`;
            suggestions.forEach((s, i) => { feedback += `  ${i + 1}. ${s}\n`; });
        }
        return feedback;
    }

    getStats() {
        return { ...this.stats, historySize: this.history.length };
    }

    clearHistory() {
        this.history = [];
        this.stats.scores = [];
    }
}

export default SelfReflection;
