# External Integrations

**Analysis Date:** 2026-02-02

## APIs & External Services

**Vercel Platform:**
- Vercel Serverless Functions - Deployment platform
  - SDK/Client: `@vercel/functions` 3.4.0
  - Features: `attachDatabasePool` for database connection lifecycle management under Vercel Fluid
  - Detection: `process.env.VERCEL` environment variable
  - Config: `vercel.json` with build command and output directory

**OpenAI (Planned):**
- OpenAI Embeddings API (not yet implemented)
  - Purpose: Message vector embeddings for semantic search
  - Vector dimensions: 1536 (text-embedding-3-small model)
  - Storage: `messages.embedding` column (pgvector)

## Data Storage

**Databases:**
- Neon PostgreSQL (Production)
  - Connection: `DATABASE_URL` environment variable
  - Client: Drizzle ORM with `node-postgres` (pg) 8.14.1
  - Connection pooling: Required (`-pooler` hostname suffix)
  - Pool settings: max 3 connections, 5s idle timeout, 10s connection timeout
  - Required extensions: pgvector (for 1536-dimension embeddings)

- PGlite (Testing Only)
  - In-memory PostgreSQL database via `@electric-sql/pglite`
  - Extensions: vector (pgvector support)
  - Setup: `vitest.setup.ts` with automatic migration execution

**Connection Management:**
- Production: Vercel Fluid lifecycle via `attachDatabasePool(pool)` in `src/db/client.ts`
- Pool error handling: Registered error handler prevents unhandled promise rejections
- Validation: Enforces `-pooler` connection string in production (throws error if missing)

**File Storage:**
- Local filesystem only (no external storage integration)

**Caching:**
- None (direct database queries only)

## Authentication & Identity

**Auth Provider:**
- Not implemented (no authentication layer in v0.1.0)
  - Implementation: Framework-agnostic design allows consumer to add auth

## Monitoring & Observability

**Error Tracking:**
- Console logging only
  - Database pool errors: `console.error` with timestamp
  - Health check failures: `console.error` with full error details

**Logs:**
- Console-based logging via standard `console.log`, `console.warn`, `console.error`
- Database client warnings for non-pooled connections in development

**Health Monitoring:**
- Health endpoint: `api/health.ts`
  - Route: `/api/health` (Vercel serverless function)
  - Checks: Database connectivity via `SELECT 1`
  - Metrics: Latency measurement, pooled connection detection
  - Responses: 200 (healthy), 503 (unhealthy)

## CI/CD & Deployment

**Hosting:**
- Vercel Platform
  - Build: `pnpm run build` (TypeScript compilation)
  - Output: `public/` directory
  - Functions: `api/` directory (serverless functions)

**CI Pipeline:**
- Git hooks via Husky 9.1.7
  - Pre-commit: `lint-staged` runs Biome checks on staged files
  - Formats: `*.{js,ts,jsx,tsx,json,jsonc}`
  - Command: `biome check --write --no-errors-on-unmatched --files-ignore-unknown=true`

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string (must include `-pooler` in production)

**Optional env vars:**
- `ENABLE_EXPERIMENTAL_COREPACK` - Set to `1` for Vercel pnpm 10 support
- `npm_package_version` - Auto-populated by Node.js, used in health check response

**Secrets location:**
- `.env.local` (gitignored) for local development
- Vercel Environment Variables UI for production/preview deployments

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Database Extensions

**pgvector:**
- Purpose: Vector similarity search for message embeddings
- Dimensions: 1536 (OpenAI text-embedding-3-small)
- Column: `messages.embedding` (vector type)
- Status: Schema ready, embedding generation not yet implemented

## Platform-Specific Features

**Vercel Fluid:**
- Database connection lifecycle managed via `attachDatabasePool` from `@vercel/functions`
- Ensures connections close before function suspension to prevent connection exhaustion
- Only active when `process.env.VERCEL` is set (disabled in local development)

**Connection String Validation:**
- Production check: Verifies `-pooler` in `DATABASE_URL` to prevent connection exhaustion
- Throws error in Vercel environment if validation fails
- Logs warning only in local development

---

*Integration audit: 2026-02-02*
