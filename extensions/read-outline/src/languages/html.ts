import type { OutlineEntry } from "../types.ts";

/** Semantic/structural HTML tags worth outlining */
const SEMANTIC_TAGS = new Set([
  "html", "head", "body",
  "header", "footer", "main", "nav", "aside",
  "section", "article",
  "form", "table", "dialog",
  "script", "style", "template",
  "div", "ul", "ol",
]);

export function generateHtmlOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();

    // Match opening tags
    const tagMatch = trimmed.match(/^<(\w+)([\s>])/);
    if (!tagMatch) continue;

    const tagName = tagMatch[1].toLowerCase();
    if (!SEMANTIC_TAGS.has(tagName)) continue;

    // Extract id/class for identification
    const idMatch = lines[i].match(/\bid=["']([^"']+)["']/);
    const classMatch = lines[i].match(/\bclass=["']([^"']+)["']/);

    let name = tagName;
    if (idMatch) {
      name = `${tagName}#${idMatch[1]}`;
    } else if (classMatch) {
      // Use first class only for brevity
      const firstClass = classMatch[1].split(/\s+/)[0];
      name = `${tagName}.${firstClass}`;
    }

    // Find closing tag
    const endLine = findHtmlBlockEnd(lines, i, tagName);

    entries.push({ kind: "tag", name, startLine: i + 1, endLine: endLine + 1, exported: true });
  }

  return entries;
}

/**
 * Find the matching closing tag for an opening tag.
 * Handles nesting of the same tag name.
 */
function findHtmlBlockEnd(lines: string[], startIdx: number, tagName: string): number {
  // Self-closing check
  const startLine = lines[startIdx];
  if (startLine.match(/\/>\s*$/)) return startIdx;

  // Check if opening and closing on same line
  const closeRegex = new RegExp(`</${tagName}\\s*>`, "i");
  if (closeRegex.test(startLine)) return startIdx;

  const openRegex = new RegExp(`<${tagName}[\\s>]`, "ig");
  let depth = 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];

    // Count opens on this line
    const opens = line.match(openRegex);
    if (opens) depth += opens.length;

    // Count closes on this line
    const closeAll = new RegExp(`</${tagName}\\s*>`, "ig");
    const closes = line.match(closeAll);
    if (closes) depth -= closes.length;

    if (depth <= 0) return i;
  }

  // No closing found — return last line
  return lines.length - 1;
}
