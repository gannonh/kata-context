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
