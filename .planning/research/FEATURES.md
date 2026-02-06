# Feature Landscape: Context Policy Engine

**Domain:** AI agent context management (compaction, forking, time-travel)
**Researched:** 2026-02-05
**Previous Research:** 2026-01-29 (v0.2.0 Storage Layer)
**Focus:** Policy engine features built on existing storage layer
**Overall Confidence:** HIGH

## Executive Summary

The context policy engine extends Kata Context's existing storage layer (contexts, messages with versioning, token-budgeted windowing) with intelligent context management. The core value proposition: "Given messages and a context budget, determine the optimal window to send to the model while preserving critical information."

Research into Claude Platform, LangGraph, Google ADK, and Factory.ai reveals mature patterns for compaction, forking, and time-travel. The schema already supports forking (`parentId`, `forkVersion`) and versioning (`version` column). Policy engine adds the decision layer on top.

---

## Existing Foundation (v0.2.0 Complete)

| Feature | Status | Notes |
|---------|--------|-------|
| Message persistence with versioning | Built | `version` column, unique per context |
| Token-budget windowing | Built | `getByTokenBudget()` returns messages fitting budget |
| Cursor-based pagination | Built | Version-based cursor, efficient retrieval |
| Soft delete | Built | `deletedAt` timestamp |
| Fork schema support | Built | `parentId`, `forkVersion` columns exist |
| Context CRUD | Built | Create, read, soft-delete operations |

---

## Table Stakes: Policy Engine

Features users expect from a context policy engine. Missing = incomplete product.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Threshold-triggered compaction** | Standard pattern across Claude, LangGraph, ADK | Medium | Token counting (exists) | Trigger at 80% of budget is industry standard |
| **Summarization-based compaction** | LLM generates summary of older messages | Medium | External LLM call | All major frameworks use this approach |
| **Configurable threshold** | Different use cases need 5k-150k token triggers | Low | Config storage | Claude docs: ranges by use case |
| **Preserve recent messages verbatim** | Prevents model "rhythm" degradation | Low | None | Keep last 10-20 messages uncompressed |
| **Compaction metadata** | Track what was compacted, when, by what policy | Low | Schema addition | Enables reversibility, debugging |
| **Fork from message** | Create new context branching from specific message | Medium | Schema exists (`parentId`, `forkVersion`) | ChatGPT, LibreChat standard feature |
| **Fork options** | Visible only, include branches, include all | Medium | Message relationship tracking | LibreChat patterns |
| **Jump to version** | Retrieve context state at any historical version | Low | `findByVersion` (exists) | Core time-travel operation |
| **Version history listing** | List all versions/checkpoints for a context | Low | Version column exists | Navigation for time-travel |
| **Policy configuration** | Define compaction rules per context or globally | Medium | Config schema | Essential for customization |

