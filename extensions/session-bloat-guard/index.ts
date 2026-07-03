import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  countCompaction,
  countToolCall,
  describeSession,
  INITIAL_STATE,
  resetState,
  type SessionBloatState,
} from "./core.ts";

function shouldNotify(
  prev: SessionBloatState,
  next: SessionBloatState,
): boolean {
  const before = describeSession(prev);
  const after = describeSession(next);
  return before.severity !== after.severity && after.severity !== "normal";
}

export default function sessionBloatGuard(pi: ExtensionAPI) {
  let state: SessionBloatState = resetState();
  let lastWarningKey = "";

  function refreshUi(ctx: {
    ui: {
      setStatus: (key: string, value: string) => void;
      setWidget: (key: string, value: string[]) => void;
      notify: (text: string) => void;
    };
  }) {
    const current = describeSession(state);
    const circle =
      current.severity === "strong"
        ? "🔴"
        : current.severity === "warn"
          ? "🟠"
          : current.severity === "watch"
            ? "🟡"
            : "🟢";
    ctx.ui.setStatus("session-bloat", circle);
    ctx.ui.setWidget("session-bloat", [circle]);
  }

  pi.on("session_start", (_event, ctx) => {
    // `session_start` fires for startup, reload, new, resume, and fork.
    // Reinitialize the live session view each time so restored sessions are
    // recalculated immediately.
    state = { ...INITIAL_STATE };
    lastWarningKey = "";
    refreshUi(ctx);
  });

  pi.on("tool_call", (event, ctx) => {
    const nextState = countToolCall(state, event.toolName);
    const next = describeSession(nextState);
    refreshUi(ctx);
    if (shouldNotify(state, nextState)) {
      const warningKey = `${next.severity}:${next.reason}`;
      if (warningKey !== lastWarningKey) {
        const circle =
          next.severity === "strong"
            ? "🔴"
            : next.severity === "warn"
              ? "🟠"
              : next.severity === "watch"
                ? "🟡"
                : "🟢";
        ctx.ui.notify(`Session bloat: ${circle} ${next.reason}`);
        lastWarningKey = warningKey;
      }
    }
    state = nextState;
  });

  pi.on("session_before_compact", (_event, ctx) => {
    const nextState = countCompaction(state);
    const next = describeSession(nextState);
    refreshUi(ctx);
    if (shouldNotify(state, nextState)) {
      const warningKey = `${next.severity}:${next.reason}`;
      if (warningKey !== lastWarningKey) {
        const circle =
          next.severity === "strong"
            ? "🔴"
            : next.severity === "warn"
              ? "🟠"
              : next.severity === "watch"
                ? "🟡"
                : "🟢";
        ctx.ui.notify(`Session bloat: ${circle} ${next.reason}`);
        lastWarningKey = warningKey;
      }
    }
    state = nextState;
  });

  pi.on("session_shutdown", () => {
    state = { ...INITIAL_STATE };
    lastWarningKey = "";
  });

  pi.registerCommand("session-bloat", {
    description: "Show the current session bloat counters and severity",
    handler: async (_args, ctx) => {
      const current = describeSession(state);
      const circle =
        current.severity === "strong"
          ? "🔴"
          : current.severity === "warn"
            ? "🟠"
            : current.severity === "watch"
              ? "🟡"
              : "🟢";
      ctx.ui.notify(
        `Session bloat: ${circle} reads ${current.reads}, edits ${current.edits}, writes ${current.writes}, compactions ${current.compactions}`,
      );
    },
  });
}
