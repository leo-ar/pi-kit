# context-pruner

Reduces context token usage by replacing stale tool results with lightweight
stubs before each LLM call.

## Why?

Between compactions, tool results accumulate in context. The LLM re-reads all of
them every turn, even though most are stale. In real sessions, **76% of context
is tool results** and **77% of those are old**.

## How it works

Hooks pi's `context` event (fires before every LLM call). Replaces old tool
results with one-line stubs. The session is never modified — only the in-flight
context copy is altered.

**Pruned** (old messages only — recent K turns always kept):

| Category | Stub example |
|----------|--------------|
| Read (superseded) | `[read src/foo.ts — 245 lines (file was later modified)]` |
| Read (old) | `[read src/foo.ts — 245 lines]` |
| bash: ls/find/tree | `[ls src/ — 47 entries]` |
| bash: grep/rg | `[grep "pattern" — 23 matches]` |
| bash: other >2KB | `[bash: <command> — 4.2KB output, exit 0]` |

**Always kept**: recent K turns, small results (<500 chars), errors,
edit/write confirmations.

## Measured savings

Benchmarked across 23 real sessions (468 slices, 20K+ messages):

| Config | Avg chars saved per LLM call | Avg % of context |
|--------|------------------------------|------------------|
| K10 | 324 KB | 47.8% |
| K9 (default) | ~340 KB | ~50% |
| K5 | 356 KB | 57.9% |

K5 and K10 converge in long sessions (~60%). The difference only matters in
short sessions where context pressure is already low.

## Commands

| Command | Effect |
|---------|--------|
| `/prune-stats` | Show savings for this session |
| `/prune-keep` | Show current K level |
| `/prune-keep 5` | Set to K5 for this session |
| `/prune-config` | Show all config values |

Status bar auto-updates: `🪓 340KB K9`

## Install

```bash
pi install git:github.com/leo-ar/pi-kit extensions/context-pruner
```

Or symlink for development:
```bash
ln -s /path/to/pi-kit/extensions/context-pruner ~/.pi/agent/extensions/context-pruner
```
