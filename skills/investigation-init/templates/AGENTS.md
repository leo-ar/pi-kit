# AGENTS.md — Investigation Workflow

Rules for conducting data investigations in this directory.

---

## Methodology: Scientific Investigation

### Phase 1: Observe

- Profile the data source: what writes to it, what's filtered, what's known noise.
- Run exploratory queries. Note patterns without interpreting them.
- Record raw observations in `notes.md` (scratchpad, not a deliverable).
- **Do NOT form conclusions in this phase.** Only state what you see.

### Phase 2: Question

- For each observation, formulate **specific questions** — not answers.
- Example: "Weekly views jumped from 150K to 700K starting Apr 13" →
  - "What user agents appeared that week that weren't present before?"
  - "Did the increase come from new IPs or existing ones?"
  - "Is this correlated with a known campaign launch?"
- Record questions in `hypotheses.md`.

### Phase 3: Hypothesize

- For each question, propose **multiple competing explanations** (minimum 2).
- For each hypothesis, define before testing:
  - **Confirmation test:** what evidence would support this?
  - **Falsification test:** what evidence would disprove this?
- Example:
  ```
  Observation: Weekly views jumped 5× starting Apr 13.

  H1: A bot is generating fake page views.
    Confirm: A small number of IPs/UAs account for the majority of new views.
    Falsify: Views come from 10K+ diverse IPs with normal browsing patterns.

  H2: A new paid campaign launched.
    Confirm: UTM tags show a new campaign starting that week.
    Falsify: The new views have no UTM attribution and no referrer.

  H3: A known automated service increased its activity.
    Confirm: Views match known service UAs or IPs.
    Falsify: No known service UA/IP accounts for the increase.
  ```
- **Never test only the confirmation side.** Always run the falsification test too.

### Phase 4: Test

- Run queries that test each hypothesis — both confirmation and falsification.
- Record results in `hypotheses.md` next to each hypothesis.
- Accept one of three outcomes for each hypothesis:
  - **Confirmed** — confirmation test passed AND falsification test failed to disprove
  - **Refuted** — falsification test succeeded in disproving
  - **Inconclusive** — neither test was decisive; note what additional data would resolve it
- **"Inconclusive" is a valid and respectable outcome.** It is always preferable
  to a premature wrong conclusion.

### Phase 5: Verify

- Confirmed hypotheses become facts. Record them in `verified-facts.md` with:
  - The claim
  - The exact query or method used
  - The result
  - The date verified
  - What was tested to falsify (and why it failed to disprove)
- Inconclusive items go to `open-questions.md` with notes on what additional
  data or access would resolve them.

### Phase 6: Write

- Reports reference only facts from `verified-facts.md`.
- Inconclusive items may appear in reports but must be labeled as such.
- If a number isn't verified, use "TBD" or "unverified" — never state it as fact.
- Write reports only after the hypothesis cycle is complete.

### Phase 7: Review

- Re-read every report end-to-end.
- For each claim, check: is it in `verified-facts.md`? Was the falsification
  test run? Could an alternative explanation still hold?
- Run the verification checklist (below).

---

## Verification Checklist

Before any number goes into a report, confirm:

- [ ] **Date ranges match** — numerator and denominator use the same window
- [ ] **Filters are consistent** — same exclusions in both "before" and "after"
- [ ] **Classifications are grounded** — confirmed via multiple independent signals,
      not a single data point
- [ ] **Cross-referenced** — at least one independent signal supports the claim
- [ ] **Percentages sum** — all categories add to ~100%, no double-counting
- [ ] **Labels are precise** — "confirmed" vs. "suspicious" vs. "inconclusive"
- [ ] **Alternative explanations considered** — at least one competing hypothesis
      was tested and refuted before concluding
- [ ] **Multiple data sources checked** — the query tool tells you *what* changed;
      code/config tells you *why*; logs/history tells you *when and who*

---

## Rules for `verified-facts.md`

1. **Immutable without query access.** Only sessions that can successfully run
   queries against the data source may add, modify, or remove entries in
   `verified-facts.md`.
2. **Reports defer to verified-facts.** If a report contradicts `verified-facts.md`,
   the report is wrong — fix the report, not the facts file.
3. **Unsupported claims go to `unsupported-facts.md`.** If a session finds a
   specific number or claim in a report that has no corresponding entry in
   `verified-facts.md`, it must:
   - Add the claim to `unsupported-facts.md` with the source file and line
   - NOT modify `verified-facts.md`
   - NOT assume the claim is correct or incorrect
4. **Query sessions resolve `unsupported-facts.md`.** On each session start with
   data access, check `unsupported-facts.md`. For each entry, run the query:
   - If confirmed → add to `verified-facts.md`, remove from `unsupported-facts.md`
   - If refuted → fix the report, remove from `unsupported-facts.md`

---

## Naming Conventions

| File | Purpose |
|---|---|
| `AGENTS.md` | This file — workflow rules |
| `hypotheses.md` | Questions, competing hypotheses, confirmation/falsification tests, results |
| `verified-facts.md` | Single source of truth for confirmed numbers (immutable without data access) |
| `unsupported-facts.md` | Claims in reports lacking verified-facts backing — awaiting confirmation |
| `open-questions.md` | Inconclusive items — what additional data would resolve them |
| `notes.md` | Scratchpad during observation (not a deliverable) |
| `TODO.md` | Open investigation threads |
| `README.md` | Executive summary (written last, references verified-facts) |
| `*.md` (other) | Standalone investigation reports |

---

## Common Pitfalls (learned the hard way)

1. **Jumping from observation to conclusion** — skipping the hypothesis/test
   cycle. The most common and most costly error.
2. **Testing only the confirmation side** — finding evidence that supports your
   first guess and stopping there. Always ask "what would disprove this?"
3. **Single-hypothesis thinking** — the first explanation that fits is not
   necessarily correct. Always generate at least 2 competing explanations.
4. **Writing reports mid-investigation** — conclusions change; early reports
   become wrong and require full rewrites.
5. **Trusting context summaries over queries** — if a prior session said X,
   re-verify it. Context summaries can contain stale or incorrect claims.
6. **Mixing date ranges** — especially when comparing periods. Define windows
   explicitly and verify both sides use the same window.
7. **Single-source causation** — the data tells you *what* changed, not *why*.
   Always check code, config, and history before claiming a cause.
8. **Treating "unexplained" as "suspicious"** — dark social, email clicks,
   bookmarks, and direct/unattributed sources are all legitimate.
9. **Labeling third-party services incorrectly** — always specify relationships
   precisely (e.g., "third-party service used by X" vs. "X's own service").
10. **Time zone assumptions** — always state time zones explicitly and verify.
11. **High volume ≠ automated** — large counts from many diverse IPs/users is
    almost certainly real. Always check distribution before classifying.

---

## Starting a New Session

When resuming this investigation in a new session:

1. Read `AGENTS.md` (this file) first
2. Confirm data access — determines what you can do this session
3. If data access available: read `unsupported-facts.md` and resolve pending items
4. Read `verified-facts.md` for grounded numbers
5. Read `open-questions.md` for inconclusive threads
6. Read `hypotheses.md` for investigation state
7. Read specific report files only as needed
8. Do NOT trust conversation summaries for specific numbers — verify against
   `verified-facts.md`

---

## Starting Fresh (Clean Investigation)

When beginning a new investigation on the same data:

1. Read `AGENTS.md` (this file) only
2. Profile the data source (Phase 1: Observe) before anything else
3. Do NOT read prior reports or conclusions — they may bias your hypotheses
4. Follow the phases in order: Observe → Question → Hypothesize → Test → Verify → Write → Review
