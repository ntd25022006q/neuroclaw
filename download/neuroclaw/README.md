# NeuroClaw

Multi-task AI Agent Framework

## Installation

```bash
git clone https://github.com/ntd25022006q/neuroclaw.git
cd neuroclaw
npm install
```

## Usage

```javascript
import NeuroClaw from './src/index.js';

const agent = new NeuroClaw();

// Chat
const response = await agent.process('What is AI?');

// Memory
await agent.memory.store('Important info', { type: 'note' });
const found = await agent.memory.retrieve('info', 5);

// Skills
const sentiment = await agent.useSkill('sentiment', 'Great product!');

// Computer
await agent.useComputer('file_write', { path: './out.txt', content: 'Hello' });
```

## Modules

| Module | Description |
|--------|-------------|
| NeuralMemory | Vector-based semantic memory |
| HybridRouter | Multi-provider LLM support |
| SelfReflection | Output evaluation & improvement |
| ComputerUse | File, shell, browser operations |
| SkillEcosystem | Extensible skill system |

## Commands

```bash
npm test    # Run tests
npm run demo # Run demo
```

## Skills

- `summarize` - Summarize text
- `translate` - Translate languages
- `sentiment` - Analyze sentiment
- `code-analyze` - Analyze code
- `code-generate` - Generate code
- `keyword-extract` - Extract keywords
- `json-format` - Format JSON
- `math` - Evaluate math
- `text-stats` - Text statistics

## License

MIT
