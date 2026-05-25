/**
 * Lightweight EESV-inspired compaction extension.
 *
 * Replaces pi's default compaction with a structured pipeline:
 *   1. Extract — deterministic fact extraction from messages (zero LLM calls)
 *   2. Synthesize — single LLM call with extracted facts as structured context
 *   3. Verify — deterministic check that critical facts appear in summary
 *
 * Architecture: generator-effects pattern.
 *   - pipeline.ts: pure generator yielding effect descriptions
 *   - This file: thin imperative runner interpreting effects with real I/O
 *
 * Usage: place in ~/.pi/agent/extensions/smart-compact/ or install as package
 */

import { complete } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

import { extractFacts } from "./extraction.ts";
import { compactPipeline } from "./pipeline.ts";
import type { CompactEffect } from "./pipeline.ts";

// ─── Extension Entry Point ───────────────────────────────────────────────────

export default function smartCompact(pi: ExtensionAPI) {
  pi.on("session_before_compact", async (event, ctx) => {
    const { preparation, signal } = event;
    const { messagesToSummarize, turnPrefixMessages, tokensBefore, firstKeptEntryId, previousSummary } = preparation;

    // Combine all messages to summarize
    const allMessages = [...messagesToSummarize, ...turnPrefixMessages];
    if (allMessages.length === 0) return;

    // Convert to LLM format for the pipeline
    const llmMessages = convertToLlm(allMessages);

    // Estimate conversation budget: leave room for prompt overhead + output
    const model = ctx.model;
    const contextWindow = model?.contextWindow ?? 128000;
    const maxConversationChars = (contextWindow - 8000) * 3;

    // Run the pipeline generator as an imperative shell
    const gen = compactPipeline({
      messages: llmMessages,
      tokensBefore,
      firstKeptEntryId,
      previousSummary,
      maxConversationChars,
    });

    let step = gen.next();

    while (!step.done) {
      const effect = step.value as CompactEffect;
      let response: unknown;

      switch (effect.tag) {
        case "get_model":
          response = ctx.model;
          break;

        case "get_auth": {
          const authResult = await ctx.modelRegistry.getApiKeyAndHeaders(effect.model as any);
          response = authResult.ok
            ? { ok: true, apiKey: authResult.apiKey, headers: authResult.headers }
            : { ok: false };
          break;
        }

        case "notify":
          ctx.ui.notify(effect.message, effect.level);
          response = undefined;
          break;

        case "serialize":
          response = serializeConversation(effect.messages as any);
          break;

        case "llm_complete": {
          try {
            const result = await complete(
              effect.model as any,
              {
                messages: [
                  {
                    role: "user" as const,
                    content: [{ type: "text" as const, text: effect.prompt }],
                    timestamp: Date.now(),
                  },
                ],
              },
              {
                apiKey: effect.apiKey,
                headers: effect.headers,
                maxTokens: 6000,
                signal,
                reasoningEffort: "low",
              },
            );

            response = result.content
              .filter((c): c is { type: "text"; text: string } => c.type === "text")
              .map((c) => c.text)
              .join("\n");
          } catch (error) {
            if (signal.aborted) return;
            const message = error instanceof Error ? error.message : String(error);
            ctx.ui.notify(`smart-compact: ${message}, using default compaction`, "error");
            return;
          }
          break;
        }
      }

      step = gen.next(response);
    }

    // Generator returned a CompactionOutput or undefined
    const output = step.value;
    if (!output) return;

    return {
      compaction: {
        summary: output.summary,
        firstKeptEntryId: output.firstKeptEntryId,
        tokensBefore: output.tokensBefore,
      },
    };
  });

  pi.registerCommand("compact-stats", {
    description: "Show what smart-compact would extract from the current session",
    handler: async (_args, ctx) => {
      const branch = ctx.sessionManager.getBranch();
      const agentMessages = branch
        .filter((e): e is { type: "message"; message: any } => e.type === "message")
        .map((e) => e.message);

      if (agentMessages.length === 0) {
        ctx.ui.notify("No messages in session", "info");
        return;
      }

      const messages = convertToLlm(agentMessages);
      const extraction = extractFacts(messages);
      const lines = [
        `**Goal:** ${extraction.goal || "(none detected)"}`,
        `**Files modified:** ${extraction.files.modified.size}`,
        `**Files read:** ${extraction.files.read.size}`,
        `**Errors:** ${extraction.errors.length}`,
        `**Decisions:** ${extraction.decisions.length}`,
        `**Constraints:** ${extraction.constraints.length}`,
        "",
        extraction.files.modified.size > 0
          ? `Modified: ${[...extraction.files.modified].slice(-10).join(", ")}`
          : "",
        extraction.errors.length > 0
          ? `Last error: ${extraction.errors[extraction.errors.length - 1]}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      ctx.ui.notify(lines, "info");
    },
  });
}
