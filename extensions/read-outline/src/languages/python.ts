import type { OutlineEntry } from "../types.ts";
import { findPythonBlockEnd } from "../block-end.ts";

export function generatePythonOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const indent = line.length - line.trimStart().length;

    // Top-level class
    const classMatch = trimmed.match(/^class\s+(\w+)/);
    if (classMatch && indent === 0) {
      const name = classMatch[1];
      const endLine = findPythonBlockEnd(lines, i);
      entries.push({ kind: "class", name, startLine: i + 1, endLine: endLine + 1, exported: true });
      continue;
    }

    // Top-level def / async def
    const fnMatch = trimmed.match(/^(async\s+)?def\s+(\w+)/);
    if (fnMatch && indent === 0) {
      const name = fnMatch[2];
      const endLine = findPythonBlockEnd(lines, i);
      const exported = !name.startsWith("_");
      entries.push({ kind: "fn", name, startLine: i + 1, endLine: endLine + 1, exported });
      continue;
    }

    // Top-level assignments (constants)
    const constMatch = trimmed.match(/^([A-Z][A-Z_0-9]+)\s*=/);
    if (constMatch && indent === 0) {
      entries.push({ kind: "const", name: constMatch[1], startLine: i + 1, endLine: i + 1, exported: true });
    }
  }

  return entries;
}
