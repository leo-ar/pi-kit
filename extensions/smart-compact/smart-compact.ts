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
import { convertToLlm, DynamicBorder, getMarkdownTheme, serializeConversation } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, matchesKey, Text } from "@earendil-works/pi-tui";

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

      const modifiedList = [...extraction.files.modified].slice(-15);
      const readList = [...extraction.files.read].slice(-10);

      const md = [
        `## Extraction Stats`,
        "",
        `**Goal:** ${extraction.goal || "(none detected)"}`,
        "",
        `### Files`,
        `| Type | Count |`,
        `|------|-------|`,
        `| Modified | ${extraction.files.modified.size} |`,
        `| Read-only | ${extraction.files.read.size} |`,
        "",
        modifiedList.length > 0
          ? `**Modified:**\n${modifiedList.map((f) => `- \`${f}\``).join("\n")}`
          : "",
        readList.length > 0
          ? `\n**Read-only:**\n${readList.map((f) => `- \`${f}\``).join("\n")}`
          : "",
        "",
        `### Signals`,
        `| Type | Count |`,
        `|------|-------|`,
        `| Errors | ${extraction.errors.length} |`,
        `| Decisions | ${extraction.decisions.length} |`,
        `| Constraints | ${extraction.constraints.length} |`,
        "",
        extraction.errors.length > 0
          ? `**Recent errors:**\n${extraction.errors.slice(-3).map((e) => `- ${e}`).join("\n")}`
          : "",
        extraction.decisions.length > 0
          ? `\n**Decisions:**\n${extraction.decisions.slice(-5).map((d) => `- ${d}`).join("\n")}`
          : "",
        extraction.constraints.length > 0
          ? `\n**Constraints:**\n${extraction.constraints.map((c) => `- ${c}`).join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      await ctx.ui.custom((_tui, theme, _kb, done) => {
        const container = new Container();
        const border = new DynamicBorder((s: string) => theme.fg("accent", s));
        const mdTheme = getMarkdownTheme();

        container.addChild(border);
        container.addChild(new Text(theme.fg("accent", theme.bold("smart-compact extraction")), 1, 0));
        container.addChild(new Markdown(md, 1, 1, mdTheme));
        container.addChild(new Text(theme.fg("dim", "Press Enter or Esc to close"), 1, 0));
        container.addChild(border);

        return {
          render: (width: number) => container.render(width),
          invalidate: () => container.invalidate(),
          handleInput: (data: string) => {
            if (matchesKey(data, "enter") || matchesKey(data, "escape")) {
              done(undefined);
            }
          },
        };
      });
    },
  });
}
