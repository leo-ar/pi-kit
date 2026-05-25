/**
 * Lightweight EESV-inspired compaction extension.
 *
 * Replaces pi's default compaction with a structured pipeline:
 *   1. Extract — deterministic fact extraction from messages (zero LLM calls)
 *   2. Synthesize — single LLM call with extracted facts as structured context
 *   3. Verify — deterministic check that critical facts appear in summary
 *
 * Key differences from pi-smart-compact:
 *   - No tool registration (saves ~400 tokens/turn in system prompt)
 *   - No disk artifacts (no backups, no metrics logs, no cache files)
 *   - No shell execution
 *   - Single LLM call (not 1–8)
 *   - ~150 lines vs 200KB bundle
 *
 * Usage: place in ~/.pi/agent/extensions/smart-compact.ts, /reload
 */

import { complete } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FileOps {
  read: Set<string>;
  modified: Set<string>;
}

interface Extraction {
  goal: string;
  files: FileOps;
  errors: string[];
  decisions: string[];
  constraints: string[];
}

interface ContentBlock {
  type?: string;
  text?: string;
  name?: string;
  arguments?: Record<string, unknown>;
}

// ─── Phase 1: Deterministic Extraction ───────────────────────────────────────

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return (content as ContentBlock[])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text!)
    .join("\n");
}

