---
id: inv-01
kind: user-case
readiness: ready
source:
  repo: LibertychaserUS/korea-creator-system
  path: docs/03_指标口径与数据源.md
  ref: cursor/fix-launch-blockers-d3aa
packages:
  - packages/kcs-contract
---

# Intent

Selectors compare creators on platform numbers. A number the platform did not give us must read as "—", not as a good or bad value. Adapters, derivation, percentiles, filters and sorting keep it `null`.

# In scope

- INV-01 Missing metrics stay `null`; zero denominators give `null`; real zeros stay `0`.

# Out of scope

- Live vendor calls, currency conversion, UI rendering of "—".

# User cases

1. INV-01 A creator without a quote has no CPE; a "CPE ≤ 5" query does not return them, and sorting by CPE puts them last. INV-metrics-null-not-zero holds.

# Notes

Ready to gate. Suite stays `active`. Replaces the old score-triplet invariant, which went away with the S/A/B scoring.
