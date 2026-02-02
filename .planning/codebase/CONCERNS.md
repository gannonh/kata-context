# Codebase Concerns

**Analysis Date:** 2026-02-02

## Tech Debt

**Incomplete Feature: Context Metadata Storage**
- Issue: Metadata field defined in `CreateContextInput` type but not stored in database
- Files: `src/repositories/types.ts` (line 5), `src/db/schema/contexts.ts`
- Impact: Callers can pass metadata during context creation, but it silently disappears (not stored)
- Fix approach: Add JSONB column to contexts table, update schema, generate migration, update ContextRepository.create()

**Incomplete Feature: Context Forking**
- Issue: Database schema has `parentId` and `forkVersion` columns but no repository methods implement forking
- Files: `src/db/schema/contexts.ts` (lines 21-24), `src/repositories/context.repository.ts`
- Impact: Fork tracking columns exist but cannot be populated; no API to create child contexts
- Fix approach: Add `ContextRepository.fork(contextId, atVersion)` method that copies messages up to version and sets parent reference

**Incomplete Feature: Message Embeddings**
- Issue: Schema includes `embedding` vector column but no methods populate or query it
- Files: `src/db/schema/messages.ts` (line 37), `src/repositories/message.repository.ts`
- Impact: pgvector infrastructure present but semantic search capability unusable
- Fix approach: Add embedding generation during message append (Phase v0.3.0 planned), add similarity search methods

**Incomplete Feature: Message Soft Delete**
- Issue: Messages table has `deletedAt` column and queries filter with `notDeleted()`, but no repository method implements soft delete
- Files: `src/db/schema/messages.ts` (line 34), `src/repositories/message.repository.ts`
- Impact: Soft delete filtering logic exists but no way to trigger deletion; orphaned column
- Fix approach: Add `MessageRepository.softDelete(contextId, version)` or clarify messages cascade-delete with context

**Missing Index: Message Embedding Similarity**
- Issue: Vector column exists but no HNSW or IVFFlat index for fast similarity search
- Files: `src/db/schema/messages.ts` (line 37)
- Impact: Semantic search would require full table scan; unusable at scale
- Fix approach: Add index after embeddings populated (v0.3.0): `CREATE INDEX messages_embedding_idx ON messages USING hnsw (embedding vector_cosine_ops);`

**Hardcoded Vercel Dependency in Production Code**
- Issue: Database client checks `process.env.VERCEL` flag and throws error in production if non-pooled connection
- Files: `src/db/client.ts` (lines 21-26, 48-50)
- Impact: Code cannot run in non-Vercel production environments (AWS Lambda, Docker, etc.) without workaround
- Fix approach: Add environment variable `POOLED_CONNECTION_REQUIRED=true` to replace Vercel-specific check

**Environment Configuration Not Centralized**
- Issue: Multiple .env files exist (.env, .env.local, .env.development.local) with unclear precedence
- Files: `.env`, `.env.local`, `.env.development.local` (root directory)
- Impact: Developer confusion about which file is loaded; potential for stale config
- Fix approach: Document env file precedence in CLAUDE.md; consider consolidating to .env + .env.local only

## Known Bugs

**Vercel Dev Local Function Execution**
- Symptoms: Running `vercel dev` returns 404 for `/api/health` locally, but works in production
- Files: `api/health.ts`, `CLAUDE.md` (lines 79-86)
- Trigger: Run `vercel dev` and visit http://localhost:3000/api/health
- Workaround: Use `pnpm dev:local` which runs `tsx --env-file=.env scripts/dev-server.ts`

**Insert Return Type Assertion Required**
- Symptoms: TypeScript strict mode requires explicit assertion after `insert().returning()`
- Files: `src/repositories/context.repository.ts` (lines 30-32)
- Trigger: Compile with strict: true in tsconfig.json
- Workaround: Manually check if result[0] exists and throw if undefined (documented as DEV-04-01-03 in STATE.md)

## Security Considerations

**Connection String Logging Risk**
- Risk: Health endpoint logs connection errors which may leak DATABASE_URL in production logs
- Files: `api/health.ts` (line 48)
- Current mitigation: Generic error message returned to client ("Database connection failed")
- Recommendations: Ensure observability platform redacts connection strings; consider structured logging with secret redaction

