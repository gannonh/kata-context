# Phase 2: Automation and Deployment - Research

**Researched:** 2026-01-29
**Domain:** Git hooks, CI/CD, Vercel serverless functions
**Confidence:** HIGH

## Summary

This phase implements development automation (pre-commit hooks) and deployment infrastructure (GitHub Actions CI, Vercel serverless functions). The standard stack is well-established: Husky v9 for git hooks, lint-staged v16 for staged-file-only checks, GitHub Actions for CI, and Vercel's `/api` directory for serverless functions.

Husky v9 introduced a simplified architecture using Git's native `core.hooksPath` feature, making it lighter and more reliable. lint-staged v16 provides ESM support and integrates seamlessly with Biome through the `biome check` command. GitHub Actions has mature support for pnpm via `pnpm/action-setup@v4` with built-in caching. Vercel Functions now use a Web Standard-based API (`fetch` handler pattern) and support TypeScript natively.

**Primary recommendation:** Use Husky v9 + lint-staged v16 for pre-commit hooks running `biome check --write`, GitHub Actions with pnpm caching for CI, and Vercel's `/api` directory with the `fetch` handler pattern for serverless functions.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| husky | 9.1.7 | Git hooks management | Native Git hooks via core.hooksPath; lightweight; v9 simplified architecture |
| lint-staged | 16.2.7 | Run tasks on staged files | ESM support; prevents linting entire codebase on commit |
| vercel | 50.9.3 | CLI for local builds and deployment | Official Vercel CLI; `vercel build` validates functions locally |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pinst | latest | Disable postinstall in publish | Only needed if publishing to npm (prevents husky install for consumers) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| husky + lint-staged | lefthook | Lefthook is faster but less ecosystem integration; Husky is JavaScript-standard |
| lint-staged | biome --staged | Direct biome invocation is simpler but less flexible for multi-tool setups |
| GitHub Actions | GitLab CI | GitHub Actions has better pnpm support and Vercel integration |

**Installation:**
```bash
pnpm add --save-dev --save-exact husky@9.1.7 lint-staged@16.2.7
```

**Note:** Vercel CLI should be installed globally for local testing: `npm i -g vercel`

## Architecture Patterns

### Recommended Project Structure
```
.
├── .husky/
│   └── pre-commit          # Git hook script
├── .github/
│   └── workflows/
│       └── ci.yml          # GitHub Actions CI workflow
├── api/
│   └── health.ts           # Vercel serverless function
├── src/                    # Application source
├── package.json            # lint-staged config embedded
└── vercel.json             # Vercel configuration (optional)
```

### Pattern 1: Husky v9 Setup with pnpm
**What:** Configure Husky to run lint-staged on pre-commit
**When to use:** All projects requiring pre-commit validation

```bash
# Installation
pnpm add --save-dev husky lint-staged

# Initialize (creates .husky/ and adds prepare script)
pnpm exec husky init
```

```json
// package.json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{js,ts,jsx,tsx,json,jsonc}": [
      "biome check --write --no-errors-on-unmatched --files-ignore-unknown=true"
    ]
  }
}
```

```bash
# .husky/pre-commit
pnpm exec lint-staged
```

### Pattern 2: GitHub Actions CI with pnpm Caching
**What:** CI workflow that runs lint and test on push/PR
**When to use:** All projects using GitHub and pnpm

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  HUSKY: 0  # Disable husky in CI

jobs:
  lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run test
