/**
 * Benchmark script for smart-compact vs pi's default compaction.
 *
 * Reads existing session files (read-only), finds compaction entries,
 * replays the messages through our extraction/verification pipeline,
 * and compares coverage metrics.
 *
 * Modes:
 *   --dry    Deterministic-only (no LLM call). Measures extraction quality
 *            against pi's existing compaction summary.
 *   --live   Full pipeline with real LLM call. Compares our output to pi's.
 *
 * Usage:
 *   node --experimental-strip-types extensions/smart-compact/bench.ts --dry
 *   node --experimental-strip-types extensions/smart-compact/bench.ts --live
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { extractFacts, extractText } from "./extraction.ts";
import { verify, criticalErrors } from "./verification.ts";
import type { Message } from "./extraction.ts";
import type { Extraction } from "./verification.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SessionEntry {
  type: string;
  id: string;
  parentId?: string;
  message?: { role: string; content: unknown };
  summary?: string;
  firstKeptEntryId?: string;
  tokensBefore?: number;
}

interface CompactionSlice {
  sessionFile: string;
  compactionId: string;
  messagesBefore: Message[];
  piSummary: string;
  tokensBefore: number;
  firstKeptEntryId: string;
}

interface BenchResult {
  sessionFile: string;
  messageCount: number;
  // Extraction metrics
  extraction: {
    goal: string | null;
    modifiedFiles: number;
    readFiles: number;
    totalErrors: number;
    criticalErrors: number;
    decisions: number;
    constraints: number;
  };
  // Coverage: how well does pi's summary cover extracted facts
  piCoverage: {
    fileGaps: string[];
    errorGaps: string[];
    totalGaps: number;
  };
  // Summary stats
  piSummaryLength: number;
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

function parseSession(filePath: string): SessionEntry[] {
  const content = readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function extractCompactionSlices(filePath: string): CompactionSlice[] {
  const entries = parseSession(filePath);
  const slices: CompactionSlice[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.type !== "compaction") continue;
    if (!entry.summary || !entry.firstKeptEntryId) continue;

    // Find the index of firstKeptEntryId
    const keptIdx = entries.findIndex((e) => e.id === entry.firstKeptEntryId);
    if (keptIdx <= 0) continue;

    // Collect message entries before the cut point
    const messagesBefore: Message[] = [];
    for (let j = 0; j < keptIdx; j++) {
      const e = entries[j];
      if (e.type === "message" && e.message) {
        const msg = e.message;
        messagesBefore.push({
          role: msg.role as Message["role"],
          content: msg.content as any,
          isError: (msg as any).isError,
        });
      }
    }

    if (messagesBefore.length < 5) continue; // Skip tiny slices

    slices.push({
      sessionFile: basename(filePath),
      compactionId: entry.id,
      messagesBefore,
      piSummary: entry.summary,
      tokensBefore: entry.tokensBefore ?? 0,
      firstKeptEntryId: entry.firstKeptEntryId,
    });
  }

  return slices;
}

// ─── Benchmark Logic ─────────────────────────────────────────────────────────

function benchSlice(slice: CompactionSlice): BenchResult {
  const extraction = extractFacts(slice.messagesBefore);
  const critical = criticalErrors(extraction.errors);
  const gaps = verify(slice.piSummary, extraction);

  const fileGaps = gaps.filter((g) => g.startsWith("Modified file") || g.startsWith("Missing modified file"));
  const errorGaps = gaps.filter((g) => g.startsWith("Missing error"));

  return {
    sessionFile: slice.sessionFile,
    messageCount: slice.messagesBefore.length,
    extraction: {
      goal: extraction.goal,
      modifiedFiles: extraction.files.modified.size,
      readFiles: extraction.files.read.size,
      totalErrors: extraction.errors.length,
      criticalErrors: critical.length,
      decisions: extraction.decisions.length,
      constraints: extraction.constraints.length,
    },
    piCoverage: {
      fileGaps,
      errorGaps,
      totalGaps: gaps.length,
    },
    piSummaryLength: slice.piSummary.length,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const isLive = args.includes("--live");
  const verbose = args.includes("--verbose") || args.includes("-v");
  const limit = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0") || Infinity;

  if (isLive) {
    console.log("⚠️  --live mode not yet implemented (requires API key plumbing)");
    console.log("   Running in --dry mode instead.\n");
  }

  console.log("🔍 Scanning sessions...\n");

  const sessionFiles = findSessionFiles();
  let totalSlices = 0;
  const results: BenchResult[] = [];

  for (const file of sessionFiles) {
    const slices = extractCompactionSlices(file);
    totalSlices += slices.length;
    for (const slice of slices) {
      if (results.length >= limit) break;
      results.push(benchSlice(slice));
    }
    if (results.length >= limit) break;
  }

  // ─── Report ──────────────────────────────────────────────────────────────

  console.log(`Sessions scanned: ${sessionFiles.length}`);
  console.log(`Compaction slices found: ${totalSlices}`);
  console.log(`Slices benchmarked: ${results.length}\n`);

  if (results.length === 0) {
    console.log("No compaction slices found in any session.");
    return;
  }

  // Aggregate stats
  const totalMessages = results.reduce((s, r) => s + r.messageCount, 0);
  const totalFileGaps = results.reduce((s, r) => s + r.piCoverage.fileGaps.length, 0);
  const totalErrorGaps = results.reduce((s, r) => s + r.piCoverage.errorGaps.length, 0);
  const totalGaps = results.reduce((s, r) => s + r.piCoverage.totalGaps, 0);
  const totalModifiedFiles = results.reduce((s, r) => s + r.extraction.modifiedFiles, 0);
  const totalAllErrors = results.reduce((s, r) => s + r.extraction.totalErrors, 0);
  const totalCritical = results.reduce((s, r) => s + r.extraction.criticalErrors, 0);
  const avgSummaryLen = results.reduce((s, r) => s + r.piSummaryLength, 0) / results.length;

  const fileCoverage = totalModifiedFiles > 0
    ? ((totalModifiedFiles - totalFileGaps) / totalModifiedFiles * 100).toFixed(1)
    : "N/A";
  const errorCoverage = totalCritical > 0
    ? ((totalCritical - totalErrorGaps) / totalCritical * 100).toFixed(1)
    : "N/A";

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Pi Default Compaction — Coverage Analysis (via our verifier)");
  console.log("═══════════════════════════════════════════════════════════════\n");
  console.log(`  Messages analyzed:      ${totalMessages}`);
  console.log(`  Avg summary length:     ${Math.round(avgSummaryLen)} chars`);
  console.log();
  console.log(`  Modified files found:   ${totalModifiedFiles}`);
  console.log(`  File mention coverage:  ${fileCoverage}% (${totalFileGaps} gaps)`);
  console.log();
  console.log(`  Total errors extracted: ${totalAllErrors}`);
  console.log(`  Critical errors:        ${totalCritical} (after filtering transient)`);
  console.log(`  Critical error coverage:${errorCoverage}% (${totalErrorGaps} gaps)`);
  console.log(`  Total verification gaps: ${totalGaps}\n`);

  if (verbose) {
    console.log("─── Per-Slice Details ───────────────────────────────────────\n");
    for (const r of results) {
      console.log(`  ${r.sessionFile} (${r.messageCount} msgs)`);
      console.log(`    Goal: ${r.extraction.goal?.slice(0, 80) ?? "(none)"}`);
      console.log(`    Files: ${r.extraction.modifiedFiles} modified, ${r.extraction.readFiles} read`);
      console.log(`    Errors: ${r.extraction.totalErrors} total, ${r.extraction.criticalErrors} critical`);
      console.log(`    Gaps: ${r.piCoverage.totalGaps} (${r.piCoverage.fileGaps.length} file, ${r.piCoverage.errorGaps.length} error)`);
      if (r.piCoverage.fileGaps.length > 0) {
        for (const gap of r.piCoverage.fileGaps.slice(0, 3)) {
          console.log(`      ⚠ ${gap}`);
        }
      }
      console.log();
    }
  }

  // Summary verdict
  const gapRate = totalGaps / results.length;
  console.log("─── Verdict ────────────────────────────────────────────────────\n");
  if (gapRate < 0.5) {
    console.log("  ✅ Pi's default compaction has good coverage.");
    console.log("     smart-compact's value is primarily structural (better format)\n");
  } else if (gapRate < 2) {
    console.log("  ⚠️  Moderate gaps in pi's default compaction.");
    console.log("     smart-compact's verification step would catch these.\n");
  } else {
    console.log("  ❌ Significant gaps in pi's default compaction.");
    console.log("     smart-compact would materially improve context retention.\n");
  }
}

main();
