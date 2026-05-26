import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { formatOutlineResult, extractHeader, isHeaderLine } from "../src/format.ts";
import type { OutlineEntry } from "../src/types.ts";

describe("formatOutlineResult — examples", () => {
  it("produces correct structure with imports and outline sections", () => {
    const lines = [
      'import { foo } from "./foo";',
      "",
      "export function bar() {",
      "  return foo();",
      "}",
    ];
    const entries: OutlineEntry[] = [
      { kind: "fn", name: "bar", startLine: 3, endLine: 5, exported: true },
    ];

    const result = formatOutlineResult("src/bar.ts", lines, entries);
    assert.ok(result.includes("src/bar.ts (5 lines)"));
    assert.ok(result.includes("── imports ──"));
    assert.ok(result.includes('import { foo } from "./foo";'));
    assert.ok(result.includes("── outline ──"));
    assert.ok(result.includes("E fn    bar [3:5]"));
    assert.ok(result.includes("── hint ──"));
    assert.ok(result.includes("offset"));
  });

  it("omits imports section when no header lines", () => {
    const lines = [
      "export function foo() {",
      "  return 1;",
      "}",
    ];
    const entries: OutlineEntry[] = [
      { kind: "fn", name: "foo", startLine: 1, endLine: 3, exported: true },
    ];

    const result = formatOutlineResult("foo.ts", lines, entries);
    assert.ok(!result.includes("── imports ──"));
    assert.ok(result.includes("── outline ──"));
  });

  it("shows single-line entries without colon separator", () => {
    const entries: OutlineEntry[] = [
      { kind: "const", name: "X", startLine: 5, endLine: 5, exported: true },
    ];
    const lines = Array(10).fill("");

    const result = formatOutlineResult("file.ts", lines, entries);
    assert.ok(result.includes("E const X [5]"));
  });

  it("shows non-exported entries with dash", () => {
    const entries: OutlineEntry[] = [
      { kind: "fn", name: "helper", startLine: 1, endLine: 3, exported: false },
    ];
    const lines = ["fn helper() {", "  1", "}"];

    const result = formatOutlineResult("file.rs", lines, entries);
    assert.ok(result.includes("- fn    helper [1:3]"));
  });
});

describe("extractHeader — examples", () => {
  it("extracts import lines", () => {
    const lines = [
      'import { foo } from "./foo";',
      'import { bar } from "./bar";',
      "",
      "export function main() {}",
    ];
    const header = extractHeader(lines);
    assert.equal(header.length, 2);
    assert.ok(header[0].includes("foo"));
    assert.ok(header[1].includes("bar"));
  });

  it("extracts Python imports", () => {
    const lines = [
      "import os",
      "from pathlib import Path",
      "",
      "def main():",
    ];
    const header = extractHeader(lines);
    assert.equal(header.length, 2);
  });

  it("extracts C includes", () => {
    const lines = [
      "#include <stdio.h>",
      "#include <stdlib.h>",
      "",
      "int main() {",
    ];
    const header = extractHeader(lines);
    assert.equal(header.length, 2);
  });

  it("returns empty for file with no header", () => {
    const lines = [
      "export function foo() {",
      "  return 1;",
      "}",
    ];
    const header = extractHeader(lines);
    assert.equal(header.length, 0);
  });
});

describe("isHeaderLine", () => {
  it("recognizes import statements", () => {
    assert.equal(isHeaderLine('import { x } from "./x"'), true);
    assert.equal(isHeaderLine("from pathlib import Path"), true);
    assert.equal(isHeaderLine("require('fs')"), true);
  });

  it("recognizes use/include/package", () => {
    assert.equal(isHeaderLine("use std::io;"), true);
    assert.equal(isHeaderLine("#include <vector>"), true);
    assert.equal(isHeaderLine("package main"), true);
  });

  it("recognizes comments as header", () => {
    assert.equal(isHeaderLine("// Copyright 2024"), true);
    assert.equal(isHeaderLine("#!/usr/bin/env node"), true);
  });

  it("rejects regular code", () => {
    assert.equal(isHeaderLine("export function foo() {"), false);
    assert.equal(isHeaderLine("const x = 1;"), false);
    assert.equal(isHeaderLine("class Foo {"), false);
  });
});

describe("formatOutlineResult — property: always contains required sections", () => {
  const entryArb = fc.record({
    kind: fc.constantFrom("fn", "class", "const", "interface", "type", "enum"),
    name: fc.stringMatching(/^[a-zA-Z]\w{0,10}$/),
    startLine: fc.integer({ min: 1, max: 100 }),
    endLine: fc.integer({ min: 1, max: 200 }),
    exported: fc.boolean(),
  }).map(e => ({ ...e, endLine: Math.max(e.startLine, e.endLine) }));

  it("always includes filePath, outline section, and hint section", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => !s.includes("\n")),
        fc.array(fc.string({ maxLength: 80 }), { minLength: 1, maxLength: 50 }),
        fc.array(entryArb, { minLength: 1, maxLength: 10 }),
        (filePath, lines, entries) => {
          const result = formatOutlineResult(filePath, lines, entries);
          assert.ok(result.includes(filePath), "missing filePath");
          assert.ok(result.includes("── outline ──"), "missing outline section");
          assert.ok(result.includes("── hint ──"), "missing hint section");
          assert.ok(result.includes("offset"), "missing offset reference in hint");
        },
      ),
      { numRuns: 200 },
    );
  });
});
