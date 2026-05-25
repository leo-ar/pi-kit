# TODO

**Active Mode:** Feature

## Doing

- Refactor `smart-compact` extension — apply generator-effects architecture, add property tests, fix bugs

## Backlog

### Planned

- [ ] Use `preparation.fileOps` instead of re-extracting file operations
- [ ] Fix double `<modified-files>` append (correctness bug)
- [ ] Fix regex exec loop (only captures first match per message)
- [ ] Cap serialized conversation length to prevent context overflow on synthesis call
- [ ] Refactor pipeline to generator-effects pattern (enables testing without mocks)
- [ ] Add property tests for extraction and verification invariants
- [ ] Add `reasoningEffort: "low"` to synthesis call
- [ ] Separate into modules: extraction.ts, verification.ts, prompts.ts, pipeline.ts

### Surfaced
