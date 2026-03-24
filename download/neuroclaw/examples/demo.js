/**
 * NeuroClaw Demo
 */

import NeuroClaw from '../src/index.js';

console.log('\n🧠 NeuroClaw Demo\n');

async function demo() {
    const agent = new NeuroClaw({ memory: { maxSize: 100 } });
    await new Promise(r => setTimeout(r, 1500));

    // Chat
    console.log('─'.repeat(50));
    console.log('💬 Chat');
    console.log('─'.repeat(50));
    
    const response = await agent.process('What is machine learning?');
    console.log(`\n${response.content}\n`);

    // Memory
    console.log('─'.repeat(50));
    console.log('🧬 Memory');
    console.log('─'.repeat(50));
    
    await agent.memory.store('NeuroClaw supports vector memory', { type: 'feature' });
    await agent.memory.store('The framework has self-reflection', { type: 'feature' });
    
    const found = await agent.memory.retrieve('memory features', 3);
    console.log(`Found ${found.length} memories`);
    found.forEach((f, i) => console.log(`  ${i + 1}. ${f.content.substring(0, 40)}...`));

    // Skills
    console.log('\n─'.repeat(50));
    console.log('🎯 Skills');
    console.log('─'.repeat(50));
    
    const sentiment = await agent.useSkill('sentiment', 'I love NeuroClaw!');
    console.log(`Sentiment: ${sentiment.result.sentiment}`);
    
    const summary = await agent.useSkill('summarize', 
        'NeuroClaw is an AI agent framework. It has memory, skills, and computer use capabilities.');
    console.log(`Summary: ${summary.result.summary.substring(0, 50)}...`);

    // Computer
    console.log('\n─'.repeat(50));
    console.log('💻 Computer');
    console.log('─'.repeat(50));
    
    const writeFile = await agent.useComputer('file_write', {
        path: '/home/z/my-project/download/neuroclaw/demo.txt',
        content: 'Hello from NeuroClaw!'
    });
    console.log(`Write: ${writeFile.success ? 'OK' : writeFile.error}`);
    
    const shell = await agent.useComputer('shell_exec', { command: 'echo "Shell works!"' });
    console.log(`Shell: ${shell.success ? shell.stdout.trim() : shell.error}`);

    // Stats
    console.log('\n─'.repeat(50));
    console.log('📊 Stats');
    console.log('─'.repeat(50));
    
    const stats = agent.getStats();
    console.log(`Messages: ${stats.messagesProcessed}`);
    console.log(`Tokens: ${stats.tokensUsed}`);
    console.log(`Memory: ${stats.memorySize}`);

    await agent.close();
    console.log('\n✅ Done\n');
}

demo().catch(console.error);
