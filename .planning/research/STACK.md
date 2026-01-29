# Technology Stack

**Project:** Kata Context - Context Policy Engine for AI Agents
**Researched:** 2026-01-29
**Overall Confidence:** HIGH

## Recommended Stack

### Runtime & Platform

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Node.js | 24.x | Runtime | Current LTS (Krypton), default on Vercel, native TypeScript type stripping support |
| Vercel Functions | - | Serverless compute | Fluid Compute for efficient concurrency, native TypeScript support, zero config deployment |
| TypeScript | 5.9.x | Type safety | Latest stable, includes `verbatimModuleSyntax` and `erasableSyntaxOnly` for Node.js native TS support |

**Node.js 24.x Rationale:**
- Vercel default as of January 2026
- Active LTS through April 2028
- Native TypeScript type stripping (no flags needed)
- Full ESM support without experimental flags

### Package Manager

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| pnpm | 10.x | Package management | 70% disk savings vs npm, strict dependency isolation, Vercel auto-detects via pnpm-lock.yaml |

**Why pnpm over alternatives:**

| Alternative | Why Not |
|-------------|---------|
| npm | Slower installs, no content-addressable storage, phantom dependency issues |
| yarn | Similar features to pnpm but less mature monorepo support, declining mindshare |
| bun | Fast but package manager is secondary feature; some ecosystem compatibility gaps; better for runtime than just packages |

**pnpm Detection:**
Vercel automatically uses `pnpm install` when `pnpm-lock.yaml` is present. No additional configuration needed.

### Linting & Formatting

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Biome | 2.3.x | Linting + formatting | 20-35x faster than ESLint+Prettier, single config file, 427 rules, native TypeScript |

**Why Biome over ESLint + Prettier:**
- **Performance:** Formats 100k+ line codebase in under 1 second vs 10-20 seconds
- **Simplicity:** One dependency, one config file (`biome.json`) vs 6+ packages and multiple configs
- **TypeScript-first:** Native support, no plugins needed
- **97% Prettier compatibility:** Consistent formatting with industry standard

**When ESLint might still be needed:**
- Custom enterprise compliance rules not available in Biome
- Legacy projects with extensive custom ESLint plugins
- This project: Not applicable - new project, Biome sufficient

**Configuration:**
```json
{
  "$schema": "https://biomejs.dev/schemas/2.3.13/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  }
}
```

### Testing Framework

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Vitest | 4.x | Unit & integration testing | 10-20x faster than Jest, native ESM/TypeScript, Jest-compatible API |

**Why Vitest over Jest:**
- **Performance:** Tests run in 1-2 seconds vs 15-20 seconds for equivalent Jest suites
- **TypeScript:** Native support, no ts-jest configuration needed
- **ESM:** First-class support, no experimental flags
- **Migration path:** 95% Jest API compatibility - can use existing Jest knowledge

**When Jest might still be needed:**
- React Native projects (Jest is mandatory)
- Existing large Jest test suites where migration cost exceeds benefit
- This project: Not applicable - greenfield, Vitest is correct choice

### TypeScript Execution (Development)

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| tsx | 4.x | Development TypeScript execution | 20-30x faster than ts-node, native ESM support, sensible defaults |

**Why tsx over alternatives:**

| Alternative | Why Not |
|-------------|---------|
| ts-node | Slow startup, complex ESM configuration, requires peer dependencies |
| Native Node.js (--experimental-strip-types) | Requires Node.js 23.6+ flags for advanced features; tsx more mature for development |
| Bun | Good but adds runtime complexity; tsx is lighter for just TS execution |

**Note:** tsx is for development execution only. Vercel handles TypeScript compilation for production deployment automatically.

### Build Tooling

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| tsc | (via TypeScript) | Type checking & declaration generation | Official compiler, required for .d.ts output |
| Vercel Build | - | Production bundling | Zero-config, optimized for Vercel Functions |

**Build Strategy:**
1. **Type checking:** `tsc --noEmit` - validates types without emitting
2. **Linting:** `biome check .` - fast lint + format check
3. **Tests:** `vitest run` - fast test execution
4. **Deployment:** Vercel handles bundling automatically

**What NOT to add:**
- **esbuild/swc/tsup for bundling:** Vercel bundles functions automatically
- **Webpack/Rollup:** Overkill for serverless functions, adds complexity
- **Babel:** TypeScript and Vercel handle transpilation

## TypeScript Configuration

Recommended `tsconfig.json` for Vercel serverless:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2024"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Key settings explained:**
- `module: "NodeNext"` - Node.js ESM with package.json `type` field support
- `verbatimModuleSyntax: true` - Prevents import/export ambiguity
- `isolatedModules: true` - Ensures compatibility with single-file transpilers
- `noEmit: true` - Type check only; Vercel handles compilation
- `target: "ES2024"` - Node.js 24 supports ES2024 fully

