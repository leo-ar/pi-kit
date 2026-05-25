# TODO

**Active Mode:** Maintenance

## Backlog

- [ ] Bench: replay sessions, measure savings at K5 vs K10
- [ ] Persist config to settings.json so it survives reload

### Surfaced

- `/prune-stats` still writes to conversation (4 lines) — acceptable tradeoff
  since it's the only command that benefits from multi-line output
- `ctx.ui.custom()` not supported in emacs — rules out modals for this frontend
- `ctx.ui.setWidget()` silently ignored in emacs
