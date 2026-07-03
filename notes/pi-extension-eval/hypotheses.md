# Hypotheses

## H1 — Current extensions are net-positive

The current extension stack (context-pruner, read-outline, smart-compact,
pi-rtk-optimizer) improves real sessions more often than it harms them.

**Falsification test:** find sessions where an extension clearly caused extra work,
misleading context, or failed to save meaningful tokens.

## H2 — read-outline is the highest-value token saver

`read-outline` likely contributes the largest direct token savings because it
collapses large full-file reads into structural outlines.

**Falsification test:** find many large reads that were not outlined, or sessions
where the outline caused enough follow-up reading to erase savings.

## H3 — context-pruner mainly removes dead weight

`context-pruner` likely saves context without frequently deleting useful info.

**Falsification test:** find evidence of pruned tool results later being re-requested
or of important details disappearing from the model's working context.

## H4 — smart-compact is a safety net, not a primary saver

`smart-compact` likely matters most in preventing information loss during compaction.

**Falsification test:** find compaction events where critical facts were not preserved,
or sessions where compaction was rare enough that the extension had little chance to help.

## H5 — pi-hashline-edit-pro would be a correctness win in some sessions

Hashline editing would improve edit correctness for repeated-line files, stale
context, and multi-step refactors.

**Falsification test:** find that most edit-heavy sessions were simple enough that
hash anchors would have added verbosity without improving outcomes.
