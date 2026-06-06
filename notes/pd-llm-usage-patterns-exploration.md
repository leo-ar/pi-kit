# Exploration: PD LLM usage patterns → pi-kit opportunities

Source: `~/org/topics/pd-llm-usage-patterns.org`

## Relevant observations

- Sessions are highly agentic/tool-heavy: most assistant turns end in tool use rather than natural stop.
- Context compaction is common: average 2.6 compactions/session, max 13.
- Token volume is dominated by cache reads, not output.
- Current provider strategy shifted away from Bedrock toward Anthropic + GitHub Copilot subscriptions.
- Copilot-backed models are the biggest cost/convenience lever for routine coding.
- Expensive Anthropic direct models should be reserved for higher-risk reasoning.
- Existing pi-kit optimizers map well to the observed pain points:
  - `context-pruner` reduces repeated stale context.
  - `read-outline` reduces large full-file read results.
  - `smart-compact` protects long sessions during frequent compaction.
  - `pi-rtk-optimizer` handles bash/tool-output noise outside this repo.

## Candidate work

### 1. Model routing preset command

Surface: pi extension.

Add a command that switches between named model presets based on task type:

- `/model-preset cheap-coding` → Copilot GPT model, minimal thinking.
- `/model-preset review` → Copilot Sonnet/GPT model.
- `/model-preset architecture` → Anthropic Sonnet, higher thinking.
- `/model-preset opus` → Anthropic Opus, explicit high-cost mode.

Potential value: makes the recommended assignment matrix actionable without needing to remember model names.

Finding: pi 0.78.1 does expose model/thinking mutation APIs from extensions.

Relevant APIs:

- `ctx.model` — current model
- `ctx.modelRegistry.find(provider, modelId)` — lookup a model by provider/id
- `ctx.modelRegistry.getAvailable()` — list auth-available models
- `pi.setModel(model)` — switch model; returns `false` if no API key/auth
- `pi.getThinkingLevel()` — current thinking level
- `pi.setThinkingLevel(level)` — set thinking level, clamped to model capabilities
- Events: `model_select` and `thinking_level_select`

This makes a real `/model-preset` or `/cost-mode` extension feasible.

### 2. Cost-aware session status widget

Surface: pi extension.

Show lightweight current-session hints:

- Current provider/model.
- Whether model is subscription-backed vs direct API.
- Whether current model is a high-cost mode.
- Optional warning when using Opus/1M context for routine sessions.

Potential value: reduces accidental expensive-model drift.

Caveat: Need reliable access to current model/provider and whether pricing metadata can be maintained without going stale.

### 3. `/cost-mode` command or shortcut

Surface: pi extension or prompt template.

Modes:

- `economy` — prefer Copilot defaults, minimal thinking, aggressive context hygiene.
- `balanced` — Sonnet for code work, Opus only on request.
- `premium` — allow Opus/high thinking/long context.

Potential value: simpler than per-task model presets; maps to user intent.

### 4. Prompt templates for routing discipline

Surface: prompt templates under `.pi/prompts/` or packaged prompts.

Examples:

- `/cheap-review` — instruct agent to use current cheap model, prioritize targeted reads, avoid broad context loading.
- `/architecture-pass` — explicit high-reasoning pass with evidence requirements.
- `/research-synthesis` — long-doc synthesis mode with compaction checkpoints.

Potential value: low implementation cost; does not depend on extension API support for changing model settings.

### 5. Compaction policy documentation / smart-compact enhancement

Surface: docs or `smart-compact`.

The org note suggests earlier compaction thresholds (soft 45–50%, hard 60–65%). Investigate whether pi exposes compaction threshold settings/events. If configurable, document recommended settings; if not, consider a `smart-compact` advisory widget or command.

Potential value: reduces cache-write growth and protects long sessions.

### 6. Session mining for actual routing opportunities

Surface: analysis script, then prompts/extensions.

Analyze session metadata only:

- Model switches by session type/name.
- Sessions where expensive models were used for routine tool dispatch.
- Sessions with many compactions.
- Sessions with repeated broad reads or high cache-read volume.

Potential value: turns the org-level strategy into evidence-backed pi-kit features.

Privacy note: For PD/proprietary sessions, use aggregate metrics only unless explicitly approved.

## Recommended next step

Since model switching is supported, the strongest path is now:

1. Prototype a small `model-preset` / `cost-mode` extension with named presets.
2. Add prompt templates for the most useful modes once the command names and workflows feel right.
3. Mine session history for additional prompt-template candidates (the second backlog item).

## Decision candidates

- If we want fast value: prototype `/cost-mode economy|balanced|premium`.
- If we want lower implementation cost: build prompt templates first.
- If we want evidence: mine session history for prompt-template and model-routing candidates.
