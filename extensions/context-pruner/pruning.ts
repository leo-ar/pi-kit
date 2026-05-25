/**
 * Context pruning — pure logic module.
 *
 * Classifies tool results as pruneable or keepable, generates stubs.
 * No I/O, no pi imports — fully testable in isolation.
 */

// ─── Configuration ───────────────────────────────────────────────────────────

export interface PrunerConfig {
  /** Number of user-turn boundaries to keep intact from the end. Default: 10 */
  recentTurnsToKeep: number;
  /** Results smaller than this (chars) are always kept. Default: 500 */
  minSizeToStub: number;
  /** Prune old read tool results. Default: true */
  pruneReads: boolean;
  /** Prune old informational bash (ls, find, cat, grep, tree). Default: true */
  pruneBashInformational: boolean;
  /** Prune old large bash results. Default: true */
  pruneBashLarge: boolean;
  /** Threshold for "large" bash results. Default: 2048 */
  pruneBashLargeThreshold: number;
}

export const DEFAULT_CONFIG: PrunerConfig = {
  recentTurnsToKeep: 5,
  minSizeToStub: 500,
  pruneReads: true,
  pruneBashInformational: true,
  pruneBashLarge: true,
  pruneBashLargeThreshold: 2048,
};

// ─── Message Types (minimal, matches pi's structure) ─────────────────────────

export interface TextContent {
  type: "text";
  text: string;
}

export interface ToolCallBlock {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResultMessage {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: TextContent[];
  isError: boolean;
  timestamp: number;
  [key: string]: unknown;
}

export interface AssistantMessage {
  role: "assistant";
  content: (TextContent | ToolCallBlock | { type: string; [key: string]: unknown })[];
  [key: string]: unknown;
}

export interface UserMessage {
  role: "user";
  content: string | TextContent[];
  timestamp: number;
  [key: string]: unknown;
}

export type AnyMessage = ToolResultMessage | AssistantMessage | UserMessage | { role: string; [key: string]: unknown };

// ─── Classification ──────────────────────────────────────────────────────────

export type PruneDecision =
  | { action: "keep"; reason: string }
  | { action: "stub"; reason: string; stub: string };

/** Informational bash commands — ephemeral, always safe to stub when old. */
const INFORMATIONAL_BASH = /^\s*(ls|find|tree|dir|cat|head|tail|less|more|wc|file)\b/;

/** Search commands — re-runnable, safe to stub. */
const SEARCH_BASH = /^\s*(grep|rg|ag|ripgrep|ack)\b/;

/**
 * Classify a single tool result message.
 */
export function classify(
  msg: ToolResultMessage,
  toolCallArgs: Record<string, unknown> | undefined,
  writtenFiles: Set<string>,
  config: PrunerConfig,
): PruneDecision {
  const contentLength = getContentLength(msg);

  // Rule 1: Errors are never pruned
  if (msg.isError) {
    return { action: "keep", reason: "error" };
  }

  // Rule 2: Small results are always kept
  if (contentLength < config.minSizeToStub) {
    return { action: "keep", reason: "small" };
  }

  // Rule 3: Edit/write confirmations are always kept (tiny, structurally important)
  if (msg.toolName === "edit" || msg.toolName === "write") {
    return { action: "keep", reason: "edit/write" };
  }

  // Rule 4: Read results
  if (msg.toolName === "read" && config.pruneReads) {
    const path = (toolCallArgs?.path as string) || "unknown";
    const lines = countLines(msg);
    const superseded = writtenFiles.has(path);
    const suffix = superseded ? " (file was later modified)" : "";
    return {
      action: "stub",
      reason: superseded ? "read-superseded" : "read-old",
      stub: `[read ${path} — ${lines} lines${suffix}]`,
    };
  }

  // Rule 5: Bash results
  if (msg.toolName === "bash") {
    const command = ((toolCallArgs?.command as string) || "").trim();
    const firstWord = command.split(/\s/)[0].replace(/^.*\//, "");

    // Informational commands
    if (config.pruneBashInformational && INFORMATIONAL_BASH.test(command)) {
      const stub = buildBashStub(command, firstWord, msg);
      return { action: "stub", reason: "bash-informational", stub };
    }

    // Search commands
    if (config.pruneBashInformational && SEARCH_BASH.test(command)) {
      const matches = countLines(msg);
      const pattern = extractPattern(command);
      return {
        action: "stub",
        reason: "bash-search",
        stub: `[${firstWord} ${pattern} — ${matches} lines]`,
      };
    }

    // Large other bash
    if (config.pruneBashLarge && contentLength > config.pruneBashLargeThreshold) {
      const shortCmd = command.length > 60 ? command.slice(0, 57) + "..." : command;
      const kb = (contentLength / 1024).toFixed(1);
      return {
        action: "stub",
        reason: "bash-large",
        stub: `[bash: ${shortCmd} — ${kb}KB output, exit 0]`,
      };
    }
  }

  // Default: keep
  return { action: "keep", reason: "unmatched" };
}

// ─── Pruning Engine ──────────────────────────────────────────────────────────

export interface PruneResult {
  messages: AnyMessage[];
  stats: {
    totalToolResults: number;
    pruned: number;
    kept: number;
    charsSaved: number;
    byReason: Record<string, number>;
  };
}

/**
 * Apply pruning to a message array. Returns a new array with stubs replacing
 * stale tool results. Messages before `recentCutoffIndex` are candidates.
 */
export function prune(messages: AnyMessage[], config: PrunerConfig = DEFAULT_CONFIG): PruneResult {
  const recentCutoff = findRecentCutoff(messages, config.recentTurnsToKeep);
  const toolCallMap = buildToolCallMap(messages);
  const writtenFiles = buildWrittenFilesSet(messages);

  const stats = {
    totalToolResults: 0,
    pruned: 0,
    kept: 0,
    charsSaved: 0,
    byReason: {} as Record<string, number>,
  };

  const result: AnyMessage[] = messages.map((msg, idx) => {
    if (msg.role !== "toolResult") return msg;
    stats.totalToolResults++;

    const toolMsg = msg as ToolResultMessage;

    // Recent messages: always keep
    if (idx >= recentCutoff) {
      stats.kept++;
      return msg;
    }

    const toolCallArgs = toolCallMap.get(toolMsg.toolCallId);
    const decision = classify(toolMsg, toolCallArgs, writtenFiles, config);

    if (decision.action === "keep") {
      stats.kept++;
      return msg;
    }

    // Apply stub
    const originalLength = getContentLength(toolMsg);
    const stubbed: ToolResultMessage = {
      ...toolMsg,
      content: [{ type: "text", text: decision.stub }],
    };
    stats.pruned++;
    stats.charsSaved += originalLength - decision.stub.length;
    stats.byReason[decision.reason] = (stats.byReason[decision.reason] || 0) + 1;

    return stubbed;
  });

  return { messages: result, stats };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get total text length from a tool result's content. */
export function getContentLength(msg: ToolResultMessage): number {
  if (!Array.isArray(msg.content)) return 0;
  return msg.content.reduce((sum, block) => sum + (block.text?.length || 0), 0);
}

/** Count newlines in a tool result (proxy for line count). */
function countLines(msg: ToolResultMessage): number {
  if (!Array.isArray(msg.content)) return 0;
  const text = msg.content.map((b) => b.text || "").join("");
  return text.split("\n").length;
}

/**
 * Find the message index where "recent" starts.
 * Counts backwards from the end, finding the Nth user message boundary.
 */
export function findRecentCutoff(messages: AnyMessage[], recentTurns: number): number {
  let userCount = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      userCount++;
      if (userCount >= recentTurns) return i;
    }
  }
  return 0; // Fewer than N turns — keep everything
}

/** Build a map from toolCallId to the tool call arguments. */
export function buildToolCallMap(messages: AnyMessage[]): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const assistantMsg = msg as AssistantMessage;
    if (!Array.isArray(assistantMsg.content)) continue;
    for (const block of assistantMsg.content) {
      if (block.type === "toolCall") {
        const tc = block as ToolCallBlock;
        map.set(tc.id, tc.arguments || {});
      }
    }
  }
  return map;
}