function extractFacts(messages: Array<{ role: string; content?: unknown; isError?: boolean }>): Extraction {
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
        /(?:must|should|always|never|don'?t|do not|prefer|avoid|require)\s+(.{10,})/gi,
        /(?:constraint|requirement|rule):\s*(.+)/gi,
      ];
      for (const pat of constraintPatterns) {
        const match = pat.exec(text);
        if (match) constraints.push(match[1].trim().slice(0, 200));
      }

      // Decisions: user accepting/rejecting proposals
      const decisionPatterns = [
        /(?:let'?s go with|yes,?\s+do|approved?|go ahead with|use|pick|choose)\s+(.{5,})/gi,
        /(?:no,?\s+(?:don'?t|instead))\s+(.{5,})/gi,
      ];
      for (const pat of decisionPatterns) {
        const match = pat.exec(text);
        if (match) decisions.push(match[1].trim().slice(0, 200));
      }
    }

    if (msg.role === "assistant") {
      const content = msg.content as ContentBlock[];
      for (const block of content) {
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
      const tr = msg as { isError?: boolean; content?: ContentBlock[] };
      if (tr.isError) {
        const text = extractText(tr.content);
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

// ─── Phase 2: LLM Synthesis (single call) ────────────────────────────────────

function buildSynthesisPrompt(
  conversationText: string,
  extraction: Extraction,
  previousSummary?: string,
): string {
  const factsBlock = [
    `<extracted-facts>`,
    `Goal: ${extraction.goal || "(not explicitly stated)"}`,
    `Files modified: ${[...extraction.files.modified].join(", ") || "none"}`,
    `Files read: ${[...extraction.files.read].join(", ") || "none"}`,
    extraction.errors.length ? `Unresolved errors:\n${extraction.errors.map((e) => `  - ${e}`).join("\n")}` : "",
    extraction.decisions.length ? `Key decisions:\n${extraction.decisions.map((d) => `  - ${d}`).join("\n")}` : "",
    extraction.constraints.length ? `Constraints:\n${extraction.constraints.map((c) => `  - ${c}`).join("\n")}` : "",
    `</extracted-facts>`,
  ]
    .filter(Boolean)
    .join("\n");

  const previousBlock = previousSummary
    ? `\n<previous-summary>\n${previousSummary}\n</previous-summary>\n`
    : "";

  return `You are a context compaction assistant. Produce a structured summary of the conversation below.

IMPORTANT: Do NOT continue the conversation. Only output the structured summary.

The summary MUST include ALL modified files and unresolved errors from the extracted facts.
If there is a previous summary, incorporate its still-relevant content (don't lose accumulated context).

Output format (use exactly these headings):

## Goal
[Single sentence: what the user is trying to accomplish]

## Constraints & Preferences
- [Each requirement, preference, or prohibition mentioned]

## Progress
### Done
- [x] [Completed tasks with specific details]

### In Progress
- [ ] [Current work]

### Blocked
- [Issues preventing progress, if any]

## Key Decisions
- **[Decision]**: [Rationale or context]

## Next Steps
1. [Most important next action]
2. [Secondary actions]

## Critical Context
- [Data, findings, or state needed to continue work effectively]
${previousBlock}
${factsBlock}

<conversation>
${conversationText}
</conversation>`;
}

// ─── Phase 3: Deterministic Verification ─────────────────────────────────────

function verify(summary: string, extraction: Extraction): string[] {
  const gaps: string[] = [];
  const lower = summary.toLowerCase();

  // Every modified file must appear in the summary
  for (const f of extraction.files.modified) {
    const filename = f.split("/").pop() ?? f;
    if (!lower.includes(filename.toLowerCase()) && !lower.includes(f.toLowerCase())) {
      gaps.push(`Missing modified file: ${f}`);
    }
  }

  // Unresolved errors should be mentioned
  for (const err of extraction.errors.slice(-3)) {
    const snippet = err.slice(0, 30).toLowerCase();
    if (snippet.length > 5 && !lower.includes(snippet)) {
      gaps.push(`Missing error: ${err.slice(0, 80)}`);
    }
  }

  return gaps;
}

function patchSummary(summary: string, gaps: string[], extraction: Extraction): string {
  if (gaps.length === 0) return summary;

  const patches: string[] = [];

  // Add missing files
  const missingFiles = gaps
    .filter((g) => g.startsWith("Missing modified file:"))
    .map((g) => g.replace("Missing modified file: ", ""));
  if (missingFiles.length > 0) {
    patches.push(`\n\n<modified-files>\n${missingFiles.join("\n")}\n</modified-files>`);
  }

  // Add missing errors
  const missingErrors = gaps
    .filter((g) => g.startsWith("Missing error:"))
    .map((g) => g.replace("Missing error: ", ""));
  if (missingErrors.length > 0) {
    const errorBlock = missingErrors.map((e) => `- ${e}`).join("\n");
    patches.push(`\n\n## Unresolved Errors\n${errorBlock}`);
  }

  return summary + patches.join("");
}

// ─── Extension Entry Point ───────────────────────────────────────────────────

export default function smartCompact(pi: ExtensionAPI) {
  pi.on("session_before_compact", async (event, ctx) => {
    const { preparation, signal } = event;
    const { messagesToSummarize, turnPrefixMessages, tokensBefore, firstKeptEntryId, previousSummary } = preparation;

    // Combine all messages to summarize
    const allMessages = [...messagesToSummarize, ...turnPrefixMessages];
    if (allMessages.length === 0) return;

    // Phase 1: Deterministic extraction
    const llmMessages = convertToLlm(allMessages);
    const extraction = extractFacts(llmMessages);

    // Use the current conversation model for synthesis (no extra model needed)
    const model = ctx.model;
    if (!model) {
      ctx.ui.notify("smart-compact: no model available, using default compaction", "warning");
      return;
    }

    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok || !auth.apiKey) {
      ctx.ui.notify("smart-compact: auth failed, using default compaction", "warning");
      return;
    }

    // Serialize conversation (tool results truncated to 2K by pi's serializer)
    const conversationText = serializeConversation(llmMessages);

    // Phase 2: Single LLM synthesis call
    const prompt = buildSynthesisPrompt(conversationText, extraction, previousSummary);

    ctx.ui.notify(
      `Compacting ${allMessages.length} messages (${Math.round(tokensBefore / 1000)}K tokens)...`,
      "info",
    );

    try {
      const response = await complete(
        model,
        {
          messages: [
            {
              role: "user" as const,
              content: [{ type: "text" as const, text: prompt }],
              timestamp: Date.now(),
            },
          ],
        },
        {
          apiKey: auth.apiKey,
          headers: auth.headers,
          maxTokens: 6000,
          signal,
        },
      );

      let summary = response.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n");

      if (!summary.trim()) {
        if (!signal.aborted) ctx.ui.notify("smart-compact: empty summary, falling back to default", "warning");
        return;
      }

      // Phase 3: Deterministic verification + patch
      const gaps = verify(summary, extraction);
      if (gaps.length > 0) {
        summary = patchSummary(summary, gaps, extraction);
      }

      // Append file tracking tags (pi's standard format)
      const readFiles = [...extraction.files.read].filter((f) => !extraction.files.modified.has(f));
      const modifiedFiles = [...extraction.files.modified];

      if (readFiles.length > 0) {
        summary += `\n\n<read-files>\n${readFiles.join("\n")}\n</read-files>`;
      }
      if (modifiedFiles.length > 0) {
        summary += `\n\n<modified-files>\n${modifiedFiles.join("\n")}\n</modified-files>`;
      }

      return {
        compaction: {
          summary,
          firstKeptEntryId,
          tokensBefore,
        },
      };
    } catch (error) {
      if (signal.aborted) return;
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`smart-compact: ${message}, using default compaction`, "error");
      return;
    }
  });

  pi.registerCommand("compact-stats", {
    description: "Show what smart-compact would extract from the current session",
    handler: async (_args, ctx) => {
      const branch = ctx.sessionManager.getBranch();
      const agentMessages = branch
        .filter((e): e is { type: "message"; message: any } => e.type === "message")
        .map((e) => e.message);

      if (agentMessages.length === 0) {
        ctx.ui.notify("No messages in session", "info");
        return;
      }

      const messages = convertToLlm(agentMessages);
      const extraction = extractFacts(messages);
      const lines = [
        `**Goal:** ${extraction.goal || "(none detected)"}`,
        `**Files modified:** ${extraction.files.modified.size}`,
        `**Files read:** ${extraction.files.read.size}`,
        `**Errors:** ${extraction.errors.length}`,
        `**Decisions:** ${extraction.decisions.length}`,
        `**Constraints:** ${extraction.constraints.length}`,
        "",
        extraction.files.modified.size > 0
          ? `Modified: ${[...extraction.files.modified].slice(-10).join(", ")}`
          : "",
        extraction.errors.length > 0
          ? `Last error: ${extraction.errors[extraction.errors.length - 1]}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      ctx.ui.notify(lines, "info");
    },
  });
}
