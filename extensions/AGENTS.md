# AGENTS.md — extension development workflow

> This file defines how to work on extensions in this repo. Each extension's
> own `AGENTS.md` describes its internals (files, types, design decisions).

## Development Workflow

Select the active mode in `notes/TODO.md` before starting work.

- **Feature** (`feat/<name>`) — Structured work. Follow full outer/inner loops. High ceremony property testing.
- **Fix** (`fix/<issue>`) — Targeted bug isolation. Requires writing a verified, failing reproduction test before modifying application code.
- **Experiment** (`experiment/<hypothesis>`) — Prototyping architectural hunches. Commits required for replayability; low-sample property testing optional. Never merge to `main` — observe then discard or promote.
- **Exploration** (`explore/<topic>`) — Open sketching. No loops, no test ceremony allowed. Think freely. Never merge to `main` — promote to `feat/` or `fix/` instead.

### Outer Loop — Feature & Fix Cycle

1. **Think** — Resolve architectural design and contract structures before touching code.
   - _The Property Spec Checkpoint:_ Propose 3–5 universal invariants (property test behaviors) to the human. **Stop and wait for human approval** before proceeding.
   - _Fix mode:_ Replace this checkpoint with a Reproduction Test Proposal — a single failing test that proves the bug exists. Same approval gate applies.
2. **Plan** — Break the approved design into discrete inner-loop steps. Record them in `notes/TODO.md` under **Doing**.
3. **Branch** — Create the branch from `main`: `git checkout -b <feat/or fix>/<name>`.
4. **Execute** — Run the inner loop once per step.
5. **Review** — Run the full test suite at max sample size. Check `notes/TODO.md` for surfaced items.
6. **Documentation Pass** — Ensure all documentation aligns with the new changes. Update `notes/TODO.md` and commit separately from code.
7. **Retro** — Append a summary note to `notes/RETROS.md`.
8. **Merge** — Execute via `git checkout main && git merge --no-ff <branch-name>`.

### Inner Loop — Execution Cycle

1. **Write Tests First** — Implement approved examples, errors, and property tests before writing application code.
   - _Local Speed Guardrail:_ Configure your property tests to run a **low sample count (e.g., 20 runs)** locally to maintain inner-loop velocity.
   - _State Guardrail:_ For internal shared state or cache boundaries, use language escape hatches (TS `as any` casting) to test state invariants directly.
2. **Implement** to make the tests pass.
3. **Run Tests** before and after every single change.
4. **Commit** after each coherent step with a descriptive message.
5. **Rename safely** — Always use `git mv <old> <new>` to preserve file history. Never copy-and-delete.
6. **Stay Focused** — Route out-of-scope discoveries straight to `notes/TODO.md > Backlog > Surfaced`. Do not pursue them now.

## Testing Strategy

### Layer Structure

Every core component should be backed by three logical test blocks/files:

- **Examples** (`*.examples.test.ts`) — Illustrative, 1:1 input-to-output behavioral maps.
- **Constraints** (`*.constraints.test.ts`) — Validating strict constraint boundaries, type violations, and matching exceptions.
- **Properties** (`*.properties.test.ts`) — Generative suites (fast-check) validating invariants that must hold true across all randomized data.

### When to Write Property Tests

1. **Shared Structures:** Multiple code paths return or mutate the exact same structural data contract.
2. **Alternative Paths:** Optimizations (e.g., a fast, direct index query vs. a thorough DFS tree search) must yield identical outcomes.
3. **Internal State Invariants:** Enforcing cleanup rules on mutable states (caches, stacks, buffers) without generating messy public API mock journeys.
4. **Input/Output Transformations:** Algebraic transformations on pure functions where symmetry applies (`unserialize(serialize(x)) === x`).

_Negative Rule:_ If a function represents a basic 1:1 mapping ("X always maps to Y"), use a standard example test. Do not manufacture complex generators for trivial guarantees.

## Conventions

- **Language:** TypeScript (ESM, `"type": "module"`)
- **Test runner:** `node --test` with `tsx` for TS support, `fast-check` for property tests
- **Peer dependency:** `@earendil-works/pi-coding-agent` (and `@earendil-works/pi-ai` where needed)
- **License:** LGPL-3.0-or-later
- **Formatting:** Prettier for markdown
- **Architecture pattern:** Generators as effect systems — pure generator logic yields effect descriptions, thin imperative runners perform real I/O
