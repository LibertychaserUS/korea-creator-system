## INV-01

Invariant INV-metrics-null-not-zero holds: a metric the platform did not return stays `null`, never `0`.

### Functional

An empty metrics record is all `null`. Deriving ratios from a record that only has followers and a quote fills nothing that needs a missing input.

### Negative

Blank, dash, `N/A` and other unparsable vendor cells parse to `null`. A zero denominator gives `null`, not `0` or `Infinity`.

### Edge

A real `0` from the platform stays `0`. A `null` metric gets no cohort percentile, does not pass a `≤` filter, and sorts after known values.
