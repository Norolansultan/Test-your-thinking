---
name: feedback-identical-stimulus
description: Everything participants see must be pre-planned and identical for every person within a condition — no runtime randomness
metadata:
  node_type: memory
  type: feedback
  originSessionId: 29757203-5b14-409f-9299-bd3ea8bee2f9
  modified: 2026-09-24T16:05:00.979Z
---

Everything in the simulation must be planned in advance and behave identically for every participant, in both conditions (directed/radio and substitutive/AI) — only the condition's designed difference (the AI projection and AI panel) may differ.

**Why:** the user (24 Sep 2026) asked what is produced by random generators; comparability between participants is the core of the study.

**How to apply:** randomness only at build time with fixed seeds, frozen into committed artefacts (site-scenario.json, basemap, corpus); never Math.random or per-session seeds at runtime (determinism-lint enforces for app/tools). When adding generated content, verify a rebuild is byte-identical and add a test that the build is identical twice. Related: [[feedback-ruflo-every-step]].

**Exception (25 Sep 2026):** Thinker's wording is live-generated (SPEC/14 rev (q)). Its retrieval stays deterministic and every answer is logged. Everything else remains frozen.
