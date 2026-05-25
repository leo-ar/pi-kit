# AGENTS.md — context-pruner extension

## Purpose

Reduces context token usage by replacing stale tool results with one-line stubs
before each LLM call. Uses the `context` event (deep copy, fires every turn).
Session files are never modified.

## Files

```
context-pruner.ts      Thin runner — context event handler + commands
pruning.ts             Pure logic — classify, decide, stub (zero pi imports)
pruning.test.ts        Unit tests (21)
pruning.prop.test.ts   Property tests with fast-check (7 invariants)
bench.ts               Replay benchmark (read-only, measures savings)
notes/TODO.md          Current status
notes/RETROS.md        Session retrospectives
```

## Key types

- `AnyMessage` — union of all message types (defined in pruning.ts)
- `ToolResultMessage` — `role: "toolResult"`, `toolName`, `toolCallId`, `content: TextContent[]`, `isError`
- `AssistantMessage` — has tool calls in `content[]` as `{ type: "toolCall", id, name, arguments }`
- `PrunerConfig` — `recentTurnsToKeep`, `minSizeToStub`, `pruneReads`, etc.

## Event flow

1. `context` event fires with `event.messages: AgentMessage[]` (deep copy)
2. `prune()` scans assistant messages to build tool call map (id → name + args)
3. Identifies "recent" cutoff (last K user messages from the end)
4. Builds supersession set (files read then later written/edited)
5. For each old `ToolResultMessage` above min size, classifies and replaces content
6. Returns `{ messages, stats }` — runner returns `{ messages }` to pi

## Pruning rules

- **Always keep**: recent K turns, small (<500 chars), errors, edit/write confirmations
- **Stub**: old reads, old informational bash (ls/find/grep/cat), old large bash (>2KB)
- **Supersession**: reads of files later modified get annotated stub

## Commands

- `/prune-stats` → sendMessage (conversation) — detailed breakdown
- `/prune-keep [N]` → ctx.ui.notify (ephemeral) — view/set K level
- `/prune-config [key [value]]` → ctx.ui.notify (ephemeral) — all settings

## Status bar

`ctx.ui.setStatus("prune-stats", ...)` — updates on every context event.
In emacs: shows in header-line.

## Testing

```bash
# Unit + property tests
node --test --experimental-strip-types 'extensions/context-pruner/*.test.ts'

# Benchmark (read-only, no API calls)
node --experimental-strip-types extensions/context-pruner/bench.ts
node --experimental-strip-types extensions/context-pruner/bench.ts --verbose --limit=5
```

## Design decisions

- Default K9 (not K5/K10) — bench showed K5 only helps short sessions where
  context pressure is already low; K9 is compact in the status bar.
- Config is ephemeral — resets on reload, tunable via `/prune-keep` for experimentation.
- Output routing: only `/prune-stats` writes to conversation; everything else
  uses notify (no context pollution).
- No `ctx.ui.custom()` — unsupported in emacs frontend.
