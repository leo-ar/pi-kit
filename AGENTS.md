# AGENTS.md — repo layout and conventions

> Begin every session by reading this file and `notes/TODO.md` to determine the
> active mode and current task.

## Project Overview

Personal collection of pi extensions and skills. Extensions register slash
commands or event handlers that customize the pi coding agent. Skills are
markdown instruction sets that teach agents reusable tasks. Consumed by the
developer (Leo) via `pi install` or project-local `.pi/` placement.

## Local runtime context

`pi-rtk-optimizer` is installed globally through `~/.pi/agent/settings.json`. It
rewrites bash commands via `rtk rewrite` and compacts noisy bash/tool output
(test/build/git/lint/search). Source `read` compaction is disabled, so RTK does
not compete with `read-outline`; file reads remain exact unless `read-outline`
itself replaces a large full-file read with an outline.

Use `/rtk stats` to inspect RTK savings.

## Top-level layout

```
extensions/          pi extensions — each registers commands or behaviour
skills/              pi skills — markdown instruction sets
prompts/             pi prompt templates — reusable slash-command prompts
notes/               working notes, TODO, retros, analysis docs
.pi/                 project-local pi config (SYSTEM.md, prompts)
```

## Extensions (`extensions/<name>/`)

A pi extension is a TypeScript package that adds commands or behaviour to pi.

| File / dir     | Purpose                                         |
| -------------- | ----------------------------------------------- |
| `package.json` | Extension manifest and entry point              |
| `*.ts`         | Source files                                    |
| `README.md`    | Human-facing docs                               |
| `AGENTS.md`    | Agent context for working on **this extension** |

`AGENTS.md` at the extension root describes the extension's internals — read it
when modifying that extension. For workflow, testing strategy, and conventions
see [`extensions/AGENTS.md`](extensions/AGENTS.md).

## Prompt templates (`prompts/*.md`)

Prompt templates are Markdown files invoked as slash commands by filename, e.g.
`prompts/pr-review.md` becomes `/pr-review`. Use frontmatter for `description`
and `argument-hint`; keep templates repo-adaptive rather than encoding
project-specific facts.

## Skills (`skills/<name>/`)

A pi skill is a Markdown instruction set that teaches an agent how to perform a
task. Skills are invoked by an agent, not installed as packages.

| File / dir   | Purpose                                           |
| ------------ | ------------------------------------------------- |
| `SKILL.md`   | The skill itself — instructions the agent follows |
| `templates/` | Files to be copied into the user's project        |
| `README.md`  | Human-facing docs (optional)                      |

`templates/AGENTS.md` (when present) is **not** an agent guide for this repo —
it is a template to be scaffolded into the user's project by the skill.

## Key distinction

> An `AGENTS.md` at `extensions/<name>/AGENTS.md` → read it when working on that
> extension.
>
> An `AGENTS.md` at `skills/<name>/templates/AGENTS.md` → do not read it here;
> it belongs to the investigation or project the skill creates.
