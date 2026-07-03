import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HOME = process.env.HOME ?? '/Users/lrojas';
const SESSIONS_ROOT = path.join(HOME, '.pi/agent/sessions');
const DB_PATH = path.join(SESSIONS_ROOT, 'session-index.sqlite');

function querySessions() {
  const sql = "select cwd, path, timestamp from sessions order by timestamp";
  const out = execFileSync('sqlite3', ['-readonly', DB_PATH, sql], { encoding: 'utf8' });
  return out
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [cwd, p, timestamp] = line.split('|');
      return { cwd, path: p, timestamp };
    });
}

function readJsonl(p) {
  try {
    return fs
      .readFileSync(p, 'utf8')
      .split('\n')
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

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n');
}

function summarizeSession(filePath) {
  const entries = readJsonl(filePath);
  if (!entries) return null;
  const out = {
    file: path.basename(filePath),
    cwd: null,
    readCalls: 0,
    fullReads: 0,
    compactions: 0,
    edits: 0,
    writes: 0,
    bash: 0,
    outlineHits: 0,
    repeatedFullReadFiles: 0,
    repeatedFullReads: 0,
    pruneStats: null,
  };

  const fullReadCounts = new Map();
  for (const e of entries) {
    if (e.type === 'session') out.cwd = e.cwd;
    if (e.type === 'compaction') out.compactions++;
    if (e.type !== 'message') continue;
    const m = e.message;
    if (!m) continue;

    if (m.role === 'assistant' && Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type !== 'toolCall') continue;
        const name = block.name;
        const args = block.arguments ?? {};

        if (name === 'read') {
          out.readCalls++;
          if (args.offset === undefined && args.limit === undefined) {
            out.fullReads++;
            if (typeof args.path === 'string') {
              fullReadCounts.set(args.path, (fullReadCounts.get(args.path) ?? 0) + 1);
            }
          }
        } else if (name === 'edit') {
          out.edits++;
        } else if (name === 'write') {
          out.writes++;
        } else if (name === 'bash') {
          out.bash++;
        }
      }
    }

    if (m.role === 'toolResult') {
      const txt = textOf(m.content);
      if (txt.includes('── outline ──')) out.outlineHits++;
    }

    if (e.type === 'custom_message' && e.customType === 'prune-stats') {
      out.pruneStats = textOf(e.content ?? e.message?.content ?? e.content);
    }
  }

  out.repeatedFullReadFiles = [...fullReadCounts.values()].filter((n) => n >= 2).length;
  out.repeatedFullReads = [...fullReadCounts.values()].reduce((acc, n) => acc + Math.max(0, n - 1), 0);
  return out;
}

function extractPruneStats(text) {
  const calls = /LLM calls with pruning \|\s*(\d+)/.exec(text)?.[1];
  const kb = /Total chars saved \|\s*([\d.]+) KB/.exec(text)?.[1];
  const tokens = /Est\. tokens saved \|\s*~([\d,]+)/.exec(text)?.[1];
  return calls ? { calls: Number(calls), kb: Number(kb), tokens: Number(tokens.replace(/,/g, '')) } : null;
}

const sessions = querySessions();
const summaries = sessions.map((s) => summarizeSession(s.path)).filter(Boolean);

const byCwd = new Map();
for (const s of summaries) {
  const cur = byCwd.get(s.cwd) ?? {
    sessions: 0,
    readCalls: 0,
    fullReads: 0,
    outlines: 0,
    compactions: 0,
    edits: 0,
    writes: 0,
    bash: 0,
  };
  cur.sessions++;
  cur.readCalls += s.readCalls;
  cur.fullReads += s.fullReads;
  cur.outlines += s.outlineHits;
  cur.compactions += s.compactions;
  cur.edits += s.edits;
  cur.writes += s.writes;
  cur.bash += s.bash;
  byCwd.set(s.cwd, cur);
}

const hashlineCandidates = summaries
  .map((s) => ({
    ...s,
    score: s.repeatedFullReads + s.edits + s.writes + Math.floor(s.readCalls / 10),
  }))
  .filter((s) => s.score >= 30)
  .sort((a, b) => b.score - a.score)
  .slice(0, 10);

const pruneSummaries = summaries
  .filter((s) => s.pruneStats)
  .map((s) => ({
    file: s.file,
    cwd: s.cwd,
    ...(extractPruneStats(s.pruneStats) ?? {}),
    raw: s.pruneStats,
  }));

const result = {
  global: {
    sessions: summaries.length,
    byCwd: [...byCwd.entries()].sort((a, b) => b[1].sessions - a[1].sessions),
  },
  hashlineCandidates,
  pruneSummaries,
};

console.log(JSON.stringify(result, null, 2));
