import type { OutlineEntry } from "../types.ts";
import { findRubyBlockEnd } from "../block-end.ts";

export function generateRubyOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const indent = lines[i].length - trimmed.length;

    if (indent > 2) continue;

    const classMatch = trimmed.match(/^(class|module)\s+(\w+)/);
    if (classMatch) {
      const endLine = findRubyBlockEnd(lines, i);
      entries.push({ kind: classMatch[1], name: classMatch[2], startLine: i + 1, endLine: endLine + 1, exported: true });
      continue;
    }

    const fnMatch = trimmed.match(/^def\s+(self\.)?(\w+[?!]?)/);
    if (fnMatch) {
      const endLine = findRubyBlockEnd(lines, i);
      entries.push({ kind: "fn", name: fnMatch[2], startLine: i + 1, endLine: endLine + 1, exported: true });
    }
  }

  return entries;
}
