# Domain Pitfalls: PostgreSQL on Vercel Serverless

**Domain:** Adding PostgreSQL (Neon) with pgvector to Vercel serverless TypeScript project
**Researched:** 2026-01-29
**Confidence:** HIGH (verified via official Vercel/Neon docs, community issues, multiple sources)

---

## Critical Pitfalls

Mistakes that cause production outages, data loss, or major rewrites.

---

### Pitfall 1: Connection Pool Exhaustion Under Load

**What goes wrong:** Traffic spike hits your application. Vercel Fluid Compute scales up aggressively, creating 10+ concurrent function instances. Each instance creates its own connection pool with 5 connections. You now have 50+ connections attempting to hit a database with a 100-connection limit. Database starts rejecting connections with "too many connections" errors.

**Why it happens:**
- Vercel Fluid Compute scales execution units freely without waiting for resources
- Each serverless function instance creates its own in-process connection pool
- In-app pooling provides backpressure within a process but NOT across processes
- Aggregate connection count floods the database provider's hard limits

**Consequences:**
- `FATAL: too many connections for role` errors
- Cascading failures as healthy functions can't connect
- User-facing 500 errors during traffic spikes
- Bot scraping can trigger this even without real user traffic

**Prevention:**
1. **Use Neon's pooled connection string (PgBouncer):** Connect through `-pooler` endpoint, not direct
2. **Keep per-instance pool small:** Set `max: 2-3` connections per pool, not 5-10
3. **Use `@neondatabase/serverless` HTTP mode for Edge:** Eliminates connection overhead entirely
4. **Monitor connection usage:** Set up alerts for connection count approaching limits

**Detection:**
- Vercel logs showing connection timeout errors
- Neon dashboard showing connection count near limits
- Errors appearing during deployments or traffic spikes
- `FATAL: remaining connection slots are reserved` in logs

**Phase to address:** Database Integration phase - configure connection pooling from day one

