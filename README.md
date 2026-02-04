# Kata Context

> **Status: v0.2.0 (Database + Storage Layer)** — Storage foundation complete. Building in public.

## What This Is

Kata Context is a standalone context policy engine for AI agents. It manages what goes in and out of the LLM context window — handling compaction, summarization, retrieval, and budget-aware windowing. Framework-agnostic: works with any agent system, or none.

Part of the Kata ecosystem, alongside [Kata Orchestrator](https://github.com/gannonh/kata), [Kata Agents](https://github.com/gannonh/kata-agents), [Kata Context](https://github.com/gannonh/kata-context).

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

## API

REST API for context management with token-budgeted retrieval:

```bash
# Create a context
curl -X POST https://your-app.vercel.app/api/v1/contexts \
  -H "Content-Type: application/json" \
  -d '{"metadata": {"agent": "my-agent"}}'

# Append messages
curl -X POST https://your-app.vercel.app/api/v1/contexts/{id}/messages \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello", "tokenCount": 5}]}'

# Get optimal window for token budget
curl "https://your-app.vercel.app/api/v1/contexts/{id}/window?budget=8000"
```

SDKs for Python and TypeScript coming in v0.3.0.

## Development

```bash
# Install dependencies
pnpm install

# Run tests (87 tests, 100% coverage)
pnpm test

# Lint and format
pnpm check

# Database commands
pnpm db:generate   # Generate migrations
pnpm db:migrate    # Apply migrations
pnpm db:studio     # Open Drizzle Studio

# Build
pnpm build
```

**Stack:** TypeScript 5.9, pnpm, Biome, Vitest, Drizzle ORM, PostgreSQL (Neon), pgvector, Vercel serverless

## Roadmap

- [x] **v0.1.0** — Core Setup (TypeScript, linting, testing, CI)
- [x] **v0.2.0** — Database + Storage Layer (PostgreSQL, repository pattern, REST API)
- [ ] **v0.3.0** — Policy engine (compaction, forking, semantic retrieval)
- [ ] **v1.0** — Hosted API with multi-tenancy

## License

Apache 2.0 (core engine and SDKs)
