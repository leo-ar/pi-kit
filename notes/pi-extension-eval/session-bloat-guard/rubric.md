# session-bloat-guard rubric

## Severity labels

- **Healthy** — session remains focused and low-churn.
- **Watch** — session is growing faster than usual, but still plausibly healthy.
- **Warn** — session is likely to benefit from compaction or a fresh split.
- **Strong warn** — session is clearly bloated and should be split soon.

## Outcome tags

- **compact-worthy** — manual `/compact` would have been reasonable.
- **split-worthy** — the session should likely have been split into a new session.
- **false positive** — v1 warned when the session still looked healthy.
- **false negative** — v1 stayed quiet when the session was clearly bloated.
- **late warning** — v1 warned, but only after the session was already painful.
- **missed warning** — v1 never warned despite clear bloat.

## Validation notes

Use these labels consistently when reviewing recorded sessions. If a session is
long but low-churn, prefer `Healthy` or `Watch`. If a session repeatedly rereads
or compacts, prefer `Warn` or `Strong warn`.
