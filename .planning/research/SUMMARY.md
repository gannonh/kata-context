# Research Summary: v0.3.0 Policy Engine

**Project:** Kata Context - Policy Engine Features
**Date:** 2026-02-05
**Overall Confidence:** HIGH

---

## Executive Summary

The v0.3.0 policy engine builds on Kata Context's existing storage foundation without requiring new infrastructure. The schema already supports the three target features: forking (`parentId`, `forkVersion` columns), time-travel (versioned messages), and compaction (soft-delete semantics). The implementation is primarily application logic, not infrastructure expansion.

The core value proposition: "Given messages and a context budget, determine the optimal window to send to the model while preserving critical information." Research across Claude Platform, LangGraph, Google ADK, and Factory.ai reveals mature patterns for all three capabilities. The critical insight from Factory.ai's research: generic summarization optimizes for compression ratio rather than task continuation, destroying "low-entropy" details like file paths and tool call IDs that agents need to continue work. This requires preserving structured metadata separately from prose summaries.

The main architectural risk: compaction, forking, and time-travel create complex interactions around version semantics. Messages must never be renumbered after creation, even during compaction. Forked contexts need copy-on-write semantics to survive parent deletion. Token counts vary across models, requiring tokenizer-aware budgeting. These decisions must be locked down early to avoid expensive rewrites.

---

## Key Findings

### From STACK.md

**Core technology additions:**
- `gpt-tokenizer@3.4.0` - Fast, synchronous token counting for compaction decisions. Smallest bundle (50KB), supports cl100k_base and o200k_base encodings.

**No new infrastructure needed:**
- Existing Drizzle ORM, PostgreSQL with pgvector, Neon hosting remains unchanged
- Schema already supports forking (`parentId`, `forkVersion` on contexts) and time-travel (`version` on messages)
- Policy configuration stored as JSONB column on contexts table (no new tables)

**Key dependency decisions:**
- Chose gpt-tokenizer over tiktoken (WASM overhead) and js-tiktoken (slower, no chat helper)
- Rejected Redis/BullMQ for scheduled compaction (v0.3.0 uses synchronous trigger-on-write)
- Avoided separate policies table (JSONB on contexts sufficient for MVP)

**Schema additions (minimal):**
```sql
ALTER TABLE contexts ADD COLUMN policy_config JSONB;
```

Policy config structure:
```typescript
interface PolicyConfig {
  compaction?: {
    strategy: 'none' | 'sliding_window' | 'token_budget' | 'age_based';
    maxMessages?: number;
    tokenBudget?: number;
    maxAgeDays?: number;
    preserveRoles?: ('system' | 'user' | 'assistant' | 'tool')[];
  };
}
```

**Open questions for implementation:**
1. Multi-level fork chains: recursive parent walk vs denormalization?
   - Recommendation: walk parent chain at runtime, keeps fork fast
2. Compaction and forks: how do forks access soft-deleted parent messages?
   - Recommendation: add `includeDeletedFromParent` flag to fork queries
3. Token counting model: default to o200k_base or allow per-context override?
   - Recommendation: default o200k_base, allow override via `policyConfig.tokenEncoding`

---

### From FEATURES.md

**Table stakes (must-have for v0.3.0):**
1. Threshold-triggered compaction (80% of configured budget is industry standard)
2. Summarization-based compaction (LLM generates summary of older messages)
3. Configurable threshold (different use cases: 5k-150k token ranges)
4. Preserve recent messages verbatim (last 10-20 messages uncompressed)
5. Compaction metadata (track what was compacted, when, by what policy)
6. Fork from message (create new context branching from specific message)
7. Fork options (visible only, include branches, include all - start with visible only)
8. Jump to version (retrieve context state at any historical version)
9. Version history listing (list all versions/checkpoints for navigation)
10. Policy configuration (define compaction rules per context or globally)

**Differentiators (post-MVP):**
- Structured compaction templates (custom summary prompts preserve domain-specific info)
- Artifact tracking (separate index for files/resources, survives compaction)
- Reversible compaction (large outputs become file refs, retrievable on demand)
- Policy presets (pre-configured: "sequential-processing", "multi-phase")
- Multi-level memory (immediate, episodic, semantic at different retention)
- Checkpoint tagging (named checkpoints: "before-refactor", "working-state")

