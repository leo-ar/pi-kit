/**
 * PHP outline — delegates to tree-sitter implementation.
 * Falls back to regex if tree-sitter is unavailable.
 */

import type { OutlineEntry } from "../types.ts";
import { generatePhpOutlineTS } from "./php-ts.ts";

export async function generatePhpOutline(lines: string[]): Promise<OutlineEntry[]> {
  return generatePhpOutlineTS(lines);
}
