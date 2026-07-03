export const READ_OUTLINE_STATE_TYPE = "read-outline-state" as const;

export type ReadOutlinePersistedState = {
  version: 1;
  savedBytes: number;
  outlinedFiles: string[];
};

type SessionEntryLike = {
  type?: string;
  customType?: string;
  data?: unknown;
};

export function loadReadOutlineState(
  entries: SessionEntryLike[],
): ReadOutlinePersistedState | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry?.type !== "custom" || entry.customType !== READ_OUTLINE_STATE_TYPE) continue;
    const data = entry.data as Partial<ReadOutlinePersistedState> | undefined;
    if (typeof data?.savedBytes === "number") {
      return {
        version: 1,
        savedBytes: data.savedBytes,
        outlinedFiles: Array.isArray(data.outlinedFiles)
          ? data.outlinedFiles.filter((file): file is string => typeof file === "string")
          : [],
      };
    }
  }
  return undefined;
}
