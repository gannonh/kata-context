# Architecture: Policy Engine Integration

**Project:** Kata Context - Policy Engine (compaction, forking, time-travel)
**Domain:** Context policy engine integration with existing storage layer
**Researched:** 2026-02-05
**Confidence:** HIGH (based on existing codebase analysis + verified external patterns)

## Executive Summary

The existing kata-context architecture provides a solid foundation for policy engine integration. The schema already includes `parentId` and `forkVersion` columns on the contexts table, and the versioned message model supports time-travel semantics. The policy engine should be implemented as a new service layer sitting between the HTTP layer and repositories, with dedicated repositories for policy-specific operations.

**Key findings:**
- Schema already supports forking (`parentId`, `forkVersion` columns exist but unused)
- Versioned messages enable time-travel without schema changes
- Soft-delete pattern supports compaction marking
- Token-budgeted windowing provides foundation for policy-aware retrieval

**Integration strategy:**
- Add service layer for policy orchestration
- Extend existing repositories with policy-specific methods
- New HTTP endpoints follow established patterns

---

## Existing Architecture Analysis

### Current Layer Structure

```
HTTP Layer (api/v1/contexts/)
    │
    ▼
Repository Layer (src/repositories/)
    │  - ContextRepository: create, findById, softDelete, exists
    │  - MessageRepository: append, findByContext, getByTokenBudget, findByVersion
    │
    ▼
Database Layer (src/db/)
    │  - Drizzle ORM with PostgreSQL
    │  - Schema: contexts, messages tables
    │
    ▼
Neon PostgreSQL
```

### Schema Observations

**contexts table:**
- `parentId` and `forkVersion` columns exist but are unused
- `parentId` has `onDelete: set null` semantics (child contexts survive parent deletion)
- `latestVersion` tracks the highest message version
- `totalTokens` tracks cumulative token count (useful for compaction triggers)

**messages table:**
- `version` provides sequential ordering per context
- `deletedAt` supports soft-delete (useful for compaction marking)
- `embedding` column (pgvector) enables semantic operations
- Unique constraint on `(contextId, version)` ensures ordering integrity

### Integration Points Identified

| Component | Policy Engine Touch Points |
|-----------|---------------------------|
| `contexts.parentId` | Fork parent reference (exists, unused) |
| `contexts.forkVersion` | Fork point version marker (exists, unused) |
| `contexts.totalTokens` | Compaction threshold trigger |
| `contexts.latestVersion` | Time-travel cursor |
| `messages.version` | Time-travel reconstruction point |
| `messages.deletedAt` | Compaction soft-delete for removed messages |
| `MessageRepository.getByTokenBudget()` | Foundation for window policy |

---

## Recommended Architecture

### New Component Structure

```
HTTP Layer (api/v1/contexts/)
    │
    ├──────────────────────────────────────┐
    ▼                                      ▼
Policy Service (NEW)               Repository Layer
    │  - CompactionService                 │
    │  - ForkService                       │
    │  - TimeTravel utilities              │
    │                                      │
    └──────────▶ Policy Repository (NEW) ◀─┘
                    │  - CompactionRepository
                    │  - ForkRepository
                    │
                    ▼
            Database Layer (existing)
```

### Component Responsibilities

**Policy Service Layer** (new: `src/services/`)

| Service | Responsibility |
|---------|---------------|
| `CompactionService` | Orchestrates compaction: trigger detection, summary generation, message marking |
| `ForkService` | Creates forked contexts with proper parent linkage |
| `TimeTravelService` | Reconstructs context state at arbitrary versions |

**Policy Repository Layer** (extend: `src/repositories/`)

| Repository | Responsibility |
|------------|---------------|
| `CompactionRepository` | Bulk message operations, summary storage, compaction history |
| `ForkRepository` | Context cloning, message duplication |

### Directory Structure After Integration

