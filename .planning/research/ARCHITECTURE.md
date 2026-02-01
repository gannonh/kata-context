# Architecture: PostgreSQL Storage Layer for Vercel Serverless

**Project:** Kata Context - v0.2.0 Database + Storage Layer
**Domain:** PostgreSQL storage for context policy engine
**Researched:** 2026-01-29
**Confidence:** HIGH

## Executive Summary

This document defines the PostgreSQL storage layer architecture for Kata Context running on Vercel serverless. The architecture uses Drizzle ORM with Neon PostgreSQL (pgvector enabled), implementing a layered data access pattern optimized for serverless cold starts and connection management.

**Key decisions:**
- Drizzle ORM for type-safe database access (serverless-optimized, zero binary dependencies)
- Neon PostgreSQL via Vercel Postgres integration (connection pooling built-in)
- Feature-first directory organization within `/src/db/`
- Repository pattern for data access abstraction
- Vercel Fluid Compute connection pooling with `@vercel/functions`

---

## Directory Structure

### Current Project Structure (v0.1.0)

```
kata-context/
├── api/
│   └── health.ts           # Vercel Function
├── src/
│   └── index.ts            # Package entry (placeholder)
├── tests/
├── package.json
├── tsconfig.json
└── vercel.json
```

### Target Structure (v0.2.0)

```
kata-context/
├── api/                                # Vercel Functions (HTTP layer)
│   ├── health.ts
│   └── v1/
│       └── contexts/
│           ├── index.ts                # POST /api/v1/contexts
│           └── [id].ts                 # GET/PUT/DELETE /api/v1/contexts/:id
│
├── src/
│   ├── index.ts                        # Package exports
│   │
│   ├── db/                             # NEW: Database layer
│   │   ├── index.ts                    # Database client export
│   │   ├── client.ts                   # Drizzle client initialization
│   │   ├── schema/                     # Schema definitions
│   │   │   ├── index.ts                # Schema barrel export
│   │   │   ├── context.ts              # Context table schema
│   │   │   └── context-version.ts      # Context version table schema
│   │   └── migrations/                 # Generated migrations
│   │       └── meta/                   # Migration metadata
│   │
│   ├── repositories/                   # NEW: Data access layer
│   │   ├── index.ts                    # Repository barrel export
│   │   ├── context.repository.ts       # Context CRUD operations
│   │   └── types.ts                    # Repository result types
│   │
│   ├── services/                       # NEW: Business logic layer
│   │   ├── index.ts                    # Service barrel export
│   │   └── context.service.ts          # Context business logic
│   │
│   └── shared/                         # NEW: Cross-cutting concerns
│       ├── errors/
│       │   └── index.ts                # Domain errors
│       └── types/
│           └── index.ts                # Shared types
│
├── drizzle.config.ts                   # NEW: Drizzle Kit configuration
├── package.json
├── tsconfig.json
└── vercel.json
```

### Directory Purpose Map

| Directory | Purpose | Created in Phase |
|-----------|---------|------------------|
| `src/db/` | Database client, schema, migrations | Phase 1 |
| `src/db/schema/` | Table definitions (TypeScript) | Phase 1 |
| `src/db/migrations/` | SQL migration files (generated) | Phase 1 |
| `src/repositories/` | Data access abstraction | Phase 2 |
| `src/services/` | Business logic | Phase 3 |
| `src/shared/` | Errors, types, utilities | Phase 1-2 |
| `api/v1/` | Versioned API endpoints | Phase 3 |

---

## Layer Architecture

### Layer Separation

