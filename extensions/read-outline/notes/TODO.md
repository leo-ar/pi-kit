# TODO

**Active Mode:** Feature

## Doing

- [ ] feat/refactor-testable — Extract monolith into testable modules + add test suite
  1. [x] Set up test infrastructure (package.json: tsx, fast-check, node --test script)
  2. [ ] Extract `src/types.ts` (OutlineEntry, ReadInput, TextContent, Lang, constants)
  3. [ ] Extract `src/block-end.ts` (4 functions)
  4. [ ] Extract `src/utils.ts` (extractText, isSupportedFile, detectLanguage, padRight)
  5. [ ] Extract `src/format.ts` (formatOutlineResult, extractHeader, isHeaderLine)
  6. [ ] Extract `src/languages/*.ts` (8 generators)
  7. [ ] Extract `src/outline.ts` (dispatcher)
  8. [ ] Rewrite `src/index.ts` as thin entry point
  9. [ ] Write tests: block-end (examples + properties)
  10. [ ] Write tests: outline generators (examples + constraints + properties)
  11. [ ] Write tests: format (examples + properties)
  12. [ ] Run full suite, fix any regressions

## Backlog

### Planned

### Surfaced
