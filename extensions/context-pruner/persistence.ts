export const CONTEXT_PRUNER_STATE_TYPE = "context-pruner-state" as const;

export type ContextPrunerPersistedState = {
  version: 1;
  totalSaved: number;
  totalCalls: number;
};

type SessionEntryLike = {
  type?: string;
  customType?: string;
  data?: unknown;
};

export function loadContextPrunerState(
  entries: SessionEntryLike[],
): ContextPrunerPersistedState | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry?.type !== "custom" || entry.customType !== CONTEXT_PRUNER_STATE_TYPE) continue;
    const data = entry.data as Partial<ContextPrunerPersistedState> | undefined;
    if (typeof data?.totalSaved === "number" && typeof data?.totalCalls === "number") {
      return { version: 1, totalSaved: data.totalSaved, totalCalls: data.totalCalls };
    }
  }
  return undefined;
}
