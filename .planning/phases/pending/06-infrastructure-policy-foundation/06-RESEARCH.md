# Phase 6: Infrastructure + Policy Foundation - Research

**Researched:** 2026-02-06
**Domain:** Token counting, JSONB schema extensions, policy configuration validation
**Confidence:** HIGH

## Summary

Phase 6 adds two infrastructure dependencies (gpt-tokenizer for token counting, JSONB column for policy storage) and two compaction tracking columns to messages. The existing codebase uses Drizzle ORM with PostgreSQL, PGlite for testing, Zod 4 for validation, and follows a repository pattern with soft-delete semantics.

The standard approach: add `gpt-tokenizer` as a production dependency, extend the Drizzle schema with new columns (`policy_config` JSONB on contexts, `compacted_at`/`compacted_into_version` on messages), generate a migration via `drizzle-kit generate`, define a Zod 4 schema for policy config validation with defaults, and update the repository layer to accept/return policy config.

**Primary recommendation:** Use `gpt-tokenizer` default import (o200k_base encoding) for token counting. Define policy config as a typed JSONB column with `.$type<>()` in Drizzle and validate with Zod 4's `.default()` at the application layer rather than relying on SQL defaults for the full object.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| gpt-tokenizer | 3.x | BPE token counting for OpenAI-compatible models | Fastest JS tokenizer, smallest bundle, pure JS (no WASM), supports all OpenAI encodings |
| drizzle-orm | 0.45.1 (existing) | Schema definition, JSONB column, migration generation | Already in use; `jsonb().$type<T>()` provides typed JSONB |
| zod | 4.x (existing) | Policy config validation with defaults | Already in use; Zod 4 applies defaults within optional fields |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| drizzle-kit | 0.31.8 (existing) | Generate SQL migration for new columns | When schema changes need migration files |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| gpt-tokenizer | tiktoken (openai/tiktoken) | tiktoken requires WASM bindings; gpt-tokenizer is pure JS, faster, smaller |
| gpt-tokenizer | tokenx | tokenx is estimation-only (~96% accuracy); gpt-tokenizer gives exact counts |
| JSONB column | Separate policy_configs table | Separate table adds a JOIN for every context read; JSONB avoids this |

**Installation:**
```bash
pnpm add gpt-tokenizer
```

## Architecture Patterns

### Recommended Project Structure

New files and modifications for this phase:

```
src/
├── db/
│   └── schema/
│       ├── contexts.ts     # ADD: policyConfig JSONB column
│       └── messages.ts     # ADD: compactedAt, compactedIntoVersion columns
├── repositories/
│   ├── context.repository.ts   # MODIFY: accept policyConfig in create/update
│   └── types.ts                # MODIFY: add PolicyConfig type, update CreateContextInput
├── validation/
│   └── policy.ts           # NEW: Zod schema for policy config with defaults
└── token-counting/
    └── index.ts            # NEW: thin wrapper around gpt-tokenizer
```

### Pattern 1: Typed JSONB Column with Application-Layer Defaults

**What:** Define JSONB column in Drizzle with `.$type<T>()` for compile-time safety. Apply defaults via Zod parsing at the application layer, not via SQL DEFAULT.

**When to use:** Whenever storing structured config in JSONB that needs both type safety and default value merging.

**Example:**
```typescript
// Source: Context7 /drizzle-team/drizzle-orm-docs - JSONB column types
// Schema definition
import { jsonb, pgTable } from "drizzle-orm/pg-core";

export interface PolicyConfig {
  threshold: number;
  preserveRecentCount: number;
  enabled: boolean;
}

export const contexts = pgTable("contexts", {
  // ... existing columns
  policyConfig: jsonb("policy_config").$type<PolicyConfig>(),
});
```

```typescript
// Source: Context7 /websites/zod_dev_v4 - defaults in optional fields
// Validation with defaults
import { z } from "zod";

export const policyConfigSchema = z.object({
  threshold: z.number().min(0).max(1).default(0.8),
  preserveRecentCount: z.number().int().min(0).default(10),
  enabled: z.boolean().default(true),
});

export type PolicyConfig = z.infer<typeof policyConfigSchema>;

// Apply defaults: policyConfigSchema.parse({}) returns full object with defaults
// Apply defaults: policyConfigSchema.parse({ threshold: 0.5 }) merges with defaults
```

