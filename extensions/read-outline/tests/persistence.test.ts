import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  READ_OUTLINE_STATE_TYPE,
  loadReadOutlineState,
} from "../src/persistence.ts";

describe("read-outline persistence", () => {
  it("loads the latest matching state entry", () => {
    const entries = [
      {
        type: "custom",
        customType: READ_OUTLINE_STATE_TYPE,
        data: { version: 1, savedBytes: 10, outlinedFiles: ["a.ts"] },
      },
      { type: "custom", customType: "other", data: { version: 1, savedBytes: 999 } },
      {
        type: "custom",
        customType: READ_OUTLINE_STATE_TYPE,
        data: { version: 1, savedBytes: 42, outlinedFiles: ["b.ts", 7, null] },
      },
    ];

    assert.deepEqual(loadReadOutlineState(entries), {
      version: 1,
      savedBytes: 42,
      outlinedFiles: ["b.ts"],
    });
  });

  it("returns undefined when no matching state exists", () => {
    assert.equal(loadReadOutlineState([]), undefined);
    assert.equal(
      loadReadOutlineState([
        { type: "custom", customType: "other", data: { savedBytes: 1 } },
      ]),
      undefined,
    );
  });
});
