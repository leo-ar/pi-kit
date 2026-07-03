/**
 * context-pruner — reduces context tokens by stubbing stale tool results.
 *
 * Hooks the `context` event (fires before every LLM call) and replaces old
 * tool results with lightweight stubs. The session is never modified — only
 * the in-flight context copy is altered.
 *
 * Value: ~11-17% context token reduction per turn (stacks with RTK's 8.5%).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  prune,
  DEFAULT_CONFIG,
  type PrunerConfig,
  type AnyMessage,
} from "./pruning.ts";
import {
  CONTEXT_PRUNER_STATE_TYPE,
  loadContextPrunerState,
} from "./persistence.ts";

export default function contextPruner(pi: ExtensionAPI) {
  let config: PrunerConfig = { ...DEFAULT_CONFIG };
  let totalSaved = 0;
  let totalCalls = 0;
  let lastStats = { totalMessages: 0, toolResults: 0, pruned: 0 };

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${Math.floor(bytes)}B`;
    if (bytes < 1024 * 1024) return `${Math.floor(bytes / 1024)}KB`;
    return `${Math.floor(bytes / (1024 * 1024))}MB`;
  }

  function updateStatus(ctx: { ui: { setStatus(key: string, text: string): void } }) {
    const saved = formatBytes(totalSaved);
    ctx.ui.setStatus("prune-stats", `🪓 ${saved}`);
  }

  function persistState() {
    pi.appendEntry(CONTEXT_PRUNER_STATE_TYPE, {
      version: 1,
      totalSaved,
      totalCalls,
    });
  }

  pi.on("session_start", (_event, ctx) => {
    const restored = loadContextPrunerState(ctx.sessionManager.getEntries());
    totalSaved = restored?.totalSaved ?? 0;
    totalCalls = restored?.totalCalls ?? 0;
    updateStatus(ctx);
  });

  // ─── Context Event: prune stale tool results ─────────────────────────────

  pi.on("context", (event, ctx) => {
    const messages = event.messages as AnyMessage[];
    const { messages: pruned, stats } = prune(messages, config);

    totalCalls++;
    totalSaved += stats.charsSaved;
    lastStats = {
      totalMessages: messages.length,
      toolResults: stats.totalToolResults,
      pruned: stats.pruned,
    };

    updateStatus(ctx);
    persistState();

    return { messages: pruned };
  });

  // ─── Command: /prune-stats ───────────────────────────────────────────────

  pi.registerCommand("prune-stats", {
    description: "Show context pruning statistics for this session",
    handler: async (_args, ctx) => {
      if (totalCalls === 0) {
        ctx.ui.notify("No context events fired yet — send a message first");
        return;
      }
      const kbSaved = (totalSaved / 1024).toFixed(1);
      const tokensSaved = Math.round(totalSaved / 4);
      ctx.ui.notify(
        `🪓 **${kbSaved}KB** saved (~${tokensSaved.toLocaleString()} tokens) over ${totalCalls} LLM calls`,
      );
    },
  });

}
