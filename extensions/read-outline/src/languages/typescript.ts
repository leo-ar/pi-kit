import type { OutlineEntry } from "../types.ts";
import { findBlockEnd, findStatementEnd } from "../block-end.ts";

export function generateTsOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Skip comments and blank lines
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed === "") continue;
    // Skip import/require lines
    if (trimmed.startsWith("import ") || trimmed.startsWith("require(") || trimmed.startsWith("from ")) continue;

    // Class/interface/type/enum
    const classMatch = trimmed.match(/^(export\s+)?(default\s+)?(abstract\s+)?(class|interface|type|enum)\s+(\w+)/);
    if (classMatch) {
      const exported = !!classMatch[1];
      const kind = classMatch[4];
      const name = classMatch[5];
      const endLine = findBlockEnd(lines, i);
      entries.push({ kind, name, startLine: i + 1, endLine: endLine + 1, exported });
      continue;
    }

    // Top-level function
    const fnMatch = trimmed.match(/^(export\s+)?(default\s+)?(async\s+)?function\s*\*?\s*(\w+)/);
    if (fnMatch && line.trimStart() === trimmed) { // top-level only
      const exported = !!fnMatch[1];
      const name = fnMatch[4];
      const endLine = findBlockEnd(lines, i);
      entries.push({ kind: "fn", name, startLine: i + 1, endLine: endLine + 1, exported });
      continue;
    }

    // Top-level const/let/var
    const constMatch = trimmed.match(/^(export\s+)?(const|let|var)\s+(\w+)\s*[=:]/);
    if (constMatch && line.trimStart() === trimmed) {
      const exported = !!constMatch[1];
      const name = constMatch[3];
      const endLine = findStatementEnd(lines, i);
      entries.push({ kind: "const", name, startLine: i + 1, endLine: endLine + 1, exported });
      continue;
    }
  }

  return entries;
}