```
┌─────────────────────────────────────────────────────────┐
│                    HTTP Layer (api/)                     │
│  Request parsing, validation, response formatting        │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│               Service Layer (src/services/)             │
│  Business logic, orchestration, policy enforcement       │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│            Repository Layer (src/repositories/)         │
│  Data access abstraction, query building                 │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│               Database Layer (src/db/)                   │
│  Drizzle client, schema definitions, connection pool     │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 Neon PostgreSQL                          │
│  Serverless Postgres with pgvector                       │
└─────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility | Knows About |
|-------|---------------|-------------|
| HTTP (`api/`) | Request/response, validation, auth | Services |
| Service (`services/`) | Business rules, orchestration | Repositories |
| Repository (`repositories/`) | Data access, query building | Database |
| Database (`db/`) | Connection, schema, migrations | Neon/Drizzle |

**Dependency rule:** Each layer only knows about the layer directly below it.

---

## Connection Management

### Serverless Connection Pattern

Vercel Fluid Compute enables safe connection pooling in serverless. Use `attachDatabasePool` to manage connection lifecycle.

**src/db/client.ts:**

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "./schema/index.js";

// Create pool at module scope (reused across invocations)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,                    // Max connections in pool
  idleTimeoutMillis: 5000,    // Close idle connections after 5s
  connectionTimeoutMillis: 10000,
});

// Attach to Vercel Fluid lifecycle management
attachDatabasePool(pool);

// Export typed Drizzle instance
export const db = drizzle(pool, { schema });

// Export pool for direct access if needed
export { pool };
```

**Key configuration:**
- `max: 10` - Reasonable pool size for serverless
- `idleTimeoutMillis: 5000` - Short timeout to release connections quickly
- `attachDatabasePool` - Ensures connections close before function suspension

### Connection String Configuration

**Environment variables:**

```bash
# Pooled connection (for queries)
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require

# Direct connection (for migrations)
DATABASE_URL_DIRECT=postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
```

**Why two URLs:**
- Pooled (`-pooler` suffix): Efficient for application queries, handles high concurrency
- Direct: Required for migrations (DDL statements don't work through PgBouncer)

---

## Schema Organization

### Schema Files

Each domain entity gets its own schema file for maintainability.

**src/db/schema/context.ts:**

```typescript
import { pgTable, text, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { contextVersions } from "./context-version.js";

export const contexts = pgTable("contexts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const contextsRelations = relations(contexts, ({ many }) => ({
  versions: many(contextVersions),
}));
```

**src/db/schema/context-version.ts:**

```typescript
import { pgTable, text, timestamp, jsonb, uuid, integer, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { vector } from "drizzle-orm/pg-core";
import { contexts } from "./context.js";

export const contextVersions = pgTable("context_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  contextId: uuid("context_id")
    .notNull()
    .references(() => contexts.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  content: jsonb("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),  // For semantic retrieval
  tokenCount: integer("token_count"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("context_version_context_idx").on(table.contextId),
  index("context_version_embedding_idx")
    .using("hnsw", table.embedding.op("vector_cosine_ops")),
]);

export const contextVersionsRelations = relations(contextVersions, ({ one }) => ({
  context: one(contexts, {
    fields: [contextVersions.contextId],
    references: [contexts.id],
  }),
}));
```

**src/db/schema/index.ts:**

```typescript
export * from "./context.js";
export * from "./context-version.js";
```

### pgvector Setup

pgvector must be enabled manually before migrations:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

This can be done via Neon console or a pre-migration script.

---

## Repository Pattern

### Repository Interface

Repositories abstract data access, making business logic testable.

**src/repositories/context.repository.ts:**

```typescript
import { eq, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { contexts, contextVersions } from "../db/schema/index.js";

export type Context = typeof contexts.$inferSelect;
export type NewContext = typeof contexts.$inferInsert;
export type ContextVersion = typeof contextVersions.$inferSelect;

export const ContextRepository = {
  async findById(id: string): Promise<Context | null> {
    const result = await db
      .select()
      .from(contexts)
      .where(eq(contexts.id, id))
      .limit(1);
    return result[0] ?? null;
  },

  async findByTenant(tenantId: string): Promise<Context[]> {
    return db
      .select()
      .from(contexts)
      .where(eq(contexts.tenantId, tenantId));
  },

  async create(data: NewContext): Promise<Context> {
    const result = await db
      .insert(contexts)
      .values(data)
      .returning();
    return result[0]!;
  },

  async update(id: string, data: Partial<NewContext>): Promise<Context | null> {
    const result = await db
      .update(contexts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contexts.id, id))
      .returning();
    return result[0] ?? null;
  },

  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(contexts)
      .where(eq(contexts.id, id))
      .returning({ id: contexts.id });
    return result.length > 0;
  },

  async getLatestVersion(contextId: string): Promise<ContextVersion | null> {
    const result = await db
      .select()
      .from(contextVersions)
      .where(eq(contextVersions.contextId, contextId))
      .orderBy(desc(contextVersions.version))
      .limit(1);
    return result[0] ?? null;
  },
};
```

### Repository Benefits for Serverless

1. **Testability:** Mock repository in tests without database
2. **Abstraction:** Swap database without changing services
3. **Query encapsulation:** Complex queries live in one place
4. **Type safety:** Drizzle infers types from schema

---

## Migration Strategy

### Drizzle Kit Configuration

**drizzle.config.ts:**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL_DIRECT!, // Direct connection for DDL
  },
  verbose: true,
  strict: true,
});
```

### Migration Commands

```bash
# Generate migration from schema changes
pnpm drizzle-kit generate

