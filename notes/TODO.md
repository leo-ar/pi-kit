# TODO

**Active Mode:** Feature

## Doing

1. [x] Extract pure modules: `extraction.ts`, `verification.ts`, `prompts.ts`
2. [x] Fix bugs during extraction (regex loop, double modified-files)
3. [x] Write property tests for extraction (`extraction.properties.test.ts`)
4. [x] Write property tests for verification (`verification.properties.test.ts`)
5. [x] Add `package.json` at repo root with test script + fast-check dep
6. [x] Refactor to generator pipeline (`pipeline.ts` + effect types)
7. [x] Write pipeline script-runner tests (`pipeline.test.ts`)
8. [x] Rewire `smart-compact.ts` as thin runner + apply optimizations (conversation cap, reasoningEffort)

## Backlog

### Planned

### Surfaced

- [ ] Use `preparation.fileOps` from pi instead of re-extracting (needs testing against real pi types)
- [ ] Handle `preparation.isSplitTurn` / `turnPrefixMessages` more explicitly
- [ ] Upgrade `compact-stats` command to `ctx.ui.custom()` for richer display
