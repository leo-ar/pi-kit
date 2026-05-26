import type { OutlineEntry } from "./types.ts";
import { detectLanguage } from "./utils.ts";
import { generateTsOutline } from "./languages/typescript.ts";
import { generatePythonOutline } from "./languages/python.ts";
import { generateRustOutline } from "./languages/rust.ts";
import { generateGoOutline } from "./languages/go.ts";
import { generateJavaLikeOutline } from "./languages/java-like.ts";
import { generateCOutline } from "./languages/c-cpp.ts";
import { generateRubyOutline } from "./languages/ruby.ts";
import { generateGenericOutline } from "./languages/generic.ts";

export function generateOutline(lines: string[], filePath: string): OutlineEntry[] {
  const lang = detectLanguage(filePath);

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