# Apply migrations (development)
pnpm drizzle-kit migrate

# Push schema directly (local development only)
pnpm drizzle-kit push
```

### Migration in Production

For Vercel deployment, run migrations as a build step or separate job:

**package.json:**

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push"
  }
}
```

**Option 1: Build-time migration (simple)**

```json
{
  "scripts": {
    "build": "pnpm db:migrate && tsc"
  }
}
```

**Option 2: Separate migration job (recommended for production)**

Use GitHub Actions to run migrations before deployment.

---

## API Integration

### Endpoint Pattern

**api/v1/contexts/index.ts:**

```typescript
import { ContextService } from "../../../src/services/context.service.js";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId");

  if (!tenantId) {
    return Response.json({ error: "tenantId required" }, { status: 400 });
  }

  const contexts = await ContextService.findByTenant(tenantId);
  return Response.json({ data: contexts });
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();

  // Validation here (use zod)

  const context = await ContextService.create(body);
  return Response.json({ data: context }, { status: 201 });
}
```

### Request Flow

```
POST /api/v1/contexts
        │
        ▼
┌───────────────────┐
│ api/v1/contexts/  │  Parse request, validate
│ index.ts          │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ ContextService    │  Apply business rules
│ .create()         │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ ContextRepository │  Build query, execute
│ .create()         │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Drizzle ORM       │  Connection from pool
│ db.insert()       │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Neon PostgreSQL   │  Execute SQL
└───────────────────┘
```

---

## Build Order

### Phase 1: Database Foundation

**Goal:** Schema, migrations, connection working.

**Order:**
1. Install dependencies (`drizzle-orm`, `pg`, `@vercel/functions`)
2. Create `src/db/client.ts` - connection pool
3. Create `src/db/schema/context.ts` - context table
4. Create `drizzle.config.ts`
5. Generate and run first migration
6. Verify connection in health endpoint

**Deliverable:** `pnpm db:migrate` works, health endpoint can query DB.

### Phase 2: Repository Layer

**Goal:** Type-safe data access abstraction.

**Order:**
1. Create `src/repositories/context.repository.ts`
2. Add CRUD operations
3. Add unit tests (mock db)
4. Add integration tests (test db)

**Deliverable:** Repository with full CRUD, tested.

### Phase 3: Service + API

**Goal:** Business logic and HTTP endpoints.

**Order:**
1. Create `src/services/context.service.ts`
2. Create `api/v1/contexts/index.ts`
3. Create `api/v1/contexts/[id].ts`
4. Add request validation (zod)
5. Add error handling

**Deliverable:** Working CRUD API for contexts.

