# Phase 5: API + Testing Layer - Research

**Researched:** 2026-02-02
**Domain:** REST API endpoints with Vercel serverless functions, comprehensive testing with Vitest
**Confidence:** HIGH

## Summary

This phase implements REST API endpoints for context management operations using Vercel's file-based serverless function routing, with comprehensive unit and integration test coverage. The existing codebase already has the foundational patterns established: web standard `Request`/`Response` objects (see `api/health.ts`), PGlite-based testing infrastructure, and a complete repository layer.

The API layer will use Vercel's `/api` directory convention with versioned endpoints (`/api/v1/`), web standard HTTP method exports (`GET`, `POST`, `DELETE`), and Zod for request validation. Testing follows a dual strategy: unit tests mock the repository layer to test API logic in isolation, while integration tests use PGlite to verify the full request-to-database flow.

**Primary recommendation:** Build thin API handlers that delegate to repositories, validate with Zod, and return RFC 9457-style error responses. Test API handlers by calling the exported functions directly with mocked/real Request objects.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vercel Functions | Built-in | Serverless function runtime | Already configured; uses web standards |
| @vercel/functions | 3.4.0 | Already installed | `waitUntil`, `attachDatabasePool` helpers |
| Zod | 3.x (latest) | Request validation | TypeScript-first, runtime validation, type inference |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.0.17 | Already installed | Test runner with vi.mock/vi.spyOn |
| PGlite | 0.3.15 | Already installed | Integration tests (in-memory Postgres) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zod | TypeBox/AJV | Zod has better DX and TypeScript inference; AJV faster for high volume |
| Direct function testing | Supertest | Supertest requires server startup; direct calls are simpler for Vercel functions |

**Installation:**
```bash
pnpm add zod
```

## Architecture Patterns

### Recommended Project Structure
```
api/
├── v1/
│   ├── contexts/
│   │   ├── index.ts              # POST /api/v1/contexts
│   │   └── [id]/
│   │       ├── index.ts          # GET/DELETE /api/v1/contexts/:id
│   │       ├── messages.ts       # POST/GET /api/v1/contexts/:id/messages
│   │       └── window.ts         # GET /api/v1/contexts/:id/window
│   └── health.ts                 # Move health endpoint to versioned API
src/
├── api/
│   ├── validation/
│   │   └── schemas.ts            # Zod schemas for all endpoints
│   ├── errors.ts                 # Error response helpers (RFC 9457 style)
│   └── responses.ts              # Response helpers
├── repositories/                 # Existing - no changes
└── db/                          # Existing - no changes
```

### Pattern 1: Vercel Web Handler with Named Exports

**What:** Export named functions for each HTTP method (GET, POST, DELETE)
**When to use:** All API endpoints
**Example:**
```typescript
// Source: Vercel Functions API Reference + existing api/health.ts pattern
// api/v1/contexts/index.ts
import { db } from "../../../src/db/client.js";
import { ContextRepository } from "../../../src/repositories/context.repository.js";
import { createContextSchema } from "../../../src/api/validation/schemas.js";
import { errorResponse, successResponse } from "../../../src/api/responses.js";

const repository = new ContextRepository(db);

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const result = createContextSchema.safeParse(body);

    if (!result.success) {
      return errorResponse(400, "Invalid request body", result.error.flatten());
    }

    const context = await repository.create(result.data);
    return successResponse(201, { data: context });
  } catch (error) {
    console.error("[POST /api/v1/contexts] Error:", error);
    return errorResponse(500, "Internal server error");
  }
}
```

### Pattern 2: Dynamic Route Parameters via URL Parsing

