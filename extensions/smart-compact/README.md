# smart-compact

A pi extension that replaces pi's built-in compaction with a structured,
verifiable alternative.

## Why?

Pi's default compaction is already excellent — 100% file tracking coverage and
detailed freeform summaries. smart-compact is a **safety net**, not a
replacement you'd notice day-to-day.

The one measurable gap: pi's default drops ~72% of critical errors (timeouts,
rate limits, crashes). In very long sessions with multiple compactions, the
agent loses awareness of infrastructure issues that may recur. smart-compact
catches these and patches them back in.

| What it does | Why |
|-------------|-----|
| Verifies critical errors are mentioned | Safety net for long sessions |
| Consistent heading structure | Stable scaffolding for iterative re-compaction |
| `reasoningEffort: "low"` | Slightly cheaper per compaction call |

## How it works

Three-phase pipeline using generator-effects architecture:

1. **Extract** (pure, no LLM) — deterministic fact extraction from messages:
   files modified/read, errors, decisions, constraints, goal
2. **Synthesize** (single LLM call) — structured prompt with extracted facts +
   serialized conversation → consistent summary format
3. **Verify + Patch** (pure, no LLM) — checks the summary mentions all modified
   files and critical errors; patches in anything missing

The generator yields effect descriptions; the thin runner in `smart-compact.ts`
interprets them with real pi APIs. This makes the pipeline fully testable without
mocking pi internals.

## Benchmark results

Against 104 real compaction slices (84K messages across 36 sessions):

```
  File mention coverage:  100.0% (same as pi default)
  Critical error coverage: 100% vs pi's 28%
  Transient errors filtered: 25 patterns (edit retries, ENOENT, test output, etc.)
```

## Commands

- `/compact-stats` — shows extraction results for the current session in a TUI panel

## Files

| File | Role |
|------|------|
| `smart-compact.ts` | Extension entry point (thin runner) |
| `pipeline.ts` | Generator-effects pipeline |
| `extraction.ts` | Phase 1: deterministic fact extraction |
| `verification.ts` | Phase 3: verify + patch + error classification |
| `prompts.ts` | Phase 2: synthesis prompt builder |
| `bench.ts` | Offline benchmark against real sessions |
| `*.test.ts` | 42 tests (property + example + script-runner) |

## Install

```bash
pi install git:github.com/leo-ar/pi-kit extensions/smart-compact
```

Or symlink for development:
```bash
ln -s /path/to/pi-kit/extensions/smart-compact ~/.pi/agent/extensions/smart-compact
```
