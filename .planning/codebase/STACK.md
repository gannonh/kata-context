# Technology Stack

**Analysis Date:** 2026-02-02

## Languages

**Primary:**
- TypeScript 5.9.3 - All source code in `src/`, `api/`, configuration files

**Secondary:**
- SQL - Database schema migrations in `src/db/migrations/`

## Runtime

**Environment:**
- Node.js >= 20.0.0 (enforced in `package.json` engines)
- Current development environment: Node.js 23.6.0

**Package Manager:**
- pnpm 10.15.0 (pinned via `packageManager` field)
- Lockfile: `pnpm-lock.yaml` present
- Requires experimental corepack for Vercel deployment (`ENABLE_EXPERIMENTAL_COREPACK=1`)

## Frameworks

**Core:**
- Drizzle ORM 0.45.1 - PostgreSQL ORM with type-safe schema definitions and migrations
- Node.js pg (postgres) 8.14.1 - Low-level PostgreSQL client with connection pooling

**Testing:**
- Vitest 4.0.17 - Test runner with Node environment, coverage via v8 provider
- PGlite 0.3.15 - In-memory PostgreSQL database for testing (includes pgvector extension)

**Build/Dev:**
- TypeScript Compiler (tsc) - Standard `pnpm build` and `pnpm dev` (watch mode)
- tsx 4.21.0 - TypeScript execution for dev server (`scripts/dev-server.ts`) and drizzle-kit commands
- Biome 2.3.11 - Unified linter and formatter (replaces ESLint + Prettier)
- Drizzle Kit 0.31.8 - Migration generation and database management CLI
- Husky 9.1.7 + lint-staged 16.2.7 - Pre-commit hooks for code quality

## Key Dependencies

**Critical:**
- `@vercel/functions` 3.4.0 - Serverless function utilities, provides `attachDatabasePool` for Vercel Fluid lifecycle management
- `drizzle-orm` 0.45.1 - Type-safe database access layer with PostgreSQL dialect
- `pg` 8.14.1 - PostgreSQL client with connection pooling

**Infrastructure:**
- `@electric-sql/pglite` 0.3.15 - In-memory Postgres for tests, includes vector extension for pgvector support
- `drizzle-kit` 0.31.8 - Schema-to-migration generator, database push/pull, Studio UI

## Configuration

**Environment:**
- Configuration via `.env` files (`.env`, `.env.local`, `.env.example`, `.env.development.local`)
- Required: `DATABASE_URL` - PostgreSQL connection string (must include `-pooler` for production)
- Optional: `ENABLE_EXPERIMENTAL_COREPACK=1` - Required for Vercel deployment with pnpm 10

**Build:**
- `tsconfig.json` - TypeScript compiler config (ES2023, NodeNext modules, strict mode)
- `vitest.config.ts` - Test configuration (Node environment, coverage settings)
- `drizzle.config.ts` - Database schema and migration paths
- `biome.json` - Code formatting and linting rules
- `vercel.json` - Vercel deployment configuration (build command, output directory)

**TypeScript Configuration:**
- Target: ES2023
- Module system: NodeNext (ESM with `.js` extensions in imports)
- Strict mode enabled with `noUncheckedIndexedAccess`
- Output: `dist/` directory with declaration maps and source maps

## Platform Requirements

**Development:**
- Node.js >= 20.0.0
- pnpm 10.15.0
- PostgreSQL database (Neon recommended) OR no database needed for testing (uses PGlite)

**Production:**
- Vercel Serverless Functions (platform detected via `process.env.VERCEL`)
- Neon PostgreSQL with pooled connection endpoint (hostname must contain `-pooler`)
- Database must support pgvector extension (1536 dimensions for OpenAI embeddings)

---

*Stack analysis: 2026-02-02*