**What:** Extract route parameters from URL path since Vercel /api directory doesn't inject params
**When to use:** All endpoints with dynamic segments like `[id]`
**Example:**
```typescript
// Source: Web standard URL API + Vercel file routing
// api/v1/contexts/[id]/index.ts
export async function GET(request: Request): Promise<Response> {
  // Extract ID from URL path: /api/v1/contexts/[uuid]/...
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const idIndex = pathSegments.indexOf('contexts') + 1;
  const id = pathSegments[idIndex];

  if (!id || !isValidUUID(id)) {
    return errorResponse(400, "Invalid context ID");
  }

  const context = await repository.findById(id);
  if (!context) {
    return errorResponse(404, "Context not found");
  }

  return successResponse(200, { data: context });
}
```

### Pattern 3: Query Parameter Handling

**What:** Parse query string for pagination, filtering, token budget
**When to use:** GET endpoints with optional parameters
**Example:**
```typescript
// Source: Web standard URL/URLSearchParams API
// api/v1/contexts/[id]/window.ts
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = extractContextId(url.pathname);

  const budgetParam = url.searchParams.get('budget');
  const budget = budgetParam ? parseInt(budgetParam, 10) : null;

  if (budget === null || isNaN(budget) || budget <= 0) {
    return errorResponse(400, "Budget must be a positive integer");
  }

  const messages = await messageRepository.getByTokenBudget(id, { budget });
  return successResponse(200, { data: messages });
}
```

### Pattern 4: Zod Schema with Type Inference

**What:** Define validation schemas that also generate TypeScript types
**When to use:** All request body validation
**Example:**
```typescript
// Source: Zod official documentation
// src/api/validation/schemas.ts
import { z } from "zod";

export const createContextSchema = z.object({
  name: z.string().max(255).optional(),
});

export type CreateContextInput = z.infer<typeof createContextSchema>;

export const appendMessagesSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system", "tool"]),
    content: z.string(),
    tokenCount: z.number().int().positive().optional(),
    toolCallId: z.string().optional(),
    toolName: z.string().optional(),
    model: z.string().optional(),
  })).min(1, "At least one message required"),
});

export type AppendMessagesInput = z.infer<typeof appendMessagesSchema>;

export const paginationSchema = z.object({
  cursor: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(50),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
});
```

### Pattern 5: RFC 9457-Style Error Responses

