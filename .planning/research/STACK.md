# Technology Stack: v0.2.0 Database + Storage Layer

**Project:** Kata Context
**Researched:** 2026-01-29
**Overall Confidence:** HIGH

## Executive Summary

For PostgreSQL storage with pgvector in a Vercel serverless environment, use **Drizzle ORM** with **Neon direct** (not Vercel Postgres). Vercel Postgres was deprecated in Q4 2024 and transitioned to Neon's native integration. With Vercel Fluid compute (default since April 2025), use WebSocket connections via `@neondatabase/serverless` with connection pooling.

## Existing Stack (from v0.1.0)

Already validated and in production:
- Node.js 24.x
- TypeScript 5.9.x with strict mode, NodeNext resolution
- pnpm 10.x
- Biome 2.3.x
- Vitest 4.x
- Vercel Functions (Fluid compute)

**Do not re-research these.** Focus below is exclusively on database layer additions.

---

## New Stack for v0.2.0

### Database Platform

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Neon | managed | PostgreSQL hosting | Vercel Postgres is deprecated and now powered by Neon. Direct Neon is cheaper with identical performance. Native pgvector support. |

**Why Neon over Vercel Postgres:**
- Vercel transitioned all Vercel Postgres stores to Neon's native integration (Q4 2024 - Q1 2025)
- Vercel Postgres was more expensive with no performance benefits
- Direct Neon gives access to all Neon features (branching, autoscaling, etc.)
- Same underlying infrastructure, fewer middlemen

### ORM Layer

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| drizzle-orm | 0.45.1 | Database queries | Lightweight (~7kb minified+gzipped), zero binary dependencies, negligible cold start impact. Type-safe SQL. Native pgvector support. |
| drizzle-kit | 0.31.8 | Migrations | SQL-first migrations, generate + migrate workflow. Custom migrations for pgvector extension. |

**Why Drizzle over Prisma:**
- **Cold starts:** Drizzle is ~7kb vs Prisma's heavier footprint. In serverless, this matters.
- **SQL transparency:** Drizzle generates predictable SQL. You see exactly what runs.
- **pgvector support:** Native `vector` type in schema, built-in operators for similarity search.
- **Bundle size:** Critical for serverless functions where every KB affects cold start latency.
- **No binary engine:** Prisma's Rust query engine (though improved in 2026) still has more overhead.

**Note:** Prisma improved significantly in 2026 (no longer uses Rust-based engine for serverless), but Drizzle remains the better choice for this use case due to its SQL-first approach and pgvector integration maturity.

### Database Driver

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| @neondatabase/serverless | 1.0.2 | PostgreSQL connections | HTTP/WebSocket driver optimized for serverless. Drop-in `pg` replacement. TypeScript types built-in. |

**Connection Strategy with Vercel Fluid:**

Vercel Fluid compute (default since April 2025) changes the calculus:

1. **With Fluid enabled:** Use WebSocket driver with connection pooling via `Pool`. TCP connections can be reused across invocations.
2. **Classic serverless:** Use HTTP driver (`neon()`) for single queries - fastest for "first query" scenarios.

**Recommendation:** Use WebSocket driver with Pool since Fluid is the default. This provides:
- Session support for transactions
- Connection reuse across invocations
- Lower latency after first connection
- Full `pg` API compatibility

### pgvector Extension

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| pgvector | Neon-managed | Vector similarity search | Native Neon support. Up to 2,000 dimensions for standard vectors. HNSW and IVFFlat indexes. |

**Neon pgvector specifics:**
- Pre-installed, just needs `CREATE EXTENSION vector;`
- Standard `vector`: up to 2,000 dimensions
- `halfvec` (half-precision): up to 4,000 dimensions
- HNSW index recommended for query performance (slower builds but faster queries)

### Development Dependencies

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| dotenv | 17.2.3 | Environment variables | Load DATABASE_URL and other config. Standard approach. |
| ws | 8.19.0 | WebSocket polyfill | Required for Node.js environments (Neon serverless uses WebSockets). |
| @types/pg | 8.16.0 | TypeScript types | Type definitions for pg compatibility layer. |

---

## What NOT to Add

| Technology | Reason |
|------------|--------|
| **Vercel Postgres SDK** | Deprecated. Vercel transitioned to Neon native integration. Use `@neondatabase/serverless` directly. |
| **Prisma** | Heavier, more cold start impact, less SQL control. Drizzle is better fit for serverless + pgvector. |
| **node-postgres (pg)** | Use `@neondatabase/serverless` instead - same API but optimized for serverless. It's a drop-in replacement. |
| **TypeORM** | Legacy patterns, poor TypeScript inference, slower development velocity. |
| **Kysely** | Good query builder, but Drizzle provides similar benefits plus schema management and migrations. |
| **Connection pool libraries (pgBouncer, etc.)** | Neon handles connection pooling server-side. Client-side pooling via `Pool` class is sufficient. |

---

## Installation

