# Architecture

**Analysis Date:** 2026-02-02

## Pattern Overview

**Overall:** Repository Pattern with Layered Architecture

**Key Characteristics:**
- Clear separation between database schema, data access layer, and API endpoints
- Framework-agnostic design allowing different database implementations (production vs test)
- Serverless-first architecture optimized for Vercel Functions with connection pooling
- Domain-driven error handling with typed repository errors
- Transaction-based operations for data consistency

## Layers

**Database Schema Layer:**
- Purpose: Defines database structure using Drizzle ORM type-safe schema definitions
- Location: `src/db/schema/`
- Contains: Table definitions (`contexts.ts`, `messages.ts`), type exports, indexes, foreign keys
- Depends on: Drizzle ORM pg-core primitives
- Used by: Repository layer, migrations

**Database Client Layer:**
- Purpose: Manages PostgreSQL connection pool with Vercel Fluid lifecycle integration
- Location: `src/db/client.ts`
- Contains: Pool configuration, Drizzle instance, connection validation
- Depends on: pg (node-postgres), drizzle-orm, @vercel/functions
- Used by: Repository layer, API endpoints

**Repository Layer:**
- Purpose: Encapsulates all database operations with clean business-focused interfaces
- Location: `src/repositories/`
- Contains: `ContextRepository`, `MessageRepository`, shared helpers, type definitions
- Depends on: Database schema, Drizzle query builders
- Used by: API endpoints, future service layer

**API Layer:**
- Purpose: Exposes serverless HTTP endpoints following Vercel Functions conventions
- Location: `api/`
- Contains: Health check endpoint (more endpoints planned)
- Depends on: Database client, repositories
- Used by: External consumers (HTTP requests)

**Helper/Utility Layer:**
- Purpose: Cross-cutting concerns like error handling and query filters
- Location: `src/repositories/helpers.ts`
- Contains: `notDeleted()` filter, `handleDatabaseError()` mapper
- Depends on: Drizzle ORM, pg error types
- Used by: Repository layer

## Data Flow

**Read Operation (Context Retrieval):**

1. HTTP request arrives at API endpoint
2. API handler calls repository method (e.g., `contextRepo.findById()`)
3. Repository builds Drizzle query with filters (e.g., `notDeleted()`)
4. Drizzle executes query via connection pool
5. Repository maps result to domain type
6. API handler serializes to JSON response

**Write Operation (Message Append):**

1. HTTP request with message data arrives at API endpoint
2. API handler validates input and calls `messageRepo.append()`
3. Repository opens database transaction
4. Lock context row with `FOR UPDATE` to prevent race conditions
5. Assign sequential version numbers to new messages
6. Batch insert messages
7. Update context counters atomically
8. Commit transaction
9. Return inserted messages to caller

**State Management:**
- All state persists in PostgreSQL
- Context metadata (message count, total tokens) denormalized for performance
- Version numbers provide ordered message sequence per context
- Soft delete pattern preserves audit trail

## Key Abstractions

**Context:**
- Purpose: Represents a conversation or session container
- Examples: `src/db/schema/contexts.ts`, `src/repositories/context.repository.ts`
- Pattern: Entity with soft delete, fork tracking, aggregated metrics

**Message:**
- Purpose: Represents a single LLM conversation turn with versioning
- Examples: `src/db/schema/messages.ts`, `src/repositories/message.repository.ts`
- Pattern: Versioned entity with CASCADE delete, token counting, pgvector support

**Repository:**
- Purpose: Abstracts database operations behind domain-focused interfaces
- Examples: `src/repositories/context.repository.ts`, `src/repositories/message.repository.ts`
- Pattern: Class-based with dependency injection (accepts db instance)

**Database Type Unions:**
- Purpose: Support both production (node-postgres) and test (PGlite) database clients
- Pattern: `type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>`
- Used throughout repository layer for polymorphic database handling

## Entry Points

**API Health Check:**
- Location: `api/health.ts`
- Triggers: HTTP GET request to `/api/health`
- Responsibilities: Verify database connectivity, measure latency, report system status

**Local Dev Server:**
- Location: `scripts/dev-server.ts`
- Triggers: `pnpm dev:local` command
- Responsibilities: Mimics Vercel routing locally (workaround for `vercel dev` limitations)

**Test Setup:**
- Location: `vitest.setup.ts`
- Triggers: Vitest test execution
- Responsibilities: Initialize PGlite in-memory database, run migrations, provide test db instance

**Package Entry:**
- Location: `src/index.ts`
- Triggers: External imports of kata-context package
- Responsibilities: Export VERSION constant (future: export repositories, types)

## Error Handling

**Strategy:** Domain-specific typed errors with PostgreSQL error code mapping

**Patterns:**
- Repository methods throw `RepositoryError` with semantic codes (`NOT_FOUND`, `DUPLICATE`, `FOREIGN_KEY`, `DATABASE_ERROR`)
- `handleDatabaseError()` helper maps PostgreSQL error codes (23505, 23503) to `RepositoryError` types
- API endpoints catch repository errors and map to HTTP status codes (future implementation)
- Pool-level errors logged but don't crash process (handled by pool error handler)
- Transaction failures automatically rollback, error propagates to caller

## Cross-Cutting Concerns

**Logging:** Console-based structured logging with ISO timestamps. Pool errors and health check failures logged with context. Production observability ready.

**Validation:** Input validation at repository layer (e.g., checking context exists before appending messages). Schema-level validation via Drizzle types and database constraints.

**Authentication:** Not implemented. Future consideration for multi-tenant context isolation.

**Soft Delete:** All entities support soft delete via `deletedAt` timestamp. `notDeleted()` helper must be used in every query to exclude deleted records.

**Concurrency Control:** Row-level locking with `FOR UPDATE` in transactions prevents version conflicts during concurrent message appends. Unique constraints on `(contextId, version)` provide final safety net.

**Connection Pooling:** Conservative pool size (max 3 connections) optimized for serverless. Vercel Fluid integration ensures graceful connection cleanup before function suspension. Pooled connection string (`-pooler`) required in production.

---

*Architecture analysis: 2026-02-02*
