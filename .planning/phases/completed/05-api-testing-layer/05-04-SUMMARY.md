---
phase: 05-api-testing-layer
plan: 04
subsystem: testing
tags: [vitest, pglite, integration-tests, unit-tests, mocking]
requires: ["05-02", "05-03"]
provides: ["TEST-01", "TEST-02", "TEST-03"]
affects: []
tech-stack:
  added: []
  patterns: [vi.hoisted, vi.resetModules, mock-class-constructor]
key-files:
  created:
    - src/api/__tests__/contexts.unit.test.ts
    - src/api/__tests__/messages.unit.test.ts
    - src/api/__tests__/contexts.integration.test.ts
    - src/api/__tests__/messages.integration.test.ts
  modified: []
decisions:
  - id: DEV-05-04-01
    description: Use vi.hoisted for mock variable initialization before module loading
  - id: DEV-05-04-02
    description: Use vi.resetModules to re-import handlers after testDb setup
  - id: DEV-05-04-03
    description: Use class constructors in mocks instead of vi.fn().mockImplementation
metrics:
  duration: 7m
  completed: 2026-02-02
---

# Phase 5 Plan 4: API Testing Summary

**One-liner:** Comprehensive unit and integration tests for all 6 API endpoints with vi.hoisted/vi.resetModules pattern for proper db mocking.

## What Was Done

### Task 1: Unit Tests for API Endpoints
Created unit tests with mocked repositories covering all endpoint handlers.

**contexts.unit.test.ts (11 tests):**
- POST /api/v1/contexts: valid name, empty body, invalid JSON, validation errors, 500 error logging
- GET /api/v1/contexts/:id: found, not found, invalid UUID
- DELETE /api/v1/contexts/:id: soft-delete, not found, invalid UUID

**messages.unit.test.ts (15 tests):**
- POST /api/v1/contexts/:id/messages: valid input, invalid JSON, empty array, invalid role, context not found, invalid UUID
- GET /api/v1/contexts/:id/messages: paginated messages, limit parameter, invalid params, invalid UUID
- GET /api/v1/contexts/:id/window: within budget, missing budget, negative budget, non-number budget, invalid UUID

**Mocking pattern:**
```typescript
const { mockCreate, mockFindById } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindById: vi.fn(),
}));

vi.mock("../../../src/repositories/index.js", () => ({
  ContextRepository: class MockContextRepository {
    create = mockCreate;
    findById = mockFindById;
  },
}));
```

### Task 2: Integration Tests with PGlite
Created integration tests that verify full request-to-database flow.

**contexts.integration.test.ts (7 tests):**
- POST: creates and stores in database, creates without name
- GET: retrieves created context, 404 for non-existent
- DELETE: soft-deletes and returns deleted data
- Full CRUD lifecycle, multiple contexts independently

**messages.integration.test.ts (14 tests):**
- POST: single message with version, multiple sequential versions, 404 for non-existent context
- GET messages: empty context returns array (not 404), correct order, cursor pagination
- GET window (TEST-03 edge cases): empty context, budget exceeds total, most recent fitting budget, at least one message when budget < first message, non-existent context returns empty, null tokenCount as 0
- Edge cases: version continuity across appends, tool messages

**Integration test db injection pattern:**
```typescript
const { dbRef } = vi.hoisted(() => ({
  dbRef: { current: null as PgliteDatabase<typeof schema> | null },
}));

vi.mock("../../../src/db/client.js", () => ({
  get db() { return dbRef.current; },
}));

beforeAll(async () => {
  await setupTestDb();
  dbRef.current = testDb;
  vi.resetModules();
  const module = await import("../../../api/v1/contexts/index.js");
  POST = module.POST;
});
```

### Task 3: Full Suite Verification
- All 87 tests pass
- Breakdown: 40 repository tests + 26 unit tests + 21 integration tests = 87
- Build: success
- Lint: warnings only (pre-existing in repository tests, not from new code)

## Requirements Delivered

| ID | Requirement | Status |
|----|-------------|--------|
| TEST-01 | Unit tests verify API logic with mocked repository | DONE |
| TEST-02 | Integration tests verify full request-to-database flow | DONE |
| TEST-03 | Token windowing edge cases tested | DONE |

## Commits

| Hash | Description |
|------|-------------|
| 5642d2b | test(05-04): add unit tests for API endpoints |
| 64e55a1 | test(05-04): add integration tests for API endpoints |

## Files Created

- `src/api/__tests__/contexts.unit.test.ts` (256 lines)
- `src/api/__tests__/messages.unit.test.ts` (339 lines)
- `src/api/__tests__/contexts.integration.test.ts` (226 lines)
- `src/api/__tests__/messages.integration.test.ts` (429 lines)

## Deviations from Plan

None - plan executed exactly as written.

## Technical Decisions

### DEV-05-04-01: vi.hoisted for Mock Initialization
Standard vi.mock is hoisted above imports but cannot access variables declared after it. Used vi.hoisted to create mock functions that are available during mock factory execution.

### DEV-05-04-02: vi.resetModules for Handler Re-import
API handlers create repository instances at module scope with the db from import time. Used vi.resetModules after setting testDb to ensure handlers get the real test database instead of the initial null.

### DEV-05-04-03: Class Constructors in Mocks
Using `vi.fn().mockImplementation(() => mockRepository)` failed with "not a constructor" error. Changed to actual class declarations that assign vi.fn() to instance methods.

## Next Phase Readiness

Phase 5 is now complete. v0.2.0 milestone is ready for final verification:
- [x] Phase 3: Database Foundation (2/2 plans)
- [x] Phase 4: Repository Layer (2/2 plans)
- [x] Phase 5: API + Testing Layer (4/4 plans)

Total test coverage: 87 tests
- Repository layer: 40 tests
- API layer: 47 tests (26 unit + 21 integration)