```bash
# Production dependencies
pnpm add drizzle-orm @neondatabase/serverless dotenv

# Development dependencies
pnpm add -D drizzle-kit ws @types/pg
```

---

## Configuration Files

### drizzle.config.ts

```typescript
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### vercel.json (Fluid compute explicit)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "fluid": true
}
```

Note: Fluid compute is default for new projects since April 2025, but explicit configuration documents intent.

### Database Connection (src/db/index.ts)

```typescript
import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';

// Required for Node.js environments (local dev, tests)
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
```

### Schema with pgvector (src/db/schema.ts)

```typescript
import { index, pgTable, serial, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core';

export const contexts = pgTable(
  'contexts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('contexts_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ]
);
```

---

## Migration Workflow

```bash
# Generate migration from schema changes
pnpm drizzle-kit generate

# Apply migrations to database
pnpm drizzle-kit migrate

# For pgvector extension (one-time, manual migration):
pnpm drizzle-kit generate --custom
# Then add to the generated SQL: CREATE EXTENSION IF NOT EXISTS vector;
```

**Important:** Drizzle does not auto-create extensions. The pgvector extension must be enabled via a custom migration before any vector columns are used.

---

## Environment Variables

```bash
# .env.local (development)
DATABASE_URL=postgresql://[user]:[password]@[neon-hostname]/[dbname]?sslmode=require

# Vercel (production)
# Set via Vercel dashboard or Neon integration
# The Neon Vercel integration auto-populates these
```

---

## Scripts to Add (package.json)

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| ORM | Drizzle | Prisma | Heavier bundle, more cold start latency, less SQL control |
| ORM | Drizzle | Kysely | No built-in migrations, schema-query disconnect |
| Database | Neon (direct) | Vercel Postgres | Deprecated, more expensive, same underlying infrastructure |
| Database | Neon | Supabase | Supabase is great but Neon has better Vercel integration and serverless driver |
| Driver | @neondatabase/serverless | node-postgres | Neon driver is optimized for serverless, same API |
| Vector | pgvector | Pinecone/Weaviate | External service adds latency, cost, complexity. pgvector keeps vectors with data. |

---

## Confidence Assessment

| Decision | Confidence | Source |
|----------|------------|--------|
| Neon over Vercel Postgres | HIGH | [Vercel Postgres Transition Guide](https://neon.com/docs/guides/vercel-postgres-transition-guide), official Vercel deprecation |
| Drizzle over Prisma | HIGH | [Multiple](https://medium.com/@thebelcoder/prisma-vs-drizzle-orm-in-2026-what-you-really-need-to-know-9598cf4eaa7c) [sources](https://www.thisdot.co/blog/drizzle-orm-a-performant-and-type-safe-alternative-to-prisma), benchmarks, serverless recommendations |
| @neondatabase/serverless driver | HIGH | [Neon official docs](https://neon.com/docs/serverless/serverless-driver), [Drizzle Neon integration](https://orm.drizzle.team/docs/connect-neon) |
| WebSocket + Pool for Fluid | HIGH | [Vercel Fluid docs](https://vercel.com/docs/fluid-compute), [Neon connection methods](https://neon.com/docs/guides/vercel-connection-methods) |
| pgvector on Neon | HIGH | [Neon pgvector docs](https://neon.com/docs/extensions/pgvector), [Drizzle pgvector guide](https://orm.drizzle.team/docs/guides/vector-similarity-search) |
| Package versions | HIGH | npm registry (verified 2026-01-29) |

---

## Sources

### Official Documentation
- [Neon Serverless Driver](https://neon.com/docs/serverless/serverless-driver) - Connection setup, Pool vs Client
- [Neon pgvector Extension](https://neon.com/docs/extensions/pgvector) - Vector types, indexing, limits
- [Neon Vercel Connection Methods](https://neon.com/docs/guides/vercel-connection-methods) - Fluid vs classic serverless
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute) - Configuration, benefits, pricing
- [Drizzle + Neon](https://orm.drizzle.team/docs/connect-neon) - Driver setup, HTTP vs WebSocket
- [Drizzle pgvector Guide](https://orm.drizzle.team/docs/guides/vector-similarity-search) - Schema, queries, indexes
- [Drizzle Migrations](https://orm.drizzle.team/docs/migrations) - generate, migrate, custom migrations

### Comparison Analysis
- [Prisma vs Drizzle ORM in 2026](https://medium.com/@thebelcoder/prisma-vs-drizzle-orm-in-2026-what-you-really-need-to-know-9598cf4eaa7c)
- [Drizzle: A performant and type-safe alternative to Prisma](https://www.thisdot.co/blog/drizzle-orm-a-performant-and-type-safe-alternative-to-prisma)
- [Node.js ORMs in 2025](https://thedataguy.pro/blog/2025/12/nodejs-orm-comparison-2025/)

### Version Verification
- npm registry (queried 2026-01-29): drizzle-orm@0.45.1, drizzle-kit@0.31.8, @neondatabase/serverless@1.0.2, dotenv@17.2.3, ws@8.19.0, @types/pg@8.16.0
