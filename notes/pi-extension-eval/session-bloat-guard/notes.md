# Notes

## Run 1: archive scan

Source data:

- `~/.pi/agent/sessions/` (read-only)
- `~/.pi/agent/sessions/session-index.sqlite`

Scripts used:

- `scripts/score-sessions.mjs`
- `scripts/analyze-sessions.mjs`

Observed aggregate results:

- 84 sessions were analyzable from the archive/index pair.
- The highest-scoring sessions were concentrated in `~/Projects/PagerDuty/citizens-band`.
- The strongest session-level scores all had high read/edit/write churn and multiple compactions.
- `pi-kit` sessions were present but not the top outliers.
- `~/.config/emacs` and `~/Projects/PagerDuty/citizens-band-nextjs` also showed meaningful churn.

Observed top examples:

- `2026-06-09T22:03:26.413Z` in `citizens-band`: score 812, 340 reads, 326 edits, 98 writes, 12 compactions.
- `2026-06-12T14:50:53.459Z` in `citizens-band`: score 750, 301 reads, 310 edits, 95 writes, 11 compactions.
- `2026-05-18T13:22:48.960Z` in `jml/jml-query-js`: score 405, 170 reads, 146 edits, 37 writes, 13 compactions.
- `2026-06-20T20:49:28.243Z` in `pi-coding-agent`: score 307, 191 reads, 94 edits, 18 writes, 1 compaction.

Auto-picked balanced sample for manual rubric labeling:

- `2026-05-11T17:22:41.302Z` / `citizens-band` — score 0
- `2026-05-17T20:17:17.253Z` / `org` — score 11
- `2026-05-27T02:18:42.021Z` / `pd-analysis` — score 26
- `2026-05-20T15:14:27.478Z` / `citizens-band` — score 54
- `2026-05-17T14:14:34.700Z` / `jml` — score 115
- `2026-05-14T00:28:40.428Z` / `citizens-band` — score 178
- `2026-05-17T00:48:35.481Z` / `citizens-band` — score 258
- `2026-05-18T13:22:48.960Z` / `jml/jml-query-js` — score 405
- `2026-06-20T20:49:28.243Z` / `pi-coding-agent` — score 307
- `2026-05-13T17:42:42.919Z` / `citizens-band` — score 408

Observed obstacle:

- `session-index.sqlite` can be temporarily locked by Pi; copying it to a temp file avoided the lock for one-off analysis runs.
- The archive ranking step is sufficient to auto-pick a balanced set, but actual Healthy/Watch/Warn/Strong warn labeling still requires inspecting the selected session transcripts.

Interpretation notes:

- The v1 heuristic is clearly surfacing high-churn sessions.
- Session length still needs to be considered as context, but the highest scores are also plainly churn-heavy.
- Validation of whether v1 is "enough" still needs explicit rubric labeling on selected sessions, not just ranking.
- A yellow→green reset after reload would be a bug if the same logical session is being continued; reload/resume should restore the historical score instead of resetting it.

Working concern from live use:

- During the current session, the indicator was yellow and then returned to green after a reload. That suggested the scoring state was being reset instead of restored from historical session data. The extension and tests now implement the restore path; the remaining question is whether the live session behaves the same way after the fix.
- Compaction is now modeled as an active-segment reset, so the score can move down after a successful compaction instead of only increasing monotonically.

## Run 2: timeline validation

Method:

- Use event/turn order only; ignore wall-clock time.
- Normalize each session timeline to a 0–500 scale by event order.
- Measure where the color first changes to watch/yellow, warn/orange, and strong/red.
- Compare the transition points against cumulative `cacheRead` in the same session.

Observed healthy-session behavior:

- `2026-05-11T17:22:41.302Z` / `citizens-band`: cacheRead 2,364,907, 56 turns, 50 events, final severity normal, no transitions.
- `2026-05-17T20:17:17.253Z` / `org`: cacheRead 104,340, 14 turns, 8 events, final severity normal, no transitions.
- `2026-05-20T15:14:27.478Z` / `citizens-band`: cacheRead 13,133,458, 198 turns, 185 events, final severity normal, no transitions.
- `2026-05-27T02:18:42.021Z` / `pd-analysis`: cacheRead 2,933,646, 75 turns, 67 events, final severity normal, no transitions.

Observed unhealthy-session behavior:

- High-cacheRead sessions transitioned very early in the event timeline.
- In the heaviest `citizens-band` sessions, watch appeared around 2.7–3.6% of the event timeline and warn around 9.0–12.0%.
- In `jml`, watch appeared at 32.5% of the event timeline and 21.8% of cacheRead; warn appeared at 57.6% of the timeline and 65.2% of cacheRead; strong followed later at 82.8% of the timeline and 90.4% of cacheRead.
- In another `citizens-band` session, watch appeared at 31.5% of the event timeline and 28.6% of cacheRead; strong followed at 53.3% of the timeline and 49.0% of cacheRead.
- By the time strong/red appeared in the heavy sessions, the session had usually consumed only a fraction of total cacheRead:
  - around 26.3–36.7% in several heavy sessions
  - as late as 88.3% in one compaction-heavy session that stayed yellow/warn for much of the run
- Compaction lowered severity when it reset the active segment, which is visible in the timeline as transitions back to normal or watch before later escalation.

Interpretation notes:

- Healthy sessions stayed green throughout, which is the desired no-op behavior.
- Unhealthy sessions did surface yellow/orange/red while a large share of the timeline and cacheRead budget was still ahead of them.
- That suggests the current v1 heuristic is trend-sensitive enough to warn before the most expensive part of the session finishes, which is the behavior needed to let the user restart, compact, or otherwise intervene.
- The early watch/warn transitions are encouraging for the 5x+ cacheRead-reduction goal, but the archive analysis still cannot directly prove user action or the exact reduction factor.

Validation conclusion:

- v1 looks strong enough as a trend signal for the archive sample: healthy and moderate sessions stay green, while high-cacheRead sessions move to watch/warn/strong early enough to permit intervention.
- The archive evidence does not prove a literal 5x reduction, but it does support the claim that the extension would have surfaced the problem early enough to let the user act.
- On the current evidence, v1 does not look like it needs v2 to solve the original trend-warning problem.
