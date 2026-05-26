/**
 * bench.ts — Benchmark read-outline against real pi sessions (READ-ONLY).
 *
 * Scans all sessions in ~/.pi/agent/sessions/, finds `read` tool calls and
 * their results, runs the outline logic, and reports potential savings.
 *
 * Usage: node --import tsx bench.ts [--verbose]
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { LINE_THRESHOLD } from "./src/types.ts";
import { isSupportedFile } from "./src/utils.ts";
import { generateOutline } from "./src/outline.ts";
import { formatOutlineResult } from "./src/format.ts";

const SESSIONS_DIR = join(homedir(), ".pi", "agent", "sessions");
const verbose = process.argv.includes("--verbose");

interface Stats {
  totalSessions: number;
  totalSessionFiles: number;
  totalReadCalls: number;
  fullFileReads: number;
  supportedFileReads: number;
  aboveThreshold: number;
  outlineProduced: number;
  totalOriginalChars: number;
  totalOutlineChars: number;
  byLanguage: Record<string, { count: number; originalChars: number; outlineChars: number }>;
  fileSizeDistribution: number[];
}

async function main() {
  const stats: Stats = {
    totalSessions: 0,
    totalSessionFiles: 0,
    totalReadCalls: 0,
    fullFileReads: 0,
    supportedFileReads: 0,
    aboveThreshold: 0,
    outlineProduced: 0,
    totalOriginalChars: 0,
    totalOutlineChars: 0,
    byLanguage: {},
    fileSizeDistribution: [],
  };

  // Find session directories
  const entries = await readdir(SESSIONS_DIR);
  const sessionDirs: string[] = [];
  for (const entry of entries) {
    const entryPath = join(SESSIONS_DIR, entry);
    const s = await stat(entryPath).catch(() => null);
    if (s?.isDirectory()) sessionDirs.push(entry);
  }
  stats.totalSessions = sessionDirs.length;

  for (const dir of sessionDirs) {
    const sessionPath = join(SESSIONS_DIR, dir);
    const files = await readdir(sessionPath);
    const jsonlFiles = files.filter(f => f.endsWith(".jsonl"));

    for (const file of jsonlFiles) {
      stats.totalSessionFiles++;
      const content = await readFile(join(sessionPath, file), "utf-8");
      const lines = content.split("\n").filter(l => l.trim());

      // Session format:
      // - Assistant messages contain toolCall blocks with {id, name, arguments}
      // - Followed by separate entries with message.role === "toolResult"
      //   containing the result text (one entry per tool call, in order)
      //
      // Strategy: collect read toolCalls in order, then pair with
      // subsequent toolResult entries sequentially.

      const pendingReadCalls: { id: string; args: Record<string, unknown> }[] = [];
      let resultIdx = 0;

      // First pass: find all read tool calls and all tool results
      type ParsedReadCall = { type: "readCall"; id: string; args: Record<string, unknown> };
      type ParsedToolResult = { type: "toolResult"; text: string };
      type ParsedEntry = ParsedReadCall | ParsedToolResult;

      const parsed: ParsedEntry[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type !== "message") continue;
          const msg = entry.message;
          if (!msg?.content || !Array.isArray(msg.content)) continue;

          if (msg.role === "assistant") {
            for (const block of msg.content) {
              if (block.type === "toolCall" && block.name === "read") {
                stats.totalReadCalls++;
                parsed.push({ type: "readCall", id: block.id, args: block.arguments ?? {} });
              }
            }
          }

          if (msg.role === "toolResult") {
            const textBlock = msg.content.find((b: any) => b.type === "text" && b.text);
            if (textBlock?.text) {
              parsed.push({ type: "toolResult", text: textBlock.text });
            }
          }
        } catch {
          // Skip malformed lines
        }
      }

      // Second pass: pair each readCall with the next toolResult
      // (toolResults appear in the same order as their toolCalls)
      let nextResultForCall = 0;
      const resultEntries = parsed.filter(e => e.type === "toolResult") as { type: "toolResult"; text: string }[];
      const callEntries = parsed.filter(e => e.type === "readCall") as { type: "readCall"; id: string; args: Record<string, unknown> }[];

      // Actually, we need sequential pairing through ALL tool calls (not just read).
      // Since we only record read calls, the results won't align unless we also
      // track non-read tool calls. Let's use a different approach: walk the parsed
      // stream and pair each read call with its immediately following toolResult.

      let pendingRead: { id: string; args: Record<string, unknown> } | null = null;
      for (const entry of parsed) {
        if (entry.type === "readCall") {
          pendingRead = entry;
        } else if (entry.type === "toolResult" && pendingRead) {
          // This result belongs to the pending read call
          const args = pendingRead.args;
          pendingRead = null;

          // Only full-file reads
          if (args.offset !== undefined || args.limit !== undefined) continue;
          stats.fullFileReads++;

          const filePath = (args.path as string) ?? "";
          if (!isSupportedFile(filePath)) continue;
          stats.supportedFileReads++;

          const fileLines = entry.text.split("\n");
          if (fileLines.length <= LINE_THRESHOLD) continue;
          stats.aboveThreshold++;
          stats.fileSizeDistribution.push(fileLines.length);

          // Run outline
          const outline = generateOutline(fileLines, filePath);
          if (outline.length === 0) continue;
          stats.outlineProduced++;

          const outlineText = formatOutlineResult(filePath, fileLines, outline);
          const originalChars = entry.text.length;
          const outlineChars = outlineText.length;

          stats.totalOriginalChars += originalChars;
          stats.totalOutlineChars += outlineChars;

          // Track by language extension
          const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
          if (!stats.byLanguage[ext]) {
            stats.byLanguage[ext] = { count: 0, originalChars: 0, outlineChars: 0 };
          }
          stats.byLanguage[ext].count++;
          stats.byLanguage[ext].originalChars += originalChars;
          stats.byLanguage[ext].outlineChars += outlineChars;

          if (verbose) {
            const pct = ((1 - outlineChars / originalChars) * 100).toFixed(0);
            console.log(`  ${filePath} (${fileLines.length} lines) → ${pct}% reduction`);
          }
        } else if (entry.type === "toolResult") {
          // toolResult without a pending read call — skip (belongs to non-read tool)
          pendingRead = null;
        }
      }
    }
  }

  // Report
  console.log("\n═══ read-outline benchmark ═══\n");
  console.log(`Sessions scanned:       ${stats.totalSessions} (${stats.totalSessionFiles} files)`);
  console.log(`Total read calls:       ${stats.totalReadCalls}`);
  console.log(`Full-file reads:        ${stats.fullFileReads}`);
  console.log(`Supported source files: ${stats.supportedFileReads}`);
  console.log(`Above ${LINE_THRESHOLD}-line threshold: ${stats.aboveThreshold}`);
  console.log(`Outlines produced:      ${stats.outlineProduced}`);
  console.log("");

  if (stats.outlineProduced > 0) {
    const savingsChars = stats.totalOriginalChars - stats.totalOutlineChars;
    const savingsPct = ((savingsChars / stats.totalOriginalChars) * 100).toFixed(1);
    const originalKB = (stats.totalOriginalChars / 1024).toFixed(1);
    const outlineKB = (stats.totalOutlineChars / 1024).toFixed(1);
    const savedKB = (savingsChars / 1024).toFixed(1);

    console.log(`Original content:  ${originalKB} KB`);
    console.log(`Outline content:   ${outlineKB} KB`);
    console.log(`Savings:           ${savedKB} KB (${savingsPct}%)`);
    console.log("");

    // By language
    console.log("By extension:");
    const sorted = Object.entries(stats.byLanguage).sort((a, b) => b[1].count - a[1].count);
    for (const [ext, data] of sorted) {
      const pct = ((1 - data.outlineChars / data.originalChars) * 100).toFixed(0);
      console.log(`  ${ext.padEnd(6)} ${String(data.count).padStart(4)} files  ${pct}% avg reduction`);
    }
    console.log("");

    // File size distribution
    const sizes = stats.fileSizeDistribution.sort((a, b) => a - b);
    const p50 = sizes[Math.floor(sizes.length * 0.5)];
    const p90 = sizes[Math.floor(sizes.length * 0.9)];
    const max = sizes[sizes.length - 1];
    console.log(`File sizes (lines): median=${p50}, p90=${p90}, max=${max}`);
  }

  // Opportunity funnel
  if (stats.totalReadCalls > 0) {
    console.log("\n── Opportunity funnel ──");
    console.log(`  ${stats.totalReadCalls} total reads`);
    console.log(`  → ${stats.fullFileReads} full-file (${fmtPct(stats.fullFileReads, stats.totalReadCalls)})`);
    console.log(`  → ${stats.supportedFileReads} supported ext (${fmtPct(stats.supportedFileReads, stats.totalReadCalls)})`);
    console.log(`  → ${stats.aboveThreshold} above threshold (${fmtPct(stats.aboveThreshold, stats.totalReadCalls)})`);
    console.log(`  → ${stats.outlineProduced} outlines produced (${fmtPct(stats.outlineProduced, stats.totalReadCalls)})`);
  }
}

function fmtPct(n: number, total: number): string {
  return total > 0 ? `${((n / total) * 100).toFixed(0)}%` : "0%";
}

main().catch(console.error);
