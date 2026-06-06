# TODO

**Active Mode:** Exploration

## Doing

- [ ] Decide first prompt template to implement from `notes/session-history-prompt-candidates.md` (recommended: `/pr-review`)

## Backlog

### Exploration candidates

- [x] Look through pi session history for candidates to turn into prompt templates — see `notes/session-history-prompt-candidates.md`

### From PD LLM usage patterns

- [ ] Create `/pr-review` prompt template
- [ ] Create `/audit-code` prompt template
- [ ] Create `/migration-plan` or `/cleanup-pass` prompt template
- [ ] Create low-cost prompt templates for common modes (`cheap-coding`, `architecture-pass`, `research-synthesis`)
- [x] Investigate whether pi extensions can switch model/thinking settings programmatically — yes: `pi.setModel`, `pi.setThinkingLevel`, `ctx.modelRegistry.find`
- [ ] Prototype a `model-preset` or `cost-mode` extension
- [ ] Consider a context-usage advisory widget/command that nudges manual `/compact` at task boundaries instead of lowering thresholds globally
- [ ] Investigate whether compaction thresholds are configurable/advisable in pi or `smart-compact`

## Done

- [x] Explore what we could do based on `~/org/topics/pd-llm-usage-patterns.org` — see `notes/pd-llm-usage-patterns-exploration.md`