```

### Pattern 3: Vercel Serverless Function (Web Standard)
**What:** API endpoint using Vercel's recommended fetch handler pattern
**When to use:** Standalone Vercel functions (non-Next.js)

```typescript
// api/health.ts
// Source: https://vercel.com/docs/functions/functions-api-reference
export default {
  fetch(request: Request): Response {
    return Response.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "unknown",
    });
  },
};
```

### Pattern 4: Vercel Function with HTTP Methods
**What:** Alternative pattern using explicit HTTP method exports
**When to use:** When you need method-specific handlers

```typescript
// api/health.ts
export function GET(request: Request): Response {
  return Response.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
}
```

### Anti-Patterns to Avoid

- **Running biome on all files in pre-commit:** Use lint-staged to only check staged files; full-repo checks are slow
- **Caching node_modules in CI:** pnpm's symlink structure breaks; cache only pnpm store (setup-node does this correctly)
- **Using --no-verify to skip hooks:** Indicates hooks are too slow or broken; fix the root cause
- **Omitting --frozen-lockfile in CI:** Without it, pnpm may update the lockfile, causing non-reproducible builds
- **Using legacy Vercel function signature:** The old `(req, res)` pattern doesn't support streaming; use `fetch` handler

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pre-commit validation | Shell scripts in .git/hooks | Husky + lint-staged | Manual hooks aren't versioned; Husky manages lifecycle |
| Staged file filtering | Custom git diff parsing | lint-staged | Edge cases with renames, deletes, binary files |
| CI caching | Manual cache actions | pnpm/action-setup cache | Built-in handles cache keys, pruning, restoration |
| Local Vercel testing | Custom dev server | `vercel dev` / `vercel build` | Replicates production environment accurately |

**Key insight:** Git hooks and CI are deceptively complex. Husky and lint-staged handle edge cases (renamed files, deleted files, partial staging) that custom solutions miss. Vercel CLI accurately replicates the deployment environment.

## Common Pitfalls

### Pitfall 1: Husky Not Running After Clone
**What goes wrong:** New team members clone repo, hooks don't work
**Why it happens:** Git hooks aren't cloned; must be installed via `prepare` script
**How to avoid:** Ensure `"prepare": "husky"` is in package.json; runs automatically on `pnpm install`
**Warning signs:** "Hooks aren't running for me" from new contributors

### Pitfall 2: CI Installing Husky
**What goes wrong:** CI job fails or slows down installing Git hooks
**Why it happens:** `prepare` script runs on `pnpm install`
**How to avoid:** Set `HUSKY=0` environment variable in CI workflow
**Warning signs:** CI logs showing husky installation

### Pitfall 3: lint-staged Failures on Delete
**What goes wrong:** Pre-commit fails when files are deleted
**Why it happens:** lint-staged tries to run commands on deleted files
**How to avoid:** Use `--no-errors-on-unmatched` flag with Biome
**Warning signs:** "File not found" errors during commit

### Pitfall 4: Vercel Build Failing Locally
**What goes wrong:** `vercel build` fails with environment errors
**Why it happens:** Missing environment variables or project linking
**How to avoid:** Run `vercel pull` first to get project settings; use `vercel build --yes`
**Warning signs:** "Project not found" or "Missing environment variables"

### Pitfall 5: CI Cache Misses
**What goes wrong:** Every CI run reinstalls all dependencies
**Why it happens:** pnpm-lock.yaml not committed or cache key wrong
**How to avoid:** Always commit pnpm-lock.yaml; use `cache: 'pnpm'` in setup-node
**Warning signs:** Long install times, "Cache not found" in logs

### Pitfall 6: Vercel Function TypeScript Errors
**What goes wrong:** TypeScript errors about Response or Request types
**Why it happens:** Missing DOM lib types for Web Standard APIs
**How to avoid:** Ensure `"lib": ["ES2023", "DOM"]` or install `@vercel/node` types
**Warning signs:** "Cannot find name 'Response'" errors

## Code Examples

Verified patterns from official sources:

### Complete lint-staged Configuration for Biome
```json
// package.json - Source: https://biomejs.dev/recipes/git-hooks/
{
  "lint-staged": {
    "*.{js,ts,jsx,tsx,json,jsonc}": [
      "biome check --write --no-errors-on-unmatched --files-ignore-unknown=true"
    ]
  }
}
```

### Husky Pre-commit Hook
```bash
# .husky/pre-commit - Source: https://typicode.github.io/husky/get-started.html
pnpm exec lint-staged
```

### GitHub Actions CI Workflow
```yaml
# .github/workflows/ci.yml - Source: https://github.com/actions/setup-node
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  HUSKY: 0

jobs:
  lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm run lint

      - name: Test
        run: pnpm run test
```

### Vercel Health Check Endpoint
```typescript
// api/health.ts - Source: https://vercel.com/docs/functions/functions-api-reference
export default {
  fetch(request: Request): Response {
    return Response.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  },
};
```

### Alternative HTTP Method Pattern
```typescript
// api/health.ts - Source: https://vercel.com/docs/functions/quickstart
export function GET(request: Request): Response {
  return Response.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| husky v4 (npm scripts) | husky v9 (native Git) | v5+ (2021) | Lighter, faster, more reliable |
| Vercel `(req, res)` handler | Vercel `fetch` handler | 2024 | Web Standard compatible, streaming support |
| Manual CI caching | setup-node built-in cache | setup-node v3+ | Simpler configuration, automatic key generation |
| pinst for CI | HUSKY=0 env var | husky v9 | Simpler, no extra dependency needed |

**Deprecated/outdated:**
- **husky v4 pattern**: Old npm scripts approach; v9 uses Git's native core.hooksPath
- **Vercel req/res handlers**: Still work but don't support streaming; use fetch pattern
- **actions/cache for pnpm**: Not needed; setup-node handles caching directly

## Open Questions

Things that couldn't be fully resolved:

1. **Vercel TypeScript compilation for /api**
   - What we know: Vercel compiles TypeScript automatically without tsconfig
   - What's unclear: Whether project tsconfig.json is respected for /api functions
   - Recommendation: Test `vercel build` locally; may need vercel.json configuration

2. **DOM types for Vercel functions**
   - What we know: Request/Response are Web Standard APIs requiring DOM lib
   - What's unclear: Whether Vercel provides these types automatically
   - Recommendation: Add "DOM" to tsconfig lib if type errors occur; verify during implementation

## Sources

### Primary (HIGH confidence)
- [Husky Documentation](https://typicode.github.io/husky/get-started.html) - Installation, pnpm setup, CI configuration
- [Biome Git Hooks Guide](https://biomejs.dev/recipes/git-hooks/) - lint-staged integration patterns
- [Vercel Functions API Reference](https://vercel.com/docs/functions/functions-api-reference) - Function signatures, fetch handler
- [Vercel CLI Build](https://vercel.com/docs/cli/build) - Local build verification
- [actions/setup-node](https://github.com/actions/setup-node) - Node.js setup with pnpm caching
- [pnpm/action-setup](https://github.com/pnpm/action-setup) - pnpm installation in GitHub Actions

### Secondary (MEDIUM confidence)
- [lint-staged GitHub](https://github.com/lint-staged/lint-staged) - Configuration options, ESM support
- npm registry version checks - Current versions verified via npm view

### Tertiary (LOW confidence)
- None - All findings verified with official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools are mature, well-documented, and widely adopted
- Architecture: HIGH - Patterns from official documentation
- Pitfalls: HIGH - Common issues documented in official troubleshooting guides

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (60 days - stack is stable)
