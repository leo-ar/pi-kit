/**
 * Generator-based compaction pipeline.
 *
 * Yields effects for I/O operations (model lookup, auth, LLM call, notify).
 * The extension entry point acts as the runner that interprets these effects.
 * Tests step through the generator with scripted responses.
 */

import type { Extraction, Message } from "./extraction.ts";
import { extractFacts } from "./extraction.ts";
import { buildSynthesisPrompt } from "./prompts.ts";
import { verify, patchSummary } from "./verification.ts";

// ─── Effect Types ────────────────────────────────────────────────────────────

export type CompactEffect =
  | { tag: "get_model" }
  | { tag: "get_auth"; model: unknown }
  | { tag: "notify"; message: string; level: "info" | "warning" | "error" }
  | { tag: "serialize"; messages: Message[] }
  | {
      tag: "llm_complete";
      model: unknown;
      prompt: string;
      apiKey: string;
      headers?: Record<string, string>;
    };

// ─── Pipeline Result ─────────────────────────────────────────────────────────

export interface CompactionOutput {
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
}

// ─── Pipeline Input ──────────────────────────────────────────────────────────

export interface PipelineInput {
  messages: Message[];
  tokensBefore: number;
  firstKeptEntryId: string;
  previousSummary?: string;
  /** Max chars for serialized conversation (prevents context overflow) */
  maxConversationChars?: number;
}

// ─── The Pipeline Generator ──────────────────────────────────────────────────

export function* compactPipeline(
  input: PipelineInput,
): Generator<CompactEffect, CompactionOutput | undefined, any> {
  const { messages, tokensBefore, firstKeptEntryId, previousSummary, maxConversationChars } = input;

  if (messages.length === 0) return undefined;

  // Phase 1: Deterministic extraction (pure, no effect needed)
  const extraction = extractFacts(messages);

  // Get model
  const model: unknown = yield { tag: "get_model" };
  if (!model) {
    yield { tag: "notify", message: "smart-compact: no model available, using default compaction", level: "warning" };
    return undefined;
  }

  // Get auth
  const auth: { ok: boolean; apiKey?: string; headers?: Record<string, string> } = yield {
    tag: "get_auth",
    model,
  };
  if (!auth.ok || !auth.apiKey) {
    yield { tag: "notify", message: "smart-compact: auth failed, using default compaction", level: "warning" };
    return undefined;
  }

  // Serialize conversation (effect because it uses pi's serializer)
  let conversationText: string = yield { tag: "serialize", messages };

  // Cap conversation length to prevent context overflow on synthesis call
  if (maxConversationChars && conversationText.length > maxConversationChars) {
    conversationText = conversationText.slice(-maxConversationChars);
  }

  // Phase 2: LLM synthesis
  const prompt = buildSynthesisPrompt(conversationText, extraction, previousSummary);

  yield {
    tag: "notify",
    message: `Compacting ${messages.length} messages (${Math.round(tokensBefore / 1000)}K tokens)...`,
    level: "info",
  };

  const llmResponse: string | undefined = yield {
    tag: "llm_complete",
    model,
    prompt,
    apiKey: auth.apiKey,
    headers: auth.headers,
  };

  if (!llmResponse || !llmResponse.trim()) {
    yield { tag: "notify", message: "smart-compact: empty summary, falling back to default", level: "warning" };
    return undefined;
  }

  // Phase 3: Deterministic verification + patch (pure)
  let summary = llmResponse;
  const gaps = verify(summary, extraction);
  if (gaps.length > 0) {
    summary = patchSummary(summary, gaps);
  }

  // Append file tracking tags (pi's standard format)
  summary = appendFileTags(summary, extraction);

  return { summary, firstKeptEntryId, tokensBefore };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function appendFileTags(summary: string, extraction: Extraction): string {
  const readFiles = [...extraction.files.read];
  const modifiedFiles = [...extraction.files.modified];

  if (readFiles.length > 0) {
    summary += `\n\n<read-files>\n${readFiles.join("\n")}\n</read-files>`;
  }
  if (modifiedFiles.length > 0) {
    summary += `\n\n<modified-files>\n${modifiedFiles.join("\n")}\n</modified-files>`;
  }

  return summary;
}
