# Hypotheses

## H1

The v1 tool-count heuristic is enough to materially reduce the sessions that
cause excessive token-cached reads.

**Falsification test:** A meaningful fraction of the recorded sessions that
show repeated rehydration / context churn are missed or warned too late.

## H2

Session length is useful as context, but not as a primary bloat signal.

**Falsification test:** Length alone predicts the repeated-rehydration problem
better than the tool-count heuristic.

## H3

The single-circle UI plus single-line command output is sufficient for v1.

**Falsification test:** Users cannot distinguish warning severity or current
state from the minimal UI.
