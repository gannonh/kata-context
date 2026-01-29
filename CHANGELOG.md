# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
