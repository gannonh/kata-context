# Feature Landscape: Context Storage Layer

**Domain:** AI Agent Context Storage and Management
**Researched:** 2026-01-29
**Focus:** v0.2.0 Database + Storage Layer milestone
**Overall Confidence:** HIGH

## Executive Summary

A context storage layer for AI agents must solve the fundamental problem: given potentially unlimited conversation history, efficiently store, version, and retrieve the optimal subset for each model call. This is not a generic database problem - it requires purpose-built abstractions for versioned message storage, efficient windowing, and preparation for semantic retrieval.

Based on research into LangGraph memory patterns, event sourcing for conversation history, and pgvector best practices, I recommend a **tiered storage model** with **event-sourced conversation logs**, **snapshot-based retrieval optimization**, and **cursor-based pagination** for windowing operations.

---

## Table Stakes

Features users expect. Missing = storage layer feels incomplete or unusable for AI agent applications.

| Feature | Why Expected | Complexity | v0.2.0 Scope | Notes |
|---------|-------------|------------|--------------|-------|
| **Message persistence** | Core requirement - agents need conversation history | Low | **Yes** | Store user messages, assistant responses, tool calls, tool results |
| **Session/conversation isolation** | Multiple conversations must not leak into each other | Low | **Yes** | Session-scoped storage with unique identifiers |
| **Message ordering** | Conversation flow requires strict ordering | Low | **Yes** | Timestamp + sequence number for consistent ordering |
| **Metadata storage** | Token counts, model info, timestamps essential for windowing | Low | **Yes** | Structured metadata alongside message content |
| **Basic CRUD operations** | Create, read, update, delete contexts and messages | Low | **Yes** | REST API for context management |
| **Serverless-optimized connections** | Vercel functions require connection pooling | Medium | **Yes** | Neon serverless driver handles this automatically |
| **Database migrations** | Schema evolution is inevitable | Medium | **Yes** | Drizzle ORM migrations or similar |
| **Soft delete** | Audit requirements, recovery from mistakes | Low | **Yes** | `deleted_at` timestamp rather than hard delete |

