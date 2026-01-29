# Kata Context

## What This Is

A standalone context policy engine for AI agents. Manages what goes in and out of the LLM context window — compaction, summarization, retrieval, and budget-aware windowing. Framework-agnostic infrastructure: works with any agent system, or none.

## Core Value

Given messages and a context budget, determine the optimal window to send to the model. Policy, not storage.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Core Engine:**
- [ ] Versioned context storage with full history
- [ ] Basic compaction policy (configurable aggressiveness)
- [ ] Budget-aware windowing (fit within token limit)
- [ ] Context forking for exploration paths
- [ ] Time-travel (jump to any version)

**API & SDKs:**
- [ ] Framework-agnostic REST API
- [ ] Python SDK
- [ ] TypeScript SDK

**Storage:**
- [ ] PostgreSQL with pgvector

**Commercial MVP (1.0):**
- [ ] Hosted API on Vercel (serverless)
- [ ] Stripe integration for SaaS billing
- [ ] Multi-tenancy and access control

**Later:**
- [ ] Summarization with structured schemas
- [ ] Semantic retrieval for offloaded context (RAG)
- [ ] Advanced policies (custom rules, per-context configuration)
- [ ] Analytics and observability

### Out of Scope

- **Full agent framework** — We're infrastructure (Postgres), not framework (Rails). Use with any agent system.
- **Tool execution/sandboxing** — Orthogonal concern. Use whatever tool layer you want.
- **Agent orchestration** — Kata Orchestrator handles this. We're the context layer beneath it.
- **Opinionated agent patterns** — No opinion on how you build agents.
- **Letta fork/rebrand** — Fresh codebase. Study Letta for learnings, don't import code.

## Context

**Kata Ecosystem:**
Kata Context is one layer in a vertically integrated stack. Kata Orchestrator is the first customer — currently uses markdown files in `.planning/` for state persistence. Works but is brittle (manual edits break workflows, parsing markdown is fragile). Kata Context replaces this with proper context management.

**Why vertical integration:**
1. Real requirements — not guessing what developers need. We are the developer.
2. Proof of concept built-in — production multi-agent system running on Kata Context.
3. Forces good design — if the API is awkward for Kata, it'll be awkward for everyone.

**Prior Art:**
- Letta — Full agent framework with bundled memory. Learning source for context window calculation, summarization approaches. Not forking — context layer is coupled to their agent model.
- mem0, Zep — Similar space, but more opinionated. We're lower-level infrastructure.

**Competitive Positioning:**
The context layer you'd build yourself, but shouldn't have to. Infrastructure, not framework. Works with everything.

## Constraints

- **Tech stack**: Vercel ecosystem (serverless functions, Postgres via Neon with pgvector), TypeScript for server
- **SDKs**: Python and TypeScript required — these are what developers actually use
- **First customer**: Kata Orchestrator — API must support its workflows
- **Solo developer**: One person building, so scope must stay tight
- **Open source**: Public repo from day one, Apache 2.0 for core and SDKs

## Key Decisions

| Decision | Rationale | Outcome |
| -------- | --------- | ------- |
| Standalone layer, not framework | Larger market, cleaner differentiation, smaller surface area | — Pending |
| Fresh codebase, not Letta fork | Avoid rebrand complexity, build what we need | — Pending |
| Vercel serverless deployment | Simplicity, TypeScript-native, scales automatically | — Pending |
| PostgreSQL with pgvector | Battle-tested, embeddings built-in, Vercel Postgres available | — Pending |
| TypeScript for server | Vercel-native, faster iteration than Rust, good enough perf for MVP | — Pending |
| Open source from day one | Builds trust, consistency with other Kata projects, no awkward transition | — Pending |
| Local beta first, then hosted MVP | Validate with self as customer before commercializing | — Pending |
| Open core business model | Open source core for adoption, monetize hosted service | — Pending |
| Small milestones (1-3 phases) | Shippable in a day, maintain momentum | — Pending |

---
*Last updated: 2025-01-29 after initialization*
