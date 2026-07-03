import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CONTEXT_PRUNER_STATE_TYPE,
  loadContextPrunerState,
} from "./persistence.ts";

describe("context-pruner persistence", () => {
  it("loads the latest matching state entry", () => {
    const entries = [
      { type: "custom", customType: CONTEXT_PRUNER_STATE_TYPE, data: { version: 1, totalSaved: 10, totalCalls: 1 } },
      { type: "custom", customType: "other", data: { version: 1, totalSaved: 999, totalCalls: 99 } },
      { type: "custom", customType: CONTEXT_PRUNER_STATE_TYPE, data: { version: 1, totalSaved: 42, totalCalls: 7 } },
    ];

    assert.deepEqual(loadContextPrunerState(entries), {
      version: 1,
      totalSaved: 42,
      totalCalls: 7,
    });
  });

  it("returns undefined when no matching state exists", () => {
    assert.equal(loadContextPrunerState([]), undefined);
    assert.equal(
      loadContextPrunerState([{ type: "custom", customType: "other", data: { totalSaved: 1, totalCalls: 1 } }]),
      undefined,
    );
  });
});
