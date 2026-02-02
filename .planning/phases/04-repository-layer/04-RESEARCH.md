# Phase 4: Repository Layer - Research

**Researched:** 2026-02-01
**Domain:** Data access abstraction with Drizzle ORM + PostgreSQL
**Confidence:** HIGH

## Summary

This research covers implementing a type-safe repository layer using Drizzle ORM for the kata-context project. The repository pattern abstracts data access from business logic, providing a clean interface for CRUD operations on contexts and messages.

Key findings:
- Drizzle ORM provides excellent TypeScript type inference via `$inferSelect` and `$inferInsert` - no code generation needed
- Cursor-based pagination using the `version` column is ideal for message retrieval (unique, sequential, indexed)
- Soft delete requires manual implementation (no built-in support) - filter with `isNull(deletedAt)`
- PGlite provides in-memory PostgreSQL for fast unit testing without Docker
- Atomic counter updates use `sql\`${column} + value\`` pattern for thread-safe operations

**Primary recommendation:** Implement thin repository classes that wrap Drizzle queries, using the existing schema types and returning domain-appropriate result types. Use PGlite for testing.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | Type-safe ORM | Already installed, zero codegen, excellent TS inference |
| pg | 8.14.1 | PostgreSQL driver | Already installed, production-ready |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @electric-sql/pglite | latest | In-memory Postgres | Unit testing without Docker |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PGlite | Testcontainers | Testcontainers more realistic but slower, requires Docker |
| Manual repository | drizzle-typebox | Validation layer adds complexity, not needed for internal API |

**Installation:**
```bash
pnpm add -D @electric-sql/pglite
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── db/
│   ├── client.ts           # Database client (exists)
│   └── schema/
│       ├── contexts.ts     # Context table (exists)
│       ├── messages.ts     # Message table (exists)
│       └── index.ts        # Schema exports (exists)
├── repositories/
│   ├── context.repository.ts    # Context CRUD operations
│   ├── message.repository.ts    # Message CRUD operations
│   ├── types.ts                 # Repository result types
│   └── index.ts                 # Repository exports
└── index.ts                # Main exports
```

### Pattern 1: Thin Repository with Type Inference

**What:** Repository classes that wrap Drizzle queries with domain-specific method names and return types.

**When to use:** When you want to abstract database implementation while maintaining full type safety.

**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/goodies
import { eq, isNull, and, gt, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { contexts, type Context, type NewContext } from '../db/schema/index.js';

export type CreateContextInput = Omit<NewContext, 'id' | 'createdAt' | 'updatedAt' | 'messageCount' | 'totalTokens' | 'latestVersion'>;
export type ContextWithMessageCount = Context;

export class ContextRepository {
  // DATA-01: Create new context with optional metadata
  async create(input: CreateContextInput): Promise<Context> {
    const [context] = await db
      .insert(contexts)
      .values(input)
      .returning();
    return context;
  }

  // DATA-02: Retrieve context by ID with message count
  async findById(id: string): Promise<Context | null> {
    const [context] = await db
      .select()
      .from(contexts)
      .where(and(
        eq(contexts.id, id),
        isNull(contexts.deletedAt)  // Exclude soft-deleted
      ));
    return context ?? null;
  }

  // DATA-05: Soft delete context
  async softDelete(id: string): Promise<Context | null> {
    const [context] = await db
      .update(contexts)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(contexts.id, id),
        isNull(contexts.deletedAt)
      ))
      .returning();
    return context ?? null;
  }
}
```

### Pattern 2: Cursor-Based Pagination for Messages

**What:** Use the `version` column as cursor for efficient, consistent pagination.

**When to use:** When retrieving messages in order, especially with real-time inserts.

**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/guides/cursor-based-pagination
import { eq, isNull, and, gt, asc, desc } from 'drizzle-orm';

export interface PaginatedMessages {
  messages: Message[];
  nextCursor: number | null;
  hasMore: boolean;
}

export class MessageRepository {
  // DATA-04: Retrieve messages with cursor-based pagination
  async findByContext(
    contextId: string,
    options: { cursor?: number; limit?: number; order?: 'asc' | 'desc' } = {}
  ): Promise<PaginatedMessages> {
    const { cursor, limit = 50, order = 'asc' } = options;

    // Fetch one extra to determine if there are more
    const fetchLimit = limit + 1;

    const results = await db
      .select()
      .from(messages)
      .where(and(
        eq(messages.contextId, contextId),
        isNull(messages.deletedAt),
        cursor
          ? (order === 'asc' ? gt(messages.version, cursor) : lt(messages.version, cursor))
          : undefined
      ))
      .orderBy(order === 'asc' ? asc(messages.version) : desc(messages.version))
      .limit(fetchLimit);

    const hasMore = results.length > limit;
    const messageResults = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore
      ? messageResults[messageResults.length - 1].version
      : null;

    return { messages: messageResults, nextCursor, hasMore };
  }
}
```

