import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classify,
  prune,
  findRecentCutoff,
  buildToolCallMap,
  buildWrittenFilesSet,
  getContentLength,
  DEFAULT_CONFIG,
  type ToolResultMessage,
  type AssistantMessage,
  type AnyMessage,
  type PrunerConfig,
} from "./pruning.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeToolResult(opts: {
  toolCallId?: string;
  toolName: string;
  text: string;
  isError?: boolean;
}): ToolResultMessage {
  return {
    role: "toolResult",
    toolCallId: opts.toolCallId || "tc_" + Math.random().toString(36).slice(2),
    toolName: opts.toolName,
    content: [{ type: "text", text: opts.text }],
    isError: opts.isError || false,
    timestamp: Date.now(),
  };
}

function makeAssistant(toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[]): AssistantMessage {
  return {
    role: "assistant",
    content: toolCalls.map((tc) => ({
      type: "toolCall" as const,
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments,
    })),
  };
}

function makeUser(text: string = "do something"): AnyMessage {
  return { role: "user", content: text, timestamp: Date.now() };
}

function bigText(lines: number): string {
  return Array.from({ length: lines }, (_, i) => `line ${i}: ${"x".repeat(80)}`).join("\n");
}

// ─── classify() ──────────────────────────────────────────────────────────────

describe("classify", () => {
  it("keeps error results", () => {
    const msg = makeToolResult({ toolName: "bash", text: bigText(10), isError: true });
    const result = classify(msg, { command: "npm test" }, new Set(), DEFAULT_CONFIG);
    assert.equal(result.action, "keep");
    assert.equal(result.reason, "error");
  });

  it("keeps small results", () => {
    const msg = makeToolResult({ toolName: "bash", text: "ok" });
    const result = classify(msg, { command: "echo hi" }, new Set(), DEFAULT_CONFIG);
    assert.equal(result.action, "keep");
    assert.equal(result.reason, "small");
  });

  it("keeps edit/write results regardless of size", () => {
    const msg = makeToolResult({ toolName: "edit", text: bigText(50) });
    const result = classify(msg, { path: "foo.ts" }, new Set(), DEFAULT_CONFIG);
    assert.equal(result.action, "keep");
    assert.equal(result.reason, "edit/write");
  });

  it("stubs old read results", () => {
    const msg = makeToolResult({ toolName: "read", text: bigText(100) });
    const result = classify(msg, { path: "src/foo.ts" }, new Set(), DEFAULT_CONFIG);
    assert.equal(result.action, "stub");
    assert.equal(result.reason, "read-old");
    assert.match(result.stub, /\[read src\/foo\.ts — \d+ lines\]/);
  });

  it("stubs superseded read results with note", () => {
    const msg = makeToolResult({ toolName: "read", text: bigText(50) });
    const written = new Set(["src/foo.ts"]);
    const result = classify(msg, { path: "src/foo.ts" }, written, DEFAULT_CONFIG);
    assert.equal(result.action, "stub");
    assert.equal(result.reason, "read-superseded");
    assert.match(result.stub, /file was later modified/);
  });

  it("stubs old ls results", () => {
    const msg = makeToolResult({ toolName: "bash", text: bigText(30) });
    const result = classify(msg, { command: "ls -la src/" }, new Set(), DEFAULT_CONFIG);
    assert.equal(result.action, "stub");
    assert.equal(result.reason, "bash-informational");
    assert.match(result.stub, /\[ls src\/ — \d+ entries\]/);
  });

  it("stubs old find results", () => {
    const msg = makeToolResult({ toolName: "bash", text: bigText(50) });
    const result = classify(msg, { command: "find . -name '*.ts'" }, new Set(), DEFAULT_CONFIG);
    assert.equal(result.action, "stub");
    assert.equal(result.reason, "bash-informational");
    assert.match(result.stub, /\[find \. — \d+ results\]/);
  });

  it("stubs old cat results", () => {
    const msg = makeToolResult({ toolName: "bash", text: bigText(80) });
    const result = classify(msg, { command: "cat README.md" }, new Set(), DEFAULT_CONFIG);
    assert.equal(result.action, "stub");
    assert.equal(result.reason, "bash-informational");
    assert.match(result.stub, /\[cat README\.md — \d+ lines\]/);
  });

  it("stubs old grep results", () => {
    const msg = makeToolResult({ toolName: "bash", text: bigText(20) });
    const result = classify(msg, { command: "grep 'export' src/" }, new Set(), DEFAULT_CONFIG);
    assert.equal(result.action, "stub");
    assert.equal(result.reason, "bash-search");
    assert.match(result.stub, /\[grep "export" — \d+ lines\]/);
  });

  it("stubs large unknown bash results", () => {
    const msg = makeToolResult({ toolName: "bash", text: bigText(40) });
    const result = classify(msg, { command: "gh api repos/foo/bar" }, new Set(), DEFAULT_CONFIG);
    assert.equal(result.action, "stub");
    assert.equal(result.reason, "bash-large");
    assert.match(result.stub, /\[bash: gh api repos\/foo\/bar — [\d.]+KB output, exit 0\]/);
  });

  it("keeps small unknown bash results", () => {
    const msg = makeToolResult({ toolName: "bash", text: "done" });
    const result = classify(msg, { command: "echo done" }, new Set(), DEFAULT_CONFIG);
    assert.equal(result.action, "keep");
    assert.equal(result.reason, "small");
  });

  it("respects pruneReads config", () => {
    const msg = makeToolResult({ toolName: "read", text: bigText(100) });
    const config = { ...DEFAULT_CONFIG, pruneReads: false };
    const result = classify(msg, { path: "src/foo.ts" }, new Set(), config);
    assert.equal(result.action, "keep");
  });

  it("respects pruneBashInformational config", () => {
    const msg = makeToolResult({ toolName: "bash", text: bigText(30) });
    const config = { ...DEFAULT_CONFIG, pruneBashInformational: false };
    const result = classify(msg, { command: "ls -la src/" }, new Set(), config);
    // Falls through to bash-large since it's >2KB
    assert.equal(result.action, "stub");
    assert.equal(result.reason, "bash-large");
  });
});