**Environment Variables Committed**
- Risk: Multiple .env files exist locally (not in .gitignore would expose secrets)
- Files: `.env`, `.env.local`, `.env.development.local`
- Current mitigation: .gitignore includes `.env` and `.env*.local` patterns
- Recommendations: Audit actual files on disk to ensure real secrets not committed (grep for DATABASE_URL in git history)

**No API Authentication**
- Risk: Health endpoint and future API routes have no authentication
- Files: `api/health.ts`
- Current mitigation: None (health endpoint intentionally public)
- Recommendations: Before adding data mutation APIs (Phase 5), add JWT/API key authentication middleware

**Database Pool Configuration**
- Risk: Small max pool size (3) could lead to connection starvation under load
- Files: `src/db/client.ts` (line 32)
- Current mitigation: Intentionally conservative for serverless cold start (per research in comments)
- Recommendations: Load test under production traffic to validate pool size; consider increasing to 5-10 if needed

## Performance Bottlenecks

**Token Budget Calculation Fetches All Messages**
- Problem: `MessageRepository.getByTokenBudget()` loads all messages for context in memory before filtering
- Files: `src/repositories/message.repository.ts` (lines 126-130)
- Cause: No database-level aggregation; client-side accumulation required
- Improvement path: Use window functions or recursive CTE to compute running sum in SQL, return only matching rows

**No Database Query Result Caching**
- Problem: Repeated context/message lookups hit database every time
- Files: `src/repositories/context.repository.ts`, `src/repositories/message.repository.ts`
- Cause: No caching layer (Redis, in-memory LRU)
- Improvement path: Add Redis for context metadata caching with TTL; consider response caching in API layer (Phase 5)

**Pagination Fetches Extra Row Every Time**
- Problem: Cursor pagination fetches `limit + 1` rows to check for more, discarding the extra
- Files: `src/repositories/message.repository.ts` (line 89)
- Cause: Standard pagination pattern to determine hasMore flag
- Improvement path: Acceptable overhead; alternative is COUNT query which is slower

## Fragile Areas

**Database Client Module Side Effects**
- Files: `src/db/client.ts`
- Why fragile: Module executes pool creation and error handler attachment at import time (side effects)
- Safe modification: Changes to pool configuration require careful testing in both local and Vercel environments
- Test coverage: No unit tests for client initialization (difficult to test without mocking pg.Pool)

**Migration Generation Workflow**
- Files: `src/db/migrations/` (generated), `drizzle.config.ts`
- Why fragile: Migrations auto-generated by drizzle-kit based on schema changes; manual SQL edits lost on regeneration
- Safe modification: Always edit schema files, never edit generated migration SQL directly
- Test coverage: No migration rollback testing; forward-only migrations assumed

**Transaction Error Handling**
- Files: `src/repositories/message.repository.ts` (lines 28-78)
- Why fragile: Transaction in `append()` catches and re-throws RepositoryError but may swallow other errors
- Safe modification: Ensure all error paths properly re-throw after logging
- Test coverage: Tests verify success paths and RepositoryError cases but not unexpected exceptions during transaction

**Test Database Setup**
- Files: `vitest.setup.ts`
- Why fragile: Global testDb variable mutated during setup; potential race conditions if tests run in parallel
- Safe modification: vitest configured to run test files sequentially to avoid conflicts
- Test coverage: No tests for test setup itself (bootstrap code)

## Scaling Limits

**Message Table Row Count**
- Current capacity: Unbounded (no archival or partitioning)
- Limit: Large contexts (10K+ messages) degrade pagination performance
- Scaling path: Add table partitioning by context_id or implement message archival after N days

**Connection Pool Exhaustion**
- Current capacity: 3 connections per Vercel Fluid instance
- Limit: High concurrency could exhaust pool under traffic spikes
- Scaling path: Increase max pool size to 5-10; monitor connection wait time in production

**pgvector Nearest Neighbor Search**
- Current capacity: No index on embedding column (HNSW/IVFFlat)
- Limit: Similarity search will be O(n) full table scan
- Scaling path: Add HNSW index when embeddings populated (v0.3.0); consider separate vector DB for >1M messages