### Pattern 3: Atomic Counter Updates

**What:** Use SQL expressions for thread-safe counter increments.

**When to use:** When updating `messageCount`, `totalTokens`, or `latestVersion` on contexts.

**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/guides/incrementing-a-value
import { sql, type AnyColumn } from 'drizzle-orm';

const increment = (column: AnyColumn, value = 1) => sql`${column} + ${value}`;

// In transaction after batch insert
await tx
  .update(contexts)
  .set({
    messageCount: increment(contexts.messageCount, newMessages.length),
    totalTokens: increment(contexts.totalTokens, totalNewTokens),
    latestVersion: newLatestVersion,
    updatedAt: new Date(),
  })
  .where(eq(contexts.id, contextId));
```

### Pattern 4: Transaction with Batch Insert

**What:** Use transactions for multi-step operations that must succeed or fail together.

**When to use:** When appending messages (need to insert messages AND update context counters atomically).

**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/transactions
import { db } from '../db/client.js';

// DATA-03: Append messages to context (batch insert with sequence assignment)
async appendMessages(
  contextId: string,
  newMessages: NewMessageInput[]
): Promise<Message[]> {
  return await db.transaction(async (tx) => {
    // Get current latest version
    const [context] = await tx
      .select({ latestVersion: contexts.latestVersion })
      .from(contexts)
      .where(eq(contexts.id, contextId))
      .for('update');  // Lock row to prevent race conditions

    if (!context) {
      throw new Error(`Context not found: ${contextId}`);
    }

    // Assign sequential versions
    let nextVersion = context.latestVersion;
    const messagesWithVersions = newMessages.map(msg => ({
      ...msg,
      contextId,
      version: ++nextVersion,
    }));

    // Batch insert messages
    const inserted = await tx
      .insert(messages)
      .values(messagesWithVersions)
      .returning();

    // Update context counters atomically
    const totalNewTokens = inserted.reduce((sum, m) => sum + (m.tokenCount ?? 0), 0);
    await tx
      .update(contexts)
      .set({
        messageCount: sql`${contexts.messageCount} + ${inserted.length}`,
        totalTokens: sql`${contexts.totalTokens} + ${totalNewTokens}`,
        latestVersion: nextVersion,
        updatedAt: new Date(),
      })
      .where(eq(contexts.id, contextId));

    return inserted;
  });
}
```

### Pattern 5: Token-Budgeted Windowing

**What:** Retrieve messages from newest to oldest until token budget exhausted.

**When to use:** For DATA-06 requirement - retrieving last N tokens worth of messages.

**Example:**
```typescript
// DATA-06: Token-budgeted windowing
async getRecentByTokenBudget(
  contextId: string,
  tokenBudget: number
): Promise<Message[]> {
  // Fetch messages newest-first
  const allMessages = await db
    .select()
    .from(messages)
    .where(and(
      eq(messages.contextId, contextId),
      isNull(messages.deletedAt)
    ))
    .orderBy(desc(messages.version));

  // Accumulate until budget exceeded
  const result: Message[] = [];
  let tokensUsed = 0;

  for (const msg of allMessages) {
    const msgTokens = msg.tokenCount ?? 0;
    if (tokensUsed + msgTokens > tokenBudget && result.length > 0) {
      break;  // Budget exceeded, stop (but always include at least one)
    }
    result.push(msg);
    tokensUsed += msgTokens;
  }

  // Return in chronological order (oldest first)
  return result.reverse();
}
```

### Anti-Patterns to Avoid

- **Forgetting soft-delete filter:** Every query must include `isNull(table.deletedAt)` unless explicitly querying deleted records
- **Using offset pagination:** Leads to inconsistent results with concurrent inserts; use cursor-based instead
- **Mocking Drizzle ORM:** Drizzle's chained API is hard to mock; use PGlite for real database testing
- **SELECT * without limit:** Always paginate or limit results to prevent memory issues
- **Non-atomic counter updates:** Use `sql\`column + value\`` instead of read-modify-write

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|------------|-------------|-----|
| Cursor encoding/decoding | Custom base64 cursors | Raw version number | Version column is already sequential, no encoding needed |
| Connection pooling | Custom pool logic | pg Pool + @vercel/functions | Already configured in client.ts |
| Type inference | Manual type definitions | `$inferSelect`/`$inferInsert` | Drizzle keeps types in sync automatically |
| In-memory DB for tests | SQLite mock | @electric-sql/pglite | Real Postgres in WASM, same behavior |
| Soft delete filtering | Custom middleware | Helper function with `isNull()` | Drizzle doesn't have middleware; explicit filters are clearer |

