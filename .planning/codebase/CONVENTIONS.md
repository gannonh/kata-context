# Coding Conventions

**Analysis Date:** 2026-02-02

## Naming Patterns

**Files:**
- Lowercase with dots for special types: `*.repository.ts`, `*.test.ts`, `*.config.ts`
- Index files for barrel exports: `index.ts`
- Schema files match table names: `contexts.ts`, `messages.ts`
- No kebab-case or PascalCase in filenames

**Functions:**
- camelCase for all functions and methods
- Async functions always have `async` keyword (no implicit Promise returns)
- Private methods/properties use TypeScript `private` modifier

**Variables:**
- camelCase for local variables and parameters
- SCREAMING_SNAKE_CASE for module-level constants: `VERSION`, `DATABASE_URL`
- Descriptive names preferred over abbreviations: `contextId` not `ctxId`, `messageRepo` not `msgRepo`

**Types:**
- PascalCase for classes, interfaces, types
- Type aliases over interfaces for simple types: `type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>`
- Suffix patterns for type categories:
  - `*Input` for input types (what callers provide): `CreateContextInput`, `AppendMessageInput`
  - `*Options` for configuration: `PaginationOptions`, `TokenBudgetOptions`
  - `*Result` for return types: `PaginatedResult<T>`
- Custom error classes suffix with `Error`: `RepositoryError`

## Code Style

**Formatting:**
- Tool: Biome 2.3.11
- Indent: 2 spaces
- Line width: 100 characters
- Line ending: LF
- Quote style: Double quotes
- Semicolons: Always required
- Trailing commas: Always in multiline arrays/objects
- Config: `biome.json`

**Linting:**
- Tool: Biome with recommended rules
- Auto-fix on commit via lint-staged
- Organize imports automatically enabled

## Import Organization

**Order:**
1. External packages (Drizzle, Vitest, Node types)
2. Internal absolute imports from project root
3. Relative imports (parent directories first, then siblings)

**Pattern observed:**
```typescript
// External - grouped by package
import { attachDatabasePool } from "@vercel/functions";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

// Internal schema/types
import type * as schema from "../db/schema/index.js";
import { contexts, type Message, messages } from "../db/schema/index.js";

// Internal utilities
import { handleDatabaseError, notDeleted } from "./helpers.js";
import type { CreateContextInput } from "./types.js";
```

**Path Aliases:**
- None configured. All imports use relative paths or node_modules.
- ES modules enabled: All imports end with `.js` extension (even for `.ts` files)

## Error Handling

**Patterns:**
- Custom domain errors via `RepositoryError` class with typed codes
- Database errors caught and mapped via `handleDatabaseError()` helper
- Error codes: `DUPLICATE`, `NOT_FOUND`, `FOREIGN_KEY`, `DATABASE_ERROR`
- Re-throw pattern: catch, transform to domain error, throw
- Never swallow errors silently

**Example:**
```typescript
try {
  return await this.db.transaction(async (tx) => {
    // ... transaction logic
  });
} catch (error) {
  if (error instanceof RepositoryError) throw error;
  handleDatabaseError(error);
}
```

**Validation:**
- Early returns for edge cases (empty arrays, zero budgets)
- Explicit null checks: `context ?? null` for clarity
- Type guards used before throwing: `if (!context) throw new RepositoryError(...)`

## Logging

**Framework:** console (native Node.js)

**Patterns:**
- Structured logging in production code: `console.error('[db] Unexpected pool error:', { message, timestamp })`
- Prefix with context: `[db]` for database operations
- Include timestamps in error logs
- No debug logs in repository layer (handled at client layer)
- Only log errors, not info/debug in library code

## Comments

**When to Comment:**
- Repository methods: JSDoc-style summary of what method does
- Code comments for business logic rationale: `// Accumulate until budget exceeded`
- Schema references: `// CASCADE delete: when context is deleted, all its messages are deleted`
- Version/milestone markers: `// pgvector column for semantic search (v0.3.0+)`
- Non-obvious patterns: `// null-safe` for reduce operations

**JSDoc/TSDoc:**
- Used sparingly, primarily in repository classes
- Format: Single-line `/** Summary */` for methods
- Include ticket references: `DATA-01: Create new context with optional name`
- No parameter/return type docs (TypeScript handles this)

**Example:**
```typescript
/**
 * DATA-03: Append messages to context (batch insert with sequence assignment)
 * Uses transaction with FOR UPDATE to prevent race conditions
 */
async append(contextId: string, newMessages: AppendMessageInput[]): Promise<Message[]>
```

## Function Design

**Size:** Most functions under 50 lines. Complex operations (like `append()`) up to 80 lines with transaction logic.

**Parameters:**
- Options objects for methods with multiple optional params: `findByContext(contextId: string, options: PaginationOptions = {})`
- Positional for required parameters only
- Destructuring in function body: `const { cursor, limit = 50, order = "asc" } = options;`

**Return Values:**
- Explicit return types always declared
- `null` for not-found cases (not `undefined`)
- Empty arrays for no-results queries: `return [];`
- Wrapped results for pagination: `PaginatedResult<T>` with metadata

## Module Design

**Exports:**
- Named exports only (no default exports)
- Barrel exports via `index.ts`: `export * from "./context.repository.js";`
- Type-only exports marked: `export type { Context, Message }`

**Class Pattern:**
- Repository pattern with constructor dependency injection
- Private `db` property for database client
- Public async methods for all operations
- No static methods

**File Organization:**
- One class per file for repositories
- Types consolidated in `types.ts`
- Shared helpers in `helpers.ts`
- Schema definitions grouped by table in `db/schema/`

**Barrel Files:**
- Used in `src/repositories/index.ts` and `src/db/schema/index.ts`
- Export all public API surface
- Re-export types for convenience

---

*Convention analysis: 2026-02-02*