**Sources:**
- [Vercel: Connection Pooling with Functions](https://vercel.com/kb/guide/connection-pooling-with-functions)
- [Vercel Blog: The real serverless compute to database connection problem](https://vercel.com/blog/the-real-serverless-compute-to-database-connection-problem-solved)
- [Postgres Connection Exhaustion with Vercel Fluid](https://www.solberg.is/vercel-fluid-backpressure)

---

### Pitfall 2: Connection Leaking on Function Suspension

**What goes wrong:** Your functions work fine under steady traffic. But after a deployment or traffic drop, "phantom" connections remain open. You see connection pool exhaustion without corresponding active traffic.

**Why it happens:**
- When serverless functions become idle, they're suspended in memory (not terminated)
- JavaScript timers (like pool idle timeout) don't run while suspended
- Connection cleanup never fires until VM eventually terminates (minutes later)
- 100% of old function instances leak connections after each deployment

**Consequences:**
- Connection limits reached with minimal active traffic
- Deployments cause temporary connection exhaustion
- Confusing metrics (high connections, low actual queries)
- Pooler-side timeouts eventually clean up but cause latency spikes

**Prevention:**
1. **Use Vercel Fluid Compute's `waitUntil`:** Keeps function alive long enough to close idle connections
2. **Use `attachDatabasePool` helper:** Vercel-provided pattern for proper connection lifecycle
3. **Set low idle timeouts:** 5-10 seconds, not 30+ seconds
4. **Prefer Neon's HTTP mode in Edge functions:** No persistent connections to leak

**Detection:**
- High connection count immediately after deployments
- Connections staying open longer than expected
- Discrepancy between Vercel function invocations and database connections

**Phase to address:** Database Integration phase - implement correct connection lifecycle patterns

**Sources:**
- [Vercel: Connection Pooling with Functions](https://vercel.com/kb/guide/connection-pooling-with-functions)
- [Neon: Connection Pooling](https://neon.com/docs/connect/connection-pooling)

---

### Pitfall 3: Using `drizzle-kit push` in Production

**What goes wrong:** You use `drizzle-kit push` during development (it's fast and convenient). Then you accidentally run it in production, or set up CI/CD to run push instead of migrate. Schema changes are applied without migration history, making rollbacks impossible.

**Why it happens:**
- `push` is designed for rapid prototyping, not production
- It directly modifies the database schema without creating migration files
- No audit trail of what changed when
- Developers get comfortable with push in development

**Consequences:**
- No way to roll back schema changes
- Schema drift between environments (prod doesn't match staging)
- Data loss if push decides to drop columns
- Deleted migration files mean Drizzle can't migrate old schema versions

**Prevention:**
1. **Development only:** Use `push` only for local development iteration
2. **Production:** Always use `drizzle-kit generate` + `drizzle-kit migrate`
3. **CI/CD guard:** Add check that `push` command never runs in production environment
4. **Transition early:** Move from push to migrate before first production deploy

**Detection:**
- `drizzle/migrations` folder is empty or stale
- Schema differences between environments
- Missing `_drizzle_migrations` table in database
- CI/CD scripts containing `push` command

**Phase to address:** Database Integration phase - establish migration workflow before any production data

**Sources:**
- [Drizzle ORM: Migrations](https://orm.drizzle.team/docs/migrations)
- [Drizzle ORM: push](https://orm.drizzle.team/docs/drizzle-kit-push)
- [3 Biggest Mistakes with Drizzle ORM](https://medium.com/@lior_amsalem/3-biggest-mistakes-with-drizzle-orm-1327e2531aff)

---

### Pitfall 4: HNSW Index Builds Exhausting Memory

**What goes wrong:** You add pgvector and create an HNSW index on your embeddings. The index build starts, consumes all available memory, and either OOMs the database or takes hours to complete on a small serverless instance.

**Why it happens:**
- HNSW indexes are memory-intensive: O(n * m * dim) space complexity
- Serverless database instances have limited memory
- `maintenance_work_mem` defaults may be too high or too low
- pgvector warns but doesn't stop: "hnsw graph no longer fits into maintenance_work_mem"

**Consequences:**
- Index build takes hours instead of minutes
- Database becomes unresponsive during build
- OOM kills terminate the build, leaving partial indexes
- Production queries slow to a crawl

**Prevention:**
1. **Start with IVFFlat:** Lower memory, faster builds, acceptable recall for most use cases
2. **Scale up for HNSW builds:** Use Neon's autoscaling - scale up, build, scale down
3. **Set appropriate `maintenance_work_mem`:** High enough for build speed, low enough to not OOM
4. **Build indexes during low-traffic periods:** Avoid production hours
5. **Consider `CREATE INDEX CONCURRENTLY`:** Doesn't lock table, but takes longer

**Detection:**
- pgvector NOTICE about index not fitting in maintenance_work_mem
- Extremely slow index creation times
- Database memory usage spiking
- Queries timing out during index builds

**Phase to address:** Vector Search phase - plan index strategy before loading significant data

**Sources:**
- [Neon: pgvector extension](https://neon.com/docs/extensions/pgvector)
- [AWS: Optimize pgvector indexing](https://aws.amazon.com/blogs/database/optimize-generative-ai-applications-with-pgvector-indexing-a-deep-dive-into-ivfflat-and-hnsw-techniques/)
- [PGVector: HNSW vs IVFFlat](https://medium.com/@bavalpreetsinghh/pgvector-hnsw-vs-ivfflat-a-comprehensive-study-21ce0aaab931)

---

## Moderate Pitfalls

Mistakes that cause delays, debugging sessions, or technical debt.

---

### Pitfall 5: Cold Start Latency Surprise

**What goes wrong:** First request after idle period takes 500ms-3000ms instead of expected 50ms. Users experience noticeable delays, especially on infrequently-accessed pages.

**Why it happens:**
- Neon databases "scale to zero" after inactivity
- Database cold start adds to serverless function cold start
- TCP connection establishment adds latency vs HTTP
- Vector index pages may not be in cache

**Consequences:**
- Poor user experience on first request
- Inconsistent performance metrics
- Timeout errors on Vercel free tier (10s limit)
- Users perceive application as slow/unreliable

**Prevention:**
1. **Use Neon's pooled connections:** PgBouncer maintains warm connections
2. **Consider keeping database warm:** Use scheduled pings for critical paths
3. **Use HTTP driver for latency-sensitive cold paths:** Trades throughput for startup time
4. **Prewarm vector indexes:** Use `pg_prewarm` after deploys for hot tables
5. **Set appropriate Vercel function timeout:** Allow for cold start in timeout budget

**Detection:**
- First request latency significantly higher than subsequent
- Latency spikes correlating with idle periods
- p99 latency much higher than p50
- Timeout errors without corresponding high load

**Phase to address:** Database Integration phase - choose connection strategy based on latency requirements

**Sources:**
- [Neon: Choosing your driver and connection type](https://neon.com/docs/connect/choose-connection)
- [Serverless database latency comparison](https://pilcrow.vercel.app/blog/serverless-database-latency)
- [Neon: Connection Pooling](https://neon.com/docs/connect/connection-pooling)

---

### Pitfall 6: Wrong Driver for Runtime Environment

**What goes wrong:** You use `pg` (node-postgres) in Vercel Edge Functions. Deployment fails or runtime errors occur because Edge doesn't support TCP connections.

**Why it happens:**
- Edge Functions use V8 isolates, not Node.js
- V8 isolates don't support TCP/WebSocket connections that outlive a request
- `pg` requires TCP connections
- Code works in local dev (Node.js) but fails on Edge

**Consequences:**
- Deployment failures with cryptic errors
- Runtime "cannot connect" errors
- Confusion between Edge and Serverless function types
- Wasted time debugging environment differences

**Prevention:**
1. **For Edge Functions:** Use `@neondatabase/serverless` with HTTP mode (fetch-based)
2. **For Node.js Serverless:** Either driver works, TCP (`pg`) often better performance
3. **Document function runtime:** Note which functions are Edge vs Serverless
4. **Test in preview deployments:** Catch runtime mismatches before production

**Detection:**
- Edge function deploy errors mentioning TCP/socket
- "This operation is not supported" in Edge runtime
- Works locally but fails on Vercel

**Phase to address:** Database Integration phase - choose correct driver per function type from start

**Sources:**
- [Neon: Serverless Driver](https://neon.com/docs/serverless/serverless-driver)
- [Neon: Edge-compatible Serverless Driver](https://neon.com/blog/serverless-driver-for-postgres)

---

### Pitfall 7: Missing Pooled Connection String

**What goes wrong:** You connect directly to the database instead of through the pooler. Everything works in development, but production fails under minimal concurrent load.

**Why it happens:**
- Neon provides two connection strings: direct and pooled
- Direct string looks the same, just missing `-pooler` in hostname
- Copy-paste error when setting environment variables
- Direct connections limited (e.g., 100) vs pooled (e.g., 10,000)

**Consequences:**
- Connection exhaustion at low traffic
- "too many connections" errors
- Confusing since it works fine locally
- Must update environment variables across all environments

**Prevention:**
1. **Always use pooled string:** Look for `-pooler` in the hostname
2. **Verify in Neon dashboard:** Copy from "Pooled connection" section
3. **Environment variable naming:** Use `DATABASE_URL_POOLED` to be explicit
4. **Add connection validation:** Log connection count on startup in development

**Detection:**
- Connection string hostname missing `-pooler`
- `POSTGRES_URL` vs `POSTGRES_URL_POOLED` confusion
- Low connection limits despite Neon tier having higher limits

**Phase to address:** Database Integration phase - use correct connection string from first integration

**Sources:**
- [Neon: Connection Pooling](https://neon.com/docs/connect/connection-pooling)
- [Neon: Connecting to Neon from Vercel](https://neon.com/docs/guides/vercel-connection-methods)

---

### Pitfall 8: Migrations Without Rollback Plan

**What goes wrong:** You run a migration that adds a NOT NULL column without default. Existing rows fail the constraint. Or you drop a column that code still references. Production breaks, and you have no rollback strategy.

**Why it happens:**
- DDL changes are not automatically reversible
- Drizzle generates forward migrations, not rollback scripts
- Testing on empty database misses existing data issues
- Pressure to ship without thinking through rollback

**Consequences:**
- Production downtime
- Data loss if columns dropped
- Manual SQL surgery to fix
- Broken deploys that can't roll back

**Prevention:**
1. **Snapshot before migrations:** Use Neon's branch/snapshot for recovery point
2. **Test migrations on prod data clone:** Use Neon branching to test against real data
3. **Use expandable migrations:** Add column nullable first, then make NOT NULL after backfill
4. **Consider pgroll:** Provides zero-downtime, reversible migrations
5. **Document rollback steps:** For each migration, document how to reverse

**Detection:**
- Migration fails with constraint violations
- Code errors after migration (missing columns)
- No `_drizzle_migrations` entries for rollback reference

**Phase to address:** Database Integration phase - establish migration safety practices before production data

**Sources:**
- [Neon: Promoting Postgres Changes Safely](https://neon.com/blog/promoting-postgres-changes-safely-production)
- [Neon: Zero downtime migrations with pgroll](https://neon.com/guides/pgroll)
- [Drizzle migrations to postgres in production](https://budivoogt.com/blog/drizzle-migrations)

---

### Pitfall 9: Environment Variable Misconfiguration

**What goes wrong:** `POSTGRES_URL` is set in Vercel dashboard, but deploy fails with "missing_connection_string" error. Or worse, staging accidentally connects to production database.

**Why it happens:**
- Vercel Postgres integration auto-creates variables, Neon integration may not
- Database must exist before deployment (build-time vs runtime)
- Preview deployments may use production database if not scoped correctly
- `POSTGRES_URL` vs `DATABASE_URL` naming inconsistency

**Consequences:**
- Failed deployments with cryptic errors
- Preview branches modifying production data
- Secret exposure if wrong scope selected
- Works in one environment, fails in another

**Prevention:**
1. **Create database before first deploy:** Build fails if DATABASE_URL not available
2. **Scope environment variables:** Production, Preview, Development separately
3. **Use Neon branching for previews:** Each preview gets isolated database branch
4. **Verify variables:** `vercel env ls` to confirm what's set
5. **Consistent naming:** Pick `DATABASE_URL` or `POSTGRES_URL` and stick with it

**Detection:**
- `VercelPostgresError - 'missing_connection_string'` errors
- Preview deployments showing production data
- Different behavior between `vercel dev` and deployed

**Phase to address:** Database Integration phase - configure env vars correctly before any deployment

**Sources:**
- [Vercel: Postgres connection problem](https://community.vercel.com/t/postgres-connection-problem/1160)
- [Neon: Connecting from Vercel](https://neon.com/docs/guides/vercel-connection-methods)

---

## Minor Pitfalls

Mistakes that cause annoyance but are quickly fixable.

---

### Pitfall 10: Forgetting SSL in Production

**What goes wrong:** Local development works without SSL. Production connection fails or is rejected due to missing SSL configuration.

**Why it happens:**
- Local Postgres often doesn't require SSL
- Production databases (especially cloud-hosted) require or strongly prefer SSL
- Drizzle/pg defaults may differ from production requirements

**Prevention:**
- Set `ssl: { rejectUnauthorized: true }` or `ssl: 'require'` in production config
- Use environment-aware SSL configuration
- Test with production connection string locally

**Detection:** Connection errors mentioning SSL/TLS in production only

**Phase to address:** Database Integration phase

---

### Pitfall 11: IVFFlat Index on Empty/Small Table

**What goes wrong:** You create an IVFFlat index before loading data. The index has poor recall because it was built with too few vectors to determine good centroids.

**Why it happens:**
- IVFFlat computes centroids at build time based on existing data
- Empty or small tables produce degenerate clusters
- Index doesn't automatically rebuild as data grows

**Prevention:**
- Load representative data before creating IVFFlat indexes
- Rebuild indexes after significant data changes
- Or use HNSW which doesn't have this limitation

**Detection:** Poor vector search recall despite correct queries

**Phase to address:** Vector Search phase

**Sources:**
- [Neon: pgvector extension](https://neon.com/docs/extensions/pgvector)

---

### Pitfall 12: Transactions Spanning Multiple Requests

**What goes wrong:** You try to hold a transaction open across multiple HTTP requests. The connection may be returned to pool or function suspended, breaking the transaction.

**Why it happens:**
- HTTP is stateless; each request may hit different function instance
- Connection pools reassign connections between requests
- Serverless functions suspend between requests

**Prevention:**
- Complete transactions within a single request
- Use optimistic locking instead of long transactions
- For multi-step operations, use saga pattern or idempotent operations

**Detection:** "transaction already committed/aborted" errors; inconsistent data states

**Phase to address:** Database Integration phase - design API for single-request transactions

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Database Integration | Connection pool exhaustion | Use pooled connection string, small per-instance pools |
| Database Integration | Connection leaking | Use `attachDatabasePool` with Fluid Compute |
| Database Integration | Wrong driver for Edge | Use `@neondatabase/serverless` for Edge functions |
| Database Integration | Missing env vars | Create database before first deploy |
| Migration Strategy | Using push in production | Establish generate+migrate workflow early |
| Migration Strategy | No rollback plan | Use Neon snapshots, test on branched data |
| Vector Search | HNSW OOM | Start with IVFFlat, scale up for HNSW builds |
| Vector Search | IVFFlat poor recall | Build index after loading representative data |
| Production Hardening | Cold start latency | Use pooled connections, consider prewarming |

---

## Quick Reference Checklist

Before deploying database integration:

- [ ] Using pooled connection string (hostname contains `-pooler`)
- [ ] Connection pool `max` is small (2-3, not 10+)
- [ ] Idle timeout is low (5-10 seconds)
- [ ] `attachDatabasePool` or equivalent pattern for connection lifecycle
- [ ] Correct driver for function type (Edge vs Serverless)
- [ ] Environment variables scoped per environment (prod/preview/dev)
- [ ] Database created before first deployment
- [ ] Using `drizzle-kit generate` + `migrate`, NOT `push` in production
- [ ] Migration rollback strategy documented
- [ ] Neon snapshot taken before migrations
- [ ] SSL configured for production
- [ ] Vector indexes planned for data volume (IVFFlat vs HNSW)
- [ ] Transactions complete within single request

---

## Sources Summary

**Official Documentation:**
- [Vercel: Connection Pooling with Functions](https://vercel.com/kb/guide/connection-pooling-with-functions)
- [Vercel Blog: The real serverless compute to database connection problem](https://vercel.com/blog/the-real-serverless-compute-to-database-connection-problem-solved)
- [Neon: Connection Pooling](https://neon.com/docs/connect/connection-pooling)
- [Neon: Serverless Driver](https://neon.com/docs/serverless/serverless-driver)
- [Neon: Choosing your driver and connection type](https://neon.com/docs/connect/choose-connection)
- [Neon: pgvector extension](https://neon.com/docs/extensions/pgvector)
- [Drizzle ORM: Migrations](https://orm.drizzle.team/docs/migrations)

**Community Issues & Analysis:**
- [Postgres Connection Exhaustion with Vercel Fluid](https://www.solberg.is/vercel-fluid-backpressure)
- [Serverless database latency comparison](https://pilcrow.vercel.app/blog/serverless-database-latency)
- [3 Biggest Mistakes with Drizzle ORM](https://medium.com/@lior_amsalem/3-biggest-mistakes-with-drizzle-orm-1327e2531aff)

**Guides & Best Practices:**
- [Neon: Promoting Postgres Changes Safely](https://neon.com/blog/promoting-postgres-changes-safely-production)
- [Neon: Zero downtime migrations with pgroll](https://neon.com/guides/pgroll)
- [AWS: Optimize pgvector indexing](https://aws.amazon.com/blogs/database/optimize-generative-ai-applications-with-pgvector-indexing-a-deep-dive-into-ivfflat-and-hnsw-techniques/)

---
---

# Domain Pitfalls: Context Policy Engine (Compaction, Forking, Time-Travel)

**Domain:** Adding policy engine features to existing context storage system
**Researched:** 2026-02-05
**Confidence:** HIGH (verified against official docs, research papers, existing schema analysis)

**Existing System Context:**
- Soft-delete for contexts (`deletedAt` timestamp)
- Versioned messages (sequential `version` per context)
- Token-budgeted windowing (`totalTokens` tracking)
- Fork tracking (`parentId`, `forkVersion` on contexts)
- CASCADE delete from contexts to messages

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or fundamental system failures.

---

### Pitfall 13: Compaction Destroys Critical Low-Entropy Details

**What goes wrong:** Summarization-based compaction treats all content equally, causing "low-entropy" details like file paths, tool call IDs, and version numbers to be discarded. The system tokens these items lower priority because they appear simple from an information-theoretic perspective, but they're exactly what the agent needs to continue work.

**Why it happens:** Generic summarization optimizes for compression ratio rather than task continuation. Factory.ai's research found that "file paths might be low-entropy from an information-theoretic perspective, but [are] exactly what the agent needs." OpenAI achieved 99.3% token reduction but scored 0.35 points lower on task quality, requiring expensive re-fetching that exceeded original savings.

**Consequences:**
- Agents re-read files they already examined
- Agents make conflicting edits to files they forgot modifying
- Agents lose track of test results and progress markers
- Context ID references become orphaned

**Warning signs:**
- Agents asking for clarification after compaction when they shouldn't need it
- Agents prematurely declaring tasks complete
- Increasing token usage despite compaction (re-fetching overhead)
- Duplicate tool calls in conversation history

**Prevention:**
1. **Preserve structured metadata separately from prose summary.** Keep a dedicated artifact index (files modified, tool calls made, version pointers) that survives compaction intact.
2. **Use probe-based evaluation** with four question types (recall, artifact, continuation, decision) rather than ROUGE/embedding similarity, which fail to measure functional continuation.
3. **Test with artificial compression frequency** (10-20% of window) during development to isolate mechanism failures early.

**Detection in existing system:**
The current `messages` table stores `toolCallId`, `toolName`, and `model` fields. Compaction must preserve these structured fields in a side index, not summarize them.

**Phase to address:** Compaction policy phase. Implement artifact tracking before building summarization.

**Sources:**
- [Factory.ai: Evaluating Context Compression for AI Agents](https://factory.ai/news/evaluating-compression)
- [Google ADK: Context Compaction](https://google.github.io/adk-docs/context/compaction/)

---

### Pitfall 14: Fork Reference Loss on Parent Deletion

**What goes wrong:** When a parent context is soft-deleted, forked children lose the ability to reconstruct their full history. The current schema uses `SET NULL` on delete for `parentId`, which preserves the child but orphans the lineage.

**Why it happens:** The schema correctly prevents cascading deletes (children should survive parent deletion), but doesn't preserve enough information to reconstruct the fork point. After parent deletion, `forkVersion` points to a version that no longer exists in an accessible context.

**Consequences:**
- Time-travel queries on forked contexts fail at the fork boundary
- Message history reconstruction becomes impossible for pre-fork messages
- Audit trails break when tracing conversation lineage
- Orphaned data accumulates with no cleanup path

**Warning signs:**
- `findById` returns null when following `parentId`
- `forkVersion` points to non-existent version in parent
- Growing count of contexts where `parentId IS NULL AND forkVersion IS NOT NULL`

**Prevention:**
1. **Copy pre-fork messages to child at fork time** rather than reference them. This is copy-on-write semantics at the message level.
2. **Alternatively, preserve parent messages even when parent is soft-deleted** by only allowing full deletion after all children are deleted.
3. **Add `forkSourceDeleted` boolean** to track when parent was deleted, enabling graceful degradation.

**Detection in existing system:**
Query for inconsistent state:
```sql
SELECT * FROM contexts WHERE parent_id IS NULL AND fork_version IS NOT NULL
```

**Phase to address:** Forking phase. Decision on copy-on-write vs reference semantics must be made before implementing fork operations.

**Sources:**
- [LibreChat: Forking Messages and Conversations](https://www.librechat.ai/docs/features/fork)
- [Hypirion: Implementing System-Versioned Tables in Postgres](https://hypirion.com/musings/implementing-system-versioned-tables-in-postgres)

---

### Pitfall 15: Version Counter Conflicts After Compaction

**What goes wrong:** When forking a context, the child inherits `latestVersion` from the parent at fork time. If compaction later renumbers or consolidates messages in either context, version references in external systems break.

**Why it happens:** The current system uses `latestVersion` as a monotonically increasing counter per context. This works for single-context scenarios but creates problems when:
- External systems store `(contextId, version)` tuples as references
- Compaction consolidates multiple messages into summaries
- Time-travel queries need to map "logical version" to "physical version"

**Consequences:**
- External systems holding version references get 404s after compaction
- Cursor-based pagination breaks when versions are renumbered
- Fork comparison features become impossible (can't diff parent/child when versions drift)

**Warning signs:**
- `findByVersion` returning null for versions that should exist
- Pagination cursors becoming invalid unexpectedly
- Inconsistent `messageCount` vs actual message count after compaction

**Prevention:**
1. **Never renumber versions.** Treat version as immutable identity, not sequential ordering.
2. **Use gaps in version sequence** for compacted messages rather than consolidation.
3. **Add `compactedIntoVersion`** field to soft-deleted compacted messages, preserving audit trail.
4. **Store both `logicalVersion` and `physicalVersion`** if renumbering is required.

**Detection in existing system:**
The unique constraint `messages_context_version_unique` prevents version reuse but doesn't prevent gaps. The `FOR UPDATE` lock in `append()` protects against concurrent version assignment but doesn't address compaction scenarios.

**Phase to address:** Compaction phase. Version semantics must be locked down before any compaction implementation.

**Sources:**
- [Chris Kiehl: Event Sourcing is Hard](https://chriskiehl.com/article/event-sourcing-is-hard)
- [Hypirion: Implementing System-Versioned Tables in Postgres](https://hypirion.com/musings/implementing-system-versioned-tables-in-postgres)

---

### Pitfall 16: Token Count Drift Across Models

**What goes wrong:** The existing system stores `tokenCount` per message and uses `getByTokenBudget()` for windowing. However, token counts vary significantly between models. A budget of 4000 tokens calculated with GPT-4's tokenizer will be wrong for Claude, which tokenizes differently.

**Why it happens:** Tokenization is model-specific:
- Non-Latin scripts inflate token counts on some models
- Code with special characters tokenizes inconsistently
- The "1 token = 4 characters" heuristic fails for structured data
- Different model versions (GPT-4 vs GPT-4o) use different tokenizers

**Consequences:**
- Token budgets that work for one model cause truncation on another
- Compaction triggers at wrong thresholds
- Context window overflow or underutilization
- Inconsistent behavior when switching models mid-conversation

**Warning signs:**
- API errors about context length exceeded despite budget compliance
- Wasted context capacity (budgeted 4K, only used 2K)
- `model` field in messages shows multiple different models

**Prevention:**
1. **Store tokenizer identifier alongside tokenCount**, not just raw count.
2. **Provide re-tokenization capability** for budget calculations when model changes.
3. **Use conservative estimates** (pad by 10-20%) for cross-model scenarios.
4. **Document that `tokenCount` is advisory**, not authoritative.

**Detection in existing system:**
The current `messages.model` field exists but `tokenCount` has no associated tokenizer. Budget queries assume homogeneous tokenization.

**Phase to address:** First phase where token budgeting is used cross-model. May require schema migration to add `tokenizer` field.

**Sources:**
- [Winder.ai: Calculating Token Counts](https://winder.ai/calculating-token-counts-llm-context-windows-practical-guide/)
- [Chroma Research: Context Rot](https://research.trychroma.com/context-rot)

---

### Pitfall 17: Time-Travel Queries Return Inconsistent State

**What goes wrong:** Point-in-time queries on temporal data return inconsistent state when using `CLOCK_TIMESTAMP()` instead of `NOW()` for versioning. Multi-row inserts (like batch message append) generate different timestamps per row, making reconstruction at arbitrary past moments unreliable.

**Why it happens:** PostgreSQL's `CLOCK_TIMESTAMP()` returns actual current time, advancing between rows in a batch. `NOW()` returns transaction start time, which is stable within a transaction but prevents seeing changes made earlier in the same transaction.

**Consequences:**
- Batch-inserted messages have different `createdAt` timestamps
- Point-in-time reconstruction may include partial batches
- Audit queries return inconsistent snapshots
- Fork-point reconstruction gets wrong set of messages

**Warning signs:**
- Messages from same `append()` call have different `createdAt` values
- Time-travel query for 12:00:00.500 includes some but not all messages inserted at "12:00:00"
- Forked context appears to have messages the parent didn't have at fork time

**Prevention:**
1. **Use transaction timestamp** (`NOW()`) for all messages in a batch, not wall-clock time.
2. **Add explicit `batchId`** or `transactionId` to group atomically-inserted messages.
3. **Use version-based time-travel** (not timestamp-based) as primary mechanism.
4. **Document that `createdAt` is approximate**, not precise boundary.

**Detection in existing system:**
Current `append()` uses `createdAt: timestamp().defaultNow()` which uses `NOW()` at insert time. Verify this behavior under batch inserts. The `version` field provides reliable ordering.

**Phase to address:** Time-travel phase. Clarify semantics before implementing point-in-time queries.

**Sources:**
- [Hypirion: Implementing System-Versioned Tables in Postgres](https://hypirion.com/musings/implementing-system-versioned-tables-in-postgres)
- [Microsoft: Temporal Tables in SQL Server](https://learn.microsoft.com/en-us/sql/relational-databases/tables/temporal-tables)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or degraded user experience.

---

### Pitfall 18: Compaction Loops from Circular Event Dependencies

**What goes wrong:** A compaction event triggers updates to context metadata, which triggers another compaction evaluation, creating infinite loops that consume resources.

**Why it happens:** Event-driven architectures can create cycles:
- Compaction updates `totalTokens` (context modified)
- Modified context triggers compaction policy re-evaluation
- Policy sees modified context and runs compaction
- Repeat

**Consequences:**
- Resource exhaustion (CPU, database connections)
- Deadlocks in transaction-heavy implementations
- Silent failures when circuit breakers trip
- Inconsistent state if loop terminates mid-cycle

**Warning signs:**
- Compaction jobs that never complete
- Database connection pool exhaustion during compaction
- Multiple compaction records for same time window

**Prevention:**
1. **Explicit loop guards**: Track "compaction in progress" state per context.
2. **Separate compaction metadata updates** from content updates in policy evaluation.
3. **Use idempotent compaction**: Same input always produces same output, no retrigger.
4. **Add rate limiting**: Maximum one compaction per context per time window.

**Phase to address:** Compaction policy phase. Add guards before implementing any triggered compaction.

**Sources:**
- [Kite Metric: Event Sourcing Fails](https://kitemetric.com/blogs/event-sourcing-fails-5-real-world-lessons)

---

### Pitfall 19: Soft-Delete Unique Constraint Violations

**What goes wrong:** Current schema has no unique constraints on context `name`, but future features might need uniqueness (e.g., named branches, workspace contexts). Standard unique indexes don't differentiate between active and soft-deleted rows.

**Why it happens:** A regular unique index includes deleted rows. If user creates "project-A" context, deletes it, then tries to create new "project-A" context, the constraint fails.

**Consequences:**
- Users cannot reuse names after deletion
- Confusing error messages ("name already exists" for deleted items)
- Workarounds (appending timestamps) pollute namespace
- Application-level uniqueness checks introduce race conditions

**Warning signs:**
- Constraint violations when creating contexts with "deleted" names
- Growing list of contexts with timestamp-suffixed names
- Duplicate active contexts (if app-level check has race condition)

**Prevention:**
1. **Use PostgreSQL partial indexes**:
   ```sql
   CREATE UNIQUE INDEX uq_contexts_name_active ON contexts (name)
   WHERE deleted_at IS NULL;
   ```
2. **Design uniqueness requirements early**, before data accumulates.
3. **Keep constraint enforcement in database**, not application layer.

**Detection in existing system:**
No unique constraints on `name` currently. Safe for now, but consider before adding named-context features.

**Phase to address:** Any phase adding named/unique context identifiers.

**Sources:**
- [DEV Community: Why Soft Delete Can Backfire on Data Consistency](https://dev.to/mrakdon/why-soft-delete-can-backfire-on-data-consistency-4epl)
- [Cultured Systems: Avoiding the Soft Delete Anti-Pattern](https://www.cultured.systems/2024/04/24/Soft-delete/)

---

### Pitfall 20: Lost-in-the-Middle Effect After Compaction

**What goes wrong:** LLMs weigh the beginning and end of prompts more heavily (primacy and recency bias). Compaction that places summarized content in the middle of context loses important information to attention degradation.

**Why it happens:** Research from Chroma shows that "even when your content fits within the allowed token count, you can still face problems like the lost-in-the-middle effect." Critical context placed in the middle may be undervalued regardless of token budget compliance.

**Consequences:**
- Agent ignores summarized historical context
- Early decisions forgotten despite being in summary
- Inconsistent behavior based on summary position
- False impression that compaction "worked" when agent actually lost track

**Warning signs:**
- Agent behavior differs based on where summary appears in context
- Agent re-asks questions whose answers are in summary
- Agent contradicts decisions documented in summary

**Prevention:**
1. **Place critical information in first 25%** of reconstructed context.
2. **Structure summaries with "current state" first**, history second.
3. **Test with summary at different positions** to validate attention patterns.
4. **Use structured extraction** (key-value pairs) over prose summaries for critical data.

**Phase to address:** Compaction policy phase. Inform summary format and positioning decisions.

**Sources:**
- [Chroma Research: Context Rot](https://research.trychroma.com/context-rot)
- [Getmaxim: Context Window Management Strategies](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/)

---

### Pitfall 21: Cumulative Compression Loss Across Multiple Cycles

**What goes wrong:** Each compression cycle introduces information loss. Over long-running conversations, regenerating summaries from scratch (rather than incrementally merging) causes gradual detail drift where early context becomes increasingly distorted.

**Why it happens:** Factory.ai found that "regenerating summaries from scratch rather than incrementally merging causes gradual detail drift across multiple compressions." Each summarization introduces approximation errors that compound.

**Consequences:**
- Early conversation context becomes increasingly inaccurate
- Agent personality/preferences drift over time
- User instructions from early in conversation ignored
- Impossible to distinguish summary drift from intentional changes

**Warning signs:**
- Agent behavior changes over long conversations
- Early user instructions no longer reflected in agent responses
- Growing disconnect between filesystem archive and in-context summary

**Prevention:**
1. **Incremental merging**: Update summaries rather than regenerate.
2. **Anchor critical facts**: Preserve exact quotes for important instructions.
3. **Version summaries**: Track summary lineage for debugging.
4. **Periodic validation**: Compare summary against full history.

**Phase to address:** Compaction policy phase. Critical for long-running agent scenarios.

**Sources:**
- [Factory.ai: Evaluating Context Compression for AI Agents](https://factory.ai/news/evaluating-compression)
- [LangChain: Context Management for Deep Agents](https://blog.langchain.com/context-management-for-deepagents/)

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable without major rework.

---

### Pitfall 22: Fork Depth Explosion

**What goes wrong:** Unlimited forking creates deeply nested trees that become impossible to navigate or reason about. Users lose track of which branch contains which experiments.

**Why it happens:** Git-like branching patterns applied to conversations create same problems as git branch explosion: "When you're three branches deep into different ideas, it becomes hard to remember how you got there."

**Consequences:**
- Confusing navigation for users
- Performance degradation on deep ancestor queries
- Storage growth from abandoned branches
- No clear "main" lineage

**Prevention:**
1. **Limit fork depth** (configurable, default 3-5 levels).
2. **Encourage pruning**: Auto-archive inactive branches.
3. **Visualize lineage**: Provide tree view for navigation.
4. **Support merge/rebase** for consolidating branches.

**Phase to address:** Forking phase. UX decision, not critical for MVP.

**Sources:**
- [Martin Fowler: Patterns for Managing Source Code Branches](https://martinfowler.com/articles/branching-patterns.html)

---

### Pitfall 23: Compaction Timing During Active Conversation

**What goes wrong:** Triggering compaction while user is actively conversing creates jarring experience as context shifts mid-conversation.

**Why it happens:** Threshold-based compaction doesn't account for conversation state. Reaching 80% capacity triggers compaction regardless of whether user is mid-thought.

**Consequences:**
- Agent loses track of in-progress reasoning
- User confusion when agent "forgets" recent context
- Potential for lost partial tool outputs

**Prevention:**
1. **Debounce compaction**: Wait for conversation pause.
2. **Never compact mid-tool-execution**: Track tool call open/close.
3. **Warn before compacting**: Give agent/user heads-up.
4. **Async background compaction** with snapshot isolation.

**Phase to address:** Compaction policy phase. UX polish.

**Sources:**
- [Google ADK: Context Compaction](https://google.github.io/adk-docs/context/compaction/)

---

### Pitfall 24: Inconsistent Deletion Semantics Across Layers

**What goes wrong:** Messages use `CASCADE` delete on context deletion, but contexts use soft-delete. This means soft-deleting a context leaves all messages intact (correct), but hard-deleting a context removes all messages permanently (may violate audit requirements).

**Why it happens:** Current schema design: contexts have `deletedAt` (soft), messages reference contexts with `onDelete: "cascade"` (hard). The cascade only triggers on actual DELETE, not soft-delete, so current behavior is correct. But if anyone ever hard-deletes a context, messages disappear.

**Consequences:**
- Accidental hard delete permanently destroys conversation history
- No path to recover messages if context is hard-deleted
- Inconsistent mental model for operators

**Prevention:**
1. **Never expose hard delete** in repository API.
2. **Add soft-delete to messages** for explicit message removal.
3. **Implement retention policy** for periodic hard-delete cleanup with clear warnings.
4. **Archive messages before context hard-delete** if audit requirements exist.

**Detection in existing system:**
`ContextRepository` only implements `softDelete()`, not hard delete. Safe as long as no one adds hard delete capability.

**Phase to address:** Data retention phase. Document deletion semantics clearly.

**Sources:**
- [Blog.bemi.io: The Day Soft Deletes Caused Chaos](https://blog.bemi.io/soft-deleting-chaos/)

---

## Phase-Specific Warnings: Policy Engine

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Compaction policies | Artifact/metadata loss (#13) | Build artifact index before summarization |
| Compaction policies | Cumulative drift (#21) | Incremental merge, version summaries |
| Compaction policies | Wrong timing (#23) | Debounce, pause detection |
| Compaction policies | Loop guards (#18) | Track compaction-in-progress state |
| Forking | Parent deletion orphans (#14) | Copy-on-write or preserve deleted parents |
| Forking | Version conflicts (#15) | Immutable version identity |
| Forking | Depth explosion (#22) | Depth limits, visualization |
| Time-travel | Inconsistent snapshots (#17) | Transaction timestamps, version-based queries |
| Time-travel | Soft-delete interaction (#24) | Clarify deletion semantics |
| Cross-cutting | Token count drift (#16) | Store tokenizer info, conservative budgets |
| Cross-cutting | Unique constraints (#19) | Partial indexes for soft-delete columns |

---

## Integration Warnings for Existing System

The current Kata Context system has specific integration points to watch:

1. **`append()` with FOR UPDATE lock**: Compaction must respect this lock or risk version conflicts.

2. **`getByTokenBudget()` traverses all messages**: Compaction should reduce this set, but version gaps must not break pagination.

3. **`forkVersion` on contexts**: Compaction must not remove the message at `forkVersion` or fork reconstruction breaks.

4. **Cascade delete on messages**: Any hard-delete of contexts bypasses soft-delete semantics for messages.

5. **`totalTokens` counter on context**: Compaction that removes messages must update this counter atomically.

---

## Quick Reference Checklist: Policy Engine Features

Before implementing compaction:

- [ ] Artifact index designed (files, tool calls, version refs survive compaction)
- [ ] Version semantics locked (never renumber, use gaps)
- [ ] Loop guards in place (compaction-in-progress tracking)
- [ ] Token budget accounts for tokenizer variance
- [ ] Summary positioning tested (not lost-in-the-middle)
- [ ] Incremental merge strategy chosen (not regenerate from scratch)
- [ ] Compaction timing debounced (not mid-conversation)

Before implementing forking:

- [ ] Copy-on-write vs reference semantics decided
- [ ] Parent deletion handling specified (`forkSourceDeleted` or copy messages)
- [ ] Fork depth limits set
- [ ] Orphan detection query ready

Before implementing time-travel:

- [ ] Timestamp vs version-based queries chosen
- [ ] Batch insert consistency verified (same `createdAt` within transaction)
- [ ] Soft-delete visibility in time-travel specified
- [ ] Fork boundary behavior documented

---

## Sources Summary: Policy Engine

**Context Compression:**
- [Factory.ai: Evaluating Context Compression for AI Agents](https://factory.ai/news/evaluating-compression)
- [Google ADK: Context Compaction](https://google.github.io/adk-docs/context/compaction/)
- [LangChain: Context Management for Deep Agents](https://blog.langchain.com/context-management-for-deepagents/)
- [Chroma Research: Context Rot](https://research.trychroma.com/context-rot)

**Database Temporal/Versioning:**
- [Hypirion: Implementing System-Versioned Tables in Postgres](https://hypirion.com/musings/implementing-system-versioned-tables-in-postgres)
- [Microsoft: Temporal Tables in SQL Server](https://learn.microsoft.com/en-us/sql/relational-databases/tables/temporal-tables)

**Soft Delete:**
- [DEV Community: Why Soft Delete Can Backfire on Data Consistency](https://dev.to/mrakdon/why-soft-delete-can-backfire-on-data-consistency-4epl)
- [Cultured Systems: Avoiding the Soft Delete Anti-Pattern](https://www.cultured.systems/2024/04/24/Soft-delete/)

**Event Sourcing:**
- [Chris Kiehl: Event Sourcing is Hard](https://chriskiehl.com/article/event-sourcing-is-hard)
- [Kite Metric: Event Sourcing Fails - 5 Real-World Lessons](https://kitemetric.com/blogs/event-sourcing-fails-5-real-world-lessons)

**Forking/Branching:**
- [LibreChat: Forking Messages and Conversations](https://www.librechat.ai/docs/features/fork)
- [Martin Fowler: Patterns for Managing Source Code Branches](https://martinfowler.com/articles/branching-patterns.html)
