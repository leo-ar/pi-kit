# Verified facts

- 84 sessions were analyzable from the archive/index pair.
- The top-scoring sessions were concentrated in `~/Projects/PagerDuty/citizens-band`.
- High scores correlated with high read/edit/write churn and multiple compactions.
- `jml/jml-query-js`, `~/.config/emacs`, `pi-kit`, and `citizens-band-nextjs` also contributed meaningful churn.
- The validation scripts can run successfully against the read-only session archive and index.
- Healthy and moderate sessions in the timeline validation stayed green throughout and had no color transitions.
- High-cacheRead sessions transitioned to watch/yellow very early in the event timeline, and mid-high sessions still transitioned before the end of the run.
- In high-cacheRead sessions, warn/orange usually appeared well before the end of the timeline and before most cacheRead was consumed.
- In the `jml` and `citizens-band` timeline examples, severity changes tracked the rising cacheRead budget rather than lagging far behind it.
- Compaction can lower the score when the active segment shrinks.
- Reload/resume should restore the historical score instead of resetting it to green.
