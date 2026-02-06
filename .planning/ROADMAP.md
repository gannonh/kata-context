# Roadmap: Kata Context

Policy-based context window management for AI agents. This roadmap covers the core engine implementation with compaction policies, context forking, and time-travel capabilities.

---

## Milestones

- [x] **v0.1.0 Core Setup** (Shipped 2026-01-29)
- [x] **v0.2.0 Database + Storage Layer** (Shipped 2026-02-04)
- [ ] **v0.3.0 Policy Engine** (Current)

---

## Completed Milestones

<details>
<summary>v0.1.0 Core Setup (Shipped 2026-01-29)</summary>

**Goal:** TypeScript/Vercel project foundation with linting, testing, CI, and serverless infrastructure.

**Phases:** 2 (4 plans)

**Archive:** See .planning/MILESTONES.md for details.

</details>

<details>
<summary>v0.2.0 Database + Storage Layer (Shipped 2026-02-04)</summary>

**Goal:** PostgreSQL storage foundation with Drizzle ORM, repository abstraction, REST API, and comprehensive test coverage.

**Phases:** 3 (8 plans)

**Archive:** See .planning/MILESTONES.md for details.

</details>

---

## Planned Milestones

**v0.4.0 SDK Layer**
- Goal: Python and TypeScript SDKs for Kata Context API
- Target features: Type-safe clients, async support, authentication

**v1.0.0 Commercial MVP**
- Goal: Hosted API with multi-tenancy and billing
- Target features: Stripe integration, access control, usage metering

---

## Current Milestone: v0.3.0 Policy Engine

**Goal:** Implement core context management logic with compaction policies, context forking, and time-travel capabilities.

**Phases:** 4
**Requirements:** 26

---

### Phase 6: Infrastructure + Policy Foundation

**Goal:** Establish infrastructure dependencies and policy configuration storage for subsequent phases.

**Dependencies:** None (foundation phase)
**Plans:** 2 (2 waves)

- [x] 06-01: Infrastructure setup (gpt-tokenizer, schema extensions, migration, validation module)
- [x] 06-02: Repository layer update + tests (policy config CRUD, token counting tests, coverage)

**Requirements:**
- INFRA-01: Add gpt-tokenizer dependency for token counting
- INFRA-02: Add policy_config JSONB column to contexts table
- INFRA-03: Add compaction tracking columns to messages
- POLICY-01: User can store compaction policy configuration per context
- POLICY-02: System applies default policy when no context-specific policy exists
- POLICY-03: Policy includes: threshold, preserve_recent_count, enabled flag

**Success Criteria:**
1. Token counting returns consistent results for messages using gpt-tokenizer
2. Context can be created with custom policy configuration that persists across retrieval
3. Context without explicit policy configuration receives default policy values
4. Policy configuration includes all required fields (threshold, preserve_recent_count, enabled)

---

### Phase 7: Forking + Time-Travel

**Goal:** Enable conversation branching and historical state reconstruction using existing version semantics.

**Dependencies:** Phase 6 (schema changes must be applied)

**Requirements:**
- FORK-01: User can create a fork from any version of a context
- FORK-02: User can list all forks of a context
- FORK-03: Forked context inherits messages up to fork point
- FORK-04: Fork operation records parent context and fork version
- TIME-01: User can retrieve context state at any historical version
- TIME-02: User can list version history with metadata (timestamp, role, preview)
- TIME-03: Version queries respect soft-deleted message visibility rules

**Success Criteria:**
1. User can create a fork from message version 5 and the fork contains only messages 1-5
2. User can list all forks of a context and see fork point version for each
3. User can retrieve context state at version N and see only messages 1 through N
4. User can list version history showing timestamp, role, and content preview for each message
5. Soft-deleted messages are excluded from time-travel queries by default

---

### Phase 8: Compaction Core

**Goal:** Implement threshold-triggered compaction with configurable preservation and metadata tracking.

**Dependencies:** Phase 6 (policy configuration), Phase 7 (version semantics validated)

**Requirements:**
- COMP-01: System can detect when context reaches configurable token threshold
- COMP-02: System can generate summaries of older messages via pluggable LLM interface
- COMP-03: User can configure compaction threshold per context
- COMP-04: System preserves last N messages verbatim (configurable, default 10)
- COMP-05: System tracks compaction metadata (when, what policy, original/resulting tokens)
- COMP-06: Compacted messages are soft-deleted with reference to summary version

**Success Criteria:**
1. System detects when context token count exceeds configured threshold percentage
2. Compaction preserves the most recent N messages unmodified (default 10)
3. Compaction generates a summary message containing condensed content from older messages
4. Compacted messages are soft-deleted and reference the summary version that replaced them
5. Compaction metadata records original token count, resulting token count, and timestamp

---

### Phase 9: API Layer

**Goal:** Expose forking, time-travel, compaction, and policy operations via REST endpoints.

**Dependencies:** Phases 6-8 (all core functionality must exist)

**Requirements:**
- API-01: POST /contexts/:id/compact - trigger compaction for a context
- API-02: POST /contexts/:id/fork - create fork from specified version
- API-03: GET /contexts/:id/forks - list all forks of a context
- API-04: GET /contexts/:id/history - list version history
- API-05: GET /contexts/:id/at/:version - retrieve context state at version
- API-06: PUT /contexts/:id/policy - update context policy configuration
- API-07: GET /contexts/:id/policy - retrieve context policy

**Success Criteria:**
1. POST /contexts/:id/compact triggers compaction and returns compaction metadata
2. POST /contexts/:id/fork creates a new context with messages copied up to specified version
3. GET /contexts/:id/forks returns list of child contexts with fork version metadata
4. GET /contexts/:id/history returns paginated version history with message previews
5. GET /contexts/:id/at/:version returns context state as it existed at that version

---

## Progress Summary

| Milestone | Status | Phases | Plans | Requirements |
|-----------|--------|--------|-------|--------------|
| v0.1.0 Core Setup | Shipped | 2/2 | 4/4 | Complete |
| v0.2.0 Database + Storage | Shipped | 3/3 | 8/8 | Complete |
| v0.3.0 Policy Engine | In Progress | 1/4 | 2/? | 6/26 |
| v0.4.0 SDK Layer | Planned | - | - | - |
| v1.0.0 Commercial MVP | Planned | - | - | - |

---

*Last updated: 2026-02-06*
