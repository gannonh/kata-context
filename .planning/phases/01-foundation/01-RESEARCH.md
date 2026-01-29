# Phase 1: Foundation - Research

**Researched:** 2026-01-29
**Domain:** TypeScript development environment with pnpm, Biome, and Vitest
**Confidence:** HIGH

## Summary

This research covers establishing a TypeScript development environment for the Kata Context project, targeting Vercel serverless deployment. The stack consists of pnpm 10.x as package manager, TypeScript 5.9.x with strict mode and NodeNext module resolution, Biome 2.3.x for linting and formatting, and Vitest 4.x for testing.

The ecosystem is mature and well-documented. TypeScript 5.9 (released August 2025) provides a cleaner default tsconfig with NodeNext as the sensible default. Biome 2 (released June 2025) delivers type-aware linting without requiring the TypeScript compiler, making it significantly faster than ESLint. Vitest 4 (released late 2025) stabilizes browser mode and provides excellent TypeScript support out of the box.

**Primary recommendation:** Use the established stack exactly as specified in prior decisions. The versions are current and well-supported. Focus on correct NodeNext configuration (requires explicit .js extensions in imports) and Biome's recommended ruleset.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library    | Version | Purpose                      | Why Standard                                          |
| ---------- | ------- | ---------------------------- | ----------------------------------------------------- |
| TypeScript | 5.9.x   | Type checking and compilation | Latest stable; NodeNext default; cleaner tsconfig     |
| pnpm       | 10.x    | Package management           | Disk efficient, strict node_modules, fast installs    |
| Biome      | 2.3.x   | Linting and formatting       | 15x faster than ESLint; type-aware without tsc        |
| Vitest     | 4.x     | Testing framework            | Native TypeScript; Vite-powered; excellent DX         |

### Supporting

| Library          | Version | Purpose             | When to Use                                |
| ---------------- | ------- | ------------------- | ------------------------------------------ |
| @types/node      | 24.x    | Node.js type defs   | Always - matches Node.js 24 runtime        |
| vite-tsconfig-paths | latest | Path alias support | If using TypeScript path aliases in Vitest |

### Alternatives Considered

| Instead of | Could Use          | Tradeoff                                                |
| ---------- | ------------------ | ------------------------------------------------------- |
| Biome      | ESLint + Prettier  | ESLint is 15x slower; requires two tools; more config   |
| Vitest     | Jest               | Jest slower; requires more config for TypeScript        |
| pnpm       | npm                | npm is slower; no strict dependency resolution          |

**Installation:**
```bash
pnpm add -D typescript @types/node vitest @biomejs/biome
```

## Architecture Patterns

### Recommended Project Structure
```
kata-context/
├── src/                    # TypeScript source files
│   └── index.ts           # Entry point (placeholder for Phase 1)
├── biome.json             # Biome configuration
├── tsconfig.json          # TypeScript configuration
├── vitest.config.ts       # Vitest configuration
├── package.json           # Package manifest with scripts
├── pnpm-lock.yaml         # Lockfile (auto-generated)
└── .gitignore             # Git ignore patterns
```

### Pattern 1: NodeNext Module Resolution

**What:** Configure TypeScript to use Node.js's native ESM resolution algorithm.

**When to use:** All Node.js projects targeting modern environments (Node.js 18+).

**Example:**
```json
// tsconfig.json - Source: TypeScript official documentation
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Critical:** With NodeNext, relative imports MUST use `.js` extensions even for TypeScript files:
```typescript
// Correct - use .js extension
import { helper } from './helper.js';

