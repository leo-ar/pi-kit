---
description: Run a hypothesis-driven investigation with verified conclusions
argument-hint: "<question> [data/source constraints]"
---

Investigate: `$1`. Constraints/data sources: `${@:2}`.

Use a scientific, evidence-driven workflow. If this investigation needs a
durable workspace, suggest or use the `analysis-workflow-init` skill before
going deep.

Repository/project adaptation:

- Load local guidance if present: `AGENTS.md`, `.pi/SYSTEM.md`, `README.md`,
  data dictionaries, runbooks, dashboards/docs referenced by the project.
- For proprietary/private data, default to aggregate metrics only; do not echo
  sensitive rows, file bodies, or long snippets unless I explicitly approve.

Investigation rules:

- Separate verified facts from hypotheses and unsupported claims.
- Prefer aggregate queries/commands first, then targeted inspection.
- Track uncertainty explicitly.
- Avoid premature conclusions.
- If the session becomes long, suggest `/compact` at a phase boundary.

Workflow:

1. Restate the question and define what would count as an answer.
2. Inventory available evidence sources and constraints.
3. Create initial hypotheses.
4. Test hypotheses one at a time.
5. Record verified facts, unsupported facts, and open questions.
6. Summarize conclusions with confidence and next actions.

Output format:

```md
## Question

## Constraints / privacy mode

## Evidence sources

## Hypotheses

- H1: ...
- H2: ...

## Verified facts

- ...

## Unsupported / rejected claims

- ...

## Analysis

## Conclusion

Confidence: high/medium/low

## Open questions

## Next steps
```

If a workspace is created, keep `hypotheses.md`, `verified-facts.md`,
`unsupported-facts.md`, `open-questions.md`, `notes.md`, and `TODO.md` current.