```
src/
├── db/                             # Existing
│   ├── client.ts
│   ├── schema/
│   │   ├── contexts.ts
│   │   └── messages.ts
│   └── migrations/
│
├── repositories/                   # Extended
│   ├── index.ts
│   ├── context.repository.ts       # Existing
│   ├── message.repository.ts       # Extended with time-travel params
│   ├── compaction.repository.ts    # NEW
│   ├── fork.repository.ts          # NEW
│   ├── types.ts                    # Extended
│   └── helpers.ts
│
├── services/                       # NEW
│   ├── index.ts
│   ├── compaction.service.ts
│   ├── fork.service.ts
│   └── time-travel.service.ts
│
└── api/                            # Extended
    ├── index.ts
    └── validation/
        └── schemas.ts              # Extended with fork/compact schemas

api/
└── v1/
    └── contexts/
        └── [id]/
            ├── fork.ts             # NEW: POST /contexts/:id/fork
            ├── compact.ts          # NEW: POST /contexts/:id/compact
            └── window.ts           # Extended with atVersion param
```

---

## Data Flow Diagrams

### Compaction Flow

```
1. Client calls POST /contexts/:id/compact
   OR CompactionService detects totalTokens > threshold

2. CompactionService.compact(contextId, options):
   a. MessageRepository.getByTokenBudget() → messages to preserve
   b. Generate summary of messages outside preservation window
   c. CompactionRepository.markCompacted(contextId, upToVersion)
      - Soft-deletes old messages
      - Inserts summary as system message
   d. ContextRepository update totalTokens

3. Response: compaction metadata (preserved count, summary version)
```

### Forking Flow

```
1. Client calls POST /contexts/:id/fork?atVersion=N

2. ForkService.fork(contextId, atVersion):
   a. ContextRepository.create() with parentId, forkVersion
   b. MessageRepository.findByContext() → messages up to atVersion
   c. ForkRepository.duplicateMessages(newContextId, messages)
      - Bulk insert with new contextId, reset versions
   d. Update context counters

3. Response: new context with fork lineage
```

### Time Travel Flow

```
1. Client calls GET /contexts/:id/window?atVersion=N&budget=X

2. TimeTravelService.getWindowAtVersion(contextId, version, budget):
   a. MessageRepository.findByContext({ maxVersion: N })
   b. Apply token budget to filtered messages
   c. Return messages as if context ended at version N

3. Response: windowed messages at historical point
```

---

## Schema Modifications

### Option A: Minimal (Recommended for Phase 1)

No schema changes. Use existing columns:
- `parentId` / `forkVersion` for fork tracking
- `deletedAt` on messages for compaction marking
- Add new message with `role: system` for compaction summaries

**Tradeoff:** Compaction summaries mixed with regular messages. Query complexity increases.

### Option B: Dedicated Compaction Table (Phase 2)

```typescript
// New table: compaction_events
export const compactionEvents = pgTable("compaction_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  contextId: uuid("context_id").notNull().references(() => contexts.id),
  compactedAt: timestamp("compacted_at").notNull().defaultNow(),
  fromVersion: bigint("from_version", { mode: "number" }).notNull(),
  toVersion: bigint("to_version", { mode: "number" }).notNull(),
  summary: text("summary").notNull(),
  summaryTokenCount: integer("summary_token_count"),
  preservedMessageCount: integer("preserved_message_count"),
  removedMessageCount: integer("removed_message_count"),
});
```

**Tradeoff:** Cleaner separation, easier auditing. Additional table complexity.

### Option C: Message Metadata Column (Alternative)

```typescript
// Add to messages table
metadata: jsonb("metadata").$type<{
  compactionSource?: { fromVersion: number; toVersion: number };
  isCompactionSummary?: boolean;
}>()
```

**Tradeoff:** Flexible, queryable. JSONB performance considerations for high-volume queries.

**Recommendation:** Start with Option A, migrate to Option B if compaction auditing becomes important.

---

## Patterns to Follow

### Pattern 1: Service Layer Orchestration

Services coordinate multiple repository calls within transactions. Repositories remain focused on single-table operations.

```typescript
// Good: Service orchestrates
class CompactionService {
  constructor(
    private contextRepo: ContextRepository,
    private messageRepo: MessageRepository,
    private compactionRepo: CompactionRepository,
    private db: Database,
  ) {}

  async compact(contextId: string, options: CompactionOptions) {
    return this.db.transaction(async (tx) => {
      // Multiple repo operations in single transaction
      const context = await this.contextRepo.findById(contextId);
      const messages = await this.messageRepo.getByTokenBudget(contextId, options);
      // ... orchestration logic
    });
  }
}

// Avoid: Repository calling other repositories
class MessageRepository {
  async appendAndUpdateContext() { /* cross-concern violation */ }
}
```

