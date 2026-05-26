# pi-read-outline

## Goal

Reduce token consumption in pi agent sessions by intercepting full-file `read` tool results and replacing them with compact structural outlines. This forces the agent into an outline→targeted-read pattern (read skeleton first, then re-read only the specific line ranges it needs).

**Target impact**: ~70% reduction on file reads, which represent 65% of total session tokens (per maki's measurements). Zero per-turn overhead because we hook `tool_result` instead of registering new tools (~250-400 tok/turn avoided).

## What This Extension Does

1. Hooks the `tool_result` event for the built-in `read` tool
2. When a full-file read (no `offset`/`limit` params) returns >150 lines of a supported source file:
   - Replaces the full content with a structural outline showing declarations + line ranges
   - Preserves the import/header section verbatim (first ~20 lines of imports)
   - Appends a hint telling the agent to re-read with `offset`/`limit`
3. Agent sees ~50-100 tokens instead of 500-2000, then re-reads just the section it needs

### Example Output

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
  E type   ServerOptions [95:99]
  - fn     internalHelper [101:115]

── hint ──
File has 312 lines. Use read with offset/limit to view specific sections.
Example: read(path="src/server.ts", offset=<startLine>, limit=<count>)
```

## Why This Approach

### Evidence (from investigating 3 independent projects)

| Project | Approach | Overhead | Result |
|---------|----------|----------|--------|
| maki (tontinton) | `index` tool (tree-sitter) | +59 tok/turn | -224 tok/turn on reads |
| AFT (cortexkit) | `aft_outline` + `aft_zoom` tools | +4,250 tok/turn (17 tools) | 90% per-read savings |
| supi (mrclrchtr) | 6 tree-sitter tools | +1,500 tok/turn | structural navigation |

All three register tools and pay per-turn overhead. We avoid this entirely by intercepting at the result layer — the `tool_result` hook in pi's extension system lets us transform what the agent sees without adding any tool definitions to the system prompt.

### Why Not Tree-Sitter (Yet)

- web-tree-sitter requires WASM grammar files (~2-5MB per language)
- Vendoring adds packaging complexity
- Regex-based outlines work well for the top-level declarations we need
- Architecture is designed for drop-in tree-sitter upgrade later (just swap `generateTsOutline` etc.)

## Architecture

```
Agent calls read(path="big-file.ts")
    ↓
Pi executes read normally (full file in memory)
    ↓
Extension runner chains tool_result handlers
    ↓
pi-rtk-optimizer: readCompaction disabled → passes through
    ↓
pi-read-outline: detects full-file read > 150 lines
    ↓
Returns outline + hint instead of full content
    ↓
Agent sees outline, calls read(path="big-file.ts", offset=87, limit=5)
    ↓
Targeted read passes through unmodified (offset/limit present)
```

### Anti-Loop Safeguard

The extension tracks which files have been outlined per session. If the agent reads the same file again **without** offset/limit (meaning it genuinely wants the full content), the second read passes through unmodified. This prevents infinite outline loops.

```
1st read (no offset) → outline returned, file tracked
2nd read (no offset) → full content passed through, tracking cleared
3rd read (no offset) → outline returned again (re-armed)
```

## File Structure

```
extensions/read-outline/
├── package.json       # pi extension manifest (pi.extensions entry point)
└── index.ts           # Single-file extension (~650 lines)
```

### Key Sections in index.ts

| Lines | Section | Purpose |
|-------|---------|---------|
| 1-18 | Header/docs | Design principles |
| 20-40 | Configuration | `LINE_THRESHOLD=150`, `MAX_HEADER_LINES=20`, supported extensions |
| 42-62 | Types | `OutlineEntry`, `ReadInput`, `TextContent` |
| 64-119 | Entry point | Event hooks, anti-loop tracking, orchestration |
| 121-148 | generateOutline | Language detection → dispatch |
| 151-208 | TS/JS outline | Regex patterns for class/interface/function/const |
| 210-247 | Python outline | class/def/CONSTANT patterns |
| 249-273 | Rust outline | pub fn/struct/enum/trait/impl/mod |
| 275-314 | Go outline | func/type struct/type interface |
| 316-349 | Java/Kotlin/C# | class/interface/method patterns |
| 351-385 | C/C++ | struct/enum/function definition patterns |
| 387-413 | Ruby | class/module/def patterns |
| 415-442 | Generic fallback | Universal fn/class/struct patterns |
| 445-525 | Block end detection | Brace-matching, indentation (Python), keyword (Ruby) |
| 527-605 | Formatting | `formatOutlineResult`, `extractHeader`, `isHeaderLine` |
| 608-650 | Utilities | `extractText`, `isSupportedFile`, `detectLanguage`, `padRight` |

## How It Integrates

- **Symlinked**: `~/.pi/agent/extensions/read-outline → ~/Projects/leo-ar/pi-kit/extensions/read-outline`
- **No conflicts**: `pi-rtk-optimizer` has `readCompaction: { enabled: false }` in its config
- **Extension chaining**: Pi chains `tool_result` handlers sequentially; this extension returns early (`{}`) for any non-matching case
- **Branch**: `feat/read-outline` in `~/Projects/leo-ar/pi-kit/` (no commits yet)

## Configuration Knobs (Constants at Top of File)

| Constant | Default | Purpose |
|----------|---------|---------|
| `LINE_THRESHOLD` | 150 | Files with fewer lines pass through unchanged |
| `MAX_HEADER_LINES` | 20 | Max import lines to preserve in outline |
| `SUPPORTED_EXTENSIONS` | Set of 20+ extensions | Only source code gets outlines (not .md, .json, .yaml, etc.) |

## What's Next

1. **Activate**: Run `/reload` in pi to pick up the extension
2. **Test**: Read a large source file (>150 lines) and verify outline appears
3. **Tune**: Adjust `LINE_THRESHOLD` based on real usage — 150 may be too aggressive or too conservative
4. **Measure**: Compare token usage before/after across several sessions
5. **Upgrade path**: Replace regex outlines with tree-sitter for better accuracy on complex nesting
6. **Consider**: Adding a `before_agent_start` hint to teach the agent the offset/limit pattern proactively (AFT does this — ~100 token system prompt append)

## Related Files

- `~/Projects/leo-ar/pi-kit/investigation-summary.md` — Full research summary justifying this approach
- `~/RTK-BENCH.md` — RTK optimizer benchmarks
- `~/.pi/agent/extensions/pi-rtk-optimizer/config.json` — RTK config (readCompaction disabled)
- `~/.pi/agent/settings.json` — Pi settings (packages, model, etc.)
