# Technology Stack: v0.3.0 Policy Engine

**Project:** Kata Context
**Researched:** 2026-02-05
**Overall Confidence:** HIGH

## Executive Summary

The v0.3.0 policy engine builds on the existing v0.2.0 foundation without requiring new infrastructure dependencies. The three target features (compaction, forking, time-travel) can be implemented using the current stack. One new library is recommended: **gpt-tokenizer** for accurate token counting during compaction decisions.

**Key finding:** The existing schema already supports forking (`parentId`, `forkVersion` on contexts) and time-travel (versioned messages). v0.3.0 is primarily application logic, not infrastructure expansion.

---

## Existing Stack (Do Not Change)

Already validated in v0.2.0 production:

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 24.x | Runtime |
| TypeScript | 5.9.x | Language |
| pnpm | 10.x | Package manager |
| Drizzle ORM | 0.45.1 | Database queries |
| pg | 8.14.1 | PostgreSQL driver |
| Neon PostgreSQL | managed | Database hosting with pgvector |
| Zod | 4.3.6 | Schema validation |
| Vitest | 4.x | Testing |
| Biome | 2.3.x | Linting/formatting |

**Do not re-research or replace these.** Focus below is exclusively on additions for policy engine features.

---

## New Dependencies for v0.3.0

### Token Counting

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| gpt-tokenizer | 3.4.0 | Token counting | Fastest JS tokenizer. Pure JS (no WASM). Supports cl100k_base (GPT-4) and o200k_base (GPT-4o, GPT-5). Synchronous API. ~50KB bundle. |

**Why gpt-tokenizer over alternatives:**

| Library | Pros | Cons | Verdict |
|---------|------|------|---------|
| **gpt-tokenizer** | Fastest. Smallest. Sync API. Chat-aware `encodeChat()`. | OpenAI-focused encodings only | **Use this** |
| js-tiktoken | Pure JS, official OpenAI port | Slower than gpt-tokenizer, no chat helper | Skip |
| tiktoken (WASM) | Full parity with Python | Larger bundle, WASM complexity in serverless | Skip |
| @anthropic-ai/tokenizer | Official Anthropic | Inaccurate for Claude 3+ (deprecated) | Skip |

**Note on Anthropic models:** The `@anthropic-ai/tokenizer` package is inaccurate for Claude 3+ models. For Claude token counting, use the `@anthropic-ai/sdk` method `messages.countTokens()` which calls the API. Since Kata Context is model-agnostic, use gpt-tokenizer as a reasonable approximation for all models. Exact counts can be refined per-provider when the SDK integration layer is built.

**Installation:**

```bash
pnpm add gpt-tokenizer@3.4.0
```

**Usage pattern:**

```typescript
import { encode, isWithinTokenLimit, encodeChat } from 'gpt-tokenizer';

// Simple text tokenization
const tokens = encode(message.content);
const tokenCount = tokens.length;

// Check budget without full encoding (faster)
const fitsInBudget = isWithinTokenLimit(text, budget);

// Chat message tokenization (accounts for role tokens)
const chatTokens = encodeChat([
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi there!' }
]);
```

---

## Schema Additions (No New Tables)

The existing schema already supports the v0.3.0 features. No new tables required.

### Existing Support for Forking

**contexts table** (already has):
```typescript
parentId: uuid("parent_id").references(() => contexts.id)
forkVersion: bigint("fork_version", { mode: "number" })
```

Forking creates a new context with `parentId` pointing to the source and `forkVersion` indicating the version point of divergence. Messages up to `forkVersion` are shared by reference (not copied).

### Existing Support for Time-Travel

**messages table** (already has):
```typescript
version: bigint("version", { mode: "number" }).notNull()
deletedAt: timestamp("deleted_at", { withTimezone: true })
```

Time-travel reconstructs state by selecting messages where `version <= targetVersion` and `deletedAt IS NULL`. No schema changes needed.

### Policy Configuration Storage

Compaction policies need storage. Two options:

