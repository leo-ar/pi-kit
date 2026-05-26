import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateHtmlOutline } from "../src/languages/html.ts";

describe("generateHtmlOutline — examples", () => {
  it("detects basic page structure", () => {
    const lines = [
      "<!DOCTYPE html>",
      "<html>",
      "<head>",
      "  <title>Test</title>",
      "</head>",
      "<body>",
      "  <h1>Hello</h1>",
      "</body>",
      "</html>",
    ];
    const result = generateHtmlOutline(lines);
    const names = result.map(e => e.name);
    assert.ok(names.includes("html"));
    assert.ok(names.includes("head"));
    assert.ok(names.includes("body"));
  });

  it("detects semantic sections", () => {
    const lines = [
      "<body>",
      '  <header class="site-header">',
      "    <nav>",
      "      <ul>",
      "        <li>Home</li>",
      "      </ul>",
      "    </nav>",
      "  </header>",
      "  <main>",
      "    <section>",
      "      <p>Content</p>",
      "    </section>",
      "  </main>",
      "  <footer>",
      "    <p>Footer</p>",
      "  </footer>",
      "</body>",
    ];
    const result = generateHtmlOutline(lines);
    const names = result.map(e => e.name);
    assert.ok(names.includes("body"));
    assert.ok(names.includes("header.site-header"));
    assert.ok(names.includes("nav"));
    assert.ok(names.includes("main"));
    assert.ok(names.includes("section"));
    assert.ok(names.includes("footer"));
  });

  it("extracts id attribute", () => {
    const lines = [
      '<div id="app">',
      "  <p>Content</p>",
      "</div>",
    ];
    const result = generateHtmlOutline(lines);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "div#app");
    assert.equal(result[0].kind, "tag");
  });

  it("extracts first class when no id", () => {
    const lines = [
      '<div class="container flex">',
      "  <p>Content</p>",
      "</div>",
    ];
    const result = generateHtmlOutline(lines);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "div.container");
  });

  it("handles script and style tags", () => {
    const lines = [
      "<head>",
      "  <style>",
      "    body { color: red; }",
      "  </style>",
      "  <script>",
      '    console.log("hello");',
      "  </script>",
      "</head>",
    ];
    const result = generateHtmlOutline(lines);
    const names = result.map(e => e.name);
    assert.ok(names.includes("head"));
    assert.ok(names.includes("style"));
    assert.ok(names.includes("script"));
  });

  it("handles self-closing tags (not in semantic set though)", () => {
    const lines = [
      "<div>",
      "  <img src='test.png' />",
      "</div>",
    ];
    const result = generateHtmlOutline(lines);
    // img is not semantic — only div is detected
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "div");
  });

  it("handles nested same-tag correctly", () => {
    const lines = [
      "<div>",
      "  <div>",
      "    <p>Inner</p>",
      "  </div>",
      "</div>",
    ];
    const result = generateHtmlOutline(lines);
    // Should detect both divs
    assert.equal(result.length, 2);
    assert.equal(result[0].name, "div");
    assert.equal(result[0].startLine, 1);
    assert.equal(result[0].endLine, 5);
    assert.equal(result[1].name, "div");
    assert.equal(result[1].startLine, 2);
    assert.equal(result[1].endLine, 4);
  });

  it("detects template tag", () => {
    const lines = [
      '<template id="card-template">',
      "  <div>",
      "    <h2>Title</h2>",
      "  </div>",
      "</template>",
    ];
    const result = generateHtmlOutline(lines);
    const tmpl = result.find(e => e.name === "template#card-template");
    assert.ok(tmpl);
    assert.equal(tmpl!.startLine, 1);
    assert.equal(tmpl!.endLine, 5);
  });
});