/** Build the set of file paths that were written or edited anywhere in the conversation. */
export function buildWrittenFilesSet(messages: AnyMessage[]): Set<string> {
  const written = new Set<string>();
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const assistantMsg = msg as AssistantMessage;
    if (!Array.isArray(assistantMsg.content)) continue;
    for (const block of assistantMsg.content) {
      if (block.type === "toolCall") {
        const tc = block as ToolCallBlock;
        if ((tc.name === "write" || tc.name === "edit") && tc.arguments?.path) {
          written.add(tc.arguments.path as string);
        }
      }
    }
  }
  return written;
}

/** Build a short stub for informational bash commands. */
function buildBashStub(command: string, firstWord: string, msg: ToolResultMessage): string {
  const lines = countLines(msg);

  if (/^(cat|head|tail)/.test(firstWord)) {
    // Extract filename from command
    const parts = command.split(/\s+/).filter((p) => !p.startsWith("-"));
    const file = parts[1] || "file";
    return `[${firstWord} ${file} — ${lines} lines]`;
  }

  if (/^(ls|dir)/.test(firstWord)) {
    const parts = command.split(/\s+/).filter((p) => !p.startsWith("-"));
    const dir = parts[1] || ".";
    return `[${firstWord} ${dir} — ${lines} entries]`;
  }

  if (/^(find|tree)/.test(firstWord)) {
    const parts = command.split(/\s+/);
    const dir = parts[1] || ".";
    return `[${firstWord} ${dir} — ${lines} results]`;
  }

  return `[${firstWord} — ${lines} lines]`;
}

/** Extract the search pattern from a grep/rg command. */
function extractPattern(command: string): string {
  // Try to find quoted pattern
  const quoted = command.match(/['"]([^'"]+)['"]/);
  if (quoted) return `"${quoted[1]}"`;

  // Try the first non-flag argument after the command
  const parts = command.split(/\s+/);
  for (let i = 1; i < parts.length; i++) {
    if (!parts[i].startsWith("-") && parts[i] !== "") {
      return `"${parts[i]}"`;
    }
  }
  return '"..."';
}
