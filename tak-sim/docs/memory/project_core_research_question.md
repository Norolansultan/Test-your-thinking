---
name: project-core-research-question
description: Core RQ — LLM as information facilitator vs Haku; design decided 25 Sep 2026 and written into SPEC revision (o); what is still open
metadata:
  node_type: memory
  type: project
  originSessionId: 44e3619f-f217-4b2f-8b0d-6d6de7102fad
  modified: 2026-09-25T17:21:48.792Z
---

Core research question (user, 24 Sep 2026): how an LLM acting as an **information facilitator** (retrieving from and integrating recorded situation information) affects commanders' understanding and decisions, compared with a **baseline** of the message log + Haku. The projection is not the manipulation.

Decided 25 Sep 2026 and written into SPEC revision (o) (`02`, `01`, `08`, `09`, `14`, `15`; open items in `11` §7.7). Code not changed yet:
- **Projection shown to both groups**, and both do Type J every cycle. The Haku group's every-cycle "Oma ennuste" is withdrawn.
- **Autonomous-assets future = shared setting (A)**, the same text for both groups, not a manipulation. Degree of autonomy is a later study.
- **LLM = augmenting analysis agent named Thinker** (Haku + LLM), pull-only. **Revised 25 Sep (SPEC/14 rev (q)): live `claude-opus-5-5`, temperature 0, over deterministic time-gated hybrid (lexical + vector) retrieval of the raw records, via a server proxy; full answers logged; deterministic template fallback.** The closed responder and authoring-time drafting were withdrawn: the user expects open, varied questions, and the claim must be about a real LLM. Identical stimulus holds for the world, not for Thinker's wording. A compiled Karpathy-style wiki and full context were rejected; the wiki is kept as a possible later arm.
- **One planted false record, never corrected** (fault F7, SPEC/18 §10): at cycle 8 the command-post operator logs the 110 kV line as "de-energised, confirmed"; it stays live. A data-entry error in the shared data, the same in both groups; Thinker relays it all session. Recognition relies on the contradicting grid-operator record from cycle 6. Scored at freezes 9 and 14 (H9).
- **Primary = H2 calibration on the blanked SAGAT L2/L3 items, phase A, two-sided**. The user chose to keep calibration primary. H1 (accuracy) is two-sided: support vs offloading.
- **Marking = Type E only** (10/20 cycles, counterbalanced). Not fixed to key event cycles, because that would confound H6.
- Free-text rationale is required only on rejection cycles.

**Why:** these decide what the study can claim. The user agreed on 25 Sep 2026 after reflecting on role, primary DV and marking frequency.

**How to apply:** implement code only when the user asks. Open defaults are in `11` §7.7: domain review of the F7 wording, and the setting text. Keep identical stimulus ([[feedback-identical-stimulus]]). Related: [[participant-role-decision]].

**F7 answer key decided 1 Oct 2026:** correct = "not confirmed by the grid operator / probably still live"; "de-energised" = the F7 error. No content change (the grid record's "tieto kytkennästä annetaan erikseen" stays).
