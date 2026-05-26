import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateOutline } from "../src/outline.ts";

describe("generateOutline — TypeScript", () => {
  it("detects exported function", () => {
    const lines = [
      "export function greet(name: string) {",
      "  return `Hello ${name}`;",
      "}",
    ];
    const entries = generateOutline(lines, "file.ts");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].kind, "fn");
    assert.equal(entries[0].name, "greet");
    assert.equal(entries[0].startLine, 1);
    assert.equal(entries[0].endLine, 3);
    assert.equal(entries[0].exported, true);
  });

  it("detects class with correct span", () => {
    const lines = [
      "export class Foo {",
      "  bar() {",
      "    return 1;",
      "  }",
      "}",
    ];
    const entries = generateOutline(lines, "file.ts");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].kind, "class");
    assert.equal(entries[0].name, "Foo");
    assert.equal(entries[0].startLine, 1);
    assert.equal(entries[0].endLine, 5);
  });

  it("detects interface and enum", () => {
    const lines = [
      "export interface Config {",
      "  name: string;",
      "}",
      "",
      "enum Status {",
      "  Active,",
      "  Inactive,",
      "}",
    ];
    const entries = generateOutline(lines, "file.ts");
    assert.equal(entries.length, 2);
    assert.equal(entries[0].kind, "interface");
    assert.equal(entries[0].name, "Config");
    assert.equal(entries[0].exported, true);
    assert.equal(entries[1].kind, "enum");
    assert.equal(entries[1].name, "Status");
    assert.equal(entries[1].exported, false);
  });

  it("detects const declarations", () => {
    const lines = [
      "export const THRESHOLD = 100;",
    ];
    const entries = generateOutline(lines, "file.ts");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].kind, "const");
    assert.equal(entries[0].name, "THRESHOLD");
    assert.equal(entries[0].exported, true);
  });

  it("skips import lines", () => {
    const lines = [
      'import { foo } from "./foo";',
      "",
      "export function bar() {",
      "  return foo();",
      "}",
    ];
    const entries = generateOutline(lines, "file.ts");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].name, "bar");
  });

  it("detects async function", () => {
    const lines = [
      "export async function fetchData() {",
      "  return await fetch('/api');",
      "}",
    ];
    const entries = generateOutline(lines, "file.mts");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].kind, "fn");
    assert.equal(entries[0].name, "fetchData");
  });
});

describe("generateOutline — Python", () => {
  it("detects top-level class and function", () => {
    const lines = [
      "class Parser:",
      "    def __init__(self):",
      "        pass",
      "",
      "def main():",
      "    p = Parser()",
    ];
    const entries = generateOutline(lines, "file.py");
    assert.equal(entries.length, 2);
    assert.equal(entries[0].kind, "class");
    assert.equal(entries[0].name, "Parser");
    assert.equal(entries[1].kind, "fn");
    assert.equal(entries[1].name, "main");
  });

  it("marks underscore functions as non-exported", () => {
    const lines = [
      "def _helper():",
      "    pass",
      "",
      "def public_api():",
      "    pass",
    ];
    const entries = generateOutline(lines, "file.py");
    assert.equal(entries[0].exported, false);
    assert.equal(entries[1].exported, true);
  });

  it("detects UPPER_CASE constants", () => {
    const lines = [
      "MAX_RETRIES = 5",
      "DEFAULT_TIMEOUT = 30",
    ];
    const entries = generateOutline(lines, "file.py");
    assert.equal(entries.length, 2);
    assert.equal(entries[0].kind, "const");
    assert.equal(entries[0].name, "MAX_RETRIES");
  });
});

