# Architecture Patterns

**Project:** Kata Context - Context Policy Engine
**Domain:** REST API with TypeScript/Python SDKs
**Researched:** 2026-01-29

## Executive Summary

Based on research into Vercel serverless architecture, TypeScript project organization, and multi-language SDK management, I recommend:

1. **Monorepo structure** using Turborepo + pnpm workspaces
2. **Pure serverless API** using Vercel Functions (not Next.js)
3. **Feature-first organization** within the API package
4. **Separate SDK packages** co-located in the monorepo

**Confidence:** HIGH for Vercel patterns, MEDIUM for SDK organization (based on industry examples)

---

## Recommended Architecture

### Decision: Monorepo (Not Polyrepo)

**Recommendation:** Monorepo with Turborepo + pnpm workspaces

**Rationale:**
- Single repository enables coordinated releases between API and SDKs
- Shared TypeScript types between API and TypeScript SDK
- Unified CI/CD pipeline
- AI tooling benefits from full context visibility
- Apache 2.0 licensing applies uniformly

**Trade-off accepted:** Python SDK will need its own tooling (Poetry/pip) within the monorepo, but Turborepo can orchestrate Python builds.

**Sources:**
- [Turborepo Repository Structure](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)
- [Monorepo vs Polyrepo Analysis](https://www.aviator.co/blog/monorepo-vs-polyrepo/)

### Decision: Pure Vercel Functions (Not Next.js)

**Recommendation:** Use Vercel Functions directly with the `/api` directory pattern

**Rationale:**
- Kata Context is a REST API, not a web application
- No need for React, SSR, or frontend routing
- Zero-configuration deployment with `/api` directory
- Lower complexity and smaller bundle sizes
- Direct access to Vercel's Fluid Compute features

**What we avoid:**
- Next.js App Router vs Pages Router complexity
- Unnecessary React Server Components
- Frontend build overhead

**Sources:**
- [Vercel Functions Documentation](https://vercel.com/docs/functions)
- [Hosting Backend APIs on Vercel](https://vercel.com/kb/guide/hosting-backend-apis)

---

## Directory Structure

### Complete Monorepo Layout

```
kata-context/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Unified CI pipeline
│       ├── release-api.yml           # API deployment
│       ├── release-sdk-ts.yml        # npm publish
│       └── release-sdk-python.yml    # PyPI publish
│
├── .planning/                        # Kata planning artifacts
│   ├── PROJECT.md
│   ├── ROADMAP.md
│   └── research/
│
├── apps/
│   └── api/                          # Vercel serverless API
│       ├── api/                      # Vercel Functions (route handlers)
│       │   ├── v1/
│       │   │   ├── policies/
│       │   │   │   ├── index.ts      # GET /api/v1/policies
│       │   │   │   ├── [id].ts       # GET/PUT/DELETE /api/v1/policies/:id
│       │   │   │   └── evaluate.ts   # POST /api/v1/policies/evaluate
│       │   │   ├── contexts/
│       │   │   │   ├── index.ts
│       │   │   │   └── [id].ts
│       │   │   └── health.ts         # GET /api/v1/health
│       │   └── health.ts             # GET /api/health (root health check)
│       │
│       ├── src/                      # Application source code
│       │   ├── domain/               # Core business logic
│       │   │   ├── policy/
│       │   │   │   ├── policy.ts
│       │   │   │   ├── policy.service.ts
│       │   │   │   └── policy.repository.ts
│       │   │   └── context/
│       │   │       ├── context.ts
│       │   │       ├── context.service.ts
│       │   │       └── context.repository.ts
│       │   │
│       │   ├── infrastructure/       # External integrations
│       │   │   ├── database/
│       │   │   │   └── client.ts
│       │   │   └── cache/
│       │   │       └── client.ts
│       │   │
│       │   ├── shared/               # Cross-cutting concerns
│       │   │   ├── errors/
│       │   │   │   └── api-error.ts
│       │   │   ├── middleware/
│       │   │   │   ├── auth.ts
│       │   │   │   └── validation.ts
│       │   │   └── utils/
│       │   │       └── response.ts
│       │   │
│       │   └── types/                # TypeScript type definitions
│       │       └── index.ts
│       │
│       ├── package.json
│       ├── tsconfig.json
│       └── vercel.ts                 # Vercel configuration
│
├── packages/
│   ├── typescript-sdk/               # @kata/context TypeScript SDK
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── client.ts
│   │   │   ├── types.ts
│   │   │   └── errors.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   │
│   ├── python-sdk/                   # kata-context Python SDK
│   │   ├── kata_context/
│   │   │   ├── __init__.py
│   │   │   ├── client.py
│   │   │   ├── types.py
│   │   │   └── errors.py
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── README.md
│   │
│   └── shared-types/                 # Shared TypeScript types (optional)
│       ├── src/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── turbo.json                        # Turborepo configuration
├── pnpm-workspace.yaml               # pnpm workspace definition
├── package.json                      # Root package.json
├── tsconfig.base.json                # Shared TypeScript config
├── .eslintrc.js                      # Shared ESLint config
├── .prettierrc                       # Shared Prettier config
└── README.md
```

### Key Structural Decisions

#### 1. API Routes in `/api` Directory

Vercel automatically creates serverless functions from files in the `/api` directory. Each file becomes an endpoint:

```
api/v1/policies/index.ts    -> GET/POST /api/v1/policies
api/v1/policies/[id].ts     -> GET/PUT/DELETE /api/v1/policies/:id
api/v1/policies/evaluate.ts -> POST /api/v1/policies/evaluate
```

**Why this pattern:**
- Zero-configuration routing
- File-based routing is explicit and discoverable
- Dynamic routes via `[param].ts` syntax
- Vercel handles function bundling automatically

#### 2. Feature-First Domain Organization

Within `/src/domain/`, organize by business domain, not by technical layer:

```
domain/
├── policy/           # Everything about policies
│   ├── policy.ts           # Domain entity
│   ├── policy.service.ts   # Business logic
│   └── policy.repository.ts # Data access
└── context/          # Everything about contexts
    ├── context.ts
    ├── context.service.ts
    └── context.repository.ts
```

**Why this pattern:**
- Co-locates related code
- Scales better than layer-first (controllers/, services/, models/)
- Easier to reason about a single feature
- Supports future microservice extraction if needed

#### 3. SDK Package Naming

| Package | npm/PyPI Name | Import |
|---------|---------------|--------|
| TypeScript SDK | `@kata/context` | `import { KataContext } from '@kata/context'` |
| Python SDK | `kata-context` | `from kata_context import KataContext` |

---

## Configuration Files

### Root package.json

```json
{
  "name": "kata-context",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "format": "prettier --write \"**/*.{ts,tsx,md}\""
  },
  "devDependencies": {
    "turbo": "^2.x",
    "prettier": "^3.x",
    "eslint": "^9.x",
    "typescript": "^5.x"
  },
  "packageManager": "pnpm@9.x"
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", ".vercel/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

### apps/api/vercel.ts

```typescript
import { routes, type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  // Enable Fluid Compute for better concurrency
  fluid: true,

  // Clean URLs (no .ts/.js extensions)
  cleanUrls: true,

  // Trailing slash handling
  trailingSlash: false,

  // API versioning via rewrites (optional, for future versions)
  rewrites: [
    // Latest version alias
    routes.rewrite('/api/policies/(.*)', '/api/v1/policies/$1'),
    routes.rewrite('/api/contexts/(.*)', '/api/v1/contexts/$1'),
  ],

  // CORS headers for SDK access
  headers: [
    routes.header('/api/(.*)', [
      { key: 'Access-Control-Allow-Origin', value: '*' },
      { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
      { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
    ]),
  ],

  // Function configuration
  functions: {
    'api/**/*.ts': {
      maxDuration: 30,
    },
  },
};
```

### apps/api/tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "api/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Component Boundaries

### API Layer Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| Route Handlers (`api/`) | HTTP request/response, validation | Domain Services |
| Domain Services (`src/domain/*/service.ts`) | Business logic, orchestration | Repositories, other Services |
| Repositories (`src/domain/*/repository.ts`) | Data access abstraction | Infrastructure (Database) |
| Infrastructure (`src/infrastructure/`) | External service clients | External APIs, databases |

### Data Flow

```
Request → Route Handler → Validation → Service → Repository → Database
                                            ↓
Response ← Route Handler ← Service ← Domain Entity
```

### SDK Layer Responsibilities

| Component | Responsibility |
|-----------|----------------|
| Client | HTTP client wrapper, authentication |
| Types | TypeScript/Python type definitions matching API |
| Errors | Domain-specific error handling |

---

## Patterns to Follow

### Pattern 1: Vercel Function Handler

**What:** Standard pattern for Vercel serverless functions with typed request/response.

**When:** Every API route handler.

**Example:**

```typescript
// api/v1/policies/[id].ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PolicyService } from '@/domain/policy/policy.service';
import { ApiError } from '@/shared/errors/api-error';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const { id } = request.query;

  if (typeof id !== 'string') {
    return response.status(400).json({ error: 'Invalid policy ID' });
  }

  try {
    switch (request.method) {
      case 'GET':
        const policy = await PolicyService.getById(id);
        if (!policy) {
          return response.status(404).json({ error: 'Policy not found' });
        }
        return response.status(200).json(policy);

      case 'PUT':
        const updated = await PolicyService.update(id, request.body);
        return response.status(200).json(updated);

      case 'DELETE':
        await PolicyService.delete(id);
        return response.status(204).end();

      default:
        response.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return response.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return response.status(error.statusCode).json({ error: error.message });
    }
    console.error('Unexpected error:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
}
```

### Pattern 2: Service Layer Abstraction

**What:** Business logic isolated from HTTP concerns.

**When:** Any non-trivial business logic.

**Example:**

```typescript
// src/domain/policy/policy.service.ts
import { PolicyRepository } from './policy.repository';
import type { Policy, CreatePolicyInput, UpdatePolicyInput } from './policy';

export class PolicyService {
  static async getById(id: string): Promise<Policy | null> {
    return PolicyRepository.findById(id);
  }

  static async create(input: CreatePolicyInput): Promise<Policy> {
    // Business validation
    this.validatePolicyRules(input.rules);

    return PolicyRepository.create(input);
  }

  static async evaluate(policyId: string, context: Record<string, unknown>): Promise<boolean> {
    const policy = await this.getById(policyId);
    if (!policy) {
      throw new NotFoundError('Policy not found');
    }

    // Core evaluation logic
    return this.evaluateRules(policy.rules, context);
  }

  private static validatePolicyRules(rules: unknown): void {
    // Validation logic
  }

  private static evaluateRules(rules: PolicyRule[], context: Record<string, unknown>): boolean {
    // Evaluation logic
  }
}
```

### Pattern 3: Shared Types Between API and TypeScript SDK

**What:** Single source of truth for TypeScript types.

**When:** API response shapes, request bodies.

**Example:**

```typescript
// packages/shared-types/src/index.ts
export interface Policy {
  id: string;
  name: string;
  description?: string;
  rules: PolicyRule[];
  createdAt: string;
  updatedAt: string;
}

export interface PolicyRule {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'in';
  value: unknown;
}

export interface EvaluationResult {
  allowed: boolean;
  policyId: string;
  matchedRules: string[];
  evaluatedAt: string;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Fat Route Handlers

**What:** Putting business logic directly in route handlers.

**Why bad:**
- Untestable without HTTP mocking
- Logic cannot be reused
- Handlers become unmaintainable

**Instead:**
- Route handlers only handle HTTP concerns
- Delegate to service layer for business logic
- Services are pure functions, easily testable

### Anti-Pattern 2: Layer-First Organization

**What:** Organizing by technical layer (`controllers/`, `services/`, `models/`).

**Why bad:**
- Related code scattered across directories
- Adding a feature touches many directories
- Harder to understand feature boundaries

**Instead:**
- Feature-first organization (`policy/`, `context/`)
- Each feature contains its controller, service, repository
- Cross-cutting concerns in `shared/`

### Anti-Pattern 3: Next.js for Pure APIs

**What:** Using Next.js when you only need an API.

**Why bad:**
- Unnecessary React/frontend overhead
- App Router vs Pages Router complexity
- Larger bundle sizes
- Build time overhead

**Instead:**
- Pure Vercel Functions with `/api` directory
- Only add Next.js if you need a frontend

### Anti-Pattern 4: Polyrepo for Tightly Coupled Components

**What:** Separate repositories for API and SDKs when they share types/releases.

**Why bad:**
- Version coordination complexity
- Type drift between API and SDKs
- Multiple CI/CD pipelines to maintain
- Harder for contributors

**Instead:**
- Monorepo with Turborepo
- Shared types package
- Coordinated releases

---

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| **Request handling** | Single region Vercel Functions | Multi-region deployment | Multi-region + edge caching |
| **Database** | Serverless DB (Turso, Neon) | Serverless DB with read replicas | Dedicated database + caching layer |
| **Caching** | None needed | Vercel Edge Cache | Redis/Upstash + Edge Cache |
| **Rate limiting** | Basic (per-IP) | API key based | Token bucket with Redis |
| **SDK distribution** | npm/PyPI | npm/PyPI + CDN | npm/PyPI + CDN + enterprise support |

### Vercel Function Limits to Consider

| Limit | Hobby | Pro | Enterprise |
|-------|-------|-----|------------|
| Duration | 10s | 60s (default 15s) | 900s (default 15s) |
| Memory | 1024MB | Configurable | Configurable |
| Payload | 4.5MB | 4.5MB | 4.5MB |

**Source:** [Vercel Functions Documentation](https://vercel.com/docs/functions)

---

## Sources

### HIGH Confidence (Official Documentation)
- [Vercel Functions](https://vercel.com/docs/functions) - Serverless function patterns
- [Vercel vercel.ts Configuration](https://vercel.com/docs/project-configuration/vercel-ts) - Programmatic configuration
- [Turborepo Repository Structure](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository) - Monorepo patterns

### MEDIUM Confidence (Verified Patterns)
- [Hosting Backend APIs on Vercel](https://vercel.com/kb/guide/hosting-backend-apis) - Pure API deployment
- [Monorepo Tools Comparison](https://monorepo.tools/) - Tool ecosystem overview

### LOW Confidence (Community Patterns)
- [Feature-First Organization](https://dev.to/pramod_boda/recommended-folder-structure-for-nodets-2025-39jl) - Modern TypeScript organization
- [Multi-Language Monorepo Examples](https://github.com/palmerhq/monorepo-starter) - Polyglot monorepo patterns
