# Requirements: Kata Context

## v0.2.0 Database + Storage Layer

### Database Infrastructure

- [ ] **DB-01**: PostgreSQL database provisioned on Neon with pgvector extension enabled
- [ ] **DB-02**: Drizzle ORM configured with type-safe schema definitions
- [ ] **DB-03**: Database migration workflow established (generate -> migrate)
- [ ] **DB-04**: Serverless connection pooling configured (@neondatabase/serverless + Vercel Fluid)

### Schema

- [ ] **SCHEMA-01**: Contexts table with id, metadata, created_at, updated_at, deleted_at
- [ ] **SCHEMA-02**: Messages table with context_id, role, content, token_count, sequence, created_at
- [ ] **SCHEMA-03**: Embedding column on messages (vector type, unpopulated until v0.3.0)
- [ ] **SCHEMA-04**: Indexes for efficient retrieval (context_id + sequence, deleted_at)

### Data Access

- [ ] **DATA-01**: Create new context with optional metadata
- [ ] **DATA-02**: Retrieve context by ID with message count
- [ ] **DATA-03**: Append messages to context (batch insert with sequence assignment)
- [ ] **DATA-04**: Retrieve messages with cursor-based pagination
- [ ] **DATA-05**: Soft delete context (set deleted_at, preserve history)
- [ ] **DATA-06**: Token-budgeted windowing (retrieve last N tokens worth of messages)

### API Endpoints

- [ ] **API-01**: POST /api/v1/contexts - create new context, returns context_id
- [ ] **API-02**: GET /api/v1/contexts/:id - retrieve context with metadata and message count
- [ ] **API-03**: DELETE /api/v1/contexts/:id - soft delete context
- [ ] **API-04**: POST /api/v1/contexts/:id/messages - append messages to context
- [ ] **API-05**: GET /api/v1/contexts/:id/messages - retrieve messages with pagination
- [ ] **API-06**: GET /api/v1/contexts/:id/window?budget=N - retrieve token-budgeted window

### Testing

- [ ] **TEST-01**: Unit tests for repository layer with mocked database
- [ ] **TEST-02**: Integration tests for API endpoints against test database
- [ ] **TEST-03**: Token-budgeted windowing edge cases (empty context, budget exceeds total)

---

## Future Requirements (v0.3.0+)

### Policy Engine (v0.3.0)
- Point-in-time retrieval (get messages as of version N)
- Compaction policy (configurable aggressiveness)
- Context forking for exploration paths
- Embedding computation and storage

### Semantic Retrieval (v0.4.0+)
- Vector similarity search
- Hybrid retrieval (recency + relevance)
- HNSW index optimization

---

## Out of Scope

| Excluded | Reason |
|----------|--------|
| Authentication/authorization | Defer to security milestone |
| Multi-tenancy | Defer to v1.0 commercial MVP |
| Automatic summarization | Policy engine concern (v0.3.0) |
| Embedding computation | Policy engine concern (v0.3.0) |
| Rate limiting | Production hardening milestone |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 3 | Pending |
| DB-02 | Phase 3 | Pending |
| DB-03 | Phase 3 | Pending |
| DB-04 | Phase 3 | Pending |
| SCHEMA-01 | Phase 3 | Pending |
| SCHEMA-02 | Phase 3 | Pending |
| SCHEMA-03 | Phase 3 | Pending |
| SCHEMA-04 | Phase 3 | Pending |
| DATA-01 | Phase 4 | Pending |
| DATA-02 | Phase 4 | Pending |
| DATA-03 | Phase 4 | Pending |
| DATA-04 | Phase 4 | Pending |
| DATA-05 | Phase 4 | Pending |
| DATA-06 | Phase 4 | Pending |
| API-01 | Phase 5 | Pending |
| API-02 | Phase 5 | Pending |
| API-03 | Phase 5 | Pending |
| API-04 | Phase 5 | Pending |
| API-05 | Phase 5 | Pending |
| API-06 | Phase 5 | Pending |
| TEST-01 | Phase 5 | Pending |
| TEST-02 | Phase 5 | Pending |
| TEST-03 | Phase 5 | Pending |

---

*Created: 2026-01-29 | Updated: 2026-01-30 | Milestone: v0.2.0 Database + Storage Layer*
