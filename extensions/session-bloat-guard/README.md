# session-bloat-guard

A lightweight Pi extension that watches for session bloat and surfaces a
simple severity indicator before the session becomes too expensive.

## What it does

- tracks reads, edits, writes, and compactions for the current session
- computes a transparent severity score from session history
- restores the same logical score after reload/resume/fork instead of resetting to green
- updates a single colored status indicator as the session grows
- provides a `/session-bloat` command with a single-line summary of the current state

## What it does not do

- it does not automatically compact sessions
- it does not split sessions on your behalf
- it does not replace pruning or compaction tools
- it does not show a detailed live counter widget
- it does not persist anything outside the session tree itself

## Install

```bash
pi install git:github.com/leo-ar/pi-kit extensions/session-bloat-guard
```

For development, symlink the directory into `~/.pi/agent/extensions/` and run
`/reload` inside pi after editing.

## Usage

- live UI: a single colored circle in the status area
- `/session-bloat`: a single-line summary with the current severity and counters
- compaction can lower the score when the active segment shrinks

## Validation note

Archive timeline validation suggests v1 is enough as a trend signal: healthy and
moderate sessions stay green, while heavy sessions transition to
watch/warn/strong early enough to intervene.
