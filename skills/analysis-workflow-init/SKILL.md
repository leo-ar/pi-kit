---
name: analysis-workflow-init
description: Scaffold a scientific investigation workspace into a directory. Creates AGENTS.md (7-phase methodology), hypotheses.md, verified-facts.md, unsupported-facts.md, open-questions.md, notes.md, TODO.md, and README.md stub. Use when starting a structured data investigation — traffic analysis, anomaly detection, root cause analysis, or any inquiry requiring hypothesis testing and verified conclusions.
---

# Investigation Init

Scaffold a scientific investigation workspace for structured, hypothesis-driven
data analysis.

## What Gets Created

| File | Purpose |
|---|---|
| `AGENTS.md` | Methodology rules — 7 phases, verification checklist, session protocol |
| `hypotheses.md` | Questions, competing hypotheses, confirmation/falsification tests, results |
| `verified-facts.md` | Immutable source of truth for confirmed findings |
| `unsupported-facts.md` | Claims lacking verified-facts backing — awaiting confirmation |
| `open-questions.md` | Inconclusive items and what would resolve them |
| `notes.md` | Phase 1 scratchpad (not a deliverable) |
| `TODO.md` | Open investigation threads |
| `README.md` | Executive summary stub (written last) |

## Workflow

### Phase 1: Ask the User

Ask two questions:

1. **Topic** — "What are you investigating? (one sentence)"
2. **Data source** — "What is the data source? (e.g., Snowflake table, Postgres DB,
   CSV files, API logs)"
3. **Directory** — "Where should the investigation workspace live?
   (e.g., `tmp/my-investigation/` — I'll create it)"

If the user is already in a clearly named directory or has given enough context,
infer topic and directory from context and skip asking.

### Phase 2: Scaffold the Directory

Create the directory if it doesn't exist. Copy all templates from
[templates/](templates/) into it.

After copying `AGENTS.md`, replace the data-source placeholder references:
- The generic template refers to "the data source" and "your query tool" — these
  are already abstract enough. No substitution required unless the user named a
  specific tool; in that case, add a one-line note at the top of `AGENTS.md`:
  ```
  > **Data source for this investigation:** <tool> — <what the user described>
  ```

Update `README.md` stubs:
- `<fill: topic>` → user's topic
- `<fill: what system/table/file was queried>` → user's data source
- `<fill: date range>` → "TBD" (leave for the investigator)

### Phase 3: Handle Existing Files

If the target directory already exists and contains any of the above files,
ask the user:
- **Keep existing** — skip that file
- **Overwrite** — replace with template
- **Create copy** — write to `<name>.new.1.md` (increment if needed)

Ask once for all conflicting files together, not file-by-file.

### Phase 4: Confirm and Orient

Output a summary and the first instruction:

```
✓ Investigation workspace scaffolded at <directory>/:
  - AGENTS.md      (7-phase scientific methodology)
  - hypotheses.md  (empty — ready for Phase 2: Question)
  - verified-facts.md
  - unsupported-facts.md
  - open-questions.md
  - notes.md       (Phase 1 scratchpad)
  - TODO.md
  - README.md      (stub — fill in last)

Next step: Start with Phase 1 — Observe.
  Read AGENTS.md, then profile your data source before forming any hypotheses.
  Record raw observations in notes.md only.
```

## Key Rules to Communicate to the User

When scaffolding is done, briefly remind the user of the three rules that matter most:

1. **No conclusions in Phase 1** — observations only, no interpretation yet
2. **Always test both sides** — every hypothesis needs a falsification test, not just confirmation
3. **verified-facts.md is immutable without data access** — never write to it from memory or context alone
