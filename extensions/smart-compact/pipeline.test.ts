/**
 * Pipeline tests — step through the generator with scripted responses.
 *
 * Uses the script-runner pattern from generators-as-effect-systems:
 * each test provides [expected effect subset, response] pairs.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compactPipeline } from "./pipeline.ts";
import type { CompactEffect, PipelineInput } from "./pipeline.ts";
import type { Message } from "./extraction.ts";

// ─── Test Helpers ────────────────────────────────────────────────────────────

type Script = Array<[Partial<CompactEffect>, unknown]>;

function matchesSubset(obj: Record<string, unknown>, subset: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(subset)) {
    assert.deepStrictEqual(
      (obj as any)[key],
      value,
      `Effect mismatch on key "${key}": expected ${JSON.stringify(value)}, got ${JSON.stringify((obj as any)[key])}`,
    );
  }
}

function runScript(gen: Generator<CompactEffect, any, any>, script: Script): any {
  let i = 0;
  let result = gen.next();
  while (!result.done) {
    if (i >= script.length) {
      throw new Error(`Generator yielded more effects than script provides (${script.length} entries). Extra effect: ${JSON.stringify(result.value)}`);
    }
    const [expectedEffect, response] = script[i++];
    matchesSubset(result.value as any, expectedEffect as any);
    result = gen.next(response);
  }
  if (i < script.length) {
    throw new Error(`Generator finished early — ${script.length - i} unused script entries`);
  }
  return result.value;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const fakeModel = { id: "test-model", contextWindow: 128000 };

const basicMessages: Message[] = [
  { role: "user", content: [{ type: "text", text: "Refactor the auth module to use JWT tokens" }] },
  {
    role: "assistant",
    content: [
      { type: "text", text: "I'll update the auth module." },
      { type: "toolCall", name: "edit", arguments: { path: "src/auth.ts" } },
    ],
  },
  { role: "toolResult", content: [{ type: "text", text: "OK" }] },
];

const basicInput: PipelineInput = {
  messages: basicMessages,
  tokensBefore: 50000,
  firstKeptEntryId: "entry-123",
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("compactPipeline — script runner", () => {
  it("returns undefined for empty messages", () => {
    const result = runScript(
      compactPipeline({ messages: [], tokensBefore: 0, firstKeptEntryId: "x" }),
      [],
    );
    assert.strictEqual(result, undefined);
  });

  it("returns undefined when no model available", () => {
    const result = runScript(compactPipeline(basicInput), [
      [{ tag: "get_model" }, null],
      [{ tag: "notify", level: "warning" }, undefined],
    ]);
    assert.strictEqual(result, undefined);
  });

  it("returns undefined when auth fails", () => {
    const result = runScript(compactPipeline(basicInput), [
      [{ tag: "get_model" }, fakeModel],
      [{ tag: "get_auth" }, { ok: false }],
      [{ tag: "notify", level: "warning" }, undefined],
    ]);
    assert.strictEqual(result, undefined);
  });

  it("returns undefined when LLM returns empty", () => {
    const result = runScript(compactPipeline(basicInput), [
      [{ tag: "get_model" }, fakeModel],
      [{ tag: "get_auth" }, { ok: true, apiKey: "sk-test", headers: {} }],
      [{ tag: "serialize" }, "User: Refactor...\nAssistant: I'll update..."],
      [{ tag: "notify", level: "info" }, undefined],
      [{ tag: "llm_complete" }, ""],
      [{ tag: "notify", level: "warning" }, undefined],
    ]);
    assert.strictEqual(result, undefined);
  });

  it("successful compaction returns summary with file tags", () => {
    const llmSummary = "## Goal\nRefactor auth to JWT\n\n## Progress\n- [x] Updated src/auth.ts";

    const result = runScript(compactPipeline(basicInput), [
      [{ tag: "get_model" }, fakeModel],
      [{ tag: "get_auth" }, { ok: true, apiKey: "sk-test", headers: {} }],
      [{ tag: "serialize" }, "User: Refactor...\nAssistant: I'll update..."],
      [{ tag: "notify", level: "info" }, undefined],
      [{ tag: "llm_complete" }, llmSummary],
    ]);

    assert(result !== undefined);
    assert.strictEqual(result.firstKeptEntryId, "entry-123");
    assert.strictEqual(result.tokensBefore, 50000);
    assert(result.summary.includes("## Goal"));
    assert(result.summary.includes("<modified-files>"));
    assert(result.summary.includes("src/auth.ts"));
  });

  it("patches summary when LLM misses a modified file", () => {
    // LLM output doesn't mention auth.ts at all
    const llmSummary = "## Goal\nDo something\n\n## Progress\n- [x] Done";

    const result = runScript(compactPipeline(basicInput), [
      [{ tag: "get_model" }, fakeModel],
      [{ tag: "get_auth" }, { ok: true, apiKey: "sk-test", headers: {} }],
      [{ tag: "serialize" }, "conversation text"],
      [{ tag: "notify", level: "info" }, undefined],
      [{ tag: "llm_complete" }, llmSummary],
    ]);

    assert(result !== undefined);
    // File tags are always appended (this is how pi tracks files)
    assert(result.summary.includes("<modified-files>\nsrc/auth.ts\n</modified-files>"));
  });

  it("caps conversation text when maxConversationChars is set", () => {
    const input: PipelineInput = {
      ...basicInput,
      maxConversationChars: 50,
    };

    let capturedPrompt = "";
    const gen = compactPipeline(input);

    // Step through manually to inspect the prompt
    let step = gen.next(); // get_model
    step = gen.next(fakeModel); // get_auth
    step = gen.next({ ok: true, apiKey: "sk-test", headers: {} }); // serialize
    // Return a long conversation text
    const longText = "x".repeat(200);
    step = gen.next(longText); // notify
    step = gen.next(undefined); // llm_complete
    // Inspect the prompt in the llm_complete effect
    capturedPrompt = (step.value as any).prompt;
    assert(!capturedPrompt.includes("x".repeat(200)), "Should have been capped");
    assert(capturedPrompt.includes("x".repeat(50)), "Should contain capped text");
  });

  it("includes previousSummary in prompt when provided", () => {
    const input: PipelineInput = {
      ...basicInput,
      previousSummary: "## Previous context\nWe were working on auth",
    };

    const gen = compactPipeline(input);
    let step = gen.next(); // get_model
    step = gen.next(fakeModel); // get_auth
    step = gen.next({ ok: true, apiKey: "sk-test", headers: {} }); // serialize
    step = gen.next("conversation"); // notify
    step = gen.next(undefined); // llm_complete

    const prompt = (step.value as any).prompt as string;
    assert(prompt.includes("<previous-summary>"));
    assert(prompt.includes("We were working on auth"));
  });

  it("uses precomputedFileOps when provided, overriding extraction", () => {
    const input: PipelineInput = {
      ...basicInput,
      precomputedFileOps: {
        read: new Set(["config.json"]),
        written: new Set(["dist/output.js"]),
        edited: new Set(["src/main.ts"]),
      },
    };

    // LLM summary mentions the precomputed files
    const llmSummary = "## Goal\nBuild output\n\nModified dist/output.js and src/main.ts";

    const result = runScript(compactPipeline(input), [
      [{ tag: "get_model" }, fakeModel],
      [{ tag: "get_auth" }, { ok: true, apiKey: "sk-test", headers: {} }],
      [{ tag: "serialize" }, "conversation"],
      [{ tag: "notify", level: "info" }, undefined],
      [{ tag: "llm_complete" }, llmSummary],
    ]);

    assert(result !== undefined);
    // Should use precomputed files, not re-extracted ones
    assert(result.summary.includes("<modified-files>"));
    assert(result.summary.includes("dist/output.js"));
    assert(result.summary.includes("src/main.ts"));
    assert(result.summary.includes("<read-files>"));
    assert(result.summary.includes("config.json"));
    // Original extracted file (src/auth.ts) should NOT be in modified
    assert(!result.summary.includes("src/auth.ts"));
  });

  it("adds in-progress turn section when isSplitTurn with turnPrefixMessages", () => {
    const turnMessages: Message[] = [
      { role: "user", content: [{ type: "text", text: "Now let's add error handling to the parser" }] },
      {
        role: "assistant",
        content: [
          { type: "toolCall", name: "edit", arguments: { path: "src/parser.ts" } },
        ],
      },
      { role: "toolResult", isError: true, content: [{ type: "text", text: "SyntaxError: unexpected token" }] },
    ];

    const input: PipelineInput = {
      ...basicInput,
      isSplitTurn: true,
      turnPrefixMessages: turnMessages,
    };

    const llmSummary = "## Goal\nRefactor auth\n\n## Progress\n- [x] Updated src/auth.ts";

    const result = runScript(compactPipeline(input), [
      [{ tag: "get_model" }, fakeModel],
      [{ tag: "get_auth" }, { ok: true, apiKey: "sk-test", headers: {} }],
      [{ tag: "serialize" }, "conversation"],
      [{ tag: "notify", level: "info" }, undefined],
      [{ tag: "llm_complete" }, llmSummary],
    ]);

    assert(result !== undefined);
    assert(result.summary.includes("## In-Progress Turn"));
    assert(result.summary.includes("src/parser.ts"));
    assert(result.summary.includes("SyntaxError"));
  });

  it("does not add in-progress turn section when isSplitTurn is false", () => {
    const input: PipelineInput = {
      ...basicInput,
      isSplitTurn: false,
    };

    const llmSummary = "## Goal\nRefactor auth\n\n## Progress\n- [x] Updated src/auth.ts";

    const result = runScript(compactPipeline(input), [
      [{ tag: "get_model" }, fakeModel],
      [{ tag: "get_auth" }, { ok: true, apiKey: "sk-test", headers: {} }],
      [{ tag: "serialize" }, "conversation"],
      [{ tag: "notify", level: "info" }, undefined],
      [{ tag: "llm_complete" }, llmSummary],
    ]);

    assert(result !== undefined);
    assert(!result.summary.includes("## In-Progress Turn"));
  });
});