**Confidence:** HIGH - Based on [Claude Platform docs](https://platform.claude.com/cookbook/tool-use-automatic-context-compaction), [LangGraph time-travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel), [Google ADK](https://google.github.io/adk-docs/context/compaction/).

---

## Differentiators

Features that set Kata Context apart from other context management solutions.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Structured compaction templates** | Custom summary prompts preserve domain-specific info | Medium | Template storage | Factory.ai shows 0.35pt accuracy improvement |
| **Artifact tracking** | Separate index for files/resources, survives compaction | High | Artifact schema | All systems score 2.2-2.5/5 on this; unsolved |
| **Reversible compaction** | Large outputs become file refs, retrievable on demand | Medium | File/blob storage | Claude + Deep Agents SDK pattern |
| **Policy presets** | Pre-configured: "sequential-processing", "multi-phase" | Low | Policy config | Reduces user decision burden |
| **Multi-level memory** | Immediate, episodic, semantic at different retention | High | Multiple storage tiers | Mem0: 26% quality gain, 90% token reduction |
| **Sliding window with overlap** | Configurable overlap between compression windows | Low | Overlap parameter | Google ADK pattern |
| **Iterative summary merging** | Merge new summary into persistent state | Medium | Persistent summary | Factory.ai: better than regeneration |
| **Interval-based compaction** | Trigger every N messages vs at X tokens | Low | Scheduler config | ADK offers both patterns |
| **Branch comparison** | Compare two forks side-by-side | Medium | Diff algorithm | Git-like workflow for agents |
| **Checkpoint tagging** | Named checkpoints: "before-refactor", "working-state" | Low | Tag schema | Agent-Git pattern |
| **Compaction analytics** | Track compression ratios, information preserved | Low | Metrics storage | Debugging and optimization |

**Confidence:** MEDIUM - Based on [Factory.ai evaluation](https://factory.ai/news/evaluating-compression), [Agent-Git](https://github.com/HKU-MAS-Infra-Layer/Agent-Git), research papers.

---

## Anti-Features

Features to deliberately NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Aggressive auto-compaction without config** | Different tasks need different context amounts | Require explicit policy; sensible defaults |
| **Lossy-only summarization** | Information loss causes expensive re-fetching | Reversible compaction first, lossy second |
| **Context-in-summary-only** | Breaks audit trails, prevents recovery | Preserve originals; summary is view layer |
| **Compress recent messages** | Degrades model "rhythm" and output quality | Always preserve last N messages verbatim |
| **Single compaction strategy** | Sequential vs multi-phase vs audit need different approaches | Policy presets or user-configurable |
| **ROUGE/embedding for eval** | Measures lexical similarity, not task resumption | Functional probes: can agent continue? |
| **Full regeneration each compaction** | Expensive, error-prone, loses incremental insights | Iterative summary merging |
| **Auto-fork on every edit** | Creates branching explosion | Explicit fork; edits overwrite by default |
| **Unlimited branch depth** | Performance and complexity spiral | Cap at 10 levels or flatten old branches |
| **Tight coupling to specific LLM** | Different models need different approaches | Pluggable summarizer interface |
| **Synchronous compaction in hot path** | Blocks user operations | Async compaction with immediate response |

**Confidence:** HIGH - Based on [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), [Factory.ai evaluation](https://factory.ai/news/evaluating-compression), [compaction experiments](https://jxnl.co/writing/2025/08/30/context-engineering-compaction/).

---

## Feature Dependencies

```
Existing Storage Layer (v0.2.0)
    |
    +-- Token-Budget Windowing (getByTokenBudget)
    |       |
    |       v
    |   Threshold Detection
    |       |
    |       +---> Compaction Trigger
    |               |
    |               +---> Summarization (external LLM)
    |               |       |
    |               |       +---> Structured Templates
    |               |       |
    |               |       +---> Iterative Merging
    |               |
    |               +---> Reversible Compaction
    |                       |
    |                       +---> File Reference Storage
    |
    +-- Version Tracking (version column)
    |       |
    |       +---> Version History Listing
    |       |
    |       +---> Jump to Version
    |       |
    |       +---> Checkpoint Tagging
    |
    +-- Fork Schema (parentId, forkVersion)
            |
            +---> Fork from Message
            |
            +---> Fork Options
            |
            +---> Branch Comparison

Policy Configuration (new)
    |
    +---> Threshold Settings
    |
    +---> Policy Presets
    |
    +---> Per-Context Overrides
```

---

## Compaction Strategy Details

### Strategy 1: Threshold-Based (Recommended Default)

When context reaches X% of budget:
1. Preserve last N messages verbatim
2. Summarize older messages using LLM
3. Store summary as new system message
4. Mark original messages as "compacted" (not deleted)
5. Update context metadata with compaction info

**Thresholds by use case** (from Claude docs):
| Threshold | Use Case | Characteristics |
|-----------|----------|-----------------|
| 5k-20k | Sequential entity processing | Frequent compaction, minimal accumulation |
| 50k-100k | Multi-phase workflows | Balance retention/management |
| 100k-150k | Tasks requiring context | Less frequent, more details |
| Default 100k | General long-running tasks | Good balance |

### Strategy 2: Interval-Based

Compact after every N messages:
1. Count messages since last compaction
2. When count reaches N, trigger compaction
3. Use configurable overlap (e.g., include last 1-2 summarized messages in new summary)

**Google ADK pattern**: compaction_interval=3, overlap_size=1

### Strategy 3: Reversible Compaction

For large tool outputs (>10k tokens):
1. Store full content externally (file/blob)
2. Replace in context with: file path + first 1k tokens preview
3. Agent can retrieve full content via tool if needed

**From Claude Deep Agents SDK**: Trigger at 85% window, offload >20k token responses.

---

## Forking Behavior Details

### Fork Options (LibreChat Pattern)

**Visible Messages Only**
- Copies only direct path to target message
- Excludes branching alternatives
- Minimal fork

**Include Related Branches**
- Direct path plus branches along the path
- Balanced context preservation

**Include All (Default)**
- All messages leading to target, including neighbors
- Comprehensive but larger

### Fork Operations

```typescript
interface ForkOptions {
  sourceContextId: string;
  fromVersion: number;        // Version to fork from
  mode: 'visible' | 'branches' | 'all';
  name?: string;              // Optional fork name
}

interface ForkResult {
  newContextId: string;
  copiedMessageCount: number;
  forkVersion: number;        // Version in source where fork occurred
}
```

---

## Time-Travel Implementation

### Version History

```typescript
interface VersionHistory {
  contextId: string;
  versions: VersionInfo[];
}

interface VersionInfo {
  version: number;
  timestamp: Date;
  messageRole: 'user' | 'assistant' | 'system' | 'tool';
  preview: string;            // First 100 chars of message
  tag?: string;               // Optional checkpoint tag
}
```

### Jump to Version

Already supported by `findByVersion`. Policy engine adds:
- Caching of version snapshots for large conversations
- Lazy loading of message content
- Ability to "resume from version" (creates new fork)

---

## MVP Recommendation

### Phase 1: Basic Compaction (Ship First)

1. **Threshold-triggered compaction** - 80% of configured budget
2. **Summarization via LLM** - Pluggable interface, Claude default
3. **Configurable threshold** - Per-context setting
4. **Preserve recent verbatim** - Last 10 messages always kept
5. **Compaction metadata** - Track when, what policy, token savings

### Phase 2: Forking

1. **Fork from message** - Use existing schema
2. **Fork options** - Visible only (simplest first)
3. **Fork listing** - Get all forks of a context

### Phase 3: Time-Travel Enhancement

1. **Version history endpoint** - List all versions with metadata
2. **Checkpoint tagging** - Named versions
3. **Resume from version** - Fork + continue workflow

### Defer to Later

| Feature | Why Defer | When to Build |
|---------|-----------|---------------|
| Artifact tracking | High complexity, unsolved problem | After user feedback |
| Multi-level memory | Architectural complexity | Advanced features phase |
| Branch comparison | Nice-to-have UX | When forking usage is high |
| Structured templates | Needs domain discovery | After compaction validated |
| Interval-based compaction | Threshold is simpler | If users request |

---

## Complexity Assessment

| Feature | Effort (days) | Risk | Notes |
|---------|---------------|------|-------|
| Compaction trigger + threshold | 1-2 | Low | Well-documented patterns |
| LLM summarization interface | 1-2 | Low | Pluggable design |
| Preserve recent verbatim | 0.5 | Low | Config + filtering |
| Compaction metadata schema | 0.5 | Low | Simple addition |
| Policy configuration | 1 | Low | Standard config pattern |
| Fork from message | 1-2 | Low | Schema exists |
| Fork options | 1-2 | Medium | Message traversal logic |
| Version history endpoint | 0.5 | Low | Query existing data |
| Checkpoint tagging | 1 | Low | Add tag column |
| Reversible compaction | 3-5 | Medium | External storage |
| Artifact tracking | 5-10 | High | Novel problem |
| **Total MVP (Phases 1-3)** | **~10 days** | |

---

## Sources

### HIGH Confidence (Official Documentation)

- [Claude Platform: Automatic Context Compaction](https://platform.claude.com/cookbook/tool-use-automatic-context-compaction) - Threshold guidelines, implementation patterns
- [LangGraph: Time Travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel) - Checkpoint management, state replay, branching
- [Google ADK: Context Compression](https://google.github.io/adk-docs/context/compaction/) - Interval-based compaction, overlap configuration
- [Anthropic: Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) - Compaction strategies, note-taking patterns
- [LangChain: Context Management for Deep Agents](https://blog.langchain.com/context-management-for-deepagents/) - Offloading patterns, summarization

### MEDIUM Confidence (Verified Technical Sources)

- [Factory.ai: Evaluating Compression](https://factory.ai/news/evaluating-compression) - Compaction evaluation framework, accuracy metrics
- [LibreChat: Forking](https://www.librechat.ai/docs/features/fork) - Fork options, use cases
- [Will Larson: Context Window Compaction](https://lethain.com/agents-context-compaction/) - Threshold implementation, virtual files
- [ChatGPT Branched Chats](https://medium.com/@CherryZhouTech/chatgpt-launches-branched-chats-effortless-multi-threaded-conversations-d188b90bd78b) - User-facing forking patterns

### LOW Confidence (Research/Community)

- [Agent-Git](https://github.com/HKU-MAS-Infra-Layer/Agent-Git) - Git-like version control for agents
- [Forky](https://ishan.rs/posts/forky-git-style-llm-history) - Tree-based conversation history
- [Jason Liu: Compaction Experiments](https://jxnl.co/writing/2025/08/30/context-engineering-compaction/) - Research directions
- [Mem0 Memory Systems](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025) - Multi-level memory patterns
