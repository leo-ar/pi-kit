---
description: Feature Mode Session Initialization
---

We are commencing a structured development cycle in **Feature Mode**.
Before any application code is touched, we must strictly adhere to
the project's Outer Loop blueprint.

# Current Project Context

1. I am initializing a new feature branch from `main`.
2. Please inspect the current `CLAUDE.md` and `notes/TODO.md` files to
   align with repository conventions, layout, and active tasks.

# Feature Requirements

<Paste your feature requirements, user stories, or API design requirements here>

# Your Immediate Task (Outer Loop: Step 1 - Think)

Do NOT write application code or full test implementations yet.
Execute Step 1 of the Outer Loop by providing a response with the
following sections:

1. **Design & Contract Clarifications:** Settle return shapes, error
   conditions, and edge-case behaviors up front. Identify
   any non-obvious architectural choices.
2. **Property Test Specification Proposal:** Propose 3 to 5 universal invariants
   (property tests) tailored to our stack (fast-check + node:test).
   - If this involves mutable or shared state, propose direct _internal state
     property tests_ using language escape hatches (TS casting).
   - Ensure each property is named as a universal law (e.g., `"for all valid
inputs, X holds"`).

**CRITICAL:** Stop after outputting this proposal. Do not proceed to
Step 2 (Planning) or write code until I have explicitly reviewed and approved
your property specifications.
