# Notes

## Raw observations

- The archive contains **84 sessions** across multiple cwd roots.
- `pi-kit` accounts for **7 sessions** in the archive.
- `read-outline` shows up directly in the archive as `── outline ──` replacements.
- `context-pruner` exposes a `prune-stats` command that reports how much context it saved.
- `smart-compact` is visible indirectly through compaction events and rich compaction summaries.
- `pi-hashline-edit-pro` would primarily help edit precision, not read compression.

## Session-level signals in `pi-kit`

- One long `pi-kit` session on **2026-05-25** reported `context-pruner` stats of:
  - **10 LLM calls with pruning**
  - **173.3 KB saved**
  - **~44,357 tokens saved**
- The same session also had:
  - **53 full reads**
  - **77 edits**
  - **45 writes**
  - **4 compactions**
- Another `pi-kit` session on **2026-05-26** had:
  - **44 full reads**
  - **84 edits**
  - **62 writes**
  - **5 compactions**
  - **7 outline hits**
- A later `pi-kit` session on **2026-06-11** had:
  - **34 full reads**
  - **8 outline hits**
  - **4 edits**
  - **7 writes**

## High-churn candidate sessions for hashline-style editing

- `pi-kit` session **2026-05-25**: `context-pruner.ts` was read **8 times** and modified **22 times**.
- `pi-kit` session **2026-05-26**: repeated reads hit `AGENTS.md`, `README.md`, `src/index.ts`, `outline.ts`, and test files.
- Several `citizens-band` sessions had **300+ reads** and **300+ edits**, making them strong counterfactual candidates for hash-anchored editing.

## Notes on interpretation

- `read-outline` has direct, visible payoff in the archive.
- `context-pruner` has at least one strong win, but its benefit is uneven across sessions.
- `smart-compact` has many compaction opportunities, but its archive-level value is harder to isolate without a before/after baseline.
- `pi-hashline-edit-pro` is a likely correctness win in edit-heavy sessions, but it would not improve token efficiency in the same way as `read-outline`.
