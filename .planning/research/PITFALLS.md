# Domain Pitfalls: TypeScript/Vercel Serverless Project Scaffolding

**Domain:** TypeScript/Vercel serverless project setup
**Researched:** 2026-01-29
**Confidence:** HIGH (verified via official docs, community issues, multiple sources)

---

## Critical Pitfalls

Mistakes that cause rewrites, deployment failures, or major rework.

---

### Pitfall 1: Path Aliases Not Resolved in Compiled Output

**What goes wrong:** You configure TypeScript path aliases (`@/` or `@components/`) in `tsconfig.json`, and everything works in your IDE and local development. Then deployment fails with "Cannot find module '@/utils'" errors.

**Why it happens:** TypeScript's `paths` option is for **type checking only**. The TypeScript compiler (`tsc`) does NOT rewrite import paths in emitted JavaScript. Your bundler or runtime has no idea what `@/` means.

**Consequences:**
- Builds fail on Vercel with cryptic module resolution errors
- Works locally (because bundler handles it) but fails in production
- Refactoring to fix requires updating every import in the project

**Prevention:**
1. **Decide early:** Either use a bundler that handles path aliases (Vite, webpack, tsup) OR avoid path aliases entirely
2. **If using aliases:** Configure BOTH tsconfig.json AND your bundler's alias config to match exactly
3. **For Vercel serverless functions:** Consider avoiding path aliases entirely since functions may bundle differently than your app
4. **Alternative:** Use package.json `"imports"` field (Node.js subpath imports) which works universally

**Detection:**
- Build locally with `tsc` (not your bundler) and check output for unresolved aliases
- Test `vercel build` locally before first deployment
- Search compiled `.js` files for `@/` strings

**Phase to address:** Phase 1 (Initial Setup) - Lock this decision before writing any imports

