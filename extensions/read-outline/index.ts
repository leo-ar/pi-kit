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
 * - Regex-based outline (no WASM dependency for v0.1; upgradeable to tree-sitter)
 * - Preserves file header (imports/requires) for context
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ─── Configuration ───────────────────────────────────────────────────────────

/** Files with more lines than this get outline treatment */
const LINE_THRESHOLD = 150;

/** How many header lines to preserve verbatim (imports, requires, use statements) */
const MAX_HEADER_LINES = 20;

/** Supported languages (by file extension) */
const SUPPORTED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts",
  ".py", ".pyi",
  ".rs",
  ".go",
  ".java", ".kt", ".kts",
  ".c", ".h", ".cpp", ".hpp", ".cc", ".cxx",
  ".cs",
  ".rb",
  ".swift",
  ".zig",
]);

// ─── Types ───────────────────────────────────────────────────────────────────

interface OutlineEntry {
  kind: string;       // "fn" | "class" | "interface" | "type" | "struct" | "enum" | "const" | "method" | "trait" | "impl"
  name: string;
  startLine: number;
  endLine: number;
  exported: boolean;
  members?: OutlineEntry[];
}

interface ReadInput {
  path?: string;
  offset?: number;
  limit?: number;
}

interface TextContent {
  type: "text";
  text: string;
}

// ─── Extension Entry Point ───────────────────────────────────────────────────

export default function readOutlineExtension(pi: ExtensionAPI) {
  // Track which files have been outlined this session.
  // If the agent reads the same file a second time without offset/limit,
  // it means it wants the full content — pass through.
  const outlinedFiles = new Set<string>();

  // Reset tracking on new session
  pi.on("session_start", () => {
    outlinedFiles.clear();
  });

  pi.on("tool_result", async (event) => {
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

    // Build replacement content
    const replacement = formatOutlineResult(filePath, lines, outline);

    return {
      content: [{ type: "text", text: replacement }],
    };
  });
}

// ─── Outline Generation ──────────────────────────────────────────────────────

function generateOutline(lines: string[], filePath: string): OutlineEntry[] {
  const lang = detectLanguage(filePath);
  const entries: OutlineEntry[] = [];

  switch (lang) {
    case "typescript":
    case "javascript":
      return generateTsOutline(lines);
    case "python":
      return generatePythonOutline(lines);
    case "rust":
      return generateRustOutline(lines);
    case "go":
      return generateGoOutline(lines);
    case "java":
    case "kotlin":
    case "csharp":
      return generateJavaLikeOutline(lines);
    case "c":
    case "cpp":
      return generateCOutline(lines);
    case "ruby":
      return generateRubyOutline(lines);
    default:
      return generateGenericOutline(lines);
  }
}

// ─── TypeScript / JavaScript ─────────────────────────────────────────────────

function generateTsOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  const patterns = [
    // export class/interface/type/enum
    /^(export\s+)?(default\s+)?(abstract\s+)?(class|interface|type|enum)\s+(\w+)/,
    // export function / async function
    /^(export\s+)?(default\s+)?(async\s+)?function\s*\*?\s*(\w+)/,
    // export const/let/var (arrow fns or objects)
    /^(export\s+)?(const|let|var)\s+(\w+)\s*[=:]/,
    // method-like (inside class): name(...) or async name(...)
    /^\s+(static\s+)?(async\s+)?(get\s+|set\s+)?(\w+)\s*\(/,
  ];

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

// ─── Python ──────────────────────────────────────────────────────────────────

function generatePythonOutline(lines: string[]): OutlineEntry[] {
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

// ─── Rust ────────────────────────────────────────────────────────────────────

function generateRustOutline(lines: string[]): OutlineEntry[] {
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

// ─── Go ──────────────────────────────────────────────────────────────────────

function generateGoOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();

    // func
    const fnMatch = trimmed.match(/^func\s+(\(.*?\)\s+)?(\w+)/);
    if (fnMatch) {
      const name = fnMatch[2];
      const exported = name[0] === name[0].toUpperCase();
      const endLine = findBlockEnd(lines, i);
      entries.push({ kind: "fn", name, startLine: i + 1, endLine: endLine + 1, exported });
      continue;
    }

    // type struct/interface
    const typeMatch = trimmed.match(/^type\s+(\w+)\s+(struct|interface)/);
    if (typeMatch) {
      const name = typeMatch[1];
      const kind = typeMatch[2];
      const exported = name[0] === name[0].toUpperCase();
      const endLine = findBlockEnd(lines, i);
      entries.push({ kind, name, startLine: i + 1, endLine: endLine + 1, exported });
      continue;
    }

    // const/var blocks
    const constMatch = trimmed.match(/^(const|var)\s+(\w+)/);
    if (constMatch) {
      const name = constMatch[2];
      const exported = name[0] === name[0].toUpperCase();
      entries.push({ kind: "const", name, startLine: i + 1, endLine: i + 1, exported });
    }
  }

  return entries;
}

// ─── Java / Kotlin / C# ─────────────────────────────────────────────────────

function generateJavaLikeOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const indent = lines[i].length - trimmed.length;

    // class/interface/enum
    const classMatch = trimmed.match(/^(public\s+|private\s+|protected\s+)?(abstract\s+|static\s+)?(class|interface|enum|record)\s+(\w+)/);
    if (classMatch) {
      const exported = !trimmed.startsWith("private");
      const kind = classMatch[3];
      const name = classMatch[4];
      const endLine = findBlockEnd(lines, i);
      entries.push({ kind, name, startLine: i + 1, endLine: endLine + 1, exported });
      continue;
    }

    // Top-level method (indent ≤ 4, has parens and braces or semicolon)
    if (indent <= 4) {
      const fnMatch = trimmed.match(/^(public\s+|private\s+|protected\s+)?(static\s+)?(async\s+)?(\w+)\s+(\w+)\s*\(/);
      if (fnMatch && !["if", "for", "while", "switch", "catch", "return", "new"].includes(fnMatch[4])) {
        const exported = !trimmed.startsWith("private");
        const name = fnMatch[5];
        const endLine = findBlockEnd(lines, i);
        entries.push({ kind: "fn", name, startLine: i + 1, endLine: endLine + 1, exported });
      }
    }
  }

  return entries;
}

// ─── C / C++ ─────────────────────────────────────────────────────────────────

function generateCOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    if (indent > 0) continue;
    if (trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;

    // struct/enum/union/class
    const structMatch = trimmed.match(/^(typedef\s+)?(struct|enum|union|class)\s+(\w+)/);
    if (structMatch) {
      const name = structMatch[3];
      const endLine = findBlockEnd(lines, i);
      entries.push({ kind: structMatch[2], name, startLine: i + 1, endLine: endLine + 1, exported: true });
      continue;
    }

    // Function definition (has parens, followed by { on same/next line)
    const fnMatch = trimmed.match(/^(\w[\w*&\s]+?)\s+(\w+)\s*\([^;]*$/);
    if (fnMatch && !["if", "for", "while", "switch", "return", "typedef"].includes(fnMatch[2])) {
      const name = fnMatch[2];
      const endLine = findBlockEnd(lines, i);
      if (endLine > i) { // Only if it has a body (not just a declaration)
        entries.push({ kind: "fn", name, startLine: i + 1, endLine: endLine + 1, exported: true });
      }
    }
  }

  return entries;
}

// ─── Ruby ────────────────────────────────────────────────────────────────────

function generateRubyOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const indent = lines[i].length - trimmed.length;

    if (indent > 2) continue;

    const classMatch = trimmed.match(/^(class|module)\s+(\w+)/);
    if (classMatch) {
      const endLine = findRubyBlockEnd(lines, i);
      entries.push({ kind: classMatch[1], name: classMatch[2], startLine: i + 1, endLine: endLine + 1, exported: true });
      continue;
    }

    const fnMatch = trimmed.match(/^def\s+(self\.)?(\w+[?!]?)/);
    if (fnMatch) {
      const endLine = findRubyBlockEnd(lines, i);
      entries.push({ kind: "fn", name: fnMatch[2], startLine: i + 1, endLine: endLine + 1, exported: true });
    }
  }

  return entries;
}

// ─── Generic (fallback) ──────────────────────────────────────────────────────

function generateGenericOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const indent = lines[i].length - trimmed.length;

    if (indent > 0) continue;

    // Catch function-like patterns
    const fnMatch = trimmed.match(/^(pub\s+|export\s+)?(async\s+)?(fn|def|func|function)\s+(\w+)/);
    if (fnMatch) {
      const endLine = findBlockEnd(lines, i);
      entries.push({ kind: "fn", name: fnMatch[4], startLine: i + 1, endLine: endLine + 1, exported: !!fnMatch[1] });
      continue;
    }

    // Catch class/struct/enum
    const classMatch = trimmed.match(/^(pub\s+|export\s+)?(class|struct|enum|interface|trait|type)\s+(\w+)/);
    if (classMatch) {
      const endLine = findBlockEnd(lines, i);
      entries.push({ kind: classMatch[2], name: classMatch[3], startLine: i + 1, endLine: endLine + 1, exported: !!classMatch[1] });
    }
  }

  return entries;
}

