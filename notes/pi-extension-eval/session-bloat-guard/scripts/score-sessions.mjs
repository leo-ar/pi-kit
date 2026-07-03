import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HOME = process.env.HOME ?? "/Users/lrojas";
const SESSIONS_ROOT = path.join(HOME, ".pi/agent/sessions");
const DB_PATH = path.join(SESSIONS_ROOT, "session-index.sqlite");

const argv = process.argv.slice(2);
const opts = { cwd: null, top: 10, json: false };
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "--cwd") opts.cwd = argv[++i] ?? null;
  else if (arg === "--top") opts.top = Number(argv[++i] ?? "10");
  else if (arg === "--json") opts.json = true;
}

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
    })
    .filter((row) => !opts.cwd || row.cwd === opts.cwd);
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

function analyzeSession(filePath) {
  const entries = readJsonl(filePath);
  if (!entries) return null;
  const metrics = {
    file: path.basename(filePath),
    cwd: null,
    timestamp: null,
    readCalls: 0,
    edits: 0,
    writes: 0,
    compactions: 0,
    score: 0,
  };
  for (const e of entries) {
    if (e.type === "session") {
      metrics.cwd = e.cwd;
      metrics.timestamp = e.timestamp;
    }
    if (e.type === "compaction") metrics.compactions++;
    if (e.type !== "message") continue;
    const m = e.message;
    if (!m || m.role !== "assistant" || !Array.isArray(m.content)) continue;
    for (const block of m.content) {
      if (block.type !== "toolCall") continue;
      if (block.name === "read") metrics.readCalls++;
      if (block.name === "edit") metrics.edits++;
      if (block.name === "write") metrics.writes++;
    }
  }
  metrics.score =
    metrics.readCalls +
    metrics.edits +
    metrics.writes +
    metrics.compactions * 4;
  return metrics;
}

const analyzed = querySessions()
  .map((s) => analyzeSession(s.path))
  .filter(Boolean);
const ranked = analyzed.sort((a, b) => b.score - a.score).slice(0, opts.top);
const summary = {
  cwdFilter: opts.cwd,
  sessionCount: analyzed.length,
  top: opts.top,
  ranked,
};

if (opts.json) console.log(JSON.stringify(summary, null, 2));
else {
  console.log(`# session-bloat-guard score report\n`);
  console.log(`Scope: ${opts.cwd ?? "all sessions"}`);
  console.log(`Analyzed sessions: ${analyzed.length}`);
  console.log(`Top ${opts.top} sessions by composite score:\n`);
  for (const s of ranked) {
    console.log(`- ${s.timestamp} · ${s.cwd}`);
    console.log(`  score: ${s.score}`);
    console.log(
      `  reads: ${s.readCalls} edits=${s.edits} writes=${s.writes} compactions=${s.compactions}`,
    );
    console.log("");
  }
}
