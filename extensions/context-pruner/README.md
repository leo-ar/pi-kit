# context-pruner

A pi extension that reduces context token usage by replacing stale tool results
with lightweight stubs before each LLM call.

## Problem

Between compactions, tool results accumulate in context. The LLM re-reads all of
them every turn, even though most are stale:

- A file read 40 turns ago (already processed, possibly since modified)
- A directory listing from before a restructure
- grep results used to locate code that's already been edited
- Test output from a run that's since been re-run

In real sessions, **76% of context is tool results** and **77% of those are in
the "old" first 70% of messages**.

## How it works

Hooks pi's `context` event (fires before every LLM call). Replaces old tool
results with one-line stubs. The session is never modified — only the in-flight
context copy is altered.

### What gets pruned (old messages only — recent K turns always kept)

| Category | Stub format |
|----------|-------------|
| Read (superseded by later write/edit) | `[read src/foo.ts — 245 lines (file was later modified)]` |
| Read (old) | `[read src/foo.ts — 245 lines]` |
| bash: ls/find/tree | `[ls src/ — 47 entries]` |
| bash: cat/head/tail | `[cat file — 120 lines]` |
| bash: grep/rg | `[grep "pattern" — 23 matches]` |
| bash: other >2KB | `[bash: <command> — 4.2KB output, exit 0]` |

### What's always kept

- Recent turns (last K user turns — default K9)
- Small results (<500 chars)
- Error results
- Edit/write confirmations

## Measured savings

Benchmarked across 23 real sessions (468 measurement slices, 20K+ messages):

| Config | Avg chars saved per LLM call | Avg % of context |
|--------|------------------------------|------------------|
| K10 | 324 KB | 47.8% |
| K9 (default) | ~340 KB | ~50% |
| K5 | 356 KB | 57.9% |
| K3 | 369 KB | 62.1% |

K5 and K10 converge in long sessions (both ~60%). The difference matters only
in the 5-15 turn window where context pressure is lowest.

## Commands

| Command | Effect |
|---------|--------|
| `/prune-stats` | Show savings for this session (to conversation) |
| `/prune-keep` | Show current K level (ephemeral) |
| `/prune-keep 5` | Set to K5 for this session (ephemeral) |
| `/prune-config` | Show all config values (ephemeral) |

## Status bar

Auto-updates on every LLM call: `🪓 47.6KB K9`

## Architecture

```
pruning.ts        — pure logic, zero pi imports, fully tested
context-pruner.ts — thin runner: context event + commands
```

28 tests (21 unit + 7 property tests with fast-check).

## Install

Symlink or copy to `~/.pi/agent/extensions/context-pruner/`.

```bash
ln -s /path/to/pi-kit/extensions/context-pruner ~/.pi/agent/extensions/context-pruner
```
