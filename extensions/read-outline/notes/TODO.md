# TODO

**Active Mode:** Feature

## Doing

- [ ] Add language support: PHP, CSS, HTML (brace/tag-based, same pattern as existing generators)

## Done

- [x] Benchmark usefulness against existing pi sessions — **86.5% reduction** on eligible reads (712 KB saved across 56 files, median 325 lines)
- [x] feat/refactor-testable — Extract monolith into testable modules + add test suite
  1. [x] Set up test infrastructure (package.json: tsx, fast-check, node --test script)
  2. [x] Extract `src/types.ts` (OutlineEntry, ReadInput, TextContent, Lang, constants)
  3. [x] Extract `src/block-end.ts` (4 functions)
  4. [x] Extract `src/utils.ts` (extractText, isSupportedFile, detectLanguage, padRight)
  5. [x] Extract `src/format.ts` (formatOutlineResult, extractHeader, isHeaderLine)
  6. [x] Extract `src/languages/*.ts` (8 generators)
  7. [x] Extract `src/outline.ts` (dispatcher)
  8. [x] Rewrite `src/index.ts` as thin entry point
  9. [x] Write tests: block-end (examples + properties)
  10. [x] Write tests: outline generators (examples + constraints + properties)
  11. [x] Write tests: format (examples + properties)
  12. [x] Run full suite, fix any regressions

## Backlog

### Planned

- [ ] Add language support: PHP, CSS, HTML, Emacs Lisp, Org-mode — **high impact**: funnel bottleneck is "supported ext" (only 11% of reads); more languages = more savings
- [ ] Analyze tree-sitter upgrade path — consider reusing Emacs tree-sitter grammars to reduce redundancy
- [ ] Benchmark usefulness against existing pi sessions (read-only — never modify sessions) — ✅ done, re-run after adding languages

### Surfaced

- [ ] Decide on permanent load indicator strategy (status widget vs. silent, dev-only vs. always)
