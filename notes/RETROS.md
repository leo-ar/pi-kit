# Retrospectives

## 2026-05-24 — smart-compact refactor (Feature)

**Branch:** `smart-compact`
**Duration:** Single session

### What went well

- Generator-effects pattern worked exactly as designed — pipeline is fully testable
  without mocking pi internals. Script-runner tests step through cleanly.
- Property tests (fast-check) caught two real bugs during development:
  1. `patchSummary` idempotence failure — appending errors without checking if
     already present.
  2. `verify` false-negative on paths ending with `/` — empty basename matches
     everything via `"".includes("")` → `true`.
- Regex fix (non-greedy + while loop) was validated by the "finds multiple
  constraints" example test immediately.
- Separating pure modules made the code significantly easier to reason about.
  Each file is <100 lines and has a single responsibility.

### What could improve

- The arbitrary generators for property tests required manual construction of
  message shapes. A shared `test-fixtures.ts` with common arbitraries would
  reduce duplication if more test files are added.
- Did not integrate with pi's existing `preparation.fileOps` — would avoid
  re-extracting file operations but requires importing pi's `FileOperations`
  type and adapting the pipeline input.
- `compact-stats` command is still using `ui.notify` which truncates long output.

### Lessons / patterns to carry forward

- **Generator pipeline + script-runner = excellent testability/I/O separation
  ratio.** Minimal boilerplate, maximum coverage. The runner (smart-compact.ts)
  is ~50 lines of switch/case with no logic to test.
- **Property tests surface edge cases humans miss.** The empty-basename bug
  would never appear in hand-written example tests.
- **Non-greedy regex + sentence boundaries** are essential when extracting
  multiple matches from natural language text. Greedy `.+` or `.{n,}` will
  always swallow too much.