// Incorrect - will fail at runtime
import { helper } from './helper';
import { helper } from './helper.ts';
```

### Pattern 2: Package.json with type: "module"

**What:** Configure the package as an ES module.

**When to use:** Modern Node.js projects using ESM (which is required by Vercel serverless).

**Example:**
```json
// package.json - Source: pnpm and Node.js documentation
{
  "name": "kata-context",
  "version": "0.1.0",
  "type": "module",
  "engines": {
    "node": ">=24.0.0"
  },
  "scripts": {
    "dev": "tsc --watch",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome lint .",
    "format": "biome format --write .",
    "check": "biome check --write ."
  },
  "devDependencies": {
    "@biomejs/biome": "^2.3.11",
    "@types/node": "^24.0.0",
    "typescript": "^5.9.3",
    "vitest": "^4.0.17"
  }
}
```

### Pattern 3: Biome Configuration

**What:** Configure Biome for TypeScript linting and formatting.

**When to use:** All projects using Biome.

**Example:**
```json
// biome.json - Source: Biome official documentation
{
  "$schema": "https://biomejs.dev/schemas/2.3.11/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
    "defaultBranch": "main"
  },
  "files": {
    "ignoreUnknown": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "organizeImports": {
    "enabled": true
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  }
}
```

### Pattern 4: Vitest Configuration

**What:** Configure Vitest for TypeScript testing.

**When to use:** All projects using Vitest.

**Example:**
```typescript
// vitest.config.ts - Source: Vitest official documentation
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
```

### Anti-Patterns to Avoid

- **Using `moduleResolution: "bundler"` for Node.js:** Use `NodeNext` for Node.js projects; `bundler` is for frontend bundler scenarios only.
- **Omitting file extensions in imports:** With NodeNext, `.js` extensions are mandatory for relative imports.
- **Using `module: "CommonJS"` with NodeNext resolution:** These must be paired correctly - use `module: "NodeNext"` with `moduleResolution: "NodeNext"`.
- **Installing Biome without exact version:** Always use `--save-exact` to ensure consistent behavior across team.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem            | Don't Build       | Use Instead     | Why                                           |
| ------------------ | ----------------- | --------------- | --------------------------------------------- |
| Linting rules      | Custom ESLint     | Biome           | 340+ rules, type-aware, 15x faster            |
| Code formatting    | Custom Prettier   | Biome           | 97% Prettier compatible, single tool          |
| Import ordering    | Manual sorting    | Biome assist    | Automatic, respects blank lines as separators |
| Test running       | Custom harness    | Vitest          | Vite-powered, native TypeScript, fast         |
| Type checking      | Runtime validation| TypeScript strict | Compile-time catches more bugs              |

**Key insight:** The JavaScript/TypeScript tooling ecosystem has matured significantly. Biome 2 provides an all-in-one solution that replaces ESLint + Prettier with dramatically better performance.

## Common Pitfalls

### Pitfall 1: Missing .js Extensions in Imports

**What goes wrong:** Runtime errors when Node.js cannot resolve imports.
**Why it happens:** NodeNext requires explicit file extensions for relative imports.
**How to avoid:** Always use `.js` extensions in TypeScript imports (TypeScript resolves them correctly).
**Warning signs:** Build succeeds but runtime throws "Cannot find module" errors.

### Pitfall 2: Module/ModuleResolution Mismatch

**What goes wrong:** TypeScript error TS5110: "Option 'module' must be set to 'NodeNext' when option 'moduleResolution' is set to 'NodeNext'".
**Why it happens:** These options must be paired correctly.
**How to avoid:** Always set both `module` and `moduleResolution` to the same value (NodeNext).
**Warning signs:** TypeScript compilation fails with module-related errors.

### Pitfall 3: Biome VS Code Extension with pnpm

**What goes wrong:** Biome linter doesn't work in VS Code despite being installed.
**Why it happens:** pnpm creates shell script wrappers; VS Code extension copies the script and the basedir resolution fails.
**How to avoid:** Install Biome as a dev dependency (not globally); ensure VS Code extension is configured to use local installation.
**Warning signs:** Formatter works but linter shows no diagnostics.

### Pitfall 4: jsdom Compatibility with Vitest 4

**What goes wrong:** Unit tests fail after upgrading both jsdom and Vitest.
**Why it happens:** Some updates in jsdom are incompatible with Vitest 4.
**How to avoid:** For Phase 1, use `environment: "node"` (not jsdom); only add jsdom later if browser-like testing is needed.
**Warning signs:** Tests that previously passed start failing with DOM-related errors.

### Pitfall 5: Forgetting type: "module" in package.json

**What goes wrong:** ESM imports fail at runtime.
**Why it happens:** Node.js defaults to CommonJS without explicit `type: "module"`.
**How to avoid:** Always include `"type": "module"` in package.json for modern projects.
**Warning signs:** "require is not defined" or "import statement cannot be used outside a module" errors.

## Code Examples

Verified patterns from official sources:

### Minimal tsconfig.json for NodeNext
```json
// Source: TypeScript 5.9 documentation
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

