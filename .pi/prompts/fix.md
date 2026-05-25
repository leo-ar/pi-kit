---
description: Fix Mode Session Initialization
---

We are commencing an isolation and correction cycle in **Fix Mode**. Our
absolute priority is to eradicate a bug surgically without creating
"whack-a-mole" side effects or breaking existing invariants.

# Current Project Context

1. Update `notes/TODO.md` to set **Active Mode: Fix**.
2. Please inspect `CLAUDE.md` to review the layout and testing
   strategies.

# The Issue Profile

- **Symptom / Error Log / Bug Report:** <Paste the error logs, stack traces, or
  behavioral bug descriptions here>
- **Suspected Component (if known):** <Paste component path or class name>

# Your Immediate Task (Isolation & Reproduction Test)

You are strictly forbidden from modifying any application or production code
right now. Your immediate objective is to prove you understand the root cause by
designing a reproduction mechanism. Provide a response with:

1. **Root Cause Analysis:** Diagnose why the current implementation allowed this
   failure mode to happen (e.g., state corruption, boundary condition slip).
2. **Failing Reproduction Test Proposal:** Propose a targeted test case that
   _guarantees a failure_ on the current broken code.
   - If the bug stems from corrupted internal or shared state, propose an _internal property test_ reaching into the components via escape hatches.
   - If it is a clean, single logic boundary failure, propose an _error/example test_.

**CRITICAL:** Output only the analysis and the reproduction test code. Run the
test runner if executing locally to confirm the test fails. **Stop and wait for
my approval.** Do not attempt to fix the application code until the human
confirms the reproduction test is accurate and successfully failing.
