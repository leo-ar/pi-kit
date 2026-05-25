# TODO

**Active Mode:** Maintenance

## Backlog

_(empty — feature complete)_

### Surfaced

- `/prune-stats` still writes to conversation (4 lines) — acceptable tradeoff
  since it's the only command that benefits from multi-line output
- `ctx.ui.custom()` not supported in emacs — rules out modals for this frontend
- `ctx.ui.setWidget()` silently ignored in emacs
- Config is ephemeral by design — live tuning via `/prune-keep` for experimentation,
  resets to K9 on reload. No persistence needed.
