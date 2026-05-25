/**
 * Benchmark script for context-pruner.
 *
 * Reads existing session files (read-only), simulates the context window
 * at each agent turn, and measures how much prune() would save.
 *
 * Compares K5 vs K10 vs no-pruning.
 *
 * Usage:
 *   node --experimental-strip-types extensions/context-pruner/bench.ts
 *   node --experimental-strip-types extensions/context-pruner/bench.ts --verbose
 *   node --experimental-strip-types extensions/context-pruner/bench.ts --limit=10
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { prune, DEFAULT_CONFIG, type PrunerConfig, type AnyMessage } from "./pruning.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SessionEntry {
  type: string;
  id: string;
  message?: {
    role: string;
    content: unknown;
    toolCallId?: string;
    toolName?: string;
    isError?: boolean;
    timestamp?: number;
  };
}

interface SessionResult {
  file: string;
  totalMessages: number;
  userTurns: number;
  slices: SliceResult[];
}

interface SliceResult {
  turnIndex: number;
  messageCount: number;
  totalToolResults: number;
  totalChars: number;
  configs: Record<string, ConfigResult>;
}

interface ConfigResult {
  pruned: number;
  charsSaved: number;
  pctSaved: number;
}

// ─── Session Parsing ─────────────────────────────────────────────────────────

const SESSIONS_DIR = join(homedir(), ".pi/agent/sessions");

function findSessionFiles(): string[] {
  const results: string[] = [];
  for (const dir of readdirSync(SESSIONS_DIR)) {
    const fullDir = join(SESSIONS_DIR, dir);
    if (!statSync(fullDir).isDirectory()) continue;
    for (const file of readdirSync(fullDir)) {
      if (file.endsWith(".jsonl")) {
        results.push(join(fullDir, file));
      }
    }
  }
  return results;
}

function parseSessionMessages(filePath: string): AnyMessage[] {
  const content = readFileSync(filePath, "utf-8");
  const entries: SessionEntry[] = content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter(Boolean);

  const messages: AnyMessage[] = [];
  for (const entry of entries) {
    if (entry.type !== "message" || !entry.message) continue;
    const msg = entry.message;

    if (msg.role === "assistant") {
      messages.push({
        role: "assistant",
        content: Array.isArray(msg.content) ? msg.content : [{ type: "text", text: String(msg.content) }],
      } as AnyMessage);
    } else if (msg.role === "user") {
      messages.push({
        role: "user",
        content: msg.content,
        timestamp: msg.timestamp ?? Date.now(),
      } as AnyMessage);
    } else if (msg.role === "toolResult") {
      messages.push({
        role: "toolResult",
        toolCallId: msg.toolCallId ?? "",
        toolName: msg.toolName ?? "",
        content: Array.isArray(msg.content) ? msg.content : [{ type: "text", text: String(msg.content) }],
        isError: msg.isError ?? false,
        timestamp: msg.timestamp ?? Date.now(),
      } as AnyMessage);
    }
  }
  return messages;
}

// ─── Benchmark Logic ─────────────────────────────────────────────────────────

const CONFIGS: Record<string, PrunerConfig> = {
  "K10": { ...DEFAULT_CONFIG, recentTurnsToKeep: 10 },
  "K5": { ...DEFAULT_CONFIG, recentTurnsToKeep: 5 },
  "K3": { ...DEFAULT_CONFIG, recentTurnsToKeep: 3 },
};

function getTotalChars(messages: AnyMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    if (msg.role === "toolResult") {
      const tm = msg as { content: { text?: string }[] };
      if (Array.isArray(tm.content)) {
        for (const block of tm.content) {
          total += block.text?.length ?? 0;
        }
      }
    } else if (msg.role === "assistant") {
      const am = msg as { content: { type: string; text?: string }[] };
      if (Array.isArray(am.content)) {
        for (const block of am.content) {
          if (block.type === "text") total += block.text?.length ?? 0;
        }
      }
    } else if (msg.role === "user") {
      const um = msg as { content: unknown };
      if (typeof um.content === "string") total += um.content.length;
      else if (Array.isArray(um.content)) {
        for (const block of um.content as { text?: string }[]) {
          total += block.text?.length ?? 0;
        }
      }
    }
  }
  return total;
}

/**
 * Simulate pruning at each "agent turn" in the session.
 * An agent turn = every time a user message appears, we run prune on all messages up to that point.
 * We sample every Nth user turn to keep it fast.
 */
