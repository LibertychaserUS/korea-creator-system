---
id: inv-01
kind: user-case
readiness: ready
source:
  repo: LibertychaserUS/korea-creator-system
  path: docs/product/DOMAIN.md
  ref: 4b406a0
packages:
  - libs/kcs-domain
---

# Intent

Rules produce Score.final / grade / rank. AI review and human confirmation sit beside the score. They do not write those three fields.

# In scope

- INV-01 Score triplet stays immutable when AI or humans attach a decision.

# Out of scope

- Excel ingest, DeepSeek live calls, export files.

# User cases

1. INV-01 Attach an AI reject or a human reject; the triplet stays the rule values. INV-score-immutable holds.

# Notes

Ready to gate. Suite stays `active`.
