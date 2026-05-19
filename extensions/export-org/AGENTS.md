# export-org — agent context

This extension registers a `/export-org` command that writes the current pi session branch to an Org-mode file.

## Files

- `export-org.ts` — entry point, registers the `/export-org` command
- `md2org.ts` — Markdown → Org-mode converter, mirrors `gptel-md2org.el` pass-for-pass
- `md2org-test.ts` — test suite mirroring `gptel-md2org-test.el`; run with `node
--experimental-strip-types md2org-test.ts`

## What the command does

1. Reads the current session branch via `ctx.sessionManager.getBranch()`
2. Walks entries in order: user messages, assistant messages, tool calls and
   their results
3. Converts all Markdown to Org syntax via `md2org.ts`
4. Writes a `.org` file to the session's working directory

## Org output structure

- File-level `:PROPERTIES:` drawer — session file path, cwd, token totals
- `* You [timestamp]` — user turn headings
- `* Assistant [timestamp]` — assistant turn headings with `:PROPERTIES:` drawer
  (model, provider, thinking level)
- `#+begin_src bash` / `#+begin_example` — bash commands and their output
- `#+begin_src <lang>` — file reads/writes, language inferred from file extension
- `#+begin_src diff` — edit diffs
- Model/provider drawer only emitted on first assistant turn and when either changes

## md2org conversion passes (in order)

1. Fenced code blocks → `#+begin_src lang … #+end_src`
2. Inline code → `=code=`
3. Links `[T](U)` → `[[U][T]]`
4. Bold `**t**` → `*t*`
5. Italics `*t*` / `_t_` → `/t/`
6. Setext headings → `* heading` / `** heading`
7. ATX headings `### …` → `*** …`
8. Lists `* item` → `- item`, `[x]` → `[X]`
9. Table separator rows `|---|---|` → `|---+---|`

Protected regions (code blocks, inline code) are tracked by offset range and
skipped by later passes.

## Conventions

- Keep `md2org-test.ts` passing before committing changes to `md2org.ts`
- `prepareArguments` / schema changes: update `package.json` version accordingly
