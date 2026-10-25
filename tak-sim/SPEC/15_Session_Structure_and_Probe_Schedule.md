# 15 — Session structure and probe schedule

**Version 1.1 · 17 September 2026 · Status: governing for the topics below.** Implements forks F5, F6 and F8 (`11` §7). Where this document conflicts with `01` §7, `03` §2.2 and §4.3, `05` §4, `08` §3–§5 or `09` §3 and §8, **this document wins**; those sections carry `[SUPERSEDED 2026-09-17]` markers.

> **Changelog**
> - **25 Oct 2026 (bi)** — the replay's fixes (`docs/audits/2026-10-23-playtest/analysis.md` §10.4; researcher decisions of 25 Oct 2026): **R6** the consult notice comes at 70 s in the merged views (after the step boundary's burst) and only when reports arrived after the participant's last recorded plan (`30` (bi)); **B7** the tour's `fire` step says the map draws the edge as mapped at the period's start and the log can be newer (`28` (bi)); **B8** the debrief says that the planted record and VOL1's warning were in the records, found with Haku (or the Thinker), not in the message log — the debrief text goes to the ethics review. See the revision at the end.
> - **25 Oct 2026 (bj)** — the pretest's step holds the map training (`08` (bj)): seven tasks with feedback, a 5-minute cap (was 4), about 3.5–5 min; the order and every view's timing unchanged. See the revision at the end.
> - **24 Oct 2026 (play-test)** — `docs/audits/2026-10-23-playtest/analysis.md` finding 3 and D11 (researcher): the SPAM answer window stays 60 s, but the item now shows its time left (a quiet countdown, amber in the last 15 s; display only, no record); the tour's SPAM step says that the "Ready to answer?" prompt waits (it can be minimised; it is forced before the period ends) and that each question, once Ready is pressed, has 60 s, the time left on the card; the tour's decision step adds one sentence: messages addressed to command (requests, proposals) are context, the units act on standing orders and their own judgement, and the plan sets the main effort and its posture, the secondary task and the drones. No scored item, key or timing changes. Finnish DRAFT.
> - **24 Oct 2026 (bf)** — adopted before pilot 2 (`30` (bf)): two pre-session covariates (sleep; the recent shift, experts only); the hinge's optional one-click fatigue item; the Haku group's chip from V8; the post-session self-estimate and perceived-influence items after the source block; about +1 min. No view's timing changes. See the revision at the end.
> - **24 Oct 2026 (bg)** — the freeze header names the span of the period's latest reports and defines "now" by them (`08` (bg) bg.1; supersedes (ay)'s "states the clock at now"). See the revision at the end.
> - **23 Oct 2026 (be)** — the difficulty audit (`docs/audits/2026-10-23-difficulty/`): the tour's log, Haku and V1 steps state that the message log is only part of the traffic; a measure-tool step; the content-free "New records" badge on the Haku button; VP gains a Haku-only practice item, a measuring task and the source-only practice feedback after it; the map-reading pretest before VP. No scored item or view timing changes. See the revision at the end.
> - **21 Oct 2026 (bb)** — `35`: a public session (`?yleiso`) adds the primer after the pre-session item and the commander profile after the questionnaire; scope phase A (`?laajuus=a`) ends the session after V7. Expert sessions unchanged. See the revision at the end.
> - **19 Oct 2026 (ay)** — `31` §3.8, §3.10: V12's freeze after the plan; the notice yields to a freeze due within 15 s; the freeze cap 240 s for 8-item freezes; the freeze header states "now"; post-session additions (two lure facts, believability, recognition, prior demo or game use, two perceived-reliability items, ≈ +1.5 min) and the shortening order. See the revision at the end.
> - **19 Oct 2026 (ax)** — `30`: in every main view a consult notification at 60 s and a plan-confidence item after the plan; V10's and V14's freeze after the plan-confidence item; a second SPAM item in V3 and V6; the phase-A freezes grow to eight items; a post-session source-memory block; the time budget. See the revision at the end.
> - **11 Oct 2026 (aw)** — the practice view lengthened (researcher: more time to look at the situation and learn the screen): VP lasts at least 180 s (was 120 s), cap 210 s (was 150 s; the main views' 30 s grace kept); its freeze is fixed at 69 s on the view's clock, which starts when the guided tour is finished or skipped (was 39 s, (av)); the practice SPAM prompt at 85 s (was 55 s), its 60 s answer window closing by 145 s. Main views unchanged. Supersedes (av)'s timing.
> - **11 Oct 2026 (av)** — the practice freeze comes 10 s later (researcher: it came too quickly): VP's freeze at 39 s (was 29 s; `PRACTICE_FREEZE_DELAY_S`, a fixed shift on the drawn moment, identical for everyone); the practice SPAM prompt moves with it to 55 s (was 45 s), keeping the 16 s gap after the freeze, and its 60 s answer window still closes before VP's 120 s minimum. Main views unchanged.
> - **10 Oct 2026 (am)** — the Thinker practice: in the Thinker cells the Open Thinker is available in VP, and the practice tour gains one step after Search that opens it, says what it is for, offers one example question to send with a click and waits for one answer; no order block in VP; practice turns logged with view 0 and cleared at V1; V1's Thinker reminder shortened. The radio cell is unchanged. See the revision at the end.
> - **9 Oct 2026 (ae)** — the briefing ("Situation") page is removed: the step is passed at once and logged (`auto`, `screenRemoved`); its unique sentences open the practice tour; resume to the briefing goes to VP; the English glossary is removed (ae.1–ae.2).
> - **9 Oct 2026 (ad)** — the freeze gets its own 180 s cap (real time): the items confirmed by then are kept, the rest logged missing, the submission `timedOut` (§ad.1).
> - **9 Oct 2026 (ac)** — the AI literacy questionnaire (SNAIL, amended from AILIT-S) right after consent, before the preflight: four 1–7 ratings per screen, a 5-minute cap with a countdown, skippable, missing ratings null, and a resume on the first screen with an unrated item. The session budget is about 68–71 min. Supersedes §2's pre-session AI-literacy row. See the revision at the end.
> - **7–8 Oct 2026 (y)** — the briefing line that each period sums up its 20-minute step (both groups); training texts: one identical Haku paragraph in both groups, plus an Open Thinker paragraph in the AI group; the length-parity rule withdrawn. See the revision at the end.
> - **5 Oct 2026 (u, reconciled)** — the hinge screen and SPAM reconciled with the build (`27` 1.1): the two equal-length sentences; the SPAM timing 25 / 15 / 20 s, tools locked.
> - **4 Oct 2026 (u)** — the hinge screen's order (directive → hinge check → one sentence by cell → V8) and SPAM's role in phase B (`27` §3.2, §4). See the revision at the end.
> - **1 Oct 2026 (r)** — no locked exploration phase (decision panel at 20 s, no countdown, scenario clock shown); minimum view length 120 s / 150 s; freezes at pre-planned pseudo-random offsets, superseding §9 item 3; the allocation before the course-of-action item; one confidence scale 25/50/75/100. See the revision at the end.
> - **25 Sep 2026 (p)** — the session structure and probe schedule are replaced by `26` (1 practice + 14 views; ~100 min).
> - **25 Sep 2026 (o)** — both groups judge the envelope; every-cycle "Oma ennuste" withdrawn; marking only on Type E cycles; free-text rationale only on rejection cycles. See the revision at the end.
> - **1.5 · 23 Sep 2026** — radio removed (`02` revision (j)): Haku / Haku + LLM; the no-AI tutorial covers Haku; the "radio log" becomes a message log. See §14.
> - **1.4 · 17 Sep 2026** — two groups: Radio (70) and LLM reasoning (130, split 65 / 65).
> - 1.3 · 17 Sep 2026 — three groups (Radio, LLM, LLM reasoning); only LLM reasoning is split at the hinge.
> - 1.2 · 17 Sep 2026 — group structure 70 / 65 / 65; tutorial is group-specific training; branch step adds time.
> - 1.1 · 17 Sep 2026 — probe totals changed to 10 freezes / 6 SPAM / 9 unprobed; five SA items per freeze (2 × L1, 2 × L2, 1 × L3); warm-up is a prologue to the main incident, identical for everyone, with 2 freezes and 1 SPAM; only the reasoning-AI group is split by guidance mode.
> - 1.0 · 17 Sep 2026 — created. Decisions: pre-session metacognition battery dropped and replaced by five in-simulation warm-up cycles; 14 blanked freezes, 6 SPAM probes and 5 unprobed cycles across the 25 cycles; participants are mostly at incident-command level.

---

## 1. Decisions implemented

| Fork | Decision (Kalle, 17 Sep 2026) |
|---|---|
| F5 | The 30-minute metacognition battery is **dropped**. Baseline metacognition comes from **five warm-up cycles** inside the simulation |
| F6 | Across all 25 cycles: **10 blanked freezes (SAGAT-style), 6 SPAM probes, 9 cycles with neither** (revised 1.1) |
| F8 | The 200 participants are **mostly** at incident-command level. Echelon is recorded and used as a stratification variable and covariate |

"Neither" refers to SA probes only: the cycle has no blanked freeze and no SPAM probe. **Every cycle still contains the containment judgement (Type J) with confidence, the course-of-action choice (`16`) and the allocation.**

---

## 2. Session structure

| Segment | Content | Duration |
|---|---|---|
| Pre-session (separate day) | Consent, demographics incl. echelon, **AI literacy (10 min)** | ~15 min |
| Pre-flight, attestation, briefing | As `09` §3–§4 | 12 min |
| **Prologue (warm-up), W1–W5** | Five cycles of the same incident, **identical for everyone, no AI** (§3) | ~19 min |
| Group-specific training | LLM reasoning: what the AI answers, how to ask, two practice queries. No-AI group: matched-length radio and browsing training | 5 min |
| **Main cycles 1–10** (phase A) | Condition active; identical content for all | ~41 min |
| **Hinge pause** | 5 min, dismissible; single strategic guidance delivered on exit | 5 min |
| **Main cycles 11–20** (phase B) | Guidance mode varies (`02` §7.2 as amended) | ~40 min |
| Post-session questionnaire | As `09` §6.1 | 15 min |
| **Total on the day** | | **~145 min** (incl. branch choice on rejections) |

The session remains one continuous sitting with the hinge as the scheduled break. A short optional pause (≤ 2 min) is added between the tutorial and cycle 1.

---

## 3. Prologue (warm-up block)

**Purpose:** interface familiarisation, and an **in-task baseline** of first-order accuracy and confidence, replacing the offline battery as the individual-difference covariate.

**Content: a prologue to the main incident.** W1–W5 cover the first hours of the same fire, before cycle 1: first reports, initial attack, the first projections. The prologue sets up the situation the main cycles continue, so no separate warm-up incident is authored.

**Identical for everyone.** All participants use the `directed` capability set in W1–W5, receive the same content and the same probes. Condition-specific tools are enabled only at the tutorial.

**Authoring constraints on the prologue:**
- nothing in it may reveal or pre-empt the cycle-12 omission, the cycle-18 contradiction or the load-bearing T4 items;
- its flags follow the alternation rule (`03` §4.2) and are not counted in the main 50% base rate;
- initial strategic intent is established here, so phase-A decision items have a strategy to align with.

**Measures per prologue cycle:** Type J with confidence; the course-of-action choice with confidence (`16`); allocation. SA probes per §4.

**Competence gate.** Checks mechanics only (a judgement submitted, a point marked, a polygon drawn, a confidence value set), never accuracy.

**No feedback** on correctness, as everywhere else (`01` §4.5).

---

## 4. Probe allocation across the 25 cycles

### 4.1 Totals

| Block | Blanked freeze (R) | SPAM (S) | Neither | Cycles |
|---|---|---|---|---|
| Prologue W1–W5 | 2 | 1 | 2 | 5 |
| Main 1–20 | 8 | 5 | 7 | 20 |
| **Total** | **10** | **6** | **9** | **25** |

### 4.2 Schedule

```
Prologue        W1 W2 W3 W4 W5
Recall (R)          ●     ●
SPAM (S)               ●
Neither          ●           ●

Main cycle      1  2  3  4  5  6  7  8  9 10 | 11 12 13 14 15 16 17 18 19 20
Judgement (J)   ●  ●  ●  ●  ●  ●  ●  ●  ●  ● |  ●  ●  ●  ●  ●  ●  ●  ●  ●  ●
Decision (D)    ●  ●  ●  ●  ●  ●  ●  ●  ●  ● |  ●  ●  ●  ●  ●  ●  ●  ●  ●  ●
Recall (R)         ●        ●  ●        ●    |        ●  ●     ●        ●
SPAM (S)              ●           ●          |  ●           ●              ●
Neither         ●        ●           ●     ● |     ●              ●  ●
Expectation (E) as `08` §5.3 (order A/B)
Falsify (F)                       ●          |           ●              ●
Uncertain (U)                                |                       ●     ●
```

**Rules behind the placement:**
- **Cycle 1 has no SA probe**, so participants rebuild the picture after the tutorial before the first freeze.
- **Cycles 12 and 18 have no SA probe**, protecting the omission and contradiction windows (`08` §8.3).
- Freezes are balanced across phases: **4 in phase A (2, 5, 6, 9), 4 in phase B (13, 14, 16, 19)**. Five of the eight are v3.0 recall cycles.
- SPAM falls only in cycles without a blanked freeze.
- **Cycle 11 carries a SPAM probe**, so uptake of the guidance right after the hinge is measured without blanking the screen.

### 4.3 Scheduling is deterministic

The v3.0 rationale stands: a random freeze could land inside the contradiction or omission window. All participants get the same schedule; cycle index enters every model. With nine unprobed cycles, most cycles do not contain a freeze, which keeps freezes hard to anticipate.

### 4.4 Items per freeze

**Five SA items in every freeze: two Level 1, two Level 2, one Level 3.** Each item is followed by a confidence rating (0–100, same scale as Type J).

| Level | Items | Examples |
|---|---|---|
| L1 perception | 2 | Where is a named formation; current wind direction; last reported edge on a named flank |
| L2 comprehension | 2 | Which sector is most exposed; which formation is least able to reposition |
| L3 projection | 1 | Where will the fire front be on a named flank at the next boundary; which road will be cut first |

- **L3 items** follow the consequence rule in `08` revision (d).
- **Phase B:** one of the two L1 items is an **intent item** ("What is the current priority?"), so intent uptake is measured in every post-hinge freeze.
- **L3 items are answered from memory with the envelope hidden.** They are scored against the authored actual perimeter, not against the envelope, and never ask the participant to recall the envelope itself.
- Estimated freeze length: ~80–100 s, within the 2-minute ceiling.

| | Freezes | Items | Answer–confidence pairs |
|---|---|---|---|
| Prologue | 2 | 5 each | 10 |
| Phase A | 4 | 5 each | 20 |
| Phase B | 4 | 5 each (1 intent) | 20 |
| **Total R** | **10** | | **50** (20 L1, 20 L2, 10 L3) |

Together with 25 Type J judgements, that is **75 paired first-order and confidence responses per participant**, plus 25 decision–confidence pairs.

---

## 5. SPAM probes (Type S)

**New probe type.** SPAM probes are online and non-blanking, and **the clock keeps running**.

| Property | Specification |
|---|---|
| Timing | At an authored offset inside the working period, never within 15 s of a bubble arrival |
| Ready prompt | "Voitko vastata kysymykseen?" with a *Valmis* button. Time to *Valmis* is the workload index |
| Question | Shown after *Valmis*; the map, rail and all tools **remain available** |
| Response | Closed format; followed by confidence 0–100 |
| Timeout | 20 s to *Valmis*, 30 s to answer; timeouts are logged, not errors |
| Content | L1/L2 situation items; the cycle-11 item concerns current intent |
| Scoring | Accuracy and time to answer; time to *Valmis* separately |
| Item bank | 10 authored for 6 slots |

**Interpretation.** SAGAT-style recall measures what is held in memory; SPAM measures how quickly it can be found with the tools at hand. The contrast between the two, by group, is the in-head vs. with-tools comparison.

**Known cost.** SPAM is intrusive in a large share of studies and confounded with workload (Endsley's review). SPAM is kept to six probes, placed identically for all groups, and its latency is always analysed together with workload.

---

## 6. Time budget changes relative to `08` §5.1

| Element | v3.0 | Now |
|---|---|---|
| Recall freeze (R) | 45 s × 6 (3 items) | ~90 s × 8 main + 2 prologue (5 items with confidence) |
| SPAM (S) | — | ~30 s × 5, inside the working period (clock running) |
| Course-of-action choice (D) | — | 20 s × 20; +20 s on phase-B cycles with AI alignment feedback |
| Prologue | — | 5 cycles, ~3.7 min each |
| Pre-session battery | 45 min | 15 min (AI literacy + demographics) |

---

## 7. Metacognition without the battery

- **Per-participant baseline:** calibration (Brier components, over/underconfidence) from the 5 prologue J responses and 10 prologue recall responses.
- **Primary metacognitive outcomes:** calibration and bias across the main cycles, per `09` §7.1.
- **Metacognitive efficiency:** estimated **hierarchically** (group-level parameters) from all paired responses; per-participant values are treated as shrunken estimates, not standalone scores.
- **Paper 3 criterion:** in-task metacognition from the main cycles, with the temporal holdout (cycles 1–10 develop, 11–20 evaluate) unchanged.
- **Declared limitation:** without an offline battery, domain-general metacognitive ability is not measured; H7 is reformulated (`01`, amendment).

---

## 8. Participants (F8)

- Target: **210 recruited** (3 × 70; `02` revision (au), 11 Oct 2026; before: 200), mostly at *pelastusjoukkue* command level.
- Record echelon (command / supervisory / crew) and years in command roles; **stratify randomisation on echelon** in addition to the `09` §2 variables.
- Echelon enters every model as a covariate; a sensitivity analysis excludes non-command participants.
- The briefing role is unchanged (the participant acts as incident commander at *pelastusjoukkue* level).

**Attrition warning.** `09` §6.2 plans for 25–35% attrition. If 210 is the recruitment figure (200 before 11 Oct 2026), roughly 137–158 remain (25–35% attrition applied to 210) for analysis: about 45–50 Radio and 85–95 LLM-reasoning participants, about 42–48 per Paper 2 cell (`02` revision (f)). *Open: is 200 recruited or completed? (§9)*

---

## 9. Revision 23 Sep 2026 — the two-phase cycle

> **[SUPERSEDED 2026-10-01]** By revision (r) at the end: no locked exploration phase, a minimum view length, freezes at pre-planned pseudo-random offsets, and the allocation before the course-of-action item.

**Decided (PI).** Each cycle now has an explicit, gated two-phase structure, superseding the implicit "working period -> reveal -> judge" ordering in §6 and `16` §2 where they conflict.

1. **Exploration phase.** The map and the condition's right panel (AI chat or radio log, §11 below) are available. The only prompt is "Rakenna tilannekuvasi" ("Build your picture of the situation"). No decision control is visible — not the judgement, not the course-of-action options, not the allocation surface. Duration is **configurable per cycle** (`CycleSpec.explorationSeconds`), default 90 s (`08` §5.1's existing working-period budget).
2. **Decision phase.** Unlocks after the exploration timer elapses (or the participant advances early, if the cycle allows it — open, §11). Three steps, always in this order:
   1. **Judge the projection** — condition-dependent, §10.1.
   2. **Choose a course of action** (`16`), when the cycle carries a decision item (§11 makes this optional).
   3. **Allocate units** (v3.0 allocation, now with per-unit dropdowns, §12).
3. **SAGAT freeze** (Type R, `08` §3.1), on scheduled cycles: **placed before the decision phase, immediately after the exploration timer elapses, and never after a decision.** This supersedes `16` §2's diagram, which placed the freeze between the judgement and the course-of-action choice. Placing it before any response in the cycle is closer to standard SAGAT practice (`08` §2) and avoids the freeze being cued by "a decision was just made."

**Logging obligation.** Every query (Haku, AI chat, radio) is tagged with the phase it occurred in (`exploration` or `decision`), so spontaneous information-seeking can be compared with decision-driven seeking. See `07` amendment.

**Baseline condition.** A cycle may carry **no decision item at all** — exploration phase, optional freeze, then cycle end with no judgement/COA/allocation prompts. This provides a baseline of undirected querying, uncontaminated by an impending decision. Which cycles are decision-free is authored per participant group like the freeze/SPAM schedule in §4, not left to chance (§4.3's determinism rationale applies equally here).

## 10. Revision 23 Sep 2026 — condition-specific decision phase and right panel

**10.1 Radio (`directed`) loses the projection envelope.** `02` §2's capability-matrix row "Projection envelope with validity horizon: identical" and `12` §3–§4's "one envelope, one boundary, identical across conditions" argument are **superseded for `directed` only**. Radio has no machine and therefore no machine projection to show or to judge.

**This is a real change to what is measured, not a UI change**, and it is recorded here rather than silently folded in:
- In `substitutive` (LLM reasoning), decision-phase step 1 remains the existing three-way judgement of the shown envelope (`08` §3.2, unchanged).
- In `directed` (Radio), decision-phase step 1 becomes **"Oma ennusteesi"** ("Your projection"): *"Missä palon pääsuunta on 30 minuutin kuluttua?"* ("Where will the main front be in 30 minutes?"). The participant marks an area on the map (reusing the existing tap-to-draw primitive built for the `fundamentally_wrong` correction, `session/orchestrator.ts:submitCorrection`) and gives a confidence rating, 0–100, same scale as Type J.
- This makes Radio's per-cycle step 1 a **production** task and LLM-reasoning's a **recognition/judgement** task — asymmetric across conditions on what was previously a symmetric primary measure. **Open item, flagged for the domain reviewer, added to `11` (Open Design Register): does this measure remain comparable to Type J for H2's cross-condition analysis, or does it become a Radio-only measure analysed on its own terms (closer to existing Type E, `08` §3.3, which already asks participants to mark an expected area before a reveal)?** Until answered, treat Radio's per-cycle projection as a distinct, declared measure — do not silently pool it with LLM-reasoning's Type J in analysis.
- Scoring: overlap between the marked area and the actual perimeter, same method as Type E (`08` §6, row "E, expectation").

**10.2 Right panel, persistent through both phases, condition-dependent (supersedes `06` §2's report-rail-only sketch):**
- **`substitutive` (LLM reasoning).** A pull-only AI chat. Answers only when asked, never pushes (`02` §1.2 holds). Every answer uses the fixed four-part template from `14`'s revision below: **ANSWER · BASIS (sources and times) · CERTAINTY · WOULD CHANGE IF**. History persists for the session; scrollable.
- **`directed` (Radio).** A timestamped radio log: time, callsign, message. Carries the same pushed bubbles the report rail already shows, restyled as a running log rather than a card stack that scrolls away — so Radio retains equal access to T1-tier pushed content (`02` §3) without gaining a query surface `assistive`/`substitutive` don't also have.

## 11. Open items from this revision

- Whether the exploration phase can be exited early by the participant, or is a hard timer. Default assumed: hard timer, revisit in pilot.
- Whether Radio's per-cycle "own projection" (§10.1) is scored as a Type-J analogue or a distinct measure. Domain reviewer.
- Decision-free cycle placement is not yet scheduled against the freeze/SPAM tables in §4 — needs the same deterministic-schedule treatment before pilot.

## 12. Allocation surface — per-unit assignment (supersedes the free-text-only preview)

Allocation step 3 gets one dropdown per own formation (`assetId -> sectorId`/task), matching `AllocationMark` (`04`) already in the data model, plus the free-text rationale. The preview build's placeholder (`submitAllocation([], rationale)`, no per-unit marks) is replaced with real per-unit assignment.

---

## 13. Open items created or left by this document

| Item | Status |
|---|---|
| Split of probes between prologue and main | **Decided 1.1:** prologue 2/1/2, main 8/5/7 |
| Prologue vs separate warm-up incident | **Decided 1.1:** prologue |
| Items per freeze | **Decided 1.1:** 5 (2 × L1, 2 × L2, 1 × L3) |
| Which L1 item becomes the intent item in phase B | Default: the second L1 item |
| Whether 200 is the recruited or completed sample | Open; treated as recruited |
| Group structure | **Decided (f):** Radio 70; LLM reasoning 130, split 65 / 65 at the hinge. **Renamed 23 Sep (§14):** Haku 70; Haku + LLM 130 |

---

## 14. Revision 23 Sep 2026 — no radio

Follows `02` revision (j).

- **§2, group-specific training.** The no-AI group's "matched-length radio and browsing training" becomes a **matched-length Haku training** with two practice queries, the same count as the AI group's.
- **§3, prologue.** Unchanged in substance. Everyone uses the `directed` capability set in W1–W5, which is now Haku with no radio. Condition-specific tools (the AI drawer) are enabled at the tutorial.
- **§9, logging obligation.** "Every query (Haku, AI chat, radio)" becomes "every query (Haku, AI chat)" (`07` revision (j)).
- **§10.1.** Unchanged. The no-AI group (formerly Radio) still has no projection envelope and does the "Oma ennuste" production task.
- **§10.2, right panel.** The no-AI group's "timestamped radio log" keeps its content (pushed bubbles as a running log) and is renamed a **message log** (*Viestiloki*, placeholder). It has no input. The AI group keeps the AI chat.
- **§8, attrition estimate.** Read "Radio" as Haku.

---

## Revision 25 Sep 2026 (o) — the envelope for both groups; one marking task; less free text

Follows `02` revision (o).

- **§10.1 is superseded.** Both groups see the envelope. Step 1 of the decision phase is the Type J judgement **in both groups and in every cycle**. The Haku group's every-cycle "Oma ennusteesi" production task is withdrawn, and so is the open comparability item in §11 that it created.
- **Projection marking only on Type E cycles.** The only marking task is Type E (`08` §3.3): 10 of 20 main cycles, counterbalanced, in both groups. For the Haku group this halves the marking load. For the AI group nothing changes.
- **Free-text rationale (allocation step, §12) only where it carries information.** It is shown and required only on cycles where the participant rejects the projection. On other cycles the allocation is submitted with the per-unit assignments alone. This is `17` P8's first option, taken to offset the time the setting text adds to the briefing. It is checked in pilot 1.
- **§2, group-specific training.** The Haku + LLM training introduces Thinker as the command post's analysis agent (`02` revision (o) §3). The Haku training is unchanged in length and in content.
- **Schedule (§4.2) unchanged.** The planted record (`02` revision (o) §5, fault F7) enters at cycle 8 and stays for the rest of the session. The freezes of views V7 and V12 carry its items (`08` revision (o), `26` §4).

---

## Revision 25 Sep 2026 (p) — fifteen map views

**`26` replaces §2's cycle rows, §3 (prologue), §4.1–§4.2 (totals and schedule) and §6's cycle counts.**

- **Prologue:** one practice view (W5), identical for everyone, no AI, not scored, with a 2-item practice freeze. §7's prologue baseline is withdrawn.
- **Totals:** 7 blanked freezes, 4 SPAM, 3 views with no SA probe, across 14 main views (`26` §4). §4.3's determinism rule stands.
- **§9, decision-free cycles:** withdrawn.
- **Exploration:** 90 s per single-step view, 120 s per merged view. *Superseded by revision (r) below.*

---

## Revision 1 Oct 2026 (r) — one open view, a minimum length, freezes at planned offsets

Researcher decisions of 1 Oct 2026. **They supersede §9 (the two-phase cycle) in full, the first open item of §11, revision (p)'s last bullet ("Exploration: 90 s per single-step view, 120 s per merged view") and `26` §4's "Exploration time" bullet.** Which views carry a freeze, SPAM, Type E, F or U (`26` §4) is unchanged.

### r.1 No locked exploration phase

- The view opens with the map, the message log, Haku and, in the AI group, Thinker. There is no separate exploration phase in which the decision controls are hidden.
- **The decision panel opens 20 s after the view starts** (`decision_panel_opened`, `07` revision (r)).
- **No countdown is ever shown:** not before the panel opens, not for the view, not before a freeze. The **scenario clock** (the view's virtual time) is shown.
- §9's hard exploration timer is withdrawn. `CycleSpec.explorationSeconds` is renamed `minViewSeconds` and holds the minimum view length (r.2). The other per-view constant is the panel delay (20 s). Both are pilot defaults (`11` §7.10).
- **Logging.** The `phase` field on query records (`07` revision (i)) now reads `exploration` before `decision_panel_opened` and `decision` after it. The comparison of spontaneous with decision-driven information seeking (§9, logging obligation) is made in analysis from timestamps relative to `decision_panel_opened` and to the participant's own decision inputs, not from a gated phase.

### r.2 Minimum view length

| View | Minimum length | Second step arrives |
|---|---|---|
| Single-step | 120 s | — |
| Merged (two steps, `26` §2) | 150 s | at 75 s (half the minimum) |

- **The view ends at max(minimum, the participant's confirmation).** There is no upper limit (session length: `11` §7.10).
- **A participant who confirms before the minimum may revise the allocation until the minimum is reached.** Every revision is logged as its own record (`allocation_revised`), never by changing the earlier one. Type J stays irreversible (`08` revision (d), item 6).
- **Confirmation is the answer to the course-of-action item**, the last step of the panel (r.4).
- `view_ended` records how the view ended (`endedBy`: `participant_confirm` when the participant confirmed after the minimum, `minimum_length` when they confirmed earlier and the view ended at the minimum).
- **The view timer is halted during a freeze**, as the virtual clock is (`08` §4). Freeze time does not count toward the panel delay, the second step's arrival or the minimum.
- **A consequence to declare.** In a merged view the panel opens at 20 s and the second step arrives at 75 s, so a participant can commit before the second step's information arrives. The revision window lets them act on it. Analysis therefore relates the commitment time and each allocation version to the second step's arrival.

### r.3 Freeze timing — supersedes §9 item 3

**Decided.** On the views already scheduled for a blanked freeze (`26` §4: V2, V4, V5, V7, V10, V12, V14, and VP's practice freeze), the freeze interrupts the view at a **pre-planned pseudo-random offset in [25 s, minimum − 20 s]**: [25 s, 100 s] in a single-step view, [25 s, 130 s] in a merged view.

- **Seeded at build time and frozen** with the scenario (`CycleSpec.freezeAtSeconds`, an integer, uniform over the interval, seeded per view from the scenario seed). The offsets are the same for every participant (identical-stimulus rule). They are never drawn per session.
- The freeze can fall **during exploration or mid-decision**. On resuming, the participant returns to where they were: the panel step, the responses already entered and the open drawer are restored.
- **Logged covariate** (`freeze_started`): whether the decision (the allocation, r.4) was committed before the freeze, and the decision step the participant was in.
- The freeze schedule across views stays deterministic (§4.3). Only the offset within a view is pseudo-random.

**What this supersedes, and the trade-off.** §9 put the freeze before the decision phase and "never after a response", so that the freeze could not be cued by a decision just made. That ordering had a cost. With a gated exploration phase the freeze always came at the same, learnable moment: when the timer ran out. A participant could learn that the view pauses there and rehearse the picture for it, which is the anticipation that standard SAGAT practice avoids by interrupting at random times (`08` §2). The new placement is closer to standard SAGAT: within a view, the interruption time is unannounced and varies from view to view.

The old concern does not go away. A freeze that falls after the allocation has been committed tests a picture the participant has just used to decide, and may have consolidated for that purpose. A freeze that falls before it tests a picture still being built. These are not the same state, and the design does not remove the difference. It **measures** it: `decisionCommittedBeforeFreeze` and `decisionStep` enter the SA and calibration models as covariates, and a sensitivity analysis fits H2 on the freezes that fell before commitment only. Because the offsets are identical for everyone, the share of freezes that fall after commitment depends on each participant's own pace. Pace may differ between the groups (`09` revision (r)), so the covariate matters for the group contrast, not only for precision.

### r.4 The allocation is the decision; the course-of-action item follows it

The decision panel's steps are, in this order:

1. **Type J** judgement, confidence and follow-ups, then the verification window (unchanged).
2. **Allocation** (per-unit assignments; free-text rationale on rejection views only, revision (o)). **This is the decision.** Decision commitment time is the time of `allocation_submitted`.
3. **Course-of-action item** (`16` revision (r)), asked after the allocation and worded as a description of the participant's own allocation. The four codes (aligned/against × sound/unsound) are kept. Its answer confirms the view. A later revision of the allocation (r.2) does not ask it again.

This supersedes the step order of §9 item 2 (judge → course of action → allocate).

### r.5 Probe content

Specified in `08` revision (r): one infrastructure item per freeze from a fixed rotation; F7 asked once, at V12; a "source of the answer" question after each SA item; no tool words in SA items; the views without an SA probe (V1, V9, V13) kept as the reference for probe reactivity.

### r.6 One confidence scale

Every confidence question uses the scale **25 / 50 / 75 / 100**, never preselected (implemented 1 Oct 2026). This replaces "0–100" in §4.4, §5 and §10.1, and in `08` §3.2 and `16` §4. Its reading for calibration (25 is chance for a four-option item; Type J has three options) is in `08` revision (r).

### r.7 §11 open items, updated

- *Whether the exploration phase can be exited early:* **closed.** There is no locked phase (r.1).
- New open items from this revision are in `11` §7.10.

### r.8 Review amendment (2 Oct 2026)

- **Merged-view freeze window.** In a merged view the freeze falls only after the second step has arrived (at half the minimum length) plus 10 s: [85 s, 130 s] for the 150 s minimum (`freezeWindowFor`, `FREEZE_AFTER_BOUNDARY_S`). Single-step views keep [25 s, 100 s]. Reason: the SA items' answer keys are written for the view's last step; a freeze before the boundary (V4, drawn at 46 s) scored a correct "EK11 at the head" answer as wrong, and a freeze 2–3 s after the boundary (V2, V12) landed on the burst of second-step reports. The window keeps the moment unpredictable within the second half of the view. **Default pending the researcher's confirmation** (SPEC/11 §7.10).
- **One submission per step.** The freeze, the judgement, its confidence and follow-ups, the briefing, the training and the hinge accept one submission each, and only in their own step; a double click is refused. A course-of-action answer must be an option of the current view's item.
- **Revision opened.** Opening "Muuta kohdennusta" is logged (`allocation_revision_opened`), so an abandoned revision is visible.

### r.9 Final countdown and demonstration timing (2 Oct 2026, researcher decision)

- **Final countdown.** In the last 20 s before a view's minimum length the status bar shows "Aikaa jäljellä N s" ("Time left N s"), counted on the view's own clock (it stands still in a freeze, and it is not shown during one). If the participant has not confirmed by then, it shows "Aika täynnä — vahvista jakso". This partly supersedes r.1's "no countdown": it is a short end-of-period cue, not a running timer. With the study's timing it starts exactly where the freeze window ends (minimum − 20 s), so it never signals when a freeze is due. Note for analysis: time pressure in the final 20 s may affect reliance on Thinker (SPEC/11 §7.10 (b)), and this is the same for both groups.
- **Demonstration timing.** Without `?tuotanto` the app runs a 30 s minimum for single-step views, with every other view time scaled by 30/120: the panel opens at 5 s, a merged view's minimum is 37.5 s, and freezes fall at 6–25 s. This is for demonstration and testing. The header logs `previewOverride`, so such a session is never a measurement. In demonstration mode a freeze can fall inside the countdown. `?tuotanto` runs the real times (120 s / 150 s, panel at 20 s), and `?esikatselu=<s>` still sets any other minimum.

### r.10 The 3-minute cap, the outlook and the sector plan (2 Oct 2026, researcher decision)

- **Hard maximum per view: 180 s from the view's opening.** (Superseded by r.12: the freeze no longer counts toward the 180 s.) Everything has to fit inside it: the judgement, the outlook, the plan, searches and the freeze. It is not scaled by the preview override.
  - A freeze still running at the cap is answered first, and the view ends right after it, because the SA data is H2's.
  - A view ended by the cap logs `view_ended {endedBy: "time_cap", stepAtEnd}`. The unanswered steps are missing data, not imputed.
- **The minimum is kept**, so exposure stays identical and the freeze always falls inside the view.
  - Single-step views keep 120 s. Merged views go from 150 s to **130 s**, so minimum plus a typical freeze fits in the cap.
  - The merged freeze window becomes [75, 110] s, and the freeze offsets were redrawn accordingly.
  - A participant who confirms before the minimum waits, as before.
- **Countdown.** Until the period is confirmed, the last 20 s count down to the cap, on real time. Once it is confirmed, they count down to whichever comes first, the minimum or the cap.
- **The panel's order** is now judgement → follow-ups → verification → **outlook** → **sector plan** (the decision; its submission confirms the period). The course-of-action item is withdrawn (`16` revision (s)).
- **Setting text** (both groups) now says that each stage has at most three minutes, and describes the outlook and the allocation by sector.
- **Practice view:** the cap applies there too, so the pace is learnt before V1.

### r.11 The guided tour (2 Oct 2026, researcher decision)

**Practice view.** VP opens with a guided tour of 13 popups (`app/render/ui/tour.ts`, `GuidedTour.tsx`). Each step dims the screen except the element it is about, which is ringed, and puts a popup beside it with an arrow pointing at it. The steps, in order:

1. welcome;
2. the status bar (clock, stage, the 3-minute limit, the countdown);
3. the fire on the map;
4. the spread projection — the briefing's caveat word for word, and that each stage asks whether the projection holds;
5. the legend;
6. the wind;
7. the map scale;
8. the units;
9. the message log;
10. Haku (MITÄ / KUKA / MILLOIN, results as recorded, the KUKA list holding the sources so far);
11. the decision section (judgement → outlook → plan; confirming ends the stage);
12. the memory check (freezes happen; answer from memory; the clock stands still);
13. start.

**Identical in both groups.** VP has Haku only (SPEC/26 D3), so the practice tour names no AI tool (tested). It also makes no claim about reliability and says nothing about the scenario's content.

**V1 tool reminder.** V1 opens with a one-step reminder pointing at Haku. In the AI group a second step points at Thinker. Both use the training texts' own sentences.

**The clock waits.** The view's clocks (the view clock and the 180 s cap) do not start until the tour is finished, so the tour takes no time from the practice view or from V1. The overlay takes every click, so nothing is used while the time waits. The tour is logged as `tour_completed {cycle, tour, stepsSeen, dwellMs}`, and the header records `guidedTour` (format 0.9.1).

**Modes.** The demonstration shows "Ohita esittely" (skip the introduction); the study (`?tuotanto`) does not.

**The tour is on in the app.** The orchestrator's option defaults to off, so the session tests run without it. Its own tests are in `test/render/tour.spec.ts`.

**Texts:** a draft in fi/en (`ui.ts` `tour`), pending native and domain review.

### r.12 Freeze time outside the cap; map items; source on L2/L3 (2 Oct 2026)

**Freeze time no longer counts against the 180 s cap.** This supersedes r.10's "180 s of real time, the freeze included". In SAGAT the simulation is paused during a freeze (Endsley), and freezes are getting longer (six items, about 60–90 s). The cap now counts real time minus the time spent in freezes, so it runs on the view's own clock: its countdown and its end are cues there (`capCues` in `view-clock.ts`). The clock pauses at `freeze_started` and resumes at `freeze_submitted`, so the cap's cues shift by the freeze's length.
- Unchanged: a view still ends at its cap with `view_ended {endedBy: "time_cap", stepAtEnd}`, and the guided tour still holds the cap until it is finished.
- A freeze can no longer be running when the cap is reached.
- Example (practice view, study timing, freeze at 29 s, answered in 75 s): the panel opens at 20 s of real time and the freeze runs from real 29 s to 104 s. The cap's countdown starts at real 235 s (160 s of view time), and the view ends at real 255 s (`viewSeconds` 180). Under r.10 it would have ended at real 180 s, with only 105 s of task time.

**Source question on L2 and L3 only.** "Mistä tieto oli peräisin?" is asked after the confidence on L2 and L3 items only. An L1 item asks for the answer and the confidence. `submitFreeze` requires a source the participant was offered on L2/L3 items (Thinker only in the AI group) and drops any source sent on an L1 item.

**Map items (`kind: "map_point"`).** The item shows a blank map (`FreezeMap.tsx`): only the generated topographic basemap, at the scenario's extent, at one fixed framing, with pan, zoom and rotation off. Nothing of the live picture appears: no fire, burnt area, projection, units, drones or messages (PROBING_BLANKED, SPEC/08 §4).
- The participant taps one point, and a marker shows it. A second tap moves the marker.
- The participant then gives a confidence, plus the source on an L2/L3 map item.
- The answer is `{itemId, optionId: "map_point", confidence, point, source?}`.
- `submitFreeze` refuses a map answer whose point is missing or outside the scenario's extent, a choice answer that is not one of the item's options, an unknown or repeated item, and a confidence off the scale (`app/session/freeze-answers.ts`). Completeness is the screen's job: its submit stays off until every item is answered.
- The screen gets the items without `mapKey` or `keyAtomIds` (TRUTH).

**Six items.** The freeze screen scrolls. Its submit bar stays in view with "Vastattu n/6", and each item shows its number.

**r.12 addendum (2 Oct 2026): framing the freeze map.** *Superseded 9 Oct 2026 (`12` revision (aj)): the map opens on the whole scenario extent again, in a square box — the same neutral frame as the live map, derived from no view; the participant zooms in.* The blank map showed the whole 7 km scenario extent, so the fire was a speck. It is now framed on the fire as last reported in the view, which is what the participant has just seen.
- **Frame:** half-width = half the fire's larger span + 1.1 km, at least 0.8 km. The margin is the same in every view, so the frame does not depend on where the fire will go.
- **Size in practice:** about 2.3 km across in VP; growing with the fire to the extent's size in V10–V14, when the fire is 3.5–4 km across.
- **Zoom and pan:** the participant may zoom in (wheel, double click, +/−) and pan for precision, but never further out than the framing and never rotated. Only the basemap is ever shown.
- **Checked by test:** every map item's key lies inside its frame with its tolerance to spare (`test/session/freeze-map-frame.spec.ts`).

**r.12 addendum (2 Oct 2026, researcher): map items last, one item at a time.** The blank map shows roads, lakes and place names. Visible while another item was answered, it would be a memory aid; for example, for which settlement the fire reaches first, or the state of road R1.
- **Order:** map items now come last in every freeze (`mapItemsLast` in `demo-probes.ts`). This is a stable partition: the choice items keep their order, and an L1 map item comes before an L3 one.
- **Presentation:** the freeze screen shows one item at a time. "Seuraava" (next) moves on once the item is complete, and there is no way back. The map is therefore seen only during its own item, after every other answer is final.
- **Logging:** the freeze is still sent as one `freeze_submitted`.
- **Tests:** `test/scenario/freeze-items.spec.ts`.

**r.12 addendum (2 Oct 2026): no source question.** Freeze items ask only the answer and its confidence (`08` amendment of 2 Oct). The guided tour's memory-check step no longer mentions the source question.

---

## Revision 4 Oct 2026 (u) — the hinge screen and SPAM in phase B (`27`)

**The hinge screen, in order:**
1. The directive (as now; the dwell is logged).
2. **The hinge check** (`08` revision (u)): the directive hidden, one forced-choice item, then the directive shown again without marking the answer.
3. **One sentence by cell** (DEFAULT, `27` §3.2): `reasoning_intent` — the `linjaus` line is introduced as the machine's assessment, which can be wrong; `reasoning_once` — a sentence of the same length saying that Thinker answers as before; Haku — none.
4. V8.

The cells differ from step 3 on. Everything before it is identical in the two Thinker cells, so the check is pre-treatment.

**SPAM (§5) in phase B.** Under the SPAM redesign (tools disabled during an item, answers from the screen), §5's "the map, rail and all tools remain available" and its in-head vs with-tools reading lapse for the redesigned items. In phase B SPAM is a workload and awareness covariate for Paper 2, not its manipulation check and not an outcome (`08` revision (u), `27` §4.3).

### Reconciled with the build (5 Oct 2026)

What exists:
- **The hinge screen** runs as listed above: (1) the directive and "Olen lukenut linjauksen"; (2) the check without the directive, then the directive shown again; (3) the sentence by cell, shown with it and logged as `hinge_cell_note_shown`; (4) Continue to V8. The sentences (DRAFT, `ui.ts` `hingeCellNote`) are of equal length in the two Thinker cells: `reasoning_intent` *"Thinkerin vastauksissa on tästä eteenpäin rivi Linjaus: koneen arvio siitä, sopiiko tietueiden kuvaama tilanne voimassa olevaan linjaukseen. Arvio voi olla väärä."* (162 characters); `reasoning_once` *"Thinkerin vastauksissa on tästä eteenpäin samat neljä osaa kuin tähän asti: vastaus, perusteet, varmuus ja tieto, joka muuttaisi vastausta. Vastaus voi olla väärä."* (163); English 176 / 176. The step-3 sentence for `reasoning_once` above ("Thinker answers as before") was replaced because it was not of equal length. Haku: none.
- **SPAM (§5)** is delivered at V3, V6, V8 and V11: ready prompt at 25 s, 15 s to press ready, 20 s to answer, then confidence; Haku and Thinker locked while the item is open, the map and the message log usable (`08` revision (u), reconciled).
- **Study start:** the study link carries the participant code (`?tuotanto&koodi=`), which fixes the cell and the language; the start page shows no language choice then (`02` revision (u), reconciled). Revision (af), 9 Oct 2026: the shared link `?tuotanto` shows the language choice and one start button, and the code is issued by the server when it is pressed (`27` af). The final screen asks the participant not to describe the session to colleagues (DRAFT).

---

## Revision 6 Oct 2026 (x) — the view's flow without Type J and the outlook

Researcher decision (`01` revision (x)). Built 6 Oct 2026.

**The view.**
- The map, the projection, the message log and Haku (plus Thinker in the AI group) are available from the start.
- At 20 s the decision panel opens with **the sector plan only**. There is no judgement, no confidence, no verification step and no outlook.
- The plan's submission confirms the period. "Muuta kohdennusta" remains until the view ends (revision (r)).
- SAGAT freezes, SPAM, Type U, the step boundary and the hinge are unchanged.

**Timing (researcher decision, 6 Oct 2026).**
- The cap is lowered from 180 s to **150 s** (the researcher's 2 min 30 s per view, 6 Oct 2026). Freeze and probe time stay outside it (r.12).
- The minimum stays at 120 s (130 s for merged views).
- The decision panel stays at 20 s. The freeze windows are unchanged and lie inside both.

**The practice view (VP).** The practice J is removed. VP practises the plan, Haku and the freeze.

**Briefing and training: rewrite needed.**
- J's explanation and its example go, as do the guided tour's J and outlook steps.
- The projection is described as one source among others: what it shows, its validity horizon and how it is drawn.
- The researcher's general caveat of 1 Oct 2026 stays. Nothing says or implies how often the projection holds, or that checking it is the task.
- The setting text says that each stage asks for one plan.
- Rewritten 6 Oct 2026 (`briefing.ts`, the tour's projection and decision steps); DRAFT for native review.

**One-hour budget, recomputed** (open cuts in `11`):
- briefing and training 10 min;
- VP about 3.5 min;
- 14 views × 2.5 min = 35 min;
- hinge 2 min;
- freezes about 9–12 min;
- Type U (and F, if kept) about 2–3 min;
- post-session about 3 min.

That totals about **65–68 min** before the open freeze and SPAM cuts.

### x.1 The demonstration runs on the real times, with a skip (6 Oct 2026, researcher decision)

- **Timing.** Without `?tuotanto`, the demonstration now runs on the study's real view times: a 120/130 s minimum and a 150 s cap. Until now it ran with a 30 s minimum. `?esikatselu=<s>` still shortens views for development.
- **Skip** (demonstration only, `SessionOptions.allowViewSkip`). The status bar offers "Ohita vaihe / Skip stage" inside a view. It ends the view at once, and the parts not yet reached (the freeze, the plan) are not asked. It is logged as `view_ended.endedBy: "skipped"` with `stepAtEnd`. A freeze screen offers "Ohita muistikatko / Skip this freeze", which submits the answers given so far.
- **Not offered:** while a SPAM item is open (its ready window closes in 15 s), or on the briefing, training and hinge screens, which already advance on a click. The study (`?tuotanto`) never offers skip.
- **Logging.** The header logs `viewSkipAllowed: true`, so a demonstration log can never pass for a measurement.

---

## Revision 7–8 Oct 2026 (y) — the period-time line and the training texts

### y.1 The period-time line (fix pass 3, 7 Oct 2026; researcher decision)

The briefing's setting text, the same in both groups, now says that each period sums up its 20-minute step (40 minutes in a merged view) and that each report in the message log carries its own time:
- "Kukin jakso kokoaa yhteen 20 tai 40 minuuttia tilanteen kulkua; viestilokin ilmoituksissa on kunkin oma kellonaika." (`briefing.ts` `PERIOD_TIME_FI`)
- "Each period sums up 20 or 40 minutes of the incident; each report in the message log carries its own time." (`PERIOD_TIME_EN`)

No delivery is staggered. 31 pushed reports are dated after the map clock shown at view open, by design, and this line says so.

### y.2 The training texts (Haku / Open Thinker redesign, 8 Oct 2026)

**Supersedes §2's "matched-length radio and browsing training", revision (j)'s "matched-length Haku training", revision (o)'s "the Haku training is unchanged in length and in content", and the rule that the two training texts are within 5 % of each other's length.**

- **One identical Haku paragraph in both groups** (`HAKU_CHAT_FI` / `HAKU_CHAT_EN`). It says that Haku answers questions asked in your own words, only from the reports and records received so far, naming sources and times, always in the four-part form, and that the answer can be wrong or incomplete. The same paragraph is the tour's Haku step.
- **The AI group adds one Open Thinker paragraph** (`OPEN_THINKER_FI` / `OPEN_THINKER_EN`). It says that Thinker is a discussion partner, reads the same information as Haku, answers only when asked, can suggest options, and can be wrong.
- Both groups share the cross-checking sentence (`CROSS_CHECK_*`). The closing sentence differs: "Haku on käytössäsi koko istunnon ajan…" in one group, "Molemmat ovat käytössäsi…" in the other.
- **The texts therefore differ only by the Open Thinker paragraph and the closing sentence.** The length-parity rule is withdrawn: with Haku identical, any length difference is the treatment itself.
- **Disclosure (researcher decision, 8 Oct 2026; closes `11` §7.18.3 item 1).** The Haku paragraph ends with one identical sentence in both groups: "Hakun vastaukset tuottaa kielimalli saapuneiden ilmoitusten pohjalta." / "Search's answers are produced by a language model from the reports received so far." It is part of `HAKU_CHAT_FI` / `HAKU_CHAT_EN`, so the training texts and the tour's Haku step carry it, and the debrief says once that Haku's answers were produced by a language model for everyone. The tests no longer treat "kielimalli" as an AI word; `test/scenario/briefing.spec.ts` requires the sentence, once, identical in both groups and in the tour.

---

## Revision 9 Oct 2026 (ac) — the AI literacy questionnaire after consent

Researcher request (9 Oct 2026): "Put a 5-minute AI literacy test as the first thing users do after selecting the language." Skippable (researcher, the same day). **Amended the same day:** first built with AILIT-S (Hornberger et al., 2025, a 10-item knowledge test); at the researcher's request **SNAIL replaces it**, for comparability with Fernandes et al. (2026), who used SNAIL (`09` ac.1). Built: `app/session/ai-literacy-items.ts` (the items), `app/session/ai-literacy.ts` (the questionnaire), `orchestrator.ts` (the step), `StudyShell.tsx` (the screen), `app/telemetry/ai-literacy-score.ts` (the subscale means, analysis only). Tests: `test/session/ai-literacy.spec.ts`, `test/session/english-study-session.spec.ts`. **Supersedes §2's "Pre-session (separate day) … AI literacy (10 min)" row and §6's "Pre-session battery" row**: the AI literacy instrument now runs in the session itself.

### ac.1 Placement: right after consent

Ethics require consent before any data are collected, so the questionnaire cannot come directly after the language choice. It is the **first task after consent**, before the preflight. The order of screens is now:

1. the start page: language (and, in a demonstration, the cell); nothing is logged;
2. **consent** (`consent_decided`, the first record after the header);
3. **the AI literacy questionnaire** (`ai_literacy_started` … `ai_literacy_submitted`; the engine waits in PREFLIGHT, BOOT → PREFLIGHT having been logged on consent);
4. the preflight (`preflight_result`; PREFLIGHT → BRIEFING);
5. the pre-session item (fatigue at the start);
6. the briefing, VP, the training, V1–V14 with the hinge, the post-session questionnaire, the debrief.

Declining consent ends the session before it. A hard preflight refusal now comes after it: the ratings of a participant whose device is then refused are logged, but the session is not analysed (an aborted session, as before).

**Every session the study shell runs has it:** both conditions and all three cells, the study (`?tuotanto`) and the demonstration alike. The app turns it on (`useSession.ts`, `SessionOptions.aiLiteracyTest`), and the header logs `aiLiteracyTest: true`. The option defaults to off so the specs written before it run unchanged (like `visibleProbes`).

### ac.2 The instrument

**SNAIL**, the Scale for the assessment of Non-experts' AI Literacy (Laupichler, Aster, Haverkamp & Raupach, 2023, *Computers in Human Behavior Reports* 12, 100338, https://doi.org/10.1016/j.chbr.2023.100338): **31 self-report "I can…" items**, each rated on a 7-point scale from "strongly disagree" (1) to "strongly agree" (7), in three factors: Technical Understanding (TU, 14 items), Critical Appraisal (CA, 10) and Practical Application (PA, 7). **The English items and the item-to-factor assignment are verbatim** from the article's Table 1 (the 31 retained items). Licence CC BY 4.0. It is **self-report**: it measures how able participants judge themselves, not what they know. The Finnish rendering is a DRAFT, unvalidated. Details, scoring and analysis use: `09` revision (ac).

### ac.3 Behaviour

- **Four statements per screen** (8 screens: 4 × 7 + 3), under the stem "I can…", in one fixed order for everyone (by SNAIL's variable number, which mixes the factors). The authors randomised the order per participant; a fixed order keeps the stimulus identical (`11` §7.19). Each statement has seven buttons with the two anchors. A short instruction says there are 31 statements, no right or wrong answers, 5 minutes, no going back, and that it may be skipped.
- **Each rating is logged when it is given** (`ai_literacy_answered`); a changed rating is logged again and the last counts. **Next** needs every statement on the screen rated. There is no going back to an earlier screen.
- **A 5-minute cap** with a visible countdown (minutes:seconds, highlighted in the last 30 s). At the cap it ends: every rating given so far is kept, including those on the screen it interrupts, and every unrated item is logged as missing (`endReason: "timeout"`).
- **Skip the test** is on every screen, including the first, behind one inline confirmation ("Skip the test? The ratings you have given are kept…"). Skipping submits the ratings so far; the rest are missing (`endReason: "skipped"`). It works the same in every cell.
- **Next on the last screen** ends it (`endReason: "completed"`). The preflight follows at once in all three cases.
- **Resume** (SPEC/05 §9): if the session is interrupted during the questionnaire, it re-enters it (`session_resumed.resumedAt: "ai_literacy"`) on the first screen with an unrated item. The ratings already logged are kept and shown. The clock restarts with the limit less the active time already logged, which is the sum of the rating intervals; the time after the last rating before the interruption is not charged. A questionnaire that has ended (completed, timed out or skipped) is never shown again: the resume goes to the preflight.
- **Logging** (`07` revision (ac)): `ai_literacy_started`, one `ai_literacy_answered` per rating (item, screen, rating, time since the previous rating), and `ai_literacy_submitted` (end reason, the last rating per item with nulls, rated and missing counts, duration). No score is logged (`07` §3); the analysis computes the subscale means.
- **Checkpoint** (study sessions, `app/telemetry/session-checkpoint.ts`): the preflight screen that follows the questionnaire is a checkpoint boundary (`ai_literacy`, engine PREFLIGHT). Consent and the ratings therefore reach the server even if the session is abandoned before the training. The questionnaire screen itself is not a boundary.

### ac.4 Timing: the one-hour budget

31 ratings at about 4–6 s each take a **median of about 2.5–3 min**; the cap bounds it at 5 min, and skipping shortens it. (Laupichler et al. excluded completion times under about 1 min as careless; the authors give no typical duration.) With revision (x)'s recomputed budget of about 65–68 min, the session is now about **68–71 min** before the open freeze and SPAM cuts (`11`). Placing it at the end, as Fernandes et al. did, would avoid priming (`09` ac.2) but not the time; the researcher's request places it first.

---

## Revision 9 Oct 2026 (ad) — the freeze's own cap

### ad.1 The freeze's cap (`11` §7.20 item 3)

Before this revision a freeze had no cap (r.12 took it out of the view's cap) and "partial answers accepted" meant only the demonstration's skip, which logged the answered items and dropped the rest silently.

- **Answers stay required.** The screen's submit stays off until every item is answered (unchanged).
- **Cap: 180 s of real time from the freeze being shown** (`FREEZE_MAX_SECONDS`, `views.ts`; not scaled by the preview override). At the cap the freeze closes with the items confirmed with "Seuraava" so far; the item on screen, even if complete, is missing; the submission is logged `timedOut: true` with `missing` (`07` ad). The view then continues as after any freeze; the view's clock and cap were paused throughout (r.12).
- The demonstration's skip also logs `missing`.
- The analysis rule is `09` ad.1.

---

## Revision 9 Oct 2026 (ae) — no briefing page, no glossary

Researcher decision, 9 Oct 2026, with the English place names (`18` ae).

### ae.1 The "Situation" page is removed

The briefing step (BRIEFING; the full-screen "Tilanne" / "Situation" page with the setting text and, in English sessions, the glossary) is no longer shown, in every cell and both languages. After the pre-session item (with the study shell) or at the start (without it) the session goes straight to the practice view; the training page after VP stays.

- **Log.** The step is passed at once and logged as before: `briefing_advanced` with `screenId: "briefing.setting"`, `dwellMs: 0`, `auto: true`, `screenRemoved: true` (two optional fields, same log version), then the `briefing_complete` transition and `phase_entered` practice. The analysis, the checkpoint boundaries and the resume fast-forward are unchanged.
- **Resume.** A plan that targets the briefing (a log that stops before `briefing_advanced`, i.e. an older session interrupted on the page) resumes into the practice view from its start.
- **What only the page said.** The setting text's role, recorded-run, autonomous-asset and period sentences (`ROLE_TEXT_*`, `AUTONOMOUS_ASSETS_*`, `PERIOD_TIME_*` in `app/scenario/briefing.ts`) now open the practice tour's first popup ("Get to know the screen", `TOUR_SETTING_*`), identical in both groups; the two-and-a-half minutes were already in the tour's status step and the projection caveat in its projection step. The tour can be skipped, but the welcome is its first popup, so every participant sees it (a resume into a later view does not repeat it). Nothing else was on the page: no directive (P2's directive comes at the hinge), no roster (the markers' hover cards), no site or time beyond "the near future" (the status bar shows the clock).

### ae.2 The glossary is removed

The English glossary (R2, `27` §12) is gone with the page and from the message log; `glossary_opened` and `glossary_closed` are no longer emitted (kept in the types so older logs still type). The English session names places, sources and the volunteer brigade in English (`18` ae), and the roster gives each call sign's type. The post-session item `terms.familiarity` keeps its question; its English examples are "P2, EK11" (VPK is no longer shown in English).

---

## Revision 10 Oct 2026 (am) — the Thinker practice in VP

Researcher, 10 Oct 2026: "In the training there should be the Thinker training if the Thinker exists for the user." Supersedes r.11's "VP has Haku only" and `26` D3's "no AI in the practice view" for the two Thinker cells. The radio cell is unchanged: no Thinker anywhere, its practice tour exactly as before.

### am.1 What the participant sees

- **Thinker in VP.** In `reasoning_once` and `reasoning_intent` the Thinker tab is present in the practice view (the orchestrator's `aiAvailable` is the AI condition, every view). The exploration hint says so ("Map, Search and Thinker").
- **The practice tour's Thinker step** (`practiceThinker`, `app/render/ui/tour.ts` `practiceTour`), right after the Search step, identical in both Thinker cells. It opens the Thinker tab (logged as `tab_selected open_thinker`, like a click), rings the Thinker chat (`data-tour="thinker-chat"`) and leaves only that chat usable (the rest of the screen still takes no clicks). The text (`PRACTICE_THINKER_*`, `app/scenario/briefing.ts`; DRAFT, native and domain review pending): Thinker is a discussion partner for thinking the situation through over the reports received so far; it can be wrong, and it decides nothing — the decisions are the participant's; send the example or type your own question. One pre-filled example question is sent with a click (`PRACTICE_THINKER_EXAMPLE_*`: "Mitä uusimmat ilmoitukset kertovat palon kärjestä, ja kuinka vanhoja ne ovat?" / "What do the latest reports say about the head of the fire, and how old are they?"); the participant may also type their own. **The tour goes on only once one Thinker question has been answered** (or shown as unavailable); "Next" says why it waits. The tour then continues with the decision step as before. The practice tour has 16 steps in the Thinker cells, 15 in the radio cell.
- **The training page** after VP is unchanged in wording; it now receives the cell, so the `reasoning_intent` cell reads its own Thinker sentence (`introTextsIn`'s revision (al) branch, which the page had not been given).
- **V1's tool reminder** keeps the Search step and the Thinker step, but the Thinker step is now short, because every Thinker-cell participant practised it in VP (the practice tour always precedes the tools tour): "Thinker, which you tried in the practice, is available to you throughout the session, also in the decision phase. The practice conversation does not carry over: Thinker starts afresh." The `reasoning_intent` cell's step adds, word for word, its sentence on P2's orders (`THINKER_ORDERS_*`, the tail of `OPEN_THINKER_INTENT_*`). Nothing of the practice step's text is repeated (tested).

### am.2 What the Thinker does in VP (`14` revision (am))

- The server answers the Open Thinker in view 0 for the Thinker cells. In VP **both cells get the `reasoning_once` prompt and no order block** (no directive and no phase-A intent: the practice has no order; `intentBlockOf` returns null for view 0). The `reasoning_intent` prompt is not used in VP because it announces an order block that would not be there. So the practice stimulus is identical across the two Thinker cells. No verdict is coded (`verdict`, `verdicts` null). No prompt file changed; the manifest hashes are unchanged.
- **History.** The practice turns are cleared from the Open Thinker's conversation when the first main view starts (`SessionQueries.startView`), as the phase-A turns are at V8; a resume restores practice turns only into VP.

### am.3 Practice records

The practice turns are marked as every practice record is: `view` 0 on `ai_chat_query_submitted` / `ai_chat_answer_received` (`tool: "open_thinker"`), inside the `phase_entered` "practice" … "phase_a" bracket, so the analysis drops them by that tag. No browser record field changes. The Thinker server's JSONL line gains `practice: true|false` (both tools; `07` revision (am)).

### am.4 For the analysis (open)

`09`'s baseline compliance (`derived-measures.ts` `BASELINE_VIEWS = [0, 1]`) is described as "before any treatment contact"; in the Thinker cells VP now includes a Thinker contact (without any order). The researcher should decide whether the baseline keeps VP, or is read as "before any order-bearing contact". The H2a question-coding extractor (`chat-coding.ts`) still returns view-0 rows (as it did for practice Search questions); the analysis must filter them by `view`.

## Revision 19 Oct 2026 (ax) — the session under `30`

Per main view V1–V14, in order: the view opens as now (exploration, the decision panel from 20 s); at **60 s** the content-free **consult notification** (both groups; it waits for an open freeze or SPAM item; it carries no content and is never triggered by a record); the freeze at its pre-planned moment in V2, V4, V5, V7, V12; the SPAM ready prompt at 25 s in V3, V6, V8, V11 (V3 and V6 with a **second item** under the same ready, tools at hand); the plan and the view's end as now; then the **plan-confidence item** (one click, 25/50/75/100); then, in **V10 and V14 only, the blanked freeze**; then the next view. The guide group sees the **suggested-question chip** above the Thinker's input from V8. The practice view VP is unchanged (no notification, no plan-confidence item).

**Post-session:** the existing items, then the **source-memory block** (seven facts), then the workload items.

**Time budget (added to (aw)'s):** plan confidence 14 × ~10 s ≈ 2.5 min; eight L3 items ≈ 2.5 min; two SPAM items ≈ 1.5 min; source memory ≈ 1.5 min; the notification costs no time of its own. About **+8 min**, to be measured in pilot 2; if the session exceeds the researcher's ceiling, the source-memory block is the first to shorten (five facts), the SPAM second items the second.

## Revision 19 Oct 2026 (ay) — the session after the skills review (`31`)

- The (ax) order holds with three changes: **V12's freeze runs after the plan** like V10's and V14's (`26` (ay)), so the in-view freezes are V2, V4, V5 and V7; the **consult notice is deferred** until the freeze closes when the freeze is due within 15 s of 60 s (V5's seeded moment is 61 s; deterministic and identical for everyone; logged as shown later, never as a second kind); the **freeze cap is 240 s** for 8-item freezes (r.3/ad's 180 s stays for 6-item freezes). The freeze header states the clock at "now" (`08` (ay)).
- **Post-session:** the source-memory block carries seven facts and two lures; then believability, recognition ("did today's fire remind you of a real fire, department or unit?") and prior demo or game use; then two perceived-reliability items (exploratory); then the workload items.
- **Time budget** (added to (ax)'s ≈ +8 min): the lures ≈ 20 s, the three check items ≈ 20 s, the reliability items ≈ 30 s, the task definitions in the tour ≈ 20 s, the longer cap at most +1 min per phase-A freeze (median unchanged). Pilot 2 measures it. If the session exceeds the researcher's ceiling the order of shortening is: the perceived-reliability items, the source-memory facts (five), the SPAM second items; the recognition and prior-use items are exclusion data and are never cut.

## Revision 21 Oct 2026 (bb) — the public-audience version's session (`35`)

- **Expert sessions** (the default; no `?yleiso`) run as before, record for record (`test/public/expert-identity.spec.ts`).
- **A public session** (`?yleiso`): consent (the public text) → the AI literacy test → the preflight → the pre-session item → **the primer** (`35` §3 item 1; its pages and checks logged; left with `briefing_advanced` "briefing.primer") → the intro video → VP → the training, with the **mission card** above it (the same in both groups) → V1 … V14, the status strip carrying a **chapter title** by the clock (I V1–V3, II V4–V7, III V8–V11, IV V12–V14; none in VP) → the post-session questionnaire (the public background items, `35` §5) → **the commander profile** (`profile_shown`) → the debrief (the public text, the same in both groups) → the end. The views, their timing, freezes, SPAM, the plan review, Haku and the guide are those of an expert session; the glossary and the help card write records and change nothing else.
- **Scope phase A** (`?laajuus=a`, either audience): VP + V1–V7; after V7's end no hinge screen and no phase B: the post-session questionnaire follows at once, without the directive items. The public debrief has a phase-A version (the projection held in 4 of 7 periods; no directive paragraph); the expert debrief has none yet (open).
- **Resume** (`05` §9): an interrupted primer starts again from its first page (its earlier records kept); an interrupted profile is shown again; a phase-A session's end is V7's (`scopedSchedule`). The profile is a checkpoint (`profile`).

## Revision 23 Oct 2026 (be) — the difficulty audit's changes: the information rule, the practice lesson, the map pretest

Source: `docs/audits/2026-10-23-difficulty/` — the audit (a third of the scored items need a record only Haku reaches, yet the tour and the primer taught that the reports "arrive in the message log"; much of the rest is map reading) and the parts of its proposal that change no scored item, key or view timing. Identical in both groups and both audiences unless stated. Finnish texts DRAFT (native check).

**The session's order** (study shell): consent → AI literacy → preflight → the pre-session item → (public: the primer) → **the map-reading pretest** → the intro video → VP (the tour; the practice freeze; the practice SPAM delivery) → **the practice feedback** → the training → V1 … as before. The pretest and the feedback are session options the app turns on in every session (`mapPretest`, `practiceFeedback`; logged in the header, `07` (be)).

- **The rule in the tour** (`proposal.md` (a.2)): the log step is now "Message log: only part of the traffic" — the reports passed to the participant arrive here; the units' own reports and answers, drone and sensor data, forecasts and the units' status are kept in the records and found with Haku. The Haku step adds "Ask Haku as you would ask the command centre by radio … The mark 'New records' on the button tells you that new records have come in; it goes when you open Haku" before the Haku paragraph. V1's tool reminder (both groups) adds "Remember: the message log shows only part of the traffic. The rest is in the records." The Thinker steps are unchanged. No tour step says any longer that the reports arrive in the message log (tested).
- **The measure tool in the tour** (`proposal-map.md` d5): a step after the zoom step points at the TAK shell's measure (R&B) button and says how to use it. The practice tour has 16 steps (17 in the Thinker cells).
- **The "New records" badge** (`proposal.md` (a.4), the number-free default): on the Haku button (both layouts; in the guide group too, on the Haku button only), set at every view's start and step boundary unless Haku is open, cleared when Haku is opened. No count, the same text in every view; never triggered by a record's content. Not logged (`07` (be)).
- **The practice view's search lesson** (`proposal.md` (b.2), option A; `08` (be)): the practice freeze has a fifth item, the 12.00 forecast's afternoon wind, answerable only with Haku (the forecast is recorded only; every option agrees with the map's wind arrow).
- **The practice measuring task** (`proposal-map.md` c.3 item 2): the practice SPAM delivery has a second item under the same "ready" (as V3 and V6): how far the R3 bridge is from the fire, measured with the measure tool or the scale bar. A delivery's second item has its own 60 s window; VP's end waits for it, as a main view's does (no timing constant changed).
- **The practice feedback** (`proposal.md` (b.3), the SOURCE-ONLY variant, so that `32` §1 holds): after VP's end and before the training, one screen lists each practice question with where its information could be found — the message log (the messages' senders and times), the map, the records through Haku (with an example question), or worked out from the log and the map — and never which option was right. The two map tasks teach the skill (`proposal-map.md` c.3): the participant's head mark beside the head the practice map drew (its furthest point downwind; the drawn outline, never the fire model's truth), and the measured distance with how the measure tool works. The closing line names the group's tools ("Use Haku …" / "Use Haku, or Thinker, …"), as the training texts already differ. No scored freeze or SPAM item ever gets feedback.
- **The map-reading pretest** (`proposal-map.md` c.2; `08` (be)): six multiple-choice items on a neutral extract of the basemap, one at a time, final, a 4-minute cap, no confidence and no feedback; after the primer in a public session and at the same point (after the pre-session item) in an expert session.
- **Time budget:** the pretest ≤ 4 min, the feedback screen ≈ 1 min, the extra practice item ≈ 20 s and the measuring task ≈ 30–60 s (inside VP, which may run past its 180 s minimum while the item is open, as a main view does): about +6 min before V1. Pilot 2 measures it. **No view's timing changes** (minimums, caps, freeze moments, SPAM offsets).
- **Resume** (`05` §9): an interrupted pretest re-opens at its first unanswered item with the time left; an interrupted feedback screen is shown again.

## Revision 24 Oct 2026 (bf) — adopted before pilot 2: the Haku chip, the hinge's fatigue item, the new questionnaire items

Source: `30` (bf); records `07` (bf); analysis `09` (bf). Finnish texts DRAFT (native check).

- **The pre-session items** (`questionnaire.ts` revision (bf)): after `fatigue.start`, the hours slept last night (`sleep.hours`, 0–24, whole hours; both audiences) and, in an expert session only, whether the participant comes off a work shift that ended in the last 12 hours (`shift.recent`, yes / no). The screen's intro reads "A few questions before the situation briefing" / "Muutama kysymys ennen tilannekuvausta". Every item may be left blank.
- **The hinge** (V7 → V8): after the directive and the manipulation check, the same 1–7 fatigue item as the questionnaires' ("How tired do you feel right now?", the same anchors), above Continue, with the line "Optional: you can continue without answering" / "Vapaaehtoinen: voit jatkaa vastaamatta". One click, logged at once (`hinge_fatigue_rated`); another click replaces it; Continue never waits for it. Both groups alike (`HingeFatigueItem.tsx`, `hinge-check.ts`). A resumed hinge shows it unrated again (the earlier clicks stay in the log; the last counts).
- **The Haku chip** (`30` bf.1): in the Haku group, V8–V14, above Haku's input — the place and the views of the guide's chip — "What is new in this period's records?" / "Mitä uutta tällä jaksolla on kirjattu?"; disabled while an answer is pending; locked with the tools (a visible probe, the plan review, the plan-confidence item), as the guide's chip is.
- **The post-session questionnaire:** a "Looking back" / "Arvio jälkikäteen" section right after the source block and before the workload items: `accuracy.perceived`, then `influence.plan_views.<tool>` and `influence.answers.<tool>` in the group's own tool (`30` bf.3).
- **Not added:** a per-view workload rating (pilot-first, `30` bf.3).
- **Time budget** (added to (be)'s): the two pre-session items ≈ 15 s, the hinge's item ≈ 5 s, the three post-session items ≈ 45 s, the chip none of its own: about **+1 min**. If the session exceeds the researcher's ceiling, the shortening order of (ay) stands; the new items are short and are not cut first.

## Revision 24 Oct 2026 (bg) — the freeze header's "now" (the play-test, D1)

The freeze header no longer states the clock ("Kello pysähtyi klo 14.00. ”Nyt” tarkoittaa tätä hetkeä."): it names the span of the period's latest reports, the view's last step, and defines "now" by them — fi "Jakson viimeisimmät tiedot kattavat klo 14.00–14.20. Kysymysten ”nyt” on tilanne niiden mukaan.", en "The period's latest reports cover 14.00–14.20. In the questions, “now” is the situation they give." (`ui.ts` `freezeNow`, `freeze-answers.ts` `freezeNowClock`; DRAFT, native check). The span is the same for a freeze inside the view and one at its end (V12 18.40–19.00). (y)'s briefing line ("each period sums up 20 or 40 minutes … each report carries its own time") stands and now agrees with the header. The order, moments, caps and records are unchanged; only the header's text differs, and no record kind is added. Items: `08` (bg).

## Revision 25 Oct 2026 (bi) — the replay's fixes: the consult notice's moment, the tour's fire step, the debrief

Source: the replay on the fixed version (`docs/audits/2026-10-23-playtest/analysis.md` §10.3 c, h, i and §10.4 B7, B8, R6) and the researcher's decisions of 25 Oct 2026.

- **R6, the consult notice (amends (ax) and (ay) above, line "at 60 s").** A single-step view: 60 s, as before. A merged view (V2, V4, V6, V11, V12, V14): **70 s**, 5 s after its step boundary at 65 s, so the notice follows the second step's burst instead of preceding it by 5 s. It shows **only when reports arrived after the participant's last recorded plan** (a view's start brings its first step, a merged view's boundary its second). Otherwise it is dropped for that run of the view, unlogged. The (ay) deferral past a freeze due within 15 s uses the view's own moment and changes nothing (no merged view's freeze falls within 15 s of 70 s). The same rule in both groups, content-free; no record kind and no format change. Design and counts: `30` (bi).
- **B7, the tour's `fire` step** (both languages). Was "the fire's latest mapped edge", untrue after a merged view's boundary (a view draws its first step's fire, `26` §2). Now: en "The map shows the fire's edge as mapped at the start of the period, and the burnt area. Reports in the message log can be newer. Earlier perimeters are shown as thinner lines."; fi (DRAFT, native check) "Kartalla näkyy palon reuna sellaisena kuin se oli kartoitettu jakson alussa, sekä palanut alue. Viestilokin ilmoitukset voivat olla tätä uudempia. Aiemmat rajaukset näkyvät ohuempina viivoina." The map is unchanged (`28` (bi)).
- **B8, the debrief** (the expert text in every cell and the public text in both scopes, both languages). The planted record and VOL1's warning were never in the message log: they were recorded only and reachable with Haku (and, in the Thinker cells, the Thinker). The debrief said VOL1 "said on the radio" ("huomautti radiossa"), which reads as a message the participant missed, so the debrief now says where each was, neutrally:
  - planted record: en "This entry was not in the message log; it was in the records, where Search could find it." / fi "Merkintä ei näkynyt viestilokissa; se oli kirjauksissa, joista sen saattoi löytää Hausta.";
  - VOL1's warning: "VOL1 warned …" (no "on the radio"), then en "The warning was not in the message log; it was in the records, where Search (or Thinker, in the Thinker cells) could find it." / fi "Huomautus ei näkynyt viestilokissa; se oli kirjauksissa, joista sen saattoi löytää Hausta (tai Thinkerin avulla)."; the public text names "the AI assistant, if you had it", the same in both groups.

  The debrief's text ids (`debrief.<cell>`, `debrief.public.<scope>`) are unchanged. **Open: the ethics review of the debrief text** (with the withdrawal placeholder already pending) and the native check of the Finnish. Tests: `test/i18n/replay-texts.spec.ts`.

## Revision 25 Oct 2026 (bj) — the map training in the pretest's step

Source: `08` (bj) (the researcher's decision of 25 Oct 2026); records `07` (bj); analysis `09` (bj). It replaces (be)'s pretest bullet; everything else of (be) stands.

**The order is unchanged.** The step keeps its place and its id (`map_pretest`; the header's `mapPretest`): consent → AI literacy → preflight → the pre-session item → (public: the primer) → **the map training** → the intro video → VP …

- **Content:** seven short tasks on the neutral extract, each answered once and then given its feedback (`08` (bj) §3). The memory task shows its unit for 8 s before the blank map. Identical in both groups and both audiences.
- **Length:** a 5-minute cap (the pretest had 4). Expected length is about 3.5–5 minutes. At the play harness's costs (about 20 s a question, 10 s a feedback, plus the 8 s exposure) it takes 3.6 minutes. The time budget before V1 becomes about +7 minutes (was +6). Pilot 2 measures it (`durationMs`, `09` (bj)).
- **Resume** (`05` §9): the training re-opens at the first task whose feedback was not left. If that task's answer is logged, its feedback is shown again and the answer stands; otherwise its question is shown, and the memory task's unit is shown again in full. The cap is what is left after the active time already logged.
- **No view's timing changes** (minimums, caps, freeze moments, SPAM offsets).
