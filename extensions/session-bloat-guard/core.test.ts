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

test("countCompaction increments compactions without mutating the input", () => {
  const before = resetState();
  const next = countCompaction(before);
  assert.deepEqual(before, INITIAL_STATE);
  assert.equal(next.compactions, 1);
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

test("scoreSession escalates to strong on compaction churn and rereads", () => {
  const strong = describeSession({
    ...INITIAL_STATE,
    compactions: 3,
    repeatedReads: 5,
  });
  assert.equal(strong.severity, "strong");
});

test("describeSession includes a status string", () => {
  const view = describeSession({ ...INITIAL_STATE, reads: 3, edits: 2 });
  assert.match(view.status, /^🟢 r3 e2 w0 c0$/);
});
