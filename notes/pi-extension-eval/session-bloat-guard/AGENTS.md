# AGENTS.md — session-bloat-guard validation workspace

> This workspace is for evidence-backed validation of `session-bloat-guard`.
> It extends the broader `notes/pi-extension-eval/` investigation and uses
> recorded Pi session archives as read-only source data.

## Methodology

### Primary objective

The goal of this validation is to determine whether `session-bloat-guard`
meaningfully reduces the conditions that lead to excessive token-cached reads.
The extension is successful only if it helps catch sessions early enough that a
large reduction in repeated rehydration is plausible.

### Session-state rule

Only `session_start` with `reason: "new"` resets the score to zero. Reload,
resume, and fork should restore the historical score from session data.
Compaction may lower the score if the recalculated active segment is smaller.

### Phase 1 — Observe

- Collect raw signals from session archives.
- Record only facts and measurements in `notes.md`.
- Do not infer value yet.

### Phase 2 — Hypothesize

- Write competing hypotheses in `hypotheses.md`.
- Every hypothesis must have a falsification test.

### Phase 3 — Test

- Sample sessions across projects and session shapes.
- Measure reads, edits, writes, compactions, warnings, and session length.
- Compare v1 behavior to the rubric in `rubric.md`.

### Phase 4 — Compare

- Compare observed outcomes to plausible counterfactuals.
- Separate early-warning value from false-positive risk.

### Phase 5 — Verify

- Move only supported claims into `verified-facts.md`.
- Keep unsupported claims in `unsupported-facts.md`.

### Phase 6 — Synthesize

- Answer the core questions with evidence, caveats, and confidence levels.

### Phase 7 — Report

- Keep `README.md` as the final executive summary.

## Rules

1. No conclusions in Phase 1.
2. Always test both sides of a claim.
3. Never move a claim into `verified-facts.md` without direct evidence.
4. Prefer session-level aggregates over anecdotes.
5. If a claim depends on interpretation, label it as such.
