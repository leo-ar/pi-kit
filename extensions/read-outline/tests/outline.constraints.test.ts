import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateOutline } from "../src/outline.ts";

describe("generateOutline — constraints / edge cases", () => {
  it("returns empty array for empty file", async () => {
    const entries = await generateOutline([], "file.ts");
    assert.deepEqual(entries, []);
  });

  it("returns empty array for file with only comments", async () => {
    const lines = [
      "// This is a comment",
      "/* Block comment */",
      "// Another comment",
    ];
    const entries = await generateOutline(lines, "file.ts");
    assert.deepEqual(entries, []);
  });

  it("returns empty array for file with only imports", async () => {
    const lines = [
      'import { foo } from "./foo";',
      'import { bar } from "./bar";',
    ];
    const entries = await generateOutline(lines, "file.ts");
    assert.deepEqual(entries, []);
  });

  it("returns empty array for unsupported language dispatched to generic with no matches", async () => {
    const lines = [
      "just some random text",
      "with no recognizable patterns",
      "nothing here",
    ];
    const entries = await generateOutline(lines, "file.swift");
    assert.deepEqual(entries, []);
  });

  it("handles single-line type alias", async () => {
    const lines = ["export type ID = string;"];
    const entries = await generateOutline(lines, "file.ts");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].kind, "type");
    assert.equal(entries[0].name, "ID");
    assert.equal(entries[0].startLine, 1);
    assert.equal(entries[0].endLine, 1);
  });

  it("handles file with only blank lines", async () => {
    const lines = ["", "", "", ""];
    const entries = await generateOutline(lines, "file.ts");
    assert.deepEqual(entries, []);
  });

  it("does not crash on very short Python file", async () => {
    const lines = ["x = 1"];
    const entries = await generateOutline(lines, "file.py");
    // lowercase x is not an UPPER_CASE constant, no class/def
    assert.deepEqual(entries, []);
  });

  it("handles Go file with only const", async () => {
    const lines = ["const maxRetries = 3"];
    const entries = await generateOutline(lines, "file.go");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].kind, "const");
    assert.equal(entries[0].name, "maxRetries");
    assert.equal(entries[0].exported, false);
  });
});
