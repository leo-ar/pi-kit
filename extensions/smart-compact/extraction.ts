/**
 * Phase 1: Deterministic fact extraction from conversation messages.
 *
 * Pure functions — no I/O, no side effects. Extracts structured facts
 * (files, errors, decisions, constraints, goal) from LLM message arrays.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FileOps {
  read: Set<string>;
  modified: Set<string>;
}

export interface Extraction {
  goal: string;
  files: FileOps;
  errors: string[];
  decisions: string[];
  constraints: string[];
}

export interface ContentBlock {
  type?: string;
  text?: string;
  name?: string;
  arguments?: Record<string, unknown>;
}

export interface Message {
  role: string;
  content?: unknown;
  isError?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return (content as ContentBlock[])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text!)
    .join("\n");
}

// ─── Main Extraction ─────────────────────────────────────────────────────────

export function extractFacts(messages: Message[]): Extraction {
  const files: FileOps = { read: new Set(), modified: new Set() };
  const errors: string[] = [];
  const decisions: string[] = [];
  const constraints: string[] = [];
  let goal = "";

  for (const msg of messages) {
    if (msg.role === "user") {
      const text = extractText(msg.content);

      // First substantial user message is likely the goal
      if (!goal && text.length > 20) {
        const firstLine = text.split("\n").find((l) => l.trim().length > 10);
        if (firstLine) goal = firstLine.trim().slice(0, 300);
      }

      // Constraints: explicit markers or preference language
      const constraintPatterns = [
        /(?:must|should|always|never|don'?t|do not|prefer|avoid|require)\s+(.{10,}?)(?:[.!\n]|$)/gi,
        /(?:constraint|requirement|rule):\s*(.+?)(?:[.!\n]|$)/gi,
      ];
      for (const pat of constraintPatterns) {
        let match: RegExpExecArray | null;
        while ((match = pat.exec(text)) !== null) {
          constraints.push(match[1].trim().slice(0, 200));
        }
      }

      // Decisions: user accepting/rejecting proposals
      const decisionPatterns = [
        /(?:let'?s go with|yes,?\s+do|approved?|go ahead with|use|pick|choose)\s+(.{5,}?)(?:[.!\n]|$)/gi,
        /(?:no,?\s+(?:don'?t|instead))\s+(.{5,}?)(?:[.!\n]|$)/gi,
      ];
      for (const pat of decisionPatterns) {
        let match: RegExpExecArray | null;
        while ((match = pat.exec(text)) !== null) {
          decisions.push(match[1].trim().slice(0, 200));
        }
      }
    }

    if (msg.role === "assistant") {
      const content = msg.content;
      if (!Array.isArray(content)) continue;
      for (const block of content as ContentBlock[]) {
        if (block.type !== "toolCall" || !block.arguments) continue;
        const args = block.arguments as Record<string, string>;
        const name = block.name ?? "";

        // Track file operations
        if (args.path) {
          if (name === "read" || name === "read_hashed") {
            files.read.add(args.path);
          } else if (name === "write" || name === "edit" || name === "hashline_edit") {
            files.modified.add(args.path);
          }
        }
        if (args.filePath) files.modified.add(args.filePath);
      }
    }

    if (msg.role === "toolResult") {
      if (msg.isError) {
        const text = extractText(msg.content);
        const firstLine = text.split("\n")[0] ?? "";
        if (firstLine.length > 5) errors.push(firstLine.slice(0, 200));
      }
    }
  }

  // Deduplicate: remove read-only files that were also modified
  for (const f of files.modified) files.read.delete(f);

  return {
    goal,
    files,
    errors: [...new Set(errors)].slice(-10),
    decisions: [...new Set(decisions)].slice(-10),
    constraints: [...new Set(constraints)].slice(-8),
  };
}
