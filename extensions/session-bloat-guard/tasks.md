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

- [x] Hook `session_start` to initialize or reset counters and UI state, including resumed sessions (`reason: "resume"`)
- [x] Hook `tool_call` to increment counters for `read`, `edit`, `write`, and other observable growth signals
- [x] Hook `tool_result` if needed to inspect result metadata for future repeated-access tracking
- [x] Hook `session_before_compact` to record compaction history and update severity
- [x] Keep repeated-read tracking as a reserved signal until the event data needed to compute it is added
- [x] Ensure event handlers remain session-local and do not persist state globally
- [x] Verify UI is refreshed immediately after session restoration so the status is correct on `/resume`
- [x] Hook `session_shutdown` to clear ephemeral state at the end of the session instance

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

## Phase 4: validation

- [x] Test a session with repeated reads and edits to confirm severity increases
- [x] Test compaction events to confirm counters update correctly
- [x] Test that warnings are not spammed repeatedly
- [x] Verify state resets at new session start
- [x] Confirm the status indicator and widget update as expected
- [x] Add wrapper integration tests for session start, resume, compaction, shutdown, and the `/session-bloat` command
- [x] Simplify the resume-path test so it only verifies UI refresh, not a visible resume notice
- [x] Keep command-handler tests lightweight and focused on the public inspection output
- [ ] Validate v1 against a corpus of recorded sessions: focused, long-but-healthy, bloated, split-worthy, and noisy sessions
- [ ] Measure false positives, false negatives, and lead time before manual compaction or splitting
- [ ] If v1 underperforms on recorded sessions, add only the smallest extra signals that explain the misses

## Phase 5: post-validation polish

- [ ] Tune initial thresholds based on real sessions
- [ ] Decide whether to add per-file hot-spot reporting in v2
- [ ] Document known limitations and non-goals in the README
