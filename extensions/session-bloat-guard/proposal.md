# session-bloat-guard proposal

## Summary

`session-bloat-guard` is a lightweight Pi extension that watches the current
session for signs of bloat and nudges the user when the session is likely to
benefit from a manual `/compact`, a fresh split, or a narrower task boundary.

The extension is intentionally advisory, not punitive. It should make growth
visible early enough that the user can intervene before the session becomes
expensive, noisy, or hard to reason about.

## Problem statement

Long Pi sessions often stay productive while accumulating hidden cost:

- repeated full-file reads of the same targets
- many edit/write cycles on the same area
- multiple sub-tasks living in one conversational thread
- multiple compactions in a single session
- rereads immediately after compaction because the thread is still broad

By the time the user feels the session is getting unwieldy, the expensive part
has already happened. The extension should surface that trend earlier and in a
way that is easy to act on.

## Goals

1. Detect session growth using simple, transparent heuristics.
2. Show the current bloat level in the UI without interrupting workflow.
3. Warn only when the signal is strong enough to be useful.
4. Encourage one of three actions:
   - compact the session
   - start a fresh session for the next subtask
   - narrow the scope of the current task
5. Keep state local to the current session and avoid persistent storage.

## Non-goals

- It will not replace `read-outline`, `context-pruner`, or `smart-compact`.
- It will not automatically compact, split, or modify the session unless the user
  explicitly invokes an action.
- It will not try to estimate token usage precisely.
- It will not introduce a complex ML-based classifier.

## Signals to track

The guard should maintain a small live score for the current session based on
observable activity.

### Core counters

- total `read` calls
- total `edit` calls
- total `write` calls
- compaction count
- message count / turn count

### Reserved refinements for later phases

- full-file reads
- repeated reads of the same file
- rereads after compaction
- number of distinct files touched
- ratio of reads to edits/writes
- consecutive turns without a clear task boundary
- repeated access to the same file group

The v1 implementation should keep the shape ready for these signals without
requiring them to drive the first scoring pass.

## Heuristic model

Version 1 should use transparent threshold tiers, with room to evolve toward a
weighted score later if needed.

### Example scoring direction

- each `read`: +1 toward the overall growth picture
- each `edit` or `write`: +1 toward the overall growth picture
- each compaction: stronger signal than ordinary reads/writes
- repeated rereads: higher-priority signal once the data is available

The exact weights are not final. The important property is that the model should
be obvious enough that the user can understand why a warning appeared.

### Scoring philosophy

- keep the first pass easy to inspect
- prefer simple thresholds over opaque formulas
- reserve room for richer signals in later phases

### Suggested severity levels

- **Normal**: score below warning threshold
- **Watch**: session is growing faster than usual
- **Warn**: session is likely to benefit from compaction or a split
- **Strong warn**: session is clearly bloated and should be split soon

### Suggested triggers

These are starting points for tuning:

- **Watch**
  - 50+ reads, or
  - 20+ edits/writes, or
  - same file read 3+ times, or
  - 1 compaction

- **Warn**
  - 100+ reads, or
  - 50+ edits/writes, or
  - 2+ compactions, or
  - repeated rereads of the same files after compaction

- **Strong warn**
  - 3+ compactions, plus
  - high reread churn and a large edit/read ratio

## User experience

The extension should be low-friction and persistent enough to be noticed.

### UI surfaces

- a single colored status indicator that changes color with severity
- a short inline notice when severity increases
- optional tooltip/help text explaining the current score
- full counters shown only through the `/session-bloat` command

### Example messages

- `Session bloat: 🟡`
- `Session bloat: 🟠`
- `Session bloat: 🔴`
- `Session bloat: 🟢 reads 0, edits 1, writes 0, compactions 0`

### UX rules

- Do not repeat the same warning on every turn.
- Escalate only when the severity changes or a new threshold is crossed.
- Prefer a calm status indicator over modal interruptions.
- Provide enough detail to explain the warning, but not a full audit trail.

## Commands / actions

The extension may expose a small command set for inspection and control.

### Proposed commands

- `/session-bloat` — show a single-line summary of the current counters and severity
- `/session-bloat reset` — clear session-local counters
- `/session-bloat tune` — show or edit threshold values for the current session

### Optional actions

- copy a compact summary for the next session
- jump to a suggested split point in the session history
- toggle warnings on/off for the current session

## Implementation sketch

### Event hooks

- `session_start` — initialize counters and reset any session-local warning state; also handle resumed sessions because Pi emits this event with `reason: "resume"`
- `tool_call` — count reads, edits, writes, and other observable growth signals
- `tool_result` — inspect results for repeated access patterns if needed later
- `session_before_compact` — increment compaction counters and update severity
- `context` — optionally summarize stale activity into a lightweight view later

