/**
 * Property tests for verification.ts
 *
 * Invariants:
 * 3. Verification soundness — if summary contains all filenames, verify returns []
 * 4. Patch idempotence — patchSummary applied twice = applied once
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { verify, patchSummary } from "./verification.ts";
import type { Extraction, FileOps } from "./extraction.ts";

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const arbFilePath = fc.stringMatching(/^[a-z][a-z0-9_-]*(?:\/[a-z][a-z0-9._-]*)+$/);

const arbExtraction = fc
  .record({
    goal: fc.string({ maxLength: 100 }),
    readFiles: fc.array(arbFilePath, { maxLength: 5 }),
    modifiedFiles: fc.array(arbFilePath, { minLength: 0, maxLength: 5 }),
    errors: fc.array(fc.string({ minLength: 6, maxLength: 100 }), { maxLength: 5 }),
    decisions: fc.array(fc.string({ maxLength: 100 }), { maxLength: 5 }),
    constraints: fc.array(fc.string({ maxLength: 100 }), { maxLength: 5 }),
  })
  .map(({ goal, readFiles, modifiedFiles, errors, decisions, constraints }): Extraction => {
    const modified = new Set(modifiedFiles);
    // Ensure disjointness: remove modified files from read set
    const read = new Set(readFiles.filter((f) => !modified.has(f)));
    const files: FileOps = { read, modified };
    return { goal, files, errors, decisions, constraints };
  });

const arbGaps = fc.array(
  fc.oneof(
    arbFilePath.map((f) => `Missing modified file: ${f}`),
    fc.string({ minLength: 10, maxLength: 80 }).map((e) => `Missing error: ${e}`),
  ),
  { maxLength: 5 },
);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe("verify — properties", () => {
  it("for all summaries containing every modified filename, verify returns empty gaps", () => {
    fc.assert(
      fc.property(arbExtraction, fc.string({ maxLength: 200 }), (extraction, baseSummary) => {
        // Build a summary guaranteed to contain all modified filenames and error snippets
        const filenames = [...extraction.files.modified].map((f) => f.split("/").pop()!);
        const errorSnippets = extraction.errors.slice(-3).map((e) => e.slice(0, 30));
        const summary = baseSummary + " " + filenames.join(" ") + " " + errorSnippets.join(" ");

        const gaps = verify(summary, extraction);
        assert.strictEqual(
          gaps.length,
          0,
          `Expected no gaps but got: ${JSON.stringify(gaps)}`,
        );
      }),
      { numRuns: 20 },
    );
  });

  it("for all extractions with modified files, a blank summary always has gaps", () => {
    fc.assert(
      fc.property(
        arbExtraction.filter((e) => e.files.modified.size > 0),
        (extraction) => {
          const gaps = verify("", extraction);
          assert(gaps.length > 0, "Expected gaps for empty summary with modified files");
        },
      ),
      { numRuns: 20 },
    );
  });
});

describe("patchSummary — properties", () => {
  it("for all inputs, patchSummary is idempotent", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), arbGaps, (summary, gaps) => {
        const once = patchSummary(summary, gaps);
        const twice = patchSummary(once, gaps);
        assert.strictEqual(once, twice);
      }),
      { numRuns: 20 },
    );
  });

  it("for empty gaps, patchSummary returns the summary unchanged", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (summary) => {
        assert.strictEqual(patchSummary(summary, []), summary);
      }),
      { numRuns: 20 },
    );
  });
});

// ─── Example Tests ───────────────────────────────────────────────────────────

describe("verify — examples", () => {
  it("detects missing modified file", () => {
    const extraction: Extraction = {
      goal: "test",
      files: { read: new Set(), modified: new Set(["src/app.ts"]) },
      errors: [],
      decisions: [],
      constraints: [],
    };
    const gaps = verify("This summary mentions nothing relevant", extraction);
    assert.equal(gaps.length, 1);
    assert(gaps[0].includes("src/app.ts"));
  });

  it("passes when filename (basename) is mentioned", () => {
    const extraction: Extraction = {
      goal: "test",
      files: { read: new Set(), modified: new Set(["src/deep/nested/app.ts"]) },
      errors: [],
      decisions: [],
      constraints: [],
    };
    const gaps = verify("Modified app.ts with new handler", extraction);
    assert.equal(gaps.length, 0);
  });

  it("detects missing error snippet", () => {
    const extraction: Extraction = {
      goal: "test",
      files: { read: new Set(), modified: new Set() },
      errors: ["TypeError: cannot read property 'foo' of undefined"],
      decisions: [],
      constraints: [],
    };
    const gaps = verify("Everything is fine", extraction);
    assert.equal(gaps.length, 1);
    assert(gaps[0].includes("Missing error"));
  });
});

describe("patchSummary — examples", () => {
  it("appends unresolved errors section", () => {
    const result = patchSummary("## Summary", ["Missing error: TypeError: foo is undefined"]);
    assert(result.includes("## Unresolved Errors"));
    assert(result.includes("TypeError: foo is undefined"));
  });

  it("does not append modified-files (handled by caller)", () => {
    const result = patchSummary("## Summary", ["Missing modified file: src/app.ts"]);
    // File gaps are intentionally NOT patched — the caller appends file tags unconditionally
    assert(!result.includes("<modified-files>"));
  });
});