### Pattern 2: Immutable Message History

Messages should never be updated after creation. Compaction marks messages as deleted rather than removing them. This preserves audit trail and enables time-travel.

```typescript
// Good: Soft-delete for compaction
await compactionRepo.markCompacted(contextId, upToVersion);
// Sets deletedAt on affected messages

// Avoid: Hard delete
await messageRepo.deleteOlderThan(version);
```

### Pattern 3: Version-Based Time Travel

Use message versions as the canonical time coordinate, not timestamps. Versions are sequential and gap-free; timestamps can have precision issues.

```typescript
// Good: Version-based queries
const messages = await messageRepo.findByContext(contextId, {
  maxVersion: targetVersion,
});

// Avoid: Timestamp-based queries
const messages = await messageRepo.findByContext(contextId, {
  before: targetTimestamp, // millisecond precision issues
});
```

### Pattern 4: Fork as Copy-on-Write

When forking, duplicate message rows rather than using references. This keeps the query model simple and avoids join complexity.

```typescript
// Recommended: Copy messages to new context
async fork(sourceContextId: string, atVersion: number) {
  const newContext = await contextRepo.create({
    parentId: sourceContextId,
    forkVersion: atVersion,
  });

  const messages = await messageRepo.findByContext(sourceContextId, {
    maxVersion: atVersion,
  });

  // Bulk insert copies with new contextId
  await forkRepo.duplicateMessages(newContext.id, messages);

  return newContext;
}
```

**Alternative (not recommended):** Reference-based forking where forked context shares message rows with parent. Complicates queries and breaks soft-delete isolation.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Eager Compaction

**What:** Compacting automatically on every message append when threshold exceeded.
**Why bad:** Compaction is expensive (LLM call for summary). Creates latency spikes on normal operations.
**Instead:** Trigger compaction asynchronously via background job or explicit API call.

### Anti-Pattern 2: Stateful Compaction Thresholds

**What:** Storing compaction threshold in context row, checking on every read.
**Why bad:** Couples read path to policy logic. Policy changes require data migration.
**Instead:** Policy thresholds live in service configuration. Check only on explicit policy operations.

### Anti-Pattern 3: Destructive Time Travel

**What:** Truncating message history to implement "revert to version N."
**Why bad:** Loses audit trail. Makes debugging impossible.
**Instead:** Fork at version N for new execution path; original context unchanged.

### Anti-Pattern 4: Inline Summary Generation

**What:** Generating compaction summaries synchronously in the request path.
**Why bad:** LLM calls take seconds. Request timeouts. Poor UX.
**Instead:** Queue compaction job, return immediately with job ID. Poll for completion or use webhooks.

---

## Build Order (Suggested Phase Structure)

Based on dependency analysis and existing schema:

### Phase 1: Foundation (Low Risk)

1. **ForkRepository + ForkService**
   - Uses existing `parentId` / `forkVersion` columns
   - No schema changes required
   - Enables branching exploration

2. **Time-travel query extensions**
   - Add `maxVersion` parameter to `MessageRepository.findByContext()`
   - Add `maxVersion` parameter to `getByTokenBudget()`
   - Pure additive changes

### Phase 2: Compaction Core (Medium Risk)

3. **CompactionRepository**
   - Bulk soft-delete operations
   - Summary message insertion
   - Uses existing `deletedAt` semantics

4. **CompactionService** (sync version)
   - Threshold detection
   - Summary generation interface (stubbed)
   - Orchestrates repository calls

### Phase 3: Async Compaction (Higher Complexity)

5. **Background job infrastructure**
   - Job queue (pg-boss, BullMQ, or custom with Postgres)
   - Compaction worker
   - Status polling endpoint

6. **Summary generation integration**
   - LLM provider abstraction
   - Prompt engineering for context preservation
   - Token counting for summaries

### Phase 4: Advanced Features

7. **Compaction policies**
   - Configurable thresholds per context
   - Auto-compaction triggers
   - Compaction history/audit