**package.json essentials:**
```json
{
  "type": "module",
  "engines": {
    "node": "24.x"
  }
}
```

## Supporting Libraries

| Library | Version | Purpose | When to Add |
|---------|---------|---------|-------------|
| @vercel/node | latest | Vercel Function types | Optional - Web standard types preferred |
| zod | 3.x | Runtime validation | Schema validation for API inputs |
| drizzle-orm | latest | Database ORM | When connecting to Neon Postgres |
| @neondatabase/serverless | latest | Neon connection | Serverless-optimized Postgres driver |

**Note:** These are listed for awareness. Add when the specific feature is implemented, not upfront.

## Installation

### Initial Setup

```bash
# Initialize with pnpm
pnpm init

# Core dependencies
pnpm add typescript

# Development dependencies
pnpm add -D @types/node vitest tsx biome

# Vercel CLI (optional, for local development)
pnpm add -D vercel
```

### Scripts (package.json)

```json
{
  "scripts": {
    "dev": "vercel dev",
    "build": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit"
  }
}
```

## What NOT to Include

| Technology | Why Avoid |
|------------|-----------|
| Jest | Slower, requires configuration for TypeScript/ESM |
| ESLint + Prettier | Slower, more dependencies, more configuration |
| ts-node | Slow, complex ESM setup |
| Webpack/Rollup/esbuild | Vercel handles bundling |
| Babel | TypeScript and Vercel handle transpilation |
| nodemon | tsx has built-in watch mode |
| husky + lint-staged | Add later if needed; not essential for v0.1.0 |

## Vercel-Specific Considerations

### Function Configuration

```typescript
// api/example.ts
export const config = {
  runtime: 'nodejs', // Use Node.js runtime (not Edge)
  regions: ['iad1'], // Washington D.C. - close to typical database locations
  maxDuration: 30, // Seconds (Pro plan allows up to 300)
};
```

### Project Configuration (vercel.json or vercel.ts)

For this project, start with `vercel.json`:

```json
{
  "functions": {
    "api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 30
    }
  }
}
```

Consider migrating to `vercel.ts` when dynamic configuration is needed.

### Fluid Compute

Vercel Functions use Fluid Compute by default:
- Multiple invocations share instances
- Reduced cold starts
- Better concurrency for I/O-bound operations (database queries, LLM calls)

No configuration needed - this is automatic.

## Sources

### Package Managers
- [pnpm vs npm vs yarn vs Bun: The 2026 Package Manager Showdown](https://dev.to/pockit_tools/pnpm-vs-npm-vs-yarn-vs-bun-the-2026-package-manager-showdown-51dc)
- [pnpm Official Site](https://pnpm.io/) - Version 10.28.2

### Linting & Formatting
- [Biome Official Site](https://biomejs.dev/) - Version 2.3.13
- [Biome: The ESLint and Prettier Killer? Complete Migration Guide for 2026](https://dev.to/pockit_tools/biome-the-eslint-and-prettier-killer-complete-migration-guide-for-2026-27m)
- [Biome vs ESLint: Comparing JavaScript Linters](https://betterstack.com/community/guides/scaling-nodejs/biome-eslint/)

### Testing
- [Vitest Official Site](https://vitest.dev/) - Version 4.0.18
- [Vitest vs Jest 30: Why 2026 is the Year of Browser-Native Testing](https://dev.to/dataformathub/vitest-vs-jest-30-why-2026-is-the-year-of-browser-native-testing-2fgb)
- [Jest vs Vitest: Choosing the Right Testing Framework](https://medium.com/on-tech-by-leighton/jest-vs-vitest-choosing-the-right-testing-framework-for-your-typescript-projects-07f23c4aa76c)

### TypeScript
- [TypeScript 5.9 Documentation](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html)
- [A Modern Node.js + TypeScript Setup for 2025](https://dev.to/woovi/a-modern-nodejs-typescript-setup-for-2025-nlk)
- [TSX vs ts-node: The Definitive TypeScript Runtime Comparison](https://betterstack.com/community/guides/scaling-nodejs/tsx-vs-ts-node/)

### Vercel
- [Vercel Functions Documentation](https://vercel.com/docs/functions)
- [Vercel Node.js Runtime](https://vercel.com/docs/functions/runtimes/node-js)
- [Supported Node.js Versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) - Default: Node.js 24.x
- [Programmatic Configuration with vercel.ts](https://vercel.com/docs/project-configuration/vercel-ts)

### Node.js
- [Node.js Releases](https://nodejs.org/en/about/previous-releases) - Node.js 24.13.0 LTS
- [Node.js endoflife.date](https://endoflife.date/nodejs)
