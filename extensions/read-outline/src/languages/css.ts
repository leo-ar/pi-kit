import type { OutlineEntry } from "../types.ts";
import { findBlockEnd } from "../block-end.ts";

export function generateCssOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const indent = lines[i].length - trimmed.length;

    // Skip blank lines and comments
    if (!trimmed || trimmed.startsWith("//")) continue;
    // Skip block comment lines: starts with /* or */, or continuation lines (" * text")
    if (trimmed.startsWith("/*") || trimmed.startsWith("*/")) continue;
    // Multi-line comment continuation: "* " not followed by selector patterns
    // But preserve "*" and "* {..." which are universal selectors
    if (trimmed.startsWith("* ") && !trimmed.includes("{")) continue;

    // At-rules: @media, @keyframes, @layer, @container, @supports, @font-face
    const atRuleMatch = trimmed.match(/^(@(?:media|keyframes|layer|container|supports|font-face|import|charset))\s*(.*)/);
    if (atRuleMatch) {
      const keyword = atRuleMatch[1];
      const rest = atRuleMatch[2].replace(/\s*\{.*$/, "").trim();
      const name = rest ? `${keyword} ${rest}` : keyword;

      // Single-line at-rules without braces (e.g., @import, @charset)
      if (!lines[i].includes("{") && (keyword === "@import" || keyword === "@charset")) {
        entries.push({ kind: "at-rule", name, startLine: i + 1, endLine: i + 1, exported: true });
        continue;
      }

      const endLine = findBlockEnd(lines, i);
      entries.push({ kind: "at-rule", name, startLine: i + 1, endLine: endLine + 1, exported: true });
      continue;
    }

    // CSS custom property declarations at root (:root block)
    // Treat :root as a rule like any other selector

    // Top-level selectors (indent === 0, line contains or is followed by `{`)
    if (indent === 0 && !trimmed.startsWith("}")) {
      // Check if this line opens a rule block
      const hasOpenBrace = trimmed.includes("{");
      const looksLikeSelector = /^[.#:@\[\w*&>~+]/.test(trimmed);

      if (looksLikeSelector || hasOpenBrace) {
        // Extract selector name (everything before the `{`)
        let selectorName: string;
        if (hasOpenBrace) {
          selectorName = trimmed.slice(0, trimmed.indexOf("{")).trim();
        } else {
          // Multi-line selector — next line might have `{`
          selectorName = trimmed.replace(/,\s*$/, "").trim();
        }

        if (selectorName && !selectorName.startsWith("/*")) {
          const endLine = findBlockEnd(lines, i);
          // Only record if we found a block (endLine > i means there was a brace pair)
          if (endLine > i) {
            entries.push({ kind: "rule", name: selectorName, startLine: i + 1, endLine: endLine + 1, exported: true });
            continue;
          }
        }
      }
    }
  }

  return entries;
}
