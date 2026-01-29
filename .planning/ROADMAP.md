# Roadmap

## Overview

| Milestone | Phases | Status |
|-----------|--------|--------|
| v0.1.0 Core Setup | 1-2 | In Progress |

---

### v0.1.0 Core Setup (In Progress)

#### Phase 1: Foundation

**Goal**: Establish a working TypeScript development environment with linting, formatting, and testing.

**Dependencies**: None (first phase)

**Requirements**: INIT-01, INIT-02, INIT-03, TOOL-01, TOOL-02

**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Initialize pnpm project with dependencies and .gitignore
- [x] 01-02-PLAN.md — Configure TypeScript, Biome, and Vitest tooling

**Success Criteria** (what must be TRUE when this phase completes):
1. Developer can run `pnpm install` and get all dependencies installed
2. Developer can run `pnpm lint` and `pnpm format` with Biome checking TypeScript files
3. Developer can run `pnpm test` and Vitest executes (even with no tests yet)
4. Developer can run `pnpm build` and TypeScript compiles with strict mode enabled
5. TypeScript module resolution uses `NodeNext` for Vercel compatibility

#### Phase 2: Automation and Deployment

**Goal**: Add git hooks, CI pipeline, and Vercel serverless structure with verification.

**Dependencies**: Phase 1 (requires working lint/test commands)

**Requirements**: TOOL-03, TOOL-04, VERCEL-01, VERCEL-02, VERCEL-03

**Plans:** 2 plans

Plans:
- [ ] 02-01-PLAN.md — Configure Husky and lint-staged for pre-commit validation
- [ ] 02-02-PLAN.md — Set up GitHub Actions CI and Vercel health endpoint

**Success Criteria** (what must be TRUE when this phase completes):
1. Git commit triggers Husky pre-commit hook that runs lint-staged
2. Pushing to GitHub triggers Actions workflow that runs lint and test
3. `/api/health.ts` endpoint exists and returns a status response
4. `vercel build` succeeds locally without errors
5. Project structure follows Vercel Functions convention (`/api` directory)

---

## Progress

| Phase | Name | Status | Requirements |
|-------|------|--------|--------------|
| 1 | Foundation | Complete | INIT-01, INIT-02, INIT-03, TOOL-01, TOOL-02 |
| 2 | Automation and Deployment | Pending | TOOL-03, TOOL-04, VERCEL-01, VERCEL-02, VERCEL-03 |

---
*Generated: 2026-01-29*
