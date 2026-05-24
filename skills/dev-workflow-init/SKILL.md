---
name: dev-workflow-init
description: Scaffold the llm-workflow system into the current project. Creates CLAUDE.md, notes/TODO.md, notes/RETROS.md, and .pi/prompts/ templates. Auto-discovers project context from package.json, composer.json, README, and directory structure to fill in template slots.
---

# Workflow Init

Scaffold the llm-workflow structured development system into the current project.

## What Gets Created

| File                        | Purpose                                                       |
| --------------------------- | ------------------------------------------------------------- |
| `CLAUDE.md`                 | Persistent prompt — project definition + workflow constraints |
| `notes/TODO.md`             | Live backlog with active mode selection                       |
| `notes/RETROS.md`           | Retrospective log template                                    |
| `.pi/prompts/feature.md`    | Feature mode session initialization                           |
| `.pi/prompts/fix.md`        | Fix mode session initialization                               |
| `.pi/prompts/experiment.md` | Experiment mode session initialization                        |

## Workflow

### Phase 1: Auto-Discover Project Context

Gather as much as possible without asking the user:

```bash
# Detect language and tooling
cat package.json 2>/dev/null
cat composer.json 2>/dev/null
cat pyproject.toml 2>/dev/null

# Detect test runner
grep -E '"test"' package.json 2>/dev/null
ls phpunit.xml phpunit.xml.dist 2>/dev/null

# Detect formatter
ls .prettierrc .prettierrc.* prettier.config.* .php-cs-fixer.* .editorconfig 2>/dev/null

# Detect project description
cat README.md 2>/dev/null | head -20

# Detect directory structure
find . -maxdepth 2 -type d \
  -not -path '*/node_modules/*' \
  -not -path '*/.git/*' \
  -not -path '*/vendor/*' \
  -not -path '*/.pi/*' | sort
```

**Extract these values:**

| Value               | Source                                                                    | Fallback      |
| ------------------- | ------------------------------------------------------------------------- | ------------- |
| Project description | README.md first paragraph, or `description` in package.json/composer.json | Ask user      |
| Language            | package.json → TS/JS; composer.json → PHP                                 | Ask user      |
| Test runner command | `scripts.test` in package.json; phpunit.xml presence → `phpunit`          | Ask user      |
| Formatter command   | prettier config → `prettier --write`; php-cs-fixer → `php-cs-fixer fix`   | "none"        |
| Repository layout   | Directory scan                                                            | Auto-generate |

### Phase 2: Ask Only What's Missing

If any of these cannot be inferred, ask the user:

1. **Project description** — "One-sentence description of what this project does?"
2. **Primary language** — "Primary language? (e.g., TypeScript, PHP, Python)"
3. **Test runner** — "How do you run tests? (e.g., `npm test`, `phpunit`)"

Do NOT ask about things you successfully discovered.
Do NOT ask about formatter if none is detected (just omit it from Conventions).

### Phase 3: Handle Existing Files

Before writing any file, check if it already exists:

- **If `CLAUDE.md` exists:** Ask the user:
  - "Keep existing" — skip writing CLAUDE.md entirely
  - "Overwrite" — replace with the new template
  - "Create copy" — write to `CLAUDE.new.1.md` (if that exists, increment: `CLAUDE.new.2.md`, etc.)

- **If `notes/TODO.md` or `notes/RETROS.md` exist:** Same three options, but ask
  once for all notes files together.

- **If `.pi/prompts/` files exist:** Same three options, asked once for the
  whole prompts directory.

### Phase 4: Scaffold Files

Use the templates from [templates/](templates/) as the base.
Fill in the `<fill:>` placeholders:

**In `CLAUDE.md`:**

Replace `<fill: one paragraph — what this repo does, who consumes it>` with
the discovered/provided project description.

Replace the repository layout code block with the auto-discovered directory
structure (one line per directory, no file listings).

Replace `<fill: language details (TS vs PHP), module system, formatter, test runner commands (npm test, phpunit)>` with a filled Conventions section like:

```markdown
- **Language:** TypeScript (ESM)
- **Test runner:** `npm test` (vitest + fast-check)
- **Formatter:** `prettier --write .`
- **Linter:** `eslint .`
```

Adapt based on what was discovered.
Only include lines for tools that actually exist in the project.

**In `.pi/prompts/feature.md`:** No modifications needed — keep as-is.

**In `.pi/prompts/fix.md`:** No modifications needed — keep as-is.

**In `.pi/prompts/experiment.md`:** No modifications needed — keep as-is.

**In `notes/TODO.md`:** No modifications needed — keep as-is.

**In `notes/RETROS.md`:** No modifications needed — keep as-is.

### Phase 5: Confirm

After writing all files, output a summary:

```
✓ Scaffolded llm-workflow into <project-name>:
  - CLAUDE.md (filled: description, layout, conventions)
  - notes/TODO.md
  - notes/RETROS.md
  - .pi/prompts/feature.md
  - .pi/prompts/fix.md
  - .pi/prompts/experiment.md

Next steps:
  1. Review CLAUDE.md — verify the auto-filled sections
  2. Set your active mode in notes/TODO.md
  3. Use /feature, /fix, or /experiment to start a session
```
