import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HOME = process.env.HOME ?? "/Users/lrojas";
const SESSIONS_ROOT = path.join(HOME, ".pi/agent/sessions");
const DB_PATH = path.join(SESSIONS_ROOT, "session-index.sqlite");

function querySessions() {
  const sql = "select cwd, path, timestamp from sessions order by timestamp";
  const out = execFileSync("sqlite3", ["-readonly", DB_PATH, sql], {
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

function readJsonl(p) {
  try {
    return fs
      .readFileSync(p, "utf8")
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

function analyzeSession(filePath) {
  const entries = readJsonl(filePath);
  if (!entries) return null;
  const out = {
    file: path.basename(filePath),
    cwd: null,
    readCalls: 0,
    edits: 0,
    writes: 0,
    compactions: 0,
  };
  for (const e of entries) {
    if (e.type === "session") out.cwd = e.cwd;
    if (e.type === "compaction") out.compactions++;
    if (e.type !== "message") continue;
    const m = e.message;
    if (!m || m.role !== "assistant" || !Array.isArray(m.content)) continue;
    for (const block of m.content) {
      if (block.type !== "toolCall") continue;
      if (block.name === "read") out.readCalls++;
      if (block.name === "edit") out.edits++;
      if (block.name === "write") out.writes++;
    }
  }
  return out;
}

const sessions = querySessions();
const summaries = sessions.map((s) => analyzeSession(s.path)).filter(Boolean);
const byCwd = new Map();
for (const s of summaries) {
  const cur = byCwd.get(s.cwd) ?? {
    sessions: 0,
    readCalls: 0,
    edits: 0,
    writes: 0,
    compactions: 0,
  };
  cur.sessions++;
  cur.readCalls += s.readCalls;
  cur.edits += s.edits;
  cur.writes += s.writes;
  cur.compactions += s.compactions;
  byCwd.set(s.cwd, cur);
}

console.log(
  JSON.stringify(
    { sessions: summaries.length, byCwd: [...byCwd.entries()] },
    null,
    2,
  ),
);
