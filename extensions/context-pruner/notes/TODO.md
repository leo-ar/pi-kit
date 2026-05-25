# TODO

**Active Mode:** Maintenance

## Backlog

_(empty — feature complete)_

### Design Decisions (closed)

- `/prune-stats` outputs to conversation (sendMessage) — only command needing
  multi-line; acceptable context cost for a manually-triggered diagnostic.
- No `ctx.ui.custom()` or `ctx.ui.setWidget()` — unsupported in emacs frontend.
- Config is ephemeral — resets to K9 on reload, tunable via `/prune-keep`.
