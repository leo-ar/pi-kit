/**
 * Phase 3: Deterministic verification and patching.
 *
 * Pure functions — checks that a summary contains critical facts from
 * the extraction, and patches in anything missing.
 */

import type { Extraction } from "./extraction.ts";

// ─── Verification ────────────────────────────────────────────────────────────

/**
 * Check that critical facts from extraction appear in the summary.
 * Returns a list of gaps (missing items). Empty array = all good.
 */
export function verify(summary: string, extraction: Extraction): string[] {
  const gaps: string[] = [];
  const lower = summary.toLowerCase();

  // Every modified file must appear in the summary
  for (const f of extraction.files.modified) {
    const filename = f.split("/").pop() ?? f;
    // Skip check if basename is empty (malformed path like "dir/")
    if (!filename) continue;
    if (!lower.includes(filename.toLowerCase()) && !lower.includes(f.toLowerCase())) {
      gaps.push(`Missing modified file: ${f}`);
    }
  }

  // Unresolved errors should be mentioned
  for (const err of extraction.errors.slice(-3)) {
    const snippet = err.slice(0, 30).toLowerCase();
    if (snippet.length > 5 && !lower.includes(snippet)) {
      gaps.push(`Missing error: ${err.slice(0, 80)}`);
    }
  }

  return gaps;
}

// ─── Patching ────────────────────────────────────────────────────────────────

/**
 * Append missing errors to the summary. File gaps are NOT patched here
 * because file tracking tags are always appended unconditionally by the
 * caller — patching them here would cause duplication.
 *
 * Idempotent: errors already present in the summary are not re-appended.
 */
export function patchSummary(summary: string, gaps: string[]): string {
  if (gaps.length === 0) return summary;

  const lower = summary.toLowerCase();

  // Only patch missing errors — file tracking is handled by the caller
  const missingErrors = gaps
    .filter((g) => g.startsWith("Missing error:"))
    .map((g) => g.replace("Missing error: ", ""))
    .filter((e) => !lower.includes(e.toLowerCase()));

  if (missingErrors.length > 0) {
    const errorBlock = missingErrors.map((e) => `- ${e}`).join("\n");
    return summary + `\n\n## Unresolved Errors\n${errorBlock}`;
  }

  return summary;
}
