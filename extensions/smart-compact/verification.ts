/**
 * Phase 3: Deterministic verification and patching.
 *
 * Pure functions — checks that a summary contains critical facts from
 * the extraction, and patches in anything missing.
 */

import type { Extraction } from "./extraction.ts";

// ─── Error Classification ────────────────────────────────────────────────────

/**
 * Patterns for transient/recoverable errors that do NOT need to appear in
 * a compaction summary. These errors are either retried automatically, represent
 * tool validation failures, or are environmental noise.
 */
const TRANSIENT_ERROR_PATTERNS: RegExp[] = [
  // Edit tool retries / validation
  /^Could not find the exact text in/i,
  /^Could not find edits\[\d+\] in/i,
  /^No changes made to/i,
  /^Validation failed for tool/i,
  /^The replacement produced no change/i,
  // File system noise
  /^ENOENT: no such file or directory/i,
  /^EISDIR: illegal operation on a directory/i,
  /^The following paths are ignored by/i,
  // Empty/useless output
  /^\(no output\)$/i,
  /^\s*$/,
  // Python noise
  /^\s*File "<st(?:din|ring)>"/i,
  /^Traceback \(most recent call last\)/i,
  // Node/file URL noise
  /^node:internal\/modules\//i,
  /^file:\/\//i,
  // Test runner output (not errors)
  /^Running \d+ tests?\s/i,
  // Shell syntax errors (agent retries)
  /^\/bin\/bash: (?:-c: )?line \d+:/i,
  // Read tool offset beyond EOF
  /^Offset \d+ is beyond end of file/i,
  // Git status noise
  /^On branch /i,
  // Informational migration output
  /^\[\d+\/\d+\] Migrating/i,
  /^\[undefined\/undefined\] Migrating/i,
  // Fetch/query results that aren't errors
  /^Fetched \d+ documents/i,
  /^Token found: \d+ chars/i,
  /^=== (?:Checking|post)/i,
];

/**
 * Classify an error as "critical" (should be mentioned in summary) or
 * "transient" (safe to drop). Critical errors are those that:
 *   - Represent an unresolved problem (timeout, crash, unrecoverable)
 *   - Changed the user's/agent's plan
 */
export function isTransientError(errorLine: string): boolean {
  return TRANSIENT_ERROR_PATTERNS.some((pat) => pat.test(errorLine));
}

/**
 * Filter extraction errors to only critical ones.
 */
export function criticalErrors(errors: string[]): string[] {
  return errors.filter((e) => !isTransientError(e));
}

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

  // Only critical (non-transient) errors should be mentioned
  const critical = criticalErrors(extraction.errors);
  for (const err of critical.slice(-3)) {
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
