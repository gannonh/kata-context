# PR Review Suggestions

Created: 2026-02-01
Source: PR #14 review (type-design, failure-finder agents)

## Database Schema

- [ ] **Remove redundant index** - `messages_context_version_idx` is redundant since unique constraint creates one
  - File: `src/db/schema/messages.ts`
  - Priority: Low

- [ ] **Add fork integrity CHECK constraint** - Ensure parentId and forkVersion are both-or-neither
  - File: `src/db/schema/contexts.ts`
  - Priority: Medium

- [ ] **Add deletedAt index on contexts** - Match messages table for consistent soft-delete query performance
  - File: `src/db/schema/contexts.ts`
  - Priority: Low

- [ ] **Add non-negativity CHECK constraints** - Prevent negative messageCount and totalTokens
  - File: `src/db/schema/contexts.ts`
  - Priority: Low

## Error Handling

- [ ] **Add pool diagnostics to health error response** - Include pool stats (totalCount, idleCount, waitingCount) for debugging
  - File: `api/health.ts`
  - Priority: Medium

- [ ] **Establish logging utilities** - Create centralized logging module before adding more features
  - Priority: Medium
  - Notes: Simple module that can be enhanced with Sentry/monitoring later
