/**
 * Property tests for extraction.ts
 *
 * Invariants:
 * 1. Modified file completeness — every write/edit path appears in files.modified
 * 2. Read/modified disjointness — files.read ∩ files.modified = ∅
 * 3. Totality + bounded output — never throws, arrays bounded
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { extractFacts, extractText } from "./extraction.ts";
import type { Message, ContentBlock } from "./extraction.ts";

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const arbFilePath = fc.oneof(
  fc.constant("src/index.ts"),
  fc.constant("lib/utils.ts"),
  fc.constant("README.md"),
  fc.stringMatching(/^[a-z][a-z0-9/._-]{2,40}$/),
);

const arbToolCall = (name: string, path: string): ContentBlock => ({
  type: "toolCall",
  name,
  arguments: { path },
});

const arbReadToolCall = arbFilePath.map((p) =>
  arbToolCall(fc.sample(fc.oneof(fc.constant("read"), fc.constant("read_hashed")), 1)[0], p),
);

const arbWriteToolCall = arbFilePath.map((p) =>
  arbToolCall(fc.sample(fc.oneof(fc.constant("write"), fc.constant("edit"), fc.constant("hashline_edit")), 1)[0], p),
);

const arbAssistantMessage = fc
  .array(fc.oneof(arbReadToolCall, arbWriteToolCall), { minLength: 1, maxLength: 5 })
  .map((blocks): Message => ({
    role: "assistant",
    content: blocks,
  }));

const arbUserMessage = fc.string({ minLength: 0, maxLength: 500 }).map(
  (text): Message => ({
    role: "user",
    content: [{ type: "text", text }],
  }),
);

const arbToolResultMessage = fc
  .record({
    isError: fc.boolean(),
    text: fc.string({ minLength: 0, maxLength: 200 }),
  })
  .map(({ isError, text }): Message => ({
    role: "toolResult",
    isError,
    content: [{ type: "text", text }],
  }));

const arbMessages = fc.array(
  fc.oneof(arbUserMessage, arbAssistantMessage, arbToolResultMessage),
  { minLength: 0, maxLength: 20 },
);

// Helper: extract all write/edit paths from messages
function expectedModifiedPaths(messages: Message[]): Set<string> {
  const paths = new Set<string>();
  for (const msg of messages) {
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;
    for (const block of msg.content as ContentBlock[]) {
      if (block.type !== "toolCall" || !block.arguments) continue;
      const name = block.name ?? "";
      const args = block.arguments as Record<string, string>;
      if (["write", "edit", "hashline_edit"].includes(name) && args.path) {
        paths.add(args.path);
      }
      if (args.filePath) paths.add(args.filePath);
    }
  }
  return paths;
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe("extractFacts — properties", () => {
  it("for all messages with write/edit tool calls, every path appears in files.modified", () => {
    fc.assert(
      fc.property(arbMessages, (msgs) => {
        const extraction = extractFacts(msgs);
        const expected = expectedModifiedPaths(msgs);
        for (const p of expected) {
          assert(
            extraction.files.modified.has(p),
            `Expected "${p}" in files.modified but it was missing`,
          );
        }
      }),
      { numRuns: 20 },
    );
  });

  it("for all extractions, files.read and files.modified are always disjoint", () => {
    fc.assert(
      fc.property(arbMessages, (msgs) => {
        const extraction = extractFacts(msgs);
        for (const f of extraction.files.modified) {
          assert(
            !extraction.files.read.has(f),
            `"${f}" appears in both read and modified`,
          );
        }
      }),
      { numRuns: 20 },
    );
  });

  it("for all well-formed message arrays, extractFacts never throws and output is bounded", () => {
    fc.assert(
      fc.property(arbMessages, (msgs) => {
        const extraction = extractFacts(msgs);

        assert(extraction.errors.length <= 10, `errors: ${extraction.errors.length}`);
        assert(extraction.decisions.length <= 10, `decisions: ${extraction.decisions.length}`);
        assert(extraction.constraints.length <= 8, `constraints: ${extraction.constraints.length}`);
        assert(extraction.goal.length <= 300, `goal length: ${extraction.goal.length}`);
      }),
      { numRuns: 20 },
    );
  });
});

// ─── Example Tests ───────────────────────────────────────────────────────────

describe("extractFacts — examples", () => {
  it("extracts modified files from write tool calls", () => {
    const msgs: Message[] = [
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "write", arguments: { path: "src/app.ts" } }],
      },
    ];
    const result = extractFacts(msgs);
    assert(result.files.modified.has("src/app.ts"));
  });

  it("extracts read files and removes them if also modified", () => {
    const msgs: Message[] = [
      {
        role: "assistant",
        content: [
          { type: "toolCall", name: "read", arguments: { path: "src/app.ts" } },
          { type: "toolCall", name: "edit", arguments: { path: "src/app.ts" } },
        ],
      },
    ];
    const result = extractFacts(msgs);
    assert(result.files.modified.has("src/app.ts"));
    assert(!result.files.read.has("src/app.ts"));
  });

  it("captures errors from toolResult messages", () => {
    const msgs: Message[] = [
      {
        role: "toolResult",
        isError: true,
        content: [{ type: "text", text: "TypeError: cannot read property 'foo' of undefined" }],
      },
    ];
    const result = extractFacts(msgs);
    assert.equal(result.errors.length, 1);
    assert(result.errors[0].includes("TypeError"));
  });

  it("extracts goal from first substantial user message", () => {
    const msgs: Message[] = [
      { role: "user", content: [{ type: "text", text: "Refactor the compaction system to use generators" }] },
    ];
    const result = extractFacts(msgs);
    assert(result.goal.includes("Refactor the compaction system"));
  });

  it("finds multiple constraints in a single message using while loop", () => {
    const msgs: Message[] = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "You must always use TypeScript. You should never modify vendor files. You must prefer composition over inheritance.",
          },
        ],
      },
    ];
    const result = extractFacts(msgs);
    assert(result.constraints.length >= 3, `Expected >=3 constraints, got ${result.constraints.length}`);
  });
});

// ─── extractText tests ───────────────────────────────────────────────────────

describe("extractText", () => {
  it("returns string content directly", () => {
    assert.equal(extractText("hello"), "hello");
  });

  it("extracts text blocks from arrays", () => {
    const content = [
      { type: "text", text: "line 1" },
      { type: "toolCall", name: "read" },
      { type: "text", text: "line 2" },
    ];
    assert.equal(extractText(content), "line 1\nline 2");
  });

  it("returns empty string for non-array, non-string", () => {
    assert.equal(extractText(null), "");
    assert.equal(extractText(undefined), "");
    assert.equal(extractText(42), "");
  });
});
