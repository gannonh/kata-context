---
phase: 03-database-foundation
plan: 01
subsystem: database
tags: [drizzle, postgres, neon, pgvector, typescript]
requires: []
provides: [drizzle-schema, db-client, migration-tooling]
affects: [03-02, 04-*]
tech-stack:
  added:
    - drizzle-orm@0.45.1
    - drizzle-kit@0.31.8
    - pg@8.14.1
    - "@vercel/functions@3.4.0"
    - "@types/pg@8.15.2"
  patterns:
    - Repository pattern foundation
    - Vercel Fluid connection lifecycle
    - Soft delete with deletedAt column
key-files:
  created:
    - drizzle.config.ts
    - src/db/client.ts
    - src/db/schema/index.ts
    - src/db/schema/contexts.ts
    - src/db/schema/messages.ts
    - .env.example
  modified:
    - package.json
    - pnpm-lock.yaml
decisions:
  - id: DEV-03-01-01
    decision: Upgraded @vercel/functions from 2.1.0 to 3.4.0
    reason: attachDatabasePool function required for Vercel Fluid lifecycle only available in 3.x
  - id: DEV-03-01-02
    decision: Used AnyPgColumn for self-referential foreign key
    reason: TypeScript circular inference issue with parentId referencing contexts.id
metrics:
  duration: 3m
  completed: 2026-01-31
---

# Phase 3 Plan 01: Install Drizzle ORM and Define Schema Summary

**One-liner:** Type-safe Drizzle ORM with contexts/messages schema including pgvector(1536) for semantic search, configured for Vercel Fluid serverless.

## What Was Built

### Database Dependencies
- **drizzle-orm@0.45.1**: Type-safe ORM with full TypeScript inference
- **drizzle-kit@0.31.8**: Migration generation and database tooling
- **pg@8.14.1**: PostgreSQL driver for Node.js serverless functions
- **@vercel/functions@3.4.0**: Provides `attachDatabasePool` for connection lifecycle management

### Database Client (`src/db/client.ts`)
- Connection pooling with conservative settings (max: 3 connections)
- Vercel Fluid lifecycle integration via `attachDatabasePool`
- Runtime validation for pooled connection string (-pooler hostname)
- Exports `db` (Drizzle instance) and `pool` (raw pg Pool)

### Schema Definitions

**Contexts Table (`src/db/schema/contexts.ts`):**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key, auto-generated |
| name | TEXT | Optional context name |
| createdAt | TIMESTAMPTZ | Auto-set on creation |
| updatedAt | TIMESTAMPTZ | Auto-set on creation |
| messageCount | INTEGER | Defaults to 0 |
| totalTokens | INTEGER | Defaults to 0 |
| latestVersion | BIGINT | Version counter for ordering |
| parentId | UUID | Self-reference for fork tracking |
| forkVersion | BIGINT | Version at fork point |
| deletedAt | TIMESTAMPTZ | Soft delete marker |

**Messages Table (`src/db/schema/messages.ts`):**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key, auto-generated |
| contextId | UUID | FK to contexts.id |
| version | BIGINT | Message order within context |
| createdAt | TIMESTAMPTZ | Auto-set on creation |
| role | TEXT | 'user' / 'assistant' / 'system' / 'tool' |
| content | TEXT | Message content |
| toolCallId | TEXT | Optional tool call reference |
| toolName | TEXT | Optional tool name |
| tokenCount | INTEGER | Token count for this message |
| model | TEXT | Model that generated response |
| deletedAt | TIMESTAMPTZ | Soft delete marker |
| embedding | VECTOR(1536) | pgvector for semantic search |

**Indexes:**
- `messages_context_version_idx`: Composite on (contextId, version)
- `messages_deleted_at_idx`: On deletedAt for soft delete filtering
- `messages_context_version_unique`: Unique constraint on (contextId, version)

### NPM Scripts Added
- `db:generate`: Generate migrations from schema changes
- `db:migrate`: Apply migrations to database
- `db:push`: Push schema directly (development only)
- `db:studio`: Launch Drizzle Studio for database browsing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @vercel/functions version incompatibility**
- **Found during:** Task 2
- **Issue:** Plan specified @vercel/functions@2.1.0 but `attachDatabasePool` is only available in 3.x
- **Fix:** Upgraded to @vercel/functions@3.4.0
- **Files modified:** package.json, pnpm-lock.yaml
- **Commit:** 788ebcf

**2. [Rule 1 - Bug] Self-referential type inference**
- **Found during:** Task 3
- **Issue:** TypeScript circular inference error on contexts.parentId referencing contexts.id
- **Fix:** Used `AnyPgColumn` type annotation for the self-reference callback
- **Files modified:** src/db/schema/contexts.ts
- **Commit:** bd36483

## Verification Results

All success criteria met:
- [x] drizzle-orm, pg, @vercel/functions installed as dependencies
- [x] drizzle-kit installed as dev dependency
- [x] drizzle.config.ts configured for PostgreSQL with schema path
- [x] src/db/client.ts exports `db` and `pool` with Vercel Fluid lifecycle
- [x] src/db/schema/contexts.ts defines contexts table with all required columns
- [x] src/db/schema/messages.ts defines messages table with vector(1536) column
- [x] Indexes defined for context_id + version and deleted_at
- [x] TypeScript compilation succeeds with full type inference

## Commits

| Hash | Message |
|------|---------|
| 1865faf | feat(03-01): install database dependencies |
| 788ebcf | feat(03-01): add Drizzle config and database client |
| bd36483 | feat(03-01): define Drizzle schema for contexts and messages |

## Next Phase Readiness

**Prerequisites for 03-02 (Migration Generation):**
- [x] Schema files exist and compile
- [x] drizzle-kit installed and configured
- [ ] DATABASE_URL environment variable configured (user setup required)
- [ ] Neon database provisioned with pgvector extension enabled

**User Setup Required:**
Before running migrations, the user must:
1. Create Neon project and database at console.neon.tech
2. Enable pgvector: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Get pooled connection string (with -pooler in hostname)
4. Set DATABASE_URL in .env or Vercel environment
