# 17 — Pre-build review, 17 September 2026

**Status: review, not governing.** Scope: `SPEC/00`–`16` (v3.4 state), `SAGAT_measurement_spec.md`, and `HANDOFF_Projection_Judgement_Loop.md`. Findings that need a decision are registered in `11` §7.2.

**Not reviewed:** `PhD_Simulation_Scenarios.xlsx`, `Data_Management_Plan.md` (not supplied).

---

## 1. Verdict

**The engine can start; the experiment cannot yet be built end to end.**

- **M1–M4** (engine, determinism, scenario contract, render boundary, telemetry) depend on nothing unresolved and can start now.
- **M5–M8** (conditions, reasoning AI, probes, decisions) have design contradictions introduced on 17 September that must be resolved first. Six are serious (§2).
- **Authoring** (the largest task) is still blocked on the domain reviewer, the spread rates and the geometry (`11` §1.2, §2.1–§2.2), none of which changed.

---

## 2. Design problems — resolve before M5

### P1. Reasoning AI is now pulled, but the hypotheses assume it is pushed

`01` §1 and H2, H3, H6 rest on a machine that integrates **without being asked** ("the comparison has been performed and presented as settled"). `02` §1.2 makes this a rule: an integration the participant must request "remains assistive", and an unused capability "yields a null that means nothing". `14` makes reasoning AI request-driven.

**Consequence:** a participant in the reasoning group who never asks is behaviourally identical to the query group. H3 (contradiction detection lower when the conflict is resolved for you) cannot occur unless the participant happens to ask about the northern flank at cycle 18.

**Options:** (a) push one reasoning package per cycle at a fixed offset, *and* allow queries — the minimum that keeps the hypotheses; (b) keep pull-only and rewrite H2/H3/H6 as conditional on use, with use as a mediator; (c) keep pull-only and accept that Paper 1 tests *availability* of integration, not integration.
**Recommendation:** (a). `14` §7 already notes the engine supports it.

### P2. Reasoning packages are prose; v3.0 forbids prose in the integrating condition

`02` §1.2: "Prose is excluded deliberately — prose smuggles in an explanation design, which is a separate large variable." `04` §6 types the channel as closed-vocabulary signals. `14` §3.2 gives reasoning packages a free Finnish `bodyFi`.

**Consequence:** reasoning AI now differs from query AI in *integration* and in *explanation style* at once. A calibration difference cannot be attributed to integration alone.
**Options:** constrain reasoning packages to a fixed template (category · state · certainty · sources · one-line implication), or declare explanation style as part of the manipulation and rewrite `02` §1.2.

### P3. Reasoning packages can leak the answer to the containment judgement

The machine's envelope is deliberately wrong half the time. A `projection` package written by an LLM from the atoms may describe a *different* development from the envelope — sometimes the true one. The reasoning group then gets a hint the others do not.

**Missing rule (add to `14` §4):** every `projection` and `meaning` package must be derived from **the same model state as that cycle's envelope, including its error**, never from truth. Lint: projection text must be consistent with `Envelope.polygon`; any mention of the breach mechanism before it surfaces fails. This is as important as I4.

### P4. "Maintained guidance" is not specified in the pull design

`02` §7.2 (v3.0) defined maintained guidance as the channel restating intent and flagging alignment each cycle. `16` only adds alignment feedback *after* a choice. Nothing tells the builder how the via-AI cell's AI keeps intent present during the working period.

**Needed:** a pushed intent restatement each phase-B cycle for the via-AI cell (the existing `ChannelSignalSet.restatesIntent` field fits), with its wording and offset authored.

### P5. Alignment feedback contradicts the "machine never recommends" rule

`12` §6.3 and the handoff (§10) exclude machine advice at the decision boundary because it turns doubt–action coherence into a compliance measure. `16` §4 shows alignment feedback on the course-of-action choice **immediately before the allocation**.

**Consequence:** in the via-AI cell, allocation and doubt–action coherence partly measure compliance, and H5 (divergence) is pushed toward convergence by instruction.
**Options:** show feedback *after* the allocation is submitted (then it affects only later cycles); or restrict the via-AI manipulation to intent restatement (P4) without per-choice feedback; or keep it and exclude the via-AI cell from coherence and H5 analyses. Decide explicitly and record it in `12` §6.3.

### P6. Paper 1 phase B is no longer comparable across groups

In phase B, half the reasoning group receives different treatment. `02` amendment says "guidance mode as a covariate", but with one cell only, that is a group × cell imbalance, not a covariate.

**Recommendation:** Paper 1 primary tests on **phase A only** (cycles 1–10, identical for all), phase B as secondary with the via-AI cell excluded or modelled separately. This halves Paper 1's trials (10 J per person) — acceptable for group-level models but it must be stated in the pre-registration. Update `09` §7.1.

