# Feature & Fix Retrospective Template

Append new entries below. Most recent last.

---

## Refactor to Testable Modules

2026-05-26 — branch: `read-outline`

### Summary

Extracted 651-line monolith `index.ts` into 12 modular source files under `src/`. Added 73 tests (examples, constraints, property-based) using `node:test` + `fast-check`. All 5 proposed invariants validated.

### What worked well

- Property tests caught the Python block-end edge case immediately (trailing blank lines are included in blocks)
- Modular extraction was straightforward — clean functional boundaries already existed in the monolith
- `node --test` with tsx is fast (~280ms for 73 tests) and zero-config

### What caused issues

- Two example test expectations were wrong (Python block-end semantics for blank lines) — root cause: I assumed blank lines between blocks are excluded, but the algorithm includes them since it only stops at the next non-blank dedented line
- `isHeaderLine` matched `require('fs')` which I initially thought it wouldn't — had to read the implementation more carefully

### What could be done differently

- Run the implementation on test inputs before writing expected values (use the actual function, then encode the result)
- Consider property tests earlier in the pipeline to catch semantic misunderstandings sooner
