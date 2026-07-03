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
  const entries: any[] = [];

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
    appendEntry(customType: string, data?: unknown) {
      entries.push({ type: "custom", customType, data });
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
    sessionManager: {
      getEntries() {
        return entries;
      },
    },
  } as any;

  sessionBloatGuard(pi);

  return {
    handlers,
    statusCalls,
    widgetCalls,
    notifyCalls,
    commands,
    entries,
    ctx,
  };
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
  assert.ok(harness.handlers.session_compact?.length);
  assert.ok(harness.handlers.session_shutdown?.length);
  assert.ok(harness.commands["session-bloat"]);
});

test("session_start restores historical state on resume and resets on new", () => {
  const harness = createHarness();

  emit(harness, "session_start", { reason: "startup" });
  for (let i = 0; i < 50; i += 1) {
    emit(harness, "tool_call", { toolName: "read" });
  }

  assert.deepEqual(harness.statusCalls.at(-1), ["session-bloat", "🟡"]);
  assert.equal(
    harness.notifyCalls.includes(
      "🟡 Session bloat: session is starting to grow",
    ),
    true,
  );

  emit(harness, "session_shutdown", { reason: "reload" });
  emit(harness, "session_start", { reason: "resume" });
  assert.deepEqual(harness.statusCalls.at(-1), ["session-bloat", "🟡"]);
  assert.equal(harness.notifyCalls.length, 1);

  emit(harness, "session_shutdown", { reason: "new" });
  emit(harness, "session_start", { reason: "new" });
  assert.deepEqual(harness.statusCalls.at(-1), ["session-bloat", "🟢"]);
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
      "🟡 Session bloat: session is starting to grow",
    ),
    true,
  );
  assert.deepEqual(harness.statusCalls.at(-1), ["session-bloat", "🟡"]);
});

test("session_compact can lower the severity after churn", () => {
  const harness = createHarness();
  emit(harness, "session_start", { reason: "startup" });
  for (let i = 0; i < 50; i += 1) {
    emit(harness, "tool_call", { toolName: "read" });
  }

  assert.deepEqual(harness.statusCalls.at(-1), ["session-bloat", "🟡"]);

  emit(harness, "session_before_compact", {});
  emit(harness, "session_compact", {});

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