**What:** Consistent error response format with machine-readable details
**When to use:** All error responses
**Example:**
```typescript
// Source: RFC 9457 Problem Details + best practices
// src/api/errors.ts
interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: unknown;
}

export function errorResponse(
  status: number,
  title: string,
  detail?: string | unknown,
  instance?: string
): Response {
  const body: ProblemDetails = {
    type: `https://api.kata-context.dev/errors/${status}`,
    title,
    status,
  };

  if (typeof detail === 'string') {
    body.detail = detail;
  } else if (detail) {
    body.errors = detail;
  }

  if (instance) {
    body.instance = instance;
  }

  return Response.json(body, {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

export function successResponse<T>(status: number, data: T): Response {
  return Response.json(data, { status });
}
```

### Anti-Patterns to Avoid

- **Creating new repository instances per request:** Module-scope singleton avoids cold start overhead
- **Using `parse()` for user input:** Always use `safeParse()` to avoid throwing on invalid input
- **Returning 200 for errors:** Confuses clients and monitoring systems
- **Leaking internal errors:** Log full errors server-side, return generic messages to clients
- **Not validating path parameters:** UUIDs from URLs must be validated before database queries

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request validation | Manual type checking | Zod schemas | Type inference, consistent errors, composable |
| UUID validation | Regex patterns | Zod `z.string().uuid()` | Handles all UUID versions correctly |
| Query param parsing | Manual parseInt/split | URLSearchParams + Zod coerce | Edge cases (empty, malformed) handled |
| Error formatting | Ad-hoc JSON structures | RFC 9457 helper | Industry standard, machine-parseable |
| Date validation | Custom parsing | Zod `z.coerce.date()` | Handles ISO strings, timestamps |

**Key insight:** Zod provides both runtime validation and compile-time type safety from a single schema definition. Manual validation code diverges from types over time.

## Common Pitfalls

### Pitfall 1: Dynamic Route Parameter Access
**What goes wrong:** Assuming Vercel injects params like Next.js App Router does
**Why it happens:** Documentation focuses on Next.js patterns; raw /api directory differs
**How to avoid:** Always extract params from URL path manually
**Warning signs:** `params` or `context.params` is undefined

### Pitfall 2: Repository Instance Per Request
**What goes wrong:** Creating new ContextRepository/MessageRepository in each handler
**Why it happens:** Intuitive pattern from non-serverless development
**How to avoid:** Create instances at module scope, pass db at construction
**Warning signs:** Cold start times > 500ms, connection pool exhaustion

### Pitfall 3: Missing Error Handling for JSON Parsing
**What goes wrong:** `await request.json()` throws on malformed JSON
**Why it happens:** Easy to forget request body can be invalid
**How to avoid:** Wrap in try/catch or use helper function
**Warning signs:** 500 errors on malformed POST requests

### Pitfall 4: Testing Imports with vi.mock Hoisting
**What goes wrong:** Mocks don't apply because import runs before mock setup
**Why it happens:** vi.mock is hoisted but not intuitive
**How to avoid:** Use vi.mock at top of file; use factory function for dynamic mocks
**Warning signs:** Real implementations called instead of mocks

### Pitfall 5: Integration Test Isolation
**What goes wrong:** Tests pass individually, fail when run together
**Why it happens:** Database state persists between tests
**How to avoid:** Clean tables in beforeEach (existing pattern works)
**Warning signs:** Flaky tests, order-dependent failures

## Code Examples

Verified patterns from official sources and existing codebase:

### Complete API Endpoint (POST /api/v1/contexts)
```typescript
// api/v1/contexts/index.ts
import { db } from "../../../src/db/client.js";
import { ContextRepository } from "../../../src/repositories/context.repository.js";
import { createContextSchema } from "../../../src/api/validation/schemas.js";
import { errorResponse, successResponse } from "../../../src/api/responses.js";

const repository = new ContextRepository(db);

export async function POST(request: Request): Promise<Response> {
  try {
    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "Invalid JSON", "Request body must be valid JSON");
    }

    const result = createContextSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(400, "Validation failed", result.error.flatten());
    }

    // Create context
    const context = await repository.create(result.data);

    return successResponse(201, { data: context });
  } catch (error) {
    console.error("[POST /api/v1/contexts] Error:", error);
    return errorResponse(500, "Internal server error");
  }
}
```

### Unit Test Pattern (Mocked Repository)
```typescript
// src/api/__tests__/contexts.unit.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock repository before importing handler
vi.mock("../../../src/repositories/context.repository.js", () => ({
  ContextRepository: vi.fn().mockImplementation(() => ({
    create: vi.fn(),
    findById: vi.fn(),
    softDelete: vi.fn(),
  })),
}));

// Mock db client
vi.mock("../../../src/db/client.js", () => ({
  db: {},
}));

import { POST } from "../../../api/v1/contexts/index.js";
import { ContextRepository } from "../../../src/repositories/context.repository.js";

