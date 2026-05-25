# smart-compact — Architecture Analysis

> Produced during initial review session. Captures the premise assessment,
> identified bugs, optimization opportunities, and the refactoring plan.

## Premise

The extension intercepts `session_before_compact` and replaces pi's default
compaction with a structured 3-phase pipeline:

1. **Extract** — deterministic fact extraction from messages (zero LLM calls)
2. **Synthesize** — single LLM call with extracted facts as structured context
3. **Verify** — deterministic check that critical facts appear in summary

**Verdict: sound.** Structured extraction → guided synthesis → verification is a
better compaction strategy than "here's the conversation, summarize it." The
implementation is lightweight and focused.

---

## Identified Bugs

### 1. Double `<modified-files>` append

`patchSummary` appends `<modified-files>` for files missing from the LLM output,
then the main code unconditionally appends ALL modified files at the bottom.
Result: duplicated entries.

**Fix:** Remove file-related patches from `patchSummary` — the final file tags
are always appended unconditionally anyway.

### 2. Regex `exec` only captures first match

```typescript
for (const pat of constraintPatterns) {
  const match = pat.exec(text);  // ← only first match
  if (match) constraints.push(...);
}
```

With the `g` flag, `exec` advances `lastIndex` but is only called once. Either
use a `while` loop or drop `g` and use `String.match()`.

### 3. `extractFacts` re-extracts file ops that pi already computed

The `preparation` object includes `fileOps: FileOperations` (with `read`,
`written`, `edited` sets). The extension ignores this and re-parses messages.
Free perf win to use it directly.

---

## Optimization Opportunities

### Conversation size cap

`serializeConversation` truncates tool results to 2K, but overall text can still
be enormous. If compacting because context hit ~200K tokens, feeding ~100K+ of
serialized text into a new call is wasteful and may itself hit limits.

**Solution:** Cap to `(model.contextWindow - 8000) * 3` chars, keeping the tail
(most recent) which matters more — older context is captured in the extraction.

### Reasoning effort

Pi's built-in compaction accepts a `thinkingLevel`. For compaction, low thinking
budget saves latency/cost:

```typescript
reasoningEffort: "low"
```

### Closing instruction after `</conversation>`

Prevents the LLM from continuing the conversation instead of summarizing:

```
</conversation>

Remember: Output ONLY the structured summary. Do not respond to the conversation above.
```

---

## Refactoring Plan: Generator-Effects Architecture

### Why

The entire pipeline is currently one monolithic async handler. The LLM call,
extraction logic, and verification logic are tangled inside the event callback —
making unit testing impossible without mocking pi's internals.

### Target structure

```
smart-compact/
  smart-compact.ts       ← extension entry point (thin runner/shell)
  pipeline.ts            ← generator: yields effects, pure orchestration
  extraction.ts          ← pure: extractFacts, extractText
  verification.ts        ← pure: verify, patchSummary
  prompts.ts             ← pure: buildSynthesisPrompt
  extraction.test.ts     ← property tests
  verification.test.ts   ← property tests
  pipeline.test.ts       ← script-runner tests (step through generator)
```

### Effect types

```typescript
type CompactEffect =
  | { tag: "get_model" }
  | { tag: "get_auth"; model: Model }
  | { tag: "notify"; message: string; level: "info" | "warning" | "error" }
  | { tag: "llm_complete"; prompt: string; model: Model; apiKey: string;
      headers?: Record<string, string>; signal?: AbortSignal };
```

The event handler becomes a thin runner that interprets effects with real I/O.
Tests step through the generator feeding scripted responses.

---

## Property Test Invariants

| Invariant | Property |
|-----------|----------|
| File tracking completeness | `for ALL messages with write/edit tool calls, extractFacts(msgs).files.modified ⊇ {paths from those calls}` |
| Read/modified disjointness | `for ALL extractions, extraction.files.read ∩ extraction.files.modified = ∅` |
| Verification soundness | `for ALL summaries containing all modified filenames, verify(summary, extraction) returns []` |
| Patch idempotence | `patchSummary(patchSummary(s, gaps, ext), gaps, ext) === patchSummary(s, gaps, ext)` |
| Totality (smoke) | `extractFacts() never throws on any well-formed message array` |
| Bounded output | `extraction.errors.length ≤ 10 && extraction.decisions.length ≤ 10 && extraction.constraints.length ≤ 8` |

---

## Minor Issues

| Issue | Notes |
|-------|-------|
| `ContentBlock` type defined locally; doesn't match pi's actual block types | Import from `@earendil-works/pi-ai` or align with `convertToLlm` output |
| Goal detection heuristic (`text.length > 20`) grabs injected context | Consider skipping messages that look like system prompt injections |
| No handling of `preparation.isSplitTurn` / `turnPrefixMessages` | These need a shorter prefix summary, not the main compaction summary |
| `compact-stats` command uses `ui.notify` which is length-limited | Consider `ctx.ui.custom()` with scrollable display for diagnostics |
