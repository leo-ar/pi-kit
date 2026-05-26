import { SUPPORTED_EXTENSIONS, type Lang, type TextContent } from "./types.ts";

export function extractText(content: unknown): TextContent | undefined {
  if (!Array.isArray(content)) return undefined;
  for (const block of content) {
    if (block && typeof block === "object" && "type" in block && block.type === "text" && "text" in block) {
      return block as TextContent;
    }
  }
  return undefined;
}

export function isSupportedFile(filePath: string): boolean {
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot === -1) return false;
  return SUPPORTED_EXTENSIONS.has(filePath.slice(lastDot).toLowerCase());
}

export function detectLanguage(filePath: string): Lang {
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

export function padRight(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}
