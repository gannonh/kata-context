# Kata Context

> **Status: Pre-alpha** — Building in public. Not ready for use.

## What This Is

Kata Context is a standalone context policy engine for AI agents. It manages what goes in and out of the LLM context window — handling compaction, summarization, retrieval, and budget-aware windowing. Framework-agnostic: works with any agent system, or none.

Part of the Kata ecosystem, alongside [Kata Orchestrator](https://github.com/anthropics/kata-orchestrator).

## Core Value

**Policy, not storage.** Given messages and a context budget, determine the optimal window to send to the model. The value isn't persisting conversations — it's intelligently managing finite context.

## The Key Insight

Kata Context answers ONE question: **"Given this conversation history and this token budget, what's the optimal context window to send?"**

It doesn't care about:
- Which LLM you're using
- How your agent is structured
- What tools you have
- How you handle responses

```
┌─────────────────────────────────────┐
│         Your Agent Code             │
│  (LangChain, custom, Kata, etc.)    │
└─────────────────┬───────────────────┘
                  │ "What should I send?"
                  ▼
┌─────────────────────────────────────┐
│         Kata Context                │
│  - Stores full history              │
│  - Applies policy                   │
│  - Returns optimal window           │
└─────────────────┬───────────────────┘
                  │ Optimized context
                  ▼
┌─────────────────────────────────────┐
│         Any LLM                     │
│  (OpenAI, Anthropic, local, etc.)   │
└─────────────────────────────────────┘
```

## Infrastructure, Not Framework

| Aspect           | Framework (Letta, LangChain) | Infrastructure (Kata Context) |
| ---------------- | ---------------------------- | ----------------------------- |
| **Relationship** | You build *inside* it        | You *call* it from outside    |
| **Control**      | Framework controls lifecycle | You control lifecycle         |
| **Opinions**     | Dictates agent patterns      | No opinion on agent design    |
| **Coupling**     | Tight — hard to leave        | Loose — easy to swap          |
| **Analogy**      | Rails                        | Postgres                      |

## Usage

```python
from kata_context import Context

# Use with any agent framework, or none
ctx = Context(context_id="my-agent-session")

# Store whatever you want
ctx.append([
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi there!"},
])

# Get optimal window for your model's budget
window = ctx.get_window(token_budget=8000, policy="balanced")

# Send to ANY LLM — we don't care which
response = openai.chat.completions.create(
    model="gpt-4",
    messages=window,
)
```

## License

Apache 2.0 (core engine and SDKs)
