import type { OutlineEntry } from "../types.ts";
import { findBlockEnd } from "../block-end.ts";

export function generateRustOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    if (indent > 0) continue; // Only top-level

    // pub/fn/struct/enum/trait/impl/type/const/static/mod
    const match = trimmed.match(/^(pub(\(crate\))?\s+)?(async\s+)?(fn|struct|enum|trait|impl|type|const|static|mod)\s+(\w+)/);
    if (match) {
      const exported = !!match[1];
      const kind = match[4];
      const name = match[5];
      const endLine = findBlockEnd(lines, i);
      entries.push({ kind, name, startLine: i + 1, endLine: endLine + 1, exported });
    }
  }

  return entries;
}
