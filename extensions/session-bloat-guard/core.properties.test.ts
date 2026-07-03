import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";
import {
  countCompaction,
  countToolCall,
  describeSession,
  INITIAL_STATE,
} from "./core.ts";

const stateArb = fc.record({
  reads: fc.integer({ min: 0, max: 120 }),
  edits: fc.integer({ min: 0, max: 120 }),
  writes: fc.integer({ min: 0, max: 120 }),
  compactions: fc.integer({ min: 0, max: 10 }),
  repeatedReads: fc.integer({ min: 0, max: 10 }),
});

const severityRank = (severity: string) =>
  ({ normal: 0, watch: 1, warn: 2, strong: 3 })[severity] ?? -1;

const severityIcon = (severity: string) =>
  severity === "strong"
    ? "🔴"
    : severity === "warn"
      ? "🟠"
      : severity === "watch"
        ? "🟡"
        : "🟢";

test("countToolCall is exact and non-mutating for built-in tools", () => {
  fc.assert(
    fc.property(
      stateArb,
      fc.constantFrom("read", "edit", "write", "grep", "bash"),
      (state, toolName) => {
        const snapshot = { ...state };
        const next = countToolCall(state, toolName);
        assert.deepEqual({ ...state }, snapshot);

        const expected =
          toolName === "read"
            ? { ...snapshot, reads: snapshot.reads + 1 }
            : toolName === "edit"
              ? { ...snapshot, edits: snapshot.edits + 1 }
              : toolName === "write"
                ? { ...snapshot, writes: snapshot.writes + 1 }
                : snapshot;

        assert.deepEqual(next, expected);
      },
    ),
    { numRuns: 20 },
  );
});

test("countCompaction resets the active segment and increments compactions", () => {
  fc.assert(
    fc.property(stateArb, (state) => {
      const snapshot = { ...state };
      const next = countCompaction(state);
      assert.deepEqual({ ...state }, snapshot);
      assert.deepEqual(next, {
        reads: 0,
        edits: 0,
        writes: 0,
        compactions: snapshot.compactions + 1,
        repeatedReads: 0,
      });
    }),
    { numRuns: 20 },
  );
});

test("severity never decreases when ordinary activity counters increase", () => {
  fc.assert(
    fc.property(
      stateArb,
      fc.constantFrom("reads", "edits", "writes", "repeatedReads"),
      (state, field) => {
        const base = describeSession(state);
        const more = describeSession({ ...state, [field]: state[field] + 1 });
        assert.ok(severityRank(more.severity) >= severityRank(base.severity));
      },
    ),
    { numRuns: 20 },
  );
});

test("compaction can lower severity by resetting the active segment", () => {
  fc.assert(
    fc.property(stateArb, (state) => {
      const before = describeSession({ ...state, reads: 50, compactions: 0 });
      const after = describeSession(
        countCompaction({ ...state, reads: 50, compactions: 0 }),
      );
      assert.ok(severityRank(after.severity) <= severityRank(before.severity));
    }),
    { numRuns: 20 },
  );
});

test("status strings always match the compact counter format", () => {
  fc.assert(
    fc.property(stateArb, (state) => {
      const view = describeSession(state);
      const icon = severityIcon(view.severity);
      assert.match(view.status, /^[🟢🟡🟠🔴] r\d+ e\d+ w\d+ c\d+$/u);
      assert.ok(view.status.startsWith(icon));
      assert.ok(view.status.includes(`r${state.reads}`));
      assert.ok(view.status.includes(`e${state.edits}`));
      assert.ok(view.status.includes(`w${state.writes}`));
      assert.ok(view.status.includes(`c${state.compactions}`));
    }),
    { numRuns: 20 },
  );
});
