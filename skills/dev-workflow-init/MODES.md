# Branch Modes

| Mode            | Branch pattern            | Loop?             | Tests required?                                                           | Commits?         | Merge to dev?                                 |
| --------------- | ------------------------- | ----------------- | ------------------------------------------------------------------------- | ---------------- | --------------------------------------------- |
| **Feature**     | `feat/<name>`             | Full outer+inner  | **High Ceremony:** Approved Property Specs + Examples (High CI Samples)   | Yes, atomic      | `--no-ff`                                     |
| **Fix**         | `fix/<issue>`             | Targeted Fix Loop | **Targeted Rigor:** Failing Reproduction Test First (Property or Example) | Yes, atomic      | `--no-ff`                                     |
| **Experiment**  | `experiment/<hypothesis>` | No                | **Optional:** Low-sample properties to test architectural hunches         | Yes (for replay) | Never — observe then discard or promote       |
| **Exploration** | `explore/<topic>`         | No                | **Banned:** No automated test ceremony allowed                            | Optional         | Never directly — promote to `feat/` or `fix/` |

---

## Feature

Structured delivery of new capabilities. The outer loop guarantees design →
tests → implementation → docs → retro → merge.

- **Testing Guardrail:** Requires the "LLM Proposes → Human Approves" property
  testing workflow up front before application code is written. Runs are
  validated against full CI sample counts (e.g., 1000 runs).
- **When to use:** You clear-headedly know what you're building and the code is
  destined for production.
- **Result:** Production-ready code on `dev`.

## Fix

Targeted eradication of bugs and regressions. The objective is to isolate a flaw
and surgically correct it without triggering "whack-a-mole" side effects in
shared or global state.

- **Testing Guardrail:** The LLM is strictly forbidden from modifying
  application code until it writes a verified, failing reproduction test. For
  internal state corruption or cache leaks, this must be an internal property
  test using language escape hatches (TS casting, PHP Reflection). For basic
  logic boundaries, a standard example test suffices.
- **When to use:** Correcting unexpected behavior, crashes, or failed
  constraints in existing code.
- **Exit:** The reproduction test and the existing suite pass completely. Merge
  to `dev` via `--no-ff`.

## Experiment

Testing a specific architectural hypothesis. You are looking to observe the
real-world consequences of an implementation choice.

- **Testing Guardrail:** Automated testing is optional. If property tests are
  used to check structural bounds, they must be configured with low local sample
  sizes (e.g., 20 runs) to preserve speed.
- **When to use:** You want an answer to a deliberate question (e.g., "Does
  extracting this state machine into a private array create refactoring
  brittleness?").
- **Exit:** Write down your observations into `notes/`, add any necessary tasks
  to `notes/TODO.md > Surfaced`, then delete or archive the branch.

## Exploration

Pure information gathering and rapid sketching. Zero ceremony.

- **Testing Guardrail:** Property and example testing are completely banned.
  Writing tests here introduces friction that destroys the velocity of
  prototyping.
- **When to use:** You don't know what to build yet, or you are interacting with
  an unfamiliar API or library primitive.
- **Exit:** Discard the branch entirely, or distill your findings into a clean
  backlog item and open a disciplined `feat/` or `fix/` branch.

---

## Branch Lifecycle

```

dev ────────────────────────────────────────────────────────── dev
\                                                           /
feat/foo ──── property-spec ─── commit ─── commit ─── merge

dev ────────────────────────────────────────────────────────── dev
\                                                           /
fix/bug-123 ── failing-test ─── commit ─── commit ─── merge

dev ────────────────────────────────────────────────────────── dev


explore/bar ─── (discard or promote to feat/ or fix/)

dev ────────────────────────────────────────────────────────── dev


experiment/baz ─── low-sample-prop ─── commit ─── (observe, discard)

```
