/**
 * NeuroClaw Quick Test - Run core tests only
 */

import NeuroClaw from './src/index.js';
import { promises as fs } from 'fs';
import path from 'path';

const results = { total: 0, passed: 0, failed: 0, tests: [] };
const delay = ms => new Promise(r => setTimeout(r, ms));

async function test(name, fn) {
    results.total++;
    console.log(`\n▶ ${name}`);
    try {
        const r = await fn();
        const pass = r?.score >= 60;
        if (pass) results.passed++; else results.failed++;
        results.tests.push({name, status: pass?'PASS':'FAIL', score: r?.score || 0});
        console.log(`${pass?'✅':'❌'} ${r?.score || 0}pt`);
        return pass;
    } catch (e) {
        results.failed++;
        results.tests.push({name, status:'FAIL', score:0, err:e.message});
        console.log(`❌ ${e.message}`);
        return false;
    }
}

async function main() {
    console.log('\n🧪 NeuroClaw Quick Test\n');
    
    const agent = new NeuroClaw({memory:{maxSize:100}});
    await delay(2000);
    
    // Test 1: Basic chat
    await test('T01: Basic Chat', async()=>{
        const r = await agent.process('Capital of France?');
        return {score: r.content.toLowerCase().includes('paris') ? 100 : 0};
    });
    await delay(3000);
    
    // Test 2: Math
    await test('T02: Math Calculation', async()=>{
        const r = await agent.process('150 - 37 - 48 = ?');
        const has65 = /65/.test(r.content);
        return {score: has65 ? 100 : 30};
    });
    await delay(3000);
    
    // Test 3: Web Search
    await test('T03: Web Search', async()=>{
        const r = await agent.useSkill('web-search','Python tutorial',{limit:2});
        return {score: r.success ? 100 : 0};
    });
    await delay(3000);
    
    // Test 4: JSON Format
    await test('T04: JSON Format', async()=>{
        const r = await agent.useSkill('json-format','{"test":123}');
        return {score: r.success && r.result?.valid ? 100 : 0};
    });
    await delay(3000);
    
    // Test 5: Memory Store/Retrieve
    await test('T05: Memory', async()=>{
        await agent.memory.store('Test memory',{type:'test'});
        const r = await agent.memory.retrieve('test',1);
        return {score: r.length > 0 ? 100 : 0};
    });
    await delay(3000);
    
    // Test 6: File Operations
    await test('T06: File Operations', async()=>{
        const w = await agent.useComputer('file_write',{
            path:'/home/z/my-project/download/neuroclaw/test.txt',
            content:'Hello'
        });
        const r = await agent.useComputer('file_read',{
            path:'/home/z/my-project/download/neuroclaw/test.txt'
        });
        return {score: w.success && r.success ? 100 : 0};
    });
    await delay(3000);
    
    // Test 7: Security - Block dangerous command
    await test('T07: Security', async()=>{
        const r = await agent.useComputer('shell_exec',{command:'rm -rf /'});
        return {score: r.blocked ? 100 : 0};
    });
    await delay(3000);
    
    // Test 8: Sentiment Analysis
    await test('T08: Sentiment', async()=>{
        const r = await agent.useSkill('sentiment','I love this product!');
        return {score: r.success ? 100 : 0};
    });
    await delay(3000);
    
    // Test 9: Math Skill
    await test('T09: Math Skill', async()=>{
        const r = await agent.useSkill('math','2 + 2 * 3');
        return {score: r.success && r.result?.result === 8 ? 100 : 0};
    });
    await delay(3000);
    
    // Test 10: Stats
    await test('T10: Agent Stats', async()=>{
        const stats = agent.getStats();
        return {score: stats.messagesProcessed > 0 ? 100 : 50};
    });
    
    // Cleanup
    await agent.close();
    
    // Results
    const rate = ((results.passed / results.total) * 100).toFixed(1);
    console.log(`\n${'═'.repeat(40)}`);
    console.log(`RESULTS: ${results.passed}/${results.total} (${rate}%)`);
    console.log(`${'═'.repeat(40)}`);
    
    // Write report
    await fs.writeFile('/home/z/my-project/download/neuroclaw/test-results.md', 
`# NeuroClaw Test Results

## Summary
- Total: ${results.total}
- Passed: ${results.passed}
- Failed: ${results.failed}
- Pass Rate: ${rate}%

## Tests
| Name | Status | Score |
|------|--------|-------|
${results.tests.map(t=>`| ${t.name} | ${t.status} | ${t.score}pt |`).join('\n')}
`);
    
    process.exit(results.failed === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
