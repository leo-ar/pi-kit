import type { OutlineEntry } from "../types.ts";
import { findBlockEnd } from "../block-end.ts";

export function generateCOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    if (indent > 0) continue;
    if (trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;

    // struct/enum/union/class
    const structMatch = trimmed.match(/^(typedef\s+)?(struct|enum|union|class)\s+(\w+)/);
    if (structMatch) {
      const name = structMatch[3];
      const endLine = findBlockEnd(lines, i);
      entries.push({ kind: structMatch[2], name, startLine: i + 1, endLine: endLine + 1, exported: true });
      continue;
    }

    // Function definition (has parens, followed by { on same/next line)
    const fnMatch = trimmed.match(/^(\w[\w*&\s]+?)\s+(\w+)\s*\([^;]*$/);
    if (fnMatch && !["if", "for", "while", "switch", "return", "typedef"].includes(fnMatch[2])) {
      const name = fnMatch[2];
      const endLine = findBlockEnd(lines, i);
      if (endLine > i) { // Only if it has a body (not just a declaration)
        entries.push({ kind: "fn", name, startLine: i + 1, endLine: endLine + 1, exported: true });
      }
    }
  }

  return entries;
}
