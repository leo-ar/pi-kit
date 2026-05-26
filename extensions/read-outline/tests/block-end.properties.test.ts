import { describe, it } from "node:test";
import fc from "fast-check";
import assert from "node:assert/strict";
import { findBlockEnd, findStatementEnd, findPythonBlockEnd, findRubyBlockEnd } from "../src/block-end.ts";

// Arbitrary: generate arrays of lines containing braces
const braceLineArb = fc.array(
  fc.oneof(
    fc.constant("function x() {"),
    fc.constant("  if (true) {"),
    fc.constant("    return 1;"),
    fc.constant("  }"),
    fc.constant("}"),
    fc.constant("const x = 1;"),
    fc.constant(""),
    fc.stringMatching(/^[a-z (){};]*$/),
  ),
  { minLength: 1, maxLength: 50 },
);

const pythonLineArb = fc.array(
  fc.oneof(
    fc.constant("def foo():"),
    fc.constant("class Bar:"),
    fc.constant("    return 1"),
    fc.constant("    x = 2"),
    fc.constant("        nested = 3"),
    fc.constant(""),
    fc.constant("# comment"),
    fc.constant("x = 1"),
  ),
  { minLength: 1, maxLength: 50 },
);

const rubyLineArb = fc.array(
  fc.oneof(
    fc.constant("def foo"),
    fc.constant("class Bar"),
    fc.constant("module Baz"),
    fc.constant("  if true"),
    fc.constant("  puts 'hi'"),
    fc.constant("  end"),
    fc.constant("end"),
    fc.constant(""),
    fc.constant("# comment"),
  ),
  { minLength: 1, maxLength: 50 },
);

describe("findBlockEnd — property: always returns index within bounds", () => {
  it("result >= startIdx and <= lines.length - 1", () => {
    fc.assert(
      fc.property(braceLineArb, (lines) => {
        const startIdx = 0;
        const result = findBlockEnd(lines, startIdx);
        assert.ok(result >= startIdx, `result ${result} < startIdx ${startIdx}`);
        assert.ok(result <= lines.length - 1, `result ${result} > last index ${lines.length - 1}`);
      }),
      { numRuns: 200 },
    );
  });

  it("result >= startIdx for arbitrary startIdx", () => {
    fc.assert(
      fc.property(
        braceLineArb.chain((lines) =>
          fc.tuple(fc.constant(lines), fc.integer({ min: 0, max: lines.length - 1 }))
        ),
        ([lines, startIdx]) => {
          const result = findBlockEnd(lines, startIdx);
          assert.ok(result >= startIdx, `result ${result} < startIdx ${startIdx}`);
          assert.ok(result <= lines.length - 1, `result ${result} > last index ${lines.length - 1}`);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("findStatementEnd — property: always returns index within bounds", () => {
  it("result >= startIdx and <= lines.length - 1", () => {
    fc.assert(
      fc.property(braceLineArb, (lines) => {
        const result = findStatementEnd(lines, 0);
        assert.ok(result >= 0, `result ${result} < 0`);
        assert.ok(result <= lines.length - 1, `result ${result} > last index ${lines.length - 1}`);
      }),
      { numRuns: 200 },
    );
  });
});

describe("findPythonBlockEnd — property: always returns index within bounds", () => {
  it("result >= startIdx and <= lines.length - 1", () => {
    fc.assert(
      fc.property(
        pythonLineArb.chain((lines) =>
          fc.tuple(fc.constant(lines), fc.integer({ min: 0, max: lines.length - 1 }))
        ),
        ([lines, startIdx]) => {
          const result = findPythonBlockEnd(lines, startIdx);
          assert.ok(result >= startIdx, `result ${result} < startIdx ${startIdx}`);
          assert.ok(result <= lines.length - 1, `result ${result} > last index ${lines.length - 1}`);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("findRubyBlockEnd — property: always returns index within bounds", () => {
  it("result >= startIdx and <= lines.length - 1", () => {
    fc.assert(
      fc.property(
        rubyLineArb.chain((lines) =>
          fc.tuple(fc.constant(lines), fc.integer({ min: 0, max: lines.length - 1 }))
        ),
        ([lines, startIdx]) => {
          const result = findRubyBlockEnd(lines, startIdx);
          assert.ok(result >= startIdx, `result ${result} < startIdx ${startIdx}`);
          assert.ok(result <= lines.length - 1, `result ${result} > last index ${lines.length - 1}`);
        },
      ),
      { numRuns: 200 },
    );
  });
});
