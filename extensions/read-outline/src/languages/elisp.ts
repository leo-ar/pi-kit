/**
 * Elisp outline generator using tree-sitter.
 *
 * Walks the AST for top-level forms:
 * - function_definition (defun)
 * - macro_definition (defmacro)
 * - special_form (defvar, defcustom, defconst, defgroup, defface)
 * - Also catches define-minor-mode, define-derived-mode, etc.
 */

import type { OutlineEntry } from "../types.ts";
import { parseSource } from "../tree-sitter/init.ts";

const DEFVAR_KEYWORDS = new Set([
  "defvar", "defcustom", "defconst", "defgroup", "defface",
]);

const MODE_KEYWORDS = new Set([
  "define-minor-mode", "define-derived-mode", "define-globalized-minor-mode",
]);

export async function generateElispOutline(lines: string[]): Promise<OutlineEntry[]> {
  const source = lines.join("\n");
  const root = await parseSource("elisp", source);

  if (!root) return []; // Graceful fallback: no tree-sitter available

  const entries: OutlineEntry[] = [];

  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i);

    if (child.type === "function_definition") {
      // (defun NAME ...)
      const nameNode = child.child(2); // skip "(" and "defun"
      if (nameNode && nameNode.type === "symbol") {
        const name = nameNode.text;
        entries.push({
          kind: "fn",
          name,
          startLine: child.startPosition.row + 1,
          endLine: child.endPosition.row + 1,
          exported: !name.includes("--"),
        });
      }
    } else if (child.type === "macro_definition") {
      // (defmacro NAME ...)
      const nameNode = child.child(2);
      if (nameNode && nameNode.type === "symbol") {
        entries.push({
          kind: "macro",
          name: nameNode.text,
          startLine: child.startPosition.row + 1,
          endLine: child.endPosition.row + 1,
          exported: !nameNode.text.includes("--"),
        });
      }
    } else if (child.type === "special_form" || child.type === "list") {
      // (defvar NAME ...), (defcustom NAME ...), (define-minor-mode NAME ...), etc.
      const keyword = child.child(1);
      if (!keyword) continue;
      const kwText = keyword.text;

      if (DEFVAR_KEYWORDS.has(kwText)) {
        const nameNode = child.child(2);
        if (nameNode && nameNode.type === "symbol") {
          entries.push({
            kind: "var",
            name: nameNode.text,
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
            exported: !nameNode.text.includes("--"),
          });
        }
      } else if (MODE_KEYWORDS.has(kwText)) {
        const nameNode = child.child(2);
        if (nameNode && nameNode.type === "symbol") {
          entries.push({
            kind: "mode",
            name: nameNode.text,
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
            exported: !nameNode.text.includes("--"),
          });
        }
      }
    }
  }

  return entries;
}