Because Pi re-emits `session_start` after `/resume`, the guard should recalculate and refresh its UI there so the status is correct immediately after session restoration, without any extra resume-specific notice.

### State model

The extension should keep only session-local state, such as:

- counters
- reserved slots for future per-file access counts
- last severity level emitted
- last warning reason

### Update policy

- Recompute severity whenever relevant activity occurs.
- Emit UI updates only when the displayed state changes.
- Preserve a concise explanation of why the current score changed.
- Treat repeated-read tracking as a future enrichment, not a v1 dependency.

## Acceptance criteria

A first implementation is acceptable when it can:

1. Track the core counters for the current session.
2. Compute a stable severity level from the counters.
3. Display the severity in the status bar or a widget.
4. Emit a concise warning when a threshold is crossed.
5. Avoid spamming the user with repeated messages.
6. Reset cleanly at the start of a new session.

## Risks and trade-offs

- Too many warnings will cause users to ignore the extension.
- A simplistic heuristic may miss some bloated sessions or overreact to normal
  deep work.
- Counting tool calls is easy; inferring distinct subtasks is less reliable.
- If the extension tries to be too smart, it may become opaque and hard to tune.

## Validating whether v1 is enough

The right question for v1 is not whether it is perfect, but whether it is
useful on real recorded sessions.

### Evaluation set

Use a small corpus of recorded Pi sessions that covers:

- short, focused sessions that stayed healthy
- long but still productive sessions
- obviously bloated sessions with many rereads or compactions
- sessions that should have been split into separate subtasks
- sessions with noisy shell output or repeated file access

### What to measure

Replay or inspect the recorded sessions and compare the v1 score against human
judgment and obvious session outcomes.

Useful checks include:

- did the warning appear before the session became painful?
- did it stay quiet for focused sessions?
- did it escalate at a moment the user would reasonably compact or split?
- how often did it warn too early, too late, or not at all?
- did the explanation match the observed session behavior?

### Success criteria for v1

v1 is enough if most clearly bloated sessions are flagged early, while focused
sessions remain mostly quiet. In practice, that means:

- low false positives on short or focused sessions
- reasonable lead time before a manual `/compact` or session split
- warning text that matches the session’s actual shape
- no need for additional signals in the common case

### If v1 is not enough

Add only the smallest extra signals that improve the recorded-session results.
Priority should go to signals that are easy to observe and explain:

1. full-file vs partial reads
2. repeated reads of the same file
3. rereads after compaction
4. per-file hot spots or file-group churn
5. context usage when available as a live estimate

The goal is to improve the score only where the recorded sessions show a clear
miss, not to turn the guard into a complex classifier.

## Recommended v1 scope

Start with just three things:

1. count reads, edits, writes, and compactions
2. compute a transparent severity score
3. surface the score in a single colored status indicator, with a single-line `/session-bloat` summary for the full counters

If v1 proves useful, later versions can add:

- per-file hot-spot reporting
- a `/session-bloat` inspection command
- suggested split points
- session-specific tuning

## Ecosystem comparison

### Short review addendum

Several existing packages overlap with parts of this idea, but none covers the
full proposal.

### `pi-context-tree`

Closest overall match. It surfaces context growth early with a persistent
context-health UI, trend awareness, and a one-time nudge when the context gets
full. This is a strong reference for the status/widget experience.

**Difference:** it appears to track context fill percentage rather than a
transparent behavioral score based on reads, edits, writes, and compactions.

### `pi-observability`

Useful adjacent package for dashboard/status conventions and context-usage
warnings.

**Difference:** it is generic observability, not session bloat detection.

### `pi-dcp`

Relevant for repeated tool-call and stale-output handling. It addresses the same
underlying cost drivers as this proposal.

**Difference:** it reduces bloat after the fact instead of warning about a
session becoming bloated.

### `@hypabolic/pi-hypa`

Relevant for noisy shell output and context compression.

**Difference:** it is another mitigation layer, not a session-level guardrail.

## Why this still matters

The ecosystem already has reactive pruning, context-size indicators, and some
automatic compaction helpers. What it does not appear to have is a transparent,
weighted session-level score with severity levels and an explicit suggestion to
compact or split the session.

That missing combination is the distinctive value of `session-bloat-guard`.

## Recommendation

This is worth prototyping. The core problem is real, the data is observable, and
the first version can stay small. The best outcome is not perfect prediction; it
is giving the user a clear signal at the moment a session is starting to become
more expensive than it needs to be.
