# Requirements: v0.3.0 Policy Engine

**Milestone:** v0.3.0 Policy Engine
**Created:** 2026-02-05
**Status:** Active

---

## v0.3.0 Requirements

### Compaction (COMP)

- [ ] **COMP-01**: System can detect when context reaches configurable token threshold (default 80% of budget)
- [ ] **COMP-02**: System can generate summaries of older messages via pluggable LLM interface
- [ ] **COMP-03**: User can configure compaction threshold per context
- [ ] **COMP-04**: System preserves last N messages verbatim (configurable, default 10)
- [ ] **COMP-05**: System tracks compaction metadata (when, what policy, original/resulting tokens)
- [ ] **COMP-06**: Compacted messages are soft-deleted with reference to summary version

### Forking (FORK)

- [ ] **FORK-01**: User can create a fork from any version of a context
- [ ] **FORK-02**: User can list all forks of a context
- [ ] **FORK-03**: Forked context inherits messages up to fork point
- [ ] **FORK-04**: Fork operation records parent context and fork version

### Time-Travel (TIME)

- [ ] **TIME-01**: User can retrieve context state at any historical version
- [ ] **TIME-02**: User can list version history with metadata (timestamp, role, preview)
- [ ] **TIME-03**: Version queries respect soft-deleted message visibility rules

### Policy Configuration (POLICY)

- [x] **POLICY-01**: User can store compaction policy configuration per context
- [x] **POLICY-02**: System applies default policy when no context-specific policy exists
- [x] **POLICY-03**: Policy includes: threshold, preserve_recent_count, enabled flag

### API Endpoints (API)

- [ ] **API-01**: POST /contexts/:id/compact - trigger compaction for a context
- [ ] **API-02**: POST /contexts/:id/fork - create fork from specified version
- [ ] **API-03**: GET /contexts/:id/forks - list all forks of a context
- [ ] **API-04**: GET /contexts/:id/history - list version history
- [ ] **API-05**: GET /contexts/:id/at/:version - retrieve context state at version
- [ ] **API-06**: PUT /contexts/:id/policy - update context policy configuration
- [ ] **API-07**: GET /contexts/:id/policy - retrieve context policy

### Infrastructure (INFRA)

- [x] **INFRA-01**: Add gpt-tokenizer dependency for token counting
- [x] **INFRA-02**: Add policy_config JSONB column to contexts table
- [x] **INFRA-03**: Add compaction tracking columns to messages (compacted_at, compacted_into_version)

---

## Future Requirements (Deferred)

### Compaction Enhancements
- Reversible compaction (large outputs to file references)
- Structured compaction templates (domain-specific summaries)
- Iterative summary merging (vs full regeneration)
- Interval-based compaction (every N messages)
- Artifact tracking (preserve file paths, tool IDs through compaction)

### Forking Enhancements
- Fork options (visible only, include branches, include all)
- Branch comparison (diff two forks)
- Fork depth limits

### Time-Travel Enhancements
- Checkpoint tagging (named versions)
- Resume from version (fork + continue workflow)

### Policy Enhancements
- Policy presets ("sequential-processing", "multi-phase")
- Policy analytics (compression ratios, information preserved)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Embedding computation | Deferred to semantic retrieval milestone |
| Semantic search | Requires embeddings |
| Multi-tenancy | Commercial MVP milestone |
| Real-time sync/streaming | REST sufficient for MVP |
| Automatic summarization model selection | User provides LLM interface |
| Async compaction with job queue | Synchronous is sufficient for MVP; add if latency is an issue |

---

## Traceability

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| INFRA-01 | Phase 6 | 06-01 | Complete |
| INFRA-02 | Phase 6 | 06-01 | Complete |
| INFRA-03 | Phase 6 | 06-01 | Complete |
| POLICY-01 | Phase 6 | 06-02 | Complete |
| POLICY-02 | Phase 6 | 06-02 | Complete |
| POLICY-03 | Phase 6 | 06-02 | Complete |
| FORK-01 | Phase 2 | - | Pending |
| FORK-02 | Phase 2 | - | Pending |
| FORK-03 | Phase 2 | - | Pending |
| FORK-04 | Phase 2 | - | Pending |
| TIME-01 | Phase 2 | - | Pending |
| TIME-02 | Phase 2 | - | Pending |
| TIME-03 | Phase 2 | - | Pending |
| COMP-01 | Phase 3 | - | Pending |
| COMP-02 | Phase 3 | - | Pending |
| COMP-03 | Phase 3 | - | Pending |
| COMP-04 | Phase 3 | - | Pending |
| COMP-05 | Phase 3 | - | Pending |
| COMP-06 | Phase 3 | - | Pending |
| API-01 | Phase 4 | - | Pending |
| API-02 | Phase 4 | - | Pending |
| API-03 | Phase 4 | - | Pending |
| API-04 | Phase 4 | - | Pending |
| API-05 | Phase 4 | - | Pending |
| API-06 | Phase 4 | - | Pending |
| API-07 | Phase 4 | - | Pending |

---

*Last updated: 2026-02-06*
