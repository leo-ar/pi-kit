import type { OutlineEntry } from "../types.ts";
import { findBlockEnd } from "../block-end.ts";

export function generateGoOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();

    // func
    const fnMatch = trimmed.match(/^func\s+(\(.*?\)\s+)?(\w+)/);
    if (fnMatch) {
      const name = fnMatch[2];
      const exported = name[0] === name[0].toUpperCase();
      const endLine = findBlockEnd(lines, i);
      entries.push({ kind: "fn", name, startLine: i + 1, endLine: endLine + 1, exported });
      continue;
    }

    // type struct/interface
    const typeMatch = trimmed.match(/^type\s+(\w+)\s+(struct|interface)/);
    if (typeMatch) {
      const name = typeMatch[1];
      const kind = typeMatch[2];
      const exported = name[0] === name[0].toUpperCase();
      const endLine = findBlockEnd(lines, i);
      entries.push({ kind, name, startLine: i + 1, endLine: endLine + 1, exported });
      continue;
    }

    // const/var blocks
    const constMatch = trimmed.match(/^(const|var)\s+(\w+)/);
    if (constMatch) {
      const name = constMatch[2];
      const exported = name[0] === name[0].toUpperCase();
      entries.push({ kind: "const", name, startLine: i + 1, endLine: i + 1, exported });
    }
  }

  return entries;
}