// ─── findRecentCutoff() ──────────────────────────────────────────────────────

describe("findRecentCutoff", () => {
  it("returns 0 when fewer turns than threshold", () => {
    const msgs: AnyMessage[] = [makeUser(), makeUser(), makeUser()];
    assert.equal(findRecentCutoff(msgs, 10), 0);
  });

  it("finds the Nth user message from the end", () => {
    const msgs: AnyMessage[] = [];
    for (let i = 0; i < 20; i++) {
      msgs.push(makeUser(`turn ${i}`));
      msgs.push(makeAssistant([]));
    }
    // 20 user messages, keep last 5 → cutoff at the 15th user message (index 28)
    const cutoff = findRecentCutoff(msgs, 5);
    // Count user messages after cutoff
    let userCount = 0;
    for (let i = cutoff; i < msgs.length; i++) {
      if (msgs[i].role === "user") userCount++;
    }
    assert.equal(userCount, 5);
  });
});

// ─── buildToolCallMap() ──────────────────────────────────────────────────────

describe("buildToolCallMap", () => {
  it("maps tool call IDs to arguments", () => {
    const msgs: AnyMessage[] = [
      makeAssistant([
        { id: "tc_1", name: "read", arguments: { path: "foo.ts" } },
        { id: "tc_2", name: "bash", arguments: { command: "ls" } },
      ]),
    ];
    const map = buildToolCallMap(msgs);
    assert.deepEqual(map.get("tc_1"), { path: "foo.ts" });
    assert.deepEqual(map.get("tc_2"), { command: "ls" });
  });
});

// ─── buildWrittenFilesSet() ──────────────────────────────────────────────────

describe("buildWrittenFilesSet", () => {
  it("collects paths from write and edit tool calls", () => {
    const msgs: AnyMessage[] = [
      makeAssistant([
        { id: "tc_1", name: "read", arguments: { path: "foo.ts" } },
        { id: "tc_2", name: "write", arguments: { path: "bar.ts" } },
        { id: "tc_3", name: "edit", arguments: { path: "baz.ts" } },
      ]),
    ];
    const written = buildWrittenFilesSet(msgs);
    assert(!written.has("foo.ts"));
    assert(written.has("bar.ts"));
    assert(written.has("baz.ts"));
  });
});

