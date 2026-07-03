import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HOME = process.env.HOME ?? "/Users/lrojas";
const SESSIONS_ROOT = path.join(HOME, ".pi/agent/sessions");
const DB_PATH = path.join(SESSIONS_ROOT, "session-index.sqlite");

function copyLockedDb() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sbg-timeline-"));
  const tmpDb = path.join(tmpDir, "session-index.sqlite");
  fs.copyFileSync(DB_PATH, tmpDb);
  return { tmpDir, tmpDb };
}

function querySessions(dbPath) {
  const sql = "select cwd, path, timestamp from sessions order by timestamp";
  const out = execFileSync("sqlite3", ["-readonly", dbPath, sql], {
    encoding: "utf8",
  });
  return out
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [cwd, p, timestamp] = line.split("|");
      return { cwd, path: p, timestamp };
    });
}

function readJsonl(filePath) {
  try {
    return fs
      .readFileSync(filePath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return null;
  }
}

function cloneState(state = INITIAL_STATE) {
  return { ...state };
}

const INITIAL_STATE = {
  reads: 0,
  edits: 0,
  writes: 0,
  compactions: 0,
  repeatedReads: 0,
};

function countToolCall(state, toolName) {
  const next = cloneState(state);
  if (toolName === "read") next.reads += 1;
  if (toolName === "edit") next.edits += 1;
  if (toolName === "write") next.writes += 1;
  return next;
}

function countCompaction(state) {
  const next = cloneState(state);
  next.reads = 0;
  next.edits = 0;
  next.writes = 0;
  next.repeatedReads = 0;
  next.compactions += 1;
  return next;
}

function scoreSession(state) {
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

function severityRank(severity) {
  return { normal: 0, watch: 1, warn: 2, strong: 3 }[severity] ?? -1;
}

function analyzeSession(filePath) {
  const entries = readJsonl(filePath);
  if (!entries) return null;

  const out = {
    file: path.basename(filePath),
    cwd: null,
    timestamp: null,
    cacheRead: 0,
    turns: 0,
    events: 0,
    readCalls: 0,
    edits: 0,
    writes: 0,
    compactions: 0,
    finalState: cloneState(),
    transitions: [],
  };

  let state = cloneState();
  let currentSeverity = scoreSession(state).severity;
  let cacheReadSoFar = 0;

  for (const e of entries) {
    if (e.type === "session") {
      out.cwd = e.cwd;
      out.timestamp = e.timestamp;
      continue;
    }

    if (e.type === "compaction") {
      out.events += 1;
      out.compactions += 1;
      state = countCompaction(state);
      const nextSeverity = scoreSession(state).severity;
      if (nextSeverity !== currentSeverity) {
        out.transitions.push({
          eventIndex: out.events,
          turnIndex: out.turns,
          cacheReadSoFar,
          severity: nextSeverity,
          state: cloneState(state),
        });
        currentSeverity = nextSeverity;
      }
      continue;
    }

    if (e.type !== "message") continue;
    const m = e.message;
    if (!m) continue;

    if (m.role === "assistant") {
      out.turns += 1;
      if (m.usage && typeof m.usage.cacheRead === "number") {
        out.cacheRead += m.usage.cacheRead;
        cacheReadSoFar = out.cacheRead;
      }
      if (Array.isArray(m.content)) {
        for (const block of m.content) {
          if (!block || typeof block !== "object" || block.type !== "toolCall")
            continue;
          const toolName = typeof block.name === "string" ? block.name : "";
          if (toolName === "read") out.readCalls += 1;
          if (toolName === "edit") out.edits += 1;
          if (toolName === "write") out.writes += 1;
          out.events += 1;
          state = countToolCall(state, toolName);
          const nextSeverity = scoreSession(state).severity;
          if (nextSeverity !== currentSeverity) {
            out.transitions.push({
              eventIndex: out.events,
              turnIndex: out.turns,
              cacheReadSoFar,
              severity: nextSeverity,
              state: cloneState(state),
            });
            currentSeverity = nextSeverity;
          }
        }
      }
    }
  }

  out.finalState = state;
  return out;
}

function pct(n, d) {
  if (!d) return 0;
  return (n / d) * 100;
}

function pickTop(sessions, top) {
  return sessions
    .map((s) => analyzeSession(s.path))
    .filter(Boolean)
    .sort((a, b) => b.cacheRead - a.cacheRead)
    .slice(0, top);
}

const argv = process.argv.slice(2);
const opts = { cwd: null, top: 8, json: false, path: null };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === "--cwd") opts.cwd = argv[++i] ?? null;
  else if (arg === "--path") opts.path = argv[++i] ?? null;
  else if (arg === "--top") opts.top = Number(argv[++i] ?? "8");
  else if (arg === "--json") opts.json = true;
}

const { tmpDir, tmpDb } = copyLockedDb();
try {
  const sessions = querySessions(tmpDb).filter(
    (row) => !opts.cwd || row.cwd === opts.cwd,
  );
  const ranked = opts.path
    ? sessions
        .filter(
          (row) =>
            row.path === opts.path || path.basename(row.path) === opts.path,
        )
        .map((row) => analyzeSession(row.path))
        .filter(Boolean)
    : pickTop(sessions, opts.top);

  const summary = {
    sessionCount: ranked.length,
    cwdFilter: opts.cwd,
    pathFilter: opts.path,
    top: opts.top,
    ranked,
  };

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`# session-bloat-guard timeline report\n`);
    console.log(`Scope: ${opts.cwd ?? "all sessions"}`);
    console.log(`Analyzed sessions: ${ranked.length}`);
    console.log(`Top ${opts.top} sessions by cacheRead:\n`);
    for (const s of ranked) {
      const totalSeverity = scoreSession(s.finalState).severity;
      console.log(`- ${s.timestamp} · ${s.cwd}`);
      console.log(`  cacheRead: ${s.cacheRead}`);
      console.log(
        `  turns: ${s.turns} events: ${s.events} finalSeverity: ${totalSeverity}`,
      );
      if (!s.transitions.length) {
        console.log(`  transitions: none`);
      } else {
        console.log(`  transitions:`);
        for (const t of s.transitions) {
          console.log(
            `    - ${t.severity} @ event ${t.eventIndex}/${s.events} (${pct(t.eventIndex, s.events).toFixed(1)}%) · turn ${t.turnIndex}/${s.turns} (${pct(t.turnIndex, s.turns).toFixed(1)}%) · cacheRead=${t.cacheReadSoFar}/${s.cacheRead} (${pct(t.cacheReadSoFar, s.cacheRead).toFixed(1)}%) · reads=${t.state.reads} edits=${t.state.edits} writes=${t.state.writes} compactions=${t.state.compactions}`,
          );
        }
      }
      console.log("");
    }
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
