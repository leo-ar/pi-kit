# Tree-sitter Analysis: Integration Feasibility

## Summary

**Verdict: Use tree-sitter selectively — only for Elisp (and Org-mode later). Keep regex for brace-based languages.**

## Performance Results

| Metric | Value | Budget |
|--------|-------|--------|
| `Parser.init()` (cold) | 8ms | — |
| Load grammar (elisp, 52KB) | 2ms | — |
| Parse 300 lines | 7ms | <50ms ✅ |
| Parse 1800 lines (49KB) | 10ms | <50ms ✅ |
| Warm re-parse | 1.7ms | — |
| AST walk | 0.5ms | — |
| **Total first-call** | **18ms** | <50ms ✅ |

## Dependency Cost

| Option | Size | Notes |
|--------|------|-------|
| `web-tree-sitter` (WASM runtime) | 376KB | Zero native deps, pure JS+WASM |
| `tree-sitter-wasms` (all 36 grammars) | 49MB | ❌ Too large |
| Only `tree-sitter-elisp.wasm` | 52KB | ✅ Cherry-pick what we need |
| Runtime + elisp grammar total | 244KB | ✅ Acceptable |

## AST Structure (Elisp)

The tree-sitter-elisp grammar produces typed top-level nodes:

```
function_definition  → (defun NAME (args) body)
macro_definition     → (defmacro NAME (args) body)
special_form         → (defvar NAME value), (defcustom ...), etc.
```

Walking is trivial: iterate `root.childCount`, match by `node.type`, extract `child(2)` as the name symbol.

## Why NOT retrofit tree-sitter for all languages?

### Performance: Regex is 15x faster

| Metric | Regex | Tree-sitter | Ratio |
|--------|-------|-------------|-------|
| Parse 630 lines TS (avg 100 runs) | 0.15ms | 2.31ms | 15x slower |
| Memory per parse | ~0 (no AST) | ~1KB/tree | — |
| Cold start (grammar load) | 0ms | +2-8ms per grammar | — |

Both are well within the 50ms budget. **Speed is not a differentiator.**

### Accuracy: Tree-sitter IS better for edge cases

Hard cases where regex struggles but tree-sitter is perfect:

| Pattern | Regex | Tree-sitter |
|---------|-------|-------------|
| Multi-line signatures | ⚠️ May miss or wrong end-line | ✅ Exact |
| Braces inside type annotations | ⚠️ `findBlockEnd` confused | ✅ Exact |
| Arrow fn assigned to `const` | ⚠️ Often missed | ✅ Exact |
| Complex generics `<T extends { }>` | ⚠️ Brace counting broken | ✅ Exact |
| Overloaded signatures | ⚠️ May count wrong | ✅ Distinct nodes |
| Nested objects in `const =` | ⚠️ End-line wrong | ✅ Exact |

These edge cases **do occur in real code** — especially in TypeScript.

### Code simplification

| Approach | Lines of code | Maintenance |
|----------|---------------|-------------|
| Current regex (all langs) | 575 lines (11 files + block-end) | Each language is bespoke regex |
| Tree-sitter (all langs) | ~150 lines (generic walker + config) | One generic AST walk, per-lang config table |
| Hybrid (regex for most, TS for some) | ~650 lines | Two systems to maintain |

A tree-sitter-for-all approach would:
- **Eliminate `block-end.ts` entirely** (79 lines) — AST gives exact spans
- **Replace each language file** with a small config: "which node types are outline-worthy?"
- **Reduce total code by ~70%** for equivalent or better results

### Dependency weight

| What we'd bundle | Size |
|------------------|------|
| `web-tree-sitter` runtime | 376KB |
| Grammars we use (elisp+css+php+html+ts+js) | 3.8MB |
| **Grammars if only elisp** | 52KB |

3.8MB for all grammars is significant for an extension. But: these are static `.wasm` files loaded lazily on demand — only the grammar for the current file's language loads.

### Summary table

| Factor | Regex | Tree-sitter all | Tree-sitter elisp-only |
|--------|-------|-----------------|------------------------|
| Speed | 0.15ms | 2.3ms | 2ms (elisp only) |
| Accuracy | Good (87-94% reduction) | Perfect spans | Perfect (elisp only) |
| Code size | 575 lines | ~150 lines | +50 lines on top of regex |
| Dep weight | 0 | 4.2MB | 428KB |
| Maintenance | 11 bespoke files | 1 generic walker | Hybrid: two systems |
| Block-end bugs | Occasional | None | None (elisp only) |

## Org-mode Status

- Grammar exists: `milisims/tree-sitter-org` (235⭐)
- **No prebuilt WASM** in `tree-sitter-wasms` package
- Would need to build from source: `tree-sitter build --wasm`
- This adds a build step to the extension (or we commit the .wasm)
- **Recommendation: Delay Org-mode.** Focus on Elisp first (prebuilt WASM available, proven grammar). Add Org-mode later once the tree-sitter infrastructure is in place.

## Proposed Architecture

```
src/
  tree-sitter/
    init.ts          — Lazy singleton: Parser.init() + grammar cache
    elisp.ts         — generateElispOutline(lines) using tree-sitter
  languages/
    typescript.ts    — regex (keep)
    php.ts           — regex (keep)
    css.ts           — regex (keep)
    html.ts          — regex (keep)
    ...
  outline.ts         — dispatch: elisp → tree-sitter, rest → regex
```

Key design points:
- **Lazy init:** Only `Parser.init()` on first elisp file read (not at extension load)
- **Grammar bundled:** Commit `tree-sitter-elisp.wasm` to the repo (52KB)
- **Graceful fallback:** If WASM fails to load, fall back to a simple regex Elisp generator
- **web-tree-sitter as dep:** No native compilation needed, works everywhere

## Decision

**Path C (Phased migration), starting with Elisp + PHP.**

### Phase 1 (now): Elisp + PHP via tree-sitter
- Elisp: regex fundamentally can't work (balanced parens)
- PHP: 17% error rate in real sessions — actively harmful
- Total dep cost: 376KB runtime + 52KB elisp + 794KB php = ~1.2MB

### Phase 2 (deferred): TypeScript/JavaScript
- 1% error rate — livable, not harmful
- 2.3MB grammar is the largest single file
- Wait until Phase 1 proves the infrastructure, then re-evaluate
- If wrong spans annoy in practice, pull the trigger with confidence

### Phase 3 (deferred): Org-mode
- No prebuilt WASM, needs custom build step
- Wait until tree-sitter infra is stable

### Not planned: CSS, HTML, Go, Python, Rust, Ruby
- CSS/HTML: regex works, 0% error in sessions
- Go/Python: 0% error rate, indentation/brace semantics are simple
- Rust/Ruby: no session data to measure, regex adequate

### Rationale for deferring TS/JS
- 99% accuracy is sufficient for outline purpose (agent decides what to read in detail)
- 2.3MB grammar adds significant weight for marginal improvement
- Phase 1 validates the walker pattern; TS/JS becomes trivial follow-up if needed
- Re-run bench after Phase 1 and decide with data
