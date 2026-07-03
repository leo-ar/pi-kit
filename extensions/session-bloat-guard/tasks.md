# session-bloat-guard implementation tasks

## Phase 0: ecosystem review

- [x] Inspect `pi-context-tree` for context-health UI patterns and warning cadence
- [x] Inspect `pi-observability` for status/footer conventions and threshold display
- [x] Inspect `pi-dcp` and `@hypabolic/pi-hypa` for repeated-read / stale-output detection ideas
- [x] Note which behaviors can be borrowed directly versus which are still unique to `session-bloat-guard`
- [x] Summarize the review findings in `proposal.md` so the implementation scope stays clear

## Phase 1: scaffold and core behavior

- [x] Create `extensions/session-bloat-guard/package.json`
- [x] Create `extensions/session-bloat-guard/index.ts` entry point
- [x] Add `AGENTS.md` for extension-specific notes and workflow
- [x] Add `README.md` with install/use instructions
- [x] Split core scoring/state logic into `extensions/session-bloat-guard/core.ts`
- [x] Add `extensions/session-bloat-guard/core.test.ts` for the pure scoring and state helpers
- [x] Add `extensions/session-bloat-guard/core.properties.test.ts` for scoring invariants and monotonicity checks
- [x] Design a session-local state object for counters, per-file access, last severity, and last warning reason
- [x] Implement a pure scoring function that maps counters to severity levels
- [x] Decide initial thresholds for reads, edits/writes, compactions, and rereads
- [x] Add a helper to build a short human-readable rationale string

## Phase 2: event collection and lifecycle

- [x] Hook `session_start` to restore the persisted historical score for reload/resume/fork, while only `reason: "new"` starts from zero
- [x] Hook `tool_call` to increment counters for `read`, `edit`, `write`, and other observable growth signals
- [x] Hook `tool_result` if needed to inspect result metadata for future repeated-access tracking
- [x] Hook `session_before_compact` to observe imminent compaction without assuming the score changes yet
- [x] Hook `session_compact` to recalculate the score after compaction and allow severity to drop when the active segment shrinks
- [x] Keep repeated-read tracking as a reserved signal until the event data needed to compute it is added
- [x] Ensure event handlers remain session-local and do not persist state globally
- [x] Verify UI is restored from historical state immediately after session resume/reload so it does not drop back to green incorrectly
- [x] Hook `session_shutdown` to clear only ephemeral in-memory state at the end of the session instance

## Phase 3: user interface and command

- [x] Add a status indicator that reflects the current severity
- [x] Display a concise warning only when severity increases or a threshold is crossed
- [x] Avoid repeating the same warning on every turn
- [x] Keep the messaging calm, short, and actionable
- [x] Simplify the live UI to a single colored circle; expose full values only through `/session-bloat`
- [x] Add a `/session-bloat` command that shows current counters, severity, and rationale
- [x] Make command output easy to scan in the TUI
- [x] Keep command output to a single-line summary for v1
- [x] Keep the command as a plain `notify(...)` message

## Phase 4: validation workspace and rubric

- [x] Scaffold `notes/pi-extension-eval/session-bloat-guard/` as a separate evidence workspace
- [x] Add workspace files: `AGENTS.md`, `README.md`, `notes.md`, `hypotheses.md`, `verified-facts.md`, `unsupported-facts.md`, `open-questions.md`, and `TODO.md`
- [x] Reuse or adapt the existing `notes/pi-extension-eval` scoring/analyze scripts if they help the new corpus
- [x] Define the recorded-session corpus selection rules for focused, healthy, bloated, split-worthy, and noisy sessions
- [x] Define a repeatable rubric with labels for Healthy, Watch, Warn, Strong warn, and outcome tags like compact-worthy / split-worthy / false positive / false negative / late warning / missed warning
- [x] Document how validation compares v1 scores against the rubric and session outcomes
- [x] Treat only `session_start` with `reason: "new"` as a score reset; reload/resume must restore the historical score

## Phase 5: recorded-session validation

- [x] Sample representative recorded sessions from the Pi archive
- [x] Score sessions with the v1 heuristics against the recorded tool/event data
- [x] Measure the event/turn timeline and the point where each severity color first appears
- [x] Compare color transitions against cumulative cacheRead in the same session
- [x] Verify that healthy sessions stay green throughout
- [x] Verify that unhealthy sessions move through yellow/orange/red early enough to act
- [x] Check that compaction can lower the score and that reload/resume keeps the historical score
- [x] Keep command-handler tests lightweight and focused on the public inspection output
- [x] Record the timeline observations in the validation workspace
- [x] Measure false positives, false negatives, and lead time before manual compaction or splitting
- [x] Identify whether the warning timing and severity are directionally correct

## Phase 6: post-validation decision and polish

- [x] Decide whether v1 is enough as-is, needs a small signal addition, or should be reconsidered more broadly
- [x] If validation shows clear misses, add only the smallest extra signals that explain the misses
- [x] Tune initial thresholds based on the validation results
- [x] Summarize the validation conclusions back into `proposal.md` and `README.md`
- [x] Decide whether to add per-file hot-spot reporting in v2
- [x] Document known limitations and non-goals in the README
