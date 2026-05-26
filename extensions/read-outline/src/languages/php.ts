import type { OutlineEntry } from "../types.ts";
import { findBlockEnd } from "../block-end.ts";

export function generatePhpOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const indent = lines[i].length - trimmed.length;

    // namespace
    const nsMatch = trimmed.match(/^namespace\s+([\w\\]+)/);
    if (nsMatch) {
      entries.push({ kind: "namespace", name: nsMatch[1], startLine: i + 1, endLine: i + 1, exported: true });
      continue;
    }

    // class / interface / trait / enum
    const classMatch = trimmed.match(
      /^(abstract\s+|final\s+)?(class|interface|trait|enum)\s+(\w+)/
    );
    if (classMatch) {
      const endLine = findBlockEnd(lines, i);
      entries.push({ kind: classMatch[2], name: classMatch[3], startLine: i + 1, endLine: endLine + 1, exported: true });
      continue;
    }

    // Top-level function (indent ≤ 4)
    if (indent <= 4) {
      const fnMatch = trimmed.match(
        /^(public\s+|protected\s+|private\s+)?(static\s+)?(function)\s+(\w+)\s*\(/
      );
      if (fnMatch) {
        const exported = !trimmed.startsWith("private");
        const name = fnMatch[4];
        const endLine = findBlockEnd(lines, i);
        entries.push({ kind: "fn", name, startLine: i + 1, endLine: endLine + 1, exported });
        continue;
      }
    }

    // const at top level (define or class constants)
    if (indent === 0) {
      const defineMatch = trimmed.match(/^define\s*\(\s*['"](\w+)['"]/);
      if (defineMatch) {
        entries.push({ kind: "const", name: defineMatch[1], startLine: i + 1, endLine: i + 1, exported: true });
        continue;
      }
    }

    // Class-level constants (indent ≤ 4)
    if (indent <= 4) {
      const constMatch = trimmed.match(/^(public\s+|protected\s+|private\s+)?(const)\s+(\w+)/);
      if (constMatch) {
        const exported = !trimmed.startsWith("private");
        entries.push({ kind: "const", name: constMatch[3], startLine: i + 1, endLine: i + 1, exported });
      }
    }
  }

  return entries;
}
