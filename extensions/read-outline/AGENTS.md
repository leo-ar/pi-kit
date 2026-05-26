# AGENTS.md — read-outline extension

> For workflow, testing strategy, and conventions see the repo-level
> [AGENTS.md](../../AGENTS.md).

## Files

```
index.ts                   Root re-export shim (pi discovers extensions here)
src/index.ts               Entry point — tool_result handler + anti-loop + status widget
src/types.ts               OutlineEntry, Lang, constants (LINE_THRESHOLD=150)
src/outline.ts             Async dispatcher — routes to language-specific generators
src/format.ts              formatOutlineResult, extractHeader, isHeaderLine
src/block-end.ts           Brace/indent-based block-end detection (4 strategies)
src/utils.ts               extractText, isSupportedFile, detectLanguage, padRight
src/languages/             Per-language generators (generic, typescript, php, elisp, etc.)
src/tree-sitter/           WASM parser init + grammar files (elisp, php)
tests/                     Test suite (129 tests: examples, constraints, properties)
bench.ts                   Replay benchmark (read-only, measures savings on real sessions)
notes/                     TODO, retrospectives, tree-sitter analysis
```

## Key types

- `OutlineEntry` — `{ kind, name, startLine, endLine, exported?, signature? }`
- `Lang` — union of supported languages (`"typescript" | "php" | "elisp" | ...`)
- `LINE_THRESHOLD` — 150 (files below this pass through unchanged)
- `generateOutline(lines, filename)` — async, returns `OutlineEntry[]`

## Event flow

1. `tool_result` event fires for `read` tool calls
2. Guard: skip if file has offset/limit, is unsupported, or is below threshold
3. Anti-loop: track outlined files per session — second full read passes through, third re-outlines
4. `generateOutline()` dispatches to language-specific generator (tree-sitter for PHP/Elisp, regex for rest)
5. `formatOutlineResult()` produces compact outline with preserved header section
6. Returns `{ content: [{ type: "text", text: outline }] }` to replace full content

## Design decisions

- Hook `tool_result` not register a tool — zero system prompt overhead per turn
- Anti-loop prevents infinite outline cycles (agent reads → gets outline → re-reads full → passes through)
- Tree-sitter for PHP (17% regex error rate → 0%) and Elisp (regex can't parse s-expressions)
- Regex for TS/JS/Go/Rust/Python/Ruby/CSS/HTML — 0-1% error rate, no grammar overhead
- Tree-sitter is lazy-loaded (18ms cold, 2.3ms warm) — only initializes on first PHP/Elisp read
- Graceful fallback: if WASM fails, PHP falls back to regex (`php-regex.ts`)
- Status widget shows cumulative savings: `📐 8KB`

## Testing

```bash
# Full suite (129 tests, ~500ms)
npm test

# Single file
npx tsx --test tests/elisp.examples.test.ts

# Benchmark against real sessions (read-only)
npx tsx bench.ts
```

## Dependencies

- `web-tree-sitter` — WASM-based parser runtime (runtime dep)
- `tsx` + `fast-check` — test infrastructure (dev deps)
