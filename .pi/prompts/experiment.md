---
description: Experiment Mode Session Initialization
---

We are commencing a hypothesis-driven prototyping cycle in **Experiment Mode**.
The goal is to observe the real-world consequences of a specific architectural
choice — not to ship production code.

# Current Project Context

1. Update `notes/TODO.md` to set **Active Mode: Experiment**.
2. Please inspect `CLAUDE.md` to review the layout and conventions.

# The Hypothesis

- **Question:** <Paste your specific architectural question here>
- **Expected Outcome:** <What you expect to observe if the hypothesis holds>
- **Scope Boundary:** <What is explicitly out of scope for this experiment>

# Your Immediate Task

You are NOT following the full outer/inner loop. There is no property spec
checkpoint and no human approval gate before coding. However, these constraints
are non-negotiable:

1. **Commits are required.** Every meaningful step must be committed for
   replayability. Use descriptive messages that reference the hypothesis.
2. **Tests are optional.** If you write property tests to validate structural
   bounds, configure them with low local sample sizes (e.g., 20 runs). Do not
   invest in high-ceremony test suites.
3. **Never merge to `main`.** This branch will be observed, then discarded or
   promoted to a proper `feat/` or `fix/` branch.

Begin by outlining your implementation approach in 3–5 bullet points, then
start coding. When the experiment is complete, write your observations into
`notes/` and surface any follow-up tasks to `notes/TODO.md > Backlog > Surfaced`.
