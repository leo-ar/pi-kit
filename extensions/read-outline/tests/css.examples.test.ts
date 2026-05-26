import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateCssOutline } from "../src/languages/css.ts";

describe("generateCssOutline — examples", () => {
  it("detects a simple class selector rule", () => {
    const lines = [
      ".container {",
      "  max-width: 1200px;",
      "  margin: 0 auto;",
      "}",
    ];
    const result = generateCssOutline(lines);
    assert.equal(result.length, 1);
    assert.equal(result[0].kind, "rule");
    assert.equal(result[0].name, ".container");
    assert.equal(result[0].startLine, 1);
    assert.equal(result[0].endLine, 4);
  });

  it("detects multiple selectors", () => {
    const lines = [
      "body {",
      "  font-family: sans-serif;",
      "}",
      "",
      ".header {",
      "  background: #333;",
      "}",
      "",
      "#main {",
      "  padding: 1rem;",
      "}",
    ];
    const result = generateCssOutline(lines);
    assert.equal(result.length, 3);
    assert.equal(result[0].name, "body");
    assert.equal(result[1].name, ".header");
    assert.equal(result[2].name, "#main");
  });

  it("detects @media at-rule", () => {
    const lines = [
      "@media (max-width: 768px) {",
      "  .container {",
      "    padding: 0.5rem;",
      "  }",
      "}",
    ];
    const result = generateCssOutline(lines);
    assert.equal(result.length, 1);
    assert.equal(result[0].kind, "at-rule");
    assert.equal(result[0].name, "@media (max-width: 768px)");
    assert.equal(result[0].startLine, 1);
    assert.equal(result[0].endLine, 5);
  });

  it("detects @keyframes", () => {
    const lines = [
      "@keyframes fadeIn {",
      "  from { opacity: 0; }",
      "  to { opacity: 1; }",
      "}",
    ];
    const result = generateCssOutline(lines);
    assert.equal(result.length, 1);
    assert.equal(result[0].kind, "at-rule");
    assert.equal(result[0].name, "@keyframes fadeIn");
  });

  it("detects @layer", () => {
    const lines = [
      "@layer utilities {",
      "  .sr-only {",
      "    position: absolute;",
      "  }",
      "}",
    ];
    const result = generateCssOutline(lines);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "@layer utilities");
  });

  it("handles element selectors", () => {
    const lines = [
      "h1 {",
      "  font-size: 2rem;",
      "}",
    ];
    const result = generateCssOutline(lines);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "h1");
  });

  it("handles pseudo-selectors", () => {
    const lines = [
      ":root {",
      "  --primary: #007bff;",
      "  --secondary: #6c757d;",
      "}",
    ];
    const result = generateCssOutline(lines);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, ":root");
  });

  it("skips comment lines", () => {
    const lines = [
      "/* Reset styles */",
      "* {",
      "  margin: 0;",
      "  padding: 0;",
      "}",
    ];
    const result = generateCssOutline(lines);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "*");
  });

  it("detects @import as single-line at-rule", () => {
    const lines = [
      '@import url("reset.css");',
      "",
      "body {",
      "  color: #333;",
      "}",
    ];
    const result = generateCssOutline(lines);
    const importRule = result.find(e => e.name.startsWith("@import"));
    assert.ok(importRule);
    assert.equal(importRule!.kind, "at-rule");
    assert.equal(importRule!.startLine, importRule!.endLine); // single-line
  });
});