**Option A: JSONB column on contexts (Recommended)**

```typescript
// Add to contexts schema
policyConfig: jsonb("policy_config").$type<PolicyConfig>()
```

```typescript
interface PolicyConfig {
  compaction?: {
    strategy: 'none' | 'sliding_window' | 'token_budget' | 'age_based';
    maxMessages?: number;    // sliding_window: keep last N messages
    tokenBudget?: number;    // token_budget: max tokens to retain
    maxAgeDays?: number;     // age_based: delete messages older than N days
    preserveRoles?: ('system' | 'user' | 'assistant' | 'tool')[];  // never compact these
  };
}
```

**Option B: Separate policies table**

Overkill for v0.3.0. Policy configuration belongs with the context it governs. A separate table adds join overhead with no benefit at this stage.

**Recommendation:** Option A. Add `policyConfig` JSONB column to contexts. Validated at application layer with Zod. Can migrate to separate table later if policy complexity grows.

---

## What NOT to Add

| Technology | Why Not |
|------------|---------|
| **Redis / BullMQ** | No background job processing needed for v0.3.0. Compaction is triggered on write, not scheduled. If scheduled compaction needed later, evaluate then. |
| **node-cron** | Same as above. No scheduled jobs in v0.3.0. |
| **tiktoken (WASM)** | Larger bundle, WASM complexity. gpt-tokenizer is faster and smaller. |
| **@anthropic-ai/tokenizer** | Inaccurate for Claude 3+. Use SDK `countTokens()` when Anthropic-specific accuracy needed. |
| **Separate policies table** | Premature abstraction. JSONB on contexts is sufficient for MVP. |
| **Event sourcing library** | Messages table is already append-only and versioned. No library needed. |
| **Copy-on-write database extension** | Fork by reference works with existing schema. No Neon branching needed at application level. |
| **LLM SDK (OpenAI, Anthropic)** | Summarization deferred to post-v0.3.0. When needed, will be injected, not bundled. |

---

## Feature Implementation Strategy

### Compaction Policies

**Implementation:** Application logic in new `PolicyService`.

**No new dependencies.** Uses:
- gpt-tokenizer for token counting
- Existing MessageRepository for queries/deletes
- Zod for policy schema validation

**Compaction triggers:**
1. **On append:** After `MessageRepository.append()`, check if policy threshold exceeded
2. **On read:** Never compact on read (side-effect-free retrieval)
3. **Manual:** API endpoint to trigger compaction

**Compaction is soft-delete.** Sets `deletedAt` on messages, preserving history for time-travel.

### Context Forking

**Implementation:** Application logic in `ContextRepository.fork()`.

**No new dependencies.** Uses:
- Existing `parentId` and `forkVersion` columns
- Copy-on-write semantics: forked context shares message history by reference

**Fork operation:**
1. Create new context with `parentId = sourceContextId` and `forkVersion = sourceLatestVersion`
2. Copy `policyConfig` from source (or allow override)
3. New messages append to forked context only
4. Source context unaffected

**Message visibility in fork:**
```sql
-- Messages visible in forked context
SELECT * FROM messages
WHERE (context_id = :forkId AND version > :forkVersion)
   OR (context_id = :parentId AND version <= :forkVersion AND deleted_at IS NULL)
ORDER BY version ASC;
```

### Time-Travel

**Implementation:** Application logic in `MessageRepository.getAtVersion()`.

**No new dependencies.** Uses existing versioned messages.

**Query pattern:**
```typescript
async getAtVersion(contextId: string, targetVersion: number): Promise<Message[]> {
  return this.db
    .select()
    .from(messages)
    .where(and(
      eq(messages.contextId, contextId),
      lte(messages.version, targetVersion),
      notDeleted(messages)
    ))
    .orderBy(asc(messages.version));
}
```

**For forked contexts:** Walk parent chain to reconstruct full history at any version.

---

## Installation Summary

### Production Dependencies (New)

```bash
pnpm add gpt-tokenizer@3.4.0
```

