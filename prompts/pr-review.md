---
description: Review the current branch or PR with structured findings
argument-hint: "[base-branch] [focus]"
---

Review the current branch/PR against base branch `$1`. If `$1` is omitted, infer the likely base branch (`main`, `master`, or the tracked upstream). Focus: `${@:2}`.

Treat this as a repository-adaptive workflow: first load local guidance if present (`AGENTS.md`, `.pi/SYSTEM.md`, `README.md`, `CONTRIBUTING.md`, package/test config). Do not assume conventions from other repos.

Use cost/context hygiene:

- Start with aggregate commands before broad reads: `git status`, branch/base detection, `git diff --stat`, `git diff --name-only`, recent commits.
- Use targeted reads only after identifying relevant files.
- Do not edit files unless I explicitly ask.
- If the review becomes long, suggest `/compact` at a phase boundary.

Review process:

1. Identify base branch, current branch, commit range, changed files, and high-level intent.
2. Inspect the diff in manageable chunks.
3. Read only files needed to understand risky logic or context.
4. Check tests/config relevant to changed areas.
5. Report findings with evidence and severity.

Output format:

```md
## Summary

## Changed areas

## Findings

### High

- [issue] — file/path/context, why it matters, suggested fix

### Medium

- ...

### Low / nits

- ...

## Test coverage

- What appears covered
- Gaps / suggested checks

## Questions / assumptions

## Suggested follow-ups
```

If there are no substantive issues, say so clearly and still note test coverage/gaps.
