import { describe, it } from "node:test";
import fc from "fast-check";
import assert from "node:assert/strict";
import { generateOutline } from "../src/outline.ts";
import { generatePhpOutline } from "../src/languages/php.ts";
import { generateCssOutline } from "../src/languages/css.ts";
import { generateHtmlOutline } from "../src/languages/html.ts";
import { generateGenericOutline } from "../src/languages/generic.ts";

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
    it(`all entries have startLine >= 1 and endLine <= totalLines (${path})`, () => {
      fc.assert(
        fc.property(arb, (lines) => {
          const entries = generateOutline(lines, path);
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
    it(`entries are non-decreasing by startLine (${path})`, () => {
      fc.assert(
        fc.property(arb, (lines) => {
          const entries = generateOutline(lines, path);
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
  it("every PHP entry.name matches /^\\w[\\w\\\\]*$/", () => {
    fc.assert(
      fc.property(phpLineArb, (lines) => {
        const entries = generateOutline(lines, "file.php");
        for (const entry of entries) {
          assert.ok(entry.name.length > 0, "name is empty");
          // PHP names can contain backslashes (namespaces)
          assert.match(entry.name, /^\w[\w\\]*$/, `name "${entry.name}" is not valid`);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("every CSS entry.name is non-empty", () => {
    fc.assert(
      fc.property(cssLineArb, (lines) => {
        const entries = generateOutline(lines, "file.css");
        for (const entry of entries) {
          assert.ok(entry.name.length > 0, "name is empty");
          assert.ok(!entry.name.includes("{"), `name "${entry.name}" contains stray brace`);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("every HTML entry.name is non-empty and well-formed", () => {
    fc.assert(
      fc.property(htmlLineArb, (lines) => {
        const entries = generateOutline(lines, "file.html");
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
    it(`no two entries share identical [startLine, endLine] (${path})`, () => {
      fc.assert(
        fc.property(arb, (lines) => {
          const entries = generateOutline(lines, path);
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
  it("every rule entry with endLine > startLine spans a brace block", () => {
    fc.assert(
      fc.property(cssLineArb, (lines) => {
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

// ─── PHP-specific: superset of generic ───────────────────────────────────────

describe("generatePhpOutline — property: superset of generic", () => {
  it("PHP generator finds everything generic would find", () => {
    fc.assert(
      fc.property(phpLineArb, (lines) => {
        const phpEntries = generatePhpOutline(lines);
        const genericEntries = generateGenericOutline(lines);

        for (const ge of genericEntries) {
          const found = phpEntries.some(pe => pe.name === ge.name);
          assert.ok(found, `generic found "${ge.name}" but PHP generator missed it`);
        }
      }),
      { numRuns: 200 },
    );
  });
});
