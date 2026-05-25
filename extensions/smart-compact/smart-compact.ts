/**
 * smart-compact — structured, verifiable compaction for pi.
 *
 * Replaces pi's default compaction with a three-phase pipeline:
 *   1. Extract — deterministic fact extraction (files, errors, decisions)
 *   2. Synthesize — single LLM call with extracted facts as structured context
 *   3. Verify — catches critical errors pi's default drops (~72% recovery)
 *
 * Architecture: generator-effects in pipeline.ts, thin runner here.
 *
 * Value over pi's default:
 *   - Critical error retention (timeouts, rate limits, crashes)
 *   - Consistent structure across iterative re-compactions
 *   - Lower cost (reasoningEffort: "low" + conversation cap)
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
    const { messagesToSummarize, turnPrefixMessages, tokensBefore, firstKeptEntryId, previousSummary, isSplitTurn, fileOps } = preparation;

    // Combine all messages to summarize
    const allMessages = [...messagesToSummarize, ...turnPrefixMessages];
    if (allMessages.length === 0) return;

    // Convert to LLM format for the pipeline
    const llmMessages = convertToLlm(allMessages);
    const llmTurnPrefixMessages = isSplitTurn ? convertToLlm(turnPrefixMessages) : undefined;

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
      precomputedFileOps: fileOps,
      isSplitTurn,
      turnPrefixMessages: llmTurnPrefixMessages,
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


      const summary = [
        `${extraction.files.modified.size} modified`,
        `${extraction.files.read.size} read`,
        `${extraction.errors.length} errors`,
        `${extraction.decisions.length} decisions`,
        extraction.goal ? `goal: ${extraction.goal.slice(0, 60)}` : null,
      ].filter(Boolean).join(", ");

      ctx.ui.notify(summary);
    },
  });
}
