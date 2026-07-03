# session-bloat-guard proposal

## Summary

`session-bloat-guard` is a lightweight Pi extension that watches the current
session for signs of bloat and nudges the user when the session is likely to
benefit from a manual `/compact`, a fresh split, or a narrower task boundary.

Its real purpose is to help reduce excessive token-cached reads — ideally by a
large margin, on the order of 5x or more in the sessions it successfully
intervenes in. The extension is a means to that end, not the end itself.

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

1. Reduce excessive token-cached reads by catching the sessions that drive them.
2. Detect session growth using simple, transparent heuristics.
3. Show the current bloat level in the UI without interrupting workflow.
4. Warn only when the signal is strong enough to be useful.
5. Encourage one of three actions:
   - compact the session
   - start a fresh session for the next subtask
   - narrow the scope of the current task
6. Keep state local to the current session and avoid persistent storage.

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
weighted score later if needed. The live score should be derived from session
history and persisted in session data so reloads and resumes restore the same
logical session state instead of resetting it.

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
  - 2+ compactions

- **Warn**
  - 100+ reads, or
  - 50+ edits/writes, or
  - 3+ compactions, or
  - repeated rereads of the same files after compaction

- **Strong warn**
  - 3+ compactions
  - high reread churn and a large edit/read ratio once that signal is available

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

If validation later suggests the need for more control, `reset` and `tune`
variants can be added as follow-up commands.

### Optional actions

- copy a compact summary for the next session
- jump to a suggested split point in the session history
- toggle warnings on/off for the current session

## Implementation sketch

### Event hooks

- `session_start` — restore the current score from session history; only `reason: "new"` starts from zero
- `tool_call` — count reads, edits, writes, and other observable growth signals
- `tool_result` — inspect results for repeated access patterns if needed later
- `session_before_compact` — observe imminent compaction without assuming the score changes yet
- `session_compact` — recalculate the current score after compaction, which may lower severity
- `context` — optionally summarize stale activity into a lightweight view later

Because Pi re-emits `session_start` after `/resume`, the guard should restore the persisted historical state there so the status continues from the same logical session instead of dropping back to green.

### State model

The extension should keep only session-local state, such as:

- counters for the active segment and current session history
- reserved slots for future per-file access counts
- last severity level emitted
- last warning reason
- persisted snapshots in session data so reloads can restore the same score

### Update policy

- Recompute severity whenever relevant activity occurs.
- Emit UI updates only when the displayed state changes.
- Preserve a concise explanation of why the current score changed.
- Treat repeated-read tracking as a future enrichment, not a v1 dependency.

## Acceptance criteria

A first implementation is acceptable when it can:

1. Track the core counters for the current session.
2. Compute a stable severity level from the counters.
3. Display the severity as a single colored status indicator.
4. Emit a concise severity-change notification when a threshold is crossed.
5. Avoid spamming the user with repeated messages.
6. Reset cleanly only when a genuinely new session starts.
7. Restore the same logical score after reloads and resumes.
8. Allow compaction to lower the score when the active segment shrinks.

## Risks and trade-offs

- Too many warnings will cause users to ignore the extension.
- A simplistic heuristic may miss some bloated sessions or overreact to normal
  deep work.
- Counting tool calls is easy; inferring distinct subtasks is less reliable.
- If the extension tries to be too smart, it may become opaque and hard to tune.

## Validating whether v1 is enough

Validation should happen in a separate evidence workspace under
`notes/pi-extension-eval/session-bloat-guard/`, using recorded Pi session
archives and a repeatable rubric. The workspace may reuse the existing
`notes/pi-extension-eval` scoring/analyze scripts if they are useful. The
findings should then be summarized back into the main proposal and README.

Important: session boundaries matter. Only `session_start` with
`reason: "new"` resets the score to zero. Reload, resume, and fork should
restore the persisted historical score from session data. Validation should
therefore check that the UI continues from the same logical session instead of
dropping back to green after a reload.

The key validation question is timeline-based: on real sessions, does the color
move from green to yellow/orange/red early enough that the user could still act
before the repeated rehydration / cache-read problem becomes expensive?

The right question for v1 is not whether it is perfect, but whether it helps
reduce the conditions that lead to excessive token-cached reads on real
recorded sessions.

### Evaluation set

Use a small corpus of recorded Pi sessions that covers:

- short, focused sessions that stayed healthy
- long but still productive sessions
- obviously bloated sessions with many rereads or compactions
- sessions that should have been split into separate subtasks
- sessions with noisy shell output or repeated file access

### Validation rubric

Use a simple repeatable rubric for each recorded session:

- Healthy
- Watch
- Warn
- Strong warn

And outcome labels for the evaluation pass:

- compact-worthy
- split-worthy
- false positive
- false negative
- late warning
- missed warning

### What to measure

Replay or inspect the recorded sessions and compare the v1 score against the
session timeline itself.

Useful checks include:

- did focused sessions stay green throughout?
- did unhealthy sessions move to yellow/orange/red early enough in the event/
  turn timeline?
- at what point in the 0–500 normalized timeline did each color first appear?
- how much cacheRead had already accumulated by the time the color changed?
- did compaction lower the score when the active segment shrank?
- did the score stay stable across reload/resume boundaries?

### Success criteria for v1

v1 is enough if the timeline analysis shows the right trend on real sessions. In
practice, that means:

- focused sessions stay green throughout
- unhealthy sessions show yellow/orange/red early enough to take action
- the color changes happen before the repeated rehydration / cache-read churn
  has already consumed most of the session
- the score restoration holds across reload/resume boundaries
- compaction can lower the score when the active segment shrinks
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

### Decision rule

After the validation pass, decide between three outcomes:

1. v1 is enough as-is to materially reduce the token-cached-read problem.
2. v1 needs a small signal addition and another tuning pass.
3. v1 is not enough and should be reconsidered more broadly.

The analysis is only useful if it helps answer whether the extension is
actually accomplishing the underlying goal, not just whether the heuristic
produces numbers or labels.

### Current conclusion

The archive timeline analysis is encouraging: healthy and moderate sessions stay
green, while high-cacheRead sessions move through watch/warn/strong early enough
to let the user intervene. The analysis does not prove a literal 5x reduction,
but it does support the claim that v1 surfaces the problem in time for action.
On the current evidence, v1 does not appear to need v2 to solve the original
trend-warning problem.

## Recommended v1 scope

Start with just three things:

1. count reads, edits, writes, and compactions
2. compute a transparent severity score
3. surface the score in a single colored status indicator, with a single-line `/session-bloat` summary for the full counters

If v1 proves useful, later versions can add:

- per-file hot-spot reporting
- richer `/session-bloat` detail output
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
