# pi extension evaluation

## Topic

Evaluate whether the current pi extension stack is pulling its weight in real
sessions, and whether `pi-hashline-edit-pro` would have been a clear win.

## Data source

`~/.pi/agent/sessions/` JSONL session archives and
`~/.pi/agent/sessions/session-index.sqlite`

## Date range

TBD

## Executive summary

- **read-outline is clearly paying rent.** It appears in 17 visible outline hits
  inside the `pi-kit` sessions alone, and 59 times across the full archive.
- **context-pruner has at least one strong win, but it is uneven.** One `pi-kit`
  session saved 173.3 KB / ~44,357 tokens across 10 pruning calls; other sessions
  reported zero pruning activity.
- **smart-compact has evidence of use, but not a clean before/after score.** The
  archive shows many compactions, and the summaries retained a lot of decision and
  goal detail, but the archive alone cannot prove superiority over the default.
- **pi-hashline-edit-pro looks promising for edit correctness, not token savings.**
  The strongest counterfactuals are edit-heavy sessions with repeated reads and
  repeated modifications, especially in `pi-kit` and `citizens-band`.
- **Bottom line:** hashline is worth considering as a targeted or opt-in editing
  workflow, but not as an obvious universal replacement for the current read path.

## Key evidence

| Signal                                           | Evidence                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `pi-kit` archive size                            | 7 sessions                                                       |
| `pi-kit` full reads                              | 174                                                              |
| `pi-kit` outline hits                            | 17                                                               |
| `pi-kit` compactions                             | 10                                                               |
| `context-pruner` best observed session           | 10 pruning calls, 173.3 KB saved                                 |
| `context-pruner` weak observed session           | 0 pruning calls, 0 KB saved                                      |
| strongest hashline-style `pi-kit` candidate      | 2026-05-25: 53 full reads, 77 edits, 45 writes, 4 compactions    |
| strongest archive-wide hashline-style candidates | multiple `citizens-band` sessions with 300+ reads and 300+ edits |

## Re-running the ranking

Use the reusable scorer to rank future sessions with the same heuristics:

```bash
cd ~/Projects/leo-ar/pi-kit/notes/pi-extension-eval
node score-sessions.mjs --cwd /Users/lrojas/Projects/leo-ar/pi-kit --top 5
```

Add `--json` if you want machine-readable output.
