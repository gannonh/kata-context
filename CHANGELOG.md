# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-04

### Added

- PostgreSQL database foundation with Neon, Drizzle ORM, and pgvector extension
- Database schema for contexts and messages with type-safe definitions
- Database migration workflow (generate, migrate, push)
- Serverless connection pooling with pg driver and Vercel Fluid support
- ContextRepository with create, findById, softDelete, exists operations
- MessageRepository with batch insert, cursor pagination, and token-budgeted windowing
- REST API endpoints: POST/GET/DELETE contexts, POST/GET messages, GET token window
- Zod validation schemas for all API request/response types
- RFC 9457 error response format
- Local dev server workaround for vercel dev limitations
- 100% test coverage enforcement with @vitest/coverage-v8
- 87 tests (40 repository + 26 unit + 21 integration)

### Fixed

- ESM/CJS interop for pg module in Vercel serverless
- CI pnpm version configuration

## [0.1.0] - 2026-01-29

### Added

- TypeScript project with `strict: true` and NodeNext module resolution
- Biome for linting and formatting with recommended rules
- Vitest for TypeScript testing with passWithNoTests for CI
- GitHub Actions CI workflow running lint and test on push/PR
- Vercel health endpoint at `/api/health` returning status JSON
- Pre-commit hooks via Husky and lint-staged for automatic code validation
- pnpm as package manager with locked dependencies

### Fixed

- Vercel configuration for successful local builds
