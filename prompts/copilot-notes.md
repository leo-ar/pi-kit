---
description: Triage and respond to GitHub Copilot PR review notes
argument-hint: "[PR-url-or-notes]"
---

Triage GitHub Copilot review notes for the current repository/PR. Input: `$@`.

Repository-adaptive setup:

- Load local guidance if present: `AGENTS.md`, `.pi/SYSTEM.md`, `README.md`, `CONTRIBUTING.md`, PR template, test config.
- If `$@` includes pasted notes, use them as the source of truth.
- If `$@` includes a PR URL or asks you to inspect the PR, use `gh` if available; otherwise ask me to paste the notes.

Safety:

- Do not dismiss Copilot comments blindly.
- Do not apply edits until you have classified the notes and proposed a plan.
- Do not post GitHub replies or push changes without confirmation.

Workflow:

1. Collect Copilot notes/comments.
2. Group duplicates and related comments.
3. For each note, inspect only the relevant diff/context.
4. Classify each note:
   - valid bug/risk
   - valid maintainability/style issue
   - needs investigation
   - false positive / not applicable
   - already addressed
5. Propose fixes or response text.
6. If I approve fixes, apply them incrementally and run targeted checks.

Output format:

```md
## Copilot notes triage

| #   | Classification | File/context | Recommendation |
| --- | -------------- | ------------ | -------------- |
| 1   | valid bug      | ...          | fix ...        |

## Proposed fixes

1. ...

## Proposed responses

- Note 1: ...

## Checks to run

- ...

## Needs my decision

- ...
```

Prefer targeted reads and diff inspection over broad file loading.