**Sources:**
- [TypeScript Modules Reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html)
- [Path Aliases in TypeScript](https://dev.to/shane/path-aliases-in-typescript-with-vite-or-webpack-bundlers-3nmb)

---

### Pitfall 2: Wrong Module Resolution Strategy for Target Environment

**What goes wrong:** You set `moduleResolution: "bundler"` but deploy to Node.js serverless, or use `moduleResolution: "node16"` with a bundler, causing import resolution failures.

**Why it happens:** TypeScript has multiple module resolution strategies that make different assumptions:
- `node16`/`nodenext`: Requires explicit `.js` file extensions, follows Node.js ESM rules
- `bundler`: Assumes a bundler will resolve imports, no extensions required
- These are **incompatible** with each other

**Consequences:**
- "Relative import paths need explicit file extensions" errors everywhere
- Works in development, fails in production (or vice versa)
- Framework conflicts (Next.js has known issues with `node16`/`nodenext`)

**Prevention:**
1. **For Vercel with Next.js:** Use the tsconfig.json that Next.js generates - don't override module settings
2. **For Vercel serverless functions (non-Next.js):**
   - If bundling with Vite/esbuild: `moduleResolution: "bundler"` + `module: "ESNext"`
   - If running directly on Node.js: `moduleResolution: "node16"` + `module: "node16"` + explicit `.js` extensions
3. **Rule of thumb:** Match `module` and `moduleResolution` values (both `node16`, or both bundler-compatible)

**Detection:**
- TypeScript errors about file extensions
- "Cannot find module" errors that only appear after build
- Different behavior between `vercel dev` and production

**Phase to address:** Phase 1 (Initial Setup) - Must be correct before writing any code

**Sources:**
- [TypeScript moduleResolution docs](https://www.typescriptlang.org/tsconfig/moduleResolution.html)
- [Next.js Discussion #41189](https://github.com/vercel/next.js/discussions/41189)

---

### Pitfall 3: Environment Variables Baked at Build Time vs Runtime

**What goes wrong:** Secrets or environment-specific config get embedded into your build artifacts. You deploy the same build to staging and production, but it uses staging secrets in production.

**Why it happens:**
- Next.js replaces `process.env.VARIABLE` at build time for client code
- `NEXT_PUBLIC_*` variables are **always** embedded at build time
- Server-side code behavior varies by context (API routes read at runtime, but static generation reads at build time)

**Consequences:**
- Secrets visible in client-side JavaScript bundles
- Cannot use same build artifact across environments (breaks 12-factor app principles)
- Accidental secret exposure in Docker images
- Confusing behavior where same code works differently in different contexts

**Prevention:**
1. **Never prefix secrets with `NEXT_PUBLIC_`** - This exposes them to clients
2. **Use Vercel's environment variable scoping:** Set different values per environment (Production, Preview, Development)
3. **For true runtime env vars:** Use `publicRuntimeConfig` or fetch config from an API
4. **Document which variables are build-time vs runtime** in your project

**Detection:**
- Search build output (`.next` folder) for secret values
- Check Network tab in browser for exposed env vars
- Verify different Preview deployments have different values

**Phase to address:** Phase 1 (Initial Setup) - Establish env var conventions before adding any secrets

**Sources:**
- [Vercel Environment Variables docs](https://vercel.com/docs/projects/environment-variables)
- [Next.js Issue #39299](https://github.com/vercel/next.js/issues/39299)

---

### Pitfall 4: ESM/CJS Module Format Mismatch

**What goes wrong:** Your project mixes ESM (`import/export`) and CommonJS (`require/module.exports`) in incompatible ways, causing "Cannot use import statement outside a module" or "require is not defined" errors.

**Why it happens:**
- `"type": "module"` in package.json makes all `.js` files ESM
- Without it, all `.js` files are CommonJS
- TypeScript output format (`module` setting) must match what Node.js expects
- Dependencies may be ESM-only or CJS-only

**Consequences:**
- Works locally but fails on Vercel (or vice versa)
- Some dependencies refuse to load
- Confusing errors that seem unrelated to module format

**Prevention:**
1. **Pick ESM for new projects:** Add `"type": "module"` to package.json
2. **Match TypeScript config:** If using ESM, set `module: "ESNext"` or `module: "Node16"`
3. **Check dependency compatibility:** Use [publint](https://publint.dev/) or check package.json exports
4. **For Vercel serverless:** Verify tsconfig has ESM settings that match Vercel's runtime expectations

**Detection:**
- Errors mentioning "ERR_REQUIRE_ESM" or "import statement outside a module"
- Check package.json for `"type"` field
- Verify `tsconfig.json` `module` setting

**Phase to address:** Phase 1 (Initial Setup) - Set module format before adding dependencies

**Sources:**
- [Vercel Community: TypeScript serverless functions](https://community.vercel.com/t/deploying-typescript-serverless-functions/4029)

---

## Moderate Pitfalls

Mistakes that cause delays, debugging sessions, or technical debt.

---

### Pitfall 5: ESLint/Prettier Configuration Conflicts

**What goes wrong:** ESLint and Prettier fight over formatting, causing:
- Lint errors on save that Prettier then "fixes" back
- Infinite format loops in IDE
- Different results between CLI and editor

**Why it happens:**
- ESLint has formatting rules that conflict with Prettier's opinions
- Old guides recommend outdated extends like `"prettier/react"` (deprecated since v8.0.0)
- Plugin naming (`@typescript-eslint/indent` vs `ts/indent`) can bypass conflict resolution

**Prevention:**
1. **Use `eslint-config-prettier`:** Disables all ESLint formatting rules that conflict
2. **Modern setup (2025+):** Use ESLint flat config (`eslint.config.js`) with `eslint-plugin-prettier/recommended`
3. **Let Prettier own formatting:** ESLint for code quality only
4. **Consider Biome:** Single tool replaces both ESLint and Prettier, eliminates conflicts entirely

**Detection:**
- Format-on-save causes different results than CLI lint
- Lint errors that keep reappearing after fixes
- `npx eslint-config-prettier path/to/file.ts` to check for conflicts

**Phase to address:** Phase 1 (Initial Setup) - Configure before writing code

**Sources:**
- [eslint-config-prettier GitHub](https://github.com/prettier/eslint-config-prettier)
- [Modern Linting 2025](https://advancedfrontends.com/eslint-flat-config-typescript-javascript/)

---

### Pitfall 6: Testing Setup Not Matching Runtime Environment

**What goes wrong:** Tests pass locally but code fails in production because:
- Test environment doesn't match Vercel's Node.js version
- Mocks don't reflect actual API behavior
- Environment variables differ between test and runtime

**Why it happens:**
- Vitest/Jest run in different environment than Vercel functions
- `happy-dom` or `jsdom` don't perfectly match real browser
- Missing async handling (`no-floating-promises` not enabled)

**Prevention:**
1. **Pin Node.js version:** Use `.nvmrc` or `engines` field, match Vercel's runtime
2. **Enable TypeScript strict async:** Add `"no-floating-promises": "error"` to catch missing awaits
3. **Test against real environment:** Use `vercel dev` for integration tests
4. **Mock sparingly:** Over-mocking hides real integration issues

**Detection:**
- Tests pass but production fails
- Flaky tests (usually async timing issues)
- "Cannot find module" errors only in CI

**Phase to address:** Phase 1 (Initial Setup) - Set up testing before writing tests

**Sources:**
- [React Testing Library + Vitest Mistakes](https://medium.com/@samueldeveloper/react-testing-library-vitest-the-mistakes-that-haunt-developers-and-how-to-fight-them-like-ca0a0cda2ef8)
- [SST Unit Tests guide](https://guide.sst.dev/chapters/unit-tests-in-serverless.html)

---

### Pitfall 7: Choosing Edge Functions When Serverless is Required

**What goes wrong:** You use Vercel Edge Functions for their speed, but then discover you need:
- Native Node.js APIs (`fs`, `path`, `process`)
- TCP/UDP connections (databases)
- Bundles larger than 4MB
- Execution longer than 30 seconds

**Why it happens:**
- Edge Functions use V8 runtime, NOT Node.js
- Marketing emphasizes speed benefits without highlighting limitations
- Easy to start with Edge and hit walls later

**Consequences:**
- Rewriting functions to use serverless instead
- Architecture changes to work around Edge limitations
- Unexpected costs from function invocations vs compute time

**Prevention:**
1. **Default to Serverless Functions** unless you have a specific Edge use case
2. **Edge is best for:** Auth checks, redirects, A/B testing, geolocation-based routing
3. **Serverless is best for:** Database queries, file operations, heavy computation, long-running tasks
4. **Hybrid approach:** Edge for request routing, Serverless for data operations

**Detection:**
- "X is not defined" errors for Node.js APIs
- Bundle size errors during deployment
- Timeout errors on Pro plan (30s Edge vs 60s Serverless)

**Phase to address:** Phase 1 (Architecture Decision) - Decide function runtime strategy before implementation

**Sources:**
- [Vercel Edge Functions docs](https://vercel.com/docs/functions/runtimes/edge/edge-functions.rsc)
- [Edge vs Serverless Performance 2025](https://byteiota.com/edge-functions-vs-serverless-the-2025-performance-battle/)

---

### Pitfall 8: Large Bundle Sizes Causing Cold Start Timeouts

**What goes wrong:** Serverless functions take 2-5+ seconds on cold start because the bundle includes unnecessary dependencies.

**Why it happens:**
- Importing entire libraries when you need one function
- ORM clients (Prisma) adding 40MB+ to bundles
- Not tree-shaking dependencies properly
- Font files, icon libraries included in server bundles

**Consequences:**
- Poor user experience on first request
- Timeout errors on free tier (10s limit)
- Higher costs from longer execution times

**Prevention:**
1. **Analyze bundles:** Use `@next/bundle-analyzer` or `bundlephobia.com` before adding dependencies
2. **Use lightweight alternatives:** `date-fns` instead of `moment`, native fetch instead of axios
3. **For Prisma:** Use `bundlePagesExternals: true` in Next.js config
4. **Consider Vercel's Fluid compute:** Automatic cold start optimization on Pro plan
5. **Lazy load:** Dynamic imports for heavy dependencies

**Detection:**
- Check Vercel Observability tab for cold start metrics
- Function deploy output shows bundle sizes
- First requests consistently slower than subsequent ones

**Phase to address:** Phase 1 (Dependency Selection) - Choose lightweight dependencies from the start

**Sources:**
- [Vercel Cold Start Performance guide](https://vercel.com/kb/guide/how-can-i-improve-serverless-function-lambda-cold-start-performance-on-vercel)
- [Vercel Discussion #7961](https://github.com/vercel/vercel/discussions/7961)

---

### Pitfall 9: Not Enabling TypeScript Strict Mode (or Enabling It Too Late)

**What goes wrong:**
- **If disabled:** Runtime errors from null/undefined that TypeScript could have caught
- **If enabled late:** Thousands of errors appear, overwhelming refactoring effort

**Why it happens:**
- Default `strict: false` is permissive, hides real bugs
- Enabling `strict: true` on existing codebase is painful
- Developers delay strictness "until later" (later never comes)

**Consequences:**
- Runtime `TypeError: Cannot read property 'x' of undefined`
- Technical debt accumulates
- Refactoring to strict mode becomes major project

**Prevention:**
1. **Enable `strict: true` on day one** for new projects
2. **For existing projects:** Enable strict flags incrementally:
   - Start with `noImplicitAny: true`
   - Then `strictNullChecks: true`
   - Then remaining flags one at a time
3. **Add extra strictness:** `noUncheckedIndexedAccess: true` catches array/object access bugs

**Detection:**
- Check tsconfig.json for `strict` setting
- Run `tsc --noEmit` to see current error count
- Search codebase for `any` type usage

**Phase to address:** Phase 1 (Initial Setup) - Enable before writing any code

**Sources:**
- [Why strict: true isn't enough](https://itnext.io/why-typescripts-strict-true-isn-t-enough-missing-compiler-flags-for-production-code-a3877b81142c)

---

## Minor Pitfalls

Mistakes that cause annoyance but are quickly fixable.

---

### Pitfall 10: Utility Files in `/api` Directory Become Functions

**What goes wrong:** Helper files placed in `/api` directory get deployed as serverless functions, causing 404s or unexpected behavior.

**Why it happens:** Vercel's convention turns every file in `/api` into an endpoint.

**Prevention:**
- Prefix utility files with underscore: `_utils.ts`, `_helpers.ts`
- Or place utilities outside `/api` in `/lib` or `/utils`

**Detection:** Unexpected endpoints appearing in production

**Phase to address:** Phase 1 (Project Structure) - Establish conventions early

**Sources:**
- [Vercel Discussion #4983](https://github.com/vercel/vercel/discussions/4983)

---

### Pitfall 11: vercel.json Overrides Build Settings Silently

**What goes wrong:** You configure build settings in Vercel dashboard, but `vercel.json` in repo takes precedence without warning.

**Why it happens:** Vercel prioritizes file-based config over dashboard settings.

**Prevention:**
- Pick one source of truth: either `vercel.json` OR dashboard settings
- Check for `vercel.json` when debugging unexpected build behavior
- Use `vercel.ts` for type-safe configuration

**Detection:** Build warning: "Due to builds existing in your configuration file, the Build and Development Settings... will not apply"

**Phase to address:** Phase 1 (CI/CD Setup)

**Sources:**
- [Vercel Project Configuration docs](https://vercel.com/docs/project-configuration)

---

### Pitfall 12: Forgetting to Pin Dependency Versions

**What goes wrong:** A patch release of a dependency breaks your build, but works fine locally because you have older cached version.

**Why it happens:**
- `^` prefix allows minor/patch updates
- CI installs fresh, gets newer version
- "Works on my machine" syndrome

**Prevention:**
- Use lockfile (`pnpm-lock.yaml`, `package-lock.json`)
- Commit lockfile to git
- Consider `npm ci` instead of `npm install` in CI

**Detection:** Builds failing with errors not reproducible locally

**Phase to address:** Phase 1 (Initial Setup)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Initial tsconfig.json | Wrong moduleResolution | Use framework default, don't override module settings |
| Adding path aliases | Aliases not resolved | Configure bundler to match, or avoid aliases |
| First Vercel deploy | Works locally, fails prod | Run `vercel build` locally first |
| Adding database | Cold start timeouts | Use connection pooling, lightweight clients |
| Adding auth | Secrets in client bundle | Never use NEXT_PUBLIC_ for secrets |
| Testing setup | Tests don't match runtime | Pin Node version, test with `vercel dev` |
| Linting setup | ESLint/Prettier conflicts | Use eslint-config-prettier or Biome |
| Edge functions | Missing Node.js APIs | Default to serverless, Edge only for specific cases |

---

## Quick Reference Checklist

Before considering setup complete:

- [ ] `strict: true` enabled in tsconfig.json
- [ ] Module resolution matches target environment
- [ ] Path aliases configured in BOTH tsconfig AND bundler (or avoided entirely)
- [ ] ESLint/Prettier conflicts resolved (or using Biome)
- [ ] Environment variables documented (build-time vs runtime)
- [ ] `vercel build` tested locally
- [ ] Node.js version pinned
- [ ] Lockfile committed
- [ ] Utility files prefixed with `_` or outside `/api`
- [ ] Bundle size checked for serverless functions

---

## Sources Summary

**Official Documentation:**
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Vercel Functions docs](https://vercel.com/docs/functions)
- [TypeScript moduleResolution](https://www.typescriptlang.org/tsconfig/moduleResolution.html)
- [eslint-config-prettier](https://github.com/prettier/eslint-config-prettier)

**Community Issues & Discussions:**
- [Vercel TypeScript serverless functions](https://community.vercel.com/t/deploying-typescript-serverless-functions/4029)
- [Next.js moduleResolution issues](https://github.com/vercel/next.js/discussions/41189)
- [Vercel cold start discussion](https://github.com/vercel/vercel/discussions/7961)
- [Vercel API directory structure](https://github.com/vercel/vercel/discussions/4983)

**Guides & Best Practices:**
- [Modern ESLint 2025](https://advancedfrontends.com/eslint-flat-config-typescript-javascript/)
- [Path Aliases in TypeScript](https://dev.to/shane/path-aliases-in-typescript-with-vite-or-webpack-bundlers-3nmb)
- [Edge vs Serverless 2025](https://byteiota.com/edge-functions-vs-serverless-the-2025-performance-battle/)
