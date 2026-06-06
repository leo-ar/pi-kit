---
description: Perform a scoped code audit with hypotheses and evidence
argument-hint: "<area-or-risk> [constraints]"
---

Audit this code for: `$1`. Constraints/focus: `${@:2}`.

Repository-adaptive setup:

- Load local guidance if present: `AGENTS.md`, `.pi/SYSTEM.md`, `README.md`, `CONTRIBUTING.md`, architecture docs, package/test config.
- Follow local conventions and threat models over generic assumptions.

Scope discipline:

- Keep the audit focused on `$1`; do not turn it into a whole-repo review unless evidence requires it.
- Start with aggregate discovery (`rg`, `git grep`, route/file lists, dependency/config inspection) before targeted reads.
- Maintain a clear distinction between verified facts, hypotheses, and unsupported assumptions.
- For proprietary/private data, use aggregate metrics only unless I explicitly approve details.

Audit workflow:

1. Restate the audit question and success criteria.
2. Map relevant entry points, data flow, and trust boundaries.
3. Form hypotheses about likely failure modes.
4. Test hypotheses with targeted code reads/searches.
5. Inspect tests and existing safeguards.
6. Produce findings with confidence and evidence.

Output format:

```md
## Audit question

## Scope

## Verified facts

- ...

## Hypotheses tested

- [x] ... — result
- [ ] ... — unresolved

## Findings

### High

- Finding: ...
  - Evidence: file/path/context
  - Impact: ...
  - Suggested fix: ...
  - Confidence: high/medium/low

### Medium

- ...

### Low / hardening

- ...

## Tests / validation gaps

## Open questions

## Recommended next actions
```

If no issues are found, state what was checked, why confidence is limited or high, and what would increase confidence.
