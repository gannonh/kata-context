# Testing Patterns

**Analysis Date:** 2026-02-02

## Test Framework

**Runner:**
- Vitest 4.0.17
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in (compatible with Jest)
- Matchers: `expect()`, `toBe()`, `toBeInstanceOf()`, `toHaveLength()`, `toMatch()`, `toBeNull()`

**Run Commands:**
```bash
pnpm test                    # Run all tests
pnpm test:watch              # Watch mode
pnpm test -- path/to/file    # Run specific file
pnpm test -- -t "pattern"    # Run tests matching name pattern
```

**Coverage:**
```bash
# Coverage configured but command not in scripts
# Config: provider: v8, reporters: text/json/html
```

## Test File Organization

**Location:**
- Co-located with source files: `src/repositories/context.repository.test.ts`
- Same directory as the code under test

**Naming:**
- Pattern: `*.test.ts` (not `*.spec.ts`)
- Matches source file: `context.repository.ts` → `context.repository.test.ts`

**Structure:**
```
src/repositories/
├── context.repository.ts
├── context.repository.test.ts
├── message.repository.ts
├── message.repository.test.ts
├── types.ts
└── helpers.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb, teardownTestDb, testDb } from "../../vitest.setup.js";

describe("RepositoryName", () => {
  let repository: RepositoryClass;

  beforeAll(async () => {
    await setupTestDb();
    repository = new RepositoryClass(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    // Clean tables between tests
    await testDb.delete(tableSchema);
  });

  describe("methodName", () => {
    it("describes expected behavior", async () => {
      // Arrange, Act, Assert
    });
  });
});
```

**Patterns:**
- One top-level `describe()` per class/module
- Nested `describe()` per method
- Multiple `it()` tests per method covering different scenarios
- Test names are descriptive sentences: "creates a context with auto-generated fields"
- All repository tests use async/await

**Lifecycle:**
- `beforeAll`: Setup database once per test file
- `afterAll`: Teardown database connection
- `beforeEach`: Clean tables for test isolation
- No `afterEach` hooks observed

## Database Testing Setup

**Test Database:**
- PGlite (in-memory PostgreSQL) - no external database required
- Config in `vitest.setup.ts`
- Includes pgvector extension
- Migrations run automatically before tests

**Setup Pattern:**
```typescript
// vitest.setup.ts
export let testDb: PgliteDatabase<typeof schema>;

export async function setupTestDb(): Promise<PgliteDatabase<typeof schema>> {
  testClient = new PGlite({
    extensions: { vector },
  });

  await testClient.exec("CREATE EXTENSION IF NOT EXISTS vector;");
  testDb = drizzle(testClient, { schema });
  await migrate(testDb, { migrationsFolder: "./src/db/migrations" });

  return testDb;
}
```

**Table Cleanup:**
- Delete in correct order (children before parents due to foreign keys)
- Pattern: `await testDb.delete(messages); await testDb.delete(contexts);`
- Performed in `beforeEach` for isolation

## Mocking

**Framework:** None (no mocking library used)

**Patterns:**
- Real database operations via PGlite (no database mocking)
- No service mocking - tests use actual repository implementations
- Integration testing approach rather than unit testing with mocks

**Rationale:**
- PGlite provides real PostgreSQL behavior without external dependencies
- Tests verify actual database interactions (indexes, constraints, transactions)
- Faster than mocking complex Drizzle ORM operations

## Fixtures and Factories

**Test Data:**
- Inline creation via repository methods
- Pattern: Create entities in each test as needed

```typescript
it("returns context by ID", async () => {
  const created = await repository.create({ name: "Find Me" });
  const found = await repository.findById(created.id);

  expect(found?.id).toBe(created.id);
});
```

**No Factory Files:**
- Simple data structures created inline
- Minimal setup: `{ name: "Test" }` or `{ role: "user", content: "Hello", tokenCount: 5 }`

**Location:**
- All test data created within test functions
- No separate fixtures directory

## Coverage

**Requirements:** None enforced

**Configuration:**
- Provider: v8
- Reporters: text, json, html
- Configured in `vitest.config.ts`

**Current Status:**
- Two repository classes fully tested
- 109 test cases total across `context.repository.test.ts` and `message.repository.test.ts`

## Test Types

**Unit Tests:**
- Not strictly unit tests due to real database usage
- Each test validates a single method's behavior
- Isolated via table cleanup between tests

**Integration Tests:**
- Current approach: Integration tests with real database
- Test repository methods against actual PostgreSQL (via PGlite)
- Validate database constraints, indexes, transactions
- Example: `append()` tests verify atomic counter updates across tables

**E2E Tests:**
- Not present in codebase

## Common Patterns

**Async Testing:**
```typescript
it("assigns sequential version numbers", async () => {
  const ctx = await contextRepo.create({ name: "Test" });

  const inserted = await messageRepo.append(ctx.id, [
    { role: "user", content: "Hello", tokenCount: 5 },
    { role: "assistant", content: "Hi there!", tokenCount: 10 },
  ]);

  expect(inserted).toHaveLength(2);
  expect(inserted[0]!.version).toBe(1);
  expect(inserted[1]!.version).toBe(2);
});
```

**Error Testing:**
```typescript
it("throws NOT_FOUND for non-existent context", async () => {
  await expect(
    messageRepo.append("00000000-0000-0000-0000-000000000000", [
      { role: "user", content: "Hello", tokenCount: 5 },
    ]),
  ).rejects.toThrow(RepositoryError);
});
```

**Null Assertions:**
- Non-null assertion operator `!` used when test setup guarantees value
- Pattern: `inserted[0]!.version` after verifying array length
- Used for test clarity, not production code

**Edge Case Testing:**
- Empty input: `append(ctx.id, [])` returns empty array
- Zero values: `getByTokenBudget(ctx.id, { budget: 0 })` returns empty
- Null values: `tokenCount` omitted tests null handling
- Non-existent IDs: UUID with all zeros used consistently

**Pagination Testing:**
- Multi-step tests validating cursor behavior
- Verify `hasMore` flag, `nextCursor` value, `data` length
- Example: 5 messages paginated with limit 2 across 3 pages

**Transaction Testing:**
- Validate atomic operations across multiple tables
- Example: `append()` verifies message insert AND context counter update in single test

**Setup Dependencies:**
- Tests requiring context first create it: `const ctx = await contextRepo.create({ name: "Test" });`
- Foreign key relationships respected in test setup
- Clean order matches dependency graph

---

*Testing analysis: 2026-02-02*
