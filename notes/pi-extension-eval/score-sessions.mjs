import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HOME = process.env.HOME ?? '/Users/lrojas';
const SESSIONS_ROOT = path.join(HOME, '.pi/agent/sessions');
const DB_PATH = path.join(SESSIONS_ROOT, 'session-index.sqlite');

const argv = process.argv.slice(2);
const opts = {
  cwd: null,
  top: 10,
  json: false,
};

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--cwd') {
    opts.cwd = argv[++i] ?? null;
  } else if (arg === '--top') {
    opts.top = Number(argv[++i] ?? '10');
  } else if (arg === '--json') {
    opts.json = true;
  }
}

function querySessions() {
  const sql = 'select cwd, path, timestamp from sessions order by timestamp';
  const out = execFileSync('sqlite3', ['-readonly', DB_PATH, sql], { encoding: 'utf8' });
  return out
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [cwd, p, timestamp] = line.split('|');
      return { cwd, path: p, timestamp };
    })
    .filter((row) => !opts.cwd || row.cwd === opts.cwd);
}

function readJsonl(filePath) {
  try {
    return fs
      .readFileSync(filePath, 'utf8')
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

function analyzeSession(filePath) {
  const entries = readJsonl(filePath);
  if (!entries) return null;

  const metrics = {
    file: path.basename(filePath),
    cwd: null,
    timestamp: null,
    readCalls: 0,
    fullReads: 0,
    outlineHits: 0,
    compactions: 0,
    edits: 0,
    writes: 0,
    bash: 0,
    repeatedFullReadFiles: 0,
    repeatedFullReads: 0,
    score: 0,
    reasons: [],
  };

  const fullReadCounts = new Map();

  for (const e of entries) {
    if (e.type === 'session') {
      metrics.cwd = e.cwd;
      metrics.timestamp = e.timestamp;
    }
    if (e.type === 'compaction') metrics.compactions++;
    if (e.type !== 'message') continue;

    const m = e.message;
    if (!m) continue;

    if (m.role === 'assistant' && Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type !== 'toolCall') continue;
        const name = block.name;
        const args = block.arguments ?? {};

        if (name === 'read') {
          metrics.readCalls++;
          if (args.offset === undefined && args.limit === undefined) {
            metrics.fullReads++;
            if (typeof args.path === 'string') {
              fullReadCounts.set(args.path, (fullReadCounts.get(args.path) ?? 0) + 1);
            }
          }
        } else if (name === 'edit') {
          metrics.edits++;
        } else if (name === 'write') {
          metrics.writes++;
        } else if (name === 'bash') {
          metrics.bash++;
        }
      }
    }

    if (m.role === 'toolResult') {
      const txt = textOf(m.content);
      if (txt.includes('── outline ──')) metrics.outlineHits++;
    }
  }

  metrics.repeatedFullReadFiles = [...fullReadCounts.values()].filter((n) => n >= 2).length;
  metrics.repeatedFullReads = [...fullReadCounts.values()].reduce(
    (acc, n) => acc + Math.max(0, n - 1),
    0,
  );

  // Heuristic scores
  const readOutlineScore = metrics.fullReads + metrics.outlineHits * 4 + metrics.repeatedFullReads;
  const contextPrunerScore = metrics.compactions * 5 + Math.max(0, metrics.readCalls - metrics.fullReads) / 5;
  const hashlineScore = metrics.repeatedFullReads * 4 + metrics.edits + metrics.writes + Math.floor(metrics.readCalls / 20);
  const smartCompactScore = metrics.compactions * 8 + Math.floor(metrics.readCalls / 25);

  metrics.score = Math.round(readOutlineScore + contextPrunerScore + hashlineScore + smartCompactScore);

  if (metrics.outlineHits > 0) metrics.reasons.push(`outline hits: ${metrics.outlineHits}`);
  if (metrics.repeatedFullReads > 0) metrics.reasons.push(`repeated full reads: ${metrics.repeatedFullReads}`);
  if (metrics.compactions > 0) metrics.reasons.push(`compactions: ${metrics.compactions}`);
  if (metrics.edits + metrics.writes > 50) metrics.reasons.push(`high edit churn: ${metrics.edits + metrics.writes}`);
  if (metrics.bash > 100) metrics.reasons.push(`heavy bash usage: ${metrics.bash}`);

  metrics.subscores = {
    readOutlineScore: Math.round(readOutlineScore),
    contextPrunerScore: Math.round(contextPrunerScore),
    hashlineScore: Math.round(hashlineScore),
    smartCompactScore: Math.round(smartCompactScore),
  };

  return metrics;
}

const sessions = querySessions();
const analyzed = sessions.map((s) => analyzeSession(s.path)).filter(Boolean);
const ranked = analyzed.sort((a, b) => b.score - a.score).slice(0, opts.top);

const summary = {
  cwdFilter: opts.cwd,
  sessionCount: analyzed.length,
  top: opts.top,
  ranked,
};

if (opts.json) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`# Session score report\n`);
  console.log(`Scope: ${opts.cwd ?? 'all sessions'}`);
  console.log(`Analyzed sessions: ${analyzed.length}`);
  console.log(`Top ${opts.top} sessions by composite score:\n`);
  for (const s of ranked) {
    console.log(`- ${s.timestamp} · ${s.cwd}`);
    console.log(`  score: ${s.score}`);
    console.log(`  reads: ${s.readCalls} full=${s.fullReads} outlineHits=${s.outlineHits}`);
    console.log(`  edits: ${s.edits} writes=${s.writes} compactions=${s.compactions} bash=${s.bash}`);
    console.log(`  repeated full-read files: ${s.repeatedFullReadFiles} (extra reads: ${s.repeatedFullReads})`);
    console.log(`  subscores: read-outline=${s.subscores.readOutlineScore}, context-pruner=${s.subscores.contextPrunerScore}, hashline=${s.subscores.hashlineScore}, smart-compact=${s.subscores.smartCompactScore}`);
    if (s.reasons.length) console.log(`  reasons: ${s.reasons.join('; ')}`);
    console.log('');
  }
}
