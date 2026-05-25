# Retrospectives

## 2026-05-25 — Cleanup & merge to main (Feature)

**Branch:** `feat/context-pruner` → squash-merged to `main`

### What went well

- Clean squash merge: 18 commits → 1. Commit message captures the full
  feature scope without noise.
- Debug removal was trivial — `lastDebug` replaced with `lastStats` (3
  fields vs a full roles reduce). Code went from 132 → 118 lines.
- 63 tests green before merge. No regressions.
- Notes reorganized per-extension — no more shared top-level `notes/`.

### What went wrong

- Nothing major. The `git branch -d` failed (expected with squash merge)
  but `-D` resolved it immediately.

### Lessons

- **Squash merge for feature branches.** Individual commits during
  exploration have no archival value. One clean commit tells the story.
- **Keep TODO current after merge.** Stale "done" items mislead the next
  session.

---

## 2026-05-25 — UI polish pass (Feature)

**Branch:** `feat/context-pruner`

### What went well

- Investigated emacs frontend source to understand what actually works.
  Avoided building a `ctx.ui.custom()` modal that would've been invisible.
- Status bar auto-update from context handler is elegant — zero user action
  needed, always current.
- `notify` for ephemeral commands (keep, config) is the right call — no
  context pollution, instant feedback.
- Renaming L→K resolved the "higher = more aggressive" confusion cleanly.

### What went wrong

- Forgot to check if `/prune-config` number parsing worked before shipping.
  The NaN bug may have been a user typo but we lacked validation regardless.
- Multiple rename commits (prune-level → prune-keep) could have been one
  if we'd thought about the UX label first.

### Lessons

- **Check the frontend before designing UI.** The emacs client only supports
  setStatus, notify, sendMessage, confirm, select, input. No custom TUI.
- **Ephemeral feedback for config changes.** Users don't need to re-read
  "level set to 5" — flash it and move on.
- **Name things by what they control, not the effect.** "Keep 5" is concrete;
  "level 5" is ambiguous.

---

## 2026-05-24 — context-pruner live validation (Feature)

**Branch:** `feat/context-pruner`

### What went well

- Extension works in production: 173KB / ~44K tokens saved in one session.
- `setStatus` gives persistent real-time feedback in the footer (🪓 173.3KB saved).
- Correctly conservative — 7/152 results pruned means no risk of losing
  useful context. Can tune up from here.
- The "not firing" issue was a false alarm — just needed enough turns to
  accumulate. The debug logging confirmed it clearly once context existed.

### What went wrong

- Wasted a full round thinking the context event was broken. Should have
  just sent a normal message first and checked after.
- `appendEntry` vs `sendMessage` confusion cost another round.

### Lessons

- **Commands don't trigger agent turns.** The `context` event only fires
  when the LLM is called (user messages, not slash commands).
- **Status widgets persist.** `ctx.ui.setStatus()` stays in the footer
  until cleared — good for ongoing metrics like savings counters.
- **Start conservative, tune up.** 10 recent turns is safe. Now we can
  experiment with 5 knowing the baseline works.

---

## 2026-05-24 — context-pruner scaffold (Feature)

**Branch:** `feat/context-pruner`
**Duration:** Single session (exploration + scaffold)

### What went well

- Data-driven design: analyzed 111 real slices before writing any code.
  The numbers (76% of context is tool results, 77% of those are old) made
  the case clearly and shaped the strategy directly.
- Pure-logic-first approach: `pruning.ts` has zero pi imports, 21 tests
  passing immediately. Same pattern as smart-compact.
- Supersession detection (read → later write) was simple to implement and
  the data confirmed it catches 55% of old read chars.

### What went wrong

- **Four API mistakes in context-pruner.ts:**
  1. `registerCommand` takes `(name, opts)` not `({name, ...opts})`
  2. `argumentHint` doesn't exist in the RegisteredCommand interface
  3. Event handler args are `(event, ctx)` not `(ctx, event)`
  4. `appendEntry` is for persistence, not display — need `sendMessage`
- Rushed to live testing without verifying the event contract first.

### Lessons

- **Read the API types BEFORE writing the runner.** Check `.d.ts` first.
- **Verify the hook works before building logic on top of it.**
- Pure logic module pattern continues to pay off — all issues were in the
  thin integration layer, not the core logic.