**Key insight:** Drizzle's design philosophy is "if you know SQL, you know Drizzle." The repository layer should be thin - just enough abstraction to provide a clean interface, not a heavy framework.

## Common Pitfalls

### Pitfall 1: Missing Soft-Delete Filters

**What goes wrong:** Queries return deleted records, causing data consistency issues.

**Why it happens:** Drizzle has no built-in soft-delete middleware; every query must explicitly filter.

**How to avoid:**
- Create a helper: `const notDeleted = <T extends { deletedAt: unknown }>(table: T) => isNull(table.deletedAt);`
- Use it consistently: `.where(and(...conditions, notDeleted(contexts)))`
- Add integration tests that verify deleted records are excluded

**Warning signs:** Tests pass but production shows "deleted" data appearing in UI.

### Pitfall 2: Race Conditions in Version Assignment

**What goes wrong:** Two concurrent batch inserts get overlapping version numbers, violating unique constraint.

**Why it happens:** Reading `latestVersion`, incrementing in code, then writing creates a race window.

**How to avoid:**
- Use `SELECT ... FOR UPDATE` to lock the context row during transaction
- Alternative: Use PostgreSQL sequences (but adds complexity)

**Warning signs:** Intermittent unique constraint violations under load.

### Pitfall 3: Unbounded Result Sets

**What goes wrong:** Memory exhaustion when context has thousands of messages.

**Why it happens:** Forgetting to paginate when "just getting all messages."

**How to avoid:**
- Always require explicit pagination params or enforce defaults
- Token-budgeted queries naturally limit results
- Use streaming for bulk exports (future consideration)

**Warning signs:** Serverless function timeouts or memory errors on large contexts.

### Pitfall 4: Transaction Isolation Level Issues

**What goes wrong:** Phantom reads or lost updates in concurrent operations.

**Why it happens:** Default isolation (read committed) may not be sufficient for some operations.

**How to avoid:**
- Use `FOR UPDATE` when reading-then-writing in transactions
- Consider `SERIALIZABLE` isolation for critical financial-style operations
- Document expected isolation level in repository methods

**Warning signs:** Data inconsistency that only appears under concurrent load.

### Pitfall 5: Error Code Handling

**What goes wrong:** Unique constraint violations bubble up as generic errors instead of actionable responses.

**Why it happens:** PostgreSQL errors wrapped by Drizzle need unwrapping to access error codes.

**How to avoid:**
- Check `error.cause` for the underlying `DatabaseError` from pg driver
- Map PostgreSQL error codes (23505=unique, 23503=foreign key) to domain errors

**Warning signs:** Generic "database error" messages in logs instead of specific constraint info.

## Code Examples

Verified patterns from official sources:

### Soft Delete Helper
```typescript
// Source: https://wanago.io/2024/07/22/api-nestjs-soft-deletes-drizzle/
import { isNull } from 'drizzle-orm';

export const notDeleted = <T extends { deletedAt: unknown }>(table: T) =>
  isNull(table.deletedAt);

// Usage
await db.select().from(contexts).where(notDeleted(contexts));
```

### Error Handling
```typescript
// Source: https://github.com/drizzle-team/drizzle-orm/discussions/916
import { DatabaseError } from 'pg';

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly constraint?: string
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export function handleDatabaseError(error: unknown): never {
  // Drizzle wraps errors; the original is in `cause`
  const pgError = (error as any)?.cause;

  if (pgError instanceof DatabaseError) {
    switch (pgError.code) {
      case '23505': // unique_violation
        throw new RepositoryError(
          'Duplicate entry',
          'DUPLICATE',
          pgError.constraint ?? undefined
        );
      case '23503': // foreign_key_violation
        throw new RepositoryError(
          'Referenced record not found',
          'NOT_FOUND',
          pgError.constraint ?? undefined
        );
      default:
        throw new RepositoryError(
          `Database error: ${pgError.message}`,
          'DATABASE_ERROR'
        );
    }
  }

  throw error; // Re-throw unknown errors
}
```

