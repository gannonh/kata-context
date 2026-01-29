# Research Summary: Kata Context v0.1.0 Core Setup

**Project:** Kata Context - Standalone context policy engine for AI agents
**Milestone:** v0.1.0 Core Setup
**Synthesized:** 2026-01-29
**Overall Confidence:** HIGH

---

## Executive Summary

Kata Context is a REST API-first context policy engine that will be deployed on Vercel's serverless platform with TypeScript and Python SDKs. Based on comprehensive research across stack choices, feature requirements, architecture patterns, and common pitfalls, the recommended approach is:

**Use modern, fast, TypeScript-native tooling**: Node.js 24.x (Vercel's current LTS), pnpm 10.x for packages, Biome for linting/formatting (20-35x faster than ESLint+Prettier), and Vitest for testing (10-20x faster than Jest). These tools are production-ready, well-documented, and designed for the serverless environment.

**Adopt a monorepo structure with pure Vercel Functions**: Use Turborepo + pnpm workspaces to co-locate the API, TypeScript SDK, and Python SDK. Deploy the API using Vercel's `/api` directory pattern (not Next.js) to avoid unnecessary React/frontend overhead. Organize code feature-first (`domain/policy/`, `domain/context/`) rather than layer-first to keep related code together and support future extraction.

**The biggest risks are configuration missteps in Phase 1**: The critical pitfalls all occur during initial setup: wrong module resolution settings (causes deployment failures), path aliases not resolved in production, ESM/CJS format mismatches, and environment variable confusion. These are preventable with correct TypeScript and Vercel configuration from day one, strict mode enabled immediately, and local testing with `vercel build` before first deployment. The research provides specific configuration templates to avoid these issues.

---

## Key Findings

### From STACK.md: Modern TypeScript Serverless Tooling

**Core Stack:**
- **Node.js 24.x** - Current Vercel default LTS (active through April 2028), native TypeScript type stripping
- **pnpm 10.x** - 70% disk savings vs npm, strict dependency isolation, Vercel auto-detects via lockfile
- **Biome 2.3.x** - Single tool for linting + formatting, 20-35x faster than ESLint+Prettier, 97% Prettier compatible
- **Vitest 4.x** - 10-20x faster than Jest, native ESM/TypeScript, Jest-compatible API
- **tsx 4.x** - Development TypeScript execution, 20-30x faster than ts-node

**TypeScript Configuration:**
- Target: ES2024 (Node.js 24 supports fully)
- Module: NodeNext (Node.js ESM with package.json type field support)
- Enable `strict: true`, `verbatimModuleSyntax: true`, `isolatedModules: true`
- Use `noEmit: true` - Vercel handles compilation

**What NOT to include:**
- Jest, ESLint+Prettier (slower alternatives)
- Webpack/Rollup/esbuild (Vercel handles bundling)
- Babel, nodemon, husky+lint-staged (unnecessary for v0.1.0)

**Confidence:** HIGH - Based on official Vercel documentation and verified benchmarks

### From FEATURES.md: Essential vs Deferred Features

**Table Stakes (Must Include):**
- TypeScript configuration (tsconfig.json) with strict mode
- Biome configuration (biome.json) for linting + formatting
- .gitignore with Node + Vercel-specific entries
- package.json scripts: dev, build, test, lint
- /api directory structure for Vercel Functions
- Environment variable handling (.env.example)
- Node.js version specification (.nvmrc or engines)
- README with setup instructions

**Differentiators (Recommended):**
- Vitest test configuration (modern, fast testing)
- Strict TypeScript settings (noUncheckedIndexedAccess, noImplicitReturns)
- vercel.json configuration (explicit function limits)
- GitHub Actions CI workflow (lint + test only, not full CD)
- EditorConfig and VS Code workspace settings

**Anti-Features (Explicitly Avoid):**
- Full GitHub Actions CD pipeline (use Vercel's Git integration)
- Database configuration (defer to storage layer milestone)
- API routes with business logic (single health check only)
- Authentication/authorization (defer to security milestone)
- Logging infrastructure, error monitoring (add during production hardening)
- Complex folder structure (minimal: /api, /src, /tests)
- Monorepo setup (single package until proven need for SDK phase)
- Custom build tooling (trust Vercel's build system)
- API versioning, rate limiting (add when API stabilizes)

**Confidence:** HIGH - Based on Vercel's zero-config philosophy and verified best practices

### From ARCHITECTURE.md: Monorepo with Pure Serverless

**Critical Architectural Decisions:**

1. **Monorepo (not Polyrepo)**: Use Turborepo + pnpm workspaces
   - Enables coordinated releases between API and SDKs
   - Shared TypeScript types between API and TypeScript SDK
   - AI tooling benefits from full context visibility
   - Accepted trade-off: Python SDK needs its own tooling within monorepo

2. **Pure Vercel Functions (not Next.js)**: Use `/api` directory pattern
   - Kata Context is a REST API, not a web application
   - No need for React, SSR, or frontend routing
   - Zero-configuration deployment, lower complexity, smaller bundles

**Directory Structure (Simplified for v0.1.0):**
```
kata-context/
├── .planning/              # Kata planning artifacts
├── api/                    # Vercel Functions
│   └── health.ts          # GET /api/health
├── src/                    # Shared code (placeholder for v0.1.0)
├── tests/                  # Tests
│   └── health.test.ts     # Smoke test
├── package.json
├── tsconfig.json
├── biome.json
└── vercel.json
```

**Note:** Full monorepo structure with `apps/api/`, `packages/typescript-sdk/`, `packages/python-sdk/` deferred to SDK phase. Start simple for v0.1.0.

**Patterns to Follow:**
- **Vercel Function Handler**: Standard typed request/response pattern
- **Feature-First Organization**: When adding domain code, organize by business domain (`domain/policy/`, `domain/context/`) not by layer
- **Shared Types**: Single source of truth for TypeScript types (implement when SDK phase begins)

**Anti-Patterns to Avoid:**
- Fat route handlers (keep business logic in services)
- Layer-first organization (controllers/, services/, models/)
- Next.js for pure APIs
- Polyrepo for tightly coupled components

**Confidence:** HIGH for Vercel patterns, MEDIUM for full monorepo structure (implement incrementally)

### From PITFALLS.md: Configuration Mistakes to Avoid

**Critical Pitfalls (Phase 1 - Cause Rewrites):**

1. **Path Aliases Not Resolved in Compiled Output**
   - TypeScript paths are type-checking only; `tsc` doesn't rewrite imports
   - Prevention: Either configure bundler to match tsconfig OR avoid path aliases entirely
   - For Vercel serverless: Consider avoiding aliases since functions may bundle differently

2. **Wrong Module Resolution Strategy**
   - `moduleResolution: "bundler"` vs `moduleResolution: "node16"` are incompatible
   - Prevention: For Vercel Functions with bundling use `moduleResolution: "bundler"` + `module: "ESNext"`
   - Must match module and moduleResolution values

3. **Environment Variables Baked at Build Time vs Runtime**
   - Next.js replaces `process.env.VARIABLE` at build time for client code
   - Prevention: Use Vercel's environment variable scoping per environment
   - For Kata Context: Pure API means all env vars are runtime (simpler)

4. **ESM/CJS Module Format Mismatch**
   - `"type": "module"` in package.json makes all .js files ESM
   - Prevention: Pick ESM for new projects, add `"type": "module"`, set `module: "ESNext"` in tsconfig

**Moderate Pitfalls (Phase 1 - Cause Delays):**

5. **Biome/Prettier Configuration** (Less applicable with Biome-only approach)
   - Prevention: Use Biome exclusively to eliminate conflicts

6. **Testing Setup Not Matching Runtime**
   - Prevention: Pin Node.js version with .nvmrc, enable strict async TypeScript rules

7. **Choosing Edge Functions When Serverless Required**
   - Prevention: Default to Serverless Functions (use Edge only for auth checks, redirects)

8. **Large Bundle Sizes Causing Cold Starts**
   - Prevention: Choose lightweight dependencies from start, analyze bundles before adding dependencies

9. **Not Enabling TypeScript Strict Mode**
   - Prevention: Enable `strict: true` on day one, add `noUncheckedIndexedAccess: true`

**Minor Pitfalls (Quick Fixes):**

10. **Utility Files in /api Directory**: Prefix with underscore or place outside /api
11. **vercel.json Overrides Build Settings**: Pick one source of truth
12. **Forgetting to Pin Dependency Versions**: Use lockfile and commit it

**Confidence:** HIGH - Based on official documentation and verified community issues

---

## Implications for Roadmap

### Suggested Phase Structure

Based on combined research, v0.1.0 Core Setup should be broken into focused phases:

#### Phase 1: Project Initialization (Foundation)
**Rationale:** Get configuration right before writing any code. All critical pitfalls occur here.

**Delivers:**
- Project structure (single package, not monorepo yet)
- TypeScript configuration with strict mode
- pnpm workspace initialization
- Node.js version pinning

**Features from FEATURES.md:**
- tsconfig.json (strict: true, moduleResolution: bundler, module: ESNext)
- package.json with engines field
- .nvmrc file
- .gitignore

**Pitfalls to avoid:**
- Wrong module resolution (Pitfall 2)
- ESM/CJS mismatch (Pitfall 4)
- Not enabling strict mode (Pitfall 9)

**Research needed:** None - well-documented patterns

---

#### Phase 2: Developer Tooling
**Rationale:** Set up quality and testing tools while codebase is small and easy to configure.

**Delivers:**
- Linting and formatting with Biome
- Testing framework with Vitest
- Basic CI workflow

**Features from FEATURES.md:**
- biome.json configuration
- vitest.config.ts
- package.json scripts (dev, build, test, lint)
- .github/workflows/ci.yml (lint + test only)
- .vscode/settings.json (optional but recommended)

**Pitfalls to avoid:**
- Biome misconfiguration (minimal risk, single tool)
- Testing environment mismatch (Pitfall 6)

**Research needed:** None - straightforward setup

---

#### Phase 3: Vercel Functions Setup
**Rationale:** Deploy simplest possible serverless function to verify configuration works end-to-end.

**Delivers:**
- /api directory structure
- Health check endpoint
- Vercel configuration
- Local development workflow
- First deployment

**Features from FEATURES.md:**
- /api/health.ts (GET /api/health returns {status: "ok"})
- vercel.json configuration
- .env.example
- tests/health.test.ts (smoke test)
- README with setup instructions

**Pitfalls to avoid:**
- Path aliases not resolved (Pitfall 1)
- Utility files becoming functions (Pitfall 10)
- vercel.json overrides (Pitfall 11)
- Not testing `vercel build` locally (Pitfall 3)

**Research needed:** None - pure Vercel Functions pattern is well-documented

---

### Architecture Evolution

**v0.1.0 (Current Milestone):** Single package, minimal structure
- Simple `/api`, `/src`, `/tests` directories
- No monorepo complexity
- Focus on getting configuration right

**v0.2.0 (Storage Layer):** Add database integration
- Still single package
- Add database client configuration
- Watch out for cold start timeouts (Pitfall 8)

**v0.3.0 (SDK Phase):** Migrate to monorepo
- Introduce Turborepo + pnpm workspaces
- Refactor to `apps/api/`, `packages/typescript-sdk/`, `packages/python-sdk/`
- Implement shared types package

**v1.0.0 (Production):** Harden and optimize
- Add logging infrastructure
- Add error monitoring
- Implement rate limiting
- Multi-region deployment considerations

---

## Research Flags

### Phases Needing Deeper Research

**Phase 2.5 (Database Integration - future milestone):**
- Needs `/kata:research-phase` for database choice and connection pooling patterns
- Serverless-specific database considerations
- Cold start mitigation strategies

**Phase 3.5 (SDK Architecture - future milestone):**
- Needs `/kata:research-phase` for Python SDK packaging and distribution
- Type generation from API schema
- Multi-language error handling patterns

### Phases with Standard Patterns (Skip Research)

**Phase 1-3 (v0.1.0):** Well-documented, no additional research needed
- TypeScript + Vercel serverless patterns are mature
- Biome and Vitest have straightforward setup
- Pure API deployment is Vercel's core use case

---

## Confidence Assessment

| Area         | Confidence | Notes                                                                                     |
| ------------ | ---------- | ----------------------------------------------------------------------------------------- |
| Stack        | HIGH       | Official Vercel docs, verified benchmarks, current LTS versions identified                |
| Features     | HIGH       | Clear table stakes vs differentiators, anti-features well-justified from Vercel patterns  |
| Architecture | HIGH       | Pure Vercel Functions pattern is officially documented; monorepo deferred to later phase  |
| Pitfalls     | HIGH       | Based on official docs, community issues, and verified incidents; specific to TypeScript + Vercel |

### Gaps to Address

**Identified gaps that need attention during planning:**

1. **Database selection deferred**: Not researched yet, intentionally deferred to v0.2.0 Storage milestone
   - Will need research on serverless-optimized databases (Neon, Turso, etc.)
   - Connection pooling and cold start strategies

2. **Python SDK tooling**: Mentioned but not deeply researched
   - Defer to SDK phase when implementing packages/python-sdk/
   - Will need research on Poetry vs pip, PyPI publishing, type stubs

3. **Production hardening details**: Logging, monitoring, rate limiting mentioned as anti-features for v0.1.0
   - Correctly deferred, but will need research when implementing
   - Consider Vercel Observability, Sentry integration, Upstash rate limiting

4. **Monorepo migration path**: Architecture research focused on final state
   - Need to document migration steps from single package to monorepo
   - When to introduce Turborepo (likely during SDK phase)

**These gaps are acceptable for v0.1.0** because they're explicitly deferred to later milestones.

---

## Ready for Requirements

### What We Know with Confidence

1. **Stack is locked in**: Node.js 24.x, pnpm 10.x, Biome 2.3.x, Vitest 4.x, tsx 4.x, TypeScript 5.9.x
2. **Architecture is clear**: Start simple (single package), pure Vercel Functions, feature-first organization
3. **Critical risks identified**: All Phase 1 configuration pitfalls documented with prevention strategies
4. **Feature scope is bounded**: Table stakes defined, anti-features identified, defer database/auth/monitoring

### Specific Recommendations for Roadmapper

**Phase 1 duration estimate:** 1-2 hours (mostly configuration files)
- High confidence because patterns are well-documented
- No complex decisions, just following Vercel best practices

**Phase 2 duration estimate:** 2-3 hours (Biome + Vitest + CI)
- Straightforward tool setup
- CI workflow is minimal (lint + test)

**Phase 3 duration estimate:** 2-3 hours (health check + deployment)
- Simple endpoint implementation
- First Vercel deployment verification
- Documentation of setup process

**Total v0.1.0 estimate:** 5-8 hours of focused work

**Risk factors:**
- LOW: Configuration is well-specified
- MEDIUM: First Vercel deployment might reveal environment-specific issues
- Mitigation: Test `vercel build` locally before deploying

**Validation checkpoints:**
- Phase 1: `pnpm install` and `tsc --noEmit` pass
- Phase 2: `pnpm test` and `pnpm lint` pass in CI
- Phase 3: Health check returns 200 OK in production deployment

---

## Sources

### STACK.md Sources
- [pnpm vs npm vs yarn vs Bun: The 2026 Package Manager Showdown](https://dev.to/pockit_tools/pnpm-vs-npm-vs-yarn-vs-bun-the-2026-package-manager-showdown-51dc)
- [Biome Official Site](https://biomejs.dev/) (v2.3.13)
- [Biome: Complete Migration Guide for 2026](https://dev.to/pockit_tools/biome-the-eslint-and-prettier-killer-complete-migration-guide-for-2026-27m)
- [Vitest Official Site](https://vitest.dev/) (v4.0.18)
- [Vitest vs Jest 30: 2026 Browser-Native Testing](https://dev.to/dataformathub/vitest-vs-jest-30-why-2026-is-the-year-of-browser-native-testing-2fgb)
- [TypeScript 5.9 Documentation](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html)
- [Vercel Functions Documentation](https://vercel.com/docs/functions)
- [Vercel Node.js Runtime](https://vercel.com/docs/functions/runtimes/node-js)

### FEATURES.md Sources
- [Vercel Functions Documentation](https://vercel.com/docs/functions)
- [Vercel Project Configuration](https://vercel.com/docs/project-configuration)
- [TypeScript TSConfig Reference](https://www.typescriptlang.org/tsconfig/)
- [Vitest Configuration Guide](https://vitest.dev/config/)
- [ESLint + Prettier Configuration (2026)](https://medium.com/@osmion/prettier-eslint-configuration-that-actually-works-without-the-headaches-a8506b710d21)

### ARCHITECTURE.md Sources
- [Vercel Functions](https://vercel.com/docs/functions)
- [Vercel vercel.ts Configuration](https://vercel.com/docs/project-configuration/vercel-ts)
- [Turborepo Repository Structure](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)
- [Hosting Backend APIs on Vercel](https://vercel.com/kb/guide/hosting-backend-apis)
- [Monorepo Tools Comparison](https://monorepo.tools/)

### PITFALLS.md Sources
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [TypeScript moduleResolution docs](https://www.typescriptlang.org/tsconfig/moduleResolution.html)
- [Next.js Discussion #41189](https://github.com/vercel/next.js/discussions/41189)
- [Vercel Community: TypeScript serverless functions](https://community.vercel.com/t/deploying-typescript-serverless-functions/4029)
- [eslint-config-prettier GitHub](https://github.com/prettier/eslint-config-prettier)
- [Vercel Cold Start Performance guide](https://vercel.com/kb/guide/how-can-i-improve-serverless-function-lambda-cold-start-performance-on-vercel)
- [Why strict: true isn't enough](https://itnext.io/why-typescripts-strict-true-isn-t-enough-missing-compiler-flags-for-production-code-a3877b81142c)

---

**Synthesis Complete:** All research files synthesized. Ready for roadmap creation.
