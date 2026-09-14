## INV-01

Invariant INV-score-immutable holds: Score.final / grade / rank stay rule-engine values.

### Functional

Attaching an AI review to a seeded creator leaves `final`, `grade`, and `rank` unchanged.

### Negative

A human “reject” decision on rank 2 does not write a new score. The triplet stays the rule values.

### Edge

Source-language nickname, Xiaohongshu ID, and raw keywords stay untranslated while the score JSON stays byte-equal after a no-op attach.