### PGlite Test Setup
```typescript
// Source: https://orm.drizzle.team/docs/connect-pglite
// vitest.setup.ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '../src/db/schema/index.js';

let testClient: PGlite;
export let testDb: ReturnType<typeof drizzle>;

export async function setupTestDb() {
  testClient = new PGlite();
  testDb = drizzle(testClient, { schema });

  // Run migrations
  await migrate(testDb, { migrationsFolder: './drizzle' });

  return testDb;
}

export async function teardownTestDb() {
  await testClient.close();
}
```

### Complete Repository Test Example
```typescript
// context.repository.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, testDb } from './vitest.setup.js';
import { ContextRepository } from '../src/repositories/context.repository.js';
import { contexts } from '../src/db/schema/index.js';

describe('ContextRepository', () => {
  let repository: ContextRepository;

  beforeAll(async () => {
    await setupTestDb();
    // Inject test db into repository
    repository = new ContextRepository(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    // Clean tables between tests
    await testDb.delete(contexts);
  });

  it('creates a context with optional name', async () => {
    const ctx = await repository.create({ name: 'Test Context' });

    expect(ctx.id).toBeDefined();
    expect(ctx.name).toBe('Test Context');
    expect(ctx.messageCount).toBe(0);
    expect(ctx.deletedAt).toBeNull();
  });

  it('excludes soft-deleted contexts from findById', async () => {
    const ctx = await repository.create({ name: 'To Delete' });
    await repository.softDelete(ctx.id);

    const found = await repository.findById(ctx.id);
    expect(found).toBeNull();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma ORM | Drizzle ORM | 2024-2025 | Lighter bundle, no codegen, better serverless |
| Testcontainers | PGlite | 2024 | Faster tests, no Docker required |
| Offset pagination | Cursor pagination | Best practice | Consistent results with concurrent writes |
| serial columns | identity columns | PostgreSQL 10+ / Drizzle 2025 | More standard SQL, better portability |

**Deprecated/outdated:**
- `getTableColumns()` - replaced by `getColumns()` in Drizzle 1.0
- `InferModel<>` - use `$inferSelect` / `$inferInsert` instead
- Abstract repository base classes - prefer composition over inheritance in TypeScript

## Open Questions

Things that couldn't be fully resolved:

1. **Token counting accuracy**
   - What we know: Messages have `tokenCount` column, populated at insert time
   - What's unclear: Who provides token counts? Caller or repository?
   - Recommendation: Require caller to provide token counts; repository just stores/sums them

2. **Embedding column usage**
   - What we know: `embedding` vector column exists for future semantic search
   - What's unclear: Should repository methods handle embeddings or separate service?
   - Recommendation: Leave embedding operations out of base repository; add later when v0.3.0 semantic search is implemented

3. **Fork semantics (parentId, forkVersion)**
   - What we know: Schema supports context forking via `parentId` and `forkVersion`
   - What's unclear: Exact fork operation behavior (copy messages? reference?)
   - Recommendation: Implement basic parentId tracking; defer full fork logic to future phase

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM - Cursor-based pagination](https://orm.drizzle.team/docs/guides/cursor-based-pagination) - pagination patterns
- [Drizzle ORM - Transactions](https://orm.drizzle.team/docs/transactions) - transaction API
- [Drizzle ORM - Insert](https://orm.drizzle.team/docs/insert) - batch insert, returning
- [Drizzle ORM - Update](https://orm.drizzle.team/docs/update) - atomic updates, returning
- [Drizzle ORM - Incrementing values](https://orm.drizzle.team/docs/guides/incrementing-a-value) - counter pattern
- [Drizzle ORM - PGlite](https://orm.drizzle.team/docs/connect-pglite) - testing setup
- [Drizzle ORM - Goodies](https://orm.drizzle.team/docs/goodies) - type inference helpers

### Secondary (MEDIUM confidence)
- [API with NestJS - Soft deletes with Drizzle](https://wanago.io/2024/07/22/api-nestjs-soft-deletes-drizzle/) - soft delete patterns
- [GitHub Discussion #916](https://github.com/drizzle-team/drizzle-orm/discussions/916) - error handling patterns
- [Drizzle + Vitest + PGlite repo](https://github.com/rphlmr/drizzle-vitest-pg) - test setup patterns

### Tertiary (LOW confidence)
- WebSearch results on repository pattern with DI - general patterns, not Drizzle-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - using already-installed Drizzle, patterns from official docs
- Architecture: HIGH - patterns verified against Drizzle documentation
- Pitfalls: MEDIUM - some from community discussions, others from general PostgreSQL knowledge
- Testing: HIGH - PGlite approach verified in official docs and community repos

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - Drizzle is stable post-1.0-beta)
