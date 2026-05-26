/**
 * pi-read-outline — Token-efficient structural outlines for large file reads.
 *
 * Hooks `tool_result` for the `read` tool. When a full-file read returns
 * content exceeding a line threshold, replaces it with a compact structural
 * outline (declarations, classes, functions with line ranges) and a hint
 * telling the agent to re-read specific sections with offset/limit.
 *
 * Design principles:
 * - Zero tool registration (no per-turn token cost)
 * - Only activates on full-file reads (no offset/limit specified)
 * - Passes through small files unchanged
 * - Passes through non-source files unchanged (markdown, json, config, etc.)
 * - Regex-based outline (no WASM dependency for v0.2; upgradeable to tree-sitter)
 * - Preserves file header (imports/requires) for context
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { LINE_THRESHOLD, type ReadInput } from "./types.ts";
import { extractText, isSupportedFile } from "./utils.ts";
import { generateOutline } from "./outline.ts";
import { formatOutlineResult } from "./format.ts";

export default function readOutlineExtension(pi: ExtensionAPI) {
  // Track which files have been outlined this session.
  // If the agent reads the same file a second time without offset/limit,
  // it means it wants the full content — pass through.
  const outlinedFiles = new Set<string>();
  let outlineCount = 0;

  function updateStatus(ctx: { ui: { setStatus(key: string, text: string): void } }) {
    ctx.ui.setStatus("read-outline", `📐 ${outlineCount}`);
  }

  // Reset tracking on new session
  pi.on("session_start", (_event, ctx) => {
    outlinedFiles.clear();
    outlineCount = 0;
    updateStatus(ctx);
  });

  pi.on("tool_result", async (event, ctx) => {
    // Only intercept `read` tool results
    if (event.toolName !== "read") return {};

    const input = (event.input ?? {}) as ReadInput;

    // Pass through if offset/limit specified (targeted read — this is what we want!)
    if (input.offset !== undefined || input.limit !== undefined) return {};

    // Extract text content
    const textBlock = extractText(event.content);
    if (!textBlock) return {};

    // Check file extension
    const filePath = input.path ?? "";
    if (!isSupportedFile(filePath)) return {};

    // If we already outlined this file and the agent is reading it again
    // without offset/limit, it wants the full file — pass through.
    if (outlinedFiles.has(filePath)) {
      outlinedFiles.delete(filePath); // Allow re-outline on third read
      return {};
    }

    // Check line count threshold
    const lines = textBlock.text.split("\n");
    if (lines.length <= LINE_THRESHOLD) return {};

    // Generate outline
    const outline = generateOutline(lines, filePath);
    if (outline.length === 0) return {};

    // Track that we outlined this file
    outlinedFiles.add(filePath);
    outlineCount++;
    updateStatus(ctx);

    // Build replacement content
    const replacement = formatOutlineResult(filePath, lines, outline);

    return {
      content: [{ type: "text", text: replacement }],
    };
  });
}
