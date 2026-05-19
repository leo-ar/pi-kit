/**
 * export-org — pi extension
 *
 * Registers a /export-org command that writes the current session branch
 * to an Org-mode file in the working directory of the session.
 *
 * Usage:
 *   /export-org            → <cwd>/<session-id>.org
 *   /export-org notes.org  → <cwd>/notes.org
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { md2org } from "./md2org.ts";
import { writeFileSync } from "node:fs";
import { basename, join } from "node:path";

// ---------------------------------------------------------------------------
// Language detection for read/write tool results
// ---------------------------------------------------------------------------

const EXT_LANG: Record<string, string> = {
  el: "emacs-lisp",
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  yml: "yaml",
  md: "markdown",
};

function langForPath(filePath: string): string | undefined {
  const ext = filePath.split(".").pop()?.toLowerCase();
  return ext ? (EXT_LANG[ext] ?? ext) : undefined;
}

// ---------------------------------------------------------------------------
// Org formatting helpers
// ---------------------------------------------------------------------------

function orgBlock(type: string, text: string, isError = false): string {
  const isSrc = type.startsWith("src");
  const tag = isError && !isSrc ? " :error" : "";
  const open = isSrc ? `#+begin_${type}\n` : `#+begin_example${tag}\n`;
  const close = isSrc ? "#+end_src\n" : "#+end_example\n";
  const body = text.endsWith("\n") ? text : text + "\n";
  return open + body + close;
}

function orgTimestamp(isoOrMs: string | number): string {
  const d = typeof isoOrMs === "number" ? new Date(isoOrMs) : new Date(isoOrMs);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `[${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${days[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}]`
  );
}

function orgDrawer(
  name: string,
  props: Record<string, string | number>,
): string {
  const lines = [`:${name}:`];
  for (const [k, v] of Object.entries(props)) {
    lines.push(`:${k}: ${v}`);
  }
  lines.push(":END:");
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Extract plain text from a content field (string | TextContent[])
// ---------------------------------------------------------------------------

function extractText(content: unknown): string | undefined {
  if (typeof content === "string") return content || undefined;
  if (Array.isArray(content)) {
    const parts = (content as any[])
      .filter((b: any) => b.type === "text" && typeof b.text === "string")
      .map((b: any) => b.text as string);
    const joined = parts.join("");
    return joined || undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Convert one toolCall + its result into Org blocks
// ---------------------------------------------------------------------------

function toolCallBlocks(
  toolName: string,
  args: Record<string, any>,
  resultText: string | undefined,
  diff: string | undefined,
  isError: boolean,
): string[] {
  if (toolName === "bash") {
    const cmd = typeof args?.command === "string" ? args.command : undefined;
    const blocks: string[] = [];
    if (cmd) blocks.push(orgBlock("src bash", cmd));
    if (resultText) blocks.push(orgBlock("example", resultText, isError));
    return blocks;
  }

  if (diff) {
    return [orgBlock("src diff", diff, isError)];
  }

  if (resultText) {
    if (toolName === "read" || toolName === "write") {
      const filePath: string | undefined =
        typeof args?.path === "string"
          ? args.path
          : typeof args?.filePath === "string"
            ? args.filePath
            : undefined;
      const lang = filePath ? langForPath(filePath) : undefined;
      return [orgBlock(lang ? `src ${lang}` : "example", resultText, isError)];
    }
    return [orgBlock("example", resultText, isError)];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Collect total token usage across all assistant messages
// ---------------------------------------------------------------------------

interface TokenTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

function collectTokens(entries: any[]): TokenTotals {
  const totals: TokenTotals = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  };
  for (const entry of entries) {
    if (entry.type !== "message") continue;
    const usage = entry.message?.usage;
    if (!usage) continue;
    totals.input += usage.input ?? 0;
    totals.output += usage.output ?? 0;
    totals.cacheRead += usage.cacheRead ?? 0;
    totals.cacheWrite += usage.cacheWrite ?? 0;
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Main conversion: session branch entries → Org string
// ---------------------------------------------------------------------------

function messagesToOrg(
  entries: any[],
  sessionFile: string,
  cwd: string,
  sessionTimestamp: string | undefined,
): string {
  // Index toolResult messages by toolCallId
  const results = new Map<string, any>();
  for (const entry of entries) {
    if (entry.type === "message" && entry.message?.role === "toolResult") {
      results.set(entry.message.toolCallId, entry.message);
    }
  }

  // session header is NOT in the branch — it's passed in separately
  // (sessionTimestamp and cwd come from the handler via sm.getHeader())

  // Collect token totals
  const tokens = collectTokens(entries);

  // Build file-level header
  const parts: string[] = [];

  if (sessionTimestamp) {
    parts.push(`#+DATE: ${orgTimestamp(sessionTimestamp)}\n`);
  }

  const fileProps: Record<string, string | number> = {
    PI_SESSION_FILE: sessionFile,
    PI_CWD: cwd,
  };
  if (tokens.input + tokens.output > 0) {
    fileProps["PI_TOKENS_IN"] = tokens.input;
    fileProps["PI_TOKENS_OUT"] = tokens.output;
    if (tokens.cacheRead > 0)
      fileProps["PI_TOKENS_CACHE_READ"] = tokens.cacheRead;
    if (tokens.cacheWrite > 0)
      fileProps["PI_TOKENS_CACHE_WRITE"] = tokens.cacheWrite;
  }
  parts.push(orgDrawer("PROPERTIES", fileProps));
  parts.push("\n");

  // Track current model/thinking so we only emit :PROPERTIES: on first
  // assistant turn and when something changes.
  let currentModel: string | undefined;
  let currentProvider: string | undefined;
  let currentThinking: string | undefined;
  // Last values emitted in a drawer — undefined means not yet emitted
  let emittedModel: string | undefined;
  let emittedProvider: string | undefined;
  let emittedThinking: string | undefined;

  // Walk the branch entries in order
  for (const entry of entries) {
    // Track model/thinking changes from non-message entries
    if (entry.type === "model_change") {
      currentModel = entry.modelId;
      currentProvider = entry.provider;
      continue;
    }
    if (entry.type === "thinking_level_change") {
      currentThinking = entry.thinkingLevel;
      continue;
    }

    if (entry.type !== "message") continue;
    const msg = entry.message;
    const ts = msg.timestamp ? orgTimestamp(msg.timestamp) : "";

    if (msg.role === "user") {
      const text = extractText(msg.content);
      if (text) parts.push(`* You ${ts}\n${md2org(text)}\n\n`);
    } else if (msg.role === "assistant") {
      // Detect model/thinking from the message itself (most reliable)
      const msgModel = typeof msg.model === "string" ? msg.model : currentModel;
      const msgProvider =
        typeof msg.provider === "string" ? msg.provider : currentProvider;
      const msgThinking = currentThinking;

      parts.push(`* Assistant ${ts}\n`);

      // Emit :PROPERTIES: drawer only on first assistant turn or when
      // model/provider/thinking has changed since the last emitted drawer.
      const needsDrawer =
        emittedModel === undefined || // first assistant turn
        msgModel !== emittedModel ||
        msgProvider !== emittedProvider ||
        msgThinking !== emittedThinking;

      if (needsDrawer && (msgModel || msgProvider || msgThinking)) {
        const props: Record<string, string> = {};
        if (msgModel) props["PI_MODEL"] = msgModel;
        if (msgProvider) props["PI_PROVIDER"] = msgProvider;
        if (msgThinking) props["PI_THINKING"] = msgThinking;
        parts.push(orgDrawer("PROPERTIES", props));
        emittedModel = msgModel;
        emittedProvider = msgProvider;
        emittedThinking = msgThinking;
      }

      const content = msg.content;

      if (typeof content === "string") {
        if (content) parts.push(md2org(content) + "\n");
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text") {
            if (typeof block.text === "string" && block.text)
              parts.push(md2org(block.text) + "\n");
          } else if (block.type === "toolCall") {
            const result = results.get(block.id);
            const isError = result?.isError === true;
            const resultText = result ? extractText(result.content) : undefined;
            const diff =
              typeof result?.details?.diff === "string" && result.details.diff
                ? result.details.diff
                : undefined;
            const blocks = toolCallBlocks(
              block.name,
              block.arguments ?? {},
              resultText,
              diff,
              isError,
            );
            parts.push(...blocks);
          }
          // skip "thinking" blocks
        }
      }

      parts.push("\n");
    }
    // skip standalone toolResult entries (consumed above via results map)
  }

  return parts.join("");
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function exportOrgExtension(pi: ExtensionAPI) {
  pi.registerCommand("export-org", {
    description:
      "Export session to an Org-mode file in the session working directory",
    handler: async (args, ctx) => {
      const sm = ctx.sessionManager;
      const sessionFile = sm.getSessionFile();

      if (!sessionFile) {
        ctx.ui.notify(
          "Session is not persisted to disk — nothing to export",
          "error",
        );
        return;
      }

      const cwd = sm.getCwd();
      const sessionId = basename(sessionFile, ".jsonl");
      const fileName = args?.trim() || `${sessionId}.org`;
      const outPath = join(cwd, fileName);

      const branch = sm.getBranch();
      const header = sm.getHeader();
      const sessionTimestamp: string | undefined = header?.timestamp;
      const org = messagesToOrg(branch, sessionFile, cwd, sessionTimestamp);

      writeFileSync(outPath, org, "utf8");
      ctx.ui.notify(`Exported to ${outPath}`, "success");
    },
  });
}
