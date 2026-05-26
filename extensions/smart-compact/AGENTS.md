# AGENTS.md — smart-compact extension

> For workflow, testing strategy, and conventions see the repo-level
> [AGENTS.md](../../AGENTS.md).

## Files

```
smart-compact.ts       Entry point — thin runner interpreting pipeline effects
pipeline.ts            Generator-effects pipeline (extract → synthesize → verify)
extraction.ts          Phase 1: deterministic fact extraction from messages
prompts.ts             Phase 2: synthesis prompt builder
verification.ts        Phase 3: verify + patch + error classification
extraction.test.ts     Tests for extraction (example + property)
pipeline.test.ts       Tests for pipeline (script-runner pattern)
verification.test.ts   Tests for verification + error classification
bench.ts               Offline benchmark against real sessions
```

## Key types

- `PipelineInput` — `{ messages, previousSummary, fileOps, isSplitTurn, turnPrefixMessages }`
- `PipelineEffect` — union: `ExtractEffect | SynthesizeEffect | VerifyEffect | DoneEffect`
- `ExtractionResult` — `{ filesModified, filesRead, errors, decisions, constraints, goal }`
- `VerificationResult` — `{ missingFiles, missingErrors, patchedSummary }`
- `isTransientError(msg)` — 25-pattern classifier filtering noise from real errors

## Pipeline flow

```
generator yields:
  Extract → runner provides messages → extraction result
  Synthesize → runner calls LLM (reasoningEffort: "low") → summary string
  Verify → runner provides summary → verification result
  Done → runner returns { compaction: { summary, ... } }
```

## Error classification

25 transient patterns filtered (edit retries, ENOENT during search, test output,
rate limits on non-critical APIs, etc.). Only "critical" errors get verified in
the summary. See `verification.ts` → `TRANSIENT_PATTERNS`.

## Design decisions

- Generator-effects over DI — pure generator is fully testable with script-runner
- `patchSummary` only patches errors, not files — file tags unconditionally appended
- `reasoningEffort: "low"` — cheaper compaction, quality is sufficient
- `maxConversationChars` cap — prevents sending >200K to the LLM

## Testing

```bash
# All tests (42)
node --test --experimental-strip-types 'extensions/smart-compact/*.test.ts'

# Benchmark (read-only, no API calls)
node --experimental-strip-types extensions/smart-compact/bench.ts
```
