# pi-kit

Personal collection of [pi](https://pi.dev) extensions and skills.

## Extensions

| Name                                         | What it does                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| [context-pruner](extensions/context-pruner/) | Stubs stale tool results before each LLM call (~50% context savings)   |
| [read-outline](extensions/read-outline/)     | Replaces large full-file reads with compact structural outlines        |
| [smart-compact](extensions/smart-compact/)   | Safety net for compaction — catches critical errors pi's default drops |
| [export-org](extensions/export-org/)         | Export the current session to an Org-mode file via `/export-org`       |

## Skills

| Name                                                     | What it does                                               |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| [analysis-workflow-init](skills/analysis-workflow-init/) | Scaffold a hypothesis-driven investigation workspace       |
| [dev-workflow-init](skills/dev-workflow-init/)           | Scaffold an LLM-guided development workflow into a project |

## Local runtime optimizers

This environment also uses the external npm package
[`pi-rtk-optimizer`](https://www.npmjs.com/package/pi-rtk-optimizer), installed
through global pi settings:

```json
// ~/.pi/agent/settings.json
{
  "packages": ["npm:pi-rtk-optimizer"]
}
```

Its runtime config lives at:

```text
~/.pi/agent/extensions/pi-rtk-optimizer/config.json
```

Current role/configuration:

- `enabled: true`
- `mode: "rewrite"` — bash commands are rewritten through `rtk rewrite`
- `outputCompaction.enabled: true` — noisy command output is compacted
  (tests/build/git/lint/search/ANSI/truncation)
- Source `read` compaction is intentionally disabled:
  - `readCompaction.enabled: false`
  - `sourceCodeFilteringEnabled: false`
  - `sourceCodeFiltering: "none"`
  - `smartTruncate.enabled: false`

This makes RTK complementary to this repo's extensions: RTK optimizes bash/tool
output, while `read-outline` handles large full-file `read` results.

Use `/rtk stats` inside pi to inspect RTK savings.

## Repo layout

See [AGENTS.md](AGENTS.md).
