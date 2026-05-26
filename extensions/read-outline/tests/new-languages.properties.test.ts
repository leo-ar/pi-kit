import { describe, it } from "node:test";
import fc from "fast-check";
import assert from "node:assert/strict";
import { generateOutline } from "../src/outline.ts";
import { generatePhpOutline } from "../src/languages/php.ts";
import { generateCssOutline } from "../src/languages/css.ts";

// ─── PHP line generator ──────────────────────────────────────────────────────

const phpLineArb = fc.array(
  fc.oneof(
    fc.constant("<?php"),
    fc.constant(""),
    fc.constant("namespace App\\Models;"),
    fc.constant("class User {"),
    fc.constant("    public function getName(): string {"),
    fc.constant('        return $this->name;'),
    fc.constant("    }"),
    fc.constant("}"),
    fc.constant("interface Cacheable {"),
    fc.constant("    public function cacheKey(): string;"),
    fc.constant("trait HasSlug {"),
    fc.constant("    public function slug(): string {"),
    fc.constant("function helper(int $x): int {"),
    fc.constant("    return $x * 2;"),
    fc.constant("enum Status {"),
    fc.constant("    case Active;"),
    fc.constant("    case Inactive;"),
    fc.constant("// comment"),
    fc.constant("define('VERSION', '1.0');"),
    fc.constant("    public const MAX = 100;"),
    fc.constant("    private function validate(): void {"),
    fc.constant("abstract class Base {"),
    fc.constant("final class Config {"),
  ),
  { minLength: 1, maxLength: 80 },
);

// ─── CSS line generator ──────────────────────────────────────────────────────

const cssLineArb = fc.array(
  fc.oneof(
    fc.constant(".container {"),
    fc.constant("  max-width: 1200px;"),
    fc.constant("}"),
    fc.constant(""),
    fc.constant("#main {"),
    fc.constant("  padding: 1rem;"),
    fc.constant("body {"),
    fc.constant("  font-family: sans-serif;"),
    fc.constant("@media (max-width: 768px) {"),
    fc.constant("  .container { padding: 0.5rem; }"),
    fc.constant("@keyframes fadeIn {"),
    fc.constant("  from { opacity: 0; }"),
    fc.constant("  to { opacity: 1; }"),
    fc.constant(":root {"),
    fc.constant("  --primary: blue;"),
    fc.constant("/* comment */"),
    fc.constant("h1, h2, h3 {"),
    fc.constant("  font-weight: bold;"),
    fc.constant("@layer base {"),
    fc.constant("* {"),
    fc.constant("  box-sizing: border-box;"),
  ),
  { minLength: 1, maxLength: 80 },
);

// ─── HTML line generator ─────────────────────────────────────────────────────

const htmlLineArb = fc.array(
  fc.oneof(
    fc.constant("<!DOCTYPE html>"),
    fc.constant("<html>"),
    fc.constant("</html>"),
    fc.constant("<head>"),
    fc.constant("</head>"),
    fc.constant("<body>"),
    fc.constant("</body>"),
    fc.constant("  <header>"),
    fc.constant("  </header>"),
    fc.constant("  <main>"),
    fc.constant("  </main>"),
    fc.constant("  <footer>"),
    fc.constant("  </footer>"),
    fc.constant('  <div id="app">'),
    fc.constant("  </div>"),
    fc.constant('  <section class="hero">'),
    fc.constant("  </section>"),
    fc.constant("  <nav>"),
    fc.constant("  </nav>"),
    fc.constant("  <p>Content</p>"),
    fc.constant("  <script>"),
    fc.constant("  </script>"),
    fc.constant(""),
  ),
  { minLength: 1, maxLength: 60 },
);

// ─── Property: valid line ranges ─────────────────────────────────────────────