### P7. The L3 freeze item may be answered by recalling the envelope

Freezes occur **after** the reveal and judgement in the same cycle (`03` amendment). An L3 item "where will the fire front be at the next boundary" asks for exactly what the envelope just showed. Participants can answer by recalling the machine's polygon, which is also wrong half the time. The item then measures memory of the envelope, not the participant's projection.

**Fix:** L3 freeze items must ask about projections the envelope does **not** encode: consequences for units, roads, water, people ("which formation will need relief first", "will the water route remain usable"). Do not use a longer horizon — `12` §7.2 and the handoff forbid it because it leaks the next cycle. Add this rule to `15` §4.4 and `08`.

### P8. Session length is at the limit for unsupervised home testing

The session is ~140 min on the day (`15` §2), plus the handoff's branch choice (≈ +2 min). Each cycle has four responses (judgement, course of action, allocation, rationale), and there are ten 90-second freezes. `09` §6.2 already plans 25–35% attrition for a 102-minute session.

**Consequence:** attrition likely higher, and not at random (fatigue is a studied variable). With 200 recruited and ~35% loss, the Paper 2 cells (~33) fall to ~21.
**Options:** drop the free-text rationale on non-rejection cycles; shorten freezes to 4 items in the main block; allow a second scheduled break; or enlarge the reasoning group (`02` amendment option).

---

## 3. Smaller inconsistencies

| # | Issue | Where | Fix |
|---|---|---|---|
| S1 | Prologue cycles have no place in `CycleSpec`: `startsAtVirtual = (index−1) × 1200` gives no time before cycle 1; `CycleIndex` excludes `W1–W5` | `04` §6 | Define prologue timing (negative offsets or re-base) and a union index type |
| S2 | Prologue envelopes' flags and whether they count in Gate 1 | `03`, `01` §5 | Define prologue flag sequence (suggest 3 holds, 2 breaches, no categorical) and exclude from gates |
| S3 | Expectation marking (E) not defined for prologue | `08` §3.3 | State: none in prologue |
| S4 | "No AI" label is misleading: every group judges a **machine** projection | `02`, `15`, `00` | Label "no AI support"; keep the envelope identical across groups |
| S5 | Projection horizon: chat notes said 10 min; spec says next boundary (20 virtual min) | Briefing, L3 items | Use the spec: 20 min, rendered as *ennuste voimassa klo HH:MM saakka* |
| S6 | "Sound" option in `16` is undefined: judged against information available then, or against what later happened? | `16` §3, §5 | Define as sound **given information available at that moment**; the panel classifies without seeing later cycles |
| S7 | SPAM probes consume up to 50 s of a 90 s working period while bubbles keep arriving | `15` §5 | Place SPAM offsets after the last bubble; log AI queries made during SPAM (with-tools answers differ by group by design) |
| S8 | Freezes always fall at the same point inside the cycle (after judgement) — predictable within-cycle | `08` §2 | Accept and declare (v3.0 already defends deterministic timing) |
| S9 | Coding manual for query text (SA level, function, grounding, framing) is not a listed deliverable | `11` §4.2 | Add as a third coding manual |
| S10 | Condition ids vs labels: `substitutive` now names a pull engine | `02`, `14` | Decide F3; renaming later is a corpus-wide edit |
| S11 | Embedding model breaks byte-identical determinism unless results are replayed from log | `14` §5 | Already mitigated; `00` I1 should be amended to say so |
| S12 | `13` and `SAGAT_measurement_spec.md` still carry superseded numbers (14 freezes etc.) | — | Non-governing; leave, or archive |
| S13 | Pre-registration, power simulation and DPIA not started | `11` §1.5, §4.3 | Unchanged blocking items |

---

## 4. Level 3 SA — what the design contains

| Element | L3? | Notes |
|---|---|---|
| **Type J** — judge the machine's 20-min projection | Yes (evaluative) | Judging another's projection; the primary DV |
| **Correction polygon** on `fundamentally_wrong` | **Yes (generative)** | Participant's own projection; scored for relative accuracy |
| **Breach point** on `partly_wrong` | Partly | Localises where a projection fails |
| **Type E** — expectation marking before the reveal | **Yes (generative)** | The cleanest L3 measure; 10 main cycles |
| **Branch choice** (handoff §5.3) | Yes (categorical) | Not yet in the spec |
| **Type F** — "what would you see if this were wrong?" | L3 / metacognitive | 3 items |
| **Coverage confidence** (cycle 20) | L3-related | Confidence about projection outcomes |
| **Freeze L3 item** (1 per freeze, 10 total) | Yes, if P7 is fixed | Otherwise a memory test of the envelope |
| **Reasoning packages of type `projection`** | Machine L3 | Must follow P3 |
| **Course-of-action choice** | Implicit L3 | "Sound" depends on projected development (S6) |
| **Allocation robustness/safety** | Implicit L3 | Scored against counterfactual branches |
| **SPAM** | No | L1/L2 only |

