---
description: Draft or create a pull request from the current branch
argument-hint: "[base-branch] [style-or-focus]"
---

Prepare a pull request for the current branch against base branch `$1`. If `$1` is omitted, infer the likely base branch (`main`, `master`, or the tracked upstream). Style/focus: `${@:2}`.

Repository-adaptive setup:

- Load local guidance if present: `AGENTS.md`, `.pi/SYSTEM.md`, `README.md`, `CONTRIBUTING.md`, existing PR template, package/test config.
- Follow this repo's conventions over this prompt when they conflict.

Safety:

- Do not push, open a browser, or create the PR until I explicitly confirm.
- If using `gh pr create`, show the exact title/body first.
- Never invent tests; distinguish tests run from tests not run.

Workflow:

1. Inspect branch state with aggregate commands: `git status`, current branch, base branch, commits ahead, `git diff --stat`, changed file list.
2. Infer the PR intent from commits/diff and any user-provided focus.
3. Check whether there is an existing PR template or conventional format.
4. Identify tests/checks that were run in this session if available; otherwise suggest appropriate checks.
5. Draft a concise PR title and body.

Output format:

```md
## Proposed PR title

<title>

## Proposed PR body

### Summary

- ...

### Changes

- ...

### Testing

- [x] ...
- [ ] Not run: ...

### Risks / rollout notes

- ...

## Suggested command

    gh pr create --base <base> --head <branch> --title '<title>' --body-file <file>
```

```

Ask for confirmation before creating or updating the PR.
```
