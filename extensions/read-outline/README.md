# read-outline

Reduces token consumption by replacing full-file reads with compact structural
outlines, forcing the agent into an outline→targeted-read pattern.

## Why?

Full-file reads are the largest token sink in pi sessions — a 300-line file
costs ~2000 tokens when the agent usually only needs 1-2 functions. By
returning an outline instead, the agent learns the structure and re-reads just
the section it needs with `offset`/`limit`.

## How it works

Hooks pi's `tool_result` event for the `read` tool. When a full-file read
(no offset/limit) returns >150 lines of a supported source file, replaces the
content with a structural outline.

**Example** — reading a 312-line TypeScript file:

```
src/server.ts (312 lines)

── imports ──
import { createApp } from "./app";
import { Config } from "./types";

── outline ──
  - interface Config [4:8]
  E class  Server [10:85]
  E fn     createServer [87:91]
  E const  DEFAULT_PORT [93:93]

── hint ──
File has 312 lines. Use read with offset/limit to view specific sections.
```

**Anti-loop**: Tracks outlined files per session. If the agent re-reads without
offset/limit (wants the full content), the second read passes through.

**Languages**: TypeScript, JavaScript, Python, Go, Rust, Ruby, C/C++,
Java/Kotlin/C#, PHP, CSS, HTML, Elisp.

**Tree-sitter**: PHP and Elisp use WASM-based tree-sitter parsing for exact
spans. All others use regex (sufficient at 0-1% error rate).

## Measured savings

Benchmarked across 14 real sessions (73 outlines):

| Metric                     | Value                                               |
| -------------------------- | --------------------------------------------------- |
| Total savings              | 1118 KB                                             |
| Average reduction          | 88% per outlined file                               |
| PHP accuracy (tree-sitter) | 0% error rate (was 17% with regex)                  |
| Elisp                      | New — 95 KB saved (regex can't parse s-expressions) |

## Commands

Status bar auto-updates: `📐 8KB`

No slash commands — the extension is fully automatic.

## Install

```bash
pi install git:github.com/leo-ar/pi-kit extensions/read-outline
```

Or symlink for development:

```bash
ln -s /path/to/pi-kit/extensions/read-outline ~/.pi/agent/extensions/read-outline
```

Requires `npm install` in the extension directory (for `web-tree-sitter`).
