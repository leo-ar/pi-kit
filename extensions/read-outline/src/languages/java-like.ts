import type { OutlineEntry } from "../types.ts";
import { findBlockEnd } from "../block-end.ts";

export function generateJavaLikeOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const indent = lines[i].length - trimmed.length;

    // class/interface/enum
    const classMatch = trimmed.match(/^(public\s+|private\s+|protected\s+)?(abstract\s+|static\s+)?(class|interface|enum|record)\s+(\w+)/);
    if (classMatch) {
      const exported = !trimmed.startsWith("private");
      const kind = classMatch[3];
      const name = classMatch[4];
      const endLine = findBlockEnd(lines, i);
      entries.push({ kind, name, startLine: i + 1, endLine: endLine + 1, exported });
      continue;
    }

    // Top-level method (indent ≤ 4, has parens and braces or semicolon)
    if (indent <= 4) {
      const fnMatch = trimmed.match(/^(public\s+|private\s+|protected\s+)?(static\s+)?(async\s+)?(\w+)\s+(\w+)\s*\(/);
      if (fnMatch && !["if", "for", "while", "switch", "catch", "return", "new"].includes(fnMatch[4])) {
        const exported = !trimmed.startsWith("private");
        const name = fnMatch[5];
        const endLine = findBlockEnd(lines, i);
        entries.push({ kind: "fn", name, startLine: i + 1, endLine: endLine + 1, exported });
      }
    }
  }

  return entries;
}