describe("generateOutline — Rust", () => {
  it("detects pub fn and struct", () => {
    const lines = [
      "pub fn process(input: &str) -> Result<()> {",
      "    Ok(())",
      "}",
      "",
      "pub struct Config {",
      "    name: String,",
      "}",
    ];
    const entries = generateOutline(lines, "file.rs");
    assert.equal(entries.length, 2);
    assert.equal(entries[0].kind, "fn");
    assert.equal(entries[0].name, "process");
    assert.equal(entries[0].exported, true);
    assert.equal(entries[1].kind, "struct");
    assert.equal(entries[1].name, "Config");
  });

  it("detects impl and trait", () => {
    const lines = [
      "trait Readable {",
      "    fn read(&self) -> Vec<u8>;",
      "}",
      "",
      "impl Readable for File {",
      "    fn read(&self) -> Vec<u8> {",
      "        vec![]",
      "    }",
      "}",
    ];
    const entries = generateOutline(lines, "file.rs");
    assert.equal(entries.length, 2);
    assert.equal(entries[0].kind, "trait");
    assert.equal(entries[0].name, "Readable");
    assert.equal(entries[1].kind, "impl");
    assert.equal(entries[1].name, "Readable");
  });
});

describe("generateOutline — Go", () => {
  it("detects exported and unexported functions", () => {
    const lines = [
      "func ProcessData(input []byte) error {",
      "    return nil",
      "}",
      "",
      "func helper() int {",
      "    return 0",
      "}",
    ];
    const entries = generateOutline(lines, "file.go");
    assert.equal(entries.length, 2);
    assert.equal(entries[0].name, "ProcessData");
    assert.equal(entries[0].exported, true);
    assert.equal(entries[1].name, "helper");
    assert.equal(entries[1].exported, false);
  });

  it("detects type struct", () => {
    const lines = [
      "type Config struct {",
      "    Name string",
      "}",
    ];
    const entries = generateOutline(lines, "file.go");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].kind, "struct");
    assert.equal(entries[0].name, "Config");
  });
});

describe("generateOutline — Ruby", () => {
  it("detects class and method", () => {
    const lines = [
      "class Parser",
      "  def parse(input)",
      "    input.split",
      "  end",
      "end",
    ];
    const entries = generateOutline(lines, "file.rb");
    assert.equal(entries.length, 2);
    assert.equal(entries[0].kind, "class");
    assert.equal(entries[0].name, "Parser");
    assert.equal(entries[1].kind, "fn");
    assert.equal(entries[1].name, "parse");
  });

  it("detects module", () => {
    const lines = [
      "module Utils",
      "  def self.format(s)",
      "    s.strip",
      "  end",
      "end",
    ];
    const entries = generateOutline(lines, "file.rb");
    assert.equal(entries.length, 2);
    assert.equal(entries[0].kind, "module");
    assert.equal(entries[0].name, "Utils");
    assert.equal(entries[1].kind, "fn");
    assert.equal(entries[1].name, "format");
  });
});

describe("generateOutline — C/C++", () => {
  it("detects struct and function", () => {
    const lines = [
      "struct Point {",
      "    int x;",
      "    int y;",
      "};",
      "",
      "int calculate(int a, int b) {",
      "    return a + b;",
      "}",
    ];
    const entries = generateOutline(lines, "file.c");
    assert.equal(entries.length, 2);
    assert.equal(entries[0].kind, "struct");
    assert.equal(entries[0].name, "Point");
    assert.equal(entries[1].kind, "fn");
    assert.equal(entries[1].name, "calculate");
  });
});

describe("generateOutline — Generic fallback", () => {
  it("detects function-like and class-like patterns", () => {
    const lines = [
      "pub fn handle(req: Request) {",
      "    respond(req)",
      "}",
      "",
      "struct Endpoint {",
      "    path: String",
      "}",
    ];
    const entries = generateOutline(lines, "file.zig");
    assert.equal(entries.length, 2);
    assert.equal(entries[0].kind, "fn");
    assert.equal(entries[0].name, "handle");
    assert.equal(entries[1].kind, "struct");
    assert.equal(entries[1].name, "Endpoint");
  });
});
