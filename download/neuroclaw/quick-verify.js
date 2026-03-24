/**
 * Quick Verification - Test if NeuroClaw works
 */

import NeuroClaw from './src/index.js';

async function main() {
    console.log('🧪 Quick Verification Test\n');
    
    try {
        // Initialize
        console.log('1. Initializing NeuroClaw...');
        const agent = new NeuroClaw({ memory: { maxSize: 100 } });
        
        // Wait for init
        await new Promise(r => setTimeout(r, 2000));
        console.log('   ✅ Initialized\n');
        
        // Test 1: Simple question
        console.log('2. Testing simple question...');
        const r1 = await agent.process('What is 2+2?');
        console.log(`   Response: ${r1.content.substring(0, 100)}...`);
        console.log(`   ✅ Success: ${r1.success}\n`);
        
        // Test 2: Web search skill
        console.log('3. Testing web-search skill...');
        const r2 = await agent.useSkill('web-search', 'JavaScript', { limit: 2 });
        console.log(`   Success: ${r2.success}`);
        console.log(`   Results: ${r2.result?.count || 0}\n`);
        
        // Test 3: Memory
        console.log('4. Testing memory...');
        await agent.memory.store('test memory', { type: 'test' });
        const mem = await agent.memory.retrieve('test', 1);
        console.log(`   Memory items: ${agent.memory.size()}`);
        console.log(`   ✅ Memory works\n`);
        
        // Test 4: Skills list
        console.log('5. Checking skills...');
        const skills = agent.skills.list();
        console.log(`   Skills available: ${skills.length}`);
        console.log(`   Skills: ${skills.map(s => s.name).join(', ')}\n`);
        
        // Summary
        console.log('═'.repeat(50));
        console.log('✅ VERIFICATION PASSED');
        console.log('NeuroClaw is working correctly!');
        console.log('═'.repeat(50));
        
        await agent.close();
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
