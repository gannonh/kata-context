# Roadmap: Kata Context v0.2.0

## Overview

v0.2.0 establishes the storage foundation for context persistence. Three phases build sequentially: database infrastructure and schema (Phase 3), repository abstraction layer (Phase 4), and REST API with comprehensive testing (Phase 5). Each phase delivers a complete, verifiable capability.

**Milestone:** v0.2.0 Database + Storage Layer
**Depth:** Standard
**Phases:** 3 (numbered 3-5, continuing from v0.1.0)
**Requirements:** 23 mapped

---

## Phase 3: Database Foundation

**Goal:** PostgreSQL database is operational with type-safe schema and serverless-optimized connections.

**Dependencies:** v0.1.0 project foundation (shipped)

**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md - Install Drizzle ORM, configure connection pooling, define schema
- [x] 03-02-PLAN.md - Generate migration, verify database, update health endpoint

**Requirements:**
- DB-01: PostgreSQL database provisioned on Neon with pgvector extension enabled
- DB-02: Drizzle ORM configured with type-safe schema definitions
- DB-03: Database migration workflow established (generate -> migrate)
- DB-04: Serverless connection pooling configured (@neondatabase/serverless + Vercel Fluid)
- SCHEMA-01: Contexts table with id, metadata, created_at, updated_at, deleted_at
- SCHEMA-02: Messages table with context_id, role, content, token_count, sequence, created_at
- SCHEMA-03: Embedding column on messages (vector type, unpopulated until v0.3.0)
- SCHEMA-04: Indexes for efficient retrieval (context_id + sequence, deleted_at)

**Success Criteria:**
1. Developer can run `pnpm db:migrate` and see tables created in Neon dashboard
2. Health endpoint queries database and returns connection status
3. Drizzle schema compiles with full TypeScript type inference
4. Connection pooling uses pooled endpoint (hostname contains -pooler)
5. pgvector extension is enabled (verified via `SELECT * FROM pg_extension WHERE extname = 'vector'`)

---

## Phase 4: Repository Layer

**Goal:** Type-safe data access abstraction enables all CRUD operations without direct database coupling.

**Dependencies:** Phase 3 (database foundation)

**Plans:** 2 plans

Plans:
- [x] 04-01-PLAN.md - Repository foundation + testing setup (ContextRepository)
- [x] 04-02-PLAN.md - Message repository + token windowing (MessageRepository)

**Requirements:**
- DATA-01: Create new context with optional metadata
- DATA-02: Retrieve context by ID with message count
- DATA-03: Append messages to context (batch insert with sequence assignment)
- DATA-04: Retrieve messages with cursor-based pagination
- DATA-05: Soft delete context (set deleted_at, preserve history)
- DATA-06: Token-budgeted windowing (retrieve last N tokens worth of messages)

**Success Criteria:**
1. Developer can create a context and retrieve it by ID via repository methods
2. Messages appended to a context have automatically assigned sequence numbers
3. Soft-deleted contexts are excluded from normal queries but preserved in database
4. Cursor-based pagination returns consistent results across multiple calls
5. Token-budgeted retrieval stops accumulating messages when budget is exceeded

---

## Phase 5: API + Testing Layer

**Goal:** REST API exposes context management operations with comprehensive test coverage.

**Dependencies:** Phase 4 (repository layer)

**Requirements:**
- API-01: POST /api/v1/contexts - create new context, returns context_id
- API-02: GET /api/v1/contexts/:id - retrieve context with metadata and message count
- API-03: DELETE /api/v1/contexts/:id - soft delete context
- API-04: POST /api/v1/contexts/:id/messages - append messages to context
- API-05: GET /api/v1/contexts/:id/messages - retrieve messages with pagination
- API-06: GET /api/v1/contexts/:id/window?budget=N - retrieve token-budgeted window
- TEST-01: Unit tests for repository layer with mocked database
- TEST-02: Integration tests for API endpoints against test database
- TEST-03: Token-budgeted windowing edge cases (empty context, budget exceeds total)

**Success Criteria:**
1. API client can create a context, append messages, and retrieve them via REST
2. Token-budgeted window endpoint returns messages fitting within specified budget
3. Unit tests pass with mocked database (no real DB connection required)
4. Integration tests pass against test database with full request/response cycle
5. Edge cases handled gracefully: empty context returns empty array, budget exceeding total returns all messages

---

## Progress

| Phase | Name | Status | Plans | Requirements |
|-------|------|--------|-------|--------------|
| 3 | Database Foundation | Complete | 2/2 | 8 |
| 4 | Repository Layer | Complete | 2/2 | 6 |
| 5 | API + Testing Layer | Pending | 0/? | 9 |

**Coverage:** 23/23 requirements mapped

---

## Requirement Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | 3 | Complete |
| DB-02 | 3 | Complete |
| DB-03 | 3 | Complete |
| DB-04 | 3 | Complete |
| SCHEMA-01 | 3 | Complete |
| SCHEMA-02 | 3 | Complete |
| SCHEMA-03 | 3 | Complete |
| SCHEMA-04 | 3 | Complete |
| DATA-01 | 4 | Complete |
| DATA-02 | 4 | Complete |
| DATA-03 | 4 | Complete |
| DATA-04 | 4 | Complete |
| DATA-05 | 4 | Complete |
| DATA-06 | 4 | Complete |
| API-01 | 5 | Pending |
| API-02 | 5 | Pending |
| API-03 | 5 | Pending |
| API-04 | 5 | Pending |
| API-05 | 5 | Pending |
| API-06 | 5 | Pending |
| TEST-01 | 5 | Pending |
| TEST-02 | 5 | Pending |
| TEST-03 | 5 | Pending |

---

*Created: 2026-01-30 | Milestone: v0.2.0 Database + Storage Layer*
