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
import { prune, DEFAULT_CONFIG, type PrunerConfig, type AnyMessage } from "./pruning.ts";

export default function contextPruner(pi: ExtensionAPI) {
  let config: PrunerConfig = { ...DEFAULT_CONFIG };
  let totalSaved = 0;
  let totalCalls = 0;
  let lastStats = { totalMessages: 0, toolResults: 0, pruned: 0 };

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

    function formatBytes(bytes: number): string {
      if (bytes < 1024) return `${Math.floor(bytes)}B`;
      if (bytes < 1024 * 1024) return `${Math.floor(bytes / 1024)}KB`;
      return `${Math.floor(bytes / (1024 * 1024))}MB`;
    }

    const saved = formatBytes(totalSaved);
    ctx.ui.setStatus(
      "prune-stats",
      `🪓 ${saved} K${config.recentTurnsToKeep}`
    );

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

      const lines = [
        `🪓 **${kbSaved}KB** saved (~${tokensSaved.toLocaleString()} tokens) over ${totalCalls} LLM calls`,
        ``,
        `Last call: ${lastStats.pruned}/${lastStats.toolResults} tool results pruned (${lastStats.totalMessages} messages)`,
        `Config: K${config.recentTurnsToKeep}, min ${config.minSizeToStub} chars`,
      ];

      pi.sendMessage({
        customType: "prune-stats",
        content: lines.join("\n"),
        display: true,
      });
    },
  });

  // ─── Command: /prune-keep ──────────────────────────────────────────────

  pi.registerCommand("prune-keep", {
    description: "Set how many recent turns to keep unpruned",
    handler: async (args, ctx) => {
      if (!args || !args.trim()) {
        ctx.ui.notify(`K${config.recentTurnsToKeep} — keeping ${config.recentTurnsToKeep} recent turns`);
        return;
      }
      const num = Number(args.trim());
      if (isNaN(num) || num < 1) {
        ctx.ui.notify(`Invalid: "${args.trim()}" — use a positive number`);
        return;
      }
      config.recentTurnsToKeep = Math.round(num);
      ctx.ui.notify(`K${config.recentTurnsToKeep} — keeping ${config.recentTurnsToKeep} recent turns`);
    },
  });

  // ─── Command: /prune-config ──────────────────────────────────────────────

  pi.registerCommand("prune-config", {
    description: "Adjust context pruner settings",
    handler: async (args, ctx) => {
      if (!args || !args.trim()) {
        const lines = Object.entries(config).map(([k, v]) => `${k}: ${v}`);
        ctx.ui.notify(lines.join(", "));
        return;
      }
      const parts = args.trim().split(/\s+/);
      const key = parts[0];
      const value = parts.slice(1).join(" ");
      if (!(key in config)) {
        ctx.ui.notify(`Unknown key: "${key}"`);
        return;
      }
      if (!value) {
        ctx.ui.notify(`${key} = ${config[key as keyof PrunerConfig]}`);
        return;
      }
      const current = config[key as keyof PrunerConfig];
      if (typeof current === "number") {
        const num = Number(value);
        if (isNaN(num)) {
          ctx.ui.notify(`Invalid number: "${value}"`);
          return;
        }
        (config as Record<string, unknown>)[key] = num;
      } else if (typeof current === "boolean") {
        (config as Record<string, unknown>)[key] = value === "true" || value === "1";
      }
      ctx.ui.notify(`${key} = ${(config as Record<string, unknown>)[key]}`);
    },
  });
}
