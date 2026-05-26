import type { OutlineEntry } from "../types.ts";
import { findBlockEnd } from "../block-end.ts";

export function generateGenericOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const indent = lines[i].length - trimmed.length;

    if (indent > 0) continue;

    // Catch function-like patterns
    const fnMatch = trimmed.match(/^(pub\s+|export\s+)?(async\s+)?(fn|def|func|function)\s+(\w+)/);
    if (fnMatch) {
      const endLine = findBlockEnd(lines, i);
      entries.push({ kind: "fn", name: fnMatch[4], startLine: i + 1, endLine: endLine + 1, exported: !!fnMatch[1] });
      continue;
    }

    // Catch class/struct/enum
    const classMatch = trimmed.match(/^(pub\s+|export\s+)?(class|struct|enum|interface|trait|type)\s+(\w+)/);
    if (classMatch) {
      const endLine = findBlockEnd(lines, i);
      entries.push({ kind: classMatch[2], name: classMatch[3], startLine: i + 1, endLine: endLine + 1, exported: !!classMatch[1] });
    }
  }

  return entries;
}
