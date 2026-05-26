import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findBlockEnd, findStatementEnd, findPythonBlockEnd, findRubyBlockEnd } from "../src/block-end.ts";

describe("findBlockEnd", () => {
  it("finds closing brace on same line", () => {
    const lines = ["function x() { return 1; }"];
    assert.equal(findBlockEnd(lines, 0), 0);
  });

  it("finds closing brace on next line", () => {
    const lines = [
      "function x() {",
      "  return 1;",
      "}",
    ];
    assert.equal(findBlockEnd(lines, 0), 2);
  });

  it("handles nested braces", () => {
    const lines = [
      "function x() {",
      "  if (true) {",
      "    return 1;",
      "  }",
      "}",
    ];
    assert.equal(findBlockEnd(lines, 0), 4);
  });

  it("returns startIdx when no braces found (single-line declaration)", () => {
    const lines = ["type Foo = string;"];
    assert.equal(findBlockEnd(lines, 0), 0);
  });

  it("returns end of file for unclosed braces", () => {
    const lines = [
      "function x() {",
      "  return 1;",
    ];
    assert.equal(findBlockEnd(lines, 0), 1);
  });

  it("starts searching from given startIdx", () => {
    const lines = [
      "// preamble",
      "function a() {",
      "  return 1;",
      "}",
      "function b() {",
      "  return 2;",
      "}",
    ];
    assert.equal(findBlockEnd(lines, 4), 6);
  });
});

describe("findStatementEnd", () => {
  it("finds end of single-line statement", () => {
    const lines = ["const x = 42;"];
    assert.equal(findStatementEnd(lines, 0), 0);
  });

  it("finds end of multi-line object", () => {
    const lines = [
      "const x = {",
      "  a: 1,",
      "  b: 2,",
      "};",
    ];
    assert.equal(findStatementEnd(lines, 0), 3);
  });

  it("finds end of multi-line function call", () => {
    const lines = [
      "const x = foo(",
      "  1,",
      "  2,",
      ");",
    ];
    assert.equal(findStatementEnd(lines, 0), 3);
  });

  it("returns startIdx for bare declaration", () => {
    const lines = ["const x = 1"];
    assert.equal(findStatementEnd(lines, 0), 0);
  });
});

describe("findPythonBlockEnd", () => {
  it("finds end by dedent", () => {
    const lines = [
      "def foo():",
      "    return 1",
      "",
      "def bar():",
    ];
    // Blank line is skipped; next non-blank is "def bar():" at indent 0 → returns i-1 = 2
    assert.equal(findPythonBlockEnd(lines, 0), 2);
  });

  it("skips blank lines within block", () => {
    const lines = [
      "class Foo:",
      "    x = 1",
      "",
      "    y = 2",
      "",
      "class Bar:",
    ];
    // Last indented line is "    y = 2" at index 3; blank at 4 skipped;
    // "class Bar:" at indent 0 triggers return i-1 = 4
    assert.equal(findPythonBlockEnd(lines, 0), 4);
  });

  it("returns last line for block at end of file", () => {
    const lines = [
      "def foo():",
      "    return 1",
      "    return 2",
    ];
    assert.equal(findPythonBlockEnd(lines, 0), 2);
  });

  it("handles nested indentation", () => {
    const lines = [
      "def foo():",
      "    if True:",
      "        return 1",
      "    return 2",
      "def bar():",
    ];
    assert.equal(findPythonBlockEnd(lines, 0), 3);
  });
});

describe("findRubyBlockEnd", () => {
  it("finds matching end keyword", () => {
    const lines = [
      "def foo",
      "  puts 'hi'",
      "end",
    ];
    assert.equal(findRubyBlockEnd(lines, 0), 2);
  });

  it("handles nested blocks", () => {
    const lines = [
      "def foo",
      "  if true",
      "    puts 'hi'",
      "  end",
      "end",
    ];
    assert.equal(findRubyBlockEnd(lines, 0), 4);
  });

  it("returns end of file when no matching end", () => {
    const lines = [
      "def foo",
      "  puts 'hi'",
    ];
    assert.equal(findRubyBlockEnd(lines, 0), 1);
  });

  it("finds class end", () => {
    const lines = [
      "class Foo",
      "  def bar",
      "    1",
      "  end",
      "end",
    ];
    assert.equal(findRubyBlockEnd(lines, 0), 4);
  });
});
