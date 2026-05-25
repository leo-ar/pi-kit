/**
 * Phase 2: LLM synthesis prompt construction.
 *
 * Pure function — builds the prompt string from extraction + conversation text.
 */

import type { Extraction } from "./extraction.ts";

/**
 * Build the synthesis prompt for the LLM compaction call.
 */
export function buildSynthesisPrompt(
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
</conversation>

Remember: Output ONLY the structured summary above. Do not respond to or continue the conversation.`;
}