**Why application-layer defaults:** SQL DEFAULT only applies when the column value is omitted entirely. It cannot merge partial objects. Zod 4's `.default()` on each field handles partial input (e.g., user provides `{ threshold: 0.5 }` and gets `{ threshold: 0.5, preserveRecentCount: 10, enabled: true }`).

### Pattern 2: Token Counting Utility

**What:** Wrap `gpt-tokenizer` in a thin module to centralize encoding choice and enable future model-specific counting.

**When to use:** Any code path that needs token counts for messages.

**Example:**
```typescript
// Source: Context7 /niieani/gpt-tokenizer - countTokens API
import { countTokens } from "gpt-tokenizer";

export function countMessageTokens(content: string): number {
  return countTokens(content);
}
```

The default import uses `o200k_base` encoding (GPT-4o, GPT-4.1, o1, o3, o4 models). For model-specific encoding, use subpath imports:

```typescript
// Source: Context7 /niieani/gpt-tokenizer - model-specific imports
import { countTokens } from "gpt-tokenizer/model/gpt-4o";
import { countTokens as countGpt4 } from "gpt-tokenizer/model/gpt-4";
```

### Pattern 3: Migration for Column Addition

**What:** Add columns to existing tables by modifying the Drizzle schema file and running `drizzle-kit generate`.

**When to use:** Any schema change.

**Example workflow:**
```bash
# 1. Modify src/db/schema/contexts.ts (add policyConfig column)
# 2. Modify src/db/schema/messages.ts (add compactedAt, compactedIntoVersion)
# 3. Generate migration
pnpm db:generate

# 4. Verify generated SQL in src/db/migrations/XXXX_*.sql
# 5. Apply to production
pnpm db:migrate
```

Generated SQL will contain `ALTER TABLE` statements like:
```sql
ALTER TABLE "contexts" ADD COLUMN "policy_config" jsonb;
ALTER TABLE "messages" ADD COLUMN "compacted_at" timestamp with time zone;
ALTER TABLE "messages" ADD COLUMN "compacted_into_version" bigint;
```

### Anti-Patterns to Avoid

- **SQL DEFAULT for complex JSONB objects:** SQL `DEFAULT '{"threshold":0.8}'::jsonb` only applies when the entire column is NULL/omitted. It cannot merge partial config objects. Use Zod parsing at the application layer instead.
- **Storing token counts with gpt-tokenizer in the migration:** Token counts are computed at message-append time, not at migration time. The migration only adds the infrastructure columns.
- **Making policyConfig NOT NULL:** The column should be nullable. NULL means "use system defaults." This avoids needing to backfill existing rows and makes the default policy logic explicit in application code.
- **Coupling token counting to a specific model encoding:** Use the default `o200k_base` encoding via the bare `gpt-tokenizer` import. Model-specific encoding can be added later if needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| BPE token counting | Character/word estimation | gpt-tokenizer `countTokens()` | BPE tokenization has complex merge rules; estimation diverges significantly for non-English text and code |
| Config schema validation with defaults | Manual `if (!config.threshold) config.threshold = 0.8` | Zod 4 `.default()` on each field | Manual defaults are error-prone, don't validate types, miss new fields |
| JSONB type safety | `Record<string, unknown>` | Drizzle `.$type<PolicyConfig>()` | Compile-time type checking prevents storing wrong shape |
| Migration SQL | Hand-written ALTER TABLE | `drizzle-kit generate` | drizzle-kit tracks schema diff, handles edge cases, generates snapshot metadata |

**Key insight:** This phase is purely infrastructure. Every component has an established library solution. No custom algorithms are needed.

## Common Pitfalls

### Pitfall 1: PGlite Migration Compatibility with JSONB

**What goes wrong:** PGlite supports JSONB natively, but some edge cases with JSONB defaults using `::jsonb` casts can behave differently from full Postgres.
**Why it happens:** PGlite is WASM-compiled Postgres and covers most features, but it's not identical.
**How to avoid:** Test the actual migration against PGlite in the test suite. The existing `vitest.setup.ts` runs migrations via `migrate()` which will catch incompatibilities early.
**Warning signs:** Migration runs in `pnpm db:migrate` (production) but tests fail on setup.

### Pitfall 2: Zod 4 Default Ordering (.default() vs .optional())