8. **Fork tree navigation**
   - List forks of a context
   - Fork ancestry traversal
   - Merge considerations (if needed)

---

## API Endpoint Design

New endpoints follow existing patterns in the codebase.

### Fork Endpoint

```typescript
// POST /api/v1/contexts/:id/fork
// api/v1/contexts/[id]/fork.ts

import { forkSchema, errorResponse, requireContextId, successResponse } from "../../../../src/api/index.js";
import { db } from "../../../../src/db/client.js";
import { ForkService } from "../../../../src/services/index.js";

const service = new ForkService(db);

export async function POST(request: Request): Promise<Response> {
  try {
    const contextId = requireContextId(request);
    if (contextId instanceof Response) return contextId;

    const body = await parseJsonBody(request);
    const result = forkSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(400, "Validation failed", undefined, result.error.flatten());
    }

    const forkedContext = await service.fork(contextId, result.data.atVersion);
    return successResponse(201, { data: forkedContext });
  } catch (error) {
    if (error instanceof RepositoryError) {
      if (error.code === "NOT_FOUND") {
        return errorResponse(404, "Context not found");
      }
      return errorResponse(500, "Database error", error.message);
    }
    console.error("[POST /api/v1/contexts/:id/fork] Unexpected error:", error);
    return errorResponse(500, "Internal server error");
  }
}
```

### Compact Endpoint

```typescript
// POST /api/v1/contexts/:id/compact
// api/v1/contexts/[id]/compact.ts

export async function POST(request: Request): Promise<Response> {
  // Similar pattern to fork
  // Returns compaction metadata (preserved count, summary version)
}
```

### Extended Window Endpoint

```typescript
// GET /api/v1/contexts/:id/window?budget=X&atVersion=N
// Extend existing window.ts with atVersion parameter

const atVersion = url.searchParams.get("atVersion") ?? undefined;

const result = extendedTokenBudgetSchema.safeParse({ budget, atVersion });
// ...

const messages = await service.getWindowAtVersion(contextId, {
  budget: result.data.budget,
  atVersion: result.data.atVersion,
});
```

---

## Scalability Considerations

| Concern | At 100 contexts | At 10K contexts | At 1M contexts |
|---------|-----------------|-----------------|----------------|
| Fork duplication | Copy all messages | Copy all messages | Consider lazy loading / reference model |
| Compaction jobs | Inline possible | Background queue | Distributed workers |
| Time-travel queries | Full scan OK | Index on (contextId, version) sufficient | Partition by contextId |
| Summary storage | In messages table | In messages table | Dedicated compaction_events table |

### Index Recommendations

The existing index `messages_context_version_idx` on `(contextId, version)` supports all proposed query patterns efficiently:
- Fork queries: `WHERE contextId = ? AND version <= ?`
- Time-travel: `WHERE contextId = ? AND version <= ?`
- Compaction marking: `UPDATE WHERE contextId = ? AND version <= ?`

No additional indexes required for Phase 1-2.

---

## Sources

### HIGH Confidence (Official Documentation / Verified)

- [Anthropic: Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) - Compaction strategies, sub-agent patterns, tool result clearing
- [LangChain: LangGraph Checkpointing Reference](https://reference.langchain.com/python/langgraph/checkpoints/) - Checkpoint data model, fork metadata structure, parent-child relationships
- [Microservices.io: Event Sourcing Pattern](https://microservices.io/patterns/data/event-sourcing.html) - Snapshot optimization, state reconstruction patterns

### MEDIUM Confidence (Verified Implementation Examples)

- [LangGraph Postgres Checkpointer Internals](https://blog.lordpatil.com/posts/langgraph-postgres-checkpointer/) - PostgreSQL checkpoint schema, JSONB storage patterns
- [Context Compaction Research (GitHub Gist)](https://gist.github.com/badlogic/cd2ef65b0697c4dbe2d13fbecb0a0a5f) - Implementation comparison: Claude Code, Codex CLI, OpenCode, Amp

### LOW Confidence (Community Patterns)

- [LibreChat: Forking Messages](https://www.librechat.ai/docs/features/fork) - User-facing fork semantics (implementation details not documented)

---

*Last updated: 2026-02-05*
