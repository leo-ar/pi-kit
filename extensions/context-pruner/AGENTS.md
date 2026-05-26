# AGENTS.md — context-pruner extension

> For workflow, testing strategy, and conventions see the repo-level
> [AGENTS.md](../AGENTS.md).

## Files

```
context-pruner.ts      Entry point — context event handler + commands
pruning.ts             Pure logic — classify, decide, stub (zero pi imports)
pruning.test.ts        Unit tests (21)
pruning.prop.test.ts   Property tests with fast-check (7 invariants)
bench.ts               Replay benchmark (read-only, measures savings)
```

## Key types

- `AnyMessage` — union of all message types (defined in pruning.ts)
- `ToolResultMessage` — `role: "toolResult"`, `toolName`, `toolCallId`, `content: TextContent[]`, `isError`
- `AssistantMessage` — tool calls in `content[]` as `{ type: "toolCall", id, name, arguments }`
- `PrunerConfig` — `recentTurnsToKeep`, `minSizeToStub`, `pruneReads`, etc.

## Event flow

1. `context` event fires with `event.messages: AgentMessage[]` (deep copy)
2. `prune()` scans assistant messages to build tool call map (id → name + args)
3. Identifies "recent" cutoff (last K user messages from the end)
4. Builds supersession set (files read then later written/edited)
5. For each old `ToolResultMessage` above min size, classifies and replaces content
6. Returns `{ messages, stats }` — runner returns `{ messages }` to pi

## Design decisions

- Default K9 — bench showed K5 only helps short sessions; K9 is compact in status bar
- Config is ephemeral — resets on reload, tunable via `/prune-keep`
- Output: only `/prune-stats` writes to conversation; everything else uses `ctx.ui.notify`
- No `ctx.ui.custom()` — unsupported in emacs frontend
- `ctx.ui.setStatus` auto-updates from context event handler

## Testing

```bash
# Unit + property tests
node --test --experimental-strip-types 'extensions/context-pruner/*.test.ts'

# Benchmark (read-only, no API calls)
node --experimental-strip-types extensions/context-pruner/bench.ts
node --experimental-strip-types extensions/context-pruner/bench.ts --verbose
```
