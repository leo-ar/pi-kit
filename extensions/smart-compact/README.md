# smart-compact

A safety net for pi's built-in compaction — catches critical errors that the
default summary drops.

## Why?

Pi's default compaction is already excellent — 100% file tracking and detailed
summaries. The one measurable gap: it drops ~72% of critical errors (timeouts,
rate limits, crashes). In long sessions with multiple compactions, the agent
loses awareness of infrastructure issues that may recur.

## How it works

Three-phase pipeline using generator-effects architecture:

1. **Extract** (pure, no LLM) — files modified/read, errors, decisions,
   constraints, goal
2. **Synthesize** (single LLM call) — structured prompt → consistent summary
3. **Verify + Patch** (pure, no LLM) — checks all files and critical errors
   are mentioned; patches in anything missing

The generator yields effect descriptions; the thin runner interprets them with
real pi APIs. Fully testable without mocking.

## Measured results

Against 104 real compaction slices (84K messages, 36 sessions):

| Metric | smart-compact | pi default |
|--------|---------------|------------|
| File mention coverage | 100% | 100% |
| Critical error coverage | 100% | 28% |
| Transient errors filtered | 25 patterns | — |

## Commands

| Command | Effect |
|---------|--------|
| `/compact-stats` | Show extraction results in a TUI panel |

## Install

```bash
pi install git:github.com/leo-ar/pi-kit extensions/smart-compact
```

Or symlink for development:
```bash
ln -s /path/to/pi-kit/extensions/smart-compact ~/.pi/agent/extensions/smart-compact
```