---

## Serverless-Specific Patterns

### Cold Start Mitigation

1. **Connection pooling at module scope** - Pool created once, reused
2. **Drizzle lightweight** - No heavy ORM initialization
3. **Vercel Fluid** - Keeps function warm longer

### Connection Limits

Neon pooler supports 10,000 concurrent connections. With Vercel's connection pooling:
- Function instances share pool within instance
- `attachDatabasePool` prevents connection leaks
- Short idle timeout (5s) releases connections quickly

### Query Patterns for Serverless

```typescript
// GOOD: Single query with joins
const result = await db.query.contexts.findFirst({
  where: eq(contexts.id, id),
  with: { versions: { limit: 1, orderBy: desc(contextVersions.version) } },
});

// AVOID: Multiple round trips
const context = await db.select().from(contexts).where(eq(contexts.id, id));
const versions = await db.select().from(contextVersions).where(eq(contextVersions.contextId, id));
```

---

## Anti-Patterns to Avoid

### 1. Connection Per Request

**Wrong:**
```typescript
export async function GET() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  // ... query
  await pool.end(); // Connection leak if error thrown before this
}
```

**Right:** Use module-scope pool with `attachDatabasePool`.

### 2. Direct Connection for Queries

**Wrong:** Using `DATABASE_URL_DIRECT` for application queries (bypasses pooling).

**Right:** Use pooled connection (`-pooler`) for all queries.

### 3. Fat API Handlers

**Wrong:** Business logic in route handler.

**Right:** Handler calls service, service has logic.

### 4. Skipping Repository Layer

**Wrong:** Services directly use `db.select()`.

**Right:** Services call repositories, repositories build queries.

---

## Dependencies

### Production

```json
{
  "dependencies": {
    "drizzle-orm": "^0.38.x",
    "pg": "^8.x",
    "@vercel/functions": "^1.x"
  }
}
```

### Development

```json
{
  "devDependencies": {
    "drizzle-kit": "^0.30.x",
    "@types/pg": "^8.x"
  }
}
```

### Why These Choices

| Package | Purpose | Why Not Alternative |
|---------|---------|---------------------|
| `drizzle-orm` | Type-safe ORM | Lighter than Prisma, no binary, serverless-native |
| `pg` (node-postgres) | PostgreSQL driver | Most mature, works with `attachDatabasePool` |
| `@vercel/functions` | Connection lifecycle | Official Vercel helper for Fluid compute |
| `drizzle-kit` | Migrations | Pairs with drizzle-orm, generates clean SQL |

### Not Using

| Package | Why Not |
|---------|---------|
| `@neondatabase/serverless` | Not needed with Fluid compute + pg pooling |
| `@vercel/postgres` | Deprecated in favor of Neon direct integration |
| `prisma` | Binary dependencies, slower cold starts |

---

## Sources

### HIGH Confidence (Official Documentation)

- [Vercel Connection Pooling with Functions](https://vercel.com/kb/guide/connection-pooling-with-functions)
- [Drizzle ORM PostgreSQL Getting Started](https://orm.drizzle.team/docs/get-started-postgresql)
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations)
- [Drizzle ORM pgvector Guide](https://orm.drizzle.team/docs/guides/vector-similarity-search)
- [Neon Connection Pooling](https://neon.com/docs/connect/connection-pooling)

### MEDIUM Confidence (Verified Guides)

- [Neon Vercel Connection Methods](https://neon.com/docs/guides/vercel-connection-methods)
- [Drizzle with Local and Serverless Postgres](https://neon.com/guides/drizzle-local-vercel)
- [Vercel Fluid Compute Database Pool Management](https://vercel.com/kb/guide/efficiently-manage-database-connection-pools-with-fluid-compute)

### LOW Confidence (Community Patterns)

- Repository pattern implementations (dev.to articles)
- Directory structure recommendations (various tutorials)

---

*Last updated: 2026-01-29*
