# TODO

**Active Mode:** Feature

## Doing

_(nothing — Phase 1 complete)_

## Done

- [x] Phase 1: Implement Elisp + PHP via tree-sitter
  - [x] Add web-tree-sitter@0.24.7 dep + bundle grammars (elisp 52KB, php 794KB)
  - [x] Lazy parser singleton (src/tree-sitter/init.ts)
  - [x] Elisp generator (10 tests): defun, defmacro, defvar, defcustom, defconst, defgroup, defface, define-*-mode
  - [x] PHP generator rewritten with tree-sitter (regex fallback); 5 edge-case tests proving correctness
  - [x] All 129 tests passing
  - [x] generateOutline() now async throughout
  - [x] Benchmark validated: PHP error rate 17% → 0%, total savings 875KB → 1118KB (+28%)

- [x] Add PHP, CSS, HTML support — +23% savings (875 KB total), PHP at 94% reduction
- [x] Benchmark usefulness against existing pi sessions — **86.5% → 87.8% reduction** (875 KB saved across 69 files)
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

- [ ] Phase 2: Migrate TypeScript/JavaScript to tree-sitter (deferred — 1% error rate, 2.3MB grammar; re-evaluate after Phase 1)
- [ ] Add language support: Org-mode — deferred (no prebuilt WASM, needs build step)
- [ ] Analyze tree-sitter upgrade path — ✅ done, see notes/tree-sitter-analysis.md
- [ ] Re-run benchmark after Phase 1

### Surfaced

- [ ] Decide on permanent load indicator strategy (status widget vs. silent, dev-only vs. always)