**No Horizontal Scaling Strategy**
- Current capacity: Single-region Neon database
- Limit: Read replicas not configured; no geo-distribution
- Scaling path: Add Neon read replicas for read-heavy workloads; consider multi-region if latency requirements demand it

## Dependencies at Risk

**Drizzle ORM Maturity**
- Risk: Relatively young ORM (v0.45.1) compared to Prisma/TypeORM
- Impact: Potential breaking changes in minor versions; smaller community
- Migration plan: Well-typed schema can be ported to Knex or raw SQL if needed; repository pattern isolates blast radius

**PGlite for Testing**
- Risk: PGlite (@electric-sql/pglite) is newer project for in-memory Postgres
- Impact: Potential bugs in PostgreSQL wire protocol emulation; feature gaps vs real Postgres
- Migration plan: Fallback to Docker-based test database (pg in container) if PGlite issues arise

**Neon Postgres Vendor Lock-In**
- Risk: Neon-specific connection pooling and features (attachDatabasePool from @vercel/functions)
- Impact: Migration to different PostgreSQL provider requires connection handling changes
- Migration plan: Standard pg driver works with any Postgres; only Vercel Fluid integration needs replacement

## Missing Critical Features

**No API Layer**
- Problem: Repository layer complete but no HTTP interface to consume it
- Blocks: External clients cannot create contexts or append messages
- Priority: High (Phase 5 planned)

**No Authentication/Authorization**
- Problem: No identity layer; all operations assume single-tenant
- Blocks: Multi-tenant use cases; production deployment without custom auth wrapper
- Priority: Medium (can deploy with API gateway auth)

**No Message Validation**
- Problem: Content and role validated only by TypeScript types, not at runtime
- Blocks: Invalid data from non-TypeScript clients can bypass validation
- Priority: Medium (add Zod schemas before API layer)

**No Rate Limiting**
- Problem: No request throttling on repository or API layer
- Blocks: Abuse protection; cost control for token-heavy operations
- Priority: Medium (add in API layer)

**No Observability**
- Problem: Limited logging; no structured metrics or tracing
- Blocks: Production debugging; performance monitoring; alerting
- Priority: Medium (add before production use)

## Test Coverage Gaps

**Database Client Initialization**
- What's not tested: Pool creation, Vercel Fluid attachment, error handler registration
- Files: `src/db/client.ts`
- Risk: Production connection issues not caught by tests
- Priority: Low (integration tested via health endpoint in production)

**Soft Delete Filtering Edge Cases**
- What's not tested: Queries that forget to use `notDeleted()` helper
- Files: `src/repositories/helpers.ts` (line 11)
- Risk: Deleted records leak into results if developer bypasses helper
- Priority: Low (linter rule could enforce usage)

**Repository Error Mapping**
- What's not tested: All PostgreSQL error codes (only 23505, 23503 covered)
- Files: `src/repositories/helpers.ts` (lines 22-42)
- Risk: Unexpected database errors return generic "DATABASE_ERROR" without useful context
- Priority: Medium (add error simulation tests)

**Pagination Cursor Edge Cases**
- What's not tested: Cursor pointing to deleted message, cursor beyond latest version
- Files: `src/repositories/message.repository.ts` (lines 82-114)
- Risk: Invalid cursors return unexpected results
- Priority: Medium (add explicit edge case tests)

**Token Budget Zero and Negative**
- What's not tested: Budget of exactly 0 or negative values
- Files: `src/repositories/message.repository.ts` (lines 118-150)
- Risk: Current code returns empty array for budget <= 0 (correct), but not explicitly tested
- Priority: Low (implicit coverage via existing test)

**Health Endpoint Response Format**
- What's not tested: Health endpoint JSON schema and HTTP status codes
- Files: `api/health.ts`
- Risk: Response format changes could break clients
- Priority: Medium (add integration tests in Phase 5)

**Migration Rollback**
- What's not tested: Ability to roll back migrations (drizzle-kit doesn't support rollback)
- Files: `src/db/migrations/`
- Risk: Bad migration requires manual SQL fix in production
- Priority: High (document rollback procedure; consider adding down migrations manually)

---

*Concerns audit: 2026-02-02*
