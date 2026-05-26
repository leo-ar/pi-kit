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

| Factor | Regex (current) | Tree-sitter |
|--------|----------------|-------------|
| PHP/CSS/HTML accuracy | Good enough (94%/87% reduction) | Marginally better |
| Startup latency | 0ms | +18ms per new grammar |
| Dependency weight | 0 | +376KB + grammar WASMs |
| Maintenance | Own code, easy to tweak | Grammar version coupling |
| Parsing edge cases | Occasionally wrong block-end | Perfect |

**The regex approach works well for brace-based languages.** Adding tree-sitter for PHP/CSS/HTML would add complexity and dep weight for marginal improvement. Our bench shows 87-94% reduction already.

**Elisp is different:** parenthesized syntax with no visual block delimiters makes regex brittle. A regex `(defun` approach can't reliably find the end of a form without counting balanced parens — which is essentially reimplementing a parser. Tree-sitter does this natively.

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

1. ✅ Add `web-tree-sitter` as dependency
2. ✅ Bundle `tree-sitter-elisp.wasm` (52KB)
3. ✅ Implement Elisp outline via tree-sitter
4. ⏸️ Org-mode: defer (no prebuilt WASM, needs build step)
5. ❌ Don't retrofit regex languages to tree-sitter (not worth the cost)
