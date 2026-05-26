# AGENTS.md — export-org extension

> For workflow, testing strategy, and conventions see the repo-level
> [AGENTS.md](../AGENTS.md).

## Files

```
export-org.ts    Entry point — registers /export-org command
md2org.ts        Markdown → Org-mode converter (mirrors gptel-md2org.el)
md2org-test.ts   Test suite (mirrors gptel-md2org-test.el)
```

## Key types

- Session entries from `ctx.sessionManager.getBranch()` — user, assistant,
  tool_call, tool_result entries
- `TokenAccumulator` — tracks input/output/cache tokens across turns
- md2org operates on raw strings, no special types

## Export flow

1. `ctx.sessionManager.getBranch()` → array of session entries
2. Walk entries in order: user → assistant → tool calls/results
3. Convert all Markdown content via `md2org()`
4. Write `.org` file to cwd (or specified path)

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

## Org output structure

- File-level `:PROPERTIES:` drawer — session path, cwd, token totals
- `* You [timestamp]` — user turn headings
- `* Assistant [timestamp]` — with `:PROPERTIES:` (model, provider, thinking)
- Model/provider drawer only emitted on first turn and when either changes

## Design decisions

- Mirrors `gptel-md2org.el` pass-for-pass — keeps parity with Emacs-native export
- Protected regions prevent passes from clobbering code block contents
- Token accumulation is session-wide, stored at file level

## Testing

```bash
node --test --experimental-strip-types extensions/export-org/md2org-test.ts
```

## Conventions

- Keep `md2org-test.ts` passing before committing changes to `md2org.ts`
- `prepareArguments` / schema changes: update `package.json` version