**Conclusion:** L3 is well covered — arguably the design's strongest part — through J, E, the correction and the branch choice. The weak spot is the new freeze L3 item (P7). Note that most L3 measures are **visible-map** judgements; only the ten freeze L3 items measure projection held in memory.

---

## 5. The handoff document against the spec

The handoff (`HANDOFF_Projection_Judgement_Loop.md`) is consistent with `08` §3.2, `12` and `07` on almost everything.

### 5.1 Already in the spec

Three-way response with derived binary · map visible during judgement · halted clock · single-boundary envelope with certainty on the stroke · observed perimeter in a different hue · confidence 0–100 with 10 Hz slider logging · point / polygon follow-ups · revision as a new record · no runtime scoring · truth stripped before rendering · `envelope_revealed` as latency zero · no gradients, isochrones, animation, machine-suggested allocation, feedback or LLM · determinism · resume replays the cycle.

### 5.2 New in the handoff — not yet in the spec

| Handoff item | Missing from |
|---|---|
| **Branch choice after drawing**, with *Ei mikään näistä* always last | `08` §3.2, `04` §8 (`ContainmentResponse.selectedBranchId`), `06`, `10` M7 tests |
| Per-cycle **Finnish branch statements**, equal length and specificity | `03` §9 (branches exist per incident, not as per-cycle statements), `04` §7 (`Branch.statementFi`, applicable cycles) |
| Authoring rule: at the omission cycle, **no branch describes the omission**, so *Ei mikään näistä* is correct | `03` §5, §9 |
| Drawn-vs-chosen agreement; doubt–action coherence via the chosen branch | `08` §6, `09` §7.2 |
| Telemetry: `branch_selected`, `branch_option_hovered`, polygon tool opened/abandoned, unanswered branch list | `07` §2.6 |
| Confidence slider **starts unset**, explicit interaction required | `06`, `04` §8 |
| Polygon: ≤12 vertices, ≥3 to submit, undo, restart | `04` (`maxVertices` only), `06` |
| Three options **in fixed order**, never randomised | not stated (only `16` randomises its own options) |
| Degenerate input: accept and log | `11` §3.8 is still open — the handoff answers it |
| Non-reversible submission, stated in the interface before the first judgement | `06` |

### 5.3 Where the handoff is out of date or in tension

- **Session length:** "already near 100 minutes" — now ~140 (`15`).
- **Loop order:** the handoff does not know the course-of-action step (`16`), which now sits between the verification window and the allocation.
- **Machine advice:** the handoff's "the machine never recommends" conflicts with `16` alignment feedback (P5).
- **"No language model anywhere in this path"** — consistent with `14` (runtime), but the reasoning AI is now a machine voice near this path; P3 applies.

### 5.4 Open items carried from the handoff

Branch statements not written · branch list on `fundamentally_wrong` only, or also `partly_wrong` · time budget (+10–15 s per rejection) · wording of *partly* vs *fundamentally wrong* (pilot-critical).

---

## 6. Information still needed before the full build

**Blocking (unchanged from v3.0):** domain reviewer · spread rates and perimeter geometry · Finnish register of corpus and strings · item banks · counterfactual branches and viability table · DPIA and hosting · pre-registration and power simulation.

**Blocking (new):** P1–P7 decisions · branch statements per cycle · reasoning-package template and topic list · intent restatement texts · prologue timing, flags and content · decision items and alignment texts · the query coding manual · embedding model and licence check.

**Can start now:** M1 (engine, determinism), M2 (scenario contract and validator, with the new types stubbed), M3 (render boundary and map, after the symbol shapes), M4 (telemetry, including the handoff's records).

---

## 7. Resolution status after revision (d)

| Item | Status |
|---|---|
| P1 | Pull only, with group-specific training; hypotheses restated |
| P2 | Fixed template adopted |
| P3 | Adopted in `14` |
| P4 | Intent line in query answers (cell 3) |
| P5 | Per-choice feedback removed |
| P6 | Adopted: Paper 1 primary = phase A |
| P7 | Rule written; confirm |
| P8 | Accepted: ~145 min |
| Handoff | Adopted into `03`, `04`, `06`, `07`, `08`, `10` |

**Revision (e):** three groups restored, so the integration contrast (LLM reasoning vs. LLM) is back. New consequence: Paper 2 relies on the LLM-reasoning group alone, so its cells are small unless that group is enlarged.

**Revision (f):** LLM (facts) group removed. Paper 2 cells are 65 / 65 again; Paper 1 compares LLM reasoning with Radio and cannot isolate integration.
