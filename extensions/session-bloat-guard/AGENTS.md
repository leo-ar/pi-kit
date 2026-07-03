# AGENTS.md — session-bloat-guard extension

> For general extension workflow, testing strategy, and conventions see the
> repo-level [`../AGENTS.md`](../AGENTS.md).

## Purpose

`session-bloat-guard` warns when a Pi session is growing expensive in practice.
It does not auto-compact or split sessions; it only surfaces a transparent
score and concise advisory nudges.

## Files

```text
index.ts     Entry point — session-local counters, scoring, status, command
README.md    User-facing overview and install instructions
proposal.md  Design/specification
tasks.md     Implementation checklist
```

## Initial implementation shape

- Keep all state session-local and ephemeral.
- Use a simple weighted heuristic for v1.
- Update status text only when severity changes.
- Provide a `/session-bloat` command for inspection.

## Testing intent

When the extension is fleshed out, prioritize tests for:

- severity transitions
- warning de-duplication
- reset behavior on new sessions
- counter accumulation from tool events