// ─── Block End Detection ─────────────────────────────────────────────────────

/** Find closing brace for languages with { } blocks */
function findBlockEnd(lines: string[], startIdx: number): number {
  let depth = 0;
  let foundOpen = false;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") { depth++; foundOpen = true; }
      if (ch === "}") { depth--; }
      if (foundOpen && depth === 0) return i;
    }
  }

  // If no braces found, it's a single-line declaration
  if (!foundOpen) return startIdx;

  // Unclosed block — return end of file
  return lines.length - 1;
}

/** Find end of a statement (handles multi-line const = ... ) */
function findStatementEnd(lines: string[], startIdx: number): number {
  let depth = 0;
  let parenDepth = 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
      if (ch === "(") parenDepth++;
      if (ch === ")") parenDepth--;
    }
    // Statement ends when we're back to zero depth and line doesn't end with comma/operator
    if (i > startIdx && depth === 0 && parenDepth === 0) {
      const trimmed = line.trim();
      if (!trimmed.endsWith(",") && !trimmed.endsWith("(") && !trimmed.endsWith("{")) {
        return i;
      }
    }
  }
  return startIdx;
}

/** Find end of a Python block (indentation-based) */
function findPythonBlockEnd(lines: string[], startIdx: number): number {
  const startIndent = lines[startIdx].length - lines[startIdx].trimStart().length;

  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue; // Skip blank lines
    const indent = line.length - line.trimStart().length;
    if (indent <= startIndent) return i - 1;
  }

  return lines.length - 1;
}

/** Find end of a Ruby block (end keyword based) */
function findRubyBlockEnd(lines: string[], startIdx: number): number {
  const startIndent = lines[startIdx].length - lines[startIdx].trimStart().length;
  let depth = 1;

  for (let i = startIdx + 1; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const indent = lines[i].length - trimmed.length;

    if (/^(class|module|def|do|if|unless|case|begin|while|until|for)\b/.test(trimmed) && indent >= startIndent) {
      depth++;
    }
    if (trimmed === "end" || trimmed.startsWith("end ")) {
      depth--;
      if (depth === 0) return i;
    }
  }

  return lines.length - 1;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

function formatOutlineResult(filePath: string, lines: string[], entries: OutlineEntry[]): string {
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

function extractHeader(lines: string[]): string[] {
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

function isHeaderLine(trimmed: string): boolean {
  return (
    trimmed.startsWith("import ") ||
    trimmed.startsWith("from ") ||
    trimmed.startsWith("require(") ||
    trimmed.startsWith("use ") ||
    trimmed.startsWith("#include") ||
    trimmed.startsWith("package ") ||
    trimmed.startsWith("const ") && trimmed.includes("require(") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("#!") ||
    trimmed.startsWith("# ") && trimmed.includes("coding") // -*- coding
  );
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function extractText(content: unknown): TextContent | undefined {
  if (!Array.isArray(content)) return undefined;
  for (const block of content) {
    if (block && typeof block === "object" && "type" in block && block.type === "text" && "text" in block) {
      return block as TextContent;
    }
  }
  return undefined;
}

function isSupportedFile(filePath: string): boolean {
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot === -1) return false;
  return SUPPORTED_EXTENSIONS.has(filePath.slice(lastDot).toLowerCase());
}

type Lang = "typescript" | "javascript" | "python" | "rust" | "go" | "java" | "kotlin" | "csharp" | "c" | "cpp" | "ruby" | "swift" | "zig" | "unknown";

function detectLanguage(filePath: string): Lang {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  const map: Record<string, Lang> = {
    ".ts": "typescript", ".tsx": "typescript", ".mts": "typescript",
    ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript",
    ".py": "python", ".pyi": "python",
    ".rs": "rust",
    ".go": "go",
    ".java": "java",
    ".kt": "kotlin", ".kts": "kotlin",
    ".cs": "csharp",
    ".c": "c", ".h": "c",
    ".cpp": "cpp", ".hpp": "cpp", ".cc": "cpp", ".cxx": "cpp",
    ".rb": "ruby",
    ".swift": "swift",
    ".zig": "zig",
  };
  return map[ext] ?? "unknown";
}

function padRight(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}