### No Dev Dependencies Needed

Existing tooling sufficient.

---

## Migration Plan

### Database Migration (One)

```sql
-- Add policy configuration column to contexts
ALTER TABLE contexts
ADD COLUMN policy_config JSONB;

-- Optional: Add partial index for contexts with compaction enabled
CREATE INDEX contexts_has_compaction_idx
ON contexts ((policy_config->>'compaction'))
WHERE policy_config->>'compaction' IS NOT NULL;
```

---

## Confidence Assessment

| Decision | Confidence | Source |
|----------|------------|--------|
| gpt-tokenizer over alternatives | HIGH | [GitHub README](https://github.com/niieani/gpt-tokenizer), [npm registry](https://www.npmjs.com/package/gpt-tokenizer), benchmarks |
| No Redis/BullMQ for v0.3.0 | HIGH | Scope analysis: compaction is synchronous on write, not scheduled |
| JSONB policy column | HIGH | Standard PostgreSQL pattern for flexible config. Zod validates at app layer. |
| Fork-by-reference pattern | HIGH | Existing schema supports it. [LibreChat](https://www.librechat.ai/docs/features/fork), [OpenAI community patterns](https://community.openai.com/t/chatgpt-conversational-fork-copy-on-write/1232643) |
| Time-travel via versioned messages | HIGH | [Event sourcing patterns](https://medium.com/@sudipto76/time-travel-using-event-sourcing-pattern-603a0551d2ff), existing schema |
| Package version | HIGH | npm registry (verified 2026-02-05) |

---

## Alternatives Considered

| Decision | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Token counting | gpt-tokenizer | tiktoken WASM | Larger bundle, WASM complexity |
| Token counting | gpt-tokenizer | js-tiktoken | Slower, no chat helper |
| Policy storage | JSONB column | Separate table | Premature abstraction |
| Scheduled compaction | None | BullMQ | Not needed for v0.3.0 scope |
| Fork implementation | Reference sharing | Full message copy | Wastes storage, slow |

---

## Open Questions for Implementation

1. **Multi-level fork chains:** Should `getAtVersion()` recursively walk parent chain? Or denormalize at fork time?
   - Recommendation: Walk parent chain. Keeps fork fast, trades read complexity.

2. **Compaction and forks:** If parent context compacts messages, what happens to forks referencing those versions?
   - Recommendation: Forks preserve access to soft-deleted messages in parent. Add `includeDeletedFromParent` flag to fork queries.

3. **Token counting model:** gpt-tokenizer defaults to o200k_base (GPT-4o). Should callers specify encoding?
   - Recommendation: Default to o200k_base. Allow override via `policyConfig.tokenEncoding`.

---

## Sources

### HIGH Confidence (Official/Verified)

- [gpt-tokenizer GitHub](https://github.com/niieani/gpt-tokenizer) - Features, API, performance claims
- [npm registry](https://www.npmjs.com/) - Version verification (gpt-tokenizer@3.4.0)
- [Token Counting Guide 2025](https://www.propelcode.ai/blog/token-counting-tiktoken-anthropic-gemini-guide-2025) - Library comparison

### MEDIUM Confidence (Community Patterns)

- [LibreChat Forking](https://www.librechat.ai/docs/features/fork) - Fork implementation patterns
- [Event Sourcing Time Travel](https://medium.com/@sudipto76/time-travel-using-event-sourcing-pattern-603a0551d2ff) - Version reconstruction patterns
- [Context Window Management](https://blog.jetbrains.com/research/2025/12/efficient-context-management/) - Compaction strategies

### Existing Codebase (Verified)

- `/Users/gannonhall/dev/kata/kata-context/src/db/schema/contexts.ts` - parentId, forkVersion columns
- `/Users/gannonhall/dev/kata/kata-context/src/db/schema/messages.ts` - version column, soft delete
- `/Users/gannonhall/dev/kata/kata-context/src/repositories/message.repository.ts` - getByTokenBudget pattern

---

*Last updated: 2026-02-05*
