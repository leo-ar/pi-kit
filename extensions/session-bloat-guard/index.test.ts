import assert from "node:assert/strict";
import test from "node:test";
import sessionBloatGuard from "./index.ts";

function createHarness() {
  const handlers: Record<string, Function[]> = {};
  const statusCalls: Array<[string, string]> = [];
  const widgetCalls: Array<[string, string[]]> = [];
  const notifyCalls: string[] = [];
  const commands: Record<string, { description: string; handler: Function }> =
    {};

  const pi = {
    on(name: string, handler: Function) {
      handlers[name] ??= [];
      handlers[name].push(handler);
    },
    registerCommand(
      name: string,
      config: { description: string; handler: Function },
    ) {
      commands[name] = config;
    },
  } as any;

  const ctx = {
    ui: {
      setStatus(key: string, value: string) {
        statusCalls.push([key, value]);
      },
      setWidget(key: string, value: string[]) {
        widgetCalls.push([key, value]);
      },
      notify(text: string) {
        notifyCalls.push(text);
      },
    },
  } as any;

  sessionBloatGuard(pi);

  return { handlers, statusCalls, widgetCalls, notifyCalls, commands, ctx };
}

function emit(
  harness: ReturnType<typeof createHarness>,
  name: string,
  event: any = {},
) {
  const handlers = harness.handlers[name] ?? [];
  for (const handler of handlers) handler(event, harness.ctx);
}

test("registers the expected lifecycle handlers and command", () => {
  const harness = createHarness();
  assert.ok(harness.handlers.session_start?.length);
  assert.ok(harness.handlers.tool_call?.length);
  assert.ok(harness.handlers.session_before_compact?.length);
  assert.ok(harness.handlers.session_shutdown?.length);
  assert.ok(harness.commands["session-bloat"]);
});

test("session_start initializes the single-circle UI and stays silent on resume", () => {
  const harness = createHarness();
  emit(harness, "session_start", { reason: "startup" });

  assert.deepEqual(harness.statusCalls.at(-1), ["session-bloat", "🟢"]);
  assert.deepEqual(harness.widgetCalls.at(-1), ["session-bloat", ["🟢"]]);
  assert.equal(harness.notifyCalls.length, 0);

  emit(harness, "session_start", { reason: "resume" });
  assert.deepEqual(harness.statusCalls.at(-1), ["session-bloat", "🟢"]);
  assert.equal(harness.notifyCalls.length, 0);
});

test("tool_call updates the circle UI and warning state", () => {
  const harness = createHarness();
  emit(harness, "session_start", { reason: "startup" });
  emit(harness, "tool_call", { toolName: "read" });

  assert.deepEqual(harness.statusCalls.at(-1), ["session-bloat", "🟢"]);
  assert.deepEqual(harness.widgetCalls.at(-1), ["session-bloat", ["🟢"]]);

  for (let i = 0; i < 49; i += 1) {
    emit(harness, "tool_call", { toolName: "read" });
  }

  assert.equal(
    harness.notifyCalls.includes(
      "Session bloat: 🟡 session is starting to grow",
    ),
    true,
  );
  assert.deepEqual(harness.statusCalls.at(-1), ["session-bloat", "🟡"]);
});

test("session_before_compact increments compactions and session_shutdown clears ephemeral state", () => {
  const harness = createHarness();
  emit(harness, "session_start", { reason: "startup" });
  emit(harness, "session_before_compact", {});

  assert.deepEqual(harness.statusCalls.at(-1), ["session-bloat", "🟡"]);
  assert.deepEqual(harness.widgetCalls.at(-1), ["session-bloat", ["🟡"]]);

  emit(harness, "session_shutdown", {});
  emit(harness, "session_start", { reason: "startup" });
  assert.deepEqual(harness.statusCalls.at(-1), ["session-bloat", "🟢"]);
});

test("session-bloat command reports the live state", async () => {
  const harness = createHarness();
  emit(harness, "session_start", { reason: "startup" });
  emit(harness, "tool_call", { toolName: "edit" });
  await harness.commands["session-bloat"].handler({}, harness.ctx);

  assert.equal(
    harness.notifyCalls.at(-1),
    "Session bloat: 🟢 reads 0, edits 1, writes 0, compactions 0",
  );
});
