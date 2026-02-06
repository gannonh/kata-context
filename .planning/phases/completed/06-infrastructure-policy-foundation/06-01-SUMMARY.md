# Phase 6 Plan 01: Infrastructure Dependencies and Schema Extensions Summary

**One-liner:** gpt-tokenizer installed, policy config Zod schema with defaults, 3 new nullable columns on contexts/messages, migration verified against PGlite.

## Frontmatter

- **Phase:** 06-infrastructure-policy-foundation
- **Plan:** 01
- **Subsystem:** data-layer / validation
- **Tags:** gpt-tokenizer, drizzle, jsonb, zod, migration, schema

### Dependency Graph

- **Requires:** Phase 3 (database foundation), Phase 4 (repository layer)
- **Provides:** Token counting utility, policy validation schema, schema columns for policy config and compaction tracking
- **Affects:** Phase 6 Plan 02 (policy engine logic), Phase 7 (forking), Phase 8 (compaction core)

### Tech Tracking

- **tech-stack.added:** gpt-tokenizer 3.4.0
- **tech-stack.patterns:** Typed JSONB columns with `.$type<T>()`, Zod schema with field-level defaults for JSONB validation

### File Tracking

**Created:**
- `src/token-counting/index.ts` - Token counting wrapper (countMessageTokens)
- `src/validation/policy.ts` - Policy config Zod schema, types, defaults, resolver
- `src/db/migrations/0002_sturdy_post.sql` - Migration adding 3 columns

**Modified:**
- `package.json` - Added gpt-tokenizer dependency
- `pnpm-lock.yaml` - Lock file updated
- `src/db/schema/contexts.ts` - Added policyConfig JSONB column
- `src/db/schema/messages.ts` - Added compactedAt and compactedIntoVersion columns

### Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | PolicyConfig type defined in validation module, imported by schema | Single source of truth via Zod inference; schema uses `.$type<PolicyConfig>()` |
| 2 | All 3 new columns are nullable | NULL means "use system defaults" for policy; NULL means "not compacted" for messages; avoids backfill |
| 3 | Application-layer defaults via Zod, not SQL DEFAULT | SQL DEFAULT cannot merge partial objects; Zod `.default()` handles partial input |

### Metrics

- **Duration:** ~2 minutes
- **Completed:** 2026-02-06
- **Tasks:** 2/2
- **Tests:** 146 passed (all existing, unchanged)

## Task Summary

### Task 1: Install gpt-tokenizer, create token counting utility and policy validation module
- Installed gpt-tokenizer 3.4.0
- Created `src/token-counting/index.ts` exporting `countMessageTokens`
- Created `src/validation/policy.ts` exporting `policyConfigSchema`, `PolicyConfig`, `DEFAULT_POLICY`, `resolvePolicy`
- Verified: `resolvePolicy({})` returns `{ threshold: 0.8, preserveRecentCount: 10, enabled: true }`
- Verified: `resolvePolicy({ threshold: 0.5 })` correctly merges with defaults
- **Commit:** d732d72

### Task 2: Extend database schema with new columns and generate migration
- Added `policyConfig` JSONB column to contexts table (typed as `PolicyConfig`)
- Added `compactedAt` timestamp and `compactedIntoVersion` bigint to messages table
- Generated migration `0002_sturdy_post.sql` with 3 additive ALTER TABLE statements
- No UPDATE/backfill statements in migration
- All 146 existing tests pass with new migration applied via PGlite
- **Commit:** 4155e13

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed import path for PolicyConfig in contexts schema**
- **Found during:** Task 2
- **Issue:** Plan specified `import from "../validation/policy.js"` but `contexts.ts` is in `src/db/schema/`, requiring `../../validation/policy.js`
- **Fix:** Corrected import path to `../../validation/policy.js`
- **Files modified:** `src/db/schema/contexts.ts`
- **Commit:** 4155e13

## Verification Results

1. `pnpm build` compiles with zero errors
2. `pnpm test` passes with all 146 tests green
3. `pnpm lint` passes (pre-existing warnings only, no new issues)
4. Migration file `0002_sturdy_post.sql` contains only additive ALTER TABLE statements
5. No backfill UPDATE statements in migration

## Next Phase Readiness

Plan 02 can proceed. All infrastructure is in place:
- `countMessageTokens` available for token counting in compaction logic
- `policyConfigSchema` and `resolvePolicy` available for validating policy config on context create/update
- Schema columns ready for repository layer updates (policyConfig on contexts, compaction columns on messages)