**Confidence:** HIGH - Based on [LangGraph memory documentation](https://docs.langchain.com/oss/python/langgraph/memory), [AWS DynamoDB chatbot patterns](https://aws.amazon.com/blogs/database/amazon-dynamodb-data-models-for-generative-ai-chatbots/), and [Google ADK context architecture](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/).

---

## Differentiators

Features that set Kata Context apart from generic storage. These enable the policy engine (v0.3.0+) to function effectively.

| Feature | Value Proposition | Complexity | v0.2.0 Scope | Notes |
|---------|------------------|------------|--------------|-------|
| **Full version history** | Every message append creates a new version - enables time-travel | Medium | **Yes** | Event sourcing pattern; immutable message log |
| **Point-in-time retrieval** | Retrieve context state at any version | Medium | **Yes** | Reconstruct state from event log |
| **Cursor-based windowing** | Efficient retrieval for token-budget-constrained windows | Medium | **Yes** | Better than offset pagination for large conversations |
| **Token count pre-computation** | Store token counts with messages for O(1) budget checking | Low | **Yes** | Avoid re-tokenizing on every retrieval |
| **Role-based message types** | Distinguish user/assistant/system/tool messages | Low | **Yes** | Schema design, not just string field |
| **pgvector column** | Prepared for semantic retrieval (embeddings) | Low | **Yes, schema only** | Add column, don't populate yet |
| **Context forking** | Branch a conversation for exploration | Medium | **Partial** | Design for it, implement basic version |
| **Batch operations** | Efficient bulk inserts for conversation imports | Medium | **Defer** | Not critical for v0.2.0 |
| **Snapshot optimization** | Periodic state snapshots for faster reconstruction | Medium | **Defer** | Optimization for large conversations |

**Confidence:** HIGH - Based on [event sourcing patterns](https://martinfowler.com/eaaDev/EventSourcing.html), [LangGraph persistence](https://www.mongodb.com/company/blog/product-release-announcements/powering-long-term-memory-for-agents-langgraph), and [Letta memory blocks](https://www.letta.com/blog/memory-blocks).

---

## Anti-Features

Features to explicitly NOT build in v0.2.0. Common mistakes in AI agent storage systems.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|----------|-------------------|
| **Embedding computation** | Adds complexity, requires model calls, separate concern | Add pgvector column in schema, populate in v0.3.0+ |
| **Semantic search** | Requires embeddings; premature without policy engine | Store vectors when available, search in future milestone |
| **Automatic summarization** | LLM calls in storage layer conflate concerns | Storage stores; policy engine (v0.3.0) decides when to summarize |
| **Full chat history in every response** | Token bloat, cost explosion | Cursor-based retrieval, let policy engine decide window |
| **Real-time sync/streaming** | Websockets add complexity, not needed for MVP | REST API sufficient; add streaming when there's demand |
| **Multi-tenant isolation** | Authentication/authorization is separate concern | Single-tenant for v0.2.0; add multi-tenancy in commercial milestone |
| **Caching layer** | Premature optimization | PostgreSQL is fast enough for MVP; add Redis when needed |
| **Knowledge graph storage** | Different concern than conversation context | Focus on message sequences; knowledge graphs are future scope |
| **Cross-session memory** | Requires memory consolidation logic (complex) | Session-scoped only for v0.2.0; long-term memory in future |
| **Message editing/mutation** | Violates immutability principle, complicates versioning | Append-only with soft delete; "edits" create new versions |
| **Complex query DSL** | Overengineering; REST with filters is sufficient | Simple query parameters for filtering |
| **Automatic cleanup/retention** | Policy decision, not storage decision | Manual delete; add retention policies later |

**Confidence:** HIGH - Based on [AI agent memory anti-patterns](https://www.ais.com/practical-memory-patterns-for-reliable-longer-horizon-agent-workflows/), [common mistakes in agent memory](https://medium.com/@DanGiannone/the-problem-with-ai-agent-memory-9d47924e7975), and [InfoWorld analysis](https://www.infoworld.com/article/4101981/ai-memory-is-just-another-database-problem.html).

---

## Feature Dependencies

```
PostgreSQL Schema
    |
    +-- Message table (core entity)
    |       |
    |       +-- Context/Session table (groups messages)
    |       |
    |       +-- Version tracking (implicit via immutable appends)
    |
    +-- pgvector extension (enabled but unused in v0.2.0)
            |
            +-- Embedding column (nullable, for v0.3.0+)

Connection Handling
    |
    +-- Neon serverless driver (@neondatabase/serverless)
    |       |
    |       +-- Automatic connection pooling
    |
    +-- Drizzle ORM
            |
            +-- Type-safe queries
            |
            +-- Migration management

API Operations
    |
    +-- Context CRUD
    |       |
    |       +-- Create context (returns context_id)
    |       |
    |       +-- Get context (with pagination)
    |       |
    |       +-- Delete context (soft delete)
    |
    +-- Message Operations
            |
            +-- Append message (immutable)
            |
            +-- Get messages (cursor-based)
            |
            +-- Get at version (point-in-time)
```

---

## Core Schema Design

### Messages Table (Event Log)

The heart of the storage layer. Each row is an immutable event.

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_id UUID NOT NULL REFERENCES contexts(id),

    -- Ordering
    version BIGINT NOT NULL,           -- Auto-incrementing per context
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Content
    role TEXT NOT NULL,                -- 'user' | 'assistant' | 'system' | 'tool'
    content TEXT NOT NULL,

    -- Tool-specific (nullable)
    tool_call_id TEXT,
    tool_name TEXT,

    -- Metadata (denormalized for query efficiency)
    token_count INTEGER,               -- Pre-computed for windowing
    model TEXT,                        -- Model that generated (for assistant)

    -- Soft delete
    deleted_at TIMESTAMPTZ,

    -- Future: embeddings
    embedding VECTOR(1536),            -- Nullable, for v0.3.0+

    -- Constraints
    UNIQUE(context_id, version)
);

CREATE INDEX idx_messages_context_version ON messages(context_id, version);
CREATE INDEX idx_messages_context_created ON messages(context_id, created_at);
```

### Contexts Table (Session Container)

Groups messages into logical conversations.

```sql
CREATE TABLE contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Metadata
    name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Denormalized for efficiency
    message_count INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    latest_version BIGINT NOT NULL DEFAULT 0,

    -- Forking support
    parent_id UUID REFERENCES contexts(id),
    fork_version BIGINT,               -- Version forked from

    -- Soft delete
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_contexts_parent ON contexts(parent_id) WHERE parent_id IS NOT NULL;
```

**Why this design:**
- **Immutable messages:** Append-only enables versioning without complexity
- **Pre-computed token_count:** O(1) budget checking instead of O(n) tokenization
- **Denormalized counters:** Avoid COUNT(*) queries on large tables
- **Version as BIGINT:** Supports billions of messages per context
- **Cursor-based retrieval:** Use `(context_id, version)` for efficient pagination

**Confidence:** HIGH - Based on [pgvector schema patterns](https://supabase.com/docs/guides/database/extensions/pgvector), [event sourcing best practices](https://microservices.io/patterns/data/event-sourcing.html), and [DynamoDB chatbot models](https://aws.amazon.com/blogs/database/amazon-dynamodb-data-models-for-generative-ai-chatbots/).

---

## Retrieval Patterns

### Pattern 1: Latest N Messages (Most Common)

```sql
-- Get last 50 messages, newest first
SELECT * FROM messages
WHERE context_id = $1 AND deleted_at IS NULL
ORDER BY version DESC
LIMIT 50;
```

### Pattern 2: Token-Budgeted Window

```sql
-- Get messages fitting within token budget, newest first
WITH cumulative AS (
    SELECT *,
           SUM(token_count) OVER (ORDER BY version DESC) AS running_total
    FROM messages
    WHERE context_id = $1 AND deleted_at IS NULL
)
SELECT * FROM cumulative
WHERE running_total <= $2  -- token budget
ORDER BY version ASC;      -- return in chronological order
```

### Pattern 3: Point-in-Time Retrieval

```sql
-- Get context state at specific version
SELECT * FROM messages
WHERE context_id = $1
  AND version <= $2        -- version to retrieve
  AND deleted_at IS NULL
ORDER BY version ASC;
```

### Pattern 4: Cursor-Based Pagination

```sql
-- Get next page after cursor (version)
SELECT * FROM messages
WHERE context_id = $1
  AND version > $2         -- cursor (last seen version)
  AND deleted_at IS NULL
ORDER BY version ASC
LIMIT 100;
```

**Why cursor-based over offset:**
- O(1) performance regardless of offset depth
- Stable during concurrent writes
- Natural fit for versioned data
- [Better pagination performance](https://betterprogramming.pub/why-token-based-pagination-performs-better-than-offset-based-465e1139bb33)

---

## API Surface for v0.2.0

### Context Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/contexts` | Create new context |
| GET | `/api/v1/contexts/:id` | Get context metadata |
| GET | `/api/v1/contexts/:id/messages` | Get messages (paginated) |
| DELETE | `/api/v1/contexts/:id` | Soft delete context |

### Message Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/contexts/:id/messages` | Append message |
| GET | `/api/v1/contexts/:id/messages?version=N` | Get at version |
| GET | `/api/v1/contexts/:id/messages?cursor=X&limit=Y` | Cursor pagination |
| GET | `/api/v1/contexts/:id/messages?token_budget=N` | Token-budgeted window |

### Response Shapes

```typescript
interface Context {
  id: string;
  name: string | null;
  messageCount: number;
  totalTokens: number;
  latestVersion: number;
  parentId: string | null;
  forkVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  contextId: string;
  version: number;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId: string | null;
  toolName: string | null;
  tokenCount: number | null;
  model: string | null;
  createdAt: string;
}

interface PaginatedMessages {
  messages: Message[];
  cursor: number | null;  // Next version to fetch, null if no more
  hasMore: boolean;
}
```

---

## MVP Recommendation

### Must Include (Ship-blocking for v0.2.0)

1. **PostgreSQL schema** with messages and contexts tables
2. **pgvector extension enabled** (column added, not populated)
3. **Drizzle ORM setup** with type-safe queries
4. **Connection pooling** via Neon serverless driver
5. **Database migrations** that can evolve schema
6. **Basic CRUD endpoints** for contexts and messages
7. **Cursor-based pagination** for message retrieval
8. **Token-budgeted retrieval** endpoint
9. **Version tracking** for point-in-time retrieval
10. **Soft delete** for contexts and messages

### Nice to Have (If Time Allows)

1. **Context forking** (basic implementation)
2. **Batch message append** endpoint
3. **Context metadata** (name, description)

### Defer to Later Milestones

| Feature | Target Milestone | Reason |
|---------|------------------|--------|
| Embedding computation | v0.3.0 | Requires model integration |
| Semantic search | v0.3.0+ | Depends on embeddings |
| Summarization | v0.3.0 | Policy engine concern |
| Multi-tenancy | Commercial MVP | Requires auth system |
| Caching layer | Performance milestone | Premature optimization |
| Retention policies | Operations milestone | Policy decision |
| Cross-session memory | Advanced features | Complex consolidation logic |

---

## Complexity Assessment

| Feature | Complexity | Effort (days) | Risk |
|---------|------------|---------------|------|
| Schema design | Low | 0.5 | Low |
| Drizzle ORM setup | Low | 0.5 | Low |
| Neon connection | Low | 0.25 | Low - well documented |
| Migrations | Low | 0.25 | Low |
| Context CRUD | Low | 0.5 | Low |
| Message append | Low | 0.25 | Low |
| Cursor pagination | Medium | 0.5 | Low |
| Token-budgeted retrieval | Medium | 0.5 | Medium - SQL complexity |
| Point-in-time retrieval | Medium | 0.5 | Low |
| Soft delete | Low | 0.25 | Low |
| **Total** | | **~4 days** | |

---

## Sources

### HIGH Confidence (Official/Verified)

- [LangGraph Memory Overview](https://docs.langchain.com/oss/python/langgraph/memory) - Memory patterns for AI agents
- [Supabase pgvector Documentation](https://supabase.com/docs/guides/database/extensions/pgvector) - Vector storage patterns
- [Event Sourcing - Martin Fowler](https://martinfowler.com/eaaDev/EventSourcing.html) - Event sourcing fundamentals
- [AWS DynamoDB Chatbot Data Models](https://aws.amazon.com/blogs/database/amazon-dynamodb-data-models-for-generative-ai-chatbots/) - Conversation storage patterns

### MEDIUM Confidence (Multiple Sources Agree)

- [Memory for AI Agents - The New Stack](https://thenewstack.io/memory-for-ai-agents-a-new-paradigm-of-context-engineering/) - Context engineering paradigm
- [Google ADK Context Architecture](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/) - Tiered storage patterns
- [Cursor-Based Pagination Performance](https://betterprogramming.pub/why-token-based-pagination-performs-better-than-offset-based-465e1139bb33) - Why cursors outperform offsets
- [LLM Context Management Guide](https://eval.16x.engineer/blog/llm-context-management-guide) - Context window best practices

### LOW Confidence (Single Source - Verify Before Implementing)

- Specific token count storage strategies may vary by embedding model
- pgvector index tuning (HNSW vs IVFFlat) requires benchmarking with real data
- Optimal snapshot frequency for large conversations needs empirical testing
