import { MAX_HEADER_LINES, type OutlineEntry } from "./types.ts";
import { padRight } from "./utils.ts";

export function formatOutlineResult(filePath: string, lines: string[], entries: OutlineEntry[]): string {
  const totalLines = lines.length;
  const header = extractHeader(lines);

  const parts: string[] = [];

  // File info
  parts.push(`${filePath} (${totalLines} lines)`);
  parts.push("");

  // Header (imports)
  if (header.length > 0) {
    parts.push("── imports ──");
    parts.push(...header);
    parts.push("");
  }

  // Outline
  parts.push("── outline ──");
  for (const entry of entries) {
    const vis = entry.exported ? "E" : "-";
    const span = entry.startLine === entry.endLine
      ? `${entry.startLine}`
      : `${entry.startLine}:${entry.endLine}`;
    parts.push(`  ${vis} ${padRight(entry.kind, 5)} ${entry.name} [${span}]`);
  }

  // Hint
  parts.push("");
  parts.push("── hint ──");
  parts.push(`File has ${totalLines} lines. Use read with offset/limit to view specific sections.`);
  parts.push(`Example: read(path="${filePath}", offset=<startLine>, limit=<count>)`);

  return parts.join("\n");
}

export function extractHeader(lines: string[]): string[] {
  const header: string[] = [];
  let inHeader = true;

  for (let i = 0; i < Math.min(lines.length, MAX_HEADER_LINES * 2); i++) {
    const trimmed = lines[i].trim();

    if (trimmed === "") {
      if (header.length > 0 && inHeader) {
        // Blank line after imports — end of header
        inHeader = false;
        break;
      }
      continue;
    }

    if (isHeaderLine(trimmed)) {
      header.push(lines[i]);
      if (header.length >= MAX_HEADER_LINES) break;
    } else if (header.length > 0) {
      // First non-header line after some header — done
      break;
    }
  }

  return header;
}

export function isHeaderLine(trimmed: string): boolean {
  return (
    trimmed.startsWith("import ") ||
    trimmed.startsWith("from ") ||
    trimmed.startsWith("require(") ||
    trimmed.startsWith("use ") ||
    trimmed.startsWith("#include") ||
    trimmed.startsWith("package ") ||
    (trimmed.startsWith("const ") && trimmed.includes("require(")) ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("#!") ||
    (trimmed.startsWith("# ") && trimmed.includes("coding")) // -*- coding
  );
}
