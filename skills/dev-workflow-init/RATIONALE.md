# Rationale

Why this system works, and what each piece contributes.

## The Core Insight

LLM-assisted development fails in predictable ways:

1. **Drift:** The LLM loses context across turns, forgets constraints, and
   repeats mistakes.
2. **Overreach:** The LLM does too much at once, making changes hard to review
   and easy to regress.
3. **Amnesia:** Lessons from previous features or bugs are lost over time.

This system addresses each failure mode with a specific artifact:

| Failure       | Artifact          | Mechanism                                                   |
| ------------- | ----------------- | ----------------------------------------------------------- |
| **Drift**     | `CLAUDE.md`       | Persistent prompt that survives context window limits.      |
| **Overreach** | Inner Loop        | Forces incremental progress (tests first, commit per step). |
| **Amnesia**   | `notes/RETROS.md` | A continuous log populated after every outer loop.          |

---

## Why Each Piece Exists

### CLAUDE.md

The LLM reads this at the start of every session. It contains project
definitions, core workflows, and high-level constraints.

`CLAUDE.md` is a high-bar asset. It does not ingest raw, unvetted rules after
every single task. Instead, it changes only when a human deliberately reviews
the retro logs, extracts a verified behavioral pattern, and carefully updates
the guidelines. This keeps the prompt highly concentrated and free of bloat.

### TODO.md

Two purposes:

1. **Steers the session:** The LLM reads the "Doing" section to know what is
   currently in progress without needing the full, token-heavy conversation
   history.
2. **Captures scope creep:** "Surfaced" items track architectural discoveries
   mid-work that would derail focus if acted on immediately.

It does NOT track history; `git log` handles that. Stale "Done" items are
aggressively removed to maintain a lean context.

### RETROS

Continuous logs populated at the end of every outer loop.
They function as a raw stream of project memory.

The individual entry isn't where the magic happens. The value is unlocked when
the human periodically pauses to read multiple retros together to extract
patterns. These patterns are then routed to their proper enforcement engine:
workflow rules go into `CLAUDE.md`, while architectural and code-level
regressions are codified into permanent **Property Tests**.

### Branch Modes

Naming the explicit mode at the start of work sets proper constraints so the LLM
doesn't default to over-ceremonious waste or chaotic hacking:

- **Feature:** Maximum ceremony. Output ships to production. Requires the "LLM
  Proposes → Human Approves" property test workflow up front, validated against
  full CI sample counts (e.g., 1000 runs).
- **Fix:** Targeted rigor. The objective is to isolate a bug and prevent
  regression without causing "whack-a-mole" side effects. The LLM must first
  propose a reproducing test case (a property test for internal state corruption
  or a specific example test for logic boundaries). Production code cannot be
  touched until the human approves a verified, failing reproduction test.
- **Experiment:** Minimal ceremony, but commits are required to replay what
  happened. Local-only property testing with low sample sizes (e.g., 20 runs) is
  used to verify quick structural hunches.
- **Exploration:** Zero ceremony. Property testing is banned. The overhead of
  defining mathematical invariants exceeds the value of a quick prototype.

### Property Tests

Property tests serve a fundamentally different role in LLM workflows than in
human-only workflows:

- **For humans:** A regression safety net.
- **For LLMs:** An **unbreakable constraint on the implementation space**.

An LLM can easily bypass an example test by writing a hardcoded lookup table or
a brittle patch. A property test enforces a machine-checkable mathematical
invariant—whether checking a public API or reaching into hidden internal shared
state via language escape hatches (TS casting, PHP Reflection)—that cannot be
faked or satisfied by accident.

Every execution of the local test runner (`npm test`, `phpunit`) instantly
validates that the LLM's code generation remains within safe bounds.

---

## What This System Does NOT Do

- **It doesn't plan projects:** Planning is the human's job. The system
  structures execution.
- **It doesn't replace code review:** The human still reads diffs and approves
  merges.
- **It doesn't guarantee quality:** It reduces the probability of specific AI
  failure modes. Quality still depends on the human's taste, architecture
  choices, and judgment.
- **It doesn't scale to teams:** This is hyper-optimized for a single
  developer + LLM pair.

---

## Evolution

The human is the controller, the retro log is the sensor, and `CLAUDE.md`
combined with the Property Test suite are the actuators. If a rule creates
friction without preventing bugs, remove it. If a code regression slips through,
write a property test to ensure it can never happen again.
