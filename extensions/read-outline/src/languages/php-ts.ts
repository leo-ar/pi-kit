/**
 * PHP outline generator using tree-sitter.
 *
 * Walks the AST for:
 * - namespace_definition
 * - class_declaration (class, abstract class, final class)
 * - interface_declaration
 * - trait_declaration
 * - enum_declaration
 * - function_definition (top-level)
 * - method_declaration (inside classes)
 * - const_declaration (inside classes)
 * - expression_statement containing define() calls
 */

import type { OutlineEntry } from "../types.ts";
import { parseSource } from "../tree-sitter/init.ts";
import { generatePhpOutlineRegex } from "./php-regex.ts";

export async function generatePhpOutlineTS(lines: string[]): Promise<OutlineEntry[]> {
  const source = lines.join("\n");
  const root = await parseSource("php", source);

  // Graceful fallback to regex if tree-sitter unavailable
  if (!root) return generatePhpOutlineRegex(lines);

  const entries: OutlineEntry[] = [];
  walkNode(root, entries);
  return entries;
}

function walkNode(node: any, entries: OutlineEntry[]): void {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);

    switch (child.type) {
      case "namespace_definition": {
        const nameNode = findChild(child, "namespace_name");
        if (nameNode) {
          entries.push({
            kind: "namespace",
            name: nameNode.text,
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
            exported: true,
          });
        }
        break;
      }

      case "class_declaration": {
        const nameNode = findChild(child, "name");
        if (nameNode) {
          entries.push({
            kind: "class",
            name: nameNode.text,
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
            exported: true,
          });
          // Walk into declaration_list for methods and constants
          const body = findChild(child, "declaration_list");
          if (body) walkClassBody(body, entries);
        }
        break;
      }

      case "interface_declaration": {
        const nameNode = findChild(child, "name");
        if (nameNode) {
          entries.push({
            kind: "interface",
            name: nameNode.text,
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
            exported: true,
          });
        }
        break;
      }

      case "trait_declaration": {
        const nameNode = findChild(child, "name");
        if (nameNode) {
          entries.push({
            kind: "trait",
            name: nameNode.text,
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
            exported: true,
          });
          const body = findChild(child, "declaration_list");
          if (body) walkClassBody(body, entries);
        }
        break;
      }

      case "enum_declaration": {
        const nameNode = findChild(child, "name");
        if (nameNode) {
          entries.push({
            kind: "enum",
            name: nameNode.text,
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
            exported: true,
          });
        }
        break;
      }

      case "function_definition": {
        const nameNode = findChild(child, "name");
        if (nameNode) {
          entries.push({
            kind: "fn",
            name: nameNode.text,
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
            exported: true,
          });
        }
        break;
      }

      case "expression_statement": {
        // Check for define('NAME', value)
        const call = findChild(child, "function_call_expression");
        if (call) {
          const fnName = findChild(call, "name");
          if (fnName?.text === "define") {
            const args = findChild(call, "arguments");
            if (args) {
              // First argument node (skip punctuation)
              const firstArg = findChild(args, "argument");
              if (firstArg) {
                // The argument contains a string or encapsed_string
                const strNode = firstArg.child(0);
                if (strNode && (strNode.type === "string" || strNode.type === "encapsed_string")) {
                  const constName = strNode.text.replace(/^['"]|['"]$/g, "");
                  entries.push({
                    kind: "const",
                    name: constName,
                    startLine: child.startPosition.row + 1,
                    endLine: child.endPosition.row + 1,
                    exported: true,
                  });
                }
              }
            }
          }
        }
        break;
      }

      default:
        // Recurse into program/compound nodes
        if (child.type === "program" || child.type === "php_tag" || child.type === "text") {
          walkNode(child, entries);
        }
        break;
    }
  }
}

function walkClassBody(node: any, entries: OutlineEntry[]): void {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);

    if (child.type === "method_declaration") {
      const nameNode = findChild(child, "name");
      if (nameNode) {
        const visibility = getVisibility(child);
        entries.push({
          kind: "fn",
          name: nameNode.text,
          startLine: child.startPosition.row + 1,
          endLine: child.endPosition.row + 1,
          exported: visibility !== "private",
        });
      }
    } else if (child.type === "const_declaration") {
      const nameNode = findChild(child, "const_element");
      if (nameNode) {
        const name = findChild(nameNode, "name");
        if (name) {
          const visibility = getVisibility(child);
          entries.push({
            kind: "const",
            name: name.text,
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
            exported: visibility !== "private",
          });
        }
      }
    }
  }
}

function getVisibility(node: any): "public" | "protected" | "private" {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "visibility_modifier") {
      const text = child.text;
      if (text === "private") return "private";
      if (text === "protected") return "protected";
    }
  }
  return "public";
}

function findChild(node: any, type: string): any | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === type) return child;
  }
  return null;
}