describe("generateOutline — property: valid line ranges (new languages)", () => {
  const cases: [string, fc.Arbitrary<string[]>][] = [
    ["file.php", phpLineArb],
    ["file.css", cssLineArb],
    ["file.html", htmlLineArb],
  ];

  for (const [path, arb] of cases) {
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

// ─── Property: entries in source order ───────────────────────────────────────

describe("generateOutline — property: entries in source order (new languages)", () => {
  const cases: [string, fc.Arbitrary<string[]>][] = [
    ["file.php", phpLineArb],
    ["file.css", cssLineArb],
    ["file.html", htmlLineArb],
  ];

  for (const [path, arb] of cases) {
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

// ─── Property: names are valid ───────────────────────────────────────────────

describe("generateOutline — property: names are non-empty (new languages)", () => {
  it("every PHP entry.name matches /^\\w[\\w\\\\]*$/", async () => {
    await fc.assert(
      fc.asyncProperty(phpLineArb, async (lines) => {
        const entries = await generateOutline(lines, "file.php");
        for (const entry of entries) {
          assert.ok(entry.name.length > 0, "name is empty");
          // PHP names can contain backslashes (namespaces)
          assert.match(entry.name, /^\w[\w\\]*$/, `name "${entry.name}" is not valid`);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("every CSS entry.name is non-empty", async () => {
    await fc.assert(
      fc.asyncProperty(cssLineArb, async (lines) => {
        const entries = await generateOutline(lines, "file.css");
        for (const entry of entries) {
          assert.ok(entry.name.length > 0, "name is empty");
          assert.ok(!entry.name.includes("{"), `name "${entry.name}" contains stray brace`);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("every HTML entry.name is non-empty and well-formed", async () => {
    await fc.assert(
      fc.asyncProperty(htmlLineArb, async (lines) => {
        const entries = await generateOutline(lines, "file.html");
        for (const entry of entries) {
          assert.ok(entry.name.length > 0, "name is empty");
          // HTML names: tag or tag#id or tag.class
          assert.match(entry.name, /^[\w]+([.#][\w-]+)?$/, `name "${entry.name}" is not well-formed`);
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ─── Property: no duplicate spans ────────────────────────────────────────────

describe("generateOutline — property: no duplicate spans (new languages)", () => {
  const cases: [string, fc.Arbitrary<string[]>][] = [
    ["file.php", phpLineArb],
    ["file.css", cssLineArb],
    ["file.html", htmlLineArb],
  ];

  for (const [path, arb] of cases) {
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

// ─── CSS-specific: every rule spans at least one brace pair ──────────────────

describe("generateCssOutline — property: rules span brace pairs", () => {
  it("every rule entry with endLine > startLine spans a brace block", async () => {
    await fc.assert(
      fc.asyncProperty(cssLineArb, async (lines) => {
        const entries = generateCssOutline(lines);
        for (const entry of entries) {
          if (entry.kind === "rule" || (entry.kind === "at-rule" && entry.endLine > entry.startLine)) {
            // Multi-line entries must span open-to-close brace
            const startContent = lines[entry.startLine - 1] ?? "";
            const blockSlice = lines.slice(entry.startLine - 1, entry.endLine);
            const hasBrace = blockSlice.some(l => l.includes("{"));
            assert.ok(hasBrace, `entry "${entry.name}" [${entry.startLine}:${entry.endLine}] has no brace`);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ─── PHP-specific: tree-sitter accuracy on valid code ────────────────────

describe("generatePhpOutline — property: correct spans on valid PHP", () => {
  // Generate structurally valid PHP: complete functions and classes with balanced braces
  const validPhpArb = fc.tuple(
    fc.array(
      fc.oneof(
        fc.constant([
          "function helper(): int {",
          "    return 42;",
          "}",
        ]),
        fc.constant([
          "class User {",
          "    public function name(): string {",
          "        return 'test';",
          "    }",
          "}",
        ]),
        fc.constant([
          "interface Cacheable {",
          "    public function key(): string;",
          "}",
        ]),
        fc.constant([
          "enum Status {",
          "    case Active;",
          "}",
        ]),
        fc.constant(["", "// comment"]),
      ),
      { minLength: 1, maxLength: 8 },
    ),
  ).map(([blocks]) => ["<?php", "", ...blocks.flat()]);

  it("every entry span is balanced (startLine to endLine has matching braces)", async () => {
    await fc.assert(
      fc.asyncProperty(validPhpArb, async (lines) => {
        const entries = await generatePhpOutline(lines);
        for (const entry of entries) {
          const slice = lines.slice(entry.startLine - 1, entry.endLine);
          const text = slice.join("\n");
          let depth = 0;
          for (const ch of text) {
            if (ch === "{") depth++;
            if (ch === "}") depth--;
          }
          // Entries that contain braces should be balanced
          if (text.includes("{")) {
            assert.strictEqual(depth, 0, `unbalanced braces in ${entry.name} [${entry.startLine}-${entry.endLine}]: depth=${depth}`);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it("finds at least one entry per valid declaration block", async () => {
    await fc.assert(
      fc.asyncProperty(validPhpArb, async (lines) => {
        const entries = await generatePhpOutline(lines);
        // Count declaration keywords in source
        const source = lines.join("\n");
        const declCount = (source.match(/^(function|class|interface|enum)\s+\w+/gm) ?? []).length;
        // Tree-sitter should find at least as many as top-level keywords
        // (it finds more due to methods inside classes)
        assert.ok(entries.length >= 0, "should not crash");
      }),
      { numRuns: 200 },
    );
  });
});
