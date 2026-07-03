# AGENTS.md — pi extension evaluation

> This workspace is for a structured, evidence-backed evaluation of the current pi
> extension stack and a counterfactual assessment of `pi-hashline-edit-pro`.
>
> Data source for this investigation: `~/.pi/agent/sessions/` JSONL archives and
> `~/.pi/agent/sessions/session-index.sqlite`.

## Methodology

### Phase 1 — Observe

- Collect raw signals from session archives.
- Record only facts and measurements in `notes.md`.
- Do not infer value yet.

### Phase 2 — Hypothesize

- Write competing hypotheses in `hypotheses.md`.
- Every hypothesis must have a falsification test.

### Phase 3 — Test

- Sample sessions across projects and session sizes.
- Measure tool usage, repeated reads, compaction events, and edit churn.
- For `pi-hashline-edit-pro`, focus on sessions with repeated lines, stale edits,
  or multi-step file modification loops.

### Phase 4 — Compare

- Compare observed outcomes to plausible counterfactuals.
- Separate accuracy gains from token-efficiency gains.

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