function benchSession(filePath: string, sampleEvery = 3): SessionResult {
  const messages = parseSessionMessages(filePath);

  // Find user turn boundaries
  const userTurnIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "user") userTurnIndices.push(i);
  }

  const slices: SliceResult[] = [];

  for (let t = 0; t < userTurnIndices.length; t++) {
    // Sample: skip early turns (not enough context) and sample every Nth
    if (t < 5) continue;
    if (t % sampleEvery !== 0) continue;

    // Context = all messages up to (and including) this user turn
    const contextEnd = t + 1 < userTurnIndices.length
      ? userTurnIndices[t + 1]
      : messages.length;
    const context = messages.slice(0, contextEnd);

    const totalChars = getTotalChars(context);
    const toolResults = context.filter(m => m.role === "toolResult").length;

    const configs: Record<string, ConfigResult> = {};
    for (const [name, config] of Object.entries(CONFIGS)) {
      const { stats } = prune(context, config);
      configs[name] = {
        pruned: stats.pruned,
        charsSaved: stats.charsSaved,
        pctSaved: totalChars > 0 ? (stats.charsSaved / totalChars) * 100 : 0,
      };
    }

    slices.push({
      turnIndex: t,
      messageCount: context.length,
      totalToolResults: toolResults,
      totalChars,
      configs,
    });
  }

  return {
    file: basename(filePath),
    totalMessages: messages.length,
    userTurns: userTurnIndices.length,
    slices,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose") || args.includes("-v");
  const limit = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "0") || Infinity;

  console.log("🪓 Context Pruner Benchmark\n");
  console.log("Scanning sessions...\n");

  const sessionFiles = findSessionFiles();
  const results: SessionResult[] = [];

  for (const file of sessionFiles) {
    if (results.length >= limit) break;
    const messages = parseSessionMessages(file);
    // Skip short sessions (< 10 user turns)
    const userTurns = messages.filter(m => m.role === "user").length;
    if (userTurns < 10) continue;
    results.push(benchSession(file));
  }

  if (results.length === 0) {
    console.log("No sessions with 10+ user turns found.");
    return;
  }

  // ─── Aggregate ─────────────────────────────────────────────────────────────

  const allSlices = results.flatMap(r => r.slices);
  const totalSessions = results.length;
  const totalSlices = allSlices.length;
  const totalMessages = results.reduce((s, r) => s + r.totalMessages, 0);

  // Per-config aggregates
  const configNames = Object.keys(CONFIGS);
  const aggregates: Record<string, { totalSaved: number; totalChars: number; avgPct: number }> = {};

  for (const name of configNames) {
    const totalSaved = allSlices.reduce((s, sl) => s + sl.configs[name].charsSaved, 0);
    const totalChars = allSlices.reduce((s, sl) => s + sl.totalChars, 0);
    const avgPct = allSlices.length > 0
      ? allSlices.reduce((s, sl) => s + sl.configs[name].pctSaved, 0) / allSlices.length
      : 0;
    aggregates[name] = { totalSaved, totalChars, avgPct };
  }

  // ─── Report ────────────────────────────────────────────────────────────────

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Context Pruner — Savings Analysis");
  console.log("═══════════════════════════════════════════════════════════════\n");
  console.log(`  Sessions analyzed:  ${totalSessions}`);
  console.log(`  Total messages:     ${totalMessages.toLocaleString()}`);
  console.log(`  Measurement slices: ${totalSlices}\n`);

  console.log("  ┌──────────┬──────────────┬──────────────┬──────────┐");
  console.log("  │  Config  │  Total Saved │  Avg Saved   │  Avg %   │");
  console.log("  ├──────────┼──────────────┼──────────────┼──────────┤");
  for (const name of configNames) {
    const agg = aggregates[name];
    const totalKB = (agg.totalSaved / 1024).toFixed(0);
    const avgKB = (agg.totalSaved / totalSlices / 1024).toFixed(1);
    const pct = agg.avgPct.toFixed(1);
    console.log(`  │  ${name.padEnd(6)}  │  ${(totalKB + " KB").padEnd(10)}  │  ${(avgKB + " KB/call").padEnd(10)}  │  ${(pct + "%").padStart(6)}  │`);
  }
  console.log("  └──────────┴──────────────┴──────────────┴──────────┘\n");

  // Savings progression (how savings grow with session length)
  if (verbose) {
    console.log("─── Per-Session Details ─────────────────────────────────────\n");
    for (const r of results) {
      if (r.slices.length === 0) continue;
      const lastSlice = r.slices[r.slices.length - 1];
      console.log(`  ${r.file} (${r.userTurns} turns, ${r.totalMessages} msgs)`);
      for (const name of configNames) {
        const cfg = lastSlice.configs[name];
        console.log(`    ${name}: ${cfg.pruned} pruned, ${(cfg.charsSaved / 1024).toFixed(1)}KB saved (${cfg.pctSaved.toFixed(1)}%)`);
      }
      console.log();
    }

    // Savings curve: show how % saved grows with turn count
    console.log("─── Savings Curve (avg % saved by turn index) ──────────────\n");
    const turnBuckets = new Map<number, { count: number; pctK5: number; pctK10: number }>();
    for (const slice of allSlices) {
      const bucket = Math.floor(slice.turnIndex / 5) * 5;
      const existing = turnBuckets.get(bucket) || { count: 0, pctK5: 0, pctK10: 0 };
      existing.count++;
      existing.pctK5 += slice.configs["K5"].pctSaved;
      existing.pctK10 += slice.configs["K10"].pctSaved;
      turnBuckets.set(bucket, existing);
    }

    const sortedBuckets = [...turnBuckets.entries()].sort((a, b) => a[0] - b[0]);
    for (const [bucket, data] of sortedBuckets) {
      const avgK5 = (data.pctK5 / data.count).toFixed(1);
      const avgK10 = (data.pctK10 / data.count).toFixed(1);
      const bar5 = "█".repeat(Math.round(data.pctK5 / data.count));
      const bar10 = "░".repeat(Math.round(data.pctK10 / data.count));
      console.log(`  Turn ${String(bucket).padStart(3)}-${String(bucket + 4).padStart(3)}: K5 ${avgK5.padStart(5)}% ${bar5}  K10 ${avgK10.padStart(5)}% ${bar10}`);
    }
    console.log();
  }

  // Verdict
  const k5Pct = aggregates["K5"].avgPct;
  const k10Pct = aggregates["K10"].avgPct;
  console.log("─── Verdict ────────────────────────────────────────────────────\n");
  console.log(`  K5 saves ${k5Pct.toFixed(1)}% avg context per LLM call`);
  console.log(`  K10 saves ${k10Pct.toFixed(1)}% avg context per LLM call`);
  console.log(`  Difference: K5 saves ${(k5Pct - k10Pct).toFixed(1)}% more than K10\n`);

  if (k5Pct > 10) {
    console.log("  ✅ Significant savings. Context pruner is pulling its weight.");
  } else if (k5Pct > 5) {
    console.log("  ⚠️  Moderate savings. Useful for long sessions.");
  } else {
    console.log("  ℹ️  Marginal savings. Most value in very long sessions.");
  }
  console.log();
}

main();
