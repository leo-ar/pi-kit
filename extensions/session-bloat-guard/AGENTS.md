# AGENTS.md — session-bloat-guard extension

> For general extension workflow, testing strategy, and conventions see the
> repo-level [`../AGENTS.md`](../AGENTS.md).

## Purpose

`session-bloat-guard` warns when a Pi session is growing expensive in practice.
It does not auto-compact or split sessions; it only surfaces a transparent
score and concise advisory nudges.
The score should survive reload/resume and only reset for a genuinely new
session.

## Files

```text
index.ts     Entry point — session scoring, session-data restore, status, command
core.ts      Pure scoring/state logic
core.test.ts  Unit tests for scoring and state helpers
core.properties.test.ts  Property tests for scoring invariants
README.md    User-facing overview and install instructions
proposal.md  Design/specification
tasks.md     Implementation checklist
```

## Initial implementation shape

- Keep the live state in memory during the session and persist snapshots in session data for restore.
- Use a simple weighted heuristic for v1.
- Restore the score from session history on reload/resume/fork.
- Update status text only when severity changes.
- Provide a `/session-bloat` command for inspection.

## Testing intent

When the extension is fleshed out, prioritize tests for:

- severity transitions
- warning de-duplication
- reset behavior on new sessions
- counter accumulation from tool events
