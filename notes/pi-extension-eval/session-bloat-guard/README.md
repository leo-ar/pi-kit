# session-bloat-guard validation

Short index for the `session-bloat-guard` validation workspace.

Primary question: does the extension help reduce excessive token-cached reads
by catching the sessions that create repeated rehydration and context churn?

Note: only `session_start` with `reason: "new"` resets the score. Reload,
resume, and fork should restore the historical score from session data.

## Inputs

- recorded session archives in `~/.pi/agent/sessions/`
- read-only session index at `~/.pi/agent/sessions/session-index.sqlite`
- rubric in [`rubric.md`](./rubric.md)

## Outputs

- observations in `notes.md`
- hypotheses in `hypotheses.md`
- verified claims in `verified-facts.md`
- unsupported claims in `unsupported-facts.md`
- open issues in `open-questions.md`
- work items in `TODO.md`

## Scripts

Use the local scripts in `scripts/` to summarize or score sessions.

## Current takeaway

The current archive timeline pass suggests that v1 is enough as a trend signal:
healthy and moderate sessions stay green, while high-cacheRead sessions move to
watch/warn/strong early enough to support an intervention.
