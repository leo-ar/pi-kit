export type Severity = "normal" | "watch" | "warn" | "strong";

export type SessionBloatState = {
  reads: number;
  edits: number;
  writes: number;
  compactions: number;
  // Reserved for future repeated-access tracking once the event data is available.
  repeatedReads: number;
};

export type SessionBloatView = SessionBloatState & {
  severity: Severity;
  reason: string;
  status: string;
};

export const INITIAL_STATE: SessionBloatState = {
  reads: 0,
  edits: 0,
  writes: 0,
  compactions: 0,
  repeatedReads: 0,
};

export function cloneState(
  state: SessionBloatState = INITIAL_STATE,
): SessionBloatState {
  return { ...state };
}

export function resetState(): SessionBloatState {
  return cloneState();
}

export function countToolCall(
  state: SessionBloatState,
  toolName: string,
): SessionBloatState {
  const next = cloneState(state);
  if (toolName === "read") next.reads += 1;
  if (toolName === "edit") next.edits += 1;
  if (toolName === "write") next.writes += 1;
  return next;
}

export function countCompaction(state: SessionBloatState): SessionBloatState {
  const next = cloneState(state);
  next.reads = 0;
  next.edits = 0;
  next.writes = 0;
  next.repeatedReads = 0;
  next.compactions += 1;
  return next;
}

export function scoreSession(
  state: SessionBloatState,
): Omit<SessionBloatView, keyof SessionBloatState> {
  const total =
    state.reads +
    state.edits +
    state.writes +
    state.compactions * 4 +
    state.repeatedReads * 2;

  if (state.compactions >= 3) {
    return {
      severity: "strong",
      reason: "multiple compactions indicate a bloated session",
    };
  }
  if (
    state.compactions >= 3 ||
    state.reads >= 100 ||
    state.edits + state.writes >= 50
  ) {
    return { severity: "warn", reason: "heavy session churn" };
  }
  if (
    state.compactions >= 2 ||
    state.reads >= 50 ||
    state.edits + state.writes >= 20 ||
    state.repeatedReads >= 3 ||
    total >= 60
  ) {
    return { severity: "watch", reason: "session is starting to grow" };
  }
  return { severity: "normal", reason: "session looks healthy" };
}

export function formatStatus(state: SessionBloatState): string {
  const { severity } = scoreSession(state);
  const icon =
    severity === "strong"
      ? "🔴"
      : severity === "warn"
        ? "🟠"
        : severity === "watch"
          ? "🟡"
          : "🟢";
  return `${icon} r${state.reads} e${state.edits} w${state.writes} c${state.compactions}`;
}

export function describeSession(state: SessionBloatState): SessionBloatView {
  const scored = scoreSession(state);
  return { ...state, ...scored, status: formatStatus(state) };
}
