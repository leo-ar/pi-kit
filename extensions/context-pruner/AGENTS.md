# AGENTS.md — context-pruner extension

## Purpose

Reduces context token usage by replacing stale tool results with one-line stubs
before each LLM call. Uses the `context` event (deep copy, fires every turn).

## Architecture

```
context-pruner.ts   Thin runner — registers the context event handler
pruning.ts          Pure logic — classify, decide, stub (generator-effects)
pruning.test.ts     Tests for pure logic
```

## Key types

- `AgentMessage` from `@earendil-works/pi-agent-core` — union of all message types
- `ToolResultMessage` — has `role: "toolResult"`, `toolName`, `toolCallId`, `content`, `isError`
- `AssistantMessage` — has tool calls in `content[]` blocks with `type: "toolCall"`
- Tool call block: `{ type: "toolCall", id, name, arguments: { path?, command?, ... } }`

## Event flow

1. `context` event fires with `event.messages: AgentMessage[]` (deep copy)
2. Handler scans assistant messages to build tool call map (id → name + args)
3. Handler identifies "recent" cutoff (last N turns of user messages)
4. For each old `ToolResultMessage`, classify and replace content with stub
5. Return `{ messages: prunedMessages }`

## Pruning rules (Strategy 2: supersession-aware)

- **Keep**: recent, small (<500 chars), errors, edit/write results
- **Stub**: old reads (superseded or not), old informational bash (ls/find/grep/cat), old large bash

## Testing

```bash
node --test --experimental-strip-types 'extensions/context-pruner/*.test.ts'
```
