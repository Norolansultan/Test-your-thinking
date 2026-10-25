# 08 — Probes, freezes and instruments

**Version 3.1 · 17 September 2026** (v3.0 · 13 September 2026). Supersedes `05_Probe_and_Freeze_Design.md` including amendment B1. All eight- and nine-cycle figures are replaced by the twenty-cycle schedule.

> **Changelog**
> - **25 Oct 2026 (bn)** — after the independent review: V7 `north_help` (B1: the record and the key agree with EK14's pushed stream — a fire engine stops short, EK14's terrain vehicle gets through; key "Paloauto ei pääse linjalle asti: …"), V5 `hose_short` (S5: option `burnt` → `withdrawn`, the pushed state, false at the freeze), V5 `reinforcements` (S8: `none` re-worded; the level question to the panel). Classes unchanged. See the revision at the end.
> - **25 Oct 2026 (bk)** — four phase-A H2 items made seek-dependent (researcher decision 25 Oct 2026; `09` (bk), `30` (bk)): V2 `south_flank` (its 14.08 record held for seeking; option `lost` → `flames`, the stale pushed state), V5 `hose_short` (its 15.35 record held), V5 `reinforcements` (new L3, replaces `wind_shift` at its place), V7 `north_help` (re-keyed on EK14's access line, slug kept). Seek-dependent H2 items 5 → 9 of 23; each findable with two natural questions per language (`tools/review/seek-questions.ts`). DRAFT Finnish. See the revision at the end.
> - **25 Oct 2026 (bh)** — the play-test replay's decisions (`analysis.md` §10.4, researcher 25 Oct 2026): every L3 stem states its clock only (R1); V4 `head_later` exploratory, outside H2 and the composites (R2); V10 `infra` asks a plain current state (R3); VP `r1_arrival` asks a time of day (R4); the brook Korpioja is Myllyoja / Mill Brook (R5); V5 `area_hour` re-banded with a 10 % guard (R8); SPAM V3.b's options differ in magnitude (R9); "ditch" → "brook", V14's basis figures, the contradiction prompt singular (B3, B4, B9). See the revision at the end.
> - **25 Oct 2026 (bj)** — the map training replaces the map-reading pretest (researcher decision 25 Oct 2026): seven tasks in its slot on its neutral extract, each answered once with feedback (find a named place, measure a distance, fire and slope, water by road, the map against the log, project by the clock, the memory-check map); keys computed by `tools/review/map-training.ts`; tasks 1 and 7's first-try pointing errors a covariate (`09` (bj)). Replaces (be) §4. See the revision at the end.
> - **24 Oct 2026 (bg)** — the play-test decisions (`docs/audits/2026-10-23-playtest/analysis.md` §6, researcher 24 Oct 2026): one definition of "now" (the header names the span of the period's latest reports; phase-A L1/L2 stems "viimeisimpien tietojen mukaan"; every L3 stem names its clock; V12 `head_now` and V10 `south_front_point` re-keyed at the header's time); V2 `ek11_between` and V4 `head_unattended` re-worded without their cues, V4 `crown_drops` on a pushed record; V10 `area_total_hour` → `area_growth_hour` (truth-keyed growth); F7 scored for H9 only; V10's map tolerance 200 m; the item table regenerated. Supersedes y.1, y.2 and (ay)'s "now". See the revision at the end.
> - **23 Oct 2026 (be)** — the difficulty audit (`docs/audits/2026-10-23-difficulty/`): the practice freeze gains a fifth item answerable only with Haku (the forecast); the practice SPAM delivery a second item (measuring a distance); the map-reading pretest (six items, keys computed by `tools/review/map-pretest.ts`, a covariate only); the source-only practice feedback. **No scored freeze or SPAM item, option or key changes**: the item-level fixes (`proposal-items.md`) wait for the expert panel. See the revision at the end.
> - **20 Oct 2026 (ba)** — `32` §5–§6: the S-TIAS (`stias.tools.1–3`, `stias.thinker.1–3`) replaces `tools.trust` and `thinker.trust`; `freeze.intrusiveness` added. DRAFT Finnish. See the revision at the end.
> - **19 Oct 2026 (az)** — the item table regenerated from the built bank after WP-1 and WP-2 merged (`npx tsx tools/review/freeze-table.ts`); it replaces the tables of y.6, ab and ad. See the revision at the end.
> - **19 Oct 2026 (ay)** — `31`: items re-authored after the SA probe audit (V4 `growth_next`, V14 `se_front_r2` and `head_later`, SPAM V6.b, six phase-A L2 items, cue removals and distractors); rules added (delivered basis, ≥ 2 × tolerance, horizon in every L3 stem, ascending bands) and rule (d) restated; "now" for view-end freezes; V12's freeze after the plan; the 240 s cap; two lure facts; `basisAtomIds`; the item tables of y.6/ab/ad are stale until WP-2 regenerates them. See the revision at the end.
> - **19 Oct 2026 (ax)** — `30`: the phase-A freezes carry 2×L1, 2×L2, **4×L3** (eight new L3 items); V10's and V14's freeze comes after the view's plan is final; V3 and V6 carry a second SPAM item at L2/L3 answered with the tools (team understanding); every L2/L3 item carries `keyStatements` for the told / not-told split; a plan-confidence item after every main view; a post-session source-memory block. See the revision at the end.
> - **9 Oct 2026 (ai)** — Type U at V13 becomes a closed two-part area item (yes/no, then on yes which parts of the picture; one seeded option order for everyone, "other" last; scored as the north-edge hit); the V14 backup collects a confidence; no free-text probe is left. See the revision at the end.
> - **9 Oct 2026 (ag)** — SPAM (Type S): no ready expiry; forced (clock paused, modal) at the view's end with a censored ready latency; collapsible prompt; a 60 s answer window; Haku and the Thinker usable during the item (supersedes (u)'s 15 / 20 s and D4's lock). See the revision at the end and `27` (ag).
> - **9 Oct 2026 (ad)** — V10's hour-ahead R2 item, answerable from DR2's pushed "runsaan kilometrin", becomes `front_r2_2h` (two hours on, 700–1000 m, report-keyed); V10 `area_total_hour` edges 128/135/145; V14 `se_front_r2` edges 150/275/450 with a `projectionOptionId` (the projection-direction key's item reading).
> - **8 Oct 2026 (ab)** — numeric L3 items are keyed on the delivered reports (linear extrapolation), map and direction items on the truth; five keys moved (V2, V4, V10 twice, V12); V10 `south_front_point` 100 m; new distractors; `tools.trust` names Haku; the item table regenerated. See the revision at the end.
> - **8 Oct 2026 (aa)** — three freeze items replaced (V2 `area_40`, V10 `area_total_hour`, V14 `se_front_r2`); V12 `front_toward`, V7 `lull_meaning` and V5 `wind_shift` revised; every freeze again 2 L1 / 2 L2 / 2 L3; the item table regenerated from the bank. See the revision at the end.
> - **6–8 Oct 2026 (y)** — the freeze items rewritten (fix passes 2–5): "now" is the clock on screen at the freeze; L3 prompts worded relative to now; the 1.3× option-length rule; per-item answer times; three recall-answerable L3 items replaced; the item table regenerated from the bank. See the revision at the end.
> - **5 Oct 2026 (u, reconciled)** — the hinge check and SPAM reconciled with the build (`27` 1.1): the four delivered SPAM items, 25 / 15 / 20 s, tools locked; the directive shown again after the check.
> - **4 Oct 2026 (u)** — the hinge check is an instrument of its own; SPAM is not the manipulation check and has no Paper 2 hypothesis (`27` §4). See the revision at the end.
> - **1 Oct 2026 (r)** — freezes at pre-planned pseudo-random offsets within the view (supersedes revision 23 Sep's "freeze placement moves before the decision phase"); one infrastructure item per freeze; F7 asked once (V12); a source question after each SA item; no tool words in SA items; probe reactivity from unprobed views; one confidence scale 25/50/75/100 and its calibration reading. See the revision at the end.
> - **25 Sep 2026 (p)** — probe schedule replaced by `26` §4 (14 views).
> - **25 Sep 2026 (o)** — the Haku group judges the envelope with Type J; Type E unchanged and the only marking task; freeze items for the planted record. See the revision at the end.
> - **23 Sep 2026 (j)** — the no-AI group is renamed **Haku** (`02` revision (j)); "Radio's Type-J replacement" below now reads "the Haku group's". Probes are otherwise unchanged.
> - **17 Sep 2026 (d)** — two groups (no AI 70, AI 130); AI group pull-only with group-specific training; AI group split 65/65 at the hinge, the via-AI half receiving query answers framed against the commanded strategy; branch choice adopted with four authored options plus *Ei mikään näistä*, no free text; per-choice alignment feedback removed.
> - **17 Sep 2026 (c)** — only the reasoning-AI group is split by guidance mode; prologue warm-up; 10 freezes × 5 items, 6 SPAM, 9 unprobed (see `15` v1.1).
> - **3.1 · 17 Sep 2026** — Freeze count, recall confidence, SPAM probe type and schedule replaced by `15`.

---

## 1. What the probes must support

Four things, and every design choice below traces to one of them.

**First-order accuracy**, so that confidence has a denominator. Without it, calibration is undefined.

**Second-order confidence**, paired item by item with the first-order response.

**Situation-awareness levels** in Endsley's sense — perception (L1), comprehension (L2), projection (L3) — separately, because the claim is that the machine degrades the third while leaving the first two intact.

**A generative act**, performed late, whose presence or absence within participant is the mechanism test for H6.

---

## 2. Relationship to SAGAT

This design uses SAGAT's **method** — a halt, a blanked display, memory-based queries resolved against an authored answer key — for one probe type only, and departs from it everywhere else.

The departures are deliberate:

- **Blanking.** SAGAT blanks everything. This design blanks only for recall, because a containment judgement about a displayed envelope requires the envelope to be displayed.
- **Scheduling.** SAGAT samples randomly. This design schedules deterministically, because the scenario's authored structure means a random freeze can land inside the contradiction window and destroy it.
- **Scoring.** SAGAT scores SA. This design scores SA **and** the confidence attached to it, which is the actual construct.

The design also borrows SPAM's online-probe logic for the judgement items, which is why the judgement items are not blanked.

**Freezes are intrusive and this is contested rather than settled.** The defence here is narrower than the usual one:

- halted time is budgeted and declared;
- blanked halts are limited to six across the session;
- the headline measure is calibration, a *within-participant* relationship between confidence and accuracy, which is far less sensitive to a uniform intrusion than an absolute performance score would be;
- intrusion is constant across conditions, so it cannot produce the predicted between-condition dissociation.

---

## 3. Probe taxonomy

| Type | Name | Mode | Count | Measures |
|---|---|---|---|---|
| **R** | Recall | **blanked** | 6 freezes × 3 items = 18 | L1/L2 accuracy: first-order denominator, manipulation check |
| **J** | Judgement | visible | 20, every cycle | Containment judgement, confidence, failure localisation or correction |
| **E** | Expectation | visible | 10, alternating cycles | The generative manipulation (H6) |
| **F** | Falsification | visible | 3 | Named observable, diagnosticity |
| **U** | Uncertainty | visible | 2 + coverage item | Contradiction detection, envelope coverage confidence |

### 3.1 Type R — recall items

> **[SUPERSEDED 2026-09-17]** Freeze count, cycles and items per freeze are now in `15` §4 (10 freezes incl. 2 in the prologue; five items each: 2 × L1, 2 × L2, 1 × L3). Each item carries a confidence rating. L3 items are new to Type R.

Three items per freeze, at cycles 2, 5, 9, 13, 16, 19. Picture blanked completely.

The three items per freeze are:

- **One L1 item (perception):** where is a named formation; what is the current wind direction; what was the last reported perimeter edge on a named flank.
- **One L2 item (comprehension):** which sector is most exposed; which formation is least able to reposition.
- **One item alternating between L1 and L2** across freezes, so the schedule is balanced across the session.

Scored against the invariant list with declared tolerances — ±30° for wind direction, a declared distance for positions, exact match for categorical.

**Recall items are the manipulation check.** If `substitutive` shows equal or better L1 and L2 recall and worse calibration, the claim is localised to the projection level. If L1 recall is also worse, the channel is simply degrading attention, which is a different and less interesting finding — and one the design must be able to detect.

### 3.2 Type J — the containment judgement

**Every cycle. Three parts in fixed order.**

**Part one — a three-way judgement of the envelope.**

| Response | Meaning | Follow-up |
|---|---|---|
| `holds` | The fire will stay inside the envelope | None |
| `partly_wrong` | Broadly right, but it breaks somewhere | Mark the breach location (a point) |
| `fundamentally_wrong` | The projection does not describe what will happen | **Draw your own projection** (an area) |

**Part two — a confidence rating**, 0–100, on the judgement just made.

**Part three — the follow-up**, whose form depends on part one.

**The binary needed for signal-detection analysis — `holds` versus not-`holds` — is derived, not collected.** This is the single most important sentence in this document. A binary button collects less and cannot be recovered; the three-way response can always be collapsed and cannot be reconstructed from a binary.

#### Why the correction is the most valuable single datum in the cycle

A participant who says "this is wrong" and then draws what they think will happen has produced an externalised mental model, at a known moment, scoreable against the actual outcome, and directly comparable to the machine's projection.

It yields the one sentence a general officer, a fire chief or a regulator understands immediately: **was the human's correction closer to the actual outcome than the machine's projection was, when the human chose to override it?** Binary, computable, and the most interpretable number the study produces.

### 3.3 Type E — expectation marking

On ten of the twenty cycles, the participant marks where they expect the fire to reach and states a confidence **before the envelope is revealed**. The ten cycles follow a schedule declared in the manifest and counterbalanced across participants (odd-cycle order A, even-cycle order B).

Expectation marking is placed **late** in the cycle, after the working period. The delay between encountering the information and performing the generative act is the active ingredient, not the act itself.

This is the within-participant manipulation for H6: cycles with expectation marking versus cycles without, and the size of the repair by condition.

### 3.4 Type F — falsification items

Three across the session, at cycles 7, 14 and 19. "What would you expect to see if this projection were wrong?"

Coded on two dimensions:

- was an observable named at all;
- is the named observable **diagnostic** of the authored failure mode for that cycle.

The second dimension is the interesting one — naming something unfalsifiable is a different state from naming nothing.

### 3.5 Type U — uncertainty probe and coverage confidence

**The open item, cycle 18, at the contradiction window.** "Is there anything in the current picture you are unsure about or would want to verify?" Free text. (*Superseded 9 Oct 2026, revision (ai): a closed two-part area item at V13; see the revision at the end.*)

**Deliberately non-leading.** It must not mention conflict, inconsistency, or reports disagreeing, or it becomes a prompt rather than a measure. Coded blind into four categories: names the contradiction specifically; names uncertainty in the right area without identifying it; names unrelated uncertainty; names nothing.

**The forced-choice backup, cycle 20.** "Which of these pairs of reports, if any, were inconsistent with each other?" with the authored pair among distractors. Scored binary. The backup exists for two reasons: the open probe risks a floor effect, and a participant may have noticed the contradiction without articulating it.

**Coverage confidence, cycle 20.** "How confident are you that the fire's actual development stayed inside the projections you were shown?" Scored against whether it did.

**Picture confidence** is captured immediately before and after the cycle-18 window, so a confidence drop at detection is measurable.

---

## 4. Freeze behaviour

Both modes halt the virtual clock and disable the channel. They differ only in what is rendered (`05` §4).

`PROBING_VISIBLE` — map and envelope remain rendered. Used for J, E, F, U.
`PROBING_BLANKED` — map, rail, drawers and status strip removed. Used for R only.

In-flight events are buffered, never dropped, and flushed on `RESUMING` with their original virtual timestamps.

---

## 5. Schedule and time budget

> **[SUPERSEDED 2026-09-17]** Replaced by `15` §2, §4 and §6.

### 5.1 Per-cycle budget

| Element | Budget | On which cycles |
|---|---|---|
| Working period, clock running | 90 s | All 20 |
| Expectation marking (Type E) | 25 s | 10 |
| Projection reveal | 5 s | All 20 |
| Containment judgement (Type J), `holds` | 40 s | ~10 |
| Containment judgement, rejection with correction | 60 s | ~10 |
| Verification window | 30 s | All 20 |
| Recall freeze (Type R, 3 items) | 45 s | 6 |
| Falsification item (Type F) | 20 s | 3 |
| Uncertainty probe (Type U) | 45 s | 2 |
| Allocation and rationale | 30 s | All 20 |

The correction step applies only on rejection cycles, which by design is about half of them. A polygon drawing takes fifteen to twenty seconds; the Type J budget extends from 40 s to 60 s on rejection cycles only.

### 5.2 Session total

| Segment | Duration |
|---|---|
| Pre-flight, consent confirmation, briefing | 12 min |
| Cycles 1–10 | ~35 min |
| **Hinge pause** | 5 min, dismissible early |
| Cycles 11–20 | ~35 min |
| Post-session questionnaire | 15 min |
| **Total** | **~102 min**, task time ~70 min |

**This is a long session and it is deliberate.** Sustained attention under accumulating fatigue is part of the phenomenon (`01` §2). Dropout is an analysed outcome, not merely a loss.

### 5.3 Schedule summary

```
Cycle           1  2  3  4  5  6  7  8  9 10 | 11 12 13 14 15 16 17 18 19 20
Judgement (J)   ●  ●  ●  ●  ●  ●  ●  ●  ●  ● |  ●  ●  ●  ●  ●  ●  ●  ●  ●  ●
Expectation (E) ●     ●     ●     ●     ●    |     ●     ●     ●     ●     ●
Recall (R)         ●     ●        ●          |        ●        ●        ●
Falsify (F)                       ●          |           ●                 ●
Uncertain (U)                                |                    ●        ●
```

The expectation row shown is order A. Order B shifts it to the complementary cycles. Assignment derives from participant code and is recorded in the log header.

---

## 6. Scoring

**Every probe resolves against an entry in the scenario's invariant list, with its tolerance declared there rather than in analysis code.** Scoring happens entirely in the analysis pipeline, never in the runtime.

| Type | Scoring |
|---|---|
| R, L1 categorical | Exact match |
| R, L1 numeric | Within declared tolerance (e.g. ±30° for wind direction) |
| R, L1 spatial | Within declared distance tolerance |
| R, L2 | Exact match against the authored correct option |
| J, derived binary | `holds` vs not-`holds` against polygon containment of the actual perimeter, with declared tolerance |
| J, failure localisation | Distance from marked geometry to the nearest actual breach |
| E, expectation | Overlap between marked geometry and actual perimeter; and whether the actual perimeter falls inside the marked area |
| F | Coded: observable named (yes/no); observable diagnostic of the authored failure mode (yes/no) |
| U, open | Coded blind into the four categories in §3.5 (*revision (ai): replaced by the V13 area item — the north-edge hit, binary, no coding*) |
| U, forced choice | Binary (*revision (ai): with its confidence on the one scale*) |
| Coverage confidence | Confidence value against the binary containment outcome |

### 6.1 The rejection cases

The three-way judgement makes false rejection scoreable, which a binary cannot.

| Case | Scored as |
|---|---|
| `partly_wrong`, breach occurred | Distance from marked point to nearest actual breach |
| `partly_wrong`, no breach occurred | **False rejection.** Recorded as such; the marked point has no referent |
| `fundamentally_wrong`, categorical breach occurred | **Correct rejection.** Plus correction quality: overlap between the drawn area and the actual perimeter, and whether the actual perimeter falls inside the drawn area |
| `fundamentally_wrong`, envelope held | **False rejection with a substituted projection.** Score correction quality anyway — its distance from the actual outcome is the cost of the rejection |
| `holds`, breach occurred | **Miss.** Graded by whether the breach was quantitative or categorical |
| Any rejection | **Relative accuracy:** was the correction closer to the actual outcome than the envelope was? Binary |

### 6.2 Doubt–action coherence

After a rejection, the participant allocates resources. The allocation is checked against two references: the machine's envelope, and the participant's own correction. Three patterns are distinguishable:

- Allocation consistent with the correction — **the doubt changed the decision.**
- Allocation consistent with the envelope despite the stated rejection — **the doubt was expressed and not acted upon.**
- Allocation consistent with neither.

The second pattern is the most interesting failure in the whole design: a commander who says the projection is wrong and then acts as though it were right. It is available from no other measure, requires no extra probe, and is computed entirely from records already captured plus the authored viability table.

**Establish its base rate in pilot before interpreting it.**

---

## 7. Optional — requesting a revised projection

On rejection, the participant may request a revised projection from the system. If adopted, this option costs twenty additional authored envelopes and a UI action with its own probe handling. In return, it yields a measure of whether a participant who doubts the machine asks it again or works around it.

**Decision deferred to pilot.** If adopted, the allocation viability table must be able to score allocations against a *participant-drawn* projection, which means viability is evaluated against the branch set rather than against the envelope. Confirm before M5 (`10`).

---

## 8. Item bank and validation

### 8.1 What to author

| Item | Count |
|---|---|
| Type R items | 30 authored for 18 slots |
| Type J containment items | 30 authored for 20 slots |
| Type E prompts | 10, identical wording, different cycles |
| Type F items | 5 authored for 3 slots |
| Type U items | 3 contradiction candidates + 1 forced-choice set + 1 coverage item |
| Revision envelopes | 20, only if §7 is adopted |

The over-authoring is not waste. It is what lets pilot 2 tune difficulty into the gate bands by **selection** rather than by re-authoring.

### 8.2 Finnish wording rules

Probe wording is reviewed as a set by the domain reviewer, for register as well as accuracy.

- No leading terms.
- Numeric items state their unit.
- Categorical options are mutually exclusive and exhaustive, with an explicit *ei tiedossa* where "don't know" is meaningful.
- The uncertainty probe is checked specifically against the leading-question failure.

### 8.3 Validation gates

Before data collection:

- Every probe resolves against an existing invariant.
- No probe can be answered from the probe text alone.
- No two probes in a session ask the same thing in different words.
- The recall freezes do not land inside the contradiction window or the omission window.
- The forced-choice backup's distractors are plausible and were checked against pilot participants' open responses. (*Revision (ai): no open responses are collected; checked against the pilot's V13 area choices and the backup's error pattern instead.*)
- The expectation-marking counterbalance is balanced across conditions.

### 8.4 Known criticisms and this design's answers

**Probes may teach the task.** Twenty cycles of the same judgement format will produce practice effects. Cycle index is a covariate in every model, and practice cannot load onto condition because condition is between subjects and the schedule is identical.

**Freezes may alter performance.** Answered in §2.

**The open uncertainty probe may have a floor effect.** Answered by the forced-choice backup and by authoring three contradiction candidates of graded subtlety.

**The three-way judgement may be harder than a binary and depress accuracy.** Checked directly in pilot against gate 1. If accuracy falls below 60%, the item difficulty is tuned by selection, not the response format simplified — collapsing to a binary would lose false-rejection scoring, which is where this design's distinctive measures live.

---

## Amendment 2026-09-17

**Type S — SPAM (new).** Specified in `15` §5. Six probes: one in the prologue (W3), five in the main cycles (3, 7, 11, 15, 20).

**Item bank additions (§8.1).** Type R: raise from 30 to **70** authored items for 50 slots (≈28 L1, 28 L2, 14 L3; incl. prologue and 4 phase-B intent items). Type S: 10 for 6. Decision items: 30 for 25 (`16` §5).

**Validation additions (§8.3).** No blanked freeze and no SPAM probe in cycles 12 or 18. No blanked freeze and SPAM probe in the same cycle. Prologue items never refer to events after W5.

---

## Revision 17 Sep 2026 (d) — supersedes earlier amendments where they conflict

### Branch choice after a fundamental rejection (handoff adopted)

`HANDOFF_Projection_Judgement_Loop.md` §4–§9 is adopted into Type J:

1. The three options appear **in fixed order** (`holds`, `partly_wrong`, `fundamentally_wrong`), never randomised.
2. `fundamentally_wrong` → **draw first** (3–12 vertices, undo, restart) → **then choose** one of **four authored branch statements** or **"Ei mikään näistä"**, always fifth and last. **No free-text explanation.**
3. The branch list is shown only after `fundamentally_wrong` (pilot may extend it to `partly_wrong`; `11` §7.2 H2).
4. The confidence slider **starts unset** and requires an explicit interaction.
5. Degenerate input (a scribble, a whole-map polygon, a point in a lake) is **accepted and logged** — closes `11` §3.8.
6. Submission is irreversible; only revision creates a new record. The interface says so before the first judgement.

New measures (§6): drawn-vs-chosen agreement; doubt–action coherence via the chosen branch against the allocation viability table; correct use of *Ei mikään näistä* at the omission cycle.

### Level 3 freeze items (review P7) — rule

L3 items in freezes ask about **consequences the envelope does not draw** (a formation needing relief, a road or water route becoming unusable, a value at risk being reached), never about the fire's position at the envelope's horizon, and never beyond that horizon.

---

## Revision 23 Sep 2026 — freeze placement, and Radio's Type-J replacement

**Freeze placement moves before the decision phase** (`15` §9), superseding §4's implicit "between judgement and course-of-action" ordering (which came from `16` §2's now-superseded diagram). §2's SAGAT-fidelity argument is strengthened by this change, not weakened: probing recall before any response is closer to standard practice than probing after one.

**Radio's per-cycle own-projection step (`15` §10.1)** is structurally close to **Type E** (§3.3: mark an expected area and confidence before a reveal) rather than to Type J, since Radio has no envelope to reveal or judge. It is **not** folded into Type E's existing schedule (§3.3's 10-of-20-cycle schedule stays as specified, condition-independent) — it is Radio's replacement for Type J, happening every cycle, scored the same way as Type E (§6). Whether it is analysed as a Type-J analogue or on its own terms is open, per `15` §11.

---

## Revision 25 Sep 2026 (o) — the envelope for both groups; items for the planted record

Follows `02` revision (o).

- **The Haku group's Type J replacement (revision 23 Sep, above) is withdrawn.** Both groups judge the same envelope with Type J in every cycle.
- **Type E is unchanged:** 10 of 20 cycles, counterbalanced (orders A and B), in both groups. It is the only projection-marking task. It is **not** moved to fixed "key" cycles, because H6 compares cycles with and without marking, and fixed event cycles would confound that comparison with cycle difficulty.
- **Freeze items for the planted record** (fault F7, the 110 kV line). The freezes of views V7 and V12 (`26` §4) each carry an L1 or L2 item on the line's status, with different wording. The correct answer is *live*. Holding *de-energised* is scored as wrong and also coded as the false value (for H9). The items are written so that the question does not suggest the answer.

---

## Revision 25 Sep 2026 (p) — fourteen views

§5.3's schedule is replaced by `26` §4. Type E: 7 of 14 views, counterbalanced by odd/even view. Type F: V5, V11, V14. Type U: V13, V14. Rekindle anticipation (`26` §5) is scored from allocations to L3 and from bog content in Type E and SA answers in V7–V8.

---

## Revision 1 Oct 2026 (r) — freeze timing, freeze content, the source question, the confidence scale

Researcher decisions of 1 Oct 2026. The view flow they sit in is `15` revision (r).

### Freeze timing

- **Superseded:** revision 23 Sep 2026's "freeze placement moves before the decision phase", and `15` §9 item 3. On the scheduled freeze views the freeze falls at a **pre-planned pseudo-random offset in [25 s, minimum − 20 s]** of view time, seeded at build time and identical for all participants. It can fall during exploration or mid-decision, and the participant resumes where they were.
- **§2, "Scheduling", restated.** Which views carry a freeze stays deterministic, for the reason §2 gives (a random freeze could destroy the omission or contradiction window). Within a view, the moment is now varied, as in standard SAGAT. Revision 23 Sep argued that "before any response" was closer to SAGAT practice. That holds for one aspect only (no freeze is cued by a decision just made). It gave up another: under a hard exploration timer the freeze always came at the same, learnable moment. The trade-off and its mitigation (the logged covariates `decisionCommittedBeforeFreeze` and `decisionStep`, and a sensitivity analysis on before-commitment freezes) are set out in `15` revision (r), r.3.

### Freeze content

- **One infrastructure item per freeze**, in addition to the SA items of `15` §4.4, from a fixed schedule over four topics: the power line, road R2, the R3 bridge and the water points (schedule: `26` revision (r)). Item ids are `freeze.<view>.infra`; at V12 the infrastructure item is the F7 item (`freeze.12.f7`). All are L1 except the F7 item (L2). **Why:** an item on infrastructure appears in every freeze, so asking about it does not signal that infrastructure matters in that view. **Limitation:** this holds for the category, not for every topic. The water points and R2 are each asked more than once, including at times when nothing is happening to them. The power line is asked only at V12 (it is the F7 item), and the R3 bridge only at V14, because its load limit first appears at step 16 (V12) and an earlier item would ask about something the participant cannot yet know.
- **F7 is asked once, at V12** (supersedes revision (o)'s "the freezes of views V7 and V12"). Correct answer: *live*. The planted value *de-energised* is scored wrong and coded as the false value for H9. A fourth distractor is added so the item has four options. V7's freeze carries no line item.
- **No tool words in SA items.** No item stem names Haku, Thinker, the message log or the map controls, so an item does not suggest where its answer came from.
- **Source of the answer.** After each SA item (its answer and confidence), the participant says where the answer came from: **map**, **message log**, **search** (Haku), **own inference**, and, in the AI condition only, **Thinker**. Logged as `source` on the freeze item answer (`07` revision (r)). The practice freeze has no infrastructure item but does ask the source question; Thinker is not offered there. Finnish labels: native reviewer.
  - The source answer is a self-report and is not scored for correctness. It can be checked against the log (for example, "search" with no Haku query on the topic in the view), and that check is exploratory.
  - **The option set differs between groups**, because the Haku group has no Thinker. Distributions across sources are therefore not directly comparable between groups. Comparisons use the shared options, or the share of "own inference", and say so.
- **Probe reactivity.** The views with no SA probe (V1, V9, V13) are kept. Measures that do not depend on a probe (information seeking, decision commitment time, allocation revisions, Type J accuracy) are compared between views with and without a blanked freeze, and query topics after a freeze are compared with the topics the freeze asked about. **This comparison is confounded with view content:** the three unprobed views were chosen for design reasons (the handover, the omission, the contradiction), not at random. It is exploratory (`09` revision (r)).

### The confidence scale

Every confidence question uses **25 / 50 / 75 / 100**, never preselected (implemented 1 Oct 2026). This replaces "0–100" in §3.2, `15` §4.4 and §5, and `16` §4.

- **Calibration reading.** For a four-option item (SA items written with four options, the F7 item, the course-of-action item), 25 is chance, so the bottom of the scale means "guessing". For **Type J (three options), chance is 33 %**, so the bottom category lies below chance. A participant who is guessing and answers 25 is scored as slightly underconfident on Type J. Type J calibration is therefore reported against its own chance level and not pooled with four-option items in one calibration curve without saying so.
- Each item's option count is recorded with the item, so the chance level of every confidence–accuracy pair is known in analysis.
- §8.3 validation gates, added: every SA item has its option count declared; no SA item stem names a tool; F7 appears in exactly one freeze (V12); every freeze except the practice freeze carries exactly one infrastructure item.

### Amendment (2 Oct 2026) to revision (r): infrastructure schedule and level tag

- **Schedule revised** so that no fact is asked twice with the same answer and every key rests on a direct report: VP W1 (VPK: "vettä saa Haukilammelta (W1)"); V2 road R1 *not safe to drive* (DR1 road report, step 3); V4 W1 *available* (KY21 and VPK fill there, step 5); V5 road R1 *passable with care* (DR2 road report, step 7); V7 W3 *available*; V10 R2 *threatened*; V12 F7 (the line's state); V14 R3 bridge *no heavy tanker*. R1 appears twice with different answers (its state changes), which tests updating rather than repetition. The former V4 R2 key ("open"), inferred rather than reported, is gone.
- **The practice freeze** has three items: the two SA items and an infrastructure item, so every item format is practised before V1.
- **The SA level tag (L1/L2)** is shown on freeze items for demonstration and hidden in the study (`?tuotanto`); the log header records which (`probeLevelsShown`). A study log must have `probeLevelsShown: false`.
- **Kept as drafted:** the F7 implication item with its fourth distractor (`partial`); option D of the course-of-action item softened to "ilman erityistä perustetta" (coded against/unsound).

### Amendment (2 Oct 2026): the correction is a direction and a reach

**Researcher decision (option A).** After `fundamentally_wrong` the participant no longer draws or taps an area. They answer two parts, both required and neither preselected:

- **direction**: the direction in which the fire goes beyond the projection. There are eight compass sectors on the north-up map, or *all round*.
- **reach**: how far beyond the projection's edge: under 200 m, 200–500 m, or over 500 m.

The branch list follows as before. The answer is logged as `containment_judgement_submitted.correction` (`07`, format 0.8.2).

**Why.** The one-tap tool built a fixed-shape area, and since 2 Oct its size came from the projection. Only the tap point came from the participant. So "was the correction closer than the machine?" (§3.2, §6.1) was largely decided by the tool's geometry, not the participant's model. A real drawing tool was weighed and set aside, for four reasons:

- it takes 15–20 s;
- motor skill adds noise to the answer;
- a freeze would often interrupt it;
- the generative act it involves is a confound for H2 (below).

**Scoring, replacing the correction-quality rows of §6.1.**

- **Direction**: the sector holding the actual perimeter's largest overshoot beyond the envelope is a hit; an adjacent sector is a near miss. *All round* is a hit if the overshoot exceeds the reach's lower bound in at least half of the sectors.
- **Reach**: the actual largest overshoot's class matches the chosen class, or misses by one or by two classes.
- **Relative accuracy (§3.2)**: whether the corrected envelope (the envelope pushed out in the chosen sector by the reach class's midpoint: 100 / 350 / 650 m) is closer to the actual perimeter than the envelope itself. This is computed in analysis, not in the app.
- **Doubt–action coherence (§6.2)**: the allocation is read against the chosen sector instead of a drawn area.

**Effect on the freezes (H2).** The correction is the only generative act before a freeze, and only participants who reject the projection make it. If the AI group rejects less often, it gets this rehearsal less often. The rehearsal could then confound H2, the calibration on the L2/L3 SA items. Option A keeps the act light, but the confound is not removed. The analysis therefore pre-registers a covariate: whether the view's judgement was a rejection and was submitted before the freeze. The source is `freeze_started.decisionStep`, together with the judgement's time against the freeze's start. The pilot reports how many freezes fall during the judgement or the correction (`11` §7.12).

### Amendment (2 Oct 2026): a goal-based freeze item bank

**What it replaces.** Until now every freeze repeated the same two items: "Missä yksikkö EK11 viimeksi raportoitiin olevan?" (L1) and "Mikä lohko on tällä hetkellä eniten uhattuna?" (L2). An Endsley/SAGAT review found six faults:

- there were no Level 3 items, though H2 is defined on L2 and L3;
- the items were not derived from goals;
- the same two questions in every freeze let participants learn the test;
- the keys were predictable (*L2 Kärki* was correct in VP, V2, V4 and V5);
- "eniten uhattuna" was ambiguous (fastest spread, or values at risk?), and its options carried place-name hints;
- phase A had only four L2 items per participant, all multiple choice, although marking on a blank map is Endsley's standard for spatial knowledge.

The bank below replaces both items. What was good is kept: the blanked screen, the pre-planned random freeze moments, the frozen simulation, the infrastructure slot (with the keys and schedule of the amendment above), and F7 at V12 (`freeze.12.f7`, option `de_energised`).

**Draft goal set.** This is a draft, made before a proper GDTA with rescue officers, which comes later. Every item carries one goal (`FreezeItem.goal`):

- **safety**: crew positions against the fire, escape routes, spotting, crown-fire danger, fatigue;
- **values**: the Mökkiranta cabins, Lahdenkylä village, the 110 kV line;
- **containment**: the head, the flanks, lines holding, wind, fuel ahead;
- **resources**: water points, roads, arrivals, availability.

**Structure.**

- Each main freeze (V2, V4, V5, V7, V10, V12, V14) has six items: 2×L1, 2×L2 and 2×L3, shown in that order.
- The infrastructure item is one of the two L1 items. At V12, F7 is the infrastructure slot, and it counts as the L2 "implication" item.
- Every main freeze has at least one `map_point` item. In a `map_point` item the participant taps a blank map (basemap only), and the tap is scored by its distance to `mapKey`.
- The practice freeze (VP) has four items, one per format and level: the infrastructure item (L1), the head on the map (L1, `map_point`), one L2 item and one L3 item.
- Code: `app/scenario/freeze-bank.ts` (VP and phase A), `freeze-bank-b.ts` (phase B), `freeze-bank-core.ts` (definitions and the option arrangement) and `freeze-keys.ts` (the computed keys).
- The Finnish texts are drafts for native-speaker and domain review. The English versions are in `content/i18n/labels.en.json`.

**Keys.** Every item has one key that the simulation determines. `keyAtomIds` lists the corpus atoms that an L1 or L2 key rests on, and every such atom has arrived by the view's last step.

An L3 key is the CA's actual future under the current deployment. Participants' orders do not change the world (identical stimulus), so that future is fixed. An L3 item therefore asks about the fire as it is deployed, never about the effect of the participant's own orders. L3 items carry no key atoms, because their key has not been reported yet.

Each key is either *computed* by a documented rule in `freeze-keys.ts`, or *cited* with its basis, and in that case `test/scenario/freeze-bank.spec.ts` checks it against the bundle or the corpus. The rules:

- **The head now**: the observed head that the map draws (`observedHead.anchor`). A merged view draws its first step's fire.
- **The head at a later clock**: the vertex of the CA truth perimeter (main and detached fronts) at that step's end that lies furthest along the next step's observed spread bearing. It matches the next step's observed head to within 50 m on every step.
- **A unit's position**: the unit's position in the view's last step. A merged view shows its second step's units, and every pushed item of both steps has arrived before the freeze.
- **Ahead of the head**: a unit whose position is ahead of the head along its spread bearing, and within 1 km of the head's axis.
- **Nearest settlement**: the nearer of the two settlements to the drawn fire. "Equal" is keyed if they are within 300 m of each other.
- **Growth trend**: the next step's CA area growth against the current step's. More is above 1.25×, less is below 0.8×, and anything between is about the same.
- **Head-rate trend**: the CA's achieved head rate, against half and 1.5× of the current rate.
- **Front direction**: the bearing of the CA front's centroid over the next step, as the nearest cardinal direction. A bearing within 15° of the midpoint between two cardinals is a build error, not a key.
- **First rekindle sector**: the sector holding the first CA detached front after the view.

> **Superseded 8 Oct 2026** by revision (y) §y.6, the table regenerated from the bank.

| View | Item (id suffix) | Level | Goal | Kind | Key | Basis |
|---|---|---|---|---|---|---|
| VP | `infra` | L1 | resources | choice | W1 available | VPK: water from Haukilampi (W1) |
| VP | `head_now` | L1 | containment | map_point | W2 observed head | computed |
| VP | `first_target` | L2 | values | choice | road R1 | EK11: head NE towards R1, 340 m; settlements 2–3 km |
| VP | `r1_arrival` | L3 | containment | choice | over an hour | computed: 340 m ÷ 3 m/min; CA head at R1 by 13:20 |
| V2 | `infra` | L1 | resources | choice | R1 unsafe | DR1 road report, step 3 |
| V2 | `ek11_point` | L1 | safety | map_point | EK11 on the esker | computed: step-3 position |
| V2 | `ahead_of_head` | L2 | safety | choice | EK11 | computed: the only unit ahead of the head |
| V2 | `nearest_settlement` | L2 | values | choice | Mökkiranta | computed: ~2.0 km against ~2.9 km |
| V2 | `fuel_ahead` | L3 | containment | choice | dense spruce | cited: steps 5–6, the Kuusimäki spruce stand, then crowning |
| V2 | `head_later` | L3 | containment | map_point | CA head at 14:40 | computed |
| V4 | `infra` | L1 | resources | choice | W1 available | KY21 and VPK fill there, step 5 |
| V4 | `ek12_where` | L1 | safety | choice | the R1/R2 junction | computed: step-6 withdrawal |
| V4 | `fastest_spread` | L2 | containment | choice | the head (L2) | cited: DR3 12.4 m/min crown fire; CA growth in L2 |
| V4 | `work_danger` | L2 | safety | choice | crown fire and embers | cited: EK12, the near miss |
| V4 | `rate_trend` | L3 | containment | choice | slows clearly | computed: achieved rate 0 against 38.9 m/min |
| V4 | `head_later` | L3 | containment | map_point | CA head at 15:40 | computed |
| V5 | `infra` | L1 | resources | choice | R1 passable with care | DR2 road report, step 7 |
| V5 | `head_now` | L1 | containment | map_point | step-7 observed head | computed |
| V5 | `spot_cause` | L2 | containment | choice | embers, no units near | cited: EK12's crossing reports |
| V5 | `units_enough` | L2 | resources | choice | no, more units needed | cited: EK11 asks for more units |
| V5 | `wind_shift` | L3 | containment | choice | the north edge | cited: CA step 9 (wind 160°) grows in L1. Key atoms empty: the wind forecast record is added in parallel and wired by the integrator |
| V5 | `growth_trend` | L3 | containment | choice | more | computed: 18.1 against 8.7 ha |
| V7 | `infra` | L1 | resources | choice | W3 available | EK11 and EK12 fill there |
| V7 | `ky21_point` | L1 | safety | map_point | KY21 on the north flank | computed: step-10 position |
| V7 | `rain_meaning` | L2 | containment | choice | not surely out in the ground | cited: the shower; VPK's objection; the CA resurfaces at step 12 |
| V7 | `why_north` | L2 | values | choice | the Mökkiranta cabins | cited: KY21's move reason; EK14 |
| V7 | `rekindle_sector` | L3 | containment | choice | L3 South | computed: first detached front, step 12, in L3. This is the H10 anticipation item |
| V7 | `cabins_reach` | L3 | values | choice | no | computed: ~1.7 km at steps 11–13 |
| V10 | `infra` | L1 | resources | choice | R2 threatened | EK14, step 13 |
| V10 | `south_front_point` | L1 | containment | map_point | the drawn south front | computed: centroid of the drawn detached front |
| V10 | `r2_meaning` | L2 | resources | choice | the shuttle route may be cut | cited: EK14 |
| V10 | `why_bog` | L2 | containment | choice | no crew; the bog edge not checked | cited: SPEC/26 §5 |
| V10 | `front_direction` | L3 | containment | choice | east | computed: ~96° |
| V10 | `south_units` | L3 | resources | choice | yes | computed: step-14 growth ~6 ha |
| V12 | `longest_shift` | L1 | safety | choice | EK11 | cited, checked: 6.8 h against 5.3 h at most |
| V12 | `head_now` | L1 | containment | map_point | step-16 observed head | computed |
| V12 | `f7` | L2 | safety | choice | live | the amendment above, revision (o) |
| V12 | `nearest_settlement` | L2 | values | choice | Lahdenkylä | computed: ~1.2 km against ~1.7 km |
| V12 | `village_distance` | L3 | values | choice | 300–800 m at 19:40 | computed: ~650 m |
| V12 | `head_later` | L3 | containment | map_point | CA head at 19:20 | computed |
| V14 | `infra` | L1 | resources | choice | the bridge does not carry a heavy tanker | OUT1 and OUT2, step 16 |
| V14 | `shift_change` | L1 | safety | choice | EK11 and VPK | computed: units within 300 m of the CP |
| V14 | `road_crossed` | L2 | containment | choice | the road no longer stops the head | cited: EK15, steps 19–20 |
| V14 | `ugv_meaning` | L2 | resources | choice | no new hose line until UGV1 is free | cited: OUT1 |
| V14 | `head_later` | L3 | containment | map_point | CA head at 20:00 | computed |
| V14 | `growth_trend` | L3 | containment | choice | about the same | computed: 13.1 against 13.8 ha |

**map_point tolerance.**

- **L1, 200 m** (where something is now). This covers the map symbol plus recall error at the session map's scale, about 3 % of the 7 km map width.
- **L3, 300 m** (where the head will be). This is about 30 minutes of head travel at phase A's typical 7–10 m/min.

The tolerance is stored with each key (`mapKey.toleranceM`). An L3 map key lies over 300 m from the head the participant last saw, so it is a projection and not a recall. Both values are drafts for the pilot.

**Balance rules** (`test/scenario/freeze-items.spec.ts`):

- **No verbatim repeats in consecutive freezes.** No prompt appears verbatim in two consecutive freezes.
- **A topic recurs only when its answer changes.** "Merkitse kartalle palon kärki." appears at VP, V5 and V12. The settlement item appears at V2 (Mökkiranta) and at V12 (Lahdenkylä).
- **Balanced correct positions.** The correct option's position is arranged at build time from the scenario seed (`arrangeOptions`), identically for every participant. The freezes are visited in view order, and each choice item's key goes to the position its level has used least so far. Positions therefore differ by at most one per level across the main freezes.
- **No dominant position or answer in phase A.** Within a level, no position and no answer is correct in more than half of the phase-A choice items. Items that share one option set never share a key in more than half of them.
- **No tool words.** No item names a tool.
- **Nothing named before it is on record.** No item names anything before the view whose last step has it on record (the helicopter, smouldering, evacuation, the slurry tanker, the Honkaharju road, UGV1, the south front, the bridge).

**Reactivity notes.**

- *The V7 anticipation item.* It names a renewed flare-up ("uudelleensyttymisen riski") two views before the omission (V9). Its evidence, VPK's objection, is on record in V7. Asking about it may still cue detection at V9. The pilot should compare V9 detection with and without the item, or the researcher may move it to the post-session interview.
- *Ruled out at build time.* "Missä palo leviää nyt nopeimmin?" is not asked at V2, because the head and the esker spread at the same reported 7.1 m/min. The settlement item is not asked at V10, because there the two distances differ by under 100 m.
- *A known limitation.* The infrastructure schedule keys "available" at VP, V4 and V7 (water points). This schedule is the researcher's, and it is kept.

**Trade-off: length.** Six items, each with its confidence and, for L2 and L3, its source question, lengthen a freeze to about 60–90 s. The 180 s view cap will therefore exclude freeze time; that change is made separately (`views.ts`, SPEC/15). The pilot should report the freeze durations.

### Amendment (2 Oct 2026): the source question is withdrawn

**Researcher decision.** The question "Mistä tieto oli peräisin?" ("Where did this information come from?", 1 Oct 2026; asked on L2/L3 items only since SPEC/15 r.12) is no longer asked.

**Why.**
- **Self-reported source is reconstructive.** People name a plausible source, not the actual one (source-monitoring research). This is worse here, under time compression and in a memory freeze.
- **The options overlapped.** A Haku result is a log entry, and Thinker cites log entries.
- **There was no "guessed" option.**
- **Wrong place for L3.** On L3 items "Päättelin itse" (I worked it out myself) was almost always true by definition.
- **Reactivity.** At every freeze it prompted participants to monitor sources, which acts as a cross-checking intervention and could narrow the H2/H3 group differences. In the AI group it also named Thinker.
- **No hypothesis used it.** H2a reads the query logs instead.

**What replaces it.** Where information reached the participant is read from the log: `freezeItemExposure` (bubble / Haku / Thinker route, time before the freeze).

**What is lost.** A measure of *misattribution*, e.g. Thinker-supplied information remembered as one's own inference. If wanted later, a post-session source-memory test on 6–8 key facts would measure it without priming during the session (`11` §7.15).

---

## Revision 4 Oct 2026 (u) — the hinge check; SPAM's role in phase B (`27` §4)

- **The hinge check (new instrument).** One forced-choice item on the hinge screen, after the directive and before V8, in every cell: *"Mikä on nyt voimassa oleva toimintalinja?"*, four parallel options, one correct. The directive is hidden while it is answered and shown again afterwards, without marking the answer. It measures **reception** of the directive. It is answered before the two Thinker cells differ, so it is **not** a check of the AI manipulation; exposure from the log is (`27` §3.4). It is not an exclusion criterion; a per-protocol sensitivity analysis uses it. The post-session questionnaire repeats it (retention) and asks the Thinker cells whether Thinker's answers related to the directive.
- **SPAM is not the manipulation check.** This supersedes `26` revision (t) §t.2's "this item is the default manipulation check". Under the SPAM redesign (tools disabled during an item; answers from the screen), V8's directive item would measure how fast the participant finds the directive in the message log. V8's item is replaced by the SPAM work package.
- **SPAM in phase B** measures workload (ready latency) and momentary awareness (answer latency and accuracy). For Paper 2 it is a covariate and a fidelity side-effect check (does the `linjaus` field cost attention?), never an outcome. Phase-B items must not cue a deciding fact of a keyed view before its plan is final, and must be answerable from the screen; V11's current item (DR3's recorded 17:59 landing) is not, and changes.

### Reconciled with the build (5 Oct 2026)

What exists (`27` §4.1, §4.3):
- **The hinge check** is built as specified: the directive with "Olen lukenut linjauksen"; the item without the directive (four options, the key "Linjat teiden ja vesistöjen varaan; suojataan Lahdenkylä ja Mökkiranta", distractors crossing line and aim, seeded order, key only as a scenario invariant); one answer; then **the directive shown again, unmarked** (added 5 Oct 2026), followed in the Thinker cells by one sentence about the answer's parts (`15` revision (u), `27` §3.2); then Continue. The post-session repeat (retention) and the perception item are **not built**: the app has no post-session questionnaire (`27` §11 M6).
- **SPAM as delivered:** four items, **V3** (the burnt area by the latest survey, DR3's pushed 17,8 ha; stale lure 12,9 ha), **V6** (EK11's line at Koivuoja: the fire got across), **V8** (what is known of the Mökkiranta cabins: occupancy unknown, police asked; replaces the directive-recall item), **V11** (what the region asks of KY21: EK11's pushed step-14 line; replaces the DR3 item, whose key was recorded only). Each key rests on a pushed record in the message log by the item's moment. The ready prompt appears **25 s** into the view; **15 s** to press ready; **20 s** to answer; then confidence (*superseded 9 Oct 2026, revision (ag): no ready expiry, forced at the view's end, 60 s to answer, tools not locked*). **Haku and Thinker are locked from the item's display until the probe closes** (*withdrawn in (ag)*); the map and the message log stay usable. Measures: ready latency, answer latency, correctness, confidence, and whether a Thinker answer was pending at the prompt (`spam-measures.ts`).

---

## Revision 6 Oct 2026 (w) — Type E withdrawn

Researcher decision, 6 Oct 2026. This supersedes §3.3, and every schedule that places Type E (revision (o), `26` §4).

- **Type E is not delivered.** No view asks the participant to mark the expected fire area. H6, its only use, is withdrawn (`01` revision (w)).
- **Why.** §3.3 placed E *before the envelope is revealed*. Since `02` revision (o), the projection is on the map from the view's start. The build hid it only while E was open, 20 s in, after the participant had seen it, so the marking was anchored on it. Seven markings cost about six minutes.
- **What goes with it:**
  - the participant's E order (A: odd views, B: even views) and the header's `counterbalance`;
  - the `panel_open` delivery;
  - the map's area-marking layer and the probe card's area form;
  - the E key (the CA truth at the view's horizon) and the E measures (overlap, containment);
  - the `map_polygon` response.
- **The visible probes are now F (V5, V11, V14) and U (V13; V14 after the view).** Their placement, locking and clock rule are unchanged.
- **Code:** `demo-probes.ts`, `visible-probes.ts`, `probe-keys.ts`, `probe-measures.ts`, `VisibleProbeCard.tsx`, `MapView.tsx`, `SessionView.tsx`, `views.ts` and `header.ts`. Telemetry: `07` revision (w).

---

## Revision 6 Oct 2026 (x) — Type J, its follow-ups and the outlook withdrawn

Researcher decision, 6 Oct 2026. Built 6 Oct 2026. The reasons are in `01` revision (x).

**Withdrawn:**
- §3.2 Type J (the containment judgement), with its confidence;
- the breach point and the structured correction (revision (r), `07` 0.8.2);
- the branch choice after "fundamentally wrong" (revision (d)), with its authored branch statements;
- the outlook and its two confidences (`16` revision (s)).

**What remains in a view:**
- the sector plan (`16`);
- SPAM in V3, V6, V8 and V11. These are listed for a separate cut decision (`11`, the one-hour session).
- Type F (V5, V11, V14) is **withdrawn with J** (researcher decision, 6 Oct 2026). It asked *"What would you expect to see if this projection were wrong?"*, the same verification frame, and without J it has no judgement to follow. SPAM stays (researcher decision, 6 Oct 2026).
- Type U (V13; V14 after the view): unchanged.

**The freezes are the only SA measure.** All seven are kept (researcher decision, 6 Oct 2026). Their levels, timing and blanking are unchanged. One item changes: V5's L3 growth-trend item is replaced by a `head_later` map item ("Merkitse kartalle, missä palon kärki on klo 15.40."), still L3 and containment, so the projection-reliance measure has a view where the projection holds. No freeze item asks whether the projection holds.

**New exploratory measure: projection reliance (no prompt).**
- **The items.** A `head_later` item carries the projection's head at its clock (`projectionPoint`, TRUTH, analysis only) when the view's projection reaches that clock. Three do:

  | Item | View's projection | True head vs projection's head |
  |---|---|---|
  | V4, 15:20 | fails (C) | 847 m apart |
  | V5, 15:40 | holds | 619 m apart (the projection reaches further than the fire) |
  | V14, 20:00 | fails (Q) | 122 m apart, inside the 300 m tolerance, so it hardly discriminates |

  V2 (14:40) and V12 (19:20) ask beyond their merged view's projection, whose isochrones end at 40 minutes, so they carry none.
- **The measure** (`projectionReliance`, `freeze-measures.ts`). For each answered tap, its distance to the projection's head and to the true head. A tap nearer the projection's head is **projection-anchored**.
- **Limits.** Three items, two in phase A (V4, V5): exploratory only.
- **Second reading.** In breach views, whether the plan's main effort follows the projection's direction rather than the reported development (`16` revision (x)).

---

## Revision 6–8 Oct 2026 (y) — the freeze items rewritten; "now", relative wording, option lengths, answer times

Researcher decisions of 7 Oct 2026 (the persona round and iteration 2) and 8 Oct 2026, built in fix passes 2–5 (`freeze-bank.ts`, `freeze-bank-b.ts`, `freeze-bank-core.ts`, `freeze-keys.ts`, `demo-probes.ts`). Tests: `test/scenario/freeze-bank.spec.ts`, `freeze-items.spec.ts`, `test/session/freeze-answers.spec.ts`. **The table below supersedes the item table of the 2 Oct 2026 amendment and every later edit of it.** Items stay DRAFT, for native and domain review; keys stay DRAFT until the panel confirms them (`11` §7.14).

### y.1 "Now" is the clock on screen at the freeze

- **"Now"** is the start of the view's **last** step: the clock the participant sees when the freeze opens (`minutesAhead`; researcher, 8 Oct 2026). Every merged view's freeze falls after its step boundary, which a test checks.
- **Every L3 key forecasts from that now.** Its interval (`keySteps`) starts at the freeze's now step. For a head-later item, the interval ends at the prompt's time. Fix pass 4 corrected V4 and V5, whose rate items had keyed the step after the view's last step (systems-analyst run 3).
- **L1 "now" map items** read what the map draws. A merged view draws its **first** step's fire and its second step's units (`demo-map.ts`), so V12's `head_now` is step 16's head. This is listed as open (`11` §7.18).

### y.2 Relative wording

Projection prompts name no clock time. They are worded relative to now: "20 minuutin kuluttua", "tunnin kuluttua" / "in 20 minutes", "in an hour" (`inMinutesFi`, `headLaterFi`, `growthPromptFi`). The briefing says that each period sums up its 20-minute step (`15` revision (y)). Delivery is not staggered.

### y.3 Option length: the 1.3× rule

No correct option is more than **1.3×** as long as the longest wrong option, in Finnish or in English (`freeze-items.spec.ts`). Keys are paraphrased rather than quoted from the record, distractors are plausible, and the correct option's position is balanced per level (`arrangeOptions`, unchanged).

### y.4 Per-item answer time

Each answer in `freeze_submitted` carries `answeredAtWallMs` and `msSinceFreezeOpened`. Each item left with "Seuraava" is also logged at once as `freeze_item_completed`, so a reload during the freeze keeps the moments (`07` revision (y) §y.2). An item's answer time is its moment minus the previous item's (the first item: minus the freeze's opening). Partial freezes, with some items unanswered, are still accepted (`11` §7.18, open).

### y.5 Content decisions reflected in the table

- V7's lull item (`lull_meaning`) does not state the smoulder-and-flare-up mechanism, which would cue H10's `rekindle_sector`.
- V5's projection item is on the main front.
- V10's `south_units` and `why_bog` are replaced.
- V14's north-edge item is replaced by an item that cues neither the H3 contradiction nor the no-fit decision (`shift_meaning`).
- V14 `road_crossed` has a neutral key ("the road no longer stops the head"), naming no directive-aligned action.
- `ky21_point` is a choice item (`ky21_where`).
- The three recall-answerable L3 items, **V4 `rate_trend`, V5 `rate_next` and V10 `front_direction`**, are replaced (8 Oct 2026).
- The V2 key follows the wind-relative side computation (FF5).

### y.6 The item table (generated from the bank, 8 Oct 2026)

Generated from `PRACTICE_BANK`, `FREEZE_BANK` and `infrastructureItem` (the views VP, V2, V4, V5, V7, V10, V12 and V14), in authored order; the build arranges the options. "Key" is the correct option's Finnish label. "Forecast steps" is `keySteps`, the interval an L3 key forecasts. "Basis" is the bank's own text.

**Replaced since the 2 Oct table:**

| View | Was | Now |
|---|---|---|
| V2 | `ahead_of_head` | `nearest_head` |
| V4 | `rate_trend` | `growth_next` |
| V5 | `head_later` (map), then `rate_next` | `area_hour` |
| V7 | `ky21_point` (map) | `ky21_where` (choice) |
| V7 | `rain_meaning` | `lull_meaning` |
| V10 | `why_bog` / `why_rekindle` | `ek12_water` |
| V10 | `south_units` | `cabins_distance` |
| V10 | `front_direction` | `front_r2` |
| V12 | `nearest_settlement` | `front_toward` |
| V14 | `ugv_meaning`, then `north_edge` | `shift_meaning` |

**Final (items2, 8 Oct 2026).** Every freeze has six items. V14 `road_crossed` is restored and keyed on the step-18 crossing radio. V12 `village_distance` uses kilometre bands (key 1–2 km; it was 1500–2500 m).

> **Superseded by revision (ab):** V12 `village_distance` key is 1.6–2 km (report-keyed), not 1–2 km.

**Level balance (researcher decision, 8 Oct 2026).** V2 and V10 have 2×L1, 3×L2 and 1×L3: `fuel_ahead` and `cabins_distance` were relabelled from L3 to L2 (comprehension), because their keys are on record before the freeze. Every other freeze has 2×L1, 2×L2 and 2×L3.

| Phase | Freezes | L1 | L2 | L3 |
|---|---|---|---|---|
| A | V2, V4, V5, V7 | 8 | 9 | 7 |
| B | V10, V12, V14 | 6 | 7 | 5 |

In total there are 16 L2 items and 12 L3 items. H2's phase-A window therefore holds 16 L2/L3 items, as before, but one fewer L3. V7 has no map item. **Superseded by revision (aa): V2 and V10 regained a second L3 item, and every freeze has 2 × L1, 2 × L2 and 2 × L3.**

**The item table that stood here is superseded by the one in revision (aa) §aa.2** (regenerated from the bank on 8 Oct 2026).

---

## Revision 8 Oct 2026 (aa) — final fix pass: three items replaced, level balance restored, the table regenerated

Researcher decisions of 8 Oct 2026 (the commander and persona round 4) and the items fix pass (`freeze-bank.ts`, `freeze-bank-b.ts`, `freeze-bank-core.ts`, `freeze-keys.ts`, `demo-directive.ts`, `demo-probes.ts`). Tests: `test/scenario/freeze-bank.spec.ts`, `freeze-items.spec.ts`, `directive.spec.ts`. **The table below replaces revision (y)'s table (y.6)**; items stay DRAFT for native and domain review.

### aa.1 What changed since revision (y)

> **Superseded in part by revision (ab):** the bands and keys of V2 `area_40`, V10 `area_total_hour` and V14 `se_front_r2` below read as `ab.4` (report-keyed); the CA figures quoted here (~23 ha, ~135.8 ha, ~237 m) are the truth, not the key.

| View | Was | Now | Note |
|---|---|---|---|
| V2 | `nearest_settlement` (L2) | `area_40` (L3) | the burnt area after 40 minutes (bands under 15, 15–20, 20–30, over 30 ha; key 20–30 ha; the CA gives ~23 ha at 14:40) |
| V10 | `r2_meaning` (L2) | `area_total_hour` (L3) | the whole fire's area after an hour (bands under 125, 125–130, 130–140, over 140 ha; key 130–140 ha; the CA gives ~135.8 ha) |
| V14 | `growth_trend` (L3) | `se_front_r2` (L3) | the south-east front's distance to the service road R2 after 20 minutes (bands under 150, 150–300, 300–500, over 500 m; key 150–300 m; the CA gives ~237 m, the records ~380–400 m now) |

R2's meaning remains a pushed fact before V10 (`18` y.1); only the freeze item is gone.

- **V12 `front_toward`:** the "none" option now reads "Ei kummankaan, rintama jää metsäautotien taakse" (key Lahdenkylä unchanged).
- **V7 `lull_meaning`:** its distractors are now "Palo hidastuu, ja linjoja voidaan harventaa", "Osa lisäyksiköistä voidaan kotiuttaa illaksi" and "Palo kiihtyy uudella reunalla tuulen kääntyessä" (still no flare-up cue; key "the edges calm, the fire is not out").
- **V5 `wind_shift`:** the prompt names the wind: "Mikä palon reuna aktivoituu, jos tuuli alkaa puhaltaa **etelästä**?" (key: the north edge, from the forecast and the CA at step 9).
- **V14 `road_crossed`:** the basis now follows the re-tuned fire (the fire stops at the Honkaharju road at step 18, then crosses it in gusts 19:00–19:20 with EK16 withdrawing); the key is unchanged ("the road no longer stops the head").
- **Directive basis texts** (`demo-directive.ts`) read the figures they quote from the records at build time (`TRUTH`), so a regenerated corpus cannot leave a stale number in a basis.
- **Level balance** (supersedes y.6's balance): the relabelling of `fuel_ahead` and `cabins_distance` to L2 stands, but V2 and V10 now each have a second L3 item, so **every freeze again has 2 × L1, 2 × L2 and 2 × L3** (VP has four items). Phase A (V2, V4, V5, V7): 8 L1, 8 L2, 8 L3; phase B (V10, V12, V14): 6 / 6 / 6. **H2's phase-A window holds 16 L2/L3 items, as before the relabelling.**

### aa.2 The item table (generated from the bank, 8 Oct 2026)

> **Superseded by revision (ab) §ab.6** (regenerated 8 Oct 2026): rows V2 `area_40`, V4 `growth_next`, V5 `area_hour`, V10 `area_total_hour` and `front_r2`, V12 `village_distance` and V14 `se_front_r2` have report-keyed keys and bases.

Generated from `PRACTICE_BANK`, `FREEZE_BANK` and `infrastructureItem` (the views VP, V2, V4, V5, V7, V10, V12 and V14), in authored order; the build arranges the options. "Key" is the correct option's Finnish label. "Forecast steps" is `keySteps`. "Basis" is the bank's own text.

| View | Item | Level | Goal | Format | Key | Rule | Forecast steps | Basis |
|---|---|---|---|---|---|---|---|---|
| VP | `infra` | L1 | resources | choice | Käytettävissä, säiliöautot voivat täyttää sieltä | cited | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| VP | `head_now` | L1 | containment | map_point | map point | computed | — | the observed head W2 draws (observedHead.anchor) |
| VP | `first_target` | L2 | values | choice | Tie R1 | cited | — | EK11: the head runs north-east towards R1, 340 m away; Mökkiranta 2.1 km north-west, Lahdenkylä 3.0 km south-east |
| VP | `r1_arrival` | L3 | containment | choice | Yli tunnin kuluttua | computed | -3–-3 | distance from the W2 head to R1 (~340 m) ÷ the reported 3 m/min ≈ 110 min; the CA head is at R1 at 13:20 (step 1) |
| V2 | `infra` | L1 | resources | choice | Ei turvallinen ajaa, liekit tien reunassa | cited | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V2 | `ek11_point` | L1 | safety | map_point | map point | computed | — | EK11's step-3 position (UNIT_PLAN: edge:RIDGE, the new ignition on the esker) |
| V2 | `nearest_head` | L2 | safety | choice | Yksikkö EK11 | computed | — | the unit nearest the step-3 head, the next at least twice as far (EK11 on the esker, on the head's left flank ~50 m from it, FF5) |
| V2 | `fuel_ahead` | L2 | containment | choice | Kuusivaltaiseen havumetsään | cited | — | DR1's atom.demo.2.0 (step 2, pushed at 60 s, before the 105 s freeze; 6 Oct 2026, D2 b): dense spruce ~400 m ahead of the head (L2 since 8 Oct 2026: the key is on record; was not a key atom while L3, as an L3 key atom may only be a forecast, evt.wx.*); CYCLE_STORY 5–6: the head at the Kuusimäki spruce edge at 14:40, crown fire at 15:00; the CA head at 15:00 is within 400 m of SPR |
| V2 | `area_40` | L3 | containment | choice | 20–30 hehtaaria | computed | 3–4 | CA burnt area at the end of step 4 (14:40): ~23 ha, 3 ha from the 20 ha edge (bandOf); ~12.9 ha now (DR3, 14:15) |
| V2 | `head_later` | L3 | containment | map_point | map point | computed | 3–4 | the CA truth head at the end of step 4 (14:40); no projectionPoint: 14:40 is beyond V2's projection (its isochrones end at 40 minutes) |
| V4 | `infra` | L1 | resources | choice | Käytettävissä, säiliöautot voivat täyttää sieltä | cited | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V4 | `ek12_where` | L1 | safety | choice | R1:n ja R2:n risteyksessä | computed | — | EK12's step-6 position, ~60 m from the R1/R2 junction (withdrawn after the crown-fire near miss) |
| V4 | `fastest_spread` | L2 | containment | choice | Koillisessa (lohko L2) | cited | — | DR3: the Kuusimäki edge 14.1 m/min, flames over the crowns; the step-5 and step-6 CA growth is in L2 (checked in freeze-bank.spec.ts) |
| V4 | `work_danger` | L2 | safety | choice | Palo latvoissa, uusia pesäkkeitä syttyy eteen | cited | — | EK12: crown fire, spotting 200–400 m ahead; EK11 and EK12 withdraw (near miss) |
| V4 | `growth_next` | L3 | containment | choice | 15–30 hehtaaria | computed | 6–6 | CA area growth over step 6 (15:00–15:20, the crown run): ~23.5 ha, 6.5 ha from the 30 ha edge (bandOf) |
| V4 | `head_later` | L3 | containment | map_point | map point | computed | 6–6 | the CA truth head at the end of step 6 (15:20, the crown run); projectionPoint: V4's 40-minute isochrone (a breach view) |
| V5 | `infra` | L1 | resources | choice | Ajettavissa, ei paloa tien reunassa | cited | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V5 | `head_now` | L1 | containment | map_point | map point | computed | — | the observed head step 7 draws (observedHead.anchor) |
| V5 | `spot_cause` | L2 | containment | choice | Pistepaloja syttyi vartioimattomalle puolelle | cited | — | EK12: sparks flew over the Kuusimäki forest road and Korpioja; no units near |
| V5 | `units_enough` | L2 | resources | choice | Eivät, uusia paloja on jo linjojen takana | cited | — | EK11 asks for more units; spot fires beyond the lines with no units near |
| V5 | `wind_shift` | L3 | containment | choice | Pohjoisreuna | cited | 7–9 | the forecast (evt.wx.03, V4: SW -> S at 15.30-16.00; evt.wx.02 the front) and CA step 9 (wind from 160°): the new growth outside the head is in L1, north; CYCLE_STORY 9 'pohjoisreuna aktivoitunut' |
| V5 | `area_hour` | L3 | containment | choice | 110–140 hehtaaria | computed | 7–9 | CA burnt area at the end of step 9 (16:20): ~121.5 ha, 11.5 ha from the 110 ha edge (bandOf); ~56 ha now |
| V7 | `infra` | L1 | resources | choice | Käytettävissä, säiliöautot voivat täyttää sieltä | cited | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V7 | `ky21_where` | L1 | safety | choice | Siirtymässä pohjoisreunalle (lohko L1) | cited | — | KY21's step-10 radio (pushed before the freeze): moving to the north edge (L1) now; UNIT_PLAN edge:L1B from step 10 (its step-10 map symbol is the stale south-edge one) |
| V7 | `lull_meaning` | L2 | containment | choice | Reunat rauhoittuvat hetkeksi, palo ei ole ohi | cited | — | EK11: the wind easing and turning, smoke decreasing, sector 2 under control and sector 1 nearly (not out); EK11 at Koivuoja: glowing litter and small flames, still moving; the edges calm, the fire still burns (the CA flares up at the origin at step 12) |
| V7 | `why_north` | L2 | values | choice | Mökkirannan loma-asunnot ovat palon tiellä | cited | — | KY21 moves to L1B: 'Karhujärven mökit uhattuna'; EK14 asks whether the Mökkiranta cabins are checked |
| V7 | `rekindle_sector` | L3 | containment | choice | L3 Etelä | computed | 10–12 | the first CA detached front after step 10: step 12, ~120 m SE of the point of origin (6 Oct 2026: anchored to the burned edge, was ~200 m ESE), L3 (the old south edge flaring up; reported in V9) — the H10 anticipation key |
| V7 | `cabins_reach` | L3 | values | choice | Ei, ei tunnin aikana | computed | 10–12 | CA truth distance to CABINS at the ends of steps 10–12 (the hour from the freeze's now, 16:20; fix pass 4, was 11–13): ~1.7 km throughout |
| V10 | `infra` | L1 | resources | choice | Ajettavissa, palo ei ole tien lähellä | cited | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V10 | `south_front_point` | L1 | containment | map_point | map point | computed | — | the centroid of the detached front step 13 draws (reportedDetached) |
| V10 | `ek12_water` | L2 | resources | choice | EK12 jää linjalle, lisävesi tuodaan sen luo | cited | — | EK12 (step 13): water running low (25 %), it asked EK13 for a water run to a basin, due 17.41; EK13 confirms it brings the basin to the end of EK12's line: the crew stays on the flank |
| V10 | `area_total_hour` | L3 | containment | choice | 130–140 hehtaaria | computed | 13–15 | CA burnt area at the end of step 15 (18:20): ~135.8 ha, 4.2 ha from the 140 ha edge (bandOf); ~126 ha now (DR3, 17:35) |
| V10 | `front_r2` | L3 | containment | choice | 700–1000 metrin päässä | computed | 13–15 | CA south front's distance to R2 at the end of step 15 (18:20): ~907 m, 93 m from the 1 km edge (bandOf); now 'runsaan kilometrin' (DR2, pushed) |
| V10 | `cabins_distance` | L2 | values | choice | 1500–2500 metrin päässä | computed | — | CA truth distance to CABINS at the end of step 15 (~1.7 km: the north edge is held; the evening north-westerly drives the growth south-east); DR1 gives ~1600 m at 16:45 and 17:05 (L2 since 8 Oct 2026) |
| V12 | `f7` | L2 | safety | choice | Johto on jännitteinen, turvaetäisyydet ovat voimassa eikä vettä suunnata johtimiin | cited | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V12 | `longest_shift` | L1 | safety | choice | Yksikkö EK11 | cited | — | crew hours reported by step 17: EK11 6.8 h, EK14 5.3 h, KY21 4.7 h, EK15 2.3 h (checked against the corpus in freeze-bank.spec.ts) |
| V12 | `head_now` | L1 | containment | map_point | map point | computed | — | the observed head step 16 draws (observedHead.anchor) |
| V12 | `front_toward` | L2 | values | choice | Lahdenkylän | cited | — | SPOT (step 17): the head spreads south-east towards Lahdenkylä; the CA distance to VILLAGE falls 2.1 → 1.9 km over steps 16–17 |
| V12 | `village_distance` | L3 | values | choice | 1–2 kilometrin päässä | computed | 17–19 | CA truth distance to VILLAGE at the end of step 19 (~1.6 km; 2 Oct 2026, the rekindle at the origin) |
| V12 | `head_later` | L3 | containment | map_point | map point | computed | 17–18 | the CA truth head at the end of step 18 (19:20) |
| V14 | `infra` | L1 | resources | choice | Ei, silta ei kanna raskasta säiliöautoa | cited | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V14 | `shift_change` | L1 | safety | choice | EK11 ja VPK | cited | — | step 19: the next shift took over EK11's vehicle and line on R2; VPK returns to the line, its shift changed |
| V14 | `road_crossed` | L2 | containment | choice | Tie ei enää pysäytä palon kärkeä | cited | — | EK16: the fire stopped at the Honkaharju road (step 18), then the head crossed it in gusts, 19.00–19.20, EK16 withdrawing (step 19) (8 Oct 2026: the re-tuned fire model restores the stop) |
| V14 | `shift_meaning` | L2 | resources | choice | Uusi vuoro jatkaa samoilla autoilla, linjat pysyvät | cited | — | step 19: the next shift took over EK11's vehicle and line on R2, no gap; VPK back on the line, shift changed (researcher decision 7 Oct 2026) |
| V14 | `head_later` | L3 | containment | map_point | map point | computed | 20–20 | the CA truth head at the end of step 20 (20:00) |
| V14 | `se_front_r2` | L3 | containment | choice | 150–300 metrin päässä | computed | 20–20 | CA south-east front's distance to R2 at the end of step 20 (20:00): ~237 m, 63 m from the 300 m edge (bandOf); the records give ~380–400 m now (KY21, DR2) |

### aa.3 Attention check and per-item answer time (researcher decision, 8 Oct 2026)

- **Attention check.** The post-session questionnaire carries one instructed-response item (`attention.check`, a 1–7 scale, the same in every cell and in both languages): "To show you are reading carefully, choose "Disagree" (2) for this statement." The correct answer is the constant `ATTENTION_CHECK_CORRECT` = 2 (`questionnaire.ts`); `attentionCheckPassed(records)` (`derived-measures.ts`) is true, false (other value or blank) or null (no post questionnaire submitted). It is a §6.2 exclusion criterion of `09`, not a probe.
- **Too-fast freeze answers.** `tooFastFreezeAnswers(records, thresholdMs)` (`exclusions.ts`) lists the first answers given in under the threshold on the item, from the answers' `msSinceFreezeOpened` (the first item of a freeze counts from the freeze opening, later items from the previous item). Default threshold 1 500 ms (**pre-register**).

---

## Revision 8 Oct 2026 (ab) — numeric L3 keys are keyed on the reports; five keys moved; the table regenerated

Researcher decision D4 of 8 Oct 2026 (persona round 5) and the items fix pass 6 (`freeze-bank.ts`, `freeze-bank-b.ts`, `freeze-bank-core.ts`, `freeze-keys.ts`). Tests: `test/scenario/freeze-bank.spec.ts`, `freeze-items.spec.ts`. **Supersedes revision (aa) §aa.1's bands and keys for the items named below and replaces §aa.2's table (ab.4).**

### ab.1 Why: the reports lag the truth

A numeric L3 item keyed on the CA's later truth marks a participant against something the delivered reports lag (the thermal surveys describe the previous 20 minutes, `traffic-drones.ts`; the map's fire layer is drawn from the reports) and which a participant cannot know. **Numeric L3 items (areas, growth, distances) are now REPORT-keyed:** the key is the band that the reports delivered by the freeze imply at the asked clock. **Map and direction items stay truth-keyed** (a tap on the head, the sector of a rekindle, a settlement's direction): they ask where something is or will be, not a number the reports give.

### ab.2 The formula (`freeze-keys.ts`, "REPORT-keyed numeric L3 keys")

The delivered report series is the map's **reported fire** (`SiteStep.reported` and `reportedDetached`, the fire layer the reports draw), one point per 20-minute step up to the freeze's now step (the clock on screen). With `now` the now step and `t` the asked clock (the end of the asked step, `askedClockMin`), the line through the reports of the last two steps is read at `t`:

`v(t) = v(now) + (v(now) − v(now − 1)) · (t − now) / 20 min`

- the **burnt area** at `t` (`reportedAreaAt`) uses the reported perimeter plus detached parts;
- the **growth over the next 20 minutes** (`reportedGrowthHa`) is that slope itself;
- the **distance** of the reported fire to a point or a polyline (`reportedPointDistanceAt`, `reportedLineDistanceAt`) is read the same way;
- a **front first shown at the now step** has no earlier report: its distance is the reported distance now less the delivered head rate (`observedHead.rateMpm` of the now step) times the minutes to `t`, the front taken as closing straight on the line, not below zero (`reportedDetachedClosingAt`).

Every key is margin-checked at build (`bandOf`: a key lying closer than its minimum margin to a band edge fails the build).

### ab.3 The limitation, stated

A report-keyed key is **not the truth**: the CA fire is larger or smaller than the reports imply, and a participant who reasons beyond the reports (for example from the wind, or from knowing the lag) can be right about the fire and marked wrong. The truth-keyed items that remain (the map and direction items) carry the reverse risk: the key is what happened, which the reports did not yet say. The report lag is therefore a **stated limitation of the truth-keyed items**, and report-keying is a design choice that trades fidelity to the fire for fairness to the information given. Where the two keys disagree the table's basis says by how much (V10 `front_r2`: reported ~1117 m against the CA's ~902 m). Do not read an L3 numeric error as a failure of projection without this.

### ab.4 The keys that moved (old → new)

| View | Item | Was (aa) | Now (ab) | Bands and margin |
|---|---|---|---|---|
| V2 | `area_40` | 20–30 ha (truth ~23 ha) | **15–22 ha** (reported ~18.8 ha) | under 15 / 15–22 / 22–30 / over 30; 3.2 ha from the 22 edge |
| V4 | `growth_next` | 15–30 ha (truth ~23.5 ha) | **5–15 ha** (reported ~9.5 ha) | under 5 / 5–15 / 15–30 / over 30; 4.5 ha |
| V5 | `area_hour` | 110–140 ha | **110–140 ha unchanged** (reported ~128 ha; truth ~121.5 ha) | under 80 / 80–110 / 110–140 / over 140; 11.9 ha from the 140 edge (the bank's basis text says "18 ha from the 110 ha edge", which is the distance to the other edge) |
| V10 | `area_total_hour` | 130–140 ha (truth ~135.8) | **127–135 ha** (reported ~131 ha; the CA at HEAD gives ~133.6 ha at step 15, the old basis text's 135.8 was already stale) | under 127 / 127–135 / 135–145 / over 145; 4.0 ha |
| V10 | `front_r2` | 700–1000 m (truth ~907 m) | **over 1 000 m** (reported ~1 117 m; the CA front closes to ~902 m) | under 400 / 400–700 / 700–1000 / over 1000; 117 m |
| V12 | `village_distance` | 1–2 km (truth ~1.6 km) | **1.6–2 km** (reported ~1 776 m; the CA fire is ~1.7 km away) | under 1.2 km / 1.2–1.6 / 1.6–2 / over 2 km; 176 m |
| V14 | `se_front_r2` | 150–300 m (truth ~237 m) | **150–300 m unchanged** (reported ~229 m) | under 150 / 150–300 / 300–500 / over 500 m; 71 m |

### ab.5 Other item changes

- **V10 `south_front_point`** (L1, map point) has a **100 m tolerance** (was the L1 200 m): the front is a 0.8 ha patch, so 200 m would take in the old south edge. `point()` accepts a per-item `toleranceM`.
- **Plausible distractors** replace the old ones in **V10 `area_total_hour`** (the bands above, in place of 125 / 130 / 140) and **V12 `village_distance`** (bands of 1.2 / 1.6 / 2 km in place of 1 / 2 km); the 1.3× option-length rule of revision (y) still applies.
- **The questionnaire:** `tools.trust` asks about the information from "the Search tool (Haku): its search and its chat" and **names Haku** in both languages (`study-texts.ts`); it no longer reads as the AI tool.
- **Unchanged:** every freeze has 2 × L1, 2 × L2 and 2 × L3 (VP four items); the answer times and the confidence scale.

### ab.6 The item table (generated from the bank, 8 Oct 2026)

Generated again from `PRACTICE_BANK`, `FREEZE_BANK` and `infrastructureItem` with the generator of revision (aa) (`freeze-table.mts`: reads the banks, prints the table). "Key" is the correct option's Finnish label; "Forecast steps" is `keySteps`; "Basis" is the bank's own text, which for the seven report-keyed rows begins "REPORT-keyed (D4)". Only the rows of ab.4 differ from §aa.2's table.

| View | Item | Level | Goal | Format | Key | Rule | Forecast steps | Basis |
|---|---|---|---|---|---|---|---|---|
| VP | `infra` | L1 | resources | choice | Käytettävissä, säiliöautot voivat täyttää sieltä | cited | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| VP | `head_now` | L1 | containment | map_point | map point | computed | — | the observed head W2 draws (observedHead.anchor) |
| VP | `first_target` | L2 | values | choice | Tie R1 | cited | — | EK11: the head runs north-east towards R1, 340 m away; Mökkiranta 2.1 km north-west, Lahdenkylä 3.0 km south-east |
| VP | `r1_arrival` | L3 | containment | choice | Yli tunnin kuluttua | computed | -3–-3 | distance from the W2 head to R1 (~340 m) ÷ the reported 3 m/min ≈ 110 min; the CA head is at R1 at 13:20 (step 1) |
| V2 | `infra` | L1 | resources | choice | Ei turvallinen ajaa, liekit tien reunassa | cited | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V2 | `ek11_point` | L1 | safety | map_point | map point | computed | — | EK11's step-3 position (UNIT_PLAN: edge:RIDGE, the new ignition on the esker) |
| V2 | `nearest_head` | L2 | safety | choice | Yksikkö EK11 | computed | — | the unit nearest the step-3 head, the next at least twice as far (EK11 on the esker, on the head's left flank ~50 m from it, FF5) |
| V2 | `fuel_ahead` | L2 | containment | choice | Kuusivaltaiseen havumetsään | cited | — | DR1's atom.demo.2.0 (step 2, pushed at 60 s, before the 105 s freeze; 6 Oct 2026, D2 b): dense spruce ~400 m ahead of the head (L2 since 8 Oct 2026: the key is on record; was not a key atom while L3, as an L3 key atom may only be a forecast, evt.wx.*); CYCLE_STORY 5–6: the head at the Kuusimäki spruce edge at 14:40, crown fire at 15:00; the CA head at 15:00 is within 400 m of SPR |
| V2 | `area_40` | L3 | containment | choice | 15–22 hehtaaria | computed | 3–4 | REPORT-keyed (D4): the reported area at the end of step 4 (14:40) by linear extrapolation of the reports delivered by step 3, ~18.8 ha, 3.2 ha from the 22 ha edge (bandOf); the CA burns ~23 ha, ~12.9 ha now (DR3, 14:15) |
| V2 | `head_later` | L3 | containment | map_point | map point | computed | 3–4 | the CA truth head at the end of step 4 (14:40); no projectionPoint: 14:40 is beyond V2's projection (its isochrones end at 40 minutes) |
| V4 | `infra` | L1 | resources | choice | Käytettävissä, säiliöautot voivat täyttää sieltä | cited | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V4 | `ek12_where` | L1 | safety | choice | R1:n ja R2:n risteyksessä | computed | — | EK12's step-6 position, ~60 m from the R1/R2 junction (withdrawn after the crown-fire near miss) |
| V4 | `fastest_spread` | L2 | containment | choice | Koillisessa (lohko L2) | cited | — | DR3: the Kuusimäki edge 14.1 m/min, flames over the crowns; the step-5 and step-6 CA growth is in L2 (checked in freeze-bank.spec.ts) |
| V4 | `work_danger` | L2 | safety | choice | Palo latvoissa, uusia pesäkkeitä syttyy eteen | cited | — | EK12: crown fire, spotting 200–400 m ahead; EK11 and EK12 withdraw (near miss) |
| V4 | `growth_next` | L3 | containment | choice | 5–15 hehtaaria | computed | 6–6 | REPORT-keyed (D4): the reported area's growth over the next 20 minutes by extrapolation of the reports delivered by step 6, ~9.5 ha, 4.5 ha from the 5 ha edge (bandOf); the CA's crown run (15:00–15:20) grows ~23.5 ha |
| V4 | `head_later` | L3 | containment | map_point | map point | computed | 6–6 | the CA truth head at the end of step 6 (15:20, the crown run); projectionPoint: V4's 40-minute isochrone (a breach view) |
| V5 | `infra` | L1 | resources | choice | Ajettavissa, ei paloa tien reunassa | cited | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V5 | `head_now` | L1 | containment | map_point | map point | computed | — | the observed head step 7 draws (observedHead.anchor) |
| V5 | `spot_cause` | L2 | containment | choice | Pistepaloja syttyi vartioimattomalle puolelle | cited | — | EK12: sparks flew over the Kuusimäki forest road and Korpioja; no units near |
| V5 | `units_enough` | L2 | resources | choice | Eivät, uusia paloja on jo linjojen takana | cited | — | EK11 asks for more units; spot fires beyond the lines with no units near |
| V5 | `wind_shift` | L3 | containment | choice | Pohjoisreuna | cited | 7–9 | the forecast (evt.wx.03, V4: SW -> S at 15.30-16.00; evt.wx.02 the front) and CA step 9 (wind from 160°): the new growth outside the head is in L1, north; CYCLE_STORY 9 'pohjoisreuna aktivoitunut' |
| V5 | `area_hour` | L3 | containment | choice | 110–140 hehtaaria | computed | 7–9 | REPORT-keyed (D4): the reported area at the end of step 9 (16:20) by extrapolation of the reports delivered by step 7, ~128 ha, 18 ha from the 110 ha edge (bandOf); the CA burns ~121.5 ha; ~56 ha now |
| V7 | `infra` | L1 | resources | choice | Käytettävissä, säiliöautot voivat täyttää sieltä | cited | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V7 | `ky21_where` | L1 | safety | choice | Siirtymässä pohjoisreunalle (lohko L1) | cited | — | KY21's step-10 radio (pushed before the freeze): moving to the north edge (L1) now; UNIT_PLAN edge:L1B from step 10 (its step-10 map symbol is the stale south-edge one) |
| V7 | `lull_meaning` | L2 | containment | choice | Reunat rauhoittuvat hetkeksi, palo ei ole ohi | cited | — | EK11: the wind easing and turning, smoke decreasing, sector 2 under control and sector 1 nearly (not out); EK11 at Koivuoja: glowing litter and small flames, still moving; the edges calm, the fire still burns (the CA flares up at the origin at step 12) |
| V7 | `why_north` | L2 | values | choice | Mökkirannan loma-asunnot ovat palon tiellä | cited | — | KY21 moves to L1B: 'Karhujärven mökit uhattuna'; EK14 asks whether the Mökkiranta cabins are checked |
| V7 | `rekindle_sector` | L3 | containment | choice | L3 Etelä | computed | 10–12 | the first CA detached front after step 10: step 12, ~120 m SE of the point of origin (6 Oct 2026: anchored to the burned edge, was ~200 m ESE), L3 (the old south edge flaring up; reported in V9) — the H10 anticipation key |
| V7 | `cabins_reach` | L3 | values | choice | Ei, ei tunnin aikana | computed | 10–12 | CA truth distance to CABINS at the ends of steps 10–12 (the hour from the freeze's now, 16:20; fix pass 4, was 11–13): ~1.7 km throughout |
| V10 | `infra` | L1 | resources | choice | Ajettavissa, palo ei ole tien lähellä | cited | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V10 | `south_front_point` | L1 | containment | map_point | map point | computed | — | the centroid of the detached front step 13 draws (reportedDetached) |
| V10 | `ek12_water` | L2 | resources | choice | EK12 jää linjalle, lisävesi tuodaan sen luo | cited | — | EK12 (step 13): water running low (25 %), it asked EK13 for a water run to a basin, due 17.41; EK13 confirms it brings the basin to the end of EK12's line: the crew stays on the flank |
| V10 | `area_total_hour` | L3 | containment | choice | 127–135 hehtaaria | computed | 13–15 | REPORT-keyed (D4): the reported area at the end of step 15 (18:20) by extrapolation of the reports delivered by step 13, ~131 ha, 4 ha from the 127 and 135 ha edges (bandOf); the CA burns ~133.6 ha; ~126 ha now (DR3, 17:35) |
| V10 | `front_r2` | L3 | containment | choice | Yli kilometrin päässä | computed | 13–15 | REPORT-keyed (D4): the south front's reported distance to R2 now (~1327 m, 'runsaan kilometrin', DR2 pushed) less the delivered head rate (3.5 m/min) x 60 min, ~1117 m, 117 m from the 1 km edge (bandOf); the CA front closes to ~902 m |
| V10 | `cabins_distance` | L2 | values | choice | 1500–2500 metrin päässä | computed | — | CA truth distance to CABINS at the end of step 15 (~1.7 km: the north edge is held; the evening north-westerly drives the growth south-east); DR1 gives ~1600 m at 16:45 and 17:05 (L2 since 8 Oct 2026) |
| V12 | `f7` | L2 | safety | choice | Johto on jännitteinen, turvaetäisyydet ovat voimassa eikä vettä suunnata johtimiin | cited | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V12 | `longest_shift` | L1 | safety | choice | Yksikkö EK11 | cited | — | crew hours reported by step 17: EK11 6.8 h, EK14 5.3 h, KY21 4.7 h, EK15 2.3 h (checked against the corpus in freeze-bank.spec.ts) |
| V12 | `head_now` | L1 | containment | map_point | map point | computed | — | the observed head step 16 draws (observedHead.anchor) |
| V12 | `front_toward` | L2 | values | choice | Lahdenkylän | cited | — | SPOT (step 17): the head spreads south-east towards Lahdenkylä; the CA distance to VILLAGE falls 2.1 → 1.9 km over steps 16–17 |
| V12 | `village_distance` | L3 | values | choice | 1600–2000 metrin päässä | computed | 17–19 | REPORT-keyed (D4): the reported fire's distance to VILLAGE at the end of step 19 by extrapolation of the reports delivered by step 17, ~1776 m, 176 m from the 1600 m edge (bandOf); the CA fire is ~1.7 km away |
| V12 | `head_later` | L3 | containment | map_point | map point | computed | 17–18 | the CA truth head at the end of step 18 (19:20) |
| V14 | `infra` | L1 | resources | choice | Ei, silta ei kanna raskasta säiliöautoa | cited | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V14 | `shift_change` | L1 | safety | choice | EK11 ja VPK | cited | — | step 19: the next shift took over EK11's vehicle and line on R2; VPK returns to the line, its shift changed |
| V14 | `road_crossed` | L2 | containment | choice | Tie ei enää pysäytä palon kärkeä | cited | — | EK16: the fire stopped at the Honkaharju road (step 18), then the head crossed it in gusts, 19.00–19.20, EK16 withdrawing (step 19) (8 Oct 2026: the re-tuned fire model restores the stop) |
| V14 | `shift_meaning` | L2 | resources | choice | Uusi vuoro jatkaa samoilla autoilla, linjat pysyvät | cited | — | step 19: the next shift took over EK11's vehicle and line on R2, no gap; VPK back on the line, shift changed (researcher decision 7 Oct 2026) |
| V14 | `head_later` | L3 | containment | map_point | map point | computed | 20–20 | the CA truth head at the end of step 20 (20:00) |
| V14 | `se_front_r2` | L3 | containment | choice | 150–300 metrin päässä | computed | 20–20 | REPORT-keyed (D4): the reported fire's distance to R2 at the end of step 20 (20:00) by extrapolation of the reports delivered by step 20, ~229 m, 71 m from the 150 and 300 m edges (bandOf); the CA front is ~237 m; the records give ~380–400 m now (KY21, DR2) |

---

## Revision 9 Oct 2026 (ad) — V10's L3, V14's projection reading

Built in fix pass 7 (`freeze-bank-b.ts`, `freeze-keys.ts`, `freeze-bank-core.ts`). Tests: `freeze-bank.spec.ts`, `open-items-fixpass7.spec.ts`.

**V10 — a genuine L3 (`11` §7.20 item 1).** `front_direction` was replaced on 8 Oct; its successor `front_r2` ("…tunnin kuluttua") was still answerable by recall: the reported front is ~1327 m from R2 now, DR2's pushed 17:21 line says "runsaan kilometrin päässä tiestä", and the report-keyed hour-ahead value (~1117 m) lies in the same band ("Yli kilometrin päässä"). It is replaced by **`front_r2_2h`**: "Kuinka kaukana eteläinen palorintama on huoltotiestä R2 kahden tunnin kuluttua?", the same four options, key **700–1000 m** (report-keyed: ~1327 m less the delivered 3.5 m/min × 120 min ≈ 907 m, 93 m from the 1 km edge); the recalled "over a kilometre" is the lure. Truth-keyed it would be 400–700 m (the CA front crosses the forest road at 19.00–19.20): the stated lag of the report-keyed rule (`08` ab).

**V10 `area_total_hour`.** With L4 secured at 16:40 (`18` ad.4) DR3's 17:35 survey on record says 127.8 ha, inside the old 127–135 band; edges 128/135/145, key 128–135 (~131.8 ha, 3.2 ha from 135); the figure on record is the lure.

**V14 `se_front_r2` (`11` §7.20 item 2).** Edges 150/275/450 (were 150/300/500); key 150–275 (report-keyed ~229 m, 46 m from 275). The view's projection at 20:00 (its 40-minute isochrone) lies ~323 m from R2: band 275–450, 48 m from 275. That option is the item's **`projectionOptionId`** (TRUTH, never sent to the screen): an answer choosing it reads as projection-anchored (`projectionChoiceReliance`). V14 now has two projection readings (this and `head_later`, whose heads are ~106 m apart). Caveat: the distance on record now (DR2 ~380 m) lies in the projection's band, so in V14 "projection-anchored" also reads "did not extrapolate the reports".

**Level balance** stays 2 × L1, 2 × L2, 2 × L3 in every freeze; option lengths are balanced; no item names V14's flare-up.

---

## Revision 9 Oct 2026 (ag) — SPAM: no ready expiry, forced at the view's end, collapsible, the tools at hand

Researcher decisions, 9 Oct 2026; the full text is `27` revision (ag). For Type S this supersedes revision (u)'s "25 / 15 / 20 s, tools locked" and D4's tool lock.

- **Ready prompt:** at 25 s (V3, V6, V8, V11) and 45 s (VP), as before, but it **does not expire**; it can be collapsed to a pill and expanded (`spam_collapsed`, `spam_expanded`); the ready latency (from `spam_prompt_shown`) stays the workload index and may exceed 15 s.
- **Forced at the view's end:** a prompt still up when the view's time ends is answered before the view closes, as a modal step with the view's clock paused (`spam_ready` `forced`, `atViewSeconds`, `viewEndedBy`); its ready latency is **censored** there. A session interrupted during it resumes into it.
- **Answer window 60 s** (was 20 s), voluntary, forced and practice; a missing answer is logged null.
- **Tools:** Haku and the Thinker stay usable while the item is open; only the decision strip is held. SPAM now measures the commander-plus-tools' situation knowledge (the joint system), so a group difference reflects the tool difference (`27` ag.3).
- **Derived per probe** (`spam-measures.ts`): `readyCensored`, `forced`, `skipped`, `collapses`, `itemOpenMs`, and the tool use in the item's window (`toolQueries`, `hakuQueries`, `thinkerQueries`, `toolQueryIds`, `answeredAfterToolAnswer`); answer latency includes query time.
- **Analysis:** forced probes are analysed with and without (sensitivity); the ready latency as censored; tool use as a per-probe covariate (`27` ag.4; open with the supervisors, `11` §7.23).

---

## Revision 9 Oct 2026 (ai) — Type U closed: the V13 area item; the backup's confidence

Researcher decision, 9 Oct 2026: **no open-ended questions in the session.** Reviewed and approved with conditions by three professor reviewers (SA measurement, NDM / Paper 2, HCI / trust); the conditions are built in below, the dissent is recorded in `11` §7.25. Supersedes §3.5's open item, §4's "U, open" coding row and §8.4's floor-effect answer where they conflict. Build: `app/scenario/demo-probes.ts` (`AREA_OPTIONS`, `CONTRADICTION_AREA_KEY`), `app/session/visible-probes.ts`, `app/session/option-order.ts`, `VisibleProbeCard.tsx`; tests `test/session/{closed-items,visible-probes}.spec.ts`.

### ai.1 The V13 area item (replaces the open item, same moment)

Delivered as the open item was: V13 at 100 s (`U_OPEN_AT_SECONDS`), the clock stopped, Haku and the Thinker locked, the map in view.

- **(a)** *"Onko nykyisessä tilannekuvassa jotain, josta olet epävarma tai jonka haluaisit tarkistaa?"* / "Is there anything in the current picture you are unsure about or would want to check?" — **Kyllä / Ei** (yes / no).
- **(b) only after yes:** *"Mistä tilannekuvan osasta?"* / "Which part of the picture?" — any number of: Pohjoisreuna (north edge); Itäpuoli, vanhan kärjen puoli (east, the old head side); Kaakkoisrintama (south-east front); Länsipuoli ja suo (west and the bog); Yksiköiden sijainnit tai tila (unit positions or status); Sää (weather); Leviämisennuste (the spread projection); Muu (other). At least one part after yes; "no" takes none.
- **Non-leading, kept:** neither the question nor any option names a report, a record, a conflict or a contradiction (tested). The parts are regions and layers of the picture, not sources.
- **Order:** the seven parts are shuffled **once**, from the scenario seed (the project's PRNG, `option-order.ts`), so every participant sees the same order (the researcher's identical-stimulus rule; the SA reviewer's per-participant randomisation was not adopted, SPEC/11 §7.25); "other" is always last. The order is logged (`07` ai) and the key's position enters the analysis as a covariate. This is the one deliberate per-participant difference in what is shown; the option *set* is identical for everyone.
- **Key (TRUTH, invariant `contradiction.area_hit` = `north_edge`):** the contradiction is on the north edge — SPOT's *"Pohjoisreuna leimahtanut uudelleen, havaittu uutta savua ja liekkejä uran itäpuolella"* against EK14's *"Oma linjamme pitää, ei muutosta"* (EK14 holds the north flank; after the (ah) rebuild the flare-up is the north-edge holdover US2). **Area hit** = "yes" and the north edge among the parts; "no" or other parts only is a miss. Each part is analysed as its own binary indicator, never as a count.
- **Scoring caveat:** SPOT's text also says *"uran itäpuolella"* (east of the track); a participant who places it "east, the old head side" names the right event in the wrong part. Report the east-only share beside the hit; it is not a hit.
- **What is lost:** the four-category blind coding (specific / right area / unrelated / nothing) collapses to a recognition-assisted area hit. "Right area" is now the measure; "names the contradiction specifically" cannot be observed. The participants' own words are lost (`09` ai limitation).

### ai.2 The backup, with confidence

The V14 forced-choice backup (after the view) is unchanged in content and order, and now **collects a confidence** on the one scale (25/50/75/100), as the other probes do (`collectsConfidence: true`). It is labelled **recognition** in the analysis (`09` ai): the item shows the pair, so it cannot show detection.

### ai.3 Validation gates (§8.3), amended

- No probe takes free text.
- No V13 option names a report, a record, a conflict or a contradiction; "other" is last for every participant.
- The backup's distractors are checked against the pilot's V13 area choices and the backup's error pattern (no open responses exist).

## Revision 19 Oct 2026 (ax) — own and team understanding; the items of `30`

`30` §5 governs; the rules of (y), (aa) and (ab) stay for every item.

- **Phase-A freezes (V2, V4, V5, V7): 2×L1, 2×L2, 4×L3.** Two L3 items are added to each (`freeze-bank*.ts`; DRAFT until the domain review): consequences the envelope does not draw, report-keyed numeric keys with margins, truth-keyed map and direction items, the 1.3× option rule, no recall-answerable key, no cue of a keyed phase-B fact. H2's window is the 24 L2/L3 items of these freezes. Phase-B freezes (V10, V12, V14) keep 2/2/2.
- **V10 and V14: the freeze after the plan.** In the no-fit views the freeze's items name the deciding front (the south front and R2, the SE front and the crossed road) and would cue the plan; the freeze now runs after the view's plan is final and the plan-confidence item, before the next view, with the same blanking, items, records and scoring. `27` §4.3's cueing rule for SPAM thus applies to freezes. The other freeze views keep their pre-planned random moment (§4, `15` revision (r)).
- **SPAM: a second item at V3 (L2) and V6 (L3), answered with the tools at hand** (team understanding; (ag) already lets the tools stay usable). It follows the first item under the same "ready", probe id `<first id>.b`, its own 60 s window, answer and confidence; keys rest on records reachable with Haku or the Thinker (`SPAM_SECOND_KEY_ATOMS`). V8 and V11 keep one item (phase-B cueing). Own understanding (freeze, blanked) and team understanding (SPAM, tools) are read per participant; their difference is the hand-over index (`30` §6 H-T).
- **`keyStatements`** on every L2/L3 freeze item (fi/en regular-expression sources): how an AI answer would state the key, for the analysis-only `aiStatedKey` (`30` §5.3). Never shown.
- **Plan confidence:** after every main view's plan is final, "How confident are you that your plan fits the situation?", 25/50/75/100 (`30` §5.4).
- **Source memory (post-session):** seven session facts, each "Where did this come from for you?" — worked it out myself / a report, the message log or the map / Haku / the Thinker (Thinker cells only) / did not know (`30` §5.5; the replacement the 2 Oct 2026 withdrawal of the in-freeze source question named, `11` §7.15).
- **The eight new L3 items as built (19 Oct 2026, `freeze-bank.ts`, `freeze-bank-core.ts`; DRAFT until the domain review):**

| View | Item | Goal | Format | Key | Basis (forecast steps) |
|---|---|---|---|---|---|
| V2 | `spruce_behaviour` | containment | choice | Climbs into the crowns, throws embers ahead | CYCLE_STORY 14:40 and 15:00 (crown fire); no record names a crown fire by step 3 (3–6) |
| V2 | `junction_hour` | resources | choice | 400–700 m | report-keyed ~607 m, 93 m margin; the map shows ~950 m now (the lure) (3–5) |
| V4 | `crown_drops` | containment | choice | The broadleaf strip along Birch Creek (Koivuoja) | CYCLE_STORY 15:20; the wind turns only at step 8 (6–7) |
| V4 | `korpioja_spot` | containment | choice | No, embers start fires across the creek | step-7 radio: Korpioja crossed by sparks (6–7) |
| V5 | `ek14_shelter` | safety | choice | Move to safety in the burned area | forecast `evt.wx.03`; step-8 radio: EK14 withdraws downwind (7–8) |
| V5 | `road_jump` | containment | choice | No, embers cross it at another point too | step-8 radio: a second crossing on KY21's stretch (7–8) |
| V7 | `cp_safe` | safety | choice | No | computed: the fire stays ≥ ~760 m from the command post (the build fails under 300 m) (10–12) |
| V7 | `relief_next` | resources | choice | VOL1 (VPK) | crew hours on record; VPK asks for a relief unit at 16:4x (10–11) |

- **The SPAM second items as built** (`SPAM_SECOND_AUTHORED`, `SPAM_SECOND_KEY_ATOMS`): **V3 (L2)** "How has the fire's growth changed between the last two perimeter surveys?" — key "sped up, nearly twice as much new area" (DR3 14:15, recorded, 2.6 ha new; DR3 14:35, pushed, 4.8 ha); **V6 (L3)** "What will the state of road R1 be in an hour?" — key "Not safe to drive, flames at the roadside" (the forecast and the latest road report, "passable with care", the lure).
- **Source-memory facts as built** (`app/scenario/source-memory.ts`, all phase A): the head's ~10.6 m/min 14:00–14:20; the forecast's SE turn 15:30–16:00; 56.6 ha at 15:35; spot fire PP3/SF3 ~600 m ahead; EK15 at the command post ~16:20; EK14's petrol request; Lakeside Cottages on Bear Lake, north-west. Facts 1–3 are ones the AI would likely state, 4–6 only in records, 7 on the map; a test checks that no freeze, SPAM or hinge text states any of them.
- **Time:** about +2.5 min for the eight L3 items, +1.5 min for the two SPAM items, +2.5 min for fourteen plan-confidence clicks, +1.5 min for the source-memory block; `15` revision (ax) carries the budget.

## Revision 19 Oct 2026 (ay) — the SA probe audit decided (`31`)

`31` §2.1, §3.5–§3.10 govern. The rules of (y), (aa), (ab) and (ax) stay; these are added or restated:

- **Rules.** (1) A report-keyed key's basis is delivered by the freeze — drawn on the view's map or pushed — and a test checks it (sagat F01). (2) An L3 map key lies ≥ 2 × its tolerance from the head drawn at "now" (F03). (3) Every L3 stem names its horizon from "now" (F08). (4) Ordinal bands are shown in ascending order and band items are outside the position balance (F11). (5) Where the report-keyed and truth bands disagree, a dual-key sensitivity (credit either) is pre-registered; items are authored so they agree (`31` §3.5, RC). (6) **Rule (d) of revision (d) is restated:** no L3 key may be read off the screen — the envelope's drawn head is a lure read by `projectionReliance`, never a key — and every horizon lies within the scenario's data; the words "never about the fire's position at the envelope's horizon" are retired (the projection-reliance reading of fix pass 7 superseded them).
- **"Now".** y.1 stands: the screen's clock at the freeze. For a view-end freeze that is the view's end (V10 17:40, V12 19:00, V14 20:00); the header states it ("Kello pysähtyi klo …", DRAFT fi/en, native check; F13). V14's L3 items are report-keyed extrapolations without a truth band (nothing exists after 20:00).
- **V12's freeze runs after the plan** (coa F10): its items name Lahdenkylä and cue the aligned cell in a fit view. F7's key records (steps 6–8) and H3's view are untouched.
- **Items changed (DRAFT, domain review):** V4 `growth_next` re-authored (RC); V14 `se_front_r2` → a consequence item; V14 `head_later` → a non-map L3 item; V14 `shift_meaning` → life safety or values; SPAM V6.b re-authored on reachable records; the six phase-A L2 items (`nearest_head`, `fuel_ahead`, `work_danger`, `spot_cause`, `units_enough`, `why_north`) rewritten to integrate two records or relate one to a goal; `lull_meaning`, `ky21_where`, `front_toward`, `cabins_reach`, `cabins_distance`, `road_crossed` distractors replaced; `ek14_shelter` before `wind_shift` without "ennusteen mukaan"; `road_jump`, `cp_safe`, `cabins_reach` with two options per polarity; `relief_next` on an explicit pushed record; `cabins_distance` in the present tense; the R1 stretch named. The eight-item mix 2/2/4 and the 1.3× rule hold.
- **Source memory:** two false lure facts; `ai_likely` facts recorded-only and uncued; the scoring of overlapping sources defined (F17). Post-session: believability, recognition and prior demo/game items with exclusion rules; two perceived-reliability items (exploratory).
- **Analysis metadata on L3 items:** `basisAtomIds` and `basisKind` (record, map, knowledge, ca_truth), never in the session (`31` §3.9). `keyStatements` are tied to the element; `aiStatedKey` reads only answers after the basis record and in the freeze's view or the one before.
- **Tables.** The item tables of y.6, ab and ad are stale (V4 `ek12_where`, V10 127–135, V12 1600–2000, V14 150–300/275) and are regenerated by WP-2 from the bank; basis numbers are computed at build time (F22).
- **Time:** the cap is 240 s for 8-item freezes (worst case +1 min per phase-A freeze); the post-session additions ≈ +1.5 min (`15` (ay)).

## Revision 19 Oct 2026 (az) — the item table, regenerated

Generated with `npx tsx tools/review/freeze-table.ts` from the bank as built after WP-1 (records reworded, flame-length table) and WP-2 (items re-authored) were merged, 19 Oct 2026. **It replaces the tables of y.6, ab and ad.** Basis numbers are computed from the records at build time (F22), so the table is regenerated, never edited by hand. Items stay DRAFT for native and domain review (`31` §6). VP's forecast steps read −3 because the practice view runs on its own step index (−3).

| View | Item | Level | Goal | Format | Key | Rule | Forecast steps | Basis kind | Tags | Basis |
|---|---|---|---|---|---|---|---|---|---|---|
| VP | `infra` | L1 | resources | choice | Käytettävissä, säiliöautot voivat täyttää sieltä | cited | — | — | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| VP | `first_target` | L2 | values | choice | Tie R1 | cited | — | — | — | EK11: the head runs north-east towards R1, 340 m away; Mökkiranta 2.1 km north-west, Lahdenkylä 3.0 km south-east |
| VP | `r1_arrival` | L3 | containment | choice | Yli tunnin kuluttua | computed | -3–-3 | map | — | the drawn W2 head's distance to R1 (~339 m) ÷ its drawn rate (3.5 m/min) ≈ 97 min; the CA head is at R1 at 13.20 (step 1) |
| VP | `head_now` | L1 | containment | map_point | map point (200 m) | computed | — | — | — | the observed head W2 draws (observedHead.anchor) |
| V2 | `infra` | L1 | resources | choice | Ei turvallinen ajaa, liekit tien reunassa | cited | — | — | retrieval | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V2 | `ek11_between` | L2 | safety | choice | EK11 voi jäädä kärjen ja uuden palon väliin | cited | — | — | — | integrates EK11's move to the new ignition on the esker (radio 3.0, pushed), the new smoke ~150 m from the head (story 3.0, pushed) and EK11's own place ~50 m from the head on its left flank (14.03, pushed): a crew between the head and a fire ahead of it can be cut off (EK11's recorded 14.05 radio: it will not go between them) |
| V2 | `south_flank` | L2 | containment | choice | Reuna pysyy matalana, mutta kärki pääsee ohi | cited | — | — | — | integrates EK12's two pushed step-3 reports: flames 0.3–1 m, the edge held though it slips in places (14.06), and the head passing it to the north-east, low fire on its own stretch (14.08): the flank is held low while the head runs past; EK13 refilled EK12's basin at 13.54 (recorded) |
| V2 | `area_40` | L3 | containment | choice | 15–25 hehtaaria | computed | 3–4 | map | — | REPORT-keyed (D4; `31` rule (1)): the area at the end of step 4 (14.40) through the reported fire the maps of V1 and V2 draw (steps 1, 2), ~18.5 ha, 3.5 ha from the nearest band edge; the CA's truth ~23.0 ha, the same band; the map now ~10.6 ha and DR3's recorded 14.15 survey 12.9 ha (the lures, under 15) |
| V2 | `spruce_behaviour` | L3 | containment | choice | Nousee latvoihin ja heittää kipinöitä eteen | cited | 3–6 | knowledge | — | SPEC/30 §5.1 (DRAFT): CYCLE_STORY 5 (14:40) 'Kärki Kuusimäen kuusikon reunalla', 6 (15:00) 'Latvapalo alkanut ... kipinöintiä havaittu 200-400 m eteenpäin'; DR1 and DR3 at 15:05: flames over the crowns; the CA's achieved head rate ~38 m/min at step 6 (~10 m/min at step 3). No record to step 3 names a crown fire (freeze-bank.spec.ts) |
| V2 | `junction_hour` | L3 | resources | choice | 400–700 metrin päässä | computed | 3–5 | map | — | SPEC/30 §5.1 (DRAFT); REPORT-keyed (D4; `31` rule (1)): the reported fire's distance to the R1/R2 junction at the end of step 5 (15.00) through the maps of V1 and V2 (steps 1, 2), ~554 m, 146 m from the nearest band edge; the CA's truth ~627 m, the same band; the map now ~950 m (the lure, 700–1000 m) |
| V2 | `ek11_point` | L1 | safety | map_point | map point (200 m) | computed | — | — | — | EK11's step-3 position (UNIT_PLAN: edge:RIDGE, the new ignition on the esker) |
| V2 | `head_later` | L3 | containment | map_point | map point (300 m) | computed | 3–5 | ca_truth | — | the CA truth head at the end of step 5 (15:00); no projectionPoint: 15.00 is beyond V2's projection (its isochrones end at 40 minutes from 13.40) |
| V4 | `infra` | L1 | resources | choice | Käytettävissä, säiliöautot voivat täyttää sieltä | cited | — | — | retrieval | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V4 | `ek12_where` | L1 | safety | choice | Tiellä R1 palaneella alueella | computed | — | — | — | EK12's step-6 position, on R1 in the burned area, the safety zone (withdrawn after the crown-fire near miss; review fixes (ah): was the R1/R2 junction, ~1 km out in unburned forest) |
| V4 | `fastest_spread` | L2 | containment | choice | Koillisessa (lohko L2) | cited | — | — | — | DR3: the Kuusimäki edge 14.1 m/min, flames over the crowns; the step-5 and step-6 CA growth is in L2 (checked in freeze-bank.spec.ts) |
| V4 | `head_unattended` | L2 | containment | choice | Kärkeä ei sammuteta, se etenee vapaasti | cited | — | — | — | integrates the two pushed withdrawals to R1 in the black (radio 6.0, 6.1: the crown fire, the near miss) and EK11's pushed 15.02 'we wait on the road until the head calms': no crew works the head during the crown run (EK14 holds the north edge, VPK the origin, KY21 the south flank with 4 % water) |
| V4 | `return_danger` | L3 | safety | choice | Pistepalot, jotka syttyvät niiden taakse | cited | 6–7 | record | — | `31` F01 (DRAFT, RC; domain review): spotting 200–400 m ahead is on record (story 6.0, pushed); when the crown fire drops at Koivuoja (15.20) EK11 returns to the line and spot fire PP1 starts behind it beside its route to the vehicle, so it pulls its men out (step 7: DR1 15.28, EK11 15.30, pushed in V5). No record to step 6 names a spot fire behind a crew |
| V4 | `crown_drops` | L3 | containment | choice | Koivuojan varren lehtimetsässä | cited | 6–7 | knowledge | — | SPEC/30 §5.1 (DRAFT): CYCLE_STORY 7 (15:20) 'Latvapalo laskeutunut Koivuojan koivikkoon, pintapalo jatkuu'; the CA head is at BIRCH (the birch–aspen strip along Koivuoja) at the end of step 6; the wind turns only at step 8 (165°). Koivuoja is a map name, on record from step 7 |
| V4 | `korpioja_spot` | L3 | containment | choice | Ei, kipinät sytyttävät paloja ojan yli | cited | 6–7 | knowledge | — | SPEC/30 §5.1 (DRAFT): EK12's step-7 radio 'Kipinät lensivät Korpiojan yli, uusi palo toisella puolella' (pushed in V5); the CA crown run passes Korpioja's line during step 6 with a detached spot beyond it. Korpioja is a map name, on record from step 7 |
| V4 | `head_later` | L3 | containment | map_point | map point (300 m) | computed | 6–6 | ca_truth | — | the CA truth head at the end of step 6 (15:20, the crown run); projectionPoint: V4's 40-minute isochrone (a breach view) |
| V5 | `infra` | L1 | resources | choice | Ajettavissa, ei paloa tien reunassa | cited | — | — | retrieval | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V5 | `lines_breached` | L2 | containment | choice | Tie ja oja eivät enää rajaa paloa | cited | — | — | — | integrates the two pushed step-7 crossings (radio 7.1, 7.2: new fires on the far side of the Kuusimäki forest road and of Korpioja, no crew near, nothing done): neither line holds the fire any more |
| V5 | `hose_short` | L2 | resources | choice | Letkua on liian vähän kärjen perässä pysymiseen | cited | — | — | — | integrates EK11's pushed step-7 reports: the head runs past it to the north-east (15.24) and its 500 m line has under 200 m of hose in reserve, more hose asked for (15.36): the line cannot follow the head; EK11's tank is at 62 % (asked-only, 15.25) and the water shuttle runs, so water is not the limit |
| V5 | `ek14_shelter` | L3 | safety | choice | Siirryttävä turvaan palaneelle alueelle | cited | 7–8 | record | retrieval | SPEC/30 §5.1 (DRAFT): the forecast (evt.wx.03, recorded 15.03: SW → S → SE at 15.30–16.00); EK14's step-8 radio (pushed in V6): it withdraws to R1 in the middle of the burned area, the safety zone, because the turned wind leaves the north flank downwind. No record to step 7 says EK14 withdraws |
| V5 | `wind_shift` | L3 | containment | choice | Pohjoisreuna | cited | 7–9 | record | retrieval | the forecast (evt.wx.03, V4: SW -> S at 15.30-16.00; evt.wx.02 the front) and CA step 9 (wind from 140°): the new growth outside the head is in L1, north; CYCLE_STORY 9 'pohjoisreuna aktivoitunut' |
| V5 | `area_hour` | L3 | containment | choice | 110–140 hehtaaria | computed | 7–9 | record | — | REPORT-keyed (D4; `31` rule (1)): the pushed 15.35 survey (DR3: 56.6 ha, 23.8 ha new in 20 minutes; the map draws step 7) carried on to the end of step 9 (16.20), ~128.0 ha, 12.0 ha from the nearest band edge; the CA's truth ~119.9 ha, the same band; ~56 ha now |
| V5 | `road_jump` | L3 | containment | choice | Ei, kipinät ylittävät tien toisessakin kohdassa | cited | 7–8 | record | — | SPEC/30 §5.1 (DRAFT): the step-8 radio (pushed in V6) 'Kipinät lensivät metsäautotien (Kuusimäki) yli toisessa kohdassa, noin 400 m lounaaseen edellisestä ylityksestä ... KY21 yritti pitää linjan, mutta palo pääsi yli'; the first crossing, by sparks, is on record at step 7 (radio 7.1, pushed) |
| V5 | `head_now` | L1 | containment | map_point | map point (200 m) | computed | — | — | — | the observed head step 7 draws (observedHead.anchor) |
| V7 | `infra` | L1 | resources | choice | Käytettävissä, säiliöautot voivat täyttää sieltä | cited | — | — | retrieval | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V7 | `ky21_where` | L1 | safety | choice | Siirtymässä pohjoisreunalle (lohko L1) | cited | — | — | — | KY21's step-10 radio (pushed before the freeze): moving to the north edge (L1) now; UNIT_PLAN edge:L1B from step 10 (its step-10 map symbol is the stale south-edge one) |
| V7 | `lull_meaning` | L2 | containment | choice | Reunat rauhoittuvat hetkeksi, palo ei ole ohi | cited | — | — | — | EK11: the wind easing and turning, smoke decreasing, sector 2 under control and sector 1 nearly (not out); EK11 at Koivuoja: small flames in the moss, still moving; the edges calm, the fire still burns (the CA flares up at the origin at step 12) |
| V7 | `north_help` | L2 | resources | choice | EK14 saa pohjoisreunalle lisää miehistöä | cited | — | — | — | integrates KY21's and VPK's pushed moves to the north edge (radio 10.3, 10.4) with EK14's pushed move along it towards Karhujärvi (radio 10.1): the north edge, held by EK14 alone since 13.41, gets two more crews |
| V7 | `rekindle_sector` | L3 | containment | choice | L3 Etelä | computed | 10–12 | ca_truth | verification | the first CA detached front after step 10: step 12, ~120 m SE of the point of origin (6 Oct 2026: anchored to the burned edge, was ~200 m ESE), L3 (the old south edge flaring up; reported in V9) — the H10 anticipation key; `31` (a): a verification item (only VPK's recorded objection, ranked low for broad questions, warns of it) |
| V7 | `cabins_reach` | L3 | values | choice | Ei, matkaa on liikaa nykyisellä nopeudella | computed | 10–12 | ca_truth | — | CA truth distance to CABINS at the ends of steps 10–12 (the hour from the freeze's now, 16.20): ~1661 m throughout; the north edge runs north-west at ~5.3 m/min (DR3 16.25, pushed), ~320 m an hour; no sprinklers stand at the cabins |
| V7 | `cp_safe` | L3 | safety | choice | Ei, palo ja savu pysyvät siitä kaukana | computed | 10–12 | ca_truth | — | SPEC/30 §5.1 (DRAFT): CA truth distance to CP at the ends of steps 10–12: ~764 m and more (computed, cpSafeKey); the wind turns S, then WNW (evt.wx.04), away from the CP; EK11 at the CP at 16:4x (pushed in V8): 'ei paloa näköetäisyydellä, savua koilliseen'; the CP has never moved |
| V7 | `relief_next` | L3 | safety | choice | VPK:n miehistö | cited | 10–11 | record | — | SPEC/30 §5.1 (DRAFT; `31` F19): time on scene at 16.20 from pushed records only (VPK and EK12 'olemme olleet täällä' at 13.2x, EK14's and KY21's arrival radios): VPK 4.3 h, EK12 3.7 h, EK14 2.6 h, KY21 2.3 h; EK11 asks for relief at 4.5 h (16.26, pushed); VPK asks for a replacement unit at 16.53 (pushed in V8, 'linjalla 4,6 h ilman lepoa') |
| V10 | `infra` | L1 | resources | choice | Ajettavissa, palo ei ole tien lähellä | cited | — | — | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V10 | `ek12_water` | L2 | resources | choice | EK12 jää linjalle, lisävesi tuodaan sen luo | cited | — | — | — | EK12 (step 13): water running low (25 %), it asked EK13 for a water run to a basin, due 17.41; EK13 confirms it brings the basin to the end of EK12's line: the crew stays on the flank |
| V10 | `cabins_distance` | L2 | values | choice | 1500–2500 metrin päässä | computed | — | — | — | CA truth distance to CABINS at the view's end (17.40, the end of step 13): ~1661 m (the north edge is held); DR1 gives ~1600–1700 m at 16:45 and 17:05 |
| V10 | `area_total_hour` | L3 | containment | choice | 129–138 hehtaaria | computed | 14–16 | map | — | REPORT-keyed (D4; `31` rule (1)): the area at the end of step 16 (18.40, an hour from the view's end) through the reported fire the maps of V9 and V10 draw (steps 12, 13), ~131.6 ha, 2.6 ha from the nearest band edge; the CA's truth ~134.8 ha, the same band; the map now ~128 ha and DR3's recorded 17.35 survey 126 ha (the lures, under 129) |
| V10 | `front_r2_80` | L3 | containment | choice | 700–1000 metrin päässä | computed | 14–17 | map | — | REPORT-keyed (D4; `31` §3.8): the south front's reported distance to R2 at 17.20 (~1345 m, the front step 13 draws; 'runsaan kilometrin', DR2 pushed: the lure, over 1 km) less its drawn rate (4 m/min) × 100 min to 19.00, ~945 m, 55 m from the nearest band edge; the CA's truth ~802 m, the same band |
| V10 | `south_front_point` | L1 | containment | map_point | map point (100 m) | computed | — | — | — | the centroid of the detached front step 13 draws (reportedDetached) |
| V12 | `longest_shift` | L1 | safety | choice | Yksikkö EK11 | cited | — | — | retrieval | crew hours reported by step 17: EK11 6.8 h, EK14 5.3 h, KY21 4.7 h, EK15 2.3 h (checked against the corpus in freeze-bank.spec.ts) |
| V12 | `f7` | L2 | safety | choice | Johto on jännitteinen, turvaetäisyydet ovat voimassa eikä vettä suunnata johtimiin | cited | — | — | retrieval, verification | F7: the grid operator's log and HELI1's line clearance (`demo-probes.ts` F7_ITEM) |
| V12 | `front_toward` | L2 | values | choice | Lahdenkylän | cited | — | — | retrieval | SPOT (step 17): the head spreads south-east towards Lahdenkylä; the CA distance to VILLAGE falls 2.1 → 1.9 km over steps 16–17 |
| V12 | `village_distance` | L3 | values | choice | 1600–2100 metrin päässä | computed | 18–19 | record | — | REPORT-keyed (D4; `31` rule (1), §3.8): the distance at the end of step 19 (19.40, 40 minutes from the view's end) through the reported fire V12's map draws (step 16) and step 17's, which DR1's pushed 18.45 survey gives (2350 m), ~1920 m, 180 m from the nearest band edge; the CA's truth ~1747 m, the same band; the delivered ~2300–2350 m (the lure, over 2100) |
| V12 | `head_now` | L1 | containment | map_point | map point (200 m) | computed | — | — | — | the observed head step 16 draws (observedHead.anchor) |
| V12 | `head_later` | L3 | containment | map_point | map point (250 m) | computed | 18–20 | ca_truth | — | the CA truth head at the end of step 20 (20:00); no projectionPoint: 20.00 is beyond V12's projection (its isochrones end at 60 minutes from 18.20) |
| V14 | `infra` | L1 | resources | choice | Ei, silta ei kanna raskasta säiliöautoa | cited | — | — | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V14 | `shift_change` | L1 | safety | choice | EK11 ja VPK | cited | — | — | — | step 19: the next shift took over EK11's vehicle and line on R2; VPK returns to the line, its shift changed |
| V14 | `road_crossed` | L2 | containment | choice | Seuraava este kärjen edessä on tie R2 linjoineen | cited | — | — | — | integrates the stop at the Honkaharju road (KY21, radio 18.4), the crossing in gusts (EK16, radio 19.2) and EK16's line moving to R2 (radio 19.0), with KY21's (18.0): R2, the water-shuttle road, is the next barrier ahead of the head, the crews' lines on it; R2 stays drivable (DR2's road report, recorded) |
| V14 | `residents` | L2 | values | choice | Kylässä on yhä asukkaita, joten linjojen on pidettävä | cited | — | — | — | relates the police's pushed report (radio 18.6: two households refuse to leave, the police continue alone) and VPK's return to the line on R2 towards Lahdenkylä (radio 19.1) to the village: people remain behind R2's lines (DR1 sees people in at least three houses, recorded 19.26 and 19.46) |
| V14 | `se_front_r2` | L3 | containment | choice | Ei, rintama on silloin vielä satojen metrien päässä tiestä | computed | 21–21 | record | — | REPORT-keyed (`31` F02; no truth after 20.00): the nearest pushed distance (KY21 19.52, EK11 19.43: 550 m) less the fastest pushed rate of the south-east front (DR2 19.05: 10.1 m/min) × 20 min, ~348 m, against the ~100 m at which the sprinkler water goes on (EK11, pushed) |
| V14 | `flare_next` | L3 | containment | choice | Se laajenee kaakkoon tuulen mukana | cited | 21–23 | record | — | REPORT-keyed (`31` F03; no truth after 20.00; DRAFT, domain review): the flare-up still burns with visible flames, its smoke driven south-east towards Rahkasuo (story 20.1, pushed 19.42; story 19.2, pushed 19.23), in the north-westerly the map's wind arrow shows; unattended, a litter fire in that wind runs south-east (the V14 directive key's basis, `demo-directive.ts`) |

## Revision 20 Oct 2026 (ba) — trust and intrusiveness items (`32`)

- **S-TIAS** (McGrath et al. 2025, Front. Artif. Intell. 8:1582880, items 6, 10 and 11 of Jian et al.'s scale): "I am confident in X", "X is reliable", "I can trust X", 1 = not at all … 7 = extremely, averaged. X = the Search tool (every cell, `stias.tools.1–3`, where `tools.trust` stood) and Thinker (Thinker cells, `stias.thinker.1–3`). Finnish DRAFT: "Olen luottavainen X:n suhteen", "X on luotettava", "Voin luottaa X:ään"; translation and back-translation, native check (`32` §8).
- **`freeze.intrusiveness`**: "How much did the questions that stopped the exercise disrupt your work?" 1–7, after the S-TIAS block. DRAFT.
- §8.1's mention of `tools.trust` is superseded.

## Revision 23 Oct 2026 (be) — practice items, the map-reading pretest and the practice feedback (the difficulty audit)

Source: `docs/audits/2026-10-23-difficulty/` (`audit.md`; `proposal.md` (b); `proposal-map.md` (c)). The session side is `15` (be), the records `07` (be). **The scored bank is untouched**: no main freeze or SPAM item, option, key, told class or moment changes (the expert-identity test holds V1–V14's records byte for byte). The item-level fixes of `proposal-items.md` (V2 `junction_hour` and `area_40`, V4 `crown_drops`, V7 `cp_safe`, V10 `area_total_hour`, the `head_later` items, SPAM V6.b's stem) need the expert panel and are not made.

**1. The practice freeze's Haku-only item** (`freeze.practice.forecast`, L1, goal containment; `freeze-bank.ts` PRACTICE_BANK): "Mitä sääennuste lupaa iltapäivän tuulesta?" / "What does the weather forecast say about the afternoon wind?" Key "Lounaistuulta 4–6 m/s, puuskissa 8–10 m/s"; distractors "… iltapäivällä sadekuuroja", "Lounaistuuli voimistuu 10–12 m/s:iin, ukkosta", "Lounaistuuli heikkenee tyyneksi iltapäivällä". Its key record is the 12.00 forecast `evt.wx.01` (T2, recorded only, 12.07): no pushed VP record states a forecast, and every option agrees with the map's south-west wind arrow. The build checks the record still states the key's wind. `retrievalDependent` (as `31` F18 flags it). Practice only: not scored, the analysis drops it with VP.
- **For the panel:** the last distractor ("easing to calm in the afternoon") is near the forecast's "late in the afternoon … the wind turns to the south and eases"; it is false as worded (calm, south-west), but the panel may prefer a cleaner one. **Option B**, documented for the panel if A is judged too close to V5's wind items (`ek14_shelter`, `wind_shift`): the forest register `evt.vp.012` (T2) — "Mitä metsävararekisteri kertoo syttymäkohdan ympäristöstä?", key "Kuivaa mäntykangasta, maapohja kantaa koneet", distractors "Kosteaa korpea, koneet uppoavat" · "Nuorta kuusikkoa, maa kivikkoista" · "Ojitettua suota, turve kuivaa". A teaches the class of record the scored items most need (every forecast is recorded only) and so raises V5's wind items' AI-told share in both groups (`proposal.md` (g)); B teaches the rule without touching any scored item's basis.

**2. The practice measuring task** (`probe.s.practice.b`, `practice-measure.ts`): the second item of the practice SPAM delivery, under the same "ready": "Kuinka kaukana palosta on R3:n silta (Kotkanjoki)? Voit mitata Mittaa-työkalulla tai mittakaavajanalla." Options ascending: noin 1 / 3 / 5 / 8 km. The key is computed from the map — the bridge's mid-point is ~2.9 km from the point of origin and ~2.8 km from VP's drawn head, both "about 3 km", the next band ≥ 30 % farther (the build fails otherwise). No record states the distance and no scored item asks it (V14's bridge item asks the load limit). Practice only.

**3. The practice feedback** (`practice-feedback.ts`; after VP, before the training): SOURCE-ONLY for the practice-freeze items — where the information could be found (the message log with its messages' senders and times; the records through Haku, with an example question; the map; worked out from the log and the map), computed from the items' key records and VP's pushed set; never an option, never which was right (tested: no option label of any practice item reaches the screen). The two map tasks get skill feedback (`proposal-map.md` c.3): the head mark beside the head as VP's map drew it (the drawn outline's furthest point downwind, within 50 m of the practice key; the fire model's truth never reaches the screen), and the measured distance with how the measure tool works. This reads `32` §1 strictly for the questions (the source-only variant of `proposal.md` (g.3)); the map tasks' feedback is the researcher's request (RC: it shows the head and the distance; it can be reduced to the method alone).

**4. The map-reading pretest** (`proposal-map.md` c.2; built by `tools/review/map-pretest.ts`; `content/pretest/map-pretest.json`, the key `map-pretest.key.json`, a preview for the key checkers `docs/audits/2026-10-23-difficulty/map-pretest-preview.svg`):
- **The extract:** the study basemap's tile `0_3`, x 625–1250, y 0–625 (TM35 E 526 500–529 000, N 6 753 500–6 756 000), around Kaitajärvi, north-east of the incident and outside its extent; Kaitajärvi is named in no record, item or radio text (tested). The participant's language's tile (`topo-en` in English: "Narrow Lake"), a 4 × 4 grid of 625 m squares (A–D, 1–4; labels in the frame), the marks, a 500 m scale bar and a north arrow.
- **The items** (fixed order, options in a fixed order; keys COMPUTED from `topo-features.json`'s polygons, lines and elevation grid, each with a margin the build checks):

| Id | Skill | Stem (en) | Key (computed) and margin |
|---|---|---|---|
| `pretest.p1.square` | find a named place | In which square is the island in Narrow Lake? | B2; the island ≥ 60 px (240 m) from every grid line. The proposal's "southern end" is ambiguous on this extract (its shore runs across the C/D line, C4 or D4), so the rule falls back to the lake's one island |
| `pretest.p2.slope` | steeper slope | Which slope is steeper, at 1 or at 2? | 2 (4.7 % against 1.6 %, ratio 3.0 ≥ 2.5; contours near both) |
| `pretest.p3.water` | nearest water | Where is the nearest place to draw water for a pump at ★? | the small lake at the southern edge (105 m; Narrow Lake 326 m, ratio 3.1 ≥ 1.4; the nearest ditch 619 m). ★ is on the main road: the nearer water is the less salient one |
| `pretest.p4.area` | recognise a mire | What does area X show? | a drained mire (X 45 px inside the mire's edge, a ditch 10 px away) |
| `pretest.p5.distance` | distance by the scale | How far is it in a straight line from A to B? | 1 200 m (1 197 m; ± 3 % of the option, the next option 50 % off) |
| `pretest.p6.direction` | direction | In which direction is Narrow Lake from A? | north-east (the centroid at 40° from A, ≥ 20° from N/E/S/W; 94 % of the shore in that quadrant) |

  The proposal's rules are kept except where the extract forced a documented change: P1's fallback (above); ★ and A, B are on roads, not a house and a junction (every house on this extract stands on the lake shore, which would make P3 and P6 trivial or ambiguous); B is a road point at the target distance.
- **Administration:** one item at a time beside the extract, a choice final with "Next", no going back, a 4-minute cap for all six, no confidence item, no feedback, no score shown. Records `07` (be).
- **Use:** a covariate only — on the map-dependent freeze items (`items.csv` `map_dependence` required or helps) and on map-point error — never an exclusion criterion, never fed back (`09` (be)).
- **Before use (RC):** two people check the key file against the preview; a pilot with five novices (an item every one of them answers right gets new marks); a native check of the Finnish stems.

## Revision 24 Oct 2026 (bg) — the play-test decisions: one "now", stem cues, V10's area, F7's scoring, V12's head

Source: the play-test analysis `docs/audits/2026-10-23-playtest/analysis.md` §6 and the researcher's decisions of 24 Oct 2026 (D1–D8, D11), built in `freeze-bank.ts`, `freeze-bank-b.ts`, `freeze-bank-core.ts`, `freeze-keys.ts`, `freeze-key-statements.ts`, `demo-probes.ts` (the infrastructure prompts and F7's flag), `freeze-answers.ts`, `ui.ts` (`freezeNow`) and the scenario records (`18` (bg)). Tests: `test/scenario/freeze-{bank,items,rules,new-l3,table,key-statements}.spec.ts`, `test/session/freeze-screen.spec.ts`. **Supersedes y.1 and y.2 and the "now" bullet of (ay).** Items stay DRAFT for native and domain review; keys DRAFT until the panel confirms them (`11` §7.14).

### bg.1 One definition of "now" (D1, option (a))

- **The header** names the span of the period's latest reports — the view's last step, start to end — and defines "now" as the situation they give: fi "Jakson viimeisimmät tiedot kattavat klo 14.00–14.20. Kysymysten ”nyt” on tilanne niiden mukaan." / en "The period's latest reports cover 14.00–14.20. In the questions, “now” is the situation they give." (`freezeNowClock` returns the span: V2 14.00–14.20, V4 15.00–15.20, V5 15.20–15.40, V7 16.20–16.40, V10 17.20–17.40, V12 18.40–19.00, V14 19.40–20.00, VP 12.00–12.20). It replaces `31` F13's "Kello pysähtyi klo 14.00. ”Nyt” tarkoittaa tätä hetkeä.", which the L1/L2 keys contradicted: they rest on the last step's records, stamped up to 17 minutes after that clock and all delivered before the freeze. DRAFT, native check.
- **Phase-A L1/L2 stems** whose key rests on those later-stamped records say "viimeisimpien tietojen mukaan" for "nyt" / "tällä hetkellä": V2 `ek11_point`, `ek11_between`; V4 `ek12_where`, `fastest_spread`, `head_unattended`; V5 `head_now`, `lines_breached`, `hose_short`; V7 `ky21_where`, `lull_meaning`; the infrastructure slots of VP, V2, V4, V5 and V7 (W1, R1, W3). Phase B's freezes come at the view's end, where the screen's clock and the latest reports agree: their stems keep "nyt" (V10 `cabins_distance`, F29) and "tällä hetkellä" (V10 R2).
- **L3 horizons** are still counted from `nowStepOf` (y.1's base), and **every L3 stem now names its clock** next to the horizon, computed from the same base as the key (`horizonFi`, `withinHorizonFi`): "40 minuutin kuluttua (klo 14.40)", "seuraavan tunnin aikana (klo 15.00 mennessä)", "… tunnin kuluttua (klo 15.00)." for the map items. y.2's "projection prompts name no clock time" is withdrawn; no L1 or L2 stem names one (tested).
- **The L1 map items against the rule** (the key is the state at the header's "now" where the reports give it):
  - **V12 `head_now` re-keyed** to the fire model's head at 19.00 (`truthHeadAtEndOf(17)`, at the Honkaharju forest road, 32 m from its mid point), stem "Merkitse kartalle palon kärki viimeisimpien tietojen mukaan." Was the head the merged view's map draws at 18.20 (step 16), 370 m behind; all three play-test players were marked wrong there (327, 268, 278 m off), displaced towards the new key (the two marks on file re-measured: 81 and 125 m from it). Basis pushed: EK16's 18.41 radio (the head nears the forest road from the north-west at ~10 m/min); key records that radio and DR2's recorded 18.47 road report. Closes `11` §7.18's V12 item.
  - **V10 `south_front_point` re-keyed** to the fire model's front at the view's end (the centroid of step 13's truth front), 84 m from the 17.20 front the map draws, which still scores under the 200 m tolerance (D8, bg.5).
  - **V5 `head_now` keeps its key** (the head the 15.20 map draws), now with "viimeisimpien tietojen mukaan": the period's latest head reports put it there (EK11 15.24 at Koivuoja, 50 m away: "kärki menee ohitsemme koilliseen"). The fire model's 15.40 head (430 m on, the ember crossing of Koivuoja) is first reported in V6, so keying it would ask for unseen information.
  - **V2 `ek11_point`** keeps its key (EK11's step-3 position, from its 14.01 move); **VP `head_now`** keeps its key (the drawn head, 81 m from the 12.20 head; practice only).

### bg.2 Stem cues (D3; `sagat_rules.md`: no item reveals another's answer or unseen information)

- **V2 `ek11_between`** re-worded (chosen over moving `ek11_point` first: map items come last in every freeze, 2 Oct 2026, and the old stem would still state the 65 s burst's premise). fi "Mitä harjun tilanne merkitsee viimeisimpien tietojen mukaan kärjen lähellä työskenteleville miehistöille?" / en "According to the latest reports, what does the situation on the esker mean for the crews working near the head?" (was "Mitä harjun uusi palo merkitsee siellä työskentelevälle EK11:lle?"). It names the esker, a map place, but neither the new fire nor a unit. Options (key first): "Lähin miehistö voi jäädä kärjen ja harjun uuden palon väliin" / "The nearest crew can be caught between the head and the new fire on the esker"; "Harju hidastaa kärkeä, miehistöt voivat hyökätä sen edestä"; "Harju antaa miehistöille turvallisen perääntymistien"; "Harjun palo on sammunut, miehistöt palaavat kärkeen" (two speak of a fire on the esker, two of the esker itself). Key unchanged (`between`); key statements accept the crew by call sign or as the crew nearest the head; element patterns EK11, the esker, the crews.
- **V4 `head_unattended`** re-worded without the withdrawal: fi "Mikä on viimeisimpien tietojen mukaan kärjen sammutuksen tilanne?" / en "According to the latest reports, what is the state of the attack on the head?" (was "Mitä EK11:n ja EK12:n vetäytyminen tielle R1 merkitsee kärjelle nyt?"). Options: key "Kärkeä ei sammuteta, se etenee vapaasti" (unchanged); "EK11 ja EK12 hyökkäävät kärkeen sivustoilta" (the stale pre-15.00 state, new); "EK14 ja VPK sammuttavat kärkeä edestä" (was "… niiden tilalla", which presumed the withdrawal); "Kärki on rauhoittunut, ja työ jatkuu sivustoilla". "Kärki pysähtyy tiehen R1 palaneella alueella" is gone.
- **V4 `crown_drops`** has a basis on a surface: DR1's pushed 14.27 terrain line (V3, `18` (bg)) states the narrow birch–aspen strip along Koivuoja beyond Kuusimäki's spruce. `basisKind` record (was knowledge), `basisAtomIds` that line. The recall guard reads the crown fire dropping there, no longer any mention of the brook or its birch (`freeze-bank.spec.ts`).

### bg.3 V10's area item recast (D5)

`area_total_hour` (the total in an hour, 12-ha bands 143/155/167 whose scale revealed ~150 ha to anyone whose last pushed figure was 76.4 ha) is replaced by **`area_growth_hour`** (L3, containment, keySteps 14–16): fi "Kuinka paljon palanut ala kasvaa seuraavan tunnin aikana (klo 18.40 mennessä), uusi palo mukaan lukien?" / en "How much will the burnt area grow during the next hour (by 18.40), the new fire included?" Bands ascending: under 2 / 2–15 / 15–40 / over 40 ha. **TRUTH-keyed with a stated tolerance**: the fire model's growth 17.40 → 18.40 is 9.0 ha (163.8 − 154.8 ha), key **2–15 ha**, 6.0 ha from the nearest edge; the build fails if the truth comes within 2.5 ha of an edge. The reports' reading (the line through the areas V9's and V10's maps draw) gives 2.9 ha, the same band (no dual key). Basis: V9's pushed situation picture (152.6 ha at 17.05, `18` (bg)) and the new fire on V10's map; the lures: no growth (DR3's recorded 17.35 "reuna ei ole liikkunut missään") and phase A's pace carried on. `basisKind` record.

### bg.4 F7 scored for H9 only (D6)

V12's `freeze.12.f7` carries `scoredFor: "h9_only"` (analysis only, never on screen; the screen's whitelist drops it). `freezeItemScores` marks its score `inSaComposites: false` and `calibrationPairs` drops it, so no SA accuracy or calibration composite counts it (H1, H2 and its secondaries, H-T, the personal profile's calibration); H9 reads it as before (`plantedFalseValueHeld`). Its key ("the line is live") is the safety default an unexposed participant gives. `09` (bg).

### bg.5 Other changes

- **D8:** V10 `south_front_point`'s tolerance 100 m → **200 m**, the L1 rule (all three play-test players missed the 100 m at 112, 199, 203 m on the blank basemap).
- **D7:** V5 `ek14_shelter` and `wind_shift` rest on the 15.00 forecast **and its pushed headline** (P2 15.05, V4's second step; `18` (bg)); their `keyAtomIds` and `basisAtomIds` carry both, so neither is `retrievalDependent` any more. `ek14_shelter`'s passive class: yes (was no; the audit's hand table).
- **The key statements' sentence window** reads a full stop followed by a digit as inside the sentence ("klo 15.00", as AI answers write clocks), as the source-memory facts' windows do.
- **Recall guard** (`freeze-bank.spec.ts`): `area_growth_hour` checks that no record on hand states the hour's growth.


### bg.6 The item table (generated from the bank, 24 Oct 2026)

Generated with `npx tsx tools/review/freeze-table.ts` from the bank as built for the play-test decisions. **It replaces the table of revision (az).** Basis numbers are computed from the records at build time (F22), so the table is regenerated, never edited by hand. Items stay DRAFT for native and domain review. VP's forecast steps read −3 because the practice view runs on its own step index (−3).

| View | Item | Level | Goal | Format | Key | Rule | Forecast steps | Basis kind | Tags | Basis |
|---|---|---|---|---|---|---|---|---|---|---|
| VP | `infra` | L1 | resources | choice | Käytettävissä, säiliöautot voivat täyttää sieltä | cited | — | — | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| VP | `forecast` | L1 | containment | choice | Lounaistuulta 4–6 m/s, puuskissa 8–10 m/s | cited | — | — | retrieval | the Finnish Meteorological Institute's 12.00 local forecast (recorded only, T2, 12.07): south-west 4–6 m/s, gusts 8–10 m/s, dry in the afternoon |
| VP | `first_target` | L2 | values | choice | Tie R1 | cited | — | — | — | EK11: the head runs north-east towards R1, 340 m away; Mökkiranta 2.1 km north-west, Lahdenkylä 3.0 km south-east |
| VP | `r1_arrival` | L3 | containment | choice | Yli tunnin kuluttua | computed | -3–-3 | map | — | the drawn W2 head's distance to R1 (~339 m) ÷ its drawn rate (3.5 m/min) ≈ 97 min; the CA head is at R1 at 13.20 (step 1) |
| VP | `head_now` | L1 | containment | map_point | map point (200 m) | computed | — | — | — | the observed head W2 draws (observedHead.anchor) |
| V2 | `infra` | L1 | resources | choice | Ei turvallinen ajaa, liekit tien reunassa | cited | — | — | retrieval | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V2 | `ek11_between` | L2 | safety | choice | Lähin miehistö voi jäädä kärjen ja harjun uuden palon väliin | cited | — | — | — | integrates EK11's move to the new ignition on the esker (radio 3.0, pushed), the new smoke ~100 m from the head (story 3.0, pushed) and EK11's own place ~50 m from the head on its right flank (14.03, pushed): the crew nearest the head, between the head and a fire ahead of it, can be cut off (EK11's recorded 14.05 radio: it will not go between them). The distractors: the esker's dry pine heath speeds the head (10.8 m/min at 14.00–14.20, DR1), its new fire burns (no escape route there; EK11's is to the burned area), and nothing reports it out |
| V2 | `south_flank` | L2 | containment | choice | Reuna pysyy matalana, mutta kärki pääsee ohi | cited | — | — | — | integrates EK12's two pushed reports: the head some 300 m north of its stretch, running past it to the north-east (13.20), and its own stretch a surface fire in dry pine heath, flames 1–2 m, the 680 m line with pressure enough (14.08): the flank is held low while the head runs on past it; recorded: 'kärki etenee koilliseen meidän ohi, omalla pätkällämme matalaa paloa' (13.51); EK13 refilled EK12's basin at 14.01 (recorded; gate R: 13.54 before the shuttle drove on the road graph, and the re-seeded step 2 no longer has the 13.48 'lipsuu paikoin' line) |
| V2 | `area_40` | L3 | containment | choice | 20–35 hehtaaria | computed | 3–4 | map | — | REPORT-keyed (D4; `31` rule (1)): the area at the end of step 4 (14.40) through the reported fire the maps of V1 and V2 draw (steps 1, 2), ~24.8 ha, 4.8 ha from the nearest band edge; the CA's truth ~29.7 ha, the same band; the map now ~13.7 ha and DR3's recorded 14.15 survey 18.3 ha (the lures, under 20) |
| V2 | `spruce_behaviour` | L3 | containment | choice | Nousee latvoihin ja heittää kipinöitä eteen | cited | 3–6 | knowledge | — | SPEC/30 §5.1 (DRAFT): CYCLE_STORY 5 (14:40) 'Kärki Kuusimäen kuusikon reunalla', 6 (15:00) 'Latvapalo alkanut ... kipinöintiä havaittu 200-400 m eteenpäin'; DR1 and DR3 at 15:05: flames over the crowns; the CA's achieved head rate ~38 m/min at step 6 (~10 m/min at step 3). No record to step 3 names a crown fire (freeze-bank.spec.ts) |
| V2 | `junction_hour` | L3 | resources | choice | 400–700 metrin päässä | computed | 3–5 | map | — | SPEC/30 §5.1 (DRAFT); REPORT-keyed (D4; `31` rule (1)): the reported fire's distance to the R1/R2 junction at the end of step 5 (15.00) through the maps of V1 and V2 (steps 1, 2), ~573 m, 127 m from the nearest band edge; the CA's truth ~590 m, the same band; the map now ~950 m (the lure, 700–1000 m) |
| V2 | `ek11_point` | L1 | safety | map_point | map point (200 m) | computed | — | — | — | EK11's step-3 position (UNIT_PLAN: edge:RIDGE, the new ignition on the esker) |
| V2 | `head_later` | L3 | containment | map_point | map point (300 m) | computed | 3–5 | ca_truth | — | the CA truth head at the end of step 5 (15:00); no projectionPoint: 15.00 is beyond V2's projection (its isochrones end at 40 minutes from 13.40) |
| V4 | `infra` | L1 | resources | choice | Käytettävissä, säiliöautot voivat täyttää sieltä | cited | — | — | retrieval | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V4 | `ek12_where` | L1 | safety | choice | Tiellä R1 palaneella alueella | computed | — | — | — | EK12's step-6 position, on R1 in the burned area, the safety zone (withdrawn after the crown-fire near miss; review fixes (ah): was the R1/R2 junction, ~1 km out in unburned forest) |
| V4 | `fastest_spread` | L2 | containment | choice | Koillisessa (lohko L2) | cited | — | — | — | DR3: the Kuusimäki edge 14.1 m/min, flames over the crowns; the step-5 and step-6 CA growth is in L2 (checked in freeze-bank.spec.ts) |
| V4 | `head_unattended` | L2 | containment | choice | Kärkeä ei sammuteta, se etenee vapaasti | cited | — | — | — | integrates the two pushed withdrawals to R1 in the black (radio 6.0, 6.1: the crown fire, the near miss) and EK11's pushed 15.03 'we wait on the road until the head calms': no crew works the head during the crown run (EK14 holds the north edge, VPK is refilling at W1 and back on the origin at 15.15 — gate R: was on the origin from 15.00 —, KY21 the south flank with 4 % water) |
| V4 | `return_danger` | L3 | safety | choice | Pistepalot, jotka syttyvät niiden taakse | cited | 6–7 | record | — | `31` F01 (DRAFT, RC; domain review): spotting 200–400 m ahead is on record (story 6.0, pushed); when the crown fire drops at Koivuoja (15.20) EK11 returns to the line and spot fire PP1 starts behind it beside its route to the vehicle, so it pulls its men out (step 7: DR1 15.31, EK11 15.30, pushed in V5). No record to step 6 names a spot fire behind a crew |
| V4 | `crown_drops` | L3 | containment | choice | Koivuojan varren lehtimetsässä | cited | 6–7 | record | — | SPEC/30 §5.1 (DRAFT): DR1's pushed 14.27 terrain line (V3; play-test D3): beyond Kuusimäki's spruce a narrow strip of birch and aspen along Koivuoja (no figure; ~200 m on the fuel grids); CYCLE_STORY 7 (15:20) 'Latvapalo laskeutunut Koivuojan koivikkoon, pintapalo jatkuu'; the CA head is at BIRCH (the birch–aspen strip along Koivuoja) at the end of step 6; the wind turns only at step 8 (165°) |
| V4 | `korpioja_spot` | L3 | containment | choice | Ei, kipinät sytyttävät paloja ojan yli | cited | 6–7 | knowledge | — | SPEC/30 §5.1 (DRAFT): EK12's step-7 radio 'Kipinät lensivät Korpiojan yli, uusi palo toisella puolella' (pushed in V5); the CA crown run passes Korpioja's line during step 6 with a detached spot beyond it. Korpioja is a map name, on record from step 7 |
| V4 | `head_later` | L3 | containment | map_point | map point (300 m) | computed | 6–6 | ca_truth | — | the CA truth head at the end of step 6 (15:20, the crown run); projectionPoint: V4's 40-minute isochrone (a breach view) |
| V5 | `infra` | L1 | resources | choice | Ajettavissa varoen, matalaa paloa tien reunassa | cited | — | — | retrieval | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V5 | `lines_breached` | L2 | containment | choice | Korpiojan takana palaa uusi palo, jota kukaan ei sammuta | cited | — | — | — | integrates the pushed step-7 crossing (radio 7.2: a new fire on the far side of Korpioja, no crew near, nothing done) with where the crews are (EK11 at Koivuoja, pushed 15.24; EK12 and EK14 on R1 and the north edge): the fire beyond Korpioja burns with nobody on it, and the brook no longer bounds the fire |
| V5 | `hose_short` | L2 | resources | choice | Letkua on liian vähän kärjen perässä pysymiseen | cited | — | — | — | integrates EK11's pushed step-7 reports: the head runs past it to the north-east (15.24) and its 600 m line has under 200 m of hose in reserve, more hose asked for (15.35): the line cannot follow the head; EK11's tank is at 67 % (asked-only, 15.25; gate R: read from the record, was 63 % before the road-graph shuttle) and the water shuttle runs, so water is not the limit |
| V5 | `ek14_shelter` | L3 | safety | choice | Siirryttävä turvaan palaneelle alueelle | cited | 7–8 | record | — | SPEC/30 §5.1 (DRAFT): the forecast (evt.wx.03, recorded 15.03: SW → S → SE at 15.30–16.00; its headline pushed by P2 at 15.05 in V4, play-test D7); EK14's step-8 radio (pushed in V6): it withdraws to R1 in the middle of the burned area, the safety zone, because the turned wind leaves the north flank downwind. No record to step 7 says EK14 withdraws |
| V5 | `wind_shift` | L3 | containment | choice | Pohjoisreuna | cited | 7–9 | record | — | the forecast (evt.wx.03, V4: SW -> S at 15.30-16.00, its headline pushed by P2 at 15.05, play-test D7; evt.wx.02 the front) and CA step 9 (wind from 140°): the new growth outside the head is in L1, north; CYCLE_STORY 9 'pohjoisreuna aktivoitunut' |
| V5 | `area_hour` | L3 | containment | choice | 140–190 hehtaaria | computed | 7–9 | record | — | REPORT-keyed (D4; `31` rule (1)): the pushed 15.35 survey (DR3: 76.4 ha, 35.8 ha new in 20 minutes; the map draws step 7) carried on to the end of step 9 (16.20), ~183.8 ha, 6.2 ha from the nearest band edge; the CA's truth ~148.3 ha, the same band; ~77 ha now |
| V5 | `road_jump` | L3 | containment | choice | Ei, kipinät lentävät ojan yli ja sytyttävät uuden palon | cited | 7–8 | record | — | SPEC/30 §5.1 (DRAFT; SPEC/33 stage 9): the step-8 radio (pushed in V6) 'Kipinät lensivät Koivuojan yli, uusi palo toisella puolella. EK11 joutui vetäytymään' (15.20–15.40); delivered by the freeze: the surface fire stopped at Koivuoja at 15.00–15.20 (radio 7.3, pushed: the lure) and embers crossed Korpioja in the crown run (radio 7.2, pushed; gate R: VPK's return from W1 is radio 7.1 now) |
| V5 | `head_now` | L1 | containment | map_point | map point (200 m) | computed | — | — | — | the observed head step 7 draws (observedHead.anchor), at Koivuoja as EK11's pushed 15.24 report puts it |
| V7 | `infra` | L1 | resources | choice | Käytettävissä, säiliöautot voivat täyttää sieltä | cited | — | — | retrieval | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V7 | `ky21_where` | L1 | safety | choice | Siirtymässä pohjoisreunalle (lohko L1) | cited | — | — | — | KY21's step-10 radio (pushed before the freeze): moving to the north edge (L1) now; UNIT_PLAN edge:L1B from step 10 (its step-10 map symbol is the stale south-edge one) |
| V7 | `lull_meaning` | L2 | containment | choice | Reunat rauhoittuvat hetkeksi, palo ei ole ohi | cited | — | — | — | EK11: the wind easing and turning, smoke decreasing, sector 2 under control and sector 1 nearly (not out); EK11 at Koivuoja: small flames in the moss, still moving; the edges calm, the fire still burns (the CA flares up at the origin at step 12) |
| V7 | `north_help` | L2 | resources | choice | EK14 saa pohjoisreunalle lisää miehistöä | cited | — | — | — | integrates KY21's and VPK's pushed moves to the north edge (radio 10.3, 10.4) with EK14's pushed move along it towards Karhujärvi (radio 10.1): the north edge, held by EK14 alone since 13.41, gets two more crews |
| V7 | `rekindle_sector` | L3 | containment | choice | L3 Etelä | computed | 10–12 | ca_truth | verification | the first CA detached front after step 10: step 12, ~120 m SE of the point of origin (6 Oct 2026: anchored to the burned edge, was ~200 m ESE), L3 (the old south edge flaring up; reported in V9) — the H10 anticipation key; `31` (a): a verification item (only VPK's recorded objection, ranked low for broad questions, warns of it) |
| V7 | `cabins_reach` | L3 | values | choice | Ei, matkaa on liikaa nykyisellä nopeudella | computed | 10–12 | ca_truth | — | CA truth distance to CABINS at the ends of steps 10–12 (the hour from the freeze's now, 16.20): ~1667 m throughout; the north edge runs north-west at ~5.3 m/min (DR3 16.25, pushed), ~320 m an hour; no sprinklers stand at the cabins |
| V7 | `cp_safe` | L3 | safety | choice | Ei, palo ja savu pysyvät siitä kaukana | computed | 10–12 | ca_truth | — | SPEC/30 §5.1 (DRAFT): CA truth distance to CP at the ends of steps 10–12: ~795 m and more (computed, cpSafeKey); the wind turns S, then WNW (evt.wx.04), away from the CP; EK11 at the CP at 16:4x (pushed in V8): 'ei paloa näköetäisyydellä, savua koilliseen'; the CP has never moved |
| V7 | `relief_next` | L3 | safety | choice | VPK:n miehistö | cited | 10–11 | record | — | SPEC/30 §5.1 (DRAFT; `31` F19): time on scene at 16.20 from pushed records only (VPK and EK12 'olemme olleet täällä' at 13.2x, EK14's and KY21's arrival radios): VPK 4.3 h, EK12 3.7 h, EK14 2.6 h, KY21 2.3 h; EK11 asks for relief at 4.5 h (16.26, pushed); VPK asks for relief at 16.52 (pushed in V8) |
| V10 | `infra` | L1 | resources | choice | Ajettavissa, palo ei ole tien lähellä | cited | — | — | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V10 | `ek12_water` | L2 | resources | choice | EK12 jää linjalle, lisävesi tuodaan sen luo | cited | — | — | — | EK12 (step 13, on the south-east flank by R1): water running low (25 %), it asked EK13 for a water run to a basin, due 17.41 (the road route from VPK's line, 1.5 km; was 17.43 on the north spur before gate R R1/R3); EK13 confirms it brings the basin to the end of EK12's line: the crew stays on the flank |
| V10 | `cabins_distance` | L2 | values | choice | 1500–2500 metrin päässä | computed | — | — | — | CA truth distance to CABINS at the view's end (17.40, the end of step 13): ~1667 m (the north edge is held); DR1 gives ~1600–1700 m at 16:45 and 17:05 |
| V10 | `area_growth_hour` | L3 | containment | choice | 2–15 hehtaaria | computed | 14–16 | record | — | TRUTH-keyed with a stated tolerance (play-test D5): the CA's growth 17.40 → 18.40 (the ends of steps 13 and 16) ~9.0 ha, 6.0 ha from the nearest band edge (≥ 2.5 ha required); the reports' line through the areas V9's and V10's maps draw (steps 12, 13) gives ~2.9 ha, the same band; the base: V9's pushed situation picture (152.6 ha at 17.05) and the new fire on V10's map (DR2's recorded 17.25 thermal ~1.0 ha); the lures: no growth (DR3's recorded 17.35 'no edge moved', under 2 ha) and phase A's pace carried on (over 40 ha) |
| V10 | `front_r2_80` | L3 | containment | choice | 650–950 metrin päässä | computed | 14–17 | map | — | REPORT-keyed (D4; `31` §3.8): the south front's reported distance to R2 at 17.20 (~1319 m, the front step 13 draws; 'runsaan kilometrin', DR2 pushed: the lure, over 950 m) less its drawn rate (4.5 m/min) × 100 min to 19.00, ~869 m, 81 m from the nearest band edge; the CA's truth ~746 m, the same band |
| V10 | `south_front_point` | L1 | containment | map_point | map point (200 m) | computed | — | — | — | the centroid of the CA's detached front at the end of step 13 (17.40, the view's end): 84 m from the front step 13 draws (17.20), which SPOT (17.01, 120 m SE of the origin) and DR2 (17.21, spreading east) place |
| V12 | `longest_shift` | L1 | safety | choice | Yksikkö EK11 | cited | — | — | retrieval | crew hours reported by step 17: EK11 6.8 h, EK14 5.3 h, KY21 4.7 h, EK15 2.3 h (checked against the corpus in freeze-bank.spec.ts) |
| V12 | `f7` | L2 | safety | choice | Johto on jännitteinen, turvaetäisyydet ovat voimassa eikä vettä suunnata johtimiin | cited | — | — | retrieval, verification, h9_only | F7: the grid operator's log and HELI1's line clearance (`demo-probes.ts` F7_ITEM) |
| V12 | `front_toward` | L2 | values | choice | Lahdenkylän | cited | — | — | retrieval | SPOT (step 17): the head spreads south-east towards Lahdenkylä; the CA distance to VILLAGE falls 2.1 → 1.9 km over steps 16–17 |
| V12 | `village_distance` | L3 | values | choice | 1600–2100 metrin päässä | computed | 18–19 | record | — | REPORT-keyed (D4; `31` rule (1), §3.8): the distance at the end of step 19 (19.40, 40 minutes from the view's end) through the reported fire V12's map draws (step 16) and step 17's, which DR1's pushed 18.45 survey gives (2350 m), ~1940 m, 160 m from the nearest band edge; the CA's truth ~1753 m, the same band; the delivered ~2300–2350 m (the lure, over 2100) |
| V12 | `head_now` | L1 | containment | map_point | map point (200 m) | computed | — | — | — | the CA truth head at the end of step 17 (19.00, the view's end), 32 m from the Honkaharju forest road's mid point and 370 m from the head step 16 draws; EK16's pushed 18.41 radio puts the head near the road, closing from the north-west at ~10 m/min |
| V12 | `head_later` | L3 | containment | map_point | map point (250 m) | computed | 18–20 | ca_truth | — | the CA truth head at the end of step 20 (20:00); no projectionPoint: 20.00 is beyond V12's projection (its isochrones end at 60 minutes from 18.20) |
| V14 | `infra` | L1 | resources | choice | Ei, silta ei kanna raskasta säiliöautoa | cited | — | — | — | direct report (`demo-probes.ts` INFRA_SCHEDULE) |
| V14 | `shift_change` | L1 | safety | choice | EK11 ja VPK | cited | — | — | — | step 19: the next shift took over EK11's vehicle and line on R2; VPK returns to the line, its shift changed |
| V14 | `road_crossed` | L2 | containment | choice | Seuraava este kärjen edessä on tie R2 linjoineen | cited | — | — | — | integrates the stop at the Honkaharju road (KY21, radio 18.4), the crossing in gusts (EK16, radio 19.2) and EK16's line moving to R2 (radio 19.0), with KY21's (18.0): R2, the water-shuttle road, is the next barrier ahead of the head, the crews' lines on it; R2 stays drivable (DR2's road report, recorded) |
| V14 | `residents` | L2 | values | choice | Kylässä on yhä asukkaita, joten linjojen on pidettävä | cited | — | — | — | relates the police's pushed report (radio 18.6: two households refuse to leave, the police continue alone) and VPK's return to the line on R2 towards Lahdenkylä (radio 19.1) to the village: people remain behind R2's lines (DR1 sees people in at least three houses, recorded 19.26 and 19.46) |
| V14 | `se_front_r2` | L3 | containment | choice | Ei, rintama on silloin vielä satojen metrien päässä tiestä | computed | 21–21 | record | — | REPORT-keyed (`31` F02; no truth after 20.00): the nearest pushed distance (KY21 19.52, OUT1 19.56: 500 m) less the fastest pushed rate of the south-east front (DR2 19.05: 11.5 m/min) × 20 min, ~270 m, against the ~100 m at which the sprinkler water goes on (OUT1, pushed; gate R: was KY21's line) |
| V14 | `flare_next` | L3 | containment | choice | Se laajenee kaakkoon tuulen mukana | cited | 21–23 | record | — | REPORT-keyed (`31` F03; no truth after 20.00; DRAFT, domain review): the flare-up still burns with visible flames, its smoke driven south-east towards Rahkasuo (story 20.1, pushed 19.42; story 19.2, pushed 19.23), in the north-westerly the map's wind arrow shows; unattended, a litter fire in that wind runs south-east (the V14 directive key's basis, `demo-directive.ts`) |

## Revision 25 Oct 2026 (bh) — the replay's decisions: clock-only horizons, V4's exploratory head, V10's road, VP's arrival time, the brook's name, V5's bands, SPAM V3.b

Source: the play-test replay (`docs/audits/2026-10-23-playtest/analysis.md` §10, `items-replay.csv`) and the researcher's decisions of 25 Oct 2026 (R1–R5, R7–R9; bugs B3, B4, B9), built in `freeze-bank-core.ts`, `freeze-bank.ts`, `freeze-bank-b.ts`, `freeze-readings.ts` (new: the readings and guards of `r1_arrival` and `area_hour`), `demo-probes.ts`, `freeze-key-statements.ts`, `labels.en.json` and the records (`18` (bh)). Tests: `test/scenario/{freeze-rules,freeze-bank,freeze-new-l3,playtest-r-decisions}.spec.ts`, `test/telemetry/freeze-measures.spec.ts`, `test/profile/profile{,-screen}.spec.ts`. Items stay DRAFT for the native and domain review; keys DRAFT until the panel confirms them (`11` §7.34).

### bh.1 L3 stems state the clock only (R1)

Supersedes bg.1's third bullet. Every L3 stem names the clock its key is read at and nothing else — fi "klo 14.40" / "klo 15.40 mennessä", en "at 14.40" / "by 15.40" (`horizonFi`, `withinHorizonFi`, `headLaterFi`); the minutes ("40 minuutin kuluttua (klo 14.40)") are gone. They were counted from `nowStepOf`, the start of the header's span in phase A and its end in phase B, so in phase A they contradicted the header's "now" (the span's end) by one step. **No key changes**: the clock is the one each key was read at. Examples: V2 `area_40` "Kuinka suuri koko palanut ala on klo 14.40?" / "How large will the whole burnt area be at 14.40?"; V5 `ek14_shelter` "Mitä pohjoisreunalla työskentelevän EK14:n on todennäköisesti tehtävä klo 16.00 mennessä?" / "What will EK14, working on the north edge, most likely have to do by 16.00?"; V12 `head_later` "Merkitse kartalle, missä palon kärki on klo 20.00." Tested: every L3 stem contains its key's clock and no "kuluttua", "aikana" or bracketed clock (`freeze-rules.spec.ts`).

**The real horizon** from the header's "now" is the difficulty audit's new column `horizon_min` (`docs/audits/2026-10-23-difficulty/items.csv`; the summary's horizon table). Phase A's are 20 minutes shorter than the old stems said: V2 `area_40` 20, `junction_hour` and `head_later` 40, `spruce_behaviour` 60; V4 `return_danger`, `crown_drops`, `korpioja_spot` 20 and **`head_later` 0** (its 15.20 is the span's end: it asks the fire model's head "now", not a projection); V5 20 and 40; V7 20 and 40. Phase B's are unchanged (V10 60 and 80, V12 40 and 60, V14 20 and 60).

### bh.2 V4 `head_later` exploratory (R2)

`scoredFor: "exploratory"` (bg.4's mechanism extended): scored and reported as an exploratory item. `freezeItemScores` marks its score `inSaComposites: false` and names its `scoredFor`; `calibrationPairs`, through which H2, H2r, H2t, H-T and the personal profile's calibration fold, never counts it. H2's window is **23 items** (was 24). It stays so until the expert panel decides (`11` §7.34): 0/5 play-test runs, 378–792 m short, all to the south-west.

**The rate check** (asked with R2): the pushed DR1 15.05 / DR3 15.06 "noin 14,1 m/min (klo 14.40–15.00)" is the fire model's own step-5 rate (achieved 14.1, authored 14 m/min), so the record does not contradict the model for the interval it measures. The key's interval, 15.00–15.20, is the crown run, authored 30 m/min and **achieved 38.1 m/min**: the key head lies 759 m from the 15.00 head (37.9 m/min) and 1040 m from the head V4's map draws (14.40; 26 m/min over 40 minutes), while 14.1 m/min carries the head 280 m in 20 minutes (560 m from the drawn head). No record before the freeze quantifies the acceleration (the crown fire and embers 200–400 m ahead are pushed at 15.00–15.06); V5's DR1 15.25 then reports 980 m in 15.00–15.20 (49 m/min with the spot-fire jumps, ~30 m/min for the continuous edge). The record is not changed: whether the model's 38 m/min (27 % over the authored 30) is realistic for this spruce at 8 m/s is the panel's fire-realism question.

### bh.3 V10 `infra` asks a plain current state (R3)

DR2's pushed 17.21 line reads "Huoltotie R2 ajettavissa, uusi palo runsaan kilometrin päässä tiestä." / "Service road R2 is passable; the new fire is a good kilometre from the road." (was "vielä ajettavissa" / "still passable", which every play-test run read as "for now" and paired with option c). Option c `threatened` "Ajettavissa toistaiseksi, mutta palo uhkaa tietä" → **`with_care` "Ajettavissa varoen, matalaa paloa tien reunassa"** / "Passable with care, low fire at the roadside" (the R1 slot's wording). It is false at 17.40 by the records and the fire model: the new front is 1.1–1.2 km from R2 and the old fire, held and cold, ~490 m; the drones write that state only within 60 m of a burning edge (`traffic-drones.ts`). The researcher's example "Ajettavissa vain varoen, savua tiellä" was not used: DR3's recorded 17.21 plume line has smoke settling east of the fire with visibility 200–500 m there, so a smoke state on R2 is not clearly false. Key unchanged (`open`).

### bh.4 VP `r1_arrival` asks a time of day (R4)

fi "Mihin aikaan palon kärki saavuttaa tien R1, jos se etenee nykyistä vauhtia?" / en "At what time will the head of the fire reach road R1 if it keeps its current rate?" (was "Kuinka pian …", minutes from now, whose 60-minute edge the readings straddled). Bands, ascending: "Ennen klo 12.50" / "Klo 12.50–13.10" / "**Klo 13.10–13.40**" / "Klo 13.40 jälkeen" (ids `lt1250` … `gt1340`, so the build shows them in order). **Build guard** (`freeze-readings.ts` `R1_ARRIVAL`): three readings inside the key band, each at least 2 minutes from its edges — the pushed figures (EK11 12.01: "Kärjestä tielle R1 noin 320 m", "noin 4 m/min") **13.21**; the head and rate mark VP's map draws (12.00; 339 m at 3.5 m/min) **13.37**; the fire model at R1 **13.20** (the first state the bundle holds at R1, step 1's fire; the 12.20 truth is 248 m short). For the panel: the CA run (`fire-ca.json`, not in the bundle) has the fire 34 m short at 13.00 and across at 13.20 (`freeze-bank.spec.ts`), so the crossing falls in 13.00–13.20 — about 13.04 at that step's 8 m/min, in the band below the key; read at step resolution, as every key is, it is 13.20. Practice only, never scored; the key records stay empty (its practice feedback is "worked out").

### bh.5 The brook is Myllyoja / Mill Brook (R5)

Korpioja / "Alder Creek" was confusable with Koivuoja / "Birch Creek" in both languages (`analysis.md` §10.3 f). Renamed **Myllyoja** / **"Mill Brook"**: no "Ko-" start; no other name in the contract or `place-names.ts` begins "Myl" or contains "Mill" (tested). Changed in V4 `korpioja_spot` ("Pysäyttääkö Myllyoja palon kärjen etenemisen klo 15.40 mennessä?"; its English options now say "brook", not "creek", which belongs to Birch Creek), V5 `lines_breached` (stem and options), the basis texts, the key and element statements, the briefing's L1 sector text ("Myllyojan laakso" / "the Mill Brook valley") and the records and map (`18` (bh), `12` (bh)). The slug `korpioja_spot` is kept (a logged id).

### bh.6 V5 `area_hour` re-banded (R8)

Edges **90/130/190** (were 90/140/190): "Alle 90" / "90–130" / "**130–190**" / "Yli 190 hehtaaria". The key and the reports' reading are unchanged (76.4 + 3 × 35.8 ≈ 184 ha, 6.2 ha from 190); the fire model's 148.3 ha now lies 18.3 ha from the nearest edge (was 8.3 ha above 140, where four of five play-test runs chose 90–140 with an expert's slowdown). **Guard**, as `area_growth_hour`'s: the truth must lie at least 10 % of its value from every edge (≥ 14.8 ha), else the build fails. Why 10 %: it is about two thirds of one 20-minute step of the fire's growth that hour (~24 ha a step, 72 ha in three), so an estimate that slows the spread by less than that cannot cross an edge near the truth; and twice the reports' 5 ha margin. Four bands kept; the scale still spans 90–190 ha with the key third and 60 ha wide (was 50), so the options reveal no more magnitude than before.

### bh.7 SPAM V3.b's options differ in magnitude (R9)

Ascending (`scale`; the key third, c, as before): "Hidastunut, uutta alaa vähemmän" / "Slowed down: less new area"; "Ennallaan, uutta alaa suunnilleen yhtä paljon" / "About the same: about as much new area"; **"Kiihtynyt, uutta alaa noin kolmanneksen enemmän"** / "Sped up: about a third more new area"; "Kiihtynyt, uutta alaa noin kaksi kertaa niin paljon" / "Sped up: about twice as much new area" (were "unchanged", "a third less" and "stopped" beside the one increase). Two options say "sped up", so the pushed rising rate (7.1 → 10.8 m/min) does not decide it; the recorded 14.15 survey (4.4 ha new) beside the pushed 14.35 one (6.0 ha) does, ×1.36. Build guard (`SPAM_3B_RATIO`): the two surveys' ratio must lie in 1.2–1.5. The arrangement's draws are unchanged, so V6.b's order is the same. DRAFT, native check.

### bh.8 Text fixes (B3, B4, B9)

- **B3:** SPAM V6's English options say "brook", not "ditch" ("The fire has crossed the brook, the line is broken", …). The Finnish "ojan / ojaan / ojalla" stays: it refers back to Koivuoja, named in the prompt.
- **B4:** V14 `se_front_r2`'s basis reads "the nearest pushed distance, 500 m (KY21 19.52: 500 m; OUT1 19.56: 900 m)" (it read "KY21 19.52, OUT1 19.56: 500 m"). Key unchanged.
- **B9:** the V14 contradiction backup asks for one pair: fi "Mikä seuraavista raporttipareista, jos mikään, oli keskenään ristiriitainen?" / en "Which of the following pairs of reports, if any, was inconsistent?" (was plural with a single key). The "none" option is unchanged. DRAFT, native check.

### bh.9 Changed rows of the item table (generated with `tools/review/freeze-table.ts`)

bg.6's table stands except for these rows (no other key or basis moved; the stems are not in the table):

| View | Item | Level | Goal | Format | Key | Rule | Forecast steps | Basis kind | Tags | Basis |
|---|---|---|---|---|---|---|---|---|---|---|
| VP | `r1_arrival` | L3 | containment | choice | Klo 13.10–13.40 | computed | -3–-3 | map | — | three readings inside 13.10–13.40 (checked at build): EK11's pushed 12.01 'noin 320 m' at 'noin 4 m/min' ≈ 13.21; the drawn W2 head (12.00) ~339 m ÷ its drawn 3.5 m/min ≈ 13.37; the fire model at R1 at 13.20 (step 1's fire; 34 m short at 13.00 in the CA run, so it crosses in 13.00–13.20) |
| V4 | `korpioja_spot` | L3 | containment | choice | Ei, kipinät sytyttävät paloja ojan yli | cited | 6–7 | knowledge | — | SPEC/30 §5.1 (DRAFT): EK12's step-7 radio 'Kipinät lensivät Myllyojan yli, uusi palo toisella puolella' (pushed in V5); the CA crown run passes Myllyoja's line during step 6 with a detached spot beyond it. Myllyoja is a map name, on record from step 7 |
| V4 | `head_later` | L3 | containment | map_point | map point (300 m) | computed | 6–6 | ca_truth | exploratory | the CA truth head at the end of step 6 (15:20, the crown run); projectionPoint: V4's 40-minute isochrone (a breach view); exploratory, outside H2 and the SA composites (play-test R2) |
| V5 | `lines_breached` | L2 | containment | choice | Myllyojan takana palaa uusi palo, jota kukaan ei sammuta | cited | — | — | — | integrates the pushed step-7 crossing (radio 7.2: a new fire on the far side of Myllyoja, no crew near, nothing done) with where the crews are (EK11 at Koivuoja, pushed 15.24; EK12 and EK14 on R1 and the north edge): the fire beyond Myllyoja burns with nobody on it, and the brook no longer bounds the fire |
| V5 | `area_hour` | L3 | containment | choice | 130–190 hehtaaria | computed | 7–9 | record | — | REPORT-keyed (D4; `31` rule (1)): the pushed 15.35 survey (DR3: 76.4 ha, 35.8 ha new in 20 minutes; the map draws step 7) carried on to the end of step 9 (16.20), ~183.8 ha, 6.2 ha from the nearest band edge; the CA's truth ~148.3 ha, the same band, 18.3 ha from its nearest edge (≥ 10 % of its value required, play-test R8); ~77 ha now |
| V5 | `road_jump` | L3 | containment | choice | Ei, kipinät lentävät ojan yli ja sytyttävät uuden palon | cited | 7–8 | record | — | … and embers crossed Myllyoja in the crown run (radio 7.2, pushed; gate R: VPK's return from W1 is radio 7.1 now) (the rest as bg.6) |
| V14 | `se_front_r2` | L3 | containment | choice | Ei, rintama on silloin vielä satojen metrien päässä tiestä | computed | 21–21 | record | — | REPORT-keyed (`31` F02; no truth after 20.00): the nearest pushed distance, 500 m (KY21 19.52: 500 m; OUT1 19.56: 900 m), less the fastest pushed rate of the south-east front (DR2 19.05: 11.5 m/min) × 20 min, ~270 m, against the ~100 m at which the sprinkler water goes on (OUT1, pushed; gate R: was KY21's line) |

V10 `infra`'s row is unchanged (its key), its option c is not.

## Revision 25 Oct 2026 (bj) — the map training replaces the map-reading pretest

Source: the researcher's decision of 25 Oct 2026, on the evidence of `docs/audits/2026-10-23-difficulty/proposal-map.md` c.2 and the play-tests (`docs/audits/2026-10-23-playtest/analysis.md` §10). The pretest measured little: professionals hit its ceiling (the island's square, water, mire, distance, direction), its slope item was a guess even for experts on this extract, and novices guessed the contour and mire items. It gave no feedback, so nobody learnt anything. It also did not match what the freezes demand: in the play-tests, map errors came from marking positions from memory on the blank freeze map, from the drawn fire lagging the reports ("now" means the latest reports, not the drawn edge), and from turning reported speeds into positions at a clock time. **This revision replaces (be) §4.** No background question is added. The session side is `15` (bj), the records `07` (bj), the analysis `09` (bj).

**1. What it is.** "Karttaharjoitus" / "Map training": seven short tasks in the pretest's slot (after the pre-session item in expert sessions, after the primer in public sessions; before the intro video and VP). It uses the pretest's neutral extract: tile `0_3`, x 625–1250, y 0–625, around Kaitajärvi, outside the incident, with nothing of the scenario on it.
- **Each task:** a short instruction; the answer (an option, or a point on the extract); then **feedback**: the right answer drawn on the map and one or two sentences on how it works in the simulation, left with "Next task".
- One attempt per task (no retry loop); no score shown; a 5-minute cap on the whole training, with a countdown as the pretest had.
- **Identical** in both groups and both audiences.
- **Generic** (`35` §1's rule, `32` §1): it teaches the interface and general map and fire basics, never anything about the scenario's situation. The extract's road codes (R5, R6, R7), call signs (EK51, DR8) and clock times (14.00–14.42) are the training's own and appear in no record, item or radio text (tested, `test/tools/map-training.spec.ts`).
- Finnish DRAFT (native check); English DRAFT.

**2. Symbology:** the simulation's own where it applies (`app/render/ui/map-training-overlay.ts`).
- The road codes are drawn as the live map's overlay draws R1–R3.
- The TAK shell's scale bar (500 m) and a north arrow.
- The fire as the live map draws the current edge (`fire-theme.json`: the burnt fill, the red uncontained edge with its outside ticks, the head's glow), labelled with the time it was mapped.
- The unit as the TAK shell draws it: the 2525 friendly ground-vehicle symbol with its call sign.
- The measure tool as the shell's R&B / Mittaa: two taps give the range and the true bearing (`formatRange`, `formatBearing`).
- The memory-check map is the plain tile with the scale bar, as the freeze map is the plain basemap: no fire, no units, no overlay codes.

**3. The tasks.** Built and keyed by `tools/review/map-training.ts` from `topo-features.json`. Every key is computed, with a margin the build checks. The figures are in `content/pretest/map-training.key.json`; the key checkers' preview is `docs/audits/2026-10-23-difficulty/map-training-preview.svg`. Extract pixels are 4 m.

| # | Id | Skill | Instruction (en) | Answer and key (computed) | Margin |
|---|---|---|---|---|---|
| 1 | `training.t1.place` | find a named place | Reports and Search use place names. Mark the junction of roads R5 and R6 on the map. | a point: the R5/R6 junction (px 172, 495) | the nearest other junction 525 m away; ≥ 240 m from the extract's edge |
| 2 | `training.t2.measure` | measure a distance | How far is A from road R7? You can measure with the R&B tool (above the map) or with the scale bar. | about 150 / **300** / 600 / 1 200 m (A to R7's nearest point: 300 m) | ± 4 % of the option (0 %); the next road 1 371 m away; the options double, so no other is within 40 % |
| 3 | `training.t3.slope` | fire and slope | There is no wind. A fire is burning at A. From A to B the ground rises (the brown contour lines); from A to C it is level. Will the fire spread faster towards B or towards C? | **faster towards B** / faster towards C / equally fast both ways | B 240 m away, +8.1 m (3.4 %), rising throughout, across the 90 m and 95 m lines; C 240 m away, within 0.6 m, no line |
| 4 | `training.t4.water` | water by road | A pump stands at the star (★), and a tanker brings it water. Which fill point should the tanker use, 1 or 2? | fill point 1 / **fill point 2** / it makes no difference | 1 is nearer in a straight line (1.6 against 2.2 km, ratio 0.70 ≤ 0.75); 2 is nearer by road (2.5 against 6.4 km, ratio 0.40 ≤ 0.5); both where a drivable road passes ≤ 48 m from open water (34 m, 21 m); ★ 363 m from water |
| 5 | `training.t5.now` | the map against the log | The map shows the fire's edge as it was mapped at 14.00. Since then, the report below has come into the message log. Where is the head of the fire now? Log: "14.12 DR8: The head of the fire has reached road R5." | where the map draws it / **at road R5, as the report says** / there is no way to tell | the drawn head 120 m short of R5 (12 min at 10 m/min); R5 crossed at 80° |
| 6 | `training.t6.project` | project by the clock | At 14.12 the head of the fire is at road R5 (the red dot), moving north-east at about 10 m/min. Mark where the head will be at 14.42. | a point 300 m north-east of the 14.12 head | over land, 76 m from water (≥ 60 m); 30 minutes counted from the drawn edge instead lands 120 m short (the lure, in the key file) |
| 7 | `training.t7.memory` | the memory-check map | First, for 8 s: "Remember where unit EK51 is." Then: "This is the memory-check map: it shows no fire, no units and no road codes. Mark where EK51 was." | a point: EK51 on R6 by the lake's west shore (px 81, 270) | 200 m from water; ≥ 160 m from R6's ends and every junction; 964 m from every other task's points |

**The feedback** (en; fi in `app/i18n/map-training-texts.ts`):
1. "The junction of roads R5 and R6 is at the green ring. The map's names and codes – road codes, the names of lakes and brooks – and its legend help you find the places that reports and Search name."
2. "The shortest distance from A to road R7 is about 300 m (the yellow line). In the simulation you measure with the R&B tool: choose R&B among the tools on the right edge and tap two points on the map. The map's scale bar tells distances too."
3. "Faster towards B. With no wind a fire spreads faster uphill, because the flames lean towards the slope and dry and heat the unburnt fuel ahead of them. The brown contour lines show slopes: the closer together they are, the steeper the slope. From A to B the ground rises about 8 m."
4. "Fill point 2. In a straight line fill point 1 is nearer: 1.6 km, against 2.2 km to fill point 2. By road, though, fill point 1 is 6.4 km away and fill point 2 only 2.5 km. The drive by road is what counts: in the simulation, tankers shuttle water by road." (Both road routes are drawn.)
5. "At road R5. The map shows the edge as it was mapped at the start of the period (14.00); newer reports in the log tell you where the fire is now (14.12). In the memory checks, “now” means the situation the latest reports give."
6. "About 300 m north-east of road R5: 14.12 to 14.42 is 30 minutes, and 30 min × 10 m/min = 300 m. Projection questions name a clock time; count it from the latest report, not from the edge the map draws."
7. "EK51 was here. The memory-check map shows no fire and no units, so anchor places in your memory to roads, water and names: on which road, by which lake or brook."

A point task's feedback also says how far the mark was ("Your mark was N m from the right place") and draws the mark (blue) joined to the right place (a green ring). A choice task's feedback shows the participant's answer beside the right one.

**Departures from the brief**, forced by the extract and documented here:
- Task 1 is a road junction: the extract's only printed name, Kaitajärvi, is the lake that fills it.
- Task 3's B and C are both in forest: C is level ground, not a field, so the slope is the only difference (a field's fuel would differ). The extract's steepest climb is gentle (3.4 %; the basemap draws 5 m contours and some 2.5 m ones), and contour lines alone cannot tell up from down, so the stem says that the ground rises towards B; the feedback teaches the reading and the rule.
- Task 4 offers two fill points by roads, both on the same lake: the one nearer in a straight line and the one nearer by road.
- Task 7's unit is on a road (an engine keeps to the roads).

**4. Use.** It is training, not a test: each key is shown in its feedback, and nothing is scored for the participant. The first answers are logged (`07` (bj)). Tasks 1 and 7's first-try pointing errors are a pre-registered covariate (`09` (bj)); the other first answers are descriptive only. Never an exclusion criterion.

**5. Before use (RC):**
- Two people check the key figures against the preview.
- A native check of the Finnish.
- A domain check of task 3's wording (the uphill rule shown on a gentle slope) and of task 4's fill points.
- The pilot measures the length (`15` (bj)) and whether task 7's error has spread (`09` (bj)).

## Revision 25 Oct 2026 (bk) — four H2 items made seek-dependent

Source: the researcher's decision of 25 Oct 2026. After (bg) and (bh) made items fairer, only 5 of H2's 23 items needed seeking (the difficulty audit), so an effect that works through what the AI tells the seeker could hardly show in H2. H2's primary is now the gap on the seek-dependent items (`09` (bk)), and four items are converted here. Built in `freeze-bank-seek.ts` (new: `south_flank`, `reinforcements`, `north_help`), `freeze-bank.ts` (`hose_short`'s basis; each converted item at its old place, so the option arrangement's draws and every other item's order are unchanged), `freeze-key-statements.ts`, `labels.en.json` and the records (`18` (bk)). Every new Finnish text is a **DRAFT** for the native and domain check.

### bk.1 The criteria (each converted item meets all six)

- **a. Safety stays pushed.** No crew-danger, withdrawal, entrapment or live-line record moves; only non-critical records are held (a crew's fire report with a working line, a hose request, a dispatch with ETAs).
- **b. Findable.** At least two natural questions per language rank a key record in the lexical top 3 at the item's moment (the time gate's step), fixed in `tools/review/seek-questions.ts` and tested in `test/retrieval/seek-items-retrieval.spec.ts` (`hybridRetrieve`, lexical, as the play harness runs Haku); no question uses a word only the key option has.
- **c. The default is a lure.** The option a non-searcher holds from the stream rests on a record pushed before the moment and is not the key (same test).
- **d. Spread.** At most two per view (V2 1, V5 2, V7 1); levels L2 × 3, L3 × 1. **No L1 item:** H2's window holds L2 and L3 items only, and phase A's L1 slots are the fixed infrastructure schedule (whose "available" default is mostly the key) and crew positions (safety).
- **e. R11.** No earlier freeze item asks the same element, and no stem states the record.
- **f. (bg) and (bh) kept:** V5 `ek14_shelter`'s pushed forecast headline, V9's pushed area for V10 `area_growth_hour`, V3's birch strip for `crown_drops` and R1's stretch wording are untouched.

### bk.2 The items

| View, item, level | What changed (fi / en) | Key record(s) (now recorded) | Two natural questions per language (rank of the key record) | Why a non-searcher's default is wrong |
|---|---|---|---|---|
| V2 `south_flank`, L2 | Stem unchanged. Option `lost` "Sivusta on menetetty, palo leviää etelään" / "The flank is lost; the fire spreads south" → **`flames` "Sivustalla palaa 2–3 metrin liekein, reuna etenee itään" / "The flank burns with 2–3 m flames and spreads east"**. Key `held_low` unchanged | EK12 13.51 `evt.c02.022` (already recorded) or 14.08 `evt.c03.021` (held, `18` (bk)); either states the key, so the item is no longer late (was 40 s) | fi "Miten kärki etenee EK12:n kohdalla?" (1), "Millaista paloa EK12:n kohdalla on?" (2), "Miten kärki käyttäytyy eteläsivustalla?" (2); en "How is the fire behaving on EK12's flank?" (1), "What is EK12 reporting from the south flank?" (2), "What is the fire doing at EK12's section?" (2) | The latest pushed EK12 report is 13.20's (V1): flames 2–3 m, moving east — option `flames` |
| V5 `hose_short`, L2 | Unchanged (stem, options, key `hose`); basis notes the held record | EK11 15.35 `evt.c07.032` (held); its pushed 15.24 report stays a key record | fi "Mitä EK11 tarvitsee?" (1), "Mitä tarvikkeita EK11 tarvitsee?" (1); en "What equipment does EK11 need?" (3), "What does EK11 need on its line?" (3) | Pushed are PP1 behind EK11 and the men pulled off the line (radio 7.4) — option `burnt` ("sparks have burned the line through"); EK11's earlier water shortages — `water` |
| V5 `reinforcements`, L3 (new; replaces `wind_shift`) | fi "Mitä lisäyksiköitä palolle on saapunut klo 17.00 mennessä?" / en "Which reinforcements will have reached the fire by 17.00?"; **`three` "Kolme hälytettyä pelastusyksikköä" / "Three alerted rescue units"**, `none` "Ei vielä yhtään: lisäyksiköitä on vasta pyydetty" / "None yet: reinforcements have only been requested", `one` "Yksi säiliöauto naapuriasemalta" / "One tanker from a neighbouring station", `heavy` "Raskaat säiliöyksiköt alueen ulkopuolelta" / "Heavy tanker units from outside the region". `keySteps` 7–11 (horizon 80 min), basis kind record | P2 15.30 `atom.demo.7.1` (held); the key is guarded at build (EK15, EK16, KY23 at the CP by step 11, OUT1/OUT2 not before) | fi "Milloin lisäyksiköt saapuvat?" (1), "Onko lisäyksiköitä tulossa?" (2); en "Have reinforcements been dispatched?" (1), "Are reinforcements coming?" (2) | Pushed is only EK11's "Pyydetään lisäyksiköitä" (15.20) — option `none` |
| V7 `north_help`, L2 (re-keyed; slug kept) | fi "Mitä toisen yksikön lähettäminen EK14:n avuksi pohjoisreunalle vaatii viimeisimpien tietojen mukaan?" / en "According to the latest reports, what would sending another unit to help EK14 on the north edge involve?" (was "Mitä KY21:n ja VPK:n siirto merkitsee …", whose stem stated the moves and so the key); **`carry` "Autolla ei pääse linjalle asti: kalusto kannetaan kaakosta" / "A vehicle cannot reach the line: the kit is carried in from the south-east"**, `burned` "Paloauto pääsee palaneen alueen kautta linjalle asti", `track` "Ajoura kantaa raskaankin auton linjan viereen", `cut` "Linjalle ei pääse lainkaan, palo on katkaissut reitin" | EK14's lateral line to EK15 `evt.c10.028` (T4, recorded as before) | fi "Miten EK14:n linjalle pääsee?" (1), "Kuinka lähelle EK14:ää pääsee?" (1), "Pääseekö EK14:n linjalle?" (1); en "Can a fire engine get to EK14?" (1), "How close can vehicles get to EK14?" (1) | Pushed is EK14's move through the burned area in its terrain vehicle (radio 10.5) — option `burned` |

**Why `wind_shift` went.** Its stem stated the premise ("if the wind starts blowing from the south"), and it asked the same turn as `ek14_shelter` beside it; with the forecast's headline pushed ((bg) D7) both were answerable without seeking. `ek14_shelter` keeps the headline. Its key statements, labels and the identity test's id map (`freeze.5.reinforcements` ↔ `freeze.5.wind_shift`) are updated.

**`keyStatements` (H2t)** for the new and re-keyed items (`freeze-key-statements.ts`): `reinforcements` — the three units, or EK15 / EK16 / KY23 on their way or due; `north_help` — a vehicle cannot reach / the kit or hose carried in. Element patterns for both. Every one of H2's 23 items still has key statements.

**Considered and rejected.** V4: every key rests on the crown run's safety lines, the withdrawals and the spotting, which stay pushed; an air-support item on the helicopter's ETA would make HELI1 salient before F7's truth record (a cue to H9). V5 `area_hour` (R11 with V2 `area_40` and SPAM V3), V7 `cabins_reach` (the map's rate mark), V7 `relief_next` (arrivals pushed in VP and V1), forecast items (R11 with the practice forecast item; cues to V7's `rekindle_sector` and `cp_safe`), water items (a water topic near V3 cues the load-bearing lateral `t4.water_state`), EK15 and fuel items (source-memory facts no probe may state). So 4, not 5–7: the target of 10–12 seek-dependent items is not reached (9).

### bk.3 Changed rows of the item table (generated with `tools/review/freeze-table.ts`)

bg.6's table, with bh.9's rows, stands except for these rows (`wind_shift`'s row goes):

| View | Item | Level | Goal | Format | Key | Rule | Forecast steps | Basis kind | Tags | Basis |
|---|---|---|---|---|---|---|---|---|---|---|
| V2 | `south_flank` | L2 | containment | choice | Reuna pysyy matalana, mutta kärki pääsee ohi | cited | — | — | retrieval | revision (bk), seek-dependent: EK12's recorded 13.51 report 'kärki etenee koilliseen meidän ohi, omalla pätkällämme matalaa paloa' states the key, and its recorded 14.08 report (held for seeking since (bk)) a surface fire in dry pine heath, flames 1–2 m, the 680 m line with pressure enough; the latest PUSHED EK12 report is 13.20's (V1: flames 2–3 m, moving east, the head ~300 m to its north), the stale state option `flames` states; EK13 refilled EK12's basin at 14.01 (recorded; the 13.4x 'water running out' report is the `dry` lure for a partial search) |
| V5 | `hose_short` | L2 | resources | choice | Letkua on liian vähän kärjen perässä pysymiseen | cited | — | — | — | integrates EK11's step-7 reports: the head runs past it to the north-east (15.24, pushed) and its 600 m line has under 200 m of hose in reserve, more hose asked for (15.35, recorded since revision (bk)): the line cannot follow the head; EK11's tank is at 67 % (asked-only, 15.25; gate R: read from the record, was 63 % before the road-graph shuttle) and the water shuttle runs, so water is not the limit |
| V5 | `reinforcements` | L3 | resources | choice | Kolme hälytettyä pelastusyksikköä | cited | 7–11 | record | retrieval | SPEC/30 §5.1 (DRAFT), revision (bk): P2's 15.30 dispatch (story 7.1, held for seeking: recorded, T2): EK15 at the CP at about 16.20, EK16 and KY23 at about 16.40; pushed is only EK11's request (story 7.0); EK15 arrives at 16.22 (radio 10.2), EK16 and KY23 at 16.42–16.43 (radio 11; the region holds both on arrival, said then); OUT1 and OUT2 come at step 16 |
| V7 | `north_help` | L2 | resources | choice | Autolla ei pääse linjalle asti: kalusto kannetaan kaakosta | cited | — | — | retrieval | revision (bk), seek-dependent: EK14's lateral line to EK15 (recorded, T4): a vehicle gets no closer to its line than about 300 m, the track is soft, hose is carried in from the south-east; pushed are only EK14's moves (radio 10.1, 10.5: through the burned area in its own terrain vehicle, the `burned` state) and EK15 waiting at the CP for a task; the route is not cut (EK14 is on the line) |

Three of the four are now `retrievalDependent` (every key record recorded-only; `hose_short` keeps a pushed one): the analysis reports them conditional on exposure as well (`09` (bk) §7).

### bk.4 For the reviewers

- Native check of the new Finnish (the stem and options of `reinforcements` and `north_help`, `south_flank`'s `flames`) and of the questions in `seek-questions.ts` (DRAFT).
- Domain check: that a commander would ask EK14's access before sending help; that "kalusto kannetaan kaakosta" reads as the record's "kantakaa kaakosta"; that "Kolme hälytettyä pelastusyksikköä" is the plain reading of P2's dispatch (EK15, EK16, KY23) by 17.00.
- The help card lists three reinforcement units without times, so `reinforcements` is "partly" passive, not "no": a non-searcher who reads it and trusts that alerted units arrive can reach the key.

## Revision 25 Oct 2026 (bn) — three seek-dependent items corrected after the independent review (B1, S5, S8)

Source: the independent review of 25 Oct 2026 (B1 blocker, S5, S8) and the researcher's brief; the records are `18` (bn), the analysis `09` (bn). Checked against `wildfire-sagat-probes` (`sagat_rules.md`): one element per query, distractors plausible states of the same element, answerable from what the participant could perceive, no query cueing another, the stem stating no answer. DRAFT Finnish (native and domain check). The difficulty audit's classes are unchanged (`items.csv`: `north_help` no, `hose_short` partly, `reinforcements` partly; key records, tiers, leads, findability the same), so H2's nine seek-dependent items stand (`09` (bk) §1).

**V7 `north_help` (B1, blocker).** Its key record contradicted EK14's own pushed stream (EK14's terrain vehicle is at the line: radio 10.5, `evt.c10.005`), so an officer who integrated the stream correctly chose `burned` and was scored wrong. The record now says that a fire engine stops about 300 m short on the soft track and only EK14's own terrain vehicle reaches the line (`18` (bn)); the key names the fire engine:

| Option | Was (fi / en) | Is (fi / en) |
|---|---|---|
| `carry` (key) | Autolla ei pääse linjalle asti: kalusto kannetaan kaakosta / A vehicle cannot reach the line: the kit is carried in from the south-east | **Paloauto ei pääse linjalle asti: kalusto kannetaan kaakosta / A fire engine cannot reach the line: the kit is carried in from the south-east** |
| `burned` | Paloauto pääsee palaneen alueen kautta linjalle asti / A fire engine can drive through the burned area right up to the line | unchanged |
| `track` | Ajoura kantaa raskaankin auton linjan viereen / The track carries even a heavy vehicle up to the line | unchanged |
| `cut` | Linjalle ei pääse lainkaan, palo on katkaissut reitin / The line cannot be reached at all; the fire has cut the route | unchanged |

The stem is unchanged. **Why the pushed stream decides neither the key nor `burned`:** the stream says that EK14's terrain vehicle went through the burned area and keeps the basin full at the line; it says nothing of a fire engine. `burned` (a fire engine through the burned area) is now a different claim from the stream's, the non-searcher's generalisation (`seek-items-retrieval.spec.ts` criterion c: the default, on radio 10.5); `cut` is ruled out by the stream (EK14 is on the line); `track` contradicts the record. The key is only in the record (`key_needs_search`; seek-dependent, passive "no"). The key statements gain the fire engine's patterns (`freeze-key-statements.ts`). **SAGAT check:** one element (whether a unit sent to EK14 can drive to its line); four states of it; answerable from the record that a JOKE acknowledgement names at 16.36 (`atom.ptr.10.0`), within a minute of it; no other item asks EK14's access. **Residual risk (for the panel):** a domain expert may infer from "maastoauto" that a fire engine would not get through, so a non-searcher can reach the key by knowledge; the class stays "no" (nothing pushed states it), and pilot 2's accuracy by group and seeking shows it. One English findability question changed (EK14's line no longer says "closer"): "How close can vehicles get to EK14?" → "Can vehicles get through to EK14's line?" (lexical rank 1 at step 10; `seek-questions.ts`).

**V5 `hose_short` (S5).** The last pushed EK11 state before the freeze is radio 7.4 (the men pulled off the line, PP1 behind them), while the stem asks what limits EK11's work on the line. The recorded 15.35 request now says that the crew returned to the line (`18` (bn)), and the option that no record stated is replaced by the pushed state, false at the freeze:

| Option | Was | Is |
|---|---|---|
| `burnt` → `withdrawn` | Kipinät ovat polttaneet letkulinjan poikki / Embers have burnt through the hose line | **Miehet on vedetty pistepalon takia pois linjalta / The crew has been pulled off the line because of the spot fire** |

Key `hose` and the other options unchanged. The non-searcher's default is now `withdrawn` (radio 7.4), a lure: the searcher reads that the crew is back and short of hose. The push cap and the key record are unchanged (the request keeps its held slot).

**V5 `reinforcements` (S8).** The help card's roster (public sessions) listed the three reinforcement units from the start and OUT1, OUT2, UGV1 and VD1 with "Saapui … mukana"; it no longer does (`18` (bn) §8.1). The `none` default is re-worded to the non-searcher's own belief (the request heard, no dispatch heard), a plausible lure for the 17.00 projection:

| Option | Was | Is |
|---|---|---|
| `none` | Ei vielä yhtään: lisäyksiköitä on vasta pyydetty / None yet: reinforcements have only been requested | **Ei yhtään: lisäyksiköitä on pyydetty, mutta niitä ei ole lähetetty / None: reinforcements have been asked for, but none have been sent** |

(The wording avoids "vastattu", which shares a stem with the pointers' "vastaanotettu", and "hälytet-", the key statements' pattern.) The class stays "partly": the help card's listing no longer gives a reason, but a standard response time can be projected from the pushed request without the dispatch. **The level:** the item is labelled L3 (a projection to 17.00), but its key is the recall of P2's dispatch (an L1 fact read off a record); the label is kept, and the question is put to the panel (`11` §7.35).

**Not changed:** V2 `south_flank` (its `dry` lure can penalise a partial search, `09` (bn) §5); SPAM V3.b (its key record is `atom.ptr.3.1`'s and a lure for `area_40` unless the 13.55 survey is read, `09` (bn) §5).
