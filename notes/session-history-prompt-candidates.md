# Session history mining: prompt template candidates

Source: `~/.pi/agent/sessions/**.jsonl`

Privacy mode: aggregate metrics only. No proprietary file bodies or long
user/session snippets were copied into this note.

## Aggregate scan

Sessions scanned: 63

| Category                                     | Sessions | User msgs | Assistant msgs | Tool calls | Compactions | Model changes |
| -------------------------------------------- | -------: | --------: | -------------: | ---------: | ----------: | ------------: |
| PR/review/git workflows                      |       29 |       898 |          5,789 |      5,157 |          49 |            83 |
| Exploration / summary / migration-style work |       10 |       842 |          5,355 |      4,709 |          56 |            22 |
| Coding/debug/audit tasks                     |        3 |       498 |          3,539 |      3,218 |          20 |            19 |
| Other / uncategorized project work           |        9 |       256 |          2,051 |      1,933 |          19 |            16 |
| pi-kit / pi-extension work                   |        6 |       165 |          1,103 |      1,008 |           9 |            14 |
| Investigation / root-cause analysis          |        2 |        97 |            861 |        765 |          11 |             7 |
| Emacs work                                   |        1 |        18 |            111 |        109 |           0 |             3 |
| Data / SQL                                   |        2 |        18 |             52 |         34 |           0 |             2 |
| Docs editing                                 |        1 |         7 |             14 |          7 |           1 |             1 |

## Highest-leverage prompt template candidates

### 1. PR review / branch review

Why: largest category by session count and tool calls.

Candidate prompt:

- `/pr-review`

Likely behavior:

- Inspect current branch vs base.
- Summarize intent, changed files, risky areas, test coverage, and review
  comments.
- Prefer aggregate git/diff commands first, then targeted reads.
- Produce concise review findings grouped by severity.
- Avoid applying edits unless explicitly requested.

Potential arguments:

```text
/pr-review [base-branch] [focus]
```

### 2. Implementation audit / bug audit

Why: coding/debug/audit sessions are fewer but extremely tool-heavy and
compaction-heavy.

Candidate prompt:

- `/audit-code`

Likely behavior:

- Establish scope and failure mode.
- Inventory relevant entry points.
- Trace data/control flow with targeted reads.
- Maintain hypotheses and verified facts.
- End with actionable findings and confidence levels.

Potential arguments:

```text
/audit-code <area-or-risk> [constraints]
```

### 3. Migration / cleanup workflow

Why: exploration-summary category contains long, repetitive, tool-heavy sessions
with many compactions.

Candidate prompt:

- `/migration-plan`
- `/cleanup-pass`

Likely behavior:

- First map current structure and constraints.
- Generate phased plan.
- Execute one phase at a time.
- Run tests/checks after each phase.
- Keep explicit done/remaining list.

Potential arguments:

```text
/migration-plan <target> [constraints]
/cleanup-pass <scope> [style-or-goal]
```

### 4. Investigation workflow launcher

Why: fewer sessions, but very compaction-heavy and high-value. This likely
overlaps with the existing `analysis-workflow-init` skill.

Candidate prompt:

- `/investigate`

Likely behavior:

- Create or reuse an investigation workspace.
- Track hypotheses, verified facts, unsupported facts, open questions.
- Use aggregate metrics first for proprietary data.
- Require evidence for conclusions.

Potential arguments:

```text
/investigate <question> [data/source constraints]
```

Recommendation: this may be better as a thin prompt that invokes or reminds the
agent to use the `analysis-workflow-init` skill when a workspace is needed.

### 5. pi extension development prompt

Why: repo-local work recurs and has specialized conventions.

Candidate prompt:

- `/pi-extension`

Likely behavior:

- Read root `AGENTS.md`, `notes/TODO.md`, `extensions/AGENTS.md`, and target
  extension `AGENTS.md`.
- Identify correct pi extension surface.
- Use current pi 0.78.1 APIs/types.
- Include test/run instructions (`pi -e`, `/reload`).
- Update extension docs/TODO as needed.

Potential arguments:

```text
/pi-extension <extension-name> <task>
```

### 6. Model/cost mode prompt

Why: session history shows frequent model switching and historical migration
from Bedrock to Anthropic/Copilot.

Candidate prompt:

- `/cost-aware`

Likely behavior:

- Prefer Copilot/subscription models for routine tool-heavy coding.
- Reserve direct Anthropic Opus/Sonnet for explicit high-risk reasoning.
- Use targeted reads and context hygiene.
- Compact at phase boundaries rather than automatically lowering thresholds.

Potential arguments:

```text
/cost-aware <task>
```

## Tool usage pattern

Highest-volume sessions are bash-heavy, with read/edit/write following. This
supports existing optimizers:

- RTK for bash output noise.
- `read-outline` for large full-file reads.
- `context-pruner` for stale tool results.
- `smart-compact` for long sessions with frequent compactions.

It also suggests prompt templates should explicitly prefer:

1. aggregate shell/git queries before broad reads;
2. targeted reads after locating relevant files;
3. phase-boundary summaries/compactions for long workflows.

## Recommended first prompt to build

Start with `/pr-review` because it has the strongest historical signal:

- 29/63 sessions
- 5,157 tool calls
- 49 compactions
- 83 model changes

Second choice: `/audit-code`, because the sessions are fewer but very
expensive/tool-heavy.
