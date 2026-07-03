import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  countCompaction,
  countToolCall,
  describeSession,
  INITIAL_STATE,
  type Severity,
  type SessionBloatState,
} from "./core.ts";

const STATE_ENTRY_TYPE = "session-bloat-guard-state";

type SessionEntry = {
  type?: string;
  customType?: string;
  data?: unknown;
  message?: {
    role?: string;
    content?: unknown;
  };
};

function circleForSeverity(severity: Severity) {
  return severity === "strong"
    ? "🔴"
    : severity === "warn"
      ? "🟠"
      : severity === "watch"
        ? "🟡"
        : "🟢";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStateData(value: unknown): SessionBloatState | null {
  if (!isRecord(value)) return null;

  const reads = Number(value.reads);
  const edits = Number(value.edits);
  const writes = Number(value.writes);
  const compactions = Number(value.compactions);
  const repeatedReads = Number(value.repeatedReads);

  if (
    [reads, edits, writes, compactions, repeatedReads].some(
      (n) => !Number.isFinite(n),
    )
  ) {
    return null;
  }

  return {
    reads,
    edits,
    writes,
    compactions,
    repeatedReads,
  };
}

function loadStateFromHistory(
  ctx: { sessionManager: { getEntries: () => SessionEntry[] } },
  reason: "startup" | "reload" | "new" | "resume" | "fork",
): { state: SessionBloatState; restoredFromSnapshot: boolean } {
  if (reason === "new") {
    return { state: { ...INITIAL_STATE }, restoredFromSnapshot: false };
  }

  const entries = ctx.sessionManager.getEntries();

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.type !== "custom" || entry.customType !== STATE_ENTRY_TYPE) {
      continue;
    }

    const restored = normalizeStateData(entry.data);
    if (restored) {
      return { state: restored, restoredFromSnapshot: true };
    }
  }

  let state: SessionBloatState = { ...INITIAL_STATE };

  for (const entry of entries) {
    if (entry?.type === "compaction") {
      state = countCompaction(state);
      continue;
    }

    if (entry?.type !== "message") continue;
    const message = entry.message;
    if (
      !message ||
      message.role !== "assistant" ||
      !Array.isArray(message.content)
    ) {
      continue;
    }

    for (const block of message.content) {
      if (!isRecord(block) || block.type !== "toolCall") continue;
      const toolName = typeof block.name === "string" ? block.name : "";
      state = countToolCall(state, toolName);
    }
  }

  return { state, restoredFromSnapshot: false };
}

function persistState(pi: ExtensionAPI, state: SessionBloatState) {
  pi.appendEntry(STATE_ENTRY_TYPE, state);
}

function shouldNotify(
  prev: SessionBloatState,
  next: SessionBloatState,
): boolean {
  const before = describeSession(prev);
  const after = describeSession(next);
  return before.severity !== after.severity && after.severity !== "normal";
}

export default function sessionBloatGuard(pi: ExtensionAPI) {
  let state: SessionBloatState = { ...INITIAL_STATE };
  let lastWarningKey = "";

  function refreshUi(ctx: {
    ui: {
      setStatus: (key: string, value: string) => void;
      setWidget: (key: string, value: string[]) => void;
      notify: (text: string) => void;
    };
  }) {
    const current = describeSession(state);
    const circle = circleForSeverity(current.severity);
    ctx.ui.setStatus("session-bloat", circle);
    ctx.ui.setWidget("session-bloat", [circle]);
  }

  pi.on("session_start", (event, ctx) => {
    const restored = loadStateFromHistory(ctx, event.reason);
    state = restored.state;
    const current = describeSession(state);
    lastWarningKey =
      current.severity === "normal"
        ? ""
        : `${current.severity}:${current.reason}`;
    refreshUi(ctx);

    if (!restored.restoredFromSnapshot) {
      persistState(pi, state);
    }
  });

  pi.on("tool_call", (event, ctx) => {
    const previousState = state;
    const nextState = countToolCall(state, event.toolName);
    const next = describeSession(nextState);
    state = nextState;
    persistState(pi, state);
    refreshUi(ctx);

    if (shouldNotify(previousState, nextState)) {
      const warningKey = `${next.severity}:${next.reason}`;
      if (warningKey !== lastWarningKey) {
        ctx.ui.notify(
          `${circleForSeverity(next.severity)} Session bloat: ${next.reason}`,
        );
        lastWarningKey = warningKey;
      }
    }
  });

  pi.on("session_before_compact", (_event, ctx) => {
    refreshUi(ctx);
  });

  pi.on("session_compact", (_event, ctx) => {
    const previousState = state;
    const nextState = countCompaction(state);
    const next = describeSession(nextState);
    state = nextState;
    persistState(pi, state);
    refreshUi(ctx);

    if (shouldNotify(previousState, nextState)) {
      const warningKey = `${next.severity}:${next.reason}`;
      if (warningKey !== lastWarningKey) {
        ctx.ui.notify(
          `${circleForSeverity(next.severity)} Session bloat: ${next.reason}`,
        );
        lastWarningKey = warningKey;
      }
    }
  });

  pi.on("session_shutdown", () => {
    state = { ...INITIAL_STATE };
    lastWarningKey = "";
  });

  pi.registerCommand("session-bloat", {
    description: "Show the current session bloat counters and severity",
    handler: async (_args, ctx) => {
      const current = describeSession(state);
      const circle = circleForSeverity(current.severity);
      ctx.ui.notify(
        `Session bloat: ${circle} reads ${current.reads}, edits ${current.edits}, writes ${current.writes}, compactions ${current.compactions}`,
      );
    },
  });
}