**What goes wrong:** In Zod 4, the order of `.default()` and `.optional()` matters. `z.string().default("x").optional()` applies the default when input is `undefined`. `z.string().optional().default("x")` also applies the default but the semantic chain differs.
**Why it happens:** Zod 4 changed behavior from Zod 3. Defaults are now applied within optional fields.
**How to avoid:** Use `.default(value)` on each field within the object schema. Don't make the entire object schema optional with a default; instead make individual fields have defaults and let the parent provide `{}` or the full object.
**Warning signs:** `policyConfigSchema.parse(undefined)` throws instead of returning defaults.

### Pitfall 3: gpt-tokenizer ESM Import Resolution

**What goes wrong:** Subpath imports like `gpt-tokenizer/model/gpt-4o` may fail in some bundler or resolver configurations.
**Why it happens:** The library uses package.json `exports` field for subpath resolution. Some tools don't support this.
**How to avoid:** The project uses ESM (`"type": "module"` in package.json) and tsx for execution, both of which support `exports` resolution. If issues arise, fall back to `gpt-tokenizer/esm/model/gpt-4o`. For this phase, use the default import `from "gpt-tokenizer"` which avoids subpath issues entirely.
**Warning signs:** `ERR_PACKAGE_PATH_NOT_EXPORTED` or `MODULE_NOT_FOUND` errors.

### Pitfall 4: Forgetting to Update CreateContextInput Type

**What goes wrong:** Adding `policyConfig` to the schema but not to the repository's input type means callers can't pass policy config when creating contexts.
**Why it happens:** The `CreateContextInput` type in `types.ts` is manually defined (not auto-inferred from schema).
**How to avoid:** Update `CreateContextInput` to include `policyConfig?: PolicyConfig`. Also update the `create()` method in `ContextRepository` to pass it through to the insert.
**Warning signs:** TypeScript compilation succeeds but policy config is silently dropped on context creation.

### Pitfall 5: Backfill Temptation

**What goes wrong:** Attempting to backfill existing contexts with default policy config during migration.
**Why it happens:** Desire for data consistency.
**How to avoid:** NULL `policy_config` means "use system defaults." The application layer (Zod parsing with defaults) handles this. No backfill needed. This keeps the migration additive-only (no UPDATE statements).
**Warning signs:** Migration includes `UPDATE contexts SET policy_config = '...'` statements.

## Code Examples

### Adding JSONB Column to Contexts Schema

```typescript
// Source: Context7 /drizzle-team/drizzle-orm-docs - JSONB column types
// File: src/db/schema/contexts.ts

import {
  type AnyPgColumn,
  bigint,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Type for the JSONB column
export interface PolicyConfig {
  threshold: number;
  preserveRecentCount: number;
  enabled: boolean;
}

export const contexts = pgTable("contexts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  messageCount: integer("message_count").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  latestVersion: bigint("latest_version", { mode: "number" }).notNull().default(0),
  parentId: uuid("parent_id").references((): AnyPgColumn => contexts.id, {
    onDelete: "set null",
  }),
  forkVersion: bigint("fork_version", { mode: "number" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  // NEW: Policy configuration stored as JSONB. NULL = use system defaults.
  policyConfig: jsonb("policy_config").$type<PolicyConfig>(),
});
```

### Adding Compaction Tracking Columns to Messages Schema

```typescript
// File: src/db/schema/messages.ts (additions only)

// Inside the messages pgTable definition, add:
compactedAt: timestamp("compacted_at", { withTimezone: true }),
compactedIntoVersion: bigint("compacted_into_version", { mode: "number" }),
```

- `compactedAt`: When this message was compacted (NULL = not compacted)
- `compactedIntoVersion`: Version number of the summary message that replaced this one

### Zod Policy Config Schema with Defaults

```typescript
// Source: Context7 /websites/zod_dev_v4 - defaults in optional fields
// File: src/validation/policy.ts

import { z } from "zod";

export const policyConfigSchema = z.object({
  threshold: z.number().min(0).max(1).default(0.8),
  preserveRecentCount: z.number().int().min(0).default(10),
  enabled: z.boolean().default(true),
});

export type PolicyConfig = z.infer<typeof policyConfigSchema>;

// Default policy (parse empty object to get all defaults)
export const DEFAULT_POLICY: PolicyConfig = policyConfigSchema.parse({});
// Result: { threshold: 0.8, preserveRecentCount: 10, enabled: true }

/**
 * Resolve policy config: merge user-provided config with defaults.
 * Returns full PolicyConfig with all fields populated.
 */
export function resolvePolicy(input: unknown): PolicyConfig {
  return policyConfigSchema.parse(input ?? {});
}
```