### Basic Vitest Test File
```typescript
// src/example.test.ts - Source: Vitest documentation
import { describe, it, expect } from "vitest";

describe("Example", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });
});
```

### Biome Check Command
```bash
# Run all checks (lint + format) with auto-fix
pnpm biome check --write .

# Lint only
pnpm biome lint .

# Format only
pnpm biome format --write .
```

### pnpm Initialization
```bash
# Initialize pnpm project
pnpm init

# Install all dev dependencies
pnpm add -D typescript @types/node vitest @biomejs/biome

# Initialize Biome configuration
pnpm biome init
```

## State of the Art

| Old Approach            | Current Approach           | When Changed    | Impact                                |
| ----------------------- | -------------------------- | --------------- | ------------------------------------- |
| ESLint + Prettier       | Biome 2                    | June 2025       | 15x faster, single tool, type-aware   |
| CommonJS modules        | ESM with NodeNext          | Node.js 18+     | Better tree-shaking, native support   |
| Jest                    | Vitest                     | 2023+           | Faster, native TypeScript, Vite-based |
| npm/yarn                | pnpm                       | 2022+           | Faster, disk efficient, strict deps   |
| Verbose tsconfig        | Minimal tsconfig (TS 5.9)  | August 2025     | Sensible defaults, less boilerplate   |

**Deprecated/outdated:**
- **TSLint:** Deprecated since 2019; use Biome or ESLint.
- **moduleResolution: "node":** Use "NodeNext" for modern Node.js projects.
- **target: "ES5"/"ES6":** Use "ES2023" or higher for Node.js 24+.

## Open Questions

Things that couldn't be fully resolved:

1. **Vercel Build Output Configuration**
   - What we know: Vercel requires compiled JS files; NodeNext works with Vercel serverless.
   - What's unclear: Exact vercel.json configuration needed (Phase 2 concern).
   - Recommendation: Phase 1 focuses on local build; verify Vercel deployment in Phase 2.

2. **Biome Type-Aware Rule Coverage**
   - What we know: Biome 2 catches ~85% of what typescript-eslint catches.
   - What's unclear: Which specific rules have gaps.
   - Recommendation: Use Biome recommended rules; supplement with TypeScript strict mode.

## Sources

### Primary (HIGH confidence)
- [TypeScript 5.9 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html) - NodeNext defaults, new features
- [TypeScript moduleResolution Option](https://www.typescriptlang.org/tsconfig/moduleResolution.html) - NodeNext configuration
- [Biome v2 Announcement](https://biomejs.dev/blog/biome-v2/) - Type-aware linting, configuration
- [Biome Configuration Reference](https://biomejs.dev/reference/configuration/) - Complete schema
- [Vitest 4.0 Announcement](https://vitest.dev/blog/vitest-4) - New features, migration
- [Vitest Configuration](https://vitest.dev/config/) - Configuration options
- [pnpm Settings](https://pnpm.io/settings) - pnpm 10 configuration
- [Node.js 24 LTS Release](https://nodejs.org/en/blog/release/v24.11.0) - LTS details

### Secondary (MEDIUM confidence)
- [Total TypeScript - NodeNext Extensions](https://www.totaltypescript.com/relative-import-paths-need-explicit-file-extensions-in-ecmascript-imports) - File extension requirements
- [Better Stack - Biome vs ESLint](https://betterstack.com/community/guides/scaling-nodejs/biome-eslint/) - Performance comparison
- [Getting Started with BiomeJS](https://betterstack.com/community/guides/scaling-nodejs/biomejs-explained/) - Setup guide

### Tertiary (LOW confidence)
- GitHub Issues for known bugs (Biome + pnpm VSCode issue, jsdom + Vitest 4 compatibility)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official documentation for all tools; versions verified on npm
- Architecture: HIGH - Patterns from official docs; NodeNext is now TypeScript default
- Pitfalls: MEDIUM - Mix of official docs and community-reported issues

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (60 days - stable tooling, moderate pace of change)