**Anti-features (deliberately avoid):**
- Aggressive auto-compaction without configuration
- Lossy-only summarization (breaks audit trails)
- Compressing recent messages (degrades model "rhythm")
- Full regeneration each compaction (use incremental merging)
- Auto-fork on every edit (creates branching explosion)
- Synchronous compaction in hot path (blocks user operations)

**Compaction thresholds by use case (Claude Platform):**
- 5k-20k tokens: Sequential entity processing (frequent compaction)
- 50k-100k tokens: Multi-phase workflows (balance retention/management)
- 100k-150k tokens: Tasks requiring context (less frequent, more details)
- Default 100k: General long-running tasks

**MVP recommendation (three phases):**
1. Basic compaction (threshold-triggered, summarization, preserve recent, metadata)
2. Forking (fork from message, fork options starting with visible only)
3. Time-travel enhancement (version history, checkpoint tagging, resume from version)

**Defer to later:**
- Artifact tracking (high complexity, unsolved problem)
- Multi-level memory (architectural complexity)
- Branch comparison (nice-to-have UX)
- Structured templates (needs domain discovery)
- Interval-based compaction (threshold is simpler)

---

### From ARCHITECTURE-POLICY-ENGINE.md

**Existing foundation strengths:**
- Soft-delete pattern on contexts (`deletedAt` timestamp)
- Versioned messages with sequential `version` per context
- Token-budgeted windowing (`getByTokenBudget()` foundation)
- Fork tracking columns (`parentId`, `forkVersion`) exist but unused
- CASCADE delete from contexts to messages (safe as long as only soft-delete exposed)

**Recommended component structure:**

```
HTTP Layer (api/v1/contexts/)
    │
    ├─────────────────────────────┐
    ▼                             ▼
Policy Service (NEW)        Repository Layer
    │  - CompactionService        │
    │  - ForkService              │
    │  - TimeTravelService        │
    │                             │
    └────▶ Policy Repository ◀────┘
              - CompactionRepository
              - ForkRepository
```

**Key architectural patterns:**

1. **Service layer orchestration** - Services coordinate multiple repository calls within transactions. Repositories remain focused on single-table operations.

2. **Immutable message history** - Messages never updated after creation. Compaction marks as deleted (soft) rather than removing. Preserves audit trail and enables time-travel.

3. **Version-based time travel** - Use message `version` as canonical time coordinate, not timestamps. Versions are sequential and gap-free; timestamps have precision issues.

4. **Fork as copy-on-write** - Duplicate message rows to new context rather than using references. Keeps query model simple, avoids join complexity. Trade storage for query simplicity.

**Schema modification options:**

- **Option A (recommended for Phase 1):** No changes. Use existing columns, store summaries as system messages.
- **Option B (Phase 2):** Dedicated `compaction_events` table for cleaner separation and auditing.
- **Option C (alternative):** Add JSONB `metadata` column to messages for compaction source tracking.

**Critical anti-patterns to avoid:**

1. **Eager compaction** - Never compact synchronously on message append (creates latency spikes). Trigger asynchronously or via explicit API call.

2. **Stateful compaction thresholds** - Don't store thresholds in context row checked on every read. Policy thresholds live in service configuration.

3. **Destructive time travel** - Never truncate message history to "revert to version N." Fork at version N for new execution path; original unchanged.

4. **Inline summary generation** - Never generate compaction summaries synchronously in request path (LLM calls take seconds). Queue job, return immediately with job ID.

**New API endpoints:**

- `POST /api/v1/contexts/:id/fork` - Create fork from specific version
- `POST /api/v1/contexts/:id/compact` - Trigger manual compaction
- `GET /api/v1/contexts/:id/window?budget=X&atVersion=N` - Extended window with time-travel

**Index recommendations:**

Existing `messages_context_version_idx` on `(contextId, version)` supports all proposed query patterns efficiently:
- Fork queries: `WHERE contextId = ? AND version <= ?`
- Time-travel: `WHERE contextId = ? AND version <= ?`
- Compaction marking: `UPDATE WHERE contextId = ? AND version <= ?`

No additional indexes required for Phase 1-2.

**Integration points with existing system:**