describe("POST /api/v1/contexts", () => {
  const mockRepository = new ContextRepository({} as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates context with valid input", async () => {
    const mockContext = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Test Context",
      messageCount: 0,
      totalTokens: 0,
      latestVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    vi.mocked(mockRepository.create).mockResolvedValue(mockContext);

    const request = new Request("http://localhost/api/v1/contexts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Context" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.name).toBe("Test Context");
  });

  it("returns 400 for invalid JSON", async () => {
    const request = new Request("http://localhost/api/v1/contexts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
```

### Integration Test Pattern (Real Database)
```typescript
// src/api/__tests__/contexts.integration.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb, teardownTestDb, testDb } from "../../../vitest.setup.js";
import { contexts } from "../../db/schema/index.js";

// Import actual handlers (no mocks)
import { POST } from "../../../api/v1/contexts/index.js";
import { GET, DELETE } from "../../../api/v1/contexts/[id]/index.js";

describe("Contexts API Integration", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.delete(contexts);
  });

  it("full CRUD lifecycle", async () => {
    // Create
    const createRequest = new Request("http://localhost/api/v1/contexts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Integration Test" }),
    });

    const createResponse = await POST(createRequest);
    expect(createResponse.status).toBe(201);

    const { data: created } = await createResponse.json();
    expect(created.id).toBeDefined();

    // Read
    const getRequest = new Request(`http://localhost/api/v1/contexts/${created.id}`);
    const getResponse = await GET(getRequest);
    expect(getResponse.status).toBe(200);

    const { data: fetched } = await getResponse.json();
    expect(fetched.name).toBe("Integration Test");

    // Delete
    const deleteRequest = new Request(`http://localhost/api/v1/contexts/${created.id}`, {
      method: "DELETE",
    });
    const deleteResponse = await DELETE(deleteRequest);
    expect(deleteResponse.status).toBe(200);

    // Verify deleted
    const verifyRequest = new Request(`http://localhost/api/v1/contexts/${created.id}`);
    const verifyResponse = await GET(verifyRequest);
    expect(verifyResponse.status).toBe(404);
  });
});
```

### Helper: Extract Context ID from Path
```typescript
// src/api/helpers.ts
export function extractContextId(pathname: string): string | null {
  // Match /api/v1/contexts/{uuid}/...
  const match = pathname.match(/\/api\/v1\/contexts\/([^/]+)/);
  return match?.[1] ?? null;
}

export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @vercel/node types | Web standard Request/Response | 2024 | Simpler, portable code |
| Express-style req/res | Named HTTP method exports | 2024 | Better tree-shaking |
| Manual type guards | Zod safeParse | Ongoing | Type safety + runtime validation |
| Ad-hoc error formats | RFC 9457 Problem Details | 2023 | Standardized error handling |

**Deprecated/outdated:**
- `VercelRequest`/`VercelResponse` types: Replaced by web standard Request/Response (see existing health.ts)
- `export default function handler`: Replaced by named exports (GET, POST, etc.)

## Open Questions

Things that couldn't be fully resolved:

1. **Dynamic route param injection for /api directory**
   - What we know: Next.js App Router provides params via context argument
   - What's unclear: Whether Vercel /api directory has similar mechanism without Next.js
   - Recommendation: Use URL path parsing (safer, works everywhere)

2. **Integration test database isolation**
   - What we know: Existing tests use PGlite with beforeEach cleanup
   - What's unclear: Whether API integration tests need separate PGlite instance
   - Recommendation: Reuse existing vitest.setup.ts pattern; test handlers import the same testDb

## Sources

### Primary (HIGH confidence)
- [Vercel Functions API Reference](https://vercel.com/docs/functions/functions-api-reference) - Web handler signature, named exports
- [@vercel/functions Package](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package) - waitUntil, attachDatabasePool
- [Vitest Mocking Guide](https://vitest.dev/guide/mocking) - vi.mock, vi.spyOn patterns
- [Zod Documentation](https://zod.dev/) - Schema definition, safeParse, type inference
- Existing codebase: `api/health.ts`, `vitest.setup.ts`, repository tests

### Secondary (MEDIUM confidence)
- [RFC 9457 Problem Details](https://datatracker.ietf.org/doc/rfc9457/) - Error response format standard
- [Baeldung REST API Error Handling](https://www.baeldung.com/rest-api-error-handling-best-practices) - HTTP status code usage
- [Frontend DevOps Vercel API Guide](https://www.frontend-devops.com/blog/build-deploy-a-vercel-api) - Dynamic route parameters

### Tertiary (LOW confidence)
- Community discussions on Vercel/Next.js GitHub - Dynamic param injection for raw /api

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing dependencies + well-documented Zod
- Architecture: HIGH - Patterns proven in existing codebase (health.ts, repository tests)
- Pitfalls: HIGH - Based on actual framework behavior and existing test patterns

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable patterns)
