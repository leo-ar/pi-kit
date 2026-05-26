import { describe, it } from "node:test";
import fc from "fast-check";
import assert from "node:assert/strict";
import { generateOutline } from "../src/outline.ts";
import type { OutlineEntry } from "../src/types.ts";

// Generate realistic source lines for TypeScript
const tsLineArb = fc.array(
  fc.oneof(
    fc.constant("export function foo() {"),
    fc.constant("  return 1;"),
    fc.constant("}"),
    fc.constant(""),
    fc.constant("export class Bar {"),
    fc.constant("  method() {"),
    fc.constant("  }"),
    fc.constant("export interface Baz {"),
    fc.constant("  name: string;"),
    fc.constant("export const X = 1;"),
    fc.constant("// comment"),
    fc.constant('import { x } from "./x";'),
    fc.constant("type Alias = string;"),
    fc.constant("enum Status {"),
    fc.constant("  Active,"),
  ),
  { minLength: 1, maxLength: 80 },
);

// Generate realistic source lines for Python
const pyLineArb = fc.array(
  fc.oneof(
    fc.constant("class Foo:"),
    fc.constant("    def method(self):"),
    fc.constant("        pass"),
    fc.constant(""),
    fc.constant("def bar():"),
    fc.constant("    return 1"),
    fc.constant("MAX_SIZE = 100"),
    fc.constant("# comment"),
    fc.constant("import os"),
    fc.constant("async def fetch():"),
    fc.constant("    await something()"),
  ),
  { minLength: 1, maxLength: 80 },
);

// Generate realistic source lines for Go
const goLineArb = fc.array(
  fc.oneof(
    fc.constant("func Process() error {"),
    fc.constant("    return nil"),
    fc.constant("}"),
    fc.constant(""),
    fc.constant("func helper() int {"),
    fc.constant("    return 0"),
    fc.constant("type Config struct {"),
    fc.constant("    Name string"),
    fc.constant("const maxRetries = 3"),
    fc.constant("// comment"),
    fc.constant('package main'),
    fc.constant("type Reader interface {"),
    fc.constant("    Read(p []byte) (int, error)"),
  ),
  { minLength: 1, maxLength: 80 },
);

const filePaths: [string, fc.Arbitrary<string[]>][] = [
  ["file.ts", tsLineArb],
  ["file.py", pyLineArb],
  ["file.go", goLineArb],
];

describe("generateOutline — property: valid line ranges", () => {
  for (const [path, arb] of filePaths) {
    it(`all entries have startLine >= 1 and endLine <= totalLines (${path})`, async () => {
      await fc.assert(
        fc.asyncProperty(arb, async (lines) => {
          const entries = await generateOutline(lines, path);
          for (const entry of entries) {
            assert.ok(entry.startLine >= 1, `startLine ${entry.startLine} < 1`);
            assert.ok(entry.endLine >= entry.startLine, `endLine ${entry.endLine} < startLine ${entry.startLine}`);
            assert.ok(entry.endLine <= lines.length, `endLine ${entry.endLine} > totalLines ${lines.length}`);
          }
        }),
        { numRuns: 200 },
      );
    });
  }
});

describe("generateOutline — property: entries in source order", () => {
  for (const [path, arb] of filePaths) {
    it(`entries are non-decreasing by startLine (${path})`, async () => {
      await fc.assert(
        fc.asyncProperty(arb, async (lines) => {
          const entries = await generateOutline(lines, path);
          for (let i = 1; i < entries.length; i++) {
            assert.ok(
              entries[i].startLine >= entries[i - 1].startLine,
              `entry[${i}].startLine (${entries[i].startLine}) < entry[${i - 1}].startLine (${entries[i - 1].startLine})`,
            );
          }
        }),
        { numRuns: 200 },
      );
    });
  }
});

describe("generateOutline — property: names are non-empty identifiers", () => {
  for (const [path, arb] of filePaths) {
    it(`every entry.name matches /^\\w+[?!]?$/ (${path})`, async () => {
      await fc.assert(
        fc.asyncProperty(arb, async (lines) => {
          const entries = await generateOutline(lines, path);
          for (const entry of entries) {
            assert.ok(entry.name.length > 0, "name is empty");
            assert.match(entry.name, /^\w+[?!]?$/, `name "${entry.name}" is not a valid identifier`);
          }
        }),
        { numRuns: 200 },
      );
    });
  }
});

describe("generateOutline — property: no duplicate spans", () => {
  for (const [path, arb] of filePaths) {
    it(`no two entries share identical [startLine, endLine] (${path})`, async () => {
      await fc.assert(
        fc.asyncProperty(arb, async (lines) => {
          const entries = await generateOutline(lines, path);
          const spans = new Set<string>();
          for (const entry of entries) {
            const key = `${entry.startLine}:${entry.endLine}`;
            assert.ok(!spans.has(key), `duplicate span ${key}`);
            spans.add(key);
          }
        }),
        { numRuns: 200 },
      );
    });
  }
});
