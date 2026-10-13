---
name: project-build-status-rev-opq
description: State after the 25–26 Sep 2026 build of SPEC revisions o/p/q (T1–T6 commits); what works and what still blocks a pilot
metadata:
  node_type: memory
  type: project
  originSessionId: 44e3619f-f217-4b2f-8b0d-6d6de7102fad
  modified: 2026-09-25T23:16:06.099Z
---

On 25–26 Sep 2026, SPEC revisions (o), (p) and (q) were built in T1–T6 (local git; commits 2f8c451 … c1f4690; no remote configured). The status then: 596 tests green, a clean clone passes, and both conditions were driven end to end in the browser.

**Works:**
- 1 practice view + 14 views;
- projection and Type J in both groups;
- the rationale only after a rejection;
- F7 and the rekindle data;
- Thinker proxy (`npm run thinker:server`, port 8787) with the template fallback when there is no key;
- strategic guidance delivered at V8.

**Blocks a pilot (from T6):**
- **Retrieval:** Thinker's retrieval misses the rekindle objection on narrow questions (repeated VPK AVL lines crowd it out), and "voimajohto" misses F7. This is the user's decision; don't tune toward the design.
- **Probes not in the UI:** SPAM, E, F and U, plus preflight and consent.
- **Allocation placeholder:** wrong sector labels (L3 labelled as "kylän suojaus"), and only 5 units.
- **Telemetry:** in memory only; Haku free-text queries are unlogged.
- **Synthetic content:** SA items (2–3 per freeze instead of 5) and the Finnish drafts, pending review.
- **No API key yet:** `npm run thinker:live-check` needs `ANTHROPIC_API_KEY`.
- **Data protection:** the consent text and the data-processing agreement.
- **Validity label:** the projection's "ennuste voimassa … saakka" is not rendered.

**Spec-vs-code deviations the user knows about** (the user said no spec edits, so SPEC is unchanged):
- the T1 floor is 180 (SPEC/02 says 200);
- there is no temperature, because `claude-opus-5-5` rejects it (SPEC/14 q says temperature 0);
- the projection label is neutral "Leviämisennuste" (SPEC/12 says AI-ENNUSTE).

**How to apply:** start the next session from this list. Related: [[project-fifteen-views-rekindle]], [[project-core-research-question]].
