# 16 — Course-of-action decision task (Paper 2)

**Version 1.2 · 17 September 2026 · Status: governing for the topics below.** Implements fork F7 (`11` §7): the 2 × 2 fixed-choice decision is **combined with** the v3.0 allocation task, not substituted for it. Adds to `01` §6, `03` §2.2, `04` §7, `06` §4.5 and `07` §2.6, which carry amendment markers.

> **Changelog**
> - **19 Oct 2026 (ay)** — `31`: the primary coding reads the act (a direct attack, mop-up or held line on the deciding front attends it; RC); V14 sound only via the secondary route (RC); t.3 extended — the panel rates plans blind and the key is derived from the ratings; task definitions in the tour; "Linjan pito tiellä tai vesistöllä"; the fixed order stated; `demo-decisions.ts` retired; y.4's sectors aligned with the build. See the revision at the end.
> - **9 Oct 2026 (ad)** — the projection-direction key is built (`PROJECTION_DIRECTION_KEYS`, `demo-directive.ts`); water drops and hose lays are not plan options and §s's VD1/UGV1 task list is superseded (ad.2).
> - **8 Oct 2026 (ab)** — a burnout from a held road is in line and is not a plan option; the departure note and `accountableDeviation`; resume-aware coding (`attemptStartSeq`); the phase-A share is not a covariate (baseline = practice + V1). See the revision at the end.
> - **6–8 Oct 2026 (y)** — the secondary sector can carry a direct attack; alignment read over the whole plan; V14 a no-fit view with its own secondary rule; accepted sectors computed from the front polygons, with a boundary flag; H14 coded on alignment; the t.2 table restated; L2 renamed "Koillinen / North-east". See the revision at the end.
> - **5 Oct 2026 (u, reconciled)** — the coding by cell reconciled with the build (`27` 1.1): `strategyExposureBeforePlan`; the 5 Oct decisions on V10's crews and the added no-fit views.
> - **4 Oct 2026 (u)** — the posture codes read by cell (`27`): fit derived from the panel's keys; the AI's `linjaus` status coded right or wrong against that fit; the base-rate group validates keys and is descriptive. See the revision at the end.
> - **4 Oct 2026 (t), review round 2** — revision (t) amended in place (DEFAULTS, `11` §7.16.1): posture wording (one term each); phase A not coded for alignment; V9–V10 keys sector-aware (the new front's sector, L3, computed from the data); V11–V12 sound = `barrier_line` or `protect_values`; V13 fits; the plan in force at view end is coded, with `afterBoundary` in merged views and a row for every view; the design claim restated (t.6).
> - **4 Oct 2026 (t)** — the sector plan gets the main effort's posture (three options, nothing preselected, no justification on deviation); alignment × soundness coded on it per view; draft keys and expert-panel review; compliance where the directive fits, justified deviation where it does not; a base-rate check without the directive. See the revision at the end.
> - **1 Oct 2026 (r)** — the allocation is the decision; the course-of-action item follows it and is reworded as a description of the participant's own allocation (codes kept); allocation revisions until the view's minimum length. See the revision at the end.
> - **1.4 · 17 Sep 2026** — Paper 2 cells are 65 / 65 within LLM reasoning (`02` revision (f)).
> - 1.3 · 17 Sep 2026 — Paper 2 contrast is within the LLM-reasoning group (`02` revision (e)).
> - 1.2 · 17 Sep 2026 — per-choice alignment feedback removed; intent is maintained through query answers (`14` revision (d)). Initial and final choice collapse into one response.
> - 1.1 · 17 Sep 2026 — alignment feedback applies only to the reasoning-AI via-AI cell; warm-up is a prologue.
> - 1.0 · 17 Sep 2026 — created.

---

## 1. Purpose

Paper 2 asks how a single strategic guidance, delivered at the hinge, **survives through phase B** and how the way it is delivered affects decisions. The allocation task (v3.0) measures what participants *do* with resources; the course-of-action choice measures **which intent they are acting on**, with scoring that separates following the strategy from reading the situation well.

---

## 2. Placement in the cycle

> **[SUPERSEDED 2026-09-23]** Freeze placement moved before the decision phase entirely — see `15` §9. The diagram below is retained for the response ordering *within* the decision phase, which is unchanged; only the freeze's position relative to it has moved.

```
… → judgement, confidence, correction (Type J)
  → verification window
  → [recall freeze, if scheduled]
  → COURSE-OF-ACTION CHOICE + confidence            ← new
  → allocation and free-text rationale (v3.0)
  → cycle_end
```

**Current ordering (`15` §9–§10):** exploration phase → [SAGAT freeze, if scheduled] → decision phase (judgement/own-projection → course-of-action choice, if the cycle carries one → allocation) → cycle_end.

The choice occurs every cycle, including prologue cycles W1–W5 (`15` §3). During the choice the clock is halted and the picture is visible.

---

## 3. The four options

Each cycle presents four courses of action, fixed in advance and defined relative to **the strategy in force**:

- in the prologue and phase A, the initial intent, established in the prologue;
- in phase B, the hinge guidance.

| | Situationally sound | Situationally unsound |
|---|---|---|
| **Aligned with strategy** | **A** — the best answer | **B** — follows intent, ignores the situation |
| **Against strategy** | **C** — locally sensible, conflicts with intent | **D** — wrong on both counts |

**In phase B, options C and D are written to match the pre-hinge strategy wherever possible,** so choosing them indicates that the earlier guidance is still steering the participant.

**Option C is not legitimate disobedience.** In most cycles A is clearly best. Where following the strategy is locally costly, the correct answer is fixed in advance by the expert panel (§5).

---

## 4. Response and feedback

1. **Initial choice** (A/B/C/D, order randomised by seed) and **confidence 0–100**.
2. **Reasoning-AI participants in the via-AI cell, phase B only:** the AI shows an authored alignment statement for the chosen option ("in line with the current priority" / "conflicts with the current priority: …"). No statement about situational soundness is given.
3. **Final choice** and **final confidence.** Participants may keep or change their choice.
4. Allocation follows and is recorded as in v3.0.

All other participants make one choice per cycle; for them, initial = final.

Alignment statements are pre-authored per option per cycle, served through the closed engine (`14`), and never flag the cycle-18 contradiction.

---

## 5. Authoring and validation

- **Item bank:** 30 decision items for 25 slots (20 main + 5 prologue), so pilot 2 can select by difficulty.
- **Expert classification:** 3–5 experienced incident commanders classify each option blind into the four cells (Delphi round). Items are kept only where the panel agrees; that classification is the answer key.
- **Parallel form:** options within an item have similar length and detail; no strategy keyword appears only in aligned options.
- **Allocation link:** each option is mapped to the set of allocations in the viability table (`04` §7) that implement it. The mapping enables **choice–allocation coherence** (§6).
- **Finnish register:** reviewed with the rest of the string table (`11` §2.4).

---

## 6. Measures

| Measure | Definition |
|---|---|
| Strategy alignment | Share of A + B |
| Situational soundness | Share of A + C |
| Blind compliance | Share of B |
| Intent loss | Share of C + D in phase B |
| Old-strategy persistence | Share of phase-B choices matching the pre-hinge strategy |
| Intent survival | Alignment as a function of cycles since the hinge |
| Decision calibration | Confidence vs. choosing A |
| Feedback effect (via-AI cell) | Initial → final transitions (B→A, C→A, A→B, …) |
| Choice–allocation coherence | Allocation consistent with the chosen option, with another option, or with none |
| Understood vs. applied | Joint with phase-B intent recall items (`15` §4.4): high intent recall + C/D = understood but not applied |

**Primary Paper 2 test:** alignment in phase B within the reasoning-AI group, guidance-once vs. guidance-via-AI, with cycles-since-hinge and its interaction. Prologue and phase-A alignment enter as baseline covariates.

---

## 7. Data model additions (to be merged into `04`)

```ts
type Alignment = "aligned" | "against";
type Soundness = "sound" | "unsound";

interface DecisionOption {
  readonly id: string;
  readonly labelFi: string;
  readonly alignment: Alignment;
  readonly soundness: Soundness;
  readonly matchesPriorStrategy: boolean;          // phase B only
  readonly consistentAllocationKeys: readonly string[];
  readonly alignmentFeedbackFi: string;            // shown only in the reasoning-AI via-AI cell, phase B
}

interface DecisionItem {
  readonly id: string;
  readonly cycle: CycleIndex | WarmupIndex;
  readonly strategyInForce: "initial" | "hinge";
  readonly promptFi: string;
  readonly options: readonly [DecisionOption, DecisionOption, DecisionOption, DecisionOption];
}

interface DecisionResponse {
  readonly itemId: string;
  readonly presentedOrder: readonly string[];
  readonly initialOptionId: string;
  readonly initialConfidence: number;              // 0–100
  readonly feedbackShown: boolean;
  readonly finalOptionId: string;
  readonly finalConfidence: number;
}

type GuidanceMode = "once" | "via_ai";             // SessionConfig.guidanceMode; "via_ai" only in the reasoning-AI group
```

## 8. Telemetry additions (to be merged into `07`)

| Kind | Detail |
|---|---|
| `decision_presented` | Item id, presented option order |
| `decision_option_hovered` | Option id |
| `decision_initial_submitted` | Option id, confidence, latency from presentation |
| `alignment_feedback_shown` | Option id, feedback id, onset |
| `decision_final_submitted` | Option id, confidence, latency from feedback onset (or from initial submission) |

## 9. Tests (to be merged into `10` M8)

- `test/decision/items.spec` — every main and prologue cycle has exactly one item with one option per cell.
- `test/decision/feedback.spec` — alignment feedback is shown only to reasoning-AI participants in the via-AI cell, and only in phase B.
- `test/decision/order.spec` — option order derives from the seed and is logged.
- `test/decision/coherence.spec` — every option maps to at least one allocation key in the viability table.

---

## Revision 17 Sep 2026 (d) — supersedes earlier amendments where they conflict

- **§4 steps 2–3 are withdrawn.** Every participant makes one choice with confidence per cycle. The via-AI manipulation lives in the query answers (`02`, `14` revision (d)), not in feedback on choices. This resolves review P5: the machine never comments on the participant's decisions.
- `DecisionOption.alignmentFeedbackFi`, `DecisionResponse.feedbackShown`, `finalOptionId`, `finalConfidence` and the `alignment_feedback_shown` / `decision_final_submitted` records are **removed**. `DecisionResponse` keeps `initialOptionId` (rename to `optionId`) and `initialConfidence` (rename to `confidence`).
- The "feedback effect" measure (§6) is replaced by **intent-query exposure**: number of phase-B answers carrying an intent line before each choice.
- `test/decision/feedback.spec` is replaced by `test/decision/no-feedback.spec`.
- **Decided:** no fifth "none of these" option. The task keeps exactly four options, so every answer is scored on both dimensions.

## Revision 23 Sep 2026 — decision-free cycles

`15` §9 ("baseline condition") allows a cycle to carry **no** decision item, to measure undirected querying without an impending decision. This **supersedes §9's `test/decision/items.spec`** ("every main and prologue cycle has exactly one item"): the test now asserts one item **per cycle that `CycleSpec.hasDecisionItem` marks true**, and zero items otherwise. Which cycles are decision-free is scheduled deterministically alongside the freeze/SPAM tables (`15` §4, §11 open item) — not yet assigned.

## Revision 1 Oct 2026 — crews and drone teams in the allocation; the drone-survey measure

**Role.** The participant commands the human crews and the drone teams (decided 1 Oct 2026). The allocation step offers both.

**What the step offers** (`app/scenario/allocation.ts`, `app/session/allocation.ts`):
- **Assets:** those on scene by the end of the view, derived from the frozen deployment (`site-scenario.json`). The decision follows a merged view's step boundary (`26` §2). A ground unit counts from the first step that places it, a drone from the first step it flies. HELI1 and SPOT are not the participant's to task.
- **Sectors:** the scenario's L1 Pohjoinen, L2 Kärki, L3 Etelä, L4 Länsi. The placeholder labels (L3 "kylän suojaus") are gone.
- **Tasks by type:** crews: *sammutus palon reunalla*, *linjan pito*, *jälkisammutus ja varmistus*. Observation drones DR1–DR3: *lämpökuvaus*, *palon rajan kartoitus*, *lohkon tähystys*. VD1: *vesipudotukset*. UGV1: *letkulinjan veto*.
- **One panel:** one selector per asset ("sector · task"), crews first, then the drones and the robot. "—" means no new order. The sheet is empty at the start of every view, so each order is an explicit act.

Orders are logged and scored. The world does not respond (identical stimulus). Each drone-team order is also logged as `drone_tasked` (`07` revision 1 Oct 2026).

**Measure — drone survey in a window** (`droneSurveyTiming`, `app/telemetry/derived-measures.ts`). A declared spec defines it: a target sector, the survey task ids (*lämpökuvaus*, *palon rajan kartoitus*, *lohkon tähystys*), a first view (inclusive) and a closing view (exclusive). Outcomes, in order of precedence:
- `in_window`: a qualifying order in the window. The first one is reported with its view, asset, virtual time and wall time.
- `before_window`: qualifying orders only before the window.
- `late`: qualifying orders only at or after the closing view.
- `never`: no qualifying order.

The practice view never counts.

The study's instance is `REKINDLE_DRONE_SURVEY`: **L3, V7–V8, closing at V9**. VPK's objection in V7 asks for a thermal-camera check of the bog edge (`26` §5). The fire resurfaces there, and is reported, in V9. The measure complements `26` §5's *anticipation* measure (a crew allocated to L3 in V7–V8), which stays as defined.

---

## Revision 1 Oct 2026 (r) — the allocation is the decision; the course-of-action item describes it

Researcher decision of 1 Oct 2026. The view flow is `15` revision (r). **This supersedes §2's ordering (course-of-action choice before the allocation) and §4 step 1's "initial choice … and confidence 0–100".**

- **Order.** Type J (with follow-ups and the verification window) → **allocation** → **course-of-action item**. The allocation is the decision. Its submission time is the decision commitment time.
- **Rewording.** The item is asked after the allocation and worded as a **description of the participant's own allocation**: which of the four statements best describes what they have just ordered. It is no longer a choice made before acting. Final Finnish wording: native and domain reviewers.
- **Codes kept.** The four options keep their cells (aligned/against × sound/unsound, §3) and the expert-panel answer key (§5). The §6 measures (strategy alignment, situational soundness, blind compliance, intent loss, old-strategy persistence, intent survival) are computed as before.
- **Confidence** on the item uses the one scale 25/50/75/100 (`08` revision (r)). With four options, 25 is chance.
- **Its answer confirms the view.** If the participant confirms before the view's minimum length, they may revise the allocation until the minimum is reached (`allocation_revised`). **The course-of-action item is not asked again** after a revision.
- **What changes in meaning.**
  - *Choice–allocation coherence* (§6) becomes a check of **self-description**: does the participant's description of their allocation match the option the allocation implements (`consistentAllocationKeys`)? Low coherence now means the participant describes their own orders differently from how the answer key reads them, not that they chose one course and did another.
  - After a revision, the answer describes an earlier allocation version. Coherence is computed against the version current when the item was answered; the final version is reported alongside it.
  - *Decision calibration* (§6) is confidence in the description against the description being an A.
- **Allocation measures with revisions** (default; `11` §7.10): the `26` §5 anticipation measure and the drone-survey measure (revision 1 Oct above) count any allocation version in the view, including revisions, and report whether the qualifying order came in the first submission or in a revision. Allocation robustness and safety are scored on the final version.

---

## Revision 2 Oct 2026 (s) — the sector plan and the outlook; the course-of-action item withdrawn

Researcher decision of 2 Oct 2026, together with the 3-minute cap (`15` r.10). **Supersedes revision 1 Oct 2026's per-unit order sheet and revision (r)'s course-of-action item.**

**Why.** The per-unit sheet had one selector of 12 choices (4 sectors × 3 tasks) per unit. That was 3 units in VP, 8 by V3 and 15 by V12, too slow for a 3-minute view, and the later views would have measured fatigue. It also fits the incident commander's role poorly: the commander sets the main effort by sector rather than ordering each vehicle. Ready-made allocation options were weighed and set aside, for three reasons:
- They cue the answer: an option "crews to L3, the bog edge" would hand over the rekindle cue and turn H10 into recognition.
- They allow 25 % guessing.
- They leave nothing for the drone-survey measure or for doubt–action coherence.

**The sector plan** (`app/scenario/plan-types.ts`, the panel `DecisionPanels.tsx`). Nothing is preselected and nothing is offered as a ready option.
- **The crews' main effort:** one of L1–L4. Required.
- **A secondary sector**, or none. If one is chosen, its purpose is required: *linjan pito* (holding the line) or *jälkisammutus ja varmistus* (mop-up and securing). It cannot be the main effort's sector.
- **The observation drone teams' task**, if any are on scene: a sector × *lämpökuvaus* (thermal imaging) / *palon rajan kartoitus* (mapping the fire edge) / *lohkon tähystys* (watching the sector). "Ei uutta tehtävää" (no new task) means they carry on.
- **Who is on scene** is shown for orientation only. The water drone VD1 and the robot UGV1 are no longer the participant's to task.
- **Its submission confirms the period.** The rationale after a rejection and "Muuta kohdennusta" (revision until the minimum) are as before.

**Logged.** `allocation_submitted.plan` and `allocation_revised.plan` replace the per-unit `assignments`/`marks`. A plan that tasks the drones writes one `drone_tasked` record per observation drone team on scene, so `droneSurveyTiming` is unchanged. Format 0.9.0, `07`.

**The outlook** comes before the plan, every view, both groups (`OutlookPanel`):
- *"Miten palotilanne mielestäsi kehittyy seuraavan 30 minuutin aikana?"* ("How do you think the fire situation will develop over the next 30 minutes?"). Answers: rauhoittuu / pysyy ennallaan / pahenee / pahenee selvästi (calms / unchanged / worse / much worse), with a confidence.
- *"Tarvitaanko seuraavan 30 minuutin aikana enemmän resursseja kuin sinulla nyt on käytössäsi?"* ("Will more resources be needed over the next 30 minutes than you have now?"). Answers: kyllä / ei (yes / no), with a confidence.
- Confidence uses the one scale, 25/50/75/100. The resources item is binary, so 50 % is chance: it is reported against its own chance level, as Type J is (`08` revision (r)).
- Logged as `outlook_submitted`.
- **Scoring:** `outlookScores` (`derived-measures.ts`) against `OUTLOOK_KEYS` (`app/scenario/demo-outlook.ts`). The keys are a **draft** read from the scenario's arc and need review against the CA. The distance on the ordered development scale is reported alongside correct/incorrect.

**Uses of the outlook in the design:**
- **One generative projection act per view, the same for everyone.** Unlike the correction, it does not depend on a rejection, so it is not a group-dependent confound (`08` amendment of 2 Oct).
- **Fourteen confidence–accuracy pairs per participant.** These are a secondary calibration measure on an L3 projection made with the picture visible, set against H2's freeze items made with it hidden.
- **H10:** V7's key is "worsens", because the hidden rekindle comes in steps 11–12, while the visible picture says calm. An outlook of "worsens" in V7–V8 is a third anticipation reading, alongside crews on L3 and a drone survey of L3.
- **Escalation timing:** in which view a participant first says more resources are needed, against the escalations in V3, V5, V8 and V11.
- **Coherence:** does the plan follow the outlook? For example, an outlook of "worsens sharply" with no change of main effort.
- **AI group:** whether the outlook follows Thinker's projection-type answers (H2a).

**Measures, changed:**
- **H10 anticipation:** `sectorAnticipation` with `REKINDLE_CREW_ANTICIPATION`. A plan in V7–V8 counts if its main effort or secondary sector is L3, including in a revision.
- **Strategy alignment, soundness and the other §6 codes** need an authored key per view: which main effort and secondary sectors are aligned with the intent, and which are sound. **Not yet authored**; this is an open item for the expert panel, `11` §7.13.
- **Choice–allocation coherence and decision calibration** (revision (r)) are gone along with the item.
- **Per-unit allocation safety and robustness** are scored at sector level.

**The course-of-action content** (`demo-decisions.ts`, `ScenarioContract.decisionItems`) stays in the contract but is not presented, until the bank is formally retired.

### Note (2 Oct 2026): what the outlook measures, and what it does not

The per-view outlook (*"Miten palotilanne mielestäsi kehittyy seuraavan 30 minuutin aikana?"* and the resources item, logged as `outlook_submitted`) is a **decision-adjacent Level-3 judgement made with the picture visible**: the map, the projection and the message log are on screen while it is answered. It is reported as such, as a projection judgement that feeds the plan, and **not as SAGAT**. It is not blanked, so it cannot separate what the participant holds from what the screen shows, and its confidence–accuracy pairs are not pooled with the freeze items. The SAGAT Level-3 items are in the freezes (`08` amendment of 2 Oct 2026); H2's primary window reads only those (`calibrationPairs` with `H2_PRIMARY_WINDOW`, `07` amendment of 2 Oct 2026).

---

## Revision 4 Oct 2026 (t) — the main effort's posture; alignment and soundness coded on it

Researcher decision of 4 Oct 2026, with the directive of `18` revision (t). **This supersedes:**
- revision (s)'s "Strategy alignment, soundness and the other §6 codes need an authored key per view: which main effort and secondary sectors are aligned with the intent, and which are sound". The codes are now read from one field, the posture (below), not from sectors.
- §6's "Primary Paper 2 test" (alignment in phase B, guidance once against guidance via the AI). The intent-line split is not implemented (`02` revision (t)). Paper 2's hypotheses are restated in `01` and `09` revisions (t).

The rest of revision (s) stands: the sector plan, the outlook, the drone tasking and the measures that read them.

### t.1 The posture field

The sector plan gets **one new required field: the posture of the main effort.** It is asked together with the main effort.

| Code | FI | EN |
|---|---|---|
| `direct_attack` | Suora hyökkäys palon reunaan | Direct attack on the fire's edge |
| `barrier_line` | Puolustuslinja tien tai vesistön varaan | Defensive line on a road or water |
| `protect_values` | Asutuksen suojaus | Protecting settlements |

Round 2 (4 Oct 2026, DEFAULT): one term each, so no option echoes the directive's wording more than another (was "Suora sammutus palon reunalla", "Linjan pito esteen (tie, vesistö) varassa", "Kohteiden suojaus (asutus)"). Whether a flank attack from an anchor (a road or water) is `direct_attack` or `barrier_line` is a domain question (`11` §7.16.1).

- **Asked in every view:** the practice view (not scored), phase A (V1–V7) and phase B (V8–V14). Phase A gives each participant's baseline posture under the offensive intent.
- **Nothing is preselected.** The options are shown in the order above, the same for everyone. The plan cannot be submitted without a posture.
- **No extra justification is asked when the posture deviates from the directive.** A question that appears only on deviation tells the participant which answer is expected, and it costs time inside the 180 s cap. Both effects push everyone toward compliance, which would empty the cells the measure needs (C and D, t.2). The free-text rationale after a rejected projection (Type J) is unchanged and unrelated.
- **Wording (FI and EN)** is a draft for the native and domain reviewers (`11` §7.16).
- **Logged** in `allocation_submitted.plan.posture` and `allocation_revised.plan.posture` (format 0.9.4, `07` revision (t)).

### t.2 Alignment × soundness, per view

**Aligned** means the posture is within the directive:
- **phase B** (the directive): `barrier_line` or `protect_values`;
- **phase A**: not coded (round 2, DEFAULT). The intent of `18` §4.1 is conditional ("direct attack where intensity allows"), so a phase-A posture is reported descriptively, never as aligned or against.

**Sound** means the posture is within the view's key. The cells keep §3's letters:

| | Sound | Unsound |
|---|---|---|
| **Aligned** | **A** | **B** — blind compliance |
| **Against** | **C** — justified deviation | **D** |

The draft keys (`18` revision (t) §t.3) and the cells each posture falls in:

| View | Fit | Draft sound key | `direct_attack` | `barrier_line` | `protect_values` |
|---|---|---|---|---|---|
| V1–V7 | — | None (null) | Descriptive | Descriptive | Descriptive |
| V8 | Neutral | Not scored | — | — | — |
| V9, V10 | No | `direct_attack`, **with the main effort on the new front's sector (L3)** | **C** on L3; **D** elsewhere | **B** | **B** |
| V11, V12 | Yes | `barrier_line` or `protect_values` | **D** | **A** | **A** |
| V13 | Yes (round 2: the directive names no line; the next barrier, R2, is still a road) | `barrier_line` or `protect_values` | **D** | **A** | **A** |
| V14 | Yes | `barrier_line` or `protect_values` | **D** | **A** | **A** |

**The new front's sector** (round 2) is computed from the data, never hard-coded: the first reported detached front in V9–V10's steps (12–13), by its centroid, or the nearest sector where the centroid falls between sectors (`demo-directive.ts` `newFrontSector`, `freeze-keys.ts` `nearestSectorOf`). It is **L3** (step 13; step 12's map has no detached front yet). A direct attack with the main effort elsewhere (e.g. on the old head, L2) is against and unsound.

**Not every cell can occur in every view,** by design. In V9–V10 the only answers are B, C or D, and in V11–V14 only A or D. The contrast lies across views (fit or no fit), not within one. Results are therefore reported **per view** and never pooled into a single phase-B share.

**V13's limit.** The posture field does not say *which* barrier. A participant who still holds the lost forest-road line (the radio's "Honkaharju", a name not on the map) and one who moves to R2 both answer `barrier_line`, and both are coded A. Whether the main effort's sector separates them is for the panel to say. Until then, V13 measures only whether the posture stays defensive (`11` §7.16).

**Which plan version is coded.** The plan in force at the end of the view (the last of `allocation_submitted` and `allocation_revised`), as for allocation robustness and safety (revision (r)). The first submission is reported alongside. A view ended by the cap before a plan was submitted is missing, not imputed (`15` r.10): `directiveAdherence` returns its row with null codings (round 2). **Merged views** (V11, V12, V14 in phase B): the second step's records arrive at the step boundary (`step_boundary_reached`, `07`), so the coded plan carries `afterBoundary`, whether it was submitted or last revised after the boundary (null in single-step views). The key is the view's (both steps); a plan given before the boundary was made on the first step's records only, which the analysis may separate.

### t.3 The keys: draft and expert-panel review

- **Draft.** The researcher's keys are the column above. They are drafts and **must not be used for confirmatory analysis** until the panel has confirmed them, as for the freeze keys (`11` §7.14).
- **Where they live.** In a truth-only file beside `demo-outlook.ts`, never reaching the render layer (I4). Each key cites its basis records **by content** (as `freeze-keys.ts` `trafficId` does), never by generated id.
- **Panel review.** 3–5 experienced incident commanders, as §5. Per view, each panellist sees what the participant could see by the end of the view: the map, the pushed messages and the records. They name the sound posture or postures. They are given the directive, but **not** the researcher's fit column, so the key does not inherit the design's intent. A view is keyed where the panel agrees. Where it does not, the view is reported descriptively and left out of the confirmatory measures.

### t.4 Measures

These replace §6's alignment rows for the phase-B posture. The sector-level measures of revision (s) (H10 anticipation, the drone survey, the outlook) are unchanged.

| Measure | Definition | Views |
|---|---|---|
| **Compliance where the directive fits** | Share of aligned postures (A or B); A alone is reported alongside | V11–V14 |
| **Justified deviation where it does not fit** | Share of C (`direct_attack` on the new front's sector) | V9, V10 |
| Blind compliance | Share of B | V9, V10 |
| Old-strategy persistence | Share of `direct_attack` (D) where the directive fits | V11–V14 |
| Phase-A baseline | Share of each posture in V1–V7 (descriptive; the phase-A intent is conditional) | V1–V7 |
| Posture change at the hinge | V7's posture against V8's | V7, V8 |
| Base rate (t.5) | Share of each posture without the directive | Per view, V8–V14 |

V8 is coded for alignment only, because it is neutral. Views since the hinge are recorded with every row, but fit and time since the hinge are confounded (`09` revision (t)).

### t.5 The base-rate check

**Purpose.** Compliance means little where officers would choose the same posture anyway. For example, holding a line on a road may be what most officers do in V12 with or without a directive. The base-rate check measures, per view, how often each posture is chosen **without the directive**.

**Form.**
- A small group of officers, not among the 200, runs the same build.
- Everything is identical, except that the hinge delivers no directive.
- They answer the posture field in every view. They are not a third arm of the study.

**Uses:**
- **Reading compliance and deviation.** Compliance in V11–V14 is read against the base rate. So is `direct_attack` in V9–V10.
- **Checking the keys.** If officers without the directive rarely choose a view's keyed posture, that key goes back to the panel.

The number of officers, their recruitment, and whether their data permit a formal test or only a descriptive comparison are open (`11` §7.16).

### t.6 What the participant can see (round 2, the design claim restated)

Revision (t) said the records decide when the directive fits. Restated honestly (`11` §7.16.2 a): **the directive's fit is visible from the map and the pushed reports in V9, V10 and V12–V14** (V9 the SPOT flare-up; V10 DR2's 1.1 ha thermal and the crews' ~1 m/min; V12 the ~10 m/min head and the forest road stopping it; V13 the crossing and DR2's 10.6 m/min; V14 Lahdenkylä's evacuation (VPK) with R2 as the next road; EK14's ~200 m to R2 conflicts with DR1's recorded ~530 m and is not the basis, round 3). **V11 is the one view whose fit rests on a recorded-only record:** the FMI forecast (SÄÄENNUSTE, 17.00 and 18.00 updates). Each key's basis cites only records the participant can see by the view's end; no CA-only value.

---

## Revision 4 Oct 2026 (u) — the coding read by cell (`27`)

Follows `27` §3.5 and §5. Revision (t)'s posture field, its A/B/C/D coding, the sector-aware keys and the panel procedure are unchanged.

- **Fit is derived from the panel's keys** once a view is keyed: fit = yes if every sound posture is aligned; no if no sound posture is aligned; mixed otherwise. The researcher's fit column (t.2, `18` §t.3) stays a design reading, used for the prompt audit until the panel has keyed. This supersedes reading fit from the researcher's column in any confirmatory analysis.
- **The AI's `linjaus` status is coded against that fit** (`27` §3.5): `sopii` right where fit = yes and wrong where fit = no, `ei_sovi` the reverse; `ei_liity` abstains (a miss when the answer had retrieved one of the view's basis records). An AI that says `sopii` at V10 is wrong, and that is measured, not corrected.
- **t.4's measures are reported per cell**, and C in the no-fit views is Paper 2's primary outcome (H13, `01` revision (u)).
- **t.5, the base-rate check:** its first use is validating the keys, before they are frozen; it is descriptive, not a third arm (`27` §2.4). This settles t.5's open "test or description" in favour of description.
- **New no-fit views** added in the rebuild (`27` §7.4) are keyed by the panel like the others, without being told they were designed.

### Reconciled with the build (5 Oct 2026)

- **Built:** `strategyExposureBeforePlan` (`derived-measures.ts`): per keyed view with a plan in force at view end, whether a `sopii` / `ei_sovi` notice preceded it, the last status, whether both were received, the count. It uses `directiveAdherence`'s coded plan. The correctness coding against the panel's fit (above) waits for the keys.
- **Decided (researcher, 5 Oct 2026):** the crews' return to L3 moves from step 13 to step 14 (no crew on the new front at V10; at step 14 they take a defensive line, consistent with the directive), and more no-fit views are added, at least one late (V12–V14), possibly one more. Both are on the corpus-rebuild branch, which waits for the index rebuild; the added views' keys come from the panel and arrive with that patch (`27` §7.3 c, §7.4, §7.5).

---

## Revision 6 Oct 2026 (x) — the plan is the only response in a view

Researcher decision (`01` revision (x)). Built 6 Oct 2026.

- **The sector plan is the only response the participant gives in a view.** It has the main effort and its posture (revision (t)), the secondary sector and the drone teams' task. Revisions are allowed until the view ends.
- **Withdrawn from revision (s):**
  - the outlook: both questions, their confidences, `OUTLOOK_KEYS` and `outlookScores`;
  - the outlook-to-plan coherence measure;
  - the rationale that was required after a rejected projection.
- **The sector-level measures stay:** H10's crews on L3, the drone survey of L3, the posture coding (revisions (t) and (u)), and the base-rate check.
- **New exploratory reading** (`09` revision (x)): in breach views, whether the main effort follows the projection's direction or the reported development. The key comes from the view's flag and its `flagReason`, and is written in the truth-only file beside the posture keys, citing its basis records by content.
- **No confidence on the plan.** It has no key in most views, so it could not be scored for calibration (researcher decision, 6 Oct 2026).

---

## Revision 6–8 Oct 2026 (y) — the secondary direct attack, whole-plan alignment, V14 and the t.2 table restated

> **8 Oct 2026 (aa):** the primary `sound` and `cell` count the **core** sectors only; boundary-only sectors in the accepted-sector wording and table below are the sensitivity (`soundWithBoundary`, `cellWithBoundary`; `viaBoundarySector` = accepting them changes the plan's coding). New fields `mainAligned`, `firstAfterFreeze`, `firstAfterBoundary`; see `27` revision (aa) aa.4.

Researcher decisions of 6 and 7 Oct 2026 (two persona review rounds). Built in `plan-types.ts`, `demo-directive.ts` and `derived-measures.ts` (`codePosture`, `directiveAdherence`); tested in `test/telemetry/derived.spec.ts` and `test/scenario/directive-sectors.spec.ts`. **This supersedes t.2's table, its "new front's sector (L3)" paragraph and its "Not every cell can occur" paragraph, and revision (s)/(t)'s sector label "L2 Kärki".**

### y.1 The secondary sector can carry a direct attack

`SECONDARY_TASK_IDS` is `task.direct-attack`, `task.hold-line`, `task.mopup` (direct attack added 6 Oct 2026). The main effort's posture field (t.1) is unchanged.

### y.2 Alignment is read over the whole plan

In phase B a plan is **aligned** when its main posture is `barrier_line` or `protect_values` **and** its secondary sector does not carry `task.direct-attack` (`againstSecondaryTaskId`). A secondary direct attack makes the plan **against**, whatever the main posture (researcher, 7 Oct 2026).

### y.3 Soundness: sectors from the front polygons, and the secondary route

- **Accepted sectors** are every sector the keyed front's mapped polygon touches (its vertices' sectors, or the nearest sector for a vertex in a gap), computed from the data (`frontSectors`, `headSectors`), never hard-coded. A sector reached only across a boundary is listed in `boundarySectors`; a plan sound only through one has `viaBoundarySector = true` (sensitivity). The build check (`directive-sectors.spec.ts`) wants each keyed fire at least 50 m inside its core sector.
- **The secondary route (`soundSecondary`).** A plan is also sound when its secondary sector carries a direct attack on the keyed front while its main effort, with a posture within the directive, is in one of the named sectors. `soundVia` records which route made the plan sound (`main_effort` / `secondary`).
- **An unlisted secondary direct attack** (one the key does not list as sound) makes the plan unsound **only when the main posture is aligned** (fix pass 4): in V11–V13 a barrier line with a secondary attack is D; at V9 a main-effort direct attack with a second attack elsewhere stays C.

### y.4 The t.2 table, restated (current build)

Sectors as computed on 8 Oct 2026 from `site-scenario.json`; they move only if the fire is regenerated.

| View | Fit | Sound main effort (accepted sectors; boundary-only) | Sound via the secondary sector | `direct_attack` main | `barrier_line` / `protect_values` main, no secondary attack | aligned main + secondary attack |
|---|---|---|---|---|---|---|
| V1–V7 | — | not coded | — | descriptive | descriptive | descriptive |
| V8 | Neutral | not scored | — | — | — | — |
| V9, V10 | **No** | `direct_attack` in **L2 or L3** (the new front, step 13; core L3, L2 boundary-only) | direct attack on the new front in L2/L3, main effort in any sector with an aligned posture | **C** in L2/L3; **D** elsewhere | **B** | **C** if the secondary attack is in L2/L3; else **D** |
| V11, V12 | Yes | `barrier_line` or `protect_values` in **L2 or L3** (the head's sector; L2 boundary-only) | none | **D** | **A** in L2/L3; **B** elsewhere | **D** |
| V13 | Yes | `barrier_line` or `protect_values` in **L3** | none | **D** | **A** in L3; **B** elsewhere | **D** |
| V14 | **No** | `direct_attack` in **L1 or L4** (the second flare-up, step 19; core L4, L1 boundary-only) | direct attack on the flare-up in L1/L4, **main effort in L3 (Lahdenkylä's sector)** with an aligned posture | **C** in L1/L4; **D** elsewhere | **B** | **C** if the secondary attack is in L1/L4 and the main effort in L3; else **D** |

**V14 (round 2, 5 Oct; secondary route 6 Oct 2026)** is a no-fit view: the origin's west edge flares up (~0.3 ha, flames under a metre, SPOT 19:23/19:30) where no crew works, while five crews hold R2 and Lahdenkylä is evacuated. Unlike V9–V10, its secondary route is sound **only with the main effort in the village sector** (L3), the front the directive's lines hold. The step-20 map draws the detached flare-up while SPOT reports it burning (accepted clipped outline, 8 Oct 2026). Whether the flare-up can carry the main effort is for the panel (DRAFT, `27` §7.4).

**Which cells can occur.** In the no-fit views (V9, V10, V14) B, C and D; in the fit views (V11–V13) A, B and D (B now occurs: an aligned posture outside the head's sector).

**Plan timing.** Each coded plan carries `afterBoundary` (merged views) and, since 7 Oct 2026, **`afterFreeze`**: whether the plan in force at view end was submitted or revised after the view's freeze was shown.

### y.5 H14 and the cells

H14 is coded on **alignment**: `h14Aligned` = 1 for A∪B, 0 for C∪D (researcher, 7 Oct 2026). The cell and soundness stay descriptive in the fit views; `viaBoundarySector` is the pre-registered sensitivity (`27` revision (y)). This supersedes revision (u)'s "A (1) vs D (0)" reading for H14.

### y.6 Sector naming

The four sectors are **L1 Pohjoinen / North, L2 Koillinen / North-east, L3 Etelä / South, L4 Länsi / West** (`site-scenario.json`), identical in every cell. "L2 Kärki / Head" is withdrawn (researcher, 7 Oct 2026): a sector named for the head told the participant where the main effort belonged. Sectors are **not drawn** on the map (researcher, 7 Oct 2026).

### y.7 What changes after 8 Oct 2026

> **Revision (ab):** a burnout from a held road is in line with the directive and is not a plan option; the coding below is unchanged (`ab.1`). The departure note is not a part of the cell (`ab.2`).

The coding above is unchanged by the Haku / Open Thinker redesign (`02` revision (z)). What it is compared **between** is not: the two Thinker cells no longer differ in a `linjaus` line, so revision (u)'s "`linjaus` status coded against fit" applies to logs before 8 Oct 2026 only. See `27` revision (z), OPEN.

---

## Revision 8 Oct 2026 (ab) — a burnout from a held road is in line; the departure note; resume-aware coding

Researcher decisions D3, D5 and D6 of 8 Oct 2026 (persona round 5; `27` revision (ab)). Built in `demo-directive.ts`, `plan-types.ts`, `allocation.ts`, `DecisionPanels.tsx`, `derived-measures.ts`. Tests: `test/scenario/directive.spec.ts`, `test/telemetry/derived.spec.ts`, `test/session/allocation.spec.ts`, `test/render/plan-draft-ui.spec.ts`.

### ab.1 A burnout from a held road is in line (D3)

Round 5 had the Open Thinker answer that a burnout "does not fit" the directive (V12). The key basis texts of **V11, V12 and V13** (`demo-directive.ts`, `BURNOUT_IN_LINE`) now state: *a burnout proposed from a held road is in line with the directive (a barrier-line technique) and is not a plan option, so no plan is scored on it.* The plan options are the posture field and the secondary sector's task (t.1, y.1); a burnout is neither, so **the coding of §t.2 and §y.4 is unchanged**: nothing is coded on a burnout, and the Open Thinker says "the directive does not cover it" (`02` revision (ab) ab.1). The burnout proposals in the corpus (`18` y.2) are neither aligned nor against, and the participant's reply to one is not a coded response.

### ab.2 The departure note (D5)

Plans from V8 may carry `departureNoted` (and `departureReason`, one line, at most 200 characters): the participant's own statement that the plan departs from the directive (`02` revision (ab) ab.4). `codePosture` copies it into the coding (`DirectivePostureCoding.departureNoted`); `directiveAdherence` exposes it per view (`departureNoted`: the note on the plan in force at view end, null with no plan). **It does not change the cell.** The cell is still alignment × soundness from the posture and the sectors (§t.2, §y.4); the note only says whether the participant called the departure themselves.

`accountableDeviation(records, keys)` takes the plans in force at view end **coded C** (against the directive, sound for the situation) and counts how many carried the note: `cViews`, `cWithNote`, `cWithoutNote`, `noteShareOfC` (null with no C view). C with the note is an **accountable deviation**; C without it is an unreported one. The reason's text is not coded. Descriptive (`27` revision (ab)).

### ab.3 Resume-aware coding

A view replayed after a `session_resumed` (`cycleReplayed`, as `replayedViews` in `freeze-measures.ts`) is entered again by a second `cycle_start`. `directiveAdherence` now **resets the view's entry on that replay**: the coded plan is the **last attempt's** (the one that ends in a `cycle_end`), and each entry carries `attemptStartSeq`, the `cycle_start` of the attempt it comes from. A repeated `cycle_start` with no resume before it does not reset. `openThinkerAnswersBeforePlan` keeps only the answers after `attemptStartSeq` and before the plan in force, so an earlier attempt's advice cannot appear in the later one. `finalPlanPerView` gives the plan in force when each main view ended (main effort, posture, secondary sector, drone tasking, revised or not), resume-aware in the same way: the material for H5 (`09`, divergence of plans). A view with no plan is left out.

### ab.4 The phase-A share is not a covariate (D6)

The phase-A compliance share ("direct attack where intensity allows" over V1–V7) is **post-treatment**: the Open Thinker is on offer from V1 on, so it can move the share. It is dropped as a covariate. The baseline is `baselineCompliance(records)`: the share of `direct_attack` among the plans in force at the end of the **practice view and V1** (`BASELINE_VIEWS` = 0, 1), before any treatment contact (null with no plan). `27` revision (ab) restates the model.

### ab.5 Stale text pointed here

§y.7's "The coding above is unchanged" stands as to the cells. Any statement that the phase-A share is a covariate (`27` aa.3, `09`) is superseded by ab.4.

---

## Revision 9 Oct 2026 (ad) — the projection-direction key; no water-drop or hose-lay tasks

### ad.1 The projection-direction key (revision (x)'s promised reading; `11` §7.20 item 2)

Written in the truth-only file beside the posture keys (`PROJECTION_DIRECTION_KEYS`, `demo-directive.ts`), authored from each breach view's flag and `flagReason` and checked against the bundle at import (the projection's head sector, `NEW_FRONT`, `SECOND_REKINDLE`):

| View | Flag | Projected | Reported development | Reads |
|---|---|---|---|---|
| V2 | Q | L2 | L2 (further along) | no |
| V4 | C | L2 | L2 (crown run and spots ahead of the head) | no |
| V6 | C | L2 | L1 (the wind backs; the north flank runs; HELI1 16:01) | yes |
| V9 | C | L2 | L3 (the rekindle; SPOT 17:01) | yes |
| V11 | C (depth) | — | none (non-spatial) | no |
| V12 | Q | L3 | L3 (further along) | no |
| V14 | Q | L3 | L4 (the second rekindle; SPOT 19:23) | yes |

`projectionDirectionReading` (`app/telemetry/projection-direction.ts`) reads the final plan's main effort: `projection`, `reported` or `neither`. Exploratory (`09` ad.2).

### ad.2 Water drops and hose lays (`11` §7.20 item 9)

**Decision (delegated by the researcher): no new plan options** — they would change the plan coding and Paper 2's alignment measure. §s's "Tasks by type" line listing *VD1: vesipudotukset* and *UGV1: letkulinjan veto* is **superseded** (the options were removed in revision (aa)). The briefing's setting text, the same in both groups, now says that laying hose and dropping water are not separate plan tasks: the crews lay hose as the chosen posture requires, and the water drone VD1, the helicopter and the hose robot UGV1 work autonomously (`briefing.ts` `AUTONOMOUS_ASSETS_*`). The roster cards of VD1, UGV1 and HELI1 say "not tasked by the plan". No record asks the participant to order a drop or a hose lay (checked over the corpus).

## Revision 19 Oct 2026 (ay) — the decision task after the COA audit (`31` §3.1–§3.3, §4)

- **Coding the act (RC).** The cell a plan lands in for H13 no longer depends on the label a participant picks for the same act: a plan *attends* the keyed front when its main effort attacks it directly or its secondary task on the front's sector(s) is `task.direct-attack`, mop-up or hold-line (a hose crew on a spreading rekindle is a direct attack in Finnish usage); an attending plan with an aligned main posture codes C. The build's label-based cell stays beside it as the sensitivity (`codePosture` `attended`, `cellByAct`, `app/telemetry/derived-measures.ts`). The panel's rating of the probe plans (V9-f, V10-f, V14-d) decides whether mop-up or a held line on the deciding front is sound; if not, the label coding stays primary.
- **V14 (RC).** `soundSectors.direct_attack` is removed; the key holds only through `soundSecondary` (main effort aligned in Lahdenkylä's sector); `soundVia` is reported.
- **t.3 extended.** The panel rates representative plans 1–7 for wisdom and feasibility, blind to the posture labels (`docs/audits/2026-10-19-skills/coa_rating_sheet.csv`, DRAFT), on each view's full record set; the posture × sector × secondary-task key is derived from the ratings, fit from the key as in (u). Probe plans that could fill a view's "impossible" cell are kept; a view keyed mixed or below 4 of 5 is reported, not coded.
- **The form.** One-line definitions of the secondary tasks in the practice tour, identical for all ("jälkisammutus: leviäminen on pysähtynyt"; "suora sammutus: leviävä reuna"; DRAFT, native check); "Linjan pito" becomes "Linjan pito tiellä tai vesistöllä"; the departure reason reads "Uusi tieto palosta". The posture order stays fixed (identical stimulus) and the pre-registration says so; the terms "suora hyökkäys" / "suora sammutus" await Pelastusopisto (radio TE-07). No same-sector secondary task before pilot 2 (coa F7, `11` §7.16.1 stays open).
- **Sectors.** y.4's "L2 or L3" for V9–V10 reads: the sectors the new front's polygon touches (computed; L3 on 7 Oct 2026); L2 is a sensitivity sector for V9–V10 (`boundarySectors`).
- **Retired:** the placeholder course-of-action bank `app/scenario/demo-decisions.ts` (revision (s)) is not study content and is not to be reused.
