# NeuroClaw

**Multi-task AI Agent Framework** với 38 test cases đánh giá toàn diện.

## 🚀 Features

- **Self-Reflection** - Tự đánh giá và cải thiện output
- **Neural Memory** - Semantic memory với vector embeddings
- **Computer Use** - File, shell, browser operations với sandbox protection
- **Skill Ecosystem** - 10+ built-in skills, dễ mở rộng
- **Hybrid Router** - Multi-provider LLM router với rate limit handling

## 📦 Cài đặt

```bash
git clone https://github.com/ntd25022006q/neuroclaw.git
cd neuroclaw
npm install
```

## 🧪 Test Suite - 38 Test Cases

### Cấp 1 - Dễ (T01-T05)
| Test | Mô tả | Danh mục |
|------|-------|----------|
| T01 | Câu hỏi thực tế đơn giản | Reasoning |
| T02 | Tính toán số học cơ bản | Reasoning |
| T03 | Gọi tool web search | Tool Use |
| T04 | Format JSON theo yêu cầu | Instruction Following |
| T05 | Nhớ context multi-turn | Memory |

### Cấp 2 - Trung bình (T06-T12)
| Test | Mô tả | Danh mục |
|------|-------|----------|
| T06 | Suy luận logic nhiều bước | Reasoning |
| T07 | Chuỗi tool calls phụ thuộc | Tool Use |
| T08 | Phân tích code tìm bug | Reasoning |
| T09 | Multi-turn state tracking | Memory |
| T10 | Ràng buộc phức tạp | Instruction Following |
| T11 | Xử lý prompt injection | Safety |
| T12 | Tool error retry | Tool Use |

### Cấp 3 - Khó (T13-T20, T31-T32, T35-T37)
| Test | Mô tả | Danh mục |
|------|-------|----------|
| T13 | Kế hoạch deploy multi-step | Reasoning |
| T14 | Agent tự lập kế hoạch | Tool Use |
| T15 | Long-context synthesis | Memory |
| T16 | Rule conflict detection | Reasoning |
| T17 | Jailbreak defense | Safety |
| T18 | Ambiguous schema handling | Tool Use |
| T19 | Self-contradicting instructions | Instruction Following |
| T20 | Security code review | Reasoning |
| T31 | Refactoring trade-offs | Reasoning |
| T32 | Privacy leak detection | Safety |
| T35 | Sarcasm detection | Reasoning |
| T36 | Fermi estimation | Reasoning |
| T37 | Adaptive explanation | Instruction Following |

### Cấp 4 - Expert (T21-T30, T33-T34, T38)
| Test | Mô tả | Danh mục |
|------|-------|----------|
| T21 | Distributed system design | Reasoning |
| T22 | Dynamic tool discovery | Tool Use |
| T23 | Cross-session synthesis | Memory |
| T24 | Probabilistic reasoning | Reasoning |
| T25 | Multi-turn adversarial jailbreak | Safety |
| T26 | Self-healing workflow | Tool Use |
| T27 | Logical fallacy detection | Reasoning |
| T28 | Contradiction detection | Memory |
| T29 | Ethical dilemma handling | Reasoning |
| T30 | Noisy data analysis | Tool Use |
| T33 | Game theory | Reasoning |
| T34 | Recursive algorithm design | Tool Use |
| T38 | Bias detection | Safety |

## 🔑 5 Test Phân Loại Quan Trọng

| Test | Mục đích |
|------|----------|
| T11 | Prompt injection defense |
| T16 | Rule conflict detection |
| T22 | Dynamic tool discovery |
| T25 | Adversarial multi-turn jailbreak |
| T26 | Self-healing workflow |

**Pass cả 5 test này = Competitive với OpenClaw**

## 🏃 Chạy Test

```bash
# Quick test (22 tests)
npm run test:quick

# Full test suite (38 tests)
npm test

# Demo
npm run demo
```

## 💻 Sử dụng

```javascript
import NeuroClaw from './src/index.js';

const agent = new NeuroClaw();

// Chat
const response = await agent.process('What is AI?');
console.log(response.content);

// Memory
await agent.memory.store('Important info', { type: 'note' });
const found = await agent.memory.retrieve('info', 5);

// Skills
const sentiment = await agent.useSkill('sentiment', 'Great product!');
const summary = await agent.useSkill('summarize', longText, { maxSentences: 3 });
const analysis = await agent.useSkill('code-analyze', code, { language: 'python' });

// Computer Use
await agent.useComputer('file_write', { 
    path: './output.txt', 
    content: 'Hello World' 
});
const files = await agent.useComputer('file_list', { path: './data' });

// Task Execution
const result = await agent.executeTask({
    name: 'Analysis',
    description: 'Analyze the sentiment of customer reviews'
});

// Stats
console.log(agent.getStats());
```

## 📁 Cấu trúc Project

```
neuroclaw/
├── src/
│   ├── index.js           # Main NeuroClaw class
│   ├── neural-memory.js   # Vector-based memory
│   ├── hybrid-router.js   # Multi-provider LLM router
│   ├── self-reflection.js # Self-improvement
│   ├── computer-use.js    # File/Shell/Browser ops
│   └── skill-ecosystem.js # Extensible skills
├── tests/
│   ├── index.js                    # Quick test (22 tests)
│   ├── comprehensive-38-tests.js   # Full 38 test suite
│   └── complete-test-suite.js      # Alternative suite
├── examples/
│   └── demo.js            # Demo usage
├── package.json
├── README.md
├── TESTING.md             # Test documentation
└── FULL_TEST_RESULTS.md   # Detailed results
```

## 🛡️ Security Features

- **Sandbox Protection** - File operations giới hạn trong allowed paths
- **Command Blocking** - Ngăn chặn dangerous shell commands
- **Injection Detection** - Phát hiện SQL injection, command injection
- **Rate Limit Handling** - Exponential backoff, auto-retry

## 📊 Modules

| Module | Mô tả |
|--------|-------|
| **NeuralMemory** | Semantic memory với vector embeddings, cosine similarity |
| **HybridRouter** | Multi-provider với rate limit handling, retry logic |
| **SelfReflection** | Tự đánh giá (0.0-1.0), generate suggestions, improve output |
| **ComputerUse** | File read/write/list, shell execute, browser automation |
| **SkillEcosystem** | summarize, translate, code-analyze, sentiment, web-search... |

## 🎯 Built-in Skills

| Skill | Mô tả |
|-------|-------|
| summarize | Tóm tắt văn bản |
| translate | Dịch ngôn ngữ |
| code-analyze | Phân tích code |
| code-generate | Tạo code |
| sentiment | Phân tích cảm xúc |
| keyword-extract | Trích xuất từ khóa |
| json-format | Format JSON |
| math | Tính toán |
| text-stats | Thống kê văn bản |
| web-search | Tìm kiếm web |

## 📈 Benchmark

| Level | Pass Rate |
|-------|-----------|
| Cấp 1 - Dễ | Target >95% |
| Cấp 2 - Trung bình | Target >80% |
| Cấp 3 - Khó | Target >70% |
| Cấp 4 - Expert | Target >60% |

## 📝 License

MIT

---

*NeuroClaw v3.0.0 - Multi-task AI Agent Framework*
