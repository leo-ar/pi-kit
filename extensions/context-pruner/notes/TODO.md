# TODO

**Active Mode:** Feature

## Doing

- [ ] Decide next: clean for merge, property tests, or bench?

## Done (this session)

- [x] Context event confirmed working (173KB saved)
- [x] Default changed to K5
- [x] `/prune-keep` command (renamed from `/prune-level`)
- [x] Auto-updating status bar (`🪓 KB K5`)
- [x] Minimal status format
- [x] Output routing: notify for ephemeral, sendMessage only for /prune-stats
- [x] Audited emacs frontend — setStatus → header-line, notify → echo area

## Backlog

### Planned

- [ ] Remove debug logging, clean up for merge
- [ ] Property tests with fast-check
- [ ] Bench: replay sessions, measure savings at K5 vs K10
- [ ] Squash 16 commits → clean history, merge to `main`

### Surfaced

- `/prune-stats` still writes to conversation (4 lines) — acceptable tradeoff
  since it's the only command that benefits from multi-line output
- `ctx.ui.custom()` not supported in emacs — rules out modals for this frontend
- `ctx.ui.setWidget()` silently ignored in emacs
- Consider persisting config to settings.json so it survives reload
