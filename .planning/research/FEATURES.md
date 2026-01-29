# Feature Landscape: TypeScript/Vercel Project Scaffold

**Domain:** TypeScript serverless project scaffolding for Vercel
**Researched:** 2026-01-29
**Focus:** v0.1.0 Core Setup milestone

## Table Stakes

Features users expect. Missing = project feels incomplete or unprofessional.

| Feature | Why Expected | Complexity | Scaffolding vs Later | Notes |
|---------|-------------|------------|---------------------|-------|
| TypeScript configuration (tsconfig.json) | Modern TS projects require explicit config | Low | **Scaffolding** | Use `strict: true` baseline |
| ESLint configuration | Code quality enforcement expected | Low | **Scaffolding** | Flat config format (eslint.config.js) |
| Prettier configuration | Consistent formatting expected | Low | **Scaffolding** | .prettierrc with sensible defaults |
| .gitignore | Must exclude node_modules, .env, build artifacts | Low | **Scaffolding** | Include Vercel-specific entries |
| package.json scripts | `dev`, `build`, `test`, `lint` expected | Low | **Scaffolding** | Core developer commands |
| Vercel serverless structure | `/api` directory with function files | Low | **Scaffolding** | Vercel auto-detects this |
| Environment variable handling | .env.example documenting required vars | Low | **Scaffolding** | Never commit actual .env files |
| Node.js version specification | Reproducible builds require pinned version | Low | **Scaffolding** | Use .nvmrc or engines in package.json |
| README with setup instructions | Developers expect onboarding docs | Low | **Scaffolding** | Basic setup, not full documentation |

