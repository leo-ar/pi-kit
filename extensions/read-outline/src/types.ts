// ─── Configuration Constants ─────────────────────────────────────────────────

/** Files with more lines than this get outline treatment */
export const LINE_THRESHOLD = 150;

/** How many header lines to preserve verbatim (imports, requires, use statements) */
export const MAX_HEADER_LINES = 20;

/** Supported languages (by file extension) */
export const SUPPORTED_EXTENSIONS = new Set([
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
  ".php",
  ".css", ".scss", ".less",
  ".html", ".htm", ".vue", ".svelte",
  ".el",
]);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OutlineEntry {
  kind: string;       // "fn" | "class" | "interface" | "type" | "struct" | "enum" | "const" | "method" | "trait" | "impl"
  name: string;
  startLine: number;
  endLine: number;
  exported: boolean;
  members?: OutlineEntry[];
}

export interface ReadInput {
  path?: string;
  offset?: number;
  limit?: number;
}

export interface TextContent {
  type: "text";
  text: string;
}

export type Lang =
  | "typescript" | "javascript"
  | "python"
  | "rust"
  | "go"
  | "java" | "kotlin" | "csharp"
  | "c" | "cpp"
  | "ruby"
  | "swift" | "zig"
  | "php"
  | "css"
  | "html"
  | "elisp"
  | "unknown";
