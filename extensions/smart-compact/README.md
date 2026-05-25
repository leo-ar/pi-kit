# smart-compact

A pi extension that replaces pi's built-in compaction with a structured,
verifiable alternative.

## Why?

Pi's default compaction is already excellent at file tracking (100% coverage in
our benchmarks). Where it falls short is **critical error retention** — it drops
~72% of timeouts, rate limits, and unrecoverable failures. In long sessions with
multiple compactions, this means the agent loses awareness of infrastructure
issues that may still be relevant.

smart-compact addresses three gaps:

| Gap | What smart-compact does |
|-----|------------------------|
| Critical errors dropped | Deterministic verification catches missing errors and patches them back in |
| Inconsistent format | Enforces fixed headings (Goal, Progress, Decisions, etc.) so iterative re-compaction stays stable |
| Cost | Uses `reasoningEffort: "low"` + conversation cap — cheaper per compaction call |

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
