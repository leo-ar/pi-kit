import assert from "node:assert/strict";
import test from "node:test";
import {
  countCompaction,
  countToolCall,
  describeSession,
  INITIAL_STATE,
  resetState,
  scoreSession,
} from "./core.ts";

test("resetState returns a fresh zeroed state", () => {
  assert.deepEqual(resetState(), INITIAL_STATE);
});

test("countToolCall increments the matching counter without mutating the input", () => {
  const before = resetState();
  const next = countToolCall(before, "read");
  assert.deepEqual(before, INITIAL_STATE);
  assert.equal(next.reads, 1);
  assert.equal(next.edits, 0);
  assert.equal(next.writes, 0);
});

test("countCompaction resets the active segment and increments compactions", () => {
  const before = {
    ...INITIAL_STATE,
    reads: 12,
    edits: 8,
    writes: 4,
    repeatedReads: 2,
  };
  const next = countCompaction(before);
  assert.deepEqual(before, {
    ...INITIAL_STATE,
    reads: 12,
    edits: 8,
    writes: 4,
    repeatedReads: 2,
  });
  assert.deepEqual(next, {
    reads: 0,
    edits: 0,
    writes: 0,
    compactions: 1,
    repeatedReads: 0,
  });
});

test("scoreSession stays normal for a quiet session", () => {
  assert.deepEqual(scoreSession(resetState()), {
    severity: "normal",
    reason: "session looks healthy",
  });
});

test("scoreSession escalates on reads and edits", () => {
  const watch = describeSession({ ...INITIAL_STATE, reads: 50 });
  assert.equal(watch.severity, "watch");
  const warn = describeSession({ ...INITIAL_STATE, reads: 100 });
  assert.equal(warn.severity, "warn");
});

test("scoreSession escalates to strong on repeated compactions", () => {
  const strong = describeSession({
    ...INITIAL_STATE,
    compactions: 4,
    repeatedReads: 5,
  });
  assert.equal(strong.severity, "strong");
});

test("severity never decreases when ordinary activity counters increase", () => {
  const severityRank = (severity: string) =>
    ({ normal: 0, watch: 1, warn: 2, strong: 3 })[severity] ?? -1;

  const base = describeSession(resetState());
  const more = describeSession({
    ...INITIAL_STATE,
    reads: 1,
    edits: 1,
    writes: 1,
    repeatedReads: 1,
  });
  assert.ok(severityRank(more.severity) >= severityRank(base.severity));
});

test("describeSession includes a status string", () => {
  const view = describeSession({ ...INITIAL_STATE, reads: 3, edits: 2 });
  assert.match(view.status, /^🟢 r3 e2 w0 c0$/);
});