### Token Counting Utility

```typescript
// Source: Context7 /niieani/gpt-tokenizer - countTokens, encode
// File: src/token-counting/index.ts

import { countTokens, encode } from "gpt-tokenizer";

/**
 * Count tokens in a string using o200k_base encoding (default).
 * Compatible with GPT-4o, GPT-4.1, o1, o3, o4 models.
 */
export function countMessageTokens(content: string): number {
  return countTokens(content);
}

/**
 * Encode text to token IDs. Useful for debugging or advanced operations.
 */
export function encodeText(content: string): number[] {
  return encode(content);
}
```

### Updated CreateContextInput Type

```typescript
// File: src/repositories/types.ts (modification)

import type { PolicyConfig } from "../validation/policy.js";

export type CreateContextInput = Pick<NewContext, "name"> & {
  policyConfig?: PolicyConfig;
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| tiktoken (WASM/native bindings) | gpt-tokenizer (pure JS) | gpt-tokenizer 2.4.0+ | No WASM build step, faster, smaller bundle |
| Zod 3 optional+default ordering | Zod 4 defaults in optional fields | Zod 4.0 | `.default("x").optional()` now reliably applies defaults |
| gpt-tokenizer cl100k_base default | gpt-tokenizer o200k_base default | gpt-tokenizer 2.x+ | Default encoding matches latest OpenAI models (GPT-4o, o1, etc.) |

**Deprecated/outdated:**
- `gpt-tokenizer` subpath `gpt-tokenizer/cjs/*`: Only needed for environments without ESM support. This project uses ESM natively.
- Zod 3's `.default()` behavior: In Zod 3, defaults within optional fields were not applied when parsing `{}`. Zod 4 fixes this.

## Open Questions

1. **Should `PolicyConfig` interface live in schema or validation?**
   - The Drizzle schema needs the type for `.$type<PolicyConfig>()`
   - The Zod schema also produces the type via `z.infer<>`
   - Recommendation: Define the Zod schema as source of truth, export the inferred type, import it in the Drizzle schema file. This ensures the validation and the column type stay in sync.
   - Risk: LOW. Either approach works. The key constraint is single source of truth.

2. **Token counting encoding choice for non-OpenAI models**
   - `o200k_base` (the default) covers all modern OpenAI models
   - Anthropic Claude uses a different tokenizer entirely
   - For a model-agnostic engine, token counts may need to be approximate or caller-provided
   - Recommendation: Use `gpt-tokenizer` default encoding for now. The existing `tokenCount` field on messages is already optional (`integer("token_count")` with no `.notNull()`), so callers can provide their own counts. Add model-specific encoding later if needed.
   - Risk: LOW. The token count field is already optional; this is additive.

## Sources

### Primary (HIGH confidence)
- Context7 `/niieani/gpt-tokenizer` - countTokens API, encode API, model-specific imports, supported models, default encoding
- Context7 `/drizzle-team/drizzle-orm-docs` - JSONB column definition, `.$type<>()` inference, timestamp columns, migration workflow
- Context7 `/websites/zod_dev_v4` - Zod 4 defaults in optional fields, `.default()` behavior change from Zod 3

### Secondary (MEDIUM confidence)
- [GitHub niieani/gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) - Version 3.x, o200k_base default, supported model list, pure JS performance claims
- [npm gpt-tokenizer](https://www.npmjs.com/package/gpt-tokenizer) - Version 3.4.0, publication date

### Tertiary (LOW confidence)
- None. All findings verified via Context7 or official sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - gpt-tokenizer verified via Context7 and GitHub; Drizzle JSONB verified via Context7 official docs
- Architecture: HIGH - patterns derived from existing codebase analysis and Context7 verified Drizzle/Zod APIs
- Pitfalls: MEDIUM - PGlite JSONB compatibility based on general PGlite documentation, not specific JSONB testing

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable domain; gpt-tokenizer and Drizzle are mature libraries)
