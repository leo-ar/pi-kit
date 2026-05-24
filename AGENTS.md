# AGENTS.md — repo layout and conventions

This repo contains pi extensions and skills.

## Top-level layout

```
extensions/   pi extensions — each registers one or more slash commands
skills/       pi skills — each teaches an agent a reusable task
```

## Extensions (`extensions/<name>/`)

A pi extension is a TypeScript package that adds commands or behaviour to pi.

| File / dir    | Purpose                                              |
|---------------|------------------------------------------------------|
| `package.json`| Extension manifest and entry point                   |
| `*.ts`        | Source files                                         |
| `README.md`   | Human-facing docs                                    |
| `AGENTS.md`   | Agent context for working on **this extension**      |

`AGENTS.md` at the extension root describes the extension's internals — read it
when modifying that extension.

## Skills (`skills/<name>/`)

A pi skill is a Markdown instruction set that teaches an agent how to perform a
task. Skills are invoked by an agent, not installed as packages.

| File / dir    | Purpose                                              |
|---------------|------------------------------------------------------|
| `SKILL.md`    | The skill itself — instructions the agent follows    |
| `templates/`  | Files to be copied into the user's project           |
| `README.md`   | Human-facing docs (optional)                         |

`templates/AGENTS.md` (when present) is **not** an agent guide for this repo —
it is a template to be scaffolded into the user's project by the skill.

## Key distinction

> An `AGENTS.md` at `extensions/<name>/AGENTS.md` → read it when working on that extension.
>
> An `AGENTS.md` at `skills/<name>/templates/AGENTS.md` → do not read it here;
> it belongs to the investigation or project the skill creates.
