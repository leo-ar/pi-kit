/**
 * Property tests for the context pruner.
 *
 * Uses fast-check to verify invariants hold for arbitrary message sequences.
 * Run with: node --test --experimental-strip-types extensions/context-pruner/pruning.prop.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  prune,
  getContentLength,
  DEFAULT_CONFIG,
  type PrunerConfig,
  type AnyMessage,
  type ToolResultMessage,
  type AssistantMessage,
  type UserMessage,
  type TextContent,
  type ToolCallBlock,
} from "./pruning.ts";

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const NUM_RUNS = 20;

let toolCallCounter = 0;
function nextToolCallId(): string {
  return `tc_${++toolCallCounter}`;
}

const arbTextContent: fc.Arbitrary<TextContent> = fc.string({ minLength: 1, maxLength: 2000 }).map(
  (text) => ({ type: "text" as const, text })
);

const arbLargeTextContent: fc.Arbitrary<TextContent> = fc.string({ minLength: 600, maxLength: 3000 }).map(
  (text) => ({ type: "text" as const, text })
);

const arbToolName = fc.constantFrom("read", "bash", "edit", "write", "search");

const arbFilePath = fc.constantFrom(
  "src/index.ts", "README.md", "package.json", "lib/utils.ts",
  "test/foo.test.ts", "src/components/App.tsx"
);

const arbBashCommand = fc.constantFrom(
  "ls -la", "find . -name '*.ts'", "grep -r 'foo' src/",
  "cat src/index.ts", "npm test", "git status",
  "node build.js", "echo hello", "tree src/"
);

function arbToolCall(): fc.Arbitrary<{ block: ToolCallBlock; result: ToolResultMessage }> {
  return fc.tuple(arbToolName, arbFilePath, arbBashCommand, arbLargeTextContent, fc.boolean()).map(
    ([toolName, path, command, content, isError]) => {
      const id = nextToolCallId();
      const args: Record<string, unknown> = toolName === "read" || toolName === "edit" || toolName === "write"
        ? { path }
        : { command };

      const block: ToolCallBlock = { type: "toolCall", id, name: toolName, arguments: args };
      const result: ToolResultMessage = {
        role: "toolResult",
        toolCallId: id,
        toolName,
        content: [content],
        isError,
        timestamp: Date.now(),
      };
      return { block, result };
    }
  );
}

function arbUserMessage(): fc.Arbitrary<UserMessage> {
  return fc.string({ minLength: 1, maxLength: 200 }).map((text) => ({
    role: "user" as const,
    content: text,
    timestamp: Date.now(),
  }));
}

/**
 * Generate a realistic conversation: alternating user → assistant (with tool calls) → tool results.
 * Returns a flat message array.
 */
function arbConversation(minTurns: number, maxTurns: number): fc.Arbitrary<AnyMessage[]> {
  return fc.integer({ min: minTurns, max: maxTurns }).chain((numTurns) => {
    // Each turn: user + assistant (1-3 tool calls) + tool results
    const turnArb = fc.tuple(
      arbUserMessage(),
      fc.integer({ min: 1, max: 3 })
    ).chain(([userMsg, numTools]) => {
      return fc.array(arbToolCall(), { minLength: numTools, maxLength: numTools }).map(
        (toolCalls) => {
          const assistantContent: (TextContent | ToolCallBlock)[] = toolCalls.map(tc => tc.block);
          const assistant: AssistantMessage = {
            role: "assistant",
            content: assistantContent,
          };
          const results = toolCalls.map(tc => tc.result);
          return [userMsg, assistant, ...results] as AnyMessage[];
        }
      );
    });

    return fc.array(turnArb, { minLength: numTurns, maxLength: numTurns }).map(
      (turns) => turns.flat()
    );
  });
}

const arbConfig: fc.Arbitrary<PrunerConfig> = fc.record({
  recentTurnsToKeep: fc.integer({ min: 1, max: 15 }),
  minSizeToStub: fc.integer({ min: 0, max: 1000 }),
  pruneReads: fc.boolean(),
  pruneBashInformational: fc.boolean(),
  pruneBashLarge: fc.boolean(),
  pruneBashLargeThreshold: fc.integer({ min: 100, max: 5000 }),
});

// ─── Properties ──────────────────────────────────────────────────────────────

describe("prune() property tests", () => {

  it("P1: message count preserved — stubs never remove messages", () => {
    fc.assert(
      fc.property(arbConversation(3, 12), arbConfig, (messages, config) => {
        const { messages: pruned } = prune(messages, config);
        assert.equal(pruned.length, messages.length);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("P2: never prunes recent turns — messages after cutoff are identical", () => {
    fc.assert(
      fc.property(arbConversation(3, 12), arbConfig, (messages, config) => {
        const { messages: pruned } = prune(messages, config);

        // Find the cutoff: count K user messages from the end
        let userCount = 0;
        let cutoffIdx = 0;
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === "user") {
            userCount++;
            if (userCount >= config.recentTurnsToKeep) {
              cutoffIdx = i;
              break;
            }
          }
        }

        // Everything at or after cutoff should be byte-for-byte identical
        for (let i = cutoffIdx; i < messages.length; i++) {
          assert.deepEqual(pruned[i], messages[i]);
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("P3: stubs are shorter — pruned content is never longer than original", () => {
    fc.assert(
      fc.property(arbConversation(6, 12), arbConfig, (messages, config) => {
        const { messages: pruned } = prune(messages, config);

        for (let i = 0; i < messages.length; i++) {
          if (messages[i].role === "toolResult") {
            const original = messages[i] as ToolResultMessage;
            const result = pruned[i] as ToolResultMessage;
            const origLen = getContentLength(original);
            const resultLen = getContentLength(result);
            assert.ok(
              resultLen <= origLen,
              `Stub at index ${i} is longer: ${resultLen} > ${origLen}`
            );
          }
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("P4: non-toolResult messages are never modified", () => {
    fc.assert(
      fc.property(arbConversation(3, 12), arbConfig, (messages, config) => {
        const { messages: pruned } = prune(messages, config);

        for (let i = 0; i < messages.length; i++) {
          if (messages[i].role !== "toolResult") {
            assert.deepEqual(pruned[i], messages[i]);
          }
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("P5: idempotent — pruning already-pruned messages yields same result", () => {
    fc.assert(
      fc.property(arbConversation(6, 12), arbConfig, (messages, config) => {
        const first = prune(messages, config);
        const second = prune(first.messages, config);
        assert.deepEqual(second.messages, first.messages);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("P6: charsSaved consistency — equals sum of (original - stub) for each pruned msg", () => {
    fc.assert(
      fc.property(arbConversation(6, 12), arbConfig, (messages, config) => {
        const { messages: pruned, stats } = prune(messages, config);

        let computedSavings = 0;
        for (let i = 0; i < messages.length; i++) {
          if (messages[i].role === "toolResult") {
            const origLen = getContentLength(messages[i] as ToolResultMessage);
            const prunedLen = getContentLength(pruned[i] as ToolResultMessage);
            if (origLen !== prunedLen) {
              computedSavings += origLen - prunedLen;
            }
          }
        }

        assert.equal(stats.charsSaved, computedSavings);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("P7: stats arithmetic — pruned + kept === totalToolResults", () => {
    fc.assert(
      fc.property(arbConversation(3, 12), arbConfig, (messages, config) => {
        const { stats } = prune(messages, config);
        assert.equal(stats.pruned + stats.kept, stats.totalToolResults);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});