1. `append()` with FOR UPDATE lock: Compaction must respect this lock or risk version conflicts
2. `getByTokenBudget()` traverses all messages: Compaction should reduce set, but version gaps must not break pagination
3. `forkVersion` on contexts: Compaction must not remove message at `forkVersion` or fork reconstruction breaks
4. CASCADE delete on messages: Any hard-delete of contexts bypasses soft-delete semantics for messages
5. `totalTokens` counter on context: Compaction that removes messages must update this counter atomically

---

### From PITFALLS.md

**Critical pitfalls (cause rewrites, data loss, or fundamental failures):**

1. **Compaction destroys critical low-entropy details** (#13)
   - Generic summarization discards file paths, tool call IDs, version numbers that agents need
   - Factory.ai: OpenAI achieved 99.3% token reduction but 0.35 points lower task quality
   - Prevention: Preserve structured metadata separately from prose summary. Build artifact index before summarization.
   - Phase: Compaction policy phase

2. **Fork reference loss on parent deletion** (#14)
   - Current schema uses `SET NULL` on delete for `parentId`, orphaning fork lineage
   - `forkVersion` points to version that no longer exists in accessible context
   - Prevention: Copy pre-fork messages to child at fork time (copy-on-write) or preserve parent messages even when parent soft-deleted
   - Phase: Forking phase

3. **Version counter conflicts after compaction** (#15)
   - External systems storing `(contextId, version)` tuples break when versions renumbered
   - Cursor-based pagination breaks when versions consolidated
   - Prevention: Never renumber versions. Treat version as immutable identity. Use gaps for compacted messages. Add `compactedIntoVersion` field.
   - Phase: Compaction phase

4. **Token count drift across models** (#16)
   - Stored `tokenCount` per message wrong for different models (GPT-4 vs Claude vs GPT-4o)
   - Budget calculated with one tokenizer fails for another model
   - Prevention: Store tokenizer identifier alongside tokenCount. Provide re-tokenization for budget calculations when model changes. Use conservative estimates (pad by 10-20%).
   - Phase: Any cross-model usage

5. **Time-travel queries return inconsistent state** (#17)
   - Batch-inserted messages with different timestamps cause partial batch reconstruction
   - Point-in-time reconstruction may include incomplete atomic operations
   - Prevention: Use transaction timestamp (NOW()) for all messages in batch. Add explicit `batchId`. Use version-based time-travel as primary mechanism.
   - Phase: Time-travel phase

**Moderate pitfalls (cause delays, technical debt, degraded UX):**

6. **Compaction loops from circular event dependencies** (#18)
   - Compaction updates `totalTokens` → triggers policy re-evaluation → runs compaction → repeat
   - Prevention: Explicit loop guards (track "compaction in progress" state). Separate metadata updates from content updates in policy evaluation. Rate limiting (one compaction per context per time window).

7. **Soft-delete unique constraint violations** (#19)
   - Future features needing unique names (named branches) fail with standard unique indexes
   - Prevention: Use PostgreSQL partial indexes: `CREATE UNIQUE INDEX ON contexts (name) WHERE deleted_at IS NULL`

8. **Lost-in-the-middle effect after compaction** (#20)
   - LLMs weigh beginning and end of prompts more heavily. Summarized content in middle loses attention.
   - Prevention: Place critical information in first 25% of reconstructed context. Structure summaries with "current state" first, history second.

9. **Cumulative compression loss across multiple cycles** (#21)
   - Regenerating summaries from scratch causes gradual detail drift as errors compound
   - Factory.ai: incremental merging better than regeneration
   - Prevention: Update summaries rather than regenerate. Anchor critical facts. Version summaries to track lineage.

**Minor pitfalls (annoyances, quickly fixable):**

10. **Fork depth explosion** (#22) - Unlimited forking creates unnavigable trees. Limit depth to 3-5 levels.
11. **Compaction timing during active conversation** (#23) - Threshold trigger doesn't account for conversation state. Debounce compaction, wait for pause.
12. **Inconsistent deletion semantics** (#24) - Messages CASCADE delete on context deletion, but contexts use soft-delete. Never expose hard delete in repository API.

**Existing Kata Context-specific integration warnings:**

The current system has specific points to watch:
- `append()` with FOR UPDATE lock: compaction must respect this lock
- `getByTokenBudget()` traverses all messages: version gaps must not break pagination
- `forkVersion` column: compaction must not remove message at `forkVersion`
- CASCADE delete on messages: any hard-delete bypasses soft-delete semantics
- `totalTokens` counter: compaction must update atomically with message changes

---

## Implications for Roadmap

### Recommended Phase Structure

Based on dependency analysis and risk assessment:

#### Phase 1: Foundation (Low Risk) - ~3 days

**What:** Fork from version + Time-travel query extensions

**Why this order:**
- Uses existing schema columns (`parentId`, `forkVersion`) without modifications
- No LLM dependency, no async complexity
- Validates version semantics before compaction introduces complexity
- Enables testing of time-travel queries independent of compaction

**Deliverables:**
- `ForkService.fork(contextId, atVersion)` - creates forked context with copy-on-write
- `MessageRepository.findByContext({ maxVersion })` - time-travel queries
- `GET /api/v1/contexts/:id/window?atVersion=N` - window at historical point
- `POST /api/v1/contexts/:id/fork` - fork endpoint

**Features from FEATURES.md:**
- Fork from message (table stakes)
- Jump to version (table stakes)
- Version history listing (table stakes)

**Pitfalls avoided:**
- #14 (fork reference loss) - implement copy-on-write from start
- #15 (version conflicts) - lock down immutable version semantics
- #17 (time-travel inconsistency) - establish version-based queries as primary

**Research needed:** None (standard patterns)

---

#### Phase 2: Compaction Core (Medium Risk) - ~4 days

**What:** Threshold detection + Summary storage + Metadata tracking (no LLM integration yet)

**Why this order:**
- Establishes compaction mechanics before async complexity
- Validates artifact preservation before adding LLM summarization
- Allows testing with stub summaries
- Enables measuring impact on query performance

**Deliverables:**
- `CompactionRepository.markCompacted(contextId, upToVersion)` - soft-delete older messages
- `CompactionService.detectThreshold(contextId)` - checks if compaction needed
- `PolicyConfig` schema with Zod validation
- `POST /api/v1/contexts/:id/compact` - manual compaction endpoint (stub summary)
- Compaction metadata storage (when, what policy, token savings)

**Features from FEATURES.md:**
- Threshold-triggered compaction (table stakes)
- Configurable threshold (table stakes)
- Preserve recent messages verbatim (table stakes)
- Compaction metadata (table stakes)

**Pitfalls avoided:**
- #13 (artifact loss) - design artifact index before summarization
- #15 (version conflicts) - use version gaps, never renumber
- #18 (compaction loops) - add loop guards from start
- #20 (lost-in-middle) - structure summaries with critical info first

**Research needed:** None (compaction mechanics well-documented)

---

#### Phase 3: Async Compaction + Summarization (Higher Complexity) - ~3 days

**What:** Background job infrastructure + LLM summarization integration

**Why this order:**
- Compaction mechanics validated in Phase 2
- Can measure latency impact of async vs sync
- LLM provider can be stubbed during testing
- Enables production use with real summarization

**Deliverables:**
- Job queue infrastructure (pg-boss or custom with Postgres)
- Compaction worker processing
- LLM provider abstraction interface
- Prompt engineering for context preservation
- Status polling endpoint

**Features from FEATURES.md:**
- Summarization-based compaction (table stakes)
- Policy configuration (table stakes, extended)

**Pitfalls avoided:**
- #4 (inline summary generation) - async from start
- #21 (cumulative drift) - incremental merge strategy
- #23 (timing) - debounce, pause detection

**Research needed:** Prompt engineering for summaries (not deep research, iterative testing)

---

#### Phase 4: Advanced Features (Optional) - ~5 days

**What:** Checkpoint tagging, fork options (branches/all), policy presets

**Why defer:**
- Not blocking for core functionality
- Requires user feedback to validate UX
- Can be added incrementally

**Deliverables:**
- Checkpoint tagging (named versions)
- Fork options: visible/branches/all (currently just visible)
- Policy presets (sequential-processing, multi-phase)
- Compaction history/audit endpoint

**Features from FEATURES.md:**
- Fork options extended (table stakes, phase 4 for full)
- Checkpoint tagging (differentiator)
- Policy presets (differentiator)

**Pitfalls avoided:**
- #22 (fork depth explosion) - add depth limits with fork options

**Research needed:** UX research for checkpoint/preset patterns

---

### Research Flags

**Phases needing `/kata:kata-research-phase` during planning:**
- **None** - All three core capabilities (forking, time-travel, compaction) have well-documented patterns from Claude Platform, LangGraph, Google ADK, Factory.ai

**Phases with standard patterns (skip additional research):**
- Phase 1 (Foundation): Fork-by-copy and version-based queries are standard
- Phase 2 (Compaction Core): Threshold detection and soft-delete mechanics are documented
- Phase 3 (Async Compaction): Background job patterns are standard (though prompt engineering needs iteration)
- Phase 4 (Advanced): Checkpoint patterns exist in LangGraph, policy presets are configuration

**When to research:**
- If adding artifact tracking (unsolved problem, all systems score 2.2-2.5/5)
- If adding multi-level memory (architectural complexity, research Mem0 patterns)
- If adding reversible compaction with file storage (need to decide storage backend)

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|-----------|-------|
| Stack | HIGH | Existing foundation sufficient. gpt-tokenizer verified via GitHub, npm registry, benchmarks. JSONB policy storage is standard PostgreSQL pattern. |
| Features | HIGH | Table stakes validated against Claude Platform, LangGraph, Google ADK documentation. MVP scope clear from Factory.ai evaluation and anti-pattern research. |
| Architecture | HIGH | Existing schema analysis shows direct support. Service layer pattern is standard. Fork-by-copy and version-based queries have verified implementations (LangGraph, LibreChat). |
| Pitfalls | HIGH | Critical pitfalls sourced from Factory.ai evaluation (artifact loss), soft-delete research (constraint violations), event sourcing patterns (version conflicts), and Chroma research (lost-in-middle). |

**Overall: HIGH** - Research is comprehensive across all four areas with verified sources.

### Gaps to Address During Implementation

1. **Token counting across models** - gpt-tokenizer is OpenAI-focused. For Claude-specific accuracy, will need `@anthropic-ai/sdk` method `messages.countTokens()` (API call). Decision: use gpt-tokenizer as reasonable approximation for v0.3.0, add model-specific counting in SDK integration layer post-v0.3.0.

2. **Artifact tracking design** - Structured metadata index design not fully specified. Research shows this is an unsolved problem across all systems. Decision: design minimal artifact schema during Phase 2 (compaction core) based on existing `messages.toolCallId`, `toolName` fields. Iterate based on usage patterns.

3. **Summary prompt engineering** - Requires domain-specific tuning for Kata Context use cases. Research provides patterns (Factory.ai structured templates, Claude Platform preservation strategies) but not specific prompts. Decision: iterative testing during Phase 3 with probe-based evaluation (can agent continue task?).

4. **Multi-level fork chains** - Walking parent chain recursively vs denormalization at fork time. Decision: walk parent chain at runtime (recommendation from STACK.md open questions). Measure performance during Phase 1, optimize if needed.

5. **Compaction and fork interaction** - How forks access soft-deleted parent messages after parent compaction. Decision: add `includeDeletedFromParent` flag to fork queries (recommendation from STACK.md). Implement in Phase 2 when compaction mechanics exist.

---

## Sources

### HIGH Confidence (Official/Verified)

**Stack:**
- [gpt-tokenizer GitHub](https://github.com/niieani/gpt-tokenizer) - Features, API, performance claims
- [npm registry](https://www.npmjs.com/) - Version verification (gpt-tokenizer@3.4.0)
- [Token Counting Guide 2025](https://www.propelcode.ai/blog/token-counting-tiktoken-anthropic-gemini-guide-2025) - Library comparison
- Existing codebase analysis (schema, repositories) - Verified integration points

**Features:**
- [Claude Platform: Automatic Context Compaction](https://platform.claude.com/cookbook/tool-use-automatic-context-compaction) - Threshold guidelines, implementation patterns
- [LangGraph: Time Travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel) - Checkpoint management, state replay, branching
- [Google ADK: Context Compression](https://google.github.io/adk-docs/context/compaction/) - Interval-based compaction, overlap configuration
- [Anthropic: Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) - Compaction strategies, note-taking patterns

**Architecture:**
- [Anthropic: Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) - Compaction strategies, sub-agent patterns
- [LangChain: LangGraph Checkpointing Reference](https://reference.langchain.com/python/langgraph/checkpoints/) - Checkpoint data model, fork metadata structure
- [Microservices.io: Event Sourcing Pattern](https://microservices.io/patterns/data/event-sourcing.html) - Snapshot optimization, state reconstruction

**Pitfalls:**
- [Factory.ai: Evaluating Context Compression for AI Agents](https://factory.ai/news/evaluating-compression) - Compaction evaluation framework, artifact loss research
- [Hypirion: Implementing System-Versioned Tables in Postgres](https://hypirion.com/musings/implementing-system-versioned-tables-in-postgres) - Temporal table patterns, transaction timestamp semantics
- [DEV Community: Why Soft Delete Can Backfire](https://dev.to/mrakdon/why-soft-delete-can-backfire-on-data-consistency-4epl) - Unique constraint violations
- [Chroma Research: Context Rot](https://research.trychroma.com/context-rot) - Lost-in-middle effect

### MEDIUM Confidence (Verified Technical Sources)

**Features:**
- [Factory.ai: Evaluating Compression](https://factory.ai/news/evaluating-compression) - Compaction evaluation framework
- [LibreChat: Forking](https://www.librechat.ai/docs/features/fork) - Fork options, use cases
- [Will Larson: Context Window Compaction](https://lethain.com/agents-context-compaction/) - Threshold implementation

**Architecture:**
- [LangGraph Postgres Checkpointer Internals](https://blog.lordpatil.com/posts/langgraph-postgres-checkpointer/) - PostgreSQL checkpoint schema
- [Context Compaction Research (GitHub Gist)](https://gist.github.com/badlogic/cd2ef65b0697c4dbe2d13fbecb0a0a5f) - Implementation comparison

**Pitfalls:**
- [LangChain: Context Management for Deep Agents](https://blog.langchain.com/context-management-for-deepagents/) - Cumulative drift patterns
- [Cultured Systems: Avoiding Soft Delete Anti-Pattern](https://www.cultured.systems/2024/04/24/Soft-delete/) - Deletion semantics
- [Chris Kiehl: Event Sourcing is Hard](https://chriskiehl.com/article/event-sourcing-is-hard) - Version conflict patterns

### LOW Confidence (Community Patterns)

**Features:**
- [ChatGPT Branched Chats](https://medium.com/@CherryZhouTech/chatgpt-launches-branched-chats-effortless-multi-threaded-conversations-d188b90bd78b) - User-facing forking patterns
- [Agent-Git](https://github.com/HKU-MAS-Infra-Layer/Agent-Git) - Git-like version control for agents
- [Mem0 Memory Systems](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025) - Multi-level memory patterns

---

## Ready for Requirements

SUMMARY.md synthesizes research from:
- STACK.md (technology decisions, versions, configuration)
- FEATURES.md (table stakes, differentiators, anti-features, phase recommendations)
- ARCHITECTURE-POLICY-ENGINE.md (layer separation, service patterns, integration points)
- PITFALLS.md (critical/moderate/minor pitfalls with prevention strategies)

### Key Takeaways for Roadmapper

1. **Technology stack is minimal and additive**: Single new dependency (gpt-tokenizer), JSONB policy config, no infrastructure changes
2. **Phase structure is clear**: 3 phases for core (Foundation → Compaction Core → Async Compaction) + optional Phase 4 for advanced features
3. **Critical risks are known and mitigable**: Artifact loss, version conflicts, token drift - all have prevention strategies tied to specific phases
4. **Scope is well-defined**: Table stakes identified, differentiators deferred, anti-features documented
5. **Effort estimate is realistic**: ~10 days for core functionality (3+4+3), low-to-medium risk

### Next Steps

The roadmapper should:
1. Convert suggested phases into detailed roadmap with tasks
2. Add specific acceptance criteria based on features and pitfall prevention
3. Incorporate pitfall checklist into phase completion criteria
4. Plan migration for policy_config column before Phase 2 kickoff
5. Schedule prompt engineering iteration cycles during Phase 3

**Research status:** COMPLETE. All dimensions investigated, synthesis complete, ready for requirements definition.

---

*Last updated: 2026-02-05*
