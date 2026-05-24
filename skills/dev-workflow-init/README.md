# LLM-Guided Development Workflow

A template system for structured LLM-assisted development.
Extracted from real usage on (May 2026).

## What's in this repo

| File              | Purpose                                            |
| ----------------- | -------------------------------------------------- |
| `CLAUDE.md`       | Project CLAUDE.md skeleton — the persistent prompt |
| `notes/TODO.md`   | Live backlog structure                             |
| `notes/RETROS.md` | Feature retrospective fields                       |
| `MODES.md`        | Branch modes reference                             |
| `RATIONALE.md`    | Why this system works, what each piece does        |

## Quick start

1. Copy `CLAUDE.md`, `notes/`, and `.pi/prompts/` into your repo.
2. Fill in the `<fill:>` slots in `CLAUDE.md`
3. Start working

> **Note:** `MODES.md` and `RATIONALE.md` are reference documentation for this
> template repo. They don't need to be copied into your project.

## Key principles

- **Git is the history** — no Done sections, no changelogs in TODO
- **Modes select structure** — feature branches get full ceremony, exploration gets none
- **Property tests constrain the LLM** — they're executable specifications, not just regression tests
- **Retros find patterns** — patterns become workflow rules in CLAUDE.md
- **TODO.md steers the session** — the LLM reads it to know what's in progress and what's next
