/**
 * NeuroClaw - Multi-task AI Agent Framework
 * @version 3.0.0
 */

import { NeuralMemory } from './neural-memory.js';
import { HybridRouter } from './hybrid-router.js';
import { SelfReflection } from './self-reflection.js';
import { ComputerUse } from './computer-use.js';
import { SkillEcosystem } from './skill-ecosystem.js';

export class NeuroClaw {
    constructor(config = {}) {
        this.name = config.name || 'NeuroClaw';
        this.version = '3.0.0';
        this.startTime = Date.now();
        
        this.memory = new NeuralMemory(config.memory || {});
        this.router = new HybridRouter(config.providers || {});
        this.reflection = new SelfReflection(this.router, config.reflection || {});
        this.computer = new ComputerUse(config.computer || {});
        this.skills = new SkillEcosystem(this.router, config.skills || {});
        
        this.state = {
            status: 'initialized',
            tasks: [],
            conversations: [],
            lastActivity: null
        };
        
        this.stats = {
            tasksCompleted: 0,
            messagesProcessed: 0,
            tokensUsed: 0,
            apiCalls: 0,
            errors: 0
        };

        console.log(`🧠 ${this.name} v${this.version} initialized`);
    }

    async process(message, options = {}) {
        const startTime = Date.now();
        this.state.lastActivity = new Date().toISOString();
        
        try {
            await this.memory.store(message, { type: 'user_input' });
            const context = await this.memory.retrieve(message, 5);
            
            const messages = [
                { role: 'system', content: this._buildSystemPrompt() }
            ];
            
            for (const ctx of context) {
                messages.push({ role: 'user', content: `[Context] ${ctx.content}` });
                messages.push({ role: 'assistant', content: 'Noted.' });
            }
            messages.push({ role: 'user', content: message });
            
            const response = await this.router.chat({ messages });
            this.stats.apiCalls++;
            this.stats.tokensUsed += response.usage?.total_tokens || 0;
            
            // Handle failed responses
            if (!response.success) {
                return {
                    success: false,
                    content: response.error || 'Request failed',
                    error: response.error,
                    metadata: {
                        provider: response.provider,
                        processingTime: Date.now() - startTime
                    }
                };
            }
            
            let finalContent = response.content;
            if (options.reflect !== false && response.content) {
                const reflection = await this.reflection.reflect({
                    input: message,
                    output: response.content,
                    context
                });
                
                if (reflection.needsImprovement) {
                    finalContent = await this.reflection.improve(response.content, reflection);
                }
            }
            
            await this.memory.store(finalContent, { type: 'agent_response' });
            this.stats.messagesProcessed++;
            
            return {
                success: true,
                content: finalContent,
                metadata: {
                    provider: response.provider,
                    model: response.model,
                    processingTime: Date.now() - startTime,
                    tokensUsed: response.usage?.total_tokens || 0
                }
            };
            
        } catch (error) {
            this.stats.errors++;
            return { success: false, content: error.message, error: error.message };
        }
    }

    async executeTask(task) {
        const taskId = `task_${Date.now()}`;
        const results = [];
        
        try {
            const plan = await this._planTask(task);
            
            for (let i = 0; i < plan.steps.length; i++) {
                const step = plan.steps[i];
                let stepResult;
                
                switch (step.type) {
                    case 'think':
                        stepResult = await this.process(step.input);
                        break;
                    case 'file_read':
                        stepResult = await this.computer.readFile(step.path);
                        break;
                    case 'file_write':
                        stepResult = await this.computer.writeFile(step.path, step.content);
                        break;
                    case 'shell':
                        stepResult = await this.computer.executeShell(step.command);
                        break;
                    case 'browser_navigate':
                        stepResult = await this.computer.browserNavigate(step.url);
                        break;
                    case 'browser_screenshot':
                        stepResult = await this.computer.browserScreenshot(step.path);
                        break;
                    case 'remember':
                        stepResult = await this.memory.retrieve(step.query, step.limit || 5);
                        break;
                    case 'skill':
                        stepResult = await this.skills.execute(step.skill, step.input);
                        break;
                    default:
                        stepResult = await this.process(JSON.stringify(step));
                }
                
                results.push({ step: i + 1, type: step.type, result: stepResult });
                
                if (!stepResult?.success && step.required !== false) {
                    break;
                }
            }
            
            this.stats.tasksCompleted++;
            return { success: true, taskId, results };
            
        } catch (error) {
            return { success: false, taskId, error: error.message, partialResults: results };
        }
    }

    async useComputer(action, params = {}) {
        switch (action) {
            case 'file_read': return await this.computer.readFile(params.path);
            case 'file_write': return await this.computer.writeFile(params.path, params.content);
            case 'file_list': return await this.computer.listFiles(params.path);
            case 'file_delete': return await this.computer.deleteFile(params.path);
            case 'shell_exec': return await this.computer.executeShell(params.command);
            case 'browser_navigate': return await this.computer.browserNavigate(params.url);
            case 'browser_click': return await this.computer.browserClick(params.selector);
            case 'browser_type': return await this.computer.browserType(params.selector, params.text);
            case 'browser_screenshot': return await this.computer.browserScreenshot(params.path);
            case 'browser_close': return await this.computer.browserClose();
            default: return { success: false, error: `Unknown action: ${action}` };
        }
    }

    async useSkill(skillName, input, options = {}) {
        return await this.skills.execute(skillName, input, options);
    }

    getStats() {
        return {
            ...this.stats,
            uptime: Date.now() - this.startTime,
            memorySize: this.memory.size(),
            activeSkills: this.skills.count()
        };
    }

    export() {
        return {
            name: this.name,
            version: this.version,
            memory: this.memory.export(),
            stats: this.stats
        };
    }

    import(data) {
        if (data.memory) this.memory.import(data.memory);
        if (data.stats) this.stats = { ...this.stats, ...data.stats };
    }

    async close() {
        await this.computer.close();
    }

    _buildSystemPrompt() {
        return `You are ${this.name}, an AI assistant.

Capabilities:
1. Self-Reflection - Review and improve outputs
2. Neural Memory - Store and retrieve information
3. Computer Use - File operations, shell commands, browser automation
4. Skills - Specialized abilities for different tasks

Stats: ${this.stats.tasksCompleted} tasks, ${this.stats.messagesProcessed} messages processed.`;
    }

    async _planTask(task) {
        const planPrompt = `Create a plan for this task:
Task: ${task.description || JSON.stringify(task)}

Output JSON array of steps with: type (think/file_read/file_write/shell/browser_navigate/remember/skill), description, parameters.`;

        const response = await this.router.chat({
            messages: [{ role: 'user', content: planPrompt }]
        });
        
        try {
            const jsonMatch = response.content.match(/\[[\s\S]*\]/);
            if (jsonMatch) return { steps: JSON.parse(jsonMatch[0]) };
        } catch (e) {}
        
        return { steps: [{ type: 'think', description: 'Analyze task', input: task.description }] };
    }
}

export { NeuralMemory } from './neural-memory.js';
export { HybridRouter } from './hybrid-router.js';
export { SelfReflection } from './self-reflection.js';
export { ComputerUse } from './computer-use.js';
export { SkillEcosystem } from './skill-ecosystem.js';

export default NeuroClaw;
