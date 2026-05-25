# context-pruner

A pi extension that reduces context token usage by replacing stale tool results
with lightweight stubs before each LLM call.

## Problem

Between compactions (~100 turns), tool results accumulate in context. The LLM
re-reads all of them every turn, even though most are stale:

- A file read 40 turns ago (already processed, possibly since modified)
- A directory listing from before a restructure
- grep results used to locate code that's already been edited
- Test output from a run that's since been re-run

In real sessions, **76% of context is tool results** and **77% of those are in
the "old" first 70% of messages**. Most of this bulk is never referenced again.

## Approach: Supersession-aware pruning (Strategy 2)

Replace old tool results with one-line stubs. Decide what to prune based on
whether the result is **stale**, **ephemeral**, or **still relevant**:

### What gets pruned (old messages only — recent N turns always kept)

| Category | Condition | Stub format |
|----------|-----------|-------------|
| Read (superseded) | File was later written/edited | `[read src/foo.ts — 245 lines (file was later modified)]` |
| Read (old) | Not superseded but old | `[read src/foo.ts — 245 lines]` |
| bash: ls/find/tree | Always ephemeral | `[ls src/ — 47 entries]` |
| bash: cat/head/tail | Same as read | `[cat file — 120 lines]` |
| bash: grep/rg | Search results are re-runnable | `[grep "pattern" — 23 matches]` |
| bash: other >2KB | Large one-shot output | `[bash: <command> — 4.2KB output, exit 0]` |

### What's always kept

| Category | Why |
|----------|-----|
| Recent (last N turns) | Agent may reference immediately |
| Small results (<500 chars) | Cheap to keep, might be referenced |
| Error results | Agent needs error context |
| Edit/write confirmations | Small, structurally important |
| bash: other <2KB | Small enough to keep |

## Architecture

Same generator-effects pattern as smart-compact:

```
pruning.ts        — pure logic: classify messages, decide what to prune, generate stubs
context-pruner.ts — thin runner: context event handler, interprets decisions
```

The `context` event provides a **deep copy** of messages — we mutate freely
without affecting the session. The session file is never modified.

## Projected savings

Based on analysis of 111 real between-compaction slices (12.9MB of tool results):

| Strategy | Savings per turn | Combined with RTK |
|----------|-----------------|-------------------|
| Conservative (superseded reads + informational bash) | ~11% | ~20% |
| Aggressive (all old except small + errors) | ~17% | ~25% |

## Configuration

```json
{
  "recentTurnsToKeep": 10,
  "minSizeToStub": 500,
  "pruneReads": true,
  "pruneBashInformational": true,
  "pruneBashLarge": true,
  "pruneBashLargeThreshold": 2048
}
```

## Risk mitigation

- Stubs include enough info to re-run (`[grep "pattern" — 23 matches]`)
- Error results are never pruned
- Recent turns (configurable window) are always kept intact
- Small results are always kept (negligible savings, might be referenced)
- Session files are never modified — pruning is context-only

## Install

```bash
pi install git:github.com/leo-ar/pi-kit extensions/context-pruner
```