// ─── prune() integration ─────────────────────────────────────────────────────

describe("prune", () => {
  it("keeps all messages when fewer turns than threshold", () => {
    const msgs: AnyMessage[] = [
      makeUser(),
      makeAssistant([{ id: "tc_1", name: "read", arguments: { path: "big.ts" } }]),
      makeToolResult({ toolCallId: "tc_1", toolName: "read", text: bigText(100) }),
    ];
    const { stats } = prune(msgs, { ...DEFAULT_CONFIG, recentTurnsToKeep: 10 });
    assert.equal(stats.pruned, 0);
  });

  it("prunes old read results but keeps recent ones", () => {
    const msgs: AnyMessage[] = [];
    // 15 turns of read
    for (let i = 0; i < 15; i++) {
      const id = `tc_${i}`;
      msgs.push(makeUser(`read file ${i}`));
      msgs.push(makeAssistant([{ id, name: "read", arguments: { path: `file${i}.ts` } }]));
      msgs.push(makeToolResult({ toolCallId: id, toolName: "read", text: bigText(100) }));
    }
    const config = { ...DEFAULT_CONFIG, recentTurnsToKeep: 5 };
    const { messages, stats } = prune(msgs, config);

    // Old ones should be stubbed
    assert(stats.pruned > 0);
    assert(stats.charsSaved > 0);

    // Recent ones should be intact
    const lastResult = messages[messages.length - 1] as ToolResultMessage;
    assert(lastResult.content[0].text.startsWith("line 0:"));
  });

  it("tracks superseded reads", () => {
    const msgs: AnyMessage[] = [];
    // Turn 1: read foo.ts
    msgs.push(makeUser("read"));
    msgs.push(makeAssistant([{ id: "tc_read", name: "read", arguments: { path: "foo.ts" } }]));
    msgs.push(makeToolResult({ toolCallId: "tc_read", toolName: "read", text: bigText(50) }));
    // Turn 2-12: padding to push turn 1 out of recent window
    for (let i = 0; i < 11; i++) {
      msgs.push(makeUser(`padding ${i}`));
      msgs.push(makeAssistant([{ id: `tc_pad_${i}`, name: "bash", arguments: { command: "echo ok" } }]));
      msgs.push(makeToolResult({ toolCallId: `tc_pad_${i}`, toolName: "bash", text: "ok" }));
    }
    // Turn 13: write foo.ts (supersedes the read)
    msgs.push(makeUser("write"));
    msgs.push(makeAssistant([{ id: "tc_write", name: "write", arguments: { path: "foo.ts" } }]));
    msgs.push(makeToolResult({ toolCallId: "tc_write", toolName: "write", text: "ok" }));

    const config = { ...DEFAULT_CONFIG, recentTurnsToKeep: 3 };
    const { messages, stats } = prune(msgs, config);

    assert.equal(stats.byReason["read-superseded"], 1);
    const stubbedRead = messages[2] as ToolResultMessage;
    assert.match(stubbedRead.content[0].text, /file was later modified/);
  });

  it("returns correct charsSaved", () => {
    const msgs: AnyMessage[] = [];
    for (let i = 0; i < 12; i++) {
      const id = `tc_${i}`;
      msgs.push(makeUser(`turn ${i}`));
      msgs.push(makeAssistant([{ id, name: "bash", arguments: { command: "cat bigfile.txt" } }]));
      msgs.push(makeToolResult({ toolCallId: id, toolName: "bash", text: bigText(50) }));
    }
    const config = { ...DEFAULT_CONFIG, recentTurnsToKeep: 2 };
    const { stats } = prune(msgs, config);

    assert(stats.charsSaved > 0);
    assert(stats.pruned > 0);
    // Each stubbed result saves most of its chars
    const avgOriginal = bigText(50).length;
    assert(stats.charsSaved > stats.pruned * (avgOriginal * 0.9));
  });
});
