# Token Efficiency Investigation Summary

## The Core Problem

Tool results (especially `read`) are the biggest token sink in agent sessions. Maki's own data: **reads are 65% of total tokens**, bash only 12%. Our RTK benchmarks showed 90.9% savings on bash output, but bash is already the minority. The real battleground is file reads.

## Evidence from Three Independent Projects

### Maki (tontinton/maki)

- Built `index` tool: tree-sitter skeleton before reads
- Measured: +59 tok/turn overhead, −224 tok/turn saved = **net 165 tok/turn savings**
- Design philosophy: "Every tool result grows your context. Minimize verbose tool calls."
- Agent is explicitly instructed: "Use index before read"

### AFT (cortexkit/aft, 118 stars)

- Built `aft_outline` + `aft_zoom`: structural map → targeted symbol read
- Measured: full file read = ~375 tokens; zoom into one symbol = ~40 tokens (**~90% reduction per read**)
- The outline format is extremely compact: `E fn  createSession(userId, opts?) 12:38`
- 17 registered tools × ~250 tok = ~4,250 tok/turn overhead — they pay this because per-read savings compound fast

### SuPi (mrclrchtr/supi, 9 stars)

- Built `supi-tree-sitter`: 6 tools (outline, imports, exports, node-at, query, callees)
- Uses WASM tree-sitter in-process
- Also 6 tools × ~250 tok = ~1,500 tok/turn overhead

## The Common Pattern

All three converge on the same insight: **give the agent a structural map first, then let it read only what it needs**. The difference is all three register tools (paying the per-turn tax) because they're building standalone products that need to expose the capability.

## Why Our Direction Is Different

We're not building a product — we're optimizing an existing workflow. We have a unique advantage: **`pi-rtk-optimizer` already hooks every `tool_result`**. It can intercept `read` results and transform them *before they enter the context window* — no new tool registration needed.

## The Proposed Approach: Outline-on-Full-Read

Instead of adding tools (+250–4,250 tok/turn overhead), we intercept at the result layer:

1. Agent calls `read` on a file with no `offset`/`limit` (or limit > threshold)
2. Pi executes the read normally (full file content)
3. Our `tool_result` hook intercepts the result
4. If the file is >N lines and a supported language: replace the full content with a tree-sitter outline + the first/last few lines + a hint: "Use offset/limit to read specific line ranges"
5. Agent sees the outline (~50–100 tokens instead of 500–2000), then calls `read` again with targeted `offset`/`limit`

**Cost**: 0 tokens per turn in tool definitions. One extra round-trip on first read of large files.

**Savings**: For a 300-line file that would cost ~750 tokens, we return ~100 tokens (outline) + the agent re-reads ~50 relevant lines (~125 tokens) = **225 tokens vs 750 tokens = 70% savings**. And many times the agent only needs to read *one* section — the outline alone suffices to guide an edit.

## Justification

| Signal | Evidence |
|--------|----------|
| Reads dominate token usage | Maki: 65% of all tokens |
| Outline → targeted read works | 3 independent projects built this pattern |
| Per-read savings are large | AFT: 375→40 tokens per symbol read (89%) |
| Tool registration overhead is real | 250–400 tok/turn per tool, compounds across all turns |
| We can avoid tool overhead | RTK optimizer's existing hook operates on the same layer for free |
| Extra round-trip is acceptable | One re-read is still cheaper than one full read that enters context |

## Combined Stack Effect

```
RTK optimizer (bash):    ~90% savings on bash output (12% of total tokens)
Smart-compact:           Better compaction summaries (reduces post-compact carry-forward)
Outline-on-full-read:    ~70% savings on file reads (65% of total tokens)  ← NEW
```

The outline intercept targets the **largest slice** of token waste with **zero per-turn overhead**. It's the highest-leverage single optimization remaining in our stack.

## Dynamic Tool Injection (Future)

Pi supports `setActiveTools()` which rebuilds the system prompt and tool list per-turn. Tools can be registered but kept inactive until context utilization exceeds a threshold (e.g., >50%). This allows cost-free dormant tools that activate only when their savings exceed their overhead.

Relevant API:
- `pi.registerTool()` — adds to registry
- `pi.getActiveTools()` / `pi.setActiveTools()` — toggles visibility per-turn
- `before_provider_request` — can mutate the full provider payload (including toolConfig)
- Agent-loop returns "Tool not found" error for tools in payload but not in registry

## References

- Maki: https://github.com/tontinton/maki
- AFT: https://github.com/cortexkit/aft
- SuPi: https://github.com/mrclrchtr/supi
- pi-rtk-optimizer: `npm:pi-rtk-optimizer` (installed)
- RTK benchmark: `~/RTK-BENCH.md`