**Confidence:** HIGH - Based on [Vercel official documentation](https://vercel.com/docs/functions) and [TypeScript best practices](https://www.typescriptlang.org/tsconfig/).

## Differentiators

Features that set quality projects apart. Not expected, but valued by experienced developers.

| Feature | Value Proposition | Complexity | Scaffolding vs Later | Notes |
|---------|------------------|------------|---------------------|-------|
| Pre-commit hooks (Husky + lint-staged) | Prevents bad commits from entering repo | Medium | **Scaffolding** | Essential for solo dev maintaining quality |
| Vitest test configuration | Modern, fast testing with TS support | Medium | **Scaffolding** | Better DX than Jest for Vite/Vercel |
| Strict TypeScript settings | Catches more bugs at compile time | Low | **Scaffolding** | Enable strictNullChecks, noUncheckedIndexedAccess |
| Type-checked ESLint rules | TypeScript-specific linting | Low | **Scaffolding** | @typescript-eslint/eslint-plugin |
| vercel.json configuration | Explicit function memory/duration limits | Low | **Scaffolding** | Avoids surprises in production |
| GitHub Actions CI workflow | Automated lint/test on PRs | Medium | **Scaffolding** | Simple workflow, not full CD |
| EditorConfig | Consistent settings across editors | Low | **Scaffolding** | .editorconfig file |
| VS Code workspace settings | Editor integration for linting/formatting | Low | **Scaffolding** | .vscode/settings.json |

**Confidence:** HIGH - Based on [ESLint + Prettier 2026 patterns](https://medium.com/@osmion/prettier-eslint-configuration-that-actually-works-without-the-headaches-a8506b710d21), [Vitest documentation](https://vitest.dev/config/), and [Husky/lint-staged best practices](https://github.com/lint-staged/lint-staged).

## Anti-Features

Features to explicitly NOT include in scaffolding phase. Common mistakes in project setup.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|----------|-------------------|
| Full GitHub Actions CD pipeline | Premature optimization; Vercel auto-deploys from Git | Use Vercel's built-in Git integration for deployments; CI only for lint/test |
| Database configuration | Not needed until data layer milestone | Add when implementing storage layer |
| API routes with business logic | Scaffolding should be empty shell | Create single hello-world health check only |
| Authentication/authorization | Separate concern, adds complexity | Defer to security milestone |
| Logging infrastructure | Overengineering for scaffold | Use console.log initially; add structured logging later |
| Error monitoring (Sentry, etc.) | Not needed until production traffic | Add during production hardening |
| Complex folder structure | Premature architecture; let structure emerge | Minimal: `/api`, `/src`, `/tests` |
| Monorepo setup | Single package until proven need | Start simple; refactor if SDKs require |
| Docker/containerization | Vercel handles deployment; Docker adds complexity | Skip unless local development requires it |
| Documentation beyond README | Writing docs for unwritten code | Create docs as features ship |
| Multiple environment configs | One environment (development) is enough to start | Add staging/production configs when needed |
| Custom build tooling (webpack, rollup) | Vercel handles bundling | Trust Vercel's build system |
| API versioning | No API to version yet | Add `/v1/` prefix when API stabilizes |
| Rate limiting | No traffic to limit | Add during production hardening |

**Confidence:** HIGH - Based on [Vercel's zero-config philosophy](https://vercel.com/docs/project-configuration) and common scaffolding anti-patterns observed in ecosystem research.

## Feature Dependencies

```
tsconfig.json
    |
    v
ESLint config (depends on TS types)
    |
    v
Prettier (must be last in ESLint extends)
    |
    v
lint-staged (runs ESLint + Prettier)
    |
    v
Husky (triggers lint-staged on commit)
    |
    v
CI workflow (runs same lint/test commands)
```

```
package.json scripts
    |
    +-- dev (vercel dev)
    |
    +-- build (type check)
    |
    +-- test (vitest)
    |
    +-- lint (eslint + prettier check)
    |
    +-- format (prettier write)
```

## Scaffolding Checklist

For v0.1.0 Core Setup, include these files:

### Configuration Files
- [ ] `tsconfig.json` - Strict TypeScript configuration
- [ ] `eslint.config.js` - Flat ESLint config with TypeScript and Prettier
- [ ] `.prettierrc` - Formatter settings
- [ ] `.prettierignore` - Exclude build artifacts
- [ ] `vercel.json` - Function configuration
- [ ] `.gitignore` - Standard Node + Vercel ignores
- [ ] `.nvmrc` - Node version (20 LTS recommended)
- [ ] `.editorconfig` - Cross-editor settings

### Developer Experience
- [ ] `.vscode/settings.json` - Format on save, ESLint integration
- [ ] `.vscode/extensions.json` - Recommended extensions
- [ ] `.husky/pre-commit` - Run lint-staged
- [ ] `lint-staged` config in package.json

### CI/CD
- [ ] `.github/workflows/ci.yml` - Lint and test on PR

### Documentation
- [ ] `README.md` - Setup instructions, available scripts
- [ ] `.env.example` - Document required environment variables

### Source Structure
- [ ] `/api/health.ts` - Health check endpoint (hello world)
- [ ] `/src/` - Empty directory for shared code (placeholder)
- [ ] `/tests/` - Empty directory for tests (placeholder)
- [ ] `/tests/health.test.ts` - Smoke test for health endpoint

## Recommended Configuration Details

### tsconfig.json (Strict)

Key settings for production TypeScript:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "outDir": "./dist",
    "rootDir": "."
  }
}
```

**Confidence:** HIGH - Based on [TypeScript TSConfig reference](https://www.typescriptlang.org/tsconfig/) and [strict mode recommendations](https://www.typescriptlang.org/tsconfig/strict.html).

### ESLint Flat Config

Modern ESLint 9+ configuration:

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  ...tseslint.configs.strict,
  eslintConfigPrettier,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error"
    }
  }
];
```

**Confidence:** HIGH - Based on [ESLint + Prettier 2026 integration patterns](https://www.joshuakgoldberg.com/blog/configuring-eslint-prettier-and-typescript-together/).

### Vitest Configuration

Minimal vitest.config.ts:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
```

**Confidence:** HIGH - Based on [Vitest official documentation](https://vitest.dev/config/) and [2026 testing recommendations](https://dev.to/dataformathub/vitest-vs-jest-30-why-2026-is-the-year-of-browser-native-testing-2fgb).

## MVP Recommendation

For v0.1.0 Core Setup milestone:

**Must Include (Ship-blocking):**
1. TypeScript configuration with strict mode
2. ESLint + Prettier with working integration
3. Vitest with at least one passing test
4. Pre-commit hooks preventing bad commits
5. Basic CI workflow (lint + test)
6. Health check endpoint proving serverless works

**Nice to Have (If Time Allows):**
1. VS Code workspace settings
2. EditorConfig
3. Comprehensive .gitignore

**Defer to Later Milestones:**
- Database configuration (v0.2.0 Storage)
- API routes beyond health check (v0.3.0 Core Engine)
- Deployment pipeline (when ready for production)
- Documentation beyond README (as features ship)

## Sources

### High Confidence (Official/Context7)
- [Vercel Functions Documentation](https://vercel.com/docs/functions)
- [Vercel Project Configuration](https://vercel.com/docs/project-configuration)
- [TypeScript TSConfig Reference](https://www.typescriptlang.org/tsconfig/)
- [Vitest Configuration Guide](https://vitest.dev/config/)

### Medium Confidence (Verified WebSearch)
- [ESLint + Prettier Configuration (2026)](https://medium.com/@osmion/prettier-eslint-configuration-that-actually-works-without-the-headaches-a8506b710d21)
- [Husky + lint-staged Setup](https://github.com/lint-staged/lint-staged)
- [TypeScript Best Practices for Large-Scale Apps](https://johal.in/typescript-best-practices-for-large-scale-web-applications-in-2026/)
- [GitHub Actions + Vercel CI/CD](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel)

### Low Confidence (Single Source)
- Specific version recommendations may shift; verify against current LTS when implementing
