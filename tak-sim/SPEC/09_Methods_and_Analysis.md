# 09 — Methods, protocol and analysis

**Version 3.1 · 17 September 2026** (v3.0 · 13 September 2026). Supersedes `04_Methods_v2.md`. All two-sitting, eight-cycle and two-scenario language is replaced.

> **Changelog**
> - **23 Oct 2026 (be)** — the difficulty audit (`docs/audits/2026-10-23-difficulty/`): pre-registered pilot-2 checks (seeking, key records reached, item discrimination, late items, map, the pretest, background groups, the badge, group parity); the map-reading pretest as a covariate only; `tools/power/h2-power.ts` to be re-run with pilot 2's told-class rates (power not changed now); three source-memory facts re-classed `pushed`. See the revision at the end.
> - **20 Oct 2026 (ba)** — `32`: Paper 2 as signal detection (H15c criterion added; the pre-stated primary-switch rule); the plan review's measures (before/after, revised at review, cited record opened; H17 restated); trust calibration (S-TIAS, stated vs actual projection reliability, behaviour); roadblock latency, the lowest-confidence share and AI answer length; resolution at group level only; source memory by a source-monitoring model (sensitivity); Paper 3 against an item-and-person baseline with a permutation null; RPD indicators exploratory. See the revision at the end.
> - **19 Oct 2026 (ay)** — `31`: H13 codes the act (RC) with the label coding as sensitivity; V14 via the secondary route (RC); fallbacks for mixed views; H2's dual-key, format and chance sensitivities; H2t's three-way told split (RC); exposure = retrieved ∪ digest ∪ recent; the error-class fold; H-T as an item-level model; new covariates and exclusion rules; the pre-registration list. See the revision at the end.
> - **19 Oct 2026 (ax)** — 100 = 2 × 50 (`30`): H2 is the overconfidence gap on 24 items (primary), resolution secondary; H2t, H-T, H18 added; H13 is the guide against Haku, H16 withdrawn; `aiStatedKey` as the key secondary analysis; Paper 3 pre-registered; a period term for a forced model-build change; power recomputed by the updated tools. See the revision at the end.
> - **11 Oct 2026 (au)** — 210 = 3 × 70: H2 compares Haku (70) with the pooled Thinker cells (140); Paper 2 compares 70 with 70; every power statement for the old n is to recompute. See the revision at the end.
> - **10 Oct 2026 (an)** — the baseline is redefined as "before any order-bearing contact" (`BASELINE_VIEWS` stays 0, 1), because since revision (am) the Thinker cells meet the Thinker in VP; `chatQuestionsForCoding` flags practice-view questions and leaves them out by default. See the revision at the end.
> - **10 Oct 2026 (al)** — H13 is `reasoning_intent` against `reasoning_once` (supersedes aa.6's pooled contrast); the treatment changes of (aj) and (al) and a recommendation not to pool sessions across them; the AI-verdict covariate is the per-option `aiVerdicts`; the US2 scan-to-find limitation for H3. See the revision at the end.
> - **9 Oct 2026 (ai)** — closed items (no open-ended questions): H3 re-registered on the V13 area item (primary: the north-edge hit) with the V14 backup and its confidence as a secondary recognition measure; multi-select options as binary indicators; `felt.wrong` and "a report contradicted another" never detection evidence; §5.2 codes and §6.1's free-text items replaced; `last.basis` exploratory, reliance from the logs; Gate 2 re-checked in the pilot. See the revision at the end.
> - **9 Oct 2026 (ad)** — pre-registered: a view with more than half its freeze items missing is excluded from that view's SA score (missing is never wrong); the projection-direction readings (plan and V14 item) are built, exploratory.
> - **9 Oct 2026 (ac)** — AI literacy (SNAIL, Laupichler et al. 2023; amended from AILIT-S for comparability with Fernandes et al. 2026) measured after consent: self-report, with the TU/CA/PA means computed in the analysis over the rated items. An exploratory covariate or moderator (TU especially, for reliance and overconfidence); no new hypothesis. A skipped questionnaire leaves the covariate missing, and placing it first may prime AI self-perception. See the revision at the end.
> - **8 Oct 2026 (ab)** — idle counted only inside the views; `afterFreeze` on the H10 measures; `plantedExposure` (H9); `finalPlanPerView` (H5); the blind coding sheet gains the previous question and redacts tool names; covariates for Paper 2 (baseline = practice + V1; the AI's verdict). See the revision at the end.
> - **8 Oct 2026 (aa, post-commit)** — disclosure that Haku's answers come from a language model (both groups); the instructed-response attention check and the exclusion helpers with pre-register defaults (aa.7); the draft H2a question-coding scheme and extractor (aa.8). See the revision at the end.
- **8 Oct 2026 (aa)** — Paper 1 restated (no no-LLM control); exposure for H9, H3 and H10; replayed freezes; information-seeking kinds and deprecated measures; the reading grace; Paper 2's H13–H15 resolved and the coding (`27` aa). See the revision at the end.
> - **8 Oct 2026 (z)** — the Haku / Open Thinker redesign (`02` revision (z)): H2's contrast now reads as Haku chat vs Haku chat + Open Thinker; Paper 2's H13–H15 are OPEN (`27` revision (z); resolved by (aa)). See the revision at the end.
> - **6–7 Oct 2026 (y)** — V14 no-fit; whole-plan alignment; sectors from the front polygons; H14 on alignment with the boundary-sector sensitivity; `afterFreeze` / `afterBoundary` splits; power for 3 + 3 views (`27` revision (y)); attention records emitted for the exclusion rules; recommended pre-registrations. See the revision at the end.
> - **4 Oct 2026 (u)** — Paper 2's analysis plan and power from `27` (H13 primary; H14–H16 Holm; H17 and conditioned analyses exploratory); supersedes revision (t)'s "No Paper 2 power simulation has been run" and the exploratory group clause; Paper 1's phase-B pooling rule; debrief for the strategy-guided cell. See the revision at the end.
> - **4 Oct 2026 (t), review round 2** — revision (t) analysis notes amended in place: phase A descriptive; V9–V10 cells sector-aware; `afterBoundary` in merged views; the pushed-facts note restated (V11 the one recorded-only fit); the ceiling risk noted.
> - **4 Oct 2026 (t)** — H8 and the Paper 2 power statements withdrawn; H11 and H12 analysed per view, with the phase-A posture as baseline and decay read only within the fit views; base-rate comparison; debrief and pre-registration consequences. See the revision at the end.
> - **1 Oct 2026 (r)** — exploratory measures of metacognitive control (decision commitment time, allocation revisions); freeze-position covariate and an H2 sensitivity analysis; source attribution and probe reactivity exploratory; calibration on the 25/50/75/100 scale; H9 read at V12; session language as a recorded factor. See the revision at the end.
> - **25 Sep 2026 (q)** — live Thinker: consent and data protection; exposure analyses exploratory; limitations restated (`14` revision (q)).
> - **25 Sep 2026 (p)** — 14 views; baseline covariate and H7 dropped; session ~100 min (`26`).
> - **25 Sep 2026 (o)** — primary analysis restated (H2 on blanked L2/L3 SA items, two-sided); setting text in the briefing; the planted record in the debrief; limitations. See the revision at the end.
> - **23 Sep 2026 (j)** — radio removed (`02` revision (j)): groups Haku / Haku + LLM; automated-responder text withdrawn; new limitation. See the revision at the end.
> - **17 Sep 2026 (f)** — LLM (facts) group removed. Two groups: Radio (70) and LLM reasoning (130, pull-only); LLM reasoning split 65 / 65 at the hinge (guidance once vs. intent line in AI answers).
> - **17 Sep 2026 (e)** — three Paper 1 groups restored — Radio, LLM, LLM reasoning; both LLM groups pull-only; only the LLM-reasoning group is split at the hinge by how it receives the guidance. Group sizes open (default 70 / 65 / 65).
> - **17 Sep 2026 (d)** — two groups (no AI 70, AI 130); AI group pull-only with group-specific training; AI group split 65/65 at the hinge, the via-AI half receiving query answers framed against the commanded strategy; branch choice adopted with four authored options plus *Ei mikään näistä*, no free text; per-choice alignment feedback removed.
> - **17 Sep 2026 (c)** — only the reasoning-AI group is split by guidance mode; prologue warm-up; 10 freezes × 5 items, 6 SPAM, 9 unprobed (see `15` v1.1).
> - **3.1 · 17 Sep 2026** — Participants (F8), procedure (F5), guidance split (F4) and power statements updated.

---

## 1. Administration

**Remote and unsupervised, on the participant's own computer**, via a hosted web application. There is no operator present at any point during the session.

Four consequences, each handled rather than absorbed.

**No live confederate.** The `directed` responder is automated, and the condition is named `directed` rather than `human` for that reason (`02` §1.1).

**No retrospective walkthrough inside the session.** It moves to a separately scheduled remote video call with a subsample, conducted against a replay of that participant's own session. What that costs is stated in §5.2.

**No invigilated attention.** Replaced by attention checks, idle and blur logging, a competence gate in training, and the exclusion rules in §6.

**Data leaves the participant's device.** The earlier claim that local-only processing removed a class of data-protection problem no longer holds. See §8.

---

## 2. Participants

> **[SUPERSEDED 2026-09-17]** Target and stratification updated in the amendment below.

Serving or training officers at wildfire incident-command level, recruited through a rescue-services training institution and regional rescue departments.

**Target thirty per condition after exclusion; recruit 110–130**, the upper figure raised because unsupervised administration and a 102-minute session both raise expected attrition.

> **The pool figure requires verification before the build reaches condition configuration.** Three conditions at thirty each is the minimum viable form of the mechanism design. If the realistic pool at this echelon is sixty, the design changes to two conditions or a within-subject structure. That decision is cheap now and expensive later. See `11` §1.1.

**Allocation.** Block randomisation with stratification on incident-command experience and prior simulation exposure, performed server-side at session start. The client never chooses its own condition.

**Covariates recorded:** role and rank, years of service, incidents commanded, prior simulation exposure, self-reported familiarity with the scenario region, and the environment descriptors captured automatically — viewport dimensions, device pixel ratio, pointer type, browser, operating system, and the pre-flight benchmark score.

**Viewport size is not a nuisance variable.** It determines how much of the map is visible, which affects every information-seeking measure, and it enters the models as a covariate.

---

## 3. Procedure

> **[SUPERSEDED 2026-09-17]** The pre-session battery row is reduced to 15 min; warm-up block and tutorial added; session ~135 min. See `15` §2.

| Stage | When | Duration | Notes |
|---|---|---|---|
| Pre-session battery | Several days before | 45 min | `01` §7. Never on the day |
| Scheduling and technical check | Before the day | 5 min | Pre-flight run standalone; refusal handled before the session is booked |
| Consent confirmation and briefing | Session start | 12 min | Includes the scripted-exercise statement, `06` §4.6 |
| Training scenario | Session start | included above | Three practice cycles in the participant's own condition, with a competence gate |
| **Cycles 1–10** | | ~35 min | Phase A |
| **Hinge pause** | Between 10 and 11 | 5 min | Dismissible early. Strategic guidance delivered on exit |
| **Cycles 11–20** | | ~35 min | Phase B |
| Post-session questionnaire | Immediately | 15 min | Before any debrief content |
| Asynchronous written debrief | Within 48 h | — | §5.1 |
| Retrospective walkthrough | Subsample, separately scheduled | 45 min | §5.2 |

**One continuous session.** The twenty cycles are not split into sittings. Sustained attention under accumulating fatigue is part of the phenomenon, and the hinge pause is the only break.

**Attestation, at session start, worded to match:** *that the session will be completed in one sitting without interruption; that no external sources or colleagues will be consulted; and that the scenario content will not be discussed with anyone who may also participate.* The previous wording implied a sitting could be one of several and must not be reused.

---

## 4. What the participant is told

They are commanding a wildfire incident in southeast Finland at the level of a *pelastusjoukkue*, reporting to a duty officer. They will receive reports, may seek further information by the means available to them, and will be asked at intervals to judge a projection, state their confidence, and assign resources.

They are told plainly that **the incident develops according to its own dynamics, fixed in advance so that all participants face the same situation, and that their decisions are recorded and evaluated.** They are not told their decisions "do not matter" — decisions are scored for robustness and safety, and doubt–action coherence is a primary measure.

They are not told the projection's accuracy rate, that a contradiction is embedded, or what the conditions are.

---

## 5. Debrief and reasoning mode

### 5.1 Debrief — required, not optional

A written debrief is sent within 48 hours. It discloses the embedded contradiction and the omission, explains why they were there, states the projection accuracy rate, and gives the participant a route to withdraw their data after learning what the study was doing.

The debrief is not a courtesy. Participants were given a projection engineered to be wrong at a known rate and a planted inconsistency. Leaving professionals with the impression that their judgement failed, when the materials were built to produce that impression, is not acceptable. The debrief is asynchronous and written because the session is unsupervised, not because it is optional.

**The debrief is sent after the questionnaire, never before.** A debrief that reveals the planted inconsistency contaminates every self-report after it.

### 5.2 Reasoning mode

The direct test of whether the machine moves experts out of recognition-primed processing.

Collected by **retrospective walkthrough against a replay of the participant's own session**, on a separately scheduled remote video call with a subsample, audio-recorded and coded. Not by live think-aloud, which at this tempo would itself push participants toward deliberation and contaminate the comparison.

Codes: distinct options considered before commitment; presence and depth of mental-simulation statements; whether alternatives were compared or the first workable option satisficed; explicit assumption statements; self-reported basis for the judgement. (*Revision (ai): the in-session basis is now the closed `last.basis`; the walkthrough's basis code is read against it — see the revision at the end.*)

**What decoupling costs.** The walkthrough now happens days later rather than minutes later, so recall is weaker and the replay carries more of the load. The subsample is self-selecting among those willing to schedule a second session, which is a bias to declare. The measure therefore triangulates rather than carries a hypothesis. Target twelve to eighteen participants, balanced across conditions.

---

## 6. Post-session questionnaire and exclusions

### 6.1 Questionnaire

Administered immediately, while the session is fresh, and before any debrief content.

- Perceived workload, using a short validated instrument — **required** for the workload-confound check (`02` §5).
- Perceived quality and trustworthiness of the situational picture.
- Trust in the information channel.
- **Perceived own accuracy** — how many of the twenty containment judgements the participant believes they got right. Paired with actual accuracy, this is a second, cruder calibration measure at almost no cost, and it is the measure closest to the published performance–metacognition disconnect.

Substituting partially for the walkthrough:

- self-reported number of distinct possibilities considered at the most recent judgement;
- self-reported basis for that judgement, as short free text (*revision (ai): multi-select with "which mattered most"*);
- whether the participant recalls disagreeing with the projection at any point, and what they did about it;
- whether anything in the picture felt wrong.

(*Revision (ai), 9 Oct 2026: no item is free text. `last.basis` and `disagreement.action` are multi-select, `disagreement.action` shown only after "yes"; `felt.wrong` is yes / no / unsure without a content list; `directive.fit` is added. See the revision at the end.*)

Fatigue items at the start and at the end, so the fatigue trajectory has a self-report anchor alongside the behavioural one.

These are retrospective self-reports and weaker than behavioural coding. Their role is to triangulate the log-derived measures, not to carry a hypothesis, and the chapter says so.

### 6.2 Exclusion rules

Pre-specified, applied blind to condition and outcome.

A session is excluded for any of the following:

- Session marked partial by a missing end-of-session checksum record.
- Cumulative `window_blur` exceeding a declared threshold.
- Cumulative idle above threshold exceeding a declared proportion of task time.
- Judgements submitted faster than a pilot-derived plausible-reading floor.
- Failed attention check.
- Fewer than a pre-set minimum of information-seeking acts.
- Attestation declined.
- Evidence of repeated attempts on the same token.
- More than one resume, or a resume after more than a declared interval.
- High self-reported familiarity with the scenario region above a pre-set threshold, after first entering as a covariate.
- Self-reported prior knowledge of the scenario or the planted contradiction.

Pre-flight refusal prevents the session rather than excluding it.

**Plan for 25–35% attrition**, verify the surviving allocation stays balanced across conditions, and report the exclusion cascade as a figure.

---

## 7. Analysis plan

Pre-registered before collection. Models below are the confirmatory set; anything else is labelled exploratory in the paper.

### 7.1 Primary

**Calibration (H2).** Brier score with calibration and resolution components separated, computed per participant, modelled with condition as the predictor and cycle index, phase, viewport size and baseline metacognitive efficiency as covariates. In addition, an item-level confidence-by-accuracy interaction model is fitted; it is the more sensitive form and is the pre-registered primary test. Pre-registered primary contrast: `substitutive` versus `assistive`.

**Detection (H3).** Logistic model on the blind-coded binary from the cycle-18 open probe, with the cycle-20 forced choice as a secondary outcome. Condition as predictor. (*Re-registered 9 Oct 2026, revision (ai): primary = the V13 area item's north-edge hit; secondary = the V14 backup with its confidence, labelled recognition. See the revision at the end.*)

**Mechanism (H6).** Within-participant contrast between expectation-marked and unmarked cycles, with the condition-by-marking interaction as the test. Counterbalance order enters as a covariate.

### 7.2 Secondary

Judgement accuracy (H1) as a precondition check. Coverage confidence against outcome (H4). Between-participant divergence of judgements, localisations and allocations (H5), as dispersion by condition. Metacognitive efficiency predicting in-task calibration by condition (H7). Intent alignment across phase B (H8), with the guidance-mode confound declared.

Relative accuracy on rejection. Doubt–action coherence, with the pilot-established base rate. Allocation robustness and allocation safety, scored separately. Tier-4 discovery rate by condition and by item. Source-selection tracking against authored reliability. Drawer reliance.

### 7.3 Proxy validation by temporal holdout

**Proxies are developed on cycles 1–10 and evaluated on cycles 11–20 with no refitting.** A proxy that predicts calibration only on its development half is an artifact.

This is weaker than cross-scenario transfer: content and participant are shared, the phases differ systematically (the hinge, the fatigue gradient), and phase B is not an independent sample. It is declared as a limitation in exactly those terms. It replaces the transfer test that a second scenario would have provided, and that trade was made deliberately (`01` §2).

### 7.4 Blinding

Coding of the open uncertainty probe (*none since revision (ai): the area item is scored mechanically*) and of the walkthrough transcripts is done blind to condition by a coder who did not author the scenario. Inter-rater reliability on a 25% double-coded subset is reported.

---

## 8. Power

> **[SUPERSEDED 2026-09-17]** The battery-based per-participant estimate no longer exists; see amendment.

No closed form exists for the primary analysis. Power is established **by simulation**: synthetic datasets across plausible effect sizes using variance components from pilot 3, the pre-registered models run against each, and the detectable effect size at 80% power reported for the primary contrast.

Run after pilot 3 and before the pre-registration is locked. Use the raised attrition assumption.

Twenty containment judgements per participant is an improvement on the eighteen the two-scenario structure would have given, and it is still too few to support a per-participant metacognitive-efficiency estimate. That estimate comes from the pre-session battery, which is why the battery is load-bearing rather than preliminary.

---

## 9. Ethics and data protection

Ethics review at LUT and at the participating institution. Remote informed consent with a downloadable copy. **Written assurance from the host authority that participation and performance do not affect assessment or appraisal** — without it, the session is an evaluation and the data is about something else.

**Data protection.** Query text, marked geometry, free-text rationale and questionnaire responses are transmitted from the participant's own device. Required:

- EU hosting;
- a processing agreement with the host;
- TLS in transit and encryption at rest;
- pseudonymous session tokens carrying no identifying data;
- a stated retention and deletion schedule;
- consent text that says plainly what is transmitted and where it is held.

**Query text and free-text fields are named explicitly as personal data.** Walkthrough recordings are personal data under their own consent clause.

**Settle this before pilot 1, not before the main study** — pilot 1 already transmits real participant data.

Scenario materials are fictional in incident and real in geography and data, all from CC BY 4.0 sources, with attribution rendered in the instrument and stated in the methods section.

---

## 10. Pilot plan

**Pilot 1 — instrument, telemetry and remote delivery. Eight to twelve non-specialists.** Checks:

- determinism;
- every telemetry record present with its fields;
- every derived measure in `07` §4 computable;
- the analysis pipeline end to end;
- local-first logging and upload resumption under a deliberately interrupted connection;
- behaviour on small windows, trackpads and three browsers;
- the training competence gate;
- session timing against the `08` §5 budget;
- the fatigue profile across a full 102-minute session.

This pilot also collects the Finnish query corpus used as the retrieval recall regression set.

**Pilot 2 — materials calibration. Four to six officers or instructors, remote.** Checks:

- plausibility;
- **containment accuracy in the 60–80% band**;
- per-item discrimination;
- **detection rate for each of the three candidate contradictions in the 20–70% band**;
- no Level 2 recall item answerable verbatim from the channel.

The contradiction is selected in this pilot, and the selection is recorded in the scenario version.

**Pilot 3 — full remote dress rehearsal. Two sessions per condition.** Checks:

- timing;
- channel engagement rate in `substitutive`;
- probe intrusiveness;
- the continuous-session flow and the hinge pause;
- fault and resume behaviour;
- attrition and upload completeness;
- doubt–action coherence base rate.

**Variance components for the power simulation come from this pilot.**

**Do not proceed to collection until both gates in `01` §5 are met.**

---

## 11. Limitations to state in the chapter

The `directed` condition used an automated responder rather than a person, so it contrasts directed with pooled retrieval rather than human with machine mediation.

Sessions were unsupervised on heterogeneous hardware; environment descriptors are covariates but cannot fully absorb the variance.

Proxy validation was by temporal holdout within one scenario, not by transfer to a second scenario; phases A and B differ systematically and phase B is not an independent sample.

One scenario means scenario-specific content cannot be separated from the manipulation. The conditions are compared within the same content, which is the correct comparison, but generality across incidents is unestablished.

Guidance mode is nested inside condition rather than crossed with it, so Paper 2's claim is about a package — a channel that integrates and maintains intent — not about continuous guidance in isolation.

Reasoning-mode data comes from a self-selected subsample, days after the session, against a replay.

Fire magnitude sits at the severe end of Finnish experience and the projection breach rate is deliberately higher than an operational system's. Both are declared in the validity claim and both limit generalisation to real deployed tools.

Freezes are intrusive; the defence rests on within-participant calibration being less sensitive to uniform intrusion than absolute performance would be, and on intrusion being constant across conditions.

Idle time without eye tracking is ambiguous between thinking and disengagement. It is recorded and is not over-interpreted.

---

## Amendment 2026-09-17

**Participants.** 200 firefighters, mostly at *pelastusjoukkue* command level (`15` §8). Randomisation stratified on echelon, incident-command experience and prior simulation exposure; guidance mode randomised within the reasoning-AI group (`02` amendment). **Open:** whether 200 is recruited or completed; with the planned 25–35% attrition, recruited 200 leaves ~130–150 for analysis.

**Power.** Still established by simulation after pilot 3. Chat-stage simulations (assumptions, not pilot values) suggested:

- with ~67 per Paper 1 group, medium effects on SA accuracy and calibration are detectable;
- with ~33 vs ~33 in the Paper 2 primary contrast (reasoning AI, once vs. maintained) and ~10 phase-B decisions each, a 15-point alignment difference is detected with power ≈ .74 and a 10-point difference with ≈ .4;
- after attrition (~22–25 per cell) power falls further.

Enlarging the reasoning-AI group is the main lever (`02` amendment). These estimates are to be replaced by the pilot-based simulation. Metacognitive efficiency is estimated hierarchically from all paired responses (`15` §7).

**Limitations (§11) — updated.** The guidance-mode confound is removed; replace that paragraph with: *guidance mode was randomised within the reasoning-AI group, so Paper 2's contrast isolates maintained vs. one-time guidance, at the cost of small cells (~33 each before attrition).* Add: *no offline metacognition battery was administered; baseline metacognition was measured in-task during a no-AI prologue, and domain-general metacognitive ability is not measured.* Add: *the reasoning-AI condition served pre-compiled, reviewed interpretations rather than live generated text.*

---

## Revision 17 Sep 2026 (d) — supersedes earlier amendments where they conflict

**Participants.** 200 firefighters: **70 no AI, 130 AI**, the AI group split 65 / 65 for Paper 2.

**Primary contrast (replaces §7.1 "`substitutive` versus `assistive`").** No AI vs. AI, phase A.

**Power (chat-stage, assumption-based).** Paper 1: 70 vs. 130 has the power of about 91 per group in a balanced design; with 30% attrition about 64. Paper 2: 65 vs. 65 with ~10 phase-B decisions each gives power ≈ .96 for a 15-point alignment difference and ≈ .6 for a 10-point difference; with 30% attrition (~45 per cell) about .88 and .5. Replace with the pilot-based simulation.

**Limitations (added).** Paper 1 compares AI support with none and cannot separate integration from machine retrieval. The Paper 2 manipulation depends on how often participants query; its dose is reported and modelled.

---

## Revision 17 Sep 2026 (e) — supersedes revision (d) where they conflict

**Participants.** Default 70 Radio / 65 LLM / 65 LLM reasoning (split ~32 / 33 at the hinge); allocation open (`02` revision (e)).

**Primary contrast.** LLM reasoning vs. LLM, phase A (as v3.0 §7.1, pull-only).

**Power (assumption-based).** Paper 1 primary, 65 vs. 65: medium effects detectable. Paper 2, ~32 vs. 33 with ~10 phase-B decisions: power ≈ .75 for a 15-point alignment difference and ≈ .4 for 10 points, before dropout; with ~30% dropout about .6 and .3. Enlarging the LLM-reasoning group is the main lever.

**Limitation (replaces (d)).** Paper 2 cells are small unless the LLM-reasoning group is enlarged; the Paper 2 manipulation's dose depends on query volume.

---

## Revision 17 Sep 2026 (f) — supersedes revisions (d) and (e) where they conflict

**Participants.** 70 Radio, 130 LLM reasoning (65 / 65 at the hinge).

**Primary contrast.** LLM reasoning vs. Radio, phase A.

**Power (assumption-based).** Paper 1: 70 vs. 130 ≈ 91 per group balanced; ≈ 64 after 30% dropout. Paper 2: 65 vs. 65 with ~10 phase-B decisions: ≈ .96 (15 points) and ≈ .6 (10 points); after 30% dropout ≈ .88 and ≈ .5.

**Limitation.** Paper 1 cannot separate integration from access to an AI; the LLM-facts arm was deliberately dropped.

---

## Revision 23 Sep 2026 (j) — Haku vs. Haku + LLM

Follows `02` revision (j).

**Participants.** 70 Haku, 130 Haku + LLM (65 / 65 at the hinge). Numbers, power and randomisation are unchanged from revision (f).

**Primary contrast.** Haku + LLM vs. Haku, phase A.

**Withdrawn text.** The "No live confederate" paragraph (§ design) and the limitations sentence "the `directed` condition used an automated responder…" are withdrawn. There is no responder.

**Methods text, new (for the paper).** *"Participants could not contact field units. In both groups, information came from pushed reports and from a structured search over the incident's recorded information (logs, recorded radio traffic transcripts, registers, sensor data). In one group, an AI assistant could also be asked. The two groups had identical search tools, so the AI was the only difference between them."*

**Limitations, new:**

1. **Realism.** Incident commanders in the field talk to their crews. Participants were framed as incident commanders but could not transmit. Knowledge that crews hold but never record was therefore unavailable to every participant. Findings concern metacognition over recorded information.
2. **Construct.** Revision (f)'s limitation stands: Paper 1 cannot separate integration from having an AI to ask. The new design removes a second difference: the groups no longer differ in access to unrecorded knowledge, which in the radio design only asking could reach. That difference was never part of the manipulation.

**Analysis changes.** Source-selection analyses use the query builder's KUKA choices (`07` revision (j)). Every analysis of radio requests, addressees or request wording is removed from the pre-registration.

---

## Revision 25 Sep 2026 (o) — primary analysis, briefing, debrief and limitations

Follows `02` revision (o) and `01` revision (o).

- **§7.1, primary.** The pre-registered primary test is H2: an item-level confidence × accuracy model on the blanked L2/L3 SA items, phase A, Haku + LLM (cells 2 and 3 pooled) against Haku, tested two-sided. It supersedes the `substitutive` versus `assistive` contrast. Covariates are as in §7.1. H1 is reported alongside it and is tested two-sided.
- **§4, briefing.** The setting text for the autonomous assets (`02` revision (o) §2) is added, word for word the same in both groups. It says nothing about the reliability of any AI. *(Since revision (ae), 9 Oct 2026, there is no briefing page: these sentences open the practice tour's welcome popup, `15` ae.1.)*
- **§5.1, debrief.** The debrief also discloses the planted false record: what it said, why it was there, and that the AI (in the AI group) passed it on by design.
- **§11, limitations.**
  - The commander who cannot transmit is still declared. The autonomous-assets setting explains the scripted movements but does not make a systems-only command role fully realistic.
  - The failure of input rests on a **single** planted record, so it supports a case-level claim, not an estimate of how often such errors occur.
  - The AI is a closed responder, not a live model. The claim is about an agent that integrates information on request, with fixed and reviewed wording.

---

## Revision 25 Sep 2026 (p) — fourteen views

Follows `26`.

- **§7.1 covariates:** baseline metacognitive efficiency is dropped (no prologue baseline). Cycle index becomes view index, and projection horizon (20 or 40 min) is added as a covariate in every Type J analysis.
- **§3, timing:** about 100 minutes on the day. The attrition planning of §6.2 (25–35%) is kept until pilot 1 measures it.
- **§5.1, debrief:** also explains the rekindle arc: the objection was scripted, and the order to move was part of the design.
- **H10** is added to the secondary analyses (`01` revision (p)).

---

## Revision 25 Sep 2026 (q) — a live LLM

Follows `14` revision (q).

- **Consent and data protection:** the consent text states that Thinker questions are sent to an external AI service (Anthropic) through the study's server, and that no personal data should be typed. The data-processing agreement and the university's data-protection review are completed before pilot 1.
- **Exposure analyses are exploratory.** What a participant received from Thinker depends on how they asked, and asking skill may itself relate to SA. The randomised group contrasts (H1, H2, and H9/H10 as intention-to-treat) are confirmatory. Analyses conditioned on exposure (whether F7 or the objection appeared in an answer the participant received) are exploratory.
- **Coding.** From the log, code per answer: whether F7 was relayed, whether the objection appeared, whether both V13 reports appeared, and whether the model flagged a conflict unprompted.
- **§11 limitations, restated (replaces revision (o)'s third bullet):** Thinker is a live model at temperature 0. Its wording is not bit-reproducible and is logged in full. The findings generalise to retrieval-based LLM assistants over incident records, not to pre-digested situation summaries.

---

## Revision 1 Oct 2026 (r) — monitoring and control; the new view flow in the analysis

Follows `15` revision (r), `16` revision (r), `08` revision (r) and `07` revision (r). **No hypothesis is added and none is changed.** The confirmatory set (H1, H2, H9, H10) stands.

### Measurement rationale (for the thesis)

Nelson and Narens' (1990) framework separates two directions of flow between the object level (here, the participant's picture of the situation and their orders) and the meta level: **monitoring**, the meta level's assessment of the object level, and **control**, the meta level's action on it. The study's confidence ratings, and the calibration computed from them, measure **monitoring**. They do not show what participants *do* with their uncertainty.

The new view flow gives two behavioural measures of **control**:

- **Decision commitment time:** from the decision panel's opening to the allocation's submission (`07` revision (r)). With no countdown and no upper limit (`15` revision (r)), when to commit is the participant's own choice.
- **Allocation revisions:** whether, how often and how much a participant who confirmed early changes the allocation before the minimum is reached.

Confidence (monitoring) and these measures (control) together allow the question whether low confidence is followed by more seeking, later commitment or revision, and whether that link differs between groups.

**Status: exploratory, two-sided, no direction predicted.** A plausible argument runs each way. An AI answer may let participants commit sooner, either because their picture is better or because the answer substitutes for their own checking. It may also prompt more checking and later commitment. The analysis reports the group difference and the within-participant relation of confidence to commitment time and revisions, labelled exploratory.

**Cautions to state with the results.**
- Commitment time in the AI group includes time spent waiting for Thinker answers (logged latency, `07` revision (q)). It is reported both with and without that waiting time.
- Revisions are possible only after early confirmation, so the revision measure is defined among views confirmed early, which is itself a participant choice. Early confirmation is reported first, then revisions conditional on it.
- Commitment time also reflects reading speed and familiarity with the interface. View index and the pre-session covariates enter every model.

### The freeze-position covariate (H2)

Freezes now fall at pre-planned offsets and can come after the allocation has been committed (`15` revision (r), r.3). `decisionCommittedBeforeFreeze` and `decisionStep` enter the H2 model as covariates. **Sensitivity analysis:** H2 is re-fitted on the freezes that fell before commitment. The covariate is needed for the group contrast because commitment pace may differ between groups.

### Calibration on the four-point scale

All confidence questions use 25/50/75/100 (`08` revision (r)). For four-option items 25 is chance. Type J has three options (chance 33 %), so its calibration is reported against its own chance level and is not pooled with four-option items without saying so. The coarse scale lowers the resolution available to the Brier decomposition. That is a property of the instrument, stated with the results.

### Other analyses, exploratory

- **Source attribution** (`08` revision (r)): the distribution of self-reported sources per SA item, and the check against the log. The option sets differ between groups (Thinker only in the AI group).
- **Probe reactivity:** probe-independent measures in views with and without a blanked freeze. Confounded with view content, because the unprobed views (V1, V9, V13) were chosen for design reasons.
- **H9 is read at V12 only** (`26` revision (r), `01` revision (r)); F7 is asked once.

### Session language — a recorded factor

Sessions can run in Finnish or English (language chosen on the first page, logged in the header, `07` revision (r)). Thinker searches a Finnish index in both. For English questions, the lexical half of the hybrid retrieval matches fewer terms, so retrieval is expected to be weaker (`14`). Language is therefore **recorded and reported**: the number of English sessions per group, and, if there are enough of them, language as a covariate in the AI-exposure analyses. Any language effect is exploratory. Open item: `11` §7.10.

### §11 limitations, added

- **No time pressure.** No countdown was shown and views had no upper limit, so that a visible deadline would not push participants toward relying on the AI to save time. Field command runs under time pressure; the study's decisions were unhurried by comparison (`11` §7.10 (b)).
- **Freeze position varied with the participant's pace.** Offsets were identical for everyone, so whether a freeze fell before or after the participant's decision depended on how fast they decided. This is modelled as a covariate, not removed.

---

## Amendment 2 Oct 2026: H2 power with the 6-item freezes

Follows the SAGAT rebuild (`08` amendment of 2 Oct 2026). Each main freeze now has 6 items (2 × L1, 2 × L2, 2 × L3) instead of 3. H2's primary window is the L2/L3 items of the freezes in V2, V4, V5 and V7. It therefore holds **16 items per participant (4 freezes × 4) instead of 4**. **No hypothesis and no model is changed.** This amendment estimates what the larger window buys. It does **not** replace §8's pilot-based simulation, which still runs after pilot 3 with pilot variance components.

### Method

The simulation is `tools/power/h2-power.ts`, run with `npx tsx tools/power/h2-power.ts [--reps 1000] [--seed 20261002]`. It is deterministic: a seeded xoshiro128** stream per grid cell, no `Math.random`, no clock. It ran 1000 replicates per cell, α = .05, two-sided.

**Data-generating process.** Every value below is an assumption, not a pilot value.
- **Items.** Item difficulty is b_j ~ N(0, 1). The bank is drawn once per replicate and is the same for every participant.
- **Participants.** Ability θ_i ~ N(0, 0.8²). Personal confidence bias u_i ~ N(0, 0.5²).
- **Accuracy.** p_ij = .25 + .75 · logistic(θ_i − b_j). These are four-option items with chance at 25 %. Mean accuracy is about .62.
- **Confidence.** s_ij = logistic(λ_g · logit(p_ij) + δ_g + u_i + ε_ij), with ε ~ N(0, 1). It is reported at the nearest step of the instrument's 25/50/75/100 scale.
- **Haku (directed):** λ = 1 and δ = 0.3, which is mild overconfidence (population gap about +.045).
- **Thinker (substitutive):** λ and δ vary by scenario. λ is **resolution** (how well confidence tracks the item's real chance) and δ is **bias** (overconfidence).
- **Accuracy is equal in the two groups.** The scenarios are pure calibration effects; H1 is a separate test.

**Sample sizes.** All are Haku / Thinker, with cells 2 and 3 pooled as in revision (o):
- **70 / 130:** the plan (revision (j)).
- **49 / 91:** about 30 % attrition.
- **35 / 65:** half the plan.

**Estimators.**
- **GLM×** is the pre-registered form: an item-level logistic model, correct ~ confidence (centred) × group, with cluster-robust (participant) sandwich SEs and a Wald z on the interaction.
- **Brier:** each participant's Brier score, compared between groups with a Welch t-test.
- **Gap:** each participant's over/under-confidence gap (mean confidence − proportion correct), compared with a Welch t-test.

The measures computed on real data are `freezeItemScores` and `calibrationPairs` (`07` amendment of 2 Oct 2026).

### Results

Population effects, Thinker − Haku, from a large deterministic sample:

| Scenario | ΔBrier | Δgap |
|---|---|---|
| null | −0.001 | +0.002 |
| R-small (λ 0.75) | +0.005 | −0.022 |
| R-medium (λ 0.5) | +0.014 | −0.045 |
| O-small (δ +0.4) | +0.009 | +0.064 |
| O-medium (δ +0.8) | +0.021 | +0.122 |
| mixed (λ 0.75, δ +0.4) | +0.010 | +0.047 |

Power, as the rejection rate over 1000 replicates. The Monte Carlo SE is at most 1.6 points. Each cell gives the value at 4 items → 16 items.

| Scenario | N | GLM× | Brier | Gap |
|---|---|---|---|---|
| null (Type I) | 35/65 | 6 → 5 % | 5 → 6 % | 5 → 6 % |
| null (Type I) | 49/91 | 5 → 5 % | 5 → 5 % | 5 → 4 % |
| null (Type I) | 70/130 | 6 → 5 % | 5 → 5 % | 5 → 5 % |
| R-small | 35/65 | 7 → 9 % | 6 → 5 % | 6 → 11 % |
| R-small | 49/91 | 8 → 11 % | 7 → 7 % | 9 → 14 % |
| R-small | 70/130 | 7 → 12 % | 8 → 7 % | 12 → 17 % |
| R-medium | 35/65 | 10 → 30 % | 8 → 15 % | 17 → 29 % |
| R-medium | 49/91 | 14 → 36 % | 9 → 17 % | 24 → 41 % |
| R-medium | 70/130 | 16 → 54 % | 12 → 24 % | 30 → 54 % |
| O-small | 35/65 | 5 → 6 % | 6 → 7 % | 22 → 52 % |
| O-small | 49/91 | 5 → 6 % | 8 → 9 % | 28 → 70 % |
| O-small | 70/130 | 6 → 6 % | 6 → 12 % | 38 → 83 % |
| O-medium | 35/65 | 5 → 6 % | 14 → 21 % | 62 → 98 % |
| O-medium | 49/91 | 5 → 7 % | 14 → 28 % | 73 → 100 % |
| O-medium | 70/130 | 7 → 7 % | 19 → 40 % | 88 → 100 % |
| mixed | 35/65 | 7 → 9 % | 7 → 11 % | 13 → 32 % |
| mixed | 49/91 | 6 → 8 % | 8 → 12 % | 18 → 43 % |
| mixed | 70/130 | 8 → 12 % | 11 → 16 % | 24 → 55 % |

### Reading

1. **Type I error is nominal** for all three estimators, at 4 and at 16 items. The cluster-robust GLM holds α with 100–200 clusters.
2. **16 items help substantially.** Under the bias scenarios, power for the gap rises from 38 % to 83 % (O-small, 70/130) and from 62 % to 98 % (O-medium, 35/65). For a resolution loss, the GLM interaction rises from 16 % to 54 % (R-medium, 70/130). With 4 items, H2 was underpowered for every scenario except a large bias.
3. **The pre-registered interaction tests resolution only.** By construction, it is blind to a uniform shift in confidence (bias): in the O scenarios it stays at α. If "calibration is worse with Thinker" means overconfidence, the single interaction test will miss it. Under these assumptions the per-participant gap is the most powerful test of bias, and the Brier score is weak for both kinds of effect.
4. **A resolution loss is hard to detect** even with 16 items. λ 0.75 is never detected (≤ 17 %). λ 0.5 is detected about half the time at the planned N, and at about 36–41 % after 30 % attrition.
5. **Direction depends on the mechanism.** With accuracy equal and a coarse 4-point scale, a resolution loss *lowers* the mean gap: confidence regresses toward 50–75 while accuracy sits near .62. A two-sided test is therefore needed for the gap as well, and the sign of a gap effect does not identify the mechanism.

**Implication for the pre-registration, not decided here (`11` §7.14):**
- **Pre-register both components:** the bias term (the group effect on accuracy at centred confidence in the same GLM, or the per-participant gap) alongside the interaction, with Holm correction across the two, or as a joint 2-df test.
- **Or state explicitly** that H2 concerns resolution only.

The group main effect at centred confidence was not simulated here. Simulating it is the next step.

### Limitations

- **Variance components are assumptions.** None comes from data. Power is most sensitive to the confidence noise SD (1.0 here) and to the item difficulty SD (1.0). The scenario effect sizes are illustrative, not drawn from literature on LLM-assisted calibration.
- **The estimator is not the planned model.** It is a population-averaged GLM with cluster-robust SEs, not the planned mixed model with crossed participant and item random effects. Items are identical across groups, so item effects are balanced, but a mixed model may differ in power, likely slightly upward for the interaction.
- **Covariates are left out:** view index, horizon, `decisionCommittedBeforeFreeze` and `decisionStep` (revision (r)) are not in the simulation. So are the freeze-before-commitment sensitivity analysis and missing answers (time cap).
- **All items are modelled as four-option items** with 25 % guessing. The rebuilt bank's `map_point` items have no guessing floor. Their accuracy depends on `mapKey.toleranceM`, which is a draft (`11` §7.14).
- **No accuracy difference (H1) is simulated.** If accuracy also differs, the Brier score and the gap mix accuracy and calibration.
- **Independence within participants is assumed.** The 16 items come from 4 freezes, and answers within a freeze may be correlated beyond the participant effect, for example through a shared misreading of the view. That would lower effective information below 16 independent items.
- **Attrition is modelled as smaller N only.** It is not modelled as differential by group.

---

## Revision 4 Oct 2026 (t) — Paper 2: compliance and justified deviation

Follows `01` revision (t), `16` revision (t) and `18` revision (t). **This supersedes:**
- §7.2's "Intent alignment across phase B (H8), with the guidance-mode confound declared";
- every Paper 2 power statement (the amendment of 17 Sep and revisions (d), (e) and (f));
- the Paper 2 limitations that read the guidance-mode split (§11, and revisions (d), (e) and (f)).

H1, H2, H9 and H10 and their analyses are unchanged.

### Hypotheses

- **H8 is withdrawn.**
- **H11 (compliance where the directive fits, V11–V14)** and **H12 (justified deviation where it does not, V9–V10)** are Paper 2's hypotheses (`01` revision (t)).
- A group difference on either is exploratory.

### Analysis notes

- **Coding is per view.** Each phase-B view's posture is coded aligned or against, and sound or unsound, against that view's key (`16` revision (t) §t.2). The plan in force at the end of the view is coded, and the first submission is reported alongside. In the merged views (V11, V12, V14) the coded plan carries `afterBoundary`, whether it was given after the second step's records arrived (`07` revision (t), round 2); every view entered has a row, a missing row where no plan was submitted.
  - Results are reported **per view** as proportions with 95 % intervals. Not every cell can occur in every view (V9–V10 allow B, C or D, with C only for a direct attack on the new front's sector, L3; V11–V14 only A or D; round 2), so a single pooled phase-B share would mix different questions.
  - A pooled model is fitted only within the fit views (V11–V14) and within the no-fit views (V9–V10). It is a logistic mixed model with a participant random intercept and view as a fixed effect.
  - V8 is coded for alignment only, since it is neutral.
- **The phase-A baseline comes from the posture field.** Each participant's share of `direct_attack` in V1–V7 enters the H11 and H12 models as a covariate. It separates a participant who attacks by habit from one who deviates because of the view. Phase A has no soundness keys, and (round 2, DEFAULT) is not coded for alignment either: its intent is conditional ("where intensity allows"), so phase-A postures are descriptive.
- **Views since the hinge.** They are recorded with every response, but they are confounded with fit: the no-fit views (V9, V10) come first, and the fit views (V11–V14) after. A fall in alignment over phase B therefore cannot be told apart from the change of fit. Decay of compliance is estimated **within V11–V14 only**, with views since the hinge as a covariate. It is not compared across fit and no-fit views.
- **The base rate** (`16` §t.5) is reported per view beside the study's shares. With a small group it is descriptive. A formal comparison is pre-registered only if its size allows (`11` §7.16).
- **Pushed facts** (restated in round 2, `11` §7.16.2 a). The directive's fit is visible from the map and the pushed reports in V9, V10 and V12–V14 (`18` revision (t) §t.4). **V11 is the one view whose fit rests on a recorded-only record** (the FMI forecast). H11 and H12 therefore measure **applying** the directive to what the participant has been told, more than finding the facts. Whether the deciding records were opened (Haku, Thinker) is reported as process data for V11 (the forecast), where it is recorded only; R2's distance in V13–V14 is in DR1's recorded road reports and also in EK14's pushed V14 line (~200 m, which conflicts with them), so it is not recorded-only (round 3).
- **Ceiling risk (round 2).** In V11–V14 the crews already keep a safe distance (EK11 at step 17, pushed), so most participants may choose a defensive posture without the directive. Whether to add a randomized no-directive arm or keep H11 and H12 descriptive is a researcher decision (`11` §7.16.2 b).
- **Precision.** There is one posture per participant per view. At n = 200 (both groups pooled), a share near 50 % has a 95 % interval of about ±7 points; at n = 140 (30 % attrition) it is about ±8 points. A group difference (70 against 130) is detectable only if it is large. No Paper 2 power simulation has been run.

### Debrief (§5.1)

The debrief also says that the directive was written so that it did not fit every view, and that deviating where it did not fit could be the sound choice. No participant should leave thinking an attack at V10 was wrong because it went against the directive.

### Pre-registration consequences

- **H8 is withdrawn before the pre-registration is locked.** No registered plan is departed from. The Paper 2 power statements of 17 Sep are withdrawn with it, because they assumed the intent-line contrast and ~10 phase-B course-of-action choices.
- **H11 and H12, the per-view coding, the phase-A covariate and the restriction of decay to V11–V14** are stated in the pre-registration.
- **Keys.** Confirmatory analysis of H11 and H12 uses **panel-confirmed keys only**, frozen before data collection. Views where the panel does not agree are reported descriptively (`16` §t.3).
- **The base rate.** Its form (test or description) is fixed before the pre-registration is locked.
- **The intent-line split** (`02` revision (t)) is not part of Paper 2 as pre-registered. If it is implemented later, its contrast is a new pre-registered hypothesis, not a revival of H8.

### §11 limitations, added

- The directive's fit is designed into six phase-B views. The findings concern these situations, not deviation from guidance in general.
- The soundness keys are expert judgements about a synthetic scenario. They are only as good as the panel's agreement.
- In V13 the posture field cannot separate holding the lost line from moving to the next barrier (`16` §t.2).

---

## Revision 4 Oct 2026 (u) — Paper 2's analysis and power (`27`)

Follows `27` §5 and §6. **This supersedes**, in revision (t):
- "A group difference on either is exploratory" (Hypotheses) — the group contrasts are H13–H16 (`01` revision (u));
- the **Precision** bullet's "A group difference (70 against 130) is detectable only if it is large. No Paper 2 power simulation has been run." — see Power below;
- "The base rate … A formal comparison is pre-registered only if its size allows" — the base-rate group is descriptive and validates the keys (`27` §2.4).

The per-view coding, the phase-A covariate, the restriction of decay to V11–V14, the pushed-facts note and the ceiling note stand.

**Primary (H13).** Logistic mixed model on the keyed no-fit views: C ~ cell + view + phase-A share + (1 | participant), `reasoning_intent` vs `reasoning_once`, intention to treat (every Thinker-cell participant who reached V9 with a plan), two-sided α = .05. Missing views are missing.

**Secondary** (one family, Holm): H14 (A in V11–V14), H15 (cell × fit on aligned, all keyed views), H16a and H16b (each Thinker cell vs Haku on C).

**Exploratory:** H17 and every analysis conditioned on the `linjaus` status or on exposure (`27` §5.4), including a complier average causal effect with randomisation as the instrument.

**Sensitivity:** per-protocol (hinge check correct); views not ended by the cap; plans after the boundary; session language.

**Paper 1's phase-B tests** (H3, H9, H10 at V8): the Thinker cell nested; `reasoning_once` alone if the cells differ at α = .10 (`27` §1.4).

**Power.** `tools/power/paper2-power.ts` (deterministic, seeded; `27` §6). At 65 / 65 with the two current no-fit views, H13 reaches 80 % only for a change in C of roughly 15–20 points; for about 10 points in either direction it is 39–50 %, and lower after attrition. Two added no-fit views raise that to about two thirds to three quarters; exposure near 90 % in the no-fit views also helps (a 15-point effect: 70 %); both together give about 95 %. Pilot 2 estimates exposure and the base rate of C, and the simulation is re-run before the pre-registration is locked. The full table, assumptions and reading are in `27` §6.

**Debrief (§5.1), added.** Participants in `reasoning_intent` are told that the `linjaus` line was the machine's own assessment, that it was sometimes wrong, and that the views were written so that the directive did not fit all of them.

---

## Revision 6 Oct 2026 (w) — H6 and Type E withdrawn

Follows `01` revision (w) and `08` revision (w).

- **H6 and its analysis are removed:** expectation-marking views against unmarked views, and the repair by group. Every mention of Type E as an analysis input is void.
- **H10's anticipation** is read from three things in V7–V8:
  - a unit allocated to L3;
  - an outlook of "worsens" (`16` revision (s));
  - SA answers naming the bog.

  The fourth reading, Type E content, is gone.
- **H2 is unaffected.** Its data are the blanked freeze items. With E gone, no view carries a generative act before the judgement, so no E-by-view covariate is needed.
- **§11 limitation, added.** The study does not test whether generating one's own expectation repairs calibration. That is left to a design where the expectation comes before any projection is shown.

---

## Revision 6 Oct 2026 (x) — no Type J and no outlook: what the analysis reads

Follows `01` and `08` revision (x). **No confirmatory hypothesis changes its data source.**

- **H1, H2 (primary) and H9:** freeze items, unchanged.
  - The sensitivity analysis on Type J (revision (o)) is removed.
  - `decisionCommittedBeforeFreeze` and `decisionStep` stay as covariates (revision (r)). `decisionStep` now has fewer values: before the plan, plan open, after commitment.
- **H10:** anticipation in V7–V8 is read from two things:
  - a unit or the main effort on L3 in the plan (`16` revision (s));
  - the V7 freeze's L3 item `rekindle_sector`, and SA answers naming the bog.

  The outlook's "worsens" reading is gone. Test and direction are unchanged.
- **H3, H4:** Type U, unchanged.
- **H5:** divergence of plans (main effort, secondary sector, drone tasking) between participants, per view. J's localisations and branch choices are gone.
- **Paper 2 (H13–H17):** the plan's posture, unchanged (revisions (t) and (u)).
  - The rationale that was required after a rejection is gone with J.
  - The plan's free-text rationale is no longer asked in any view, unless the researcher reinstates it on its own terms.
- **Exploratory, new: projection reliance** (`08` revision (x)).
  - Per `head_later` answer that carries a projection point (V4, V5, V14; `08` revision (x)): anchored on the projection or on the truth, with both distances. The group difference is two-sided. V14's two heads lie 122 m apart, so its reading is weak.
  - In breach views: whether the main effort follows the projection's direction.
  - Both are reported as exploratory, with the item count stated (three).
- **Exploratory, unchanged:** commitment time and revisions (monitoring and control, revision (r)) now come from the plan alone.
- **§11 limitations, added.**
  - The study has no explicit judgement of the projection. Trust in it is inferred from behaviour (taps, plans), not stated.
  - Confidence is collected only in the blanked freezes, so calibration describes the participant's held picture, not their judgement of the machine.

---

## Revision 6 Oct 2026 (x), questionnaire

Follows the revision (x) note above. The post-session questionnaire (`app/session/questionnaire.ts`, texts in `app/i18n/study-texts.ts`) no longer refers to the withdrawn judgement.

- **Perceived own accuracy is removed** (`accuracy.perceived`). §6.1's "how many of the twenty containment judgements the participant believes they got right" no longer applies: no containment judgement is asked, so there is nothing for it to be paired with. The second, cruder calibration measure goes with it; H2 rests on the freeze items alone.
- **The two walkthrough substitutes now ask about the last allocation**, not the last judgement. Response formats unchanged:
  - `last.possibilities`: "Viimeisimmässä kohdennuksessasi: kuinka monta eri vaihtoehtoa palon kehittymiselle harkitsit?" / "In your last allocation: how many different possibilities for the fire's development did you consider?" (1–4, 5 or more);
  - `last.basis`: "Mihin perustit viimeisimmän kohdennuksesi?" / "What did you base your last allocation on?" (free text).
- The other §6.1 items are unchanged. DRAFT: the wording awaits native and domain review with the rest of the questionnaire.

---

## Revision 6–7 Oct 2026 (y) — Paper 2 coding and power; exclusion data; recommended pre-registrations

Follows `27` revision (y) and `16` revision (y). Researcher decisions of 6 and 7 Oct 2026.

- **Keyed views.** No-fit: V9, V10 and **V14**. Fit: V11–V13. V14 was a fit view until 5 Oct 2026, and this supersedes revision (t)'s V14 rows.
- **Alignment** is read over the whole plan: a secondary direct attack is against the directive. The rule that an unlisted secondary attack makes a plan unsound applies only when the main posture is aligned.
- **Accepted sectors** are computed from the front polygons:

  | View | Accepted sectors |
  |---|---|
  | V9, V10 | L2 + L3 |
  | V11, V12 | L2 + L3 |
  | V13 | L3 |
  | V14 | L1 + L4 |

  V9, V10 and V14 also accept the secondary route (`soundSecondary`); at V14 it needs the main effort in L3.
- **H14** is pre-registered on alignment (A∪B vs C∪D, `h14Aligned`). The `viaBoundarySector` recoding is its sensitivity analysis (**revision (aa): the primary coding counts core sectors only; `viaBoundarySector` marks plans whose coding changes if boundary sectors are accepted, for every outcome where `sound` is coded**), and soundness stays descriptive in the fit views.
- **Plan timing.** `afterFreeze` and `afterBoundary` are reported as splits of the plan in force at view end.
- **Power.** The figures for three no-fit and three fit views are in `27` y.4. They assume the `linjaus` exposure that revision (z) withdraws (superseded: `27` revision (aa) aa.6).
- **Exclusion data (§6).** `window_blur` / `window_focus` and `idle_start` / `idle_end` are emitted since 6 Oct 2026, with idle periods net of waits (`07` revision (y)). The thresholds of §6 apply to them unchanged.
- **Recommended for pre-registration** (from the persona reviews; the researcher decides, `11` §7.18):
  - an H9 exposure split: participants who met the planted record vs those who also saw the contradicting record;
  - H2's map items analysed separately from its option items, with the response-bias term reported;
  - H4 read as a difference in confidence level only;
  - a fallback-rate sensitivity analysis;
  - session language as a covariate in every model;
  - an attention check and pre-session experience items (open, not built).

---

## Revision 8 Oct 2026 (z) — the Haku / Open Thinker redesign in the analysis

Researcher decision, 8 Oct 2026 (`02` revision (z)).

- **Paper 1 (H2 and the other Haku vs Haku + LLM contrasts).** The randomised groups are unchanged (70 / 130), but what separates them has changed. Both groups now ask an LLM in free text: Haku's structured chat has four fields, no history and no recommendations by form. The AI group adds the Open Thinker, which converses, keeps history and may recommend. The H1/H2 claim "machine integration on request" (revision (o)) must be restated as *the effect of an open advisory LLM on top of a structured LLM retrieval chat*. H9 (the planted record) is now reachable through the Haku chat in both groups, so it no longer contrasts "found by hand" with "passed on by the AI". Open: `11` §7.18. **Restated in revision (aa) §aa.1.**
- **Paper 2.** H13–H15 and H17 have no manipulation (`27` revision (z)). Revision (u)'s analysis plan stands only as the template for whatever the researcher decides. **Resolved in revision (aa) §aa.6 and `27` revision (aa).**
- **Source selection** (the KUKA slot, revision (j)) has no data in new sessions: the builder is withdrawn (`25` revision (z)).
- **Debrief.** The `reasoning_intent` paragraph about the "Linjaus" line describes a feature that no longer exists. It must be removed (in code: `study-texts.ts`). **Done: revision (aa) §aa.6.**

---

## Revision 8 Oct 2026 (aa) — final fix pass: Paper 1 restated, Paper 2 resolved, exposure and replay rules

Follows `02` and `27` revision (aa). Built and tested in the final fix pass of 8 Oct 2026 (`app/telemetry/derived-measures.ts`, `freeze-measures.ts`; `test/telemetry/*`).

### aa.1 Paper 1: there is no no-LLM control

Both groups ask an LLM in free text. The Haku group has the structured chat (four fields, no history, standard prompt); the AI group has that **plus** the Open Thinker (conversation with history, plan context, may recommend). So **H1, H2 and H9 are an Open Thinker increment over a structured LLM chat**, not an AI-against-no-AI contrast. Revision (z)'s "must be restated" is done as follows:

- **H1** (judgement accuracy equal or higher) and **H2** (calibration worse; primary) are read as the effect of adding the Open Thinker. The claim "machine integration on request" (revision (o)) becomes *an open advisory conversation on top of structured retrieval-and-summary*. The sign of H2 is unchanged and two-sided; its window is unchanged (blanked phase-A L2/L3 items, now 16 items: `08` revision (aa)).
- **H9** (the planted false record held after V12): the planted record is reachable in **both** groups through the Haku chat. The contrast is therefore *an answer that relays the record* in the Haku chat against the same plus the Open Thinker, not "found by hand" against "passed on by the AI". Read as intention-to-treat; the exposure-conditioned reading is exploratory.
- **H3** (contradiction) and **H10** (rekindle anticipation) likewise: both groups can retrieve the objection through a chat; the exposure measures below say who did.
- **Limits.** The Haku group's answers are constrained by the form (no recommendation by design of the form, not by a rule; `02` §z.2). A difference between the groups is therefore a difference in the open advisory conversation, its history and its plan context, bundled; it cannot be attributed to any one of them.

### aa.2 Exposure for H9, H3 and H10

- `atomExposure(records, atomIds, beforeSeq)` returns, for each atom, whether it reached the participant before a given record and by which routes: the pushed `bubble_available`, a retrieval for the Haku chat or for the Open Thinker (`ai_chat_answer_received.retrieved`), and, for older logs, `traffic_returned` and `result_item_expanded`. `freezeItemExposure` applies it to the freeze (the latest `freeze_started` for the view).
- **A retrieval is not proof that the answer said it.** `answerRelaysAtom(answerText, atomText)` is a deterministic screen: it looks up the atom's quantities, clock times, and unit and place names in the answer (`atomText` in the answer's language). It misses paraphrase and can match a number cited for another reason; **coders decide**.
- `plantedFalseValueHeld` is H9's outcome from the V12 F7 answer: the first answer's option against the planted option, with its confidence. Null when F7 was not answered or the view was replayed.
- The exposure-conditioned H9, H3 and H10 are exploratory (revision (q)); the recommended H9 split (met the planted record vs also met the contradicting one) is computed from these.

### aa.3 Replayed freezes

A view can be shown twice (an interruption, then `session_resumed` with `cycleReplayed`), and a freeze can be submitted twice. **The scores keep the first answer to each (view, item) and drop a replayed view altogether** (`replayedViews`, `firstFreezeAnswers`); the participant has seen the content and the freeze before, so a second pass is not a fresh measure. `includeReplayed: true` is the sensitivity. This applies to `freezeItemScores`, `freezeItemExposure`, `plantedFalseValueHeld` and `projectionReliance`, and so to H2's calibration pairs.

### aa.4 Information-seeking and dead measures

- **`INFORMATION_SEEKING_KINDS`** are now `nav_query_submitted` and `query_submitted` (older logs), **`ai_chat_query_submitted`** (both chats) and **`tab_selected`** (a tool tab opened; `tool: "none"` does not count). `drawer_opened` was removed from the list. `timeToFirstInformationSeekingActMs` reads them.
- **Deprecated (no emitter; empty or zero on every current log, kept so older logs and their tests still compute):** `dwellPerElement` and `reportReadThrough` (`element_enter` / `element_leave`, `text_scrolled`), `drawerOpenFraction` and `cyclesWithNoDrawerOpened` (`drawer_opened` / `drawer_closed`), `channelAttention` (`anySignalOpened` is false), and the `traffic_returned` and `result_item_expanded` routes of `tier4Discovery`, which found nothing before this pass and now read `bubble_available` and `ai_chat_answer_received`. Analyses that used dwell, drawer or channel-attention measures have no data from new sessions.
- **Source selection** (revision (j)) has no data (`25` revision (z)).

### aa.5 Attention and the exclusion rules

- The **reading grace** after a Thinker answer, Haku's and the Open Thinker's alike, is **15 s plus 1 s per 60 characters of the answer, at most 60 s**; it counts as reading, not idle (`attention.ts` `readingGraceMsFor`). A pending request and the freezes, visible probes and SPAM items were already waits (`07` revision (y)). Idle periods are therefore net of waits and of this grace, and §6's idle thresholds apply to them unchanged.
- `tab_selected` is logged (`07` revision (aa)); the blur and idle records are as in revision (y).

### aa.6 Paper 2

Revision (z)'s "H13–H15 and H17 have no manipulation" is **resolved by `27` revision (aa)**: the contrast is a directive-aware Open Thinker (cells 2 and 3 pooled, 130) against Haku (70); the primary outcome is whole-plan alignment in the keyed no-fit views (H13), with H14 (fit views) and H15 (group × fit) secondary; H16 and H17 are withdrawn. Coding: core sectors primary and boundary-accepted sectors as sensitivity (`soundWithBoundary`, `cellWithBoundary`, `viaBoundarySector`), `mainAligned`, `firstAfterFreeze` and `firstAfterBoundary` beside `afterFreeze` and `afterBoundary`, and `openThinkerAnswersBeforePlan` for the blind advice-following coding.

- **Power** (`27` aa.6): H14 on alignment with 70 vs 130 has 40 % at a +0.5 logit shift and 70 % at +0.75 (65 / 65: 28 % and 52 %); H13 on alignment in the no-fit views has 60 % and 93 %. The figure for three no-fit and three fit views in revision (y) ("they assume the `linjaus` exposure") is superseded.
- **Recommended pre-registrations added** (the researcher decides): an intensity-matched phase-A baseline (V3 against V9; V4–V6 against V11–V13); the base-rate group under the phase-A intent. The A/A negative control of revision (u) is gone because the cells are identical.
- **Debrief.** The paragraph about the "Linjaus" line is no longer in the code (`study-texts.ts`); the debrief now says that the directive did not fit every later view and that departing from it could be the right decision.

### aa.7 Disclosure, attention check and exclusion helpers (researcher decisions, 8 Oct 2026)

> **Superseded in part by revision (ab) §ab.1:** the idle share counts only idle inside the views (from `cycle_start` to `view_ended`).

- **Disclosure.** Both groups are told, in one identical sentence at the end of the Haku paragraph, that Haku's answers are produced by a language model from the reports received so far (`15` y.2). It is a constant of the design, not a manipulation; the debrief repeats it once.
- **Attention check.** One instructed-response item in the post-session questionnaire (`attention.check`; correct answer 2; `08` aa.3). `attentionCheckPassed` gives true / false / null. §6.2's "Failed attention check" is a session in which it is false; null (no post questionnaire) is a partial session.
- **Exclusion helpers (`app/telemetry/exclusions.ts`),** pure folds over the raw records, thresholds proposed as named constants and **to be pre-registered** (the researcher decides; applied blind to condition and outcome):

| Helper | Measures | Default (pre-register) |
|---|---|---|
| `cumulativeBlurMs` / `blurExcluded` | `window_blur` to `window_focus`, summed; an open period runs to the last record | blur above **10 %** of the session's wall time (`MAX_BLUR_SHARE_OF_SESSION`) |
| `cumulativeIdleMs` / `idleExcluded` | `idle_start` to `idle_end`, summed; already net of waits and the reading grace (aa.5) | idle above **15 %** of the view time, the sum of `view_ended.viewSeconds` (`MAX_IDLE_SHARE_OF_VIEW_TIME`) |
| `tooFastFreezeAnswers` | freeze items whose time since the previous item (the first: since the freeze opened) is under the threshold | **1 500 ms** per item (`TOO_FAST_FREEZE_ANSWER_MS`); how many such items exclude a session is also to be pre-registered |

  The thresholds replace §6.2's "declared threshold" and "pilot-derived floor" until pilot 1 gives data; the pilot may move them before pre-registration.

### aa.8 Coding H2a's questions (draft scheme, 8 Oct 2026)

> **Superseded in part by revision (ab) §ab.6:** the sheet also carries the previous question of the thread and redacts the tools' names.

**Material.** Every question typed into either chat (`chatQuestionsForCoding`, `app/telemetry/chat-coding.ts`): query id, tool (`haku` / `open_thinker`, from the answer record), view, virtual and wall time, phase, text, and a blind id (a hash of a salt and the query id). `blindCodingSheet` gives the coders only blind id, view, virtual time, phase and text, in blind-id order: no tool, no participant, no cell. The question is coded without its answer.

**Categories** (one primary code per question; a question with two parts is split into two rows before coding):

| Code | Definition | Example |
|---|---|---|
| Fact lookup (state now) | asks what is the case now or was reported: positions, status, measurements, who is where | "Missä EK11 on nyt?" / "What is the wind speed now?" |
| Projection (future state) | asks what will happen or where the fire, wind or a unit will be at a later time | "Where will the head be in 20 minutes?" |
| Verification | asks whether a report is correct, whether two sources agree, or how reliable a record is | "Does the grid operator's record agree with the log about the 110 kV line?" |
| Decision-seeking | asks what to do, which option to choose, or for a recommendation | "What should I do with EK11?" / "Should I attack directly?" |
| Directive/strategy-related | refers to the command's directive, the strategy, or whether a plan fits it | "Does a direct attack fit the line P2 gave?" |
| Other | none of the above (the tool, small talk, unclear) | "Are you sure?" |

When a question fits two categories, the rule order is: directive/strategy, decision-seeking, verification, projection, fact lookup.

**Procedure.** Two coders, blind to cell and to each other, double-code every question (or a pre-registered random subsample of at least 20 % for the first pass, then all disagreements). Agreement is Cohen's κ over the six categories, reported with the percentage of agreement; κ below .70 sends the scheme back to a calibration round on a held-out set (the pilot's questions). Disagreements are resolved by discussion, with the resolution logged. Analyses use the share of each category per participant and view phase (H2a). Fix the scheme, the order rule and the κ criterion before any analysis of the confirmatory data.

---

## Revision 8 Oct 2026 (ab) — idle scope, H10 and H9 measures, H5's final plans, the coding sheet, covariates

Follows `27` and `16` revision (ab) (researcher decisions D5 and D6, 8 Oct 2026) and the measures fix pass 6 (`app/telemetry/{exclusions,derived-measures,freeze-measures,chat-coding}.ts`). Tests: `test/telemetry/{exclusions,derived,freeze-measures,chat-coding,coverage}.spec.ts`. **This revision supersedes §aa.7's idle row (scope), §aa.8's "no tool, no participant, no cell" sheet (it gains a previous question and a redaction), and every statement that the phase-A compliance share is a covariate.**

### ab.1 Idle is counted only inside the views (supersedes the §aa.7 table's idle row)

`cumulativeIdleMs` now sums `idle_start`–`idle_end` periods **only where they overlap a view window**: the span from a view's `cycle_start` to its `view_ended` (a replayed view: from its last `cycle_start`; a view still open at the end of the log is not counted, as `viewTimeMs`). That is the scope of the denominator of the rule "idle above **15 %** of the view time" (`MAX_IDLE_SHARE_OF_VIEW_TIME`, the sum of `view_ended.viewSeconds`): idle before V1, between views, in a briefing, in the hinge or in the questionnaire no longer counts against the share. The threshold and the reading-grace netting (§aa.5) are unchanged; the blur rule (10 % of the session's wall time) is unchanged and still counts the whole session. The threshold remains a pre-register default.

### ab.2 H10: the anticipation measures carry `afterFreeze`

An order or a plan logged **after the view's freeze was shown** may be anticipation the freeze's L3 items themselves prompted. `DroneSurveyOrder.afterFreeze` (a `drone_survey` order) and `sectorAnticipation(…).first.afterFreeze` (the first qualifying plan, e.g. crews on L3 in V7–V8, `REKINDLE_CREW_ANTICIPATION`) are true, false, or null in a view with no freeze. The flag lets the H10 analysis separate anticipation before the freeze from anticipation after it (a sensitivity the researcher fixes before analysis).

### ab.3 H9: exposure to the planted record

`plantedExposure(records, view = 12)` classifies, for the V12 freeze, whether the participant met the planted false record (`F7_PLANTED_ATOM_ID`, "110 kV linja jännitteetön, vahvistettu.", step 8) and the grid operator's contradicting record (`F7_GRID_ATOM_ID`, step 6: the line is live) **before the freeze was shown**, by a pushed bubble, a Haku result or a Thinker retrieval (`atomExposure`): `exposure` = `neither` / `planted_only` / `grid_only` / `planted_and_grid`; null when the V12 freeze was never shown. This computes the recommended H9 split (`27` y.5: met the planted record vs also met the contradicting one) that §aa.2 only named. A retrieval is still not proof the record was read (`answerRelaysAtom`; coders decide). The headline H9 stays intention-to-treat.

### ab.4 H5: the final plan per view

`finalPlanPerView(records)` returns, for each main view with a plan, the plan in force when the view ended: main effort, posture, secondary sector and task, drone sector and task, and whether it was revised. It is the material for **H5** (divergence of plans between participants, per view). Resume-aware (a replayed view counts its last attempt); a view with no plan is omitted.

### ab.5 Covariates for Paper 2 (`27` ab.2)

- **Dropped:** the phase-A compliance share (post-treatment).
- **Baseline:** `baselineCompliance(records)`: the share of `direct_attack` among the plans in force at the end of the practice view and V1 (`BASELINE_VIEWS` = 0, 1); null with no plan. *(Revision (an): "before any order-bearing contact", an.1.)*
- **The AI's verdict:** `aiVerdict` per Open Thinker answer (`in_line` / `departs` / `not_covered` / null), logged with the answer (`07` revision (ab)) and carried by `openThinkerAnswersBeforePlan`, which now keeps only the answers of the **last attempt** of a view (after `attemptStartSeq`, before the plan in force). A covariate for the within-group analysis of advice-following; null for withdrawal or evacuation questions by design.
- **Accountable deviation:** `accountableDeviation` (C plans with and without the departure note), descriptive (`16` ab.2).

### ab.6 The blind coding sheet (supersedes §aa.8's "Material")

`chatQuestionsForCoding` rows gain `previousText`: the question before this one **in the same thread** (the same chat tool within the same view), or null for the first; a follow-up such as "and now?" cannot be coded without it. `blindCodingSheet` gives the coders the blind id, view, virtual time, phase, the question and its previous question, in blind-id order, and **redacts the tools' names** from both texts (`redactToolNames`: "Haku", "Hakua", "Thinker", "Open Thinker's", "Thinkerille" and the like become "[tool]"): a participant who writes "Thinker" would otherwise reveal the cell. Still no tool, no participant, no cell, no answer. The categories, the rule order and the κ procedure of §aa.8 are unchanged.

### ab.7 Stale text pointed here

§aa.7's idle row (scope: ab.1); §aa.8's "Material" paragraph (ab.6); `27` aa.3's model line (ab.5).

---

## Revision 9 Oct 2026 (ac) — AI literacy (SNAIL) as a covariate

Follows `15` revision (ac) (the questionnaire after consent; researcher request, 9 Oct 2026). **No new hypothesis.** Supersedes `01` §7's "AI literacy | 10 min | Validated instrument plus a short performance component" and its placement in a pre-session. **Amended the same day:** the first build used AILIT-S (Hornberger et al., 2025, a knowledge test). SNAIL replaces it because Fernandes et al. (2026), the closest precedent for this study's question, used SNAIL; the same instrument makes the AI literacy findings directly comparable.

### ac.1 The measure

- **Instrument:** SNAIL. Laupichler, M. C., Aster, A., Haverkamp, N., & Raupach, T. (2023). Development of the "Scale for the assessment of non-experts' AI literacy" – An exploratory factor analysis. *Computers in Human Behavior Reports*, 12, 100338. https://doi.org/10.1016/j.chbr.2023.100338. The 31 items are "I can…" statements rated from 1 "strongly disagree" to 7 "strongly agree". An exploratory factor analysis (n ≈ 415 non-experts) gave three factors: **Technical Understanding (TU, 14 items, α = .93)**, **Critical Appraisal (CA, 10, α = .91)** and **Practical Application (PA, 7, α = .85)**. Eight of the 39 original items were eliminated. **It is self-report**: it measures self-assessed competence, and the authors note that conscious or unconscious biases can colour it.
- **Item source:** verbatim from Table 1 of the published article ("List of all variables sorted by factors…"), read from the publisher's PDF on the authors' repository (bonndoc, University of Bonn, hdl 20.500.11811/13554, retrieved 9 Oct 2026). Recorded in `app/session/ai-literacy-items.ts` with each item's variable number and factor (`AI_LITERACY_VERSION = "snail-31.2023.v1"`). **Licence:** CC BY 4.0, per the publisher's metadata and the PDF. Use, reproduction and translation are allowed with attribution and an indication of changes.
- **Precedent:** Fernandes, D., Villa, S., Nicholls, S., Haavisto, O., Buschek, D., Schmidt, A., Kosch, T., Shen, C., & Welsch, R. (2026). Performance and metacognition disconnect when reasoning in human-AI interaction. *Computers in Human Behavior*, 175, 108779 (arXiv 2409.16708). They administered SNAIL's 31 items **at the end of their study**, reported the TU/CA/PA subscales as means, and found that participants with higher technical understanding were less accurate in their metacognitive self-assessments (all three factors correlated weakly and positively with confidence).
- **Language:** English sessions show the published English. Finnish sessions show a DRAFT Finnish rendering, unvalidated, under the stem "Osaan…". No Finnish version is known. A German translation was tested by the authors' group (a CFA in medical students). The Finnish version needs review, ideally back-translation, before pilot 1 (`11` §7.19).
- **Scores (analysis only, `07` §3):** `aiLiteracyScoreOf(records)` (`app/telemetry/ai-literacy-score.ts`) gives the mean rating of each factor's items (TU, CA, PA) and of all 31, from the last logged rating per item, **over the rated items only**. An item not reached at the cap, or left by skipping, is missing, not a low rating. Each mean carries its count of rated items, and `SNAIL_FACTOR_OF` is the item → factor table. There are no correct answers.

### ac.2 Use in the analysis

- **Covariate or moderator of the AI-condition effects, exploratory.** The three subscale means may enter the Paper 1 and Paper 2 models as covariates, and their interaction with condition may be examined as moderators. **TU in particular** is the candidate moderator of reliance on the AI tools and of overconfidence (calibration, H2), following Fernandes et al.'s finding. No direction is pre-registered here; `01` §7's note on the direction of the AI-literacy prediction and `11` §3 stay open.
- **Pre-treatment, identical in both conditions.** It is measured before any tool is seen, so it can be balanced and checked across the cells.
- **Missing data.** A participant who **skipped before rating anything** has no SNAIL scores: **the covariate is missing** for that participant. A questionnaire **skipped or timed out midway** gives means over fewer items, and the count of rated items is kept with each mean. Models that use the covariate use the participants with a score (complete-case), with a sensitivity analysis that requires every item of the subscale rated. The primary analyses do not depend on it. The share of skips and timeouts per cell is reported.
- **Language.** The Finnish rendering is unvalidated. Session language enters any model that uses the covariate, and the two language versions are compared descriptively.
- **Limitations, added.**
  - **Placement and priming.** Fernandes et al. gave SNAIL at the end. Here it comes first, at the researcher's request. Rating one's own AI competence just before the session may make AI salient and shift AI-related self-perception and confidence in both conditions alike, so the comparison with Fernandes et al. is not exact. Conversely, the session cannot contaminate the ratings.
  - **Self-report**, not performance. SNAIL was developed with non-experts recruited online, not with fire officers, and its three-factor structure was exploratory.
  - **A fixed order** replaces the authors' per-participant randomisation.

---

## Revision 9 Oct 2026 (ad) — missing freeze answers; projection direction

### ad.1 Missing freeze answers (pre-registered rule)

Every freeze item stays required on the screen. A freeze closed by its 180 s cap (`15` ad.1) — or, in a demonstration, skipped — logs the unanswered items as `missing` (`07` ad). **Missing items are missing, not wrong**: they are not scored. **A view with more than half its freeze items missing is excluded from that view's SA score** (`MAX_MISSING_SHARE_PER_FREEZE` = 0.5; `freezeMissing`, `viewsExcludedFromSa` in `exclusions.ts`). Exactly half missing is kept. A freeze never shown (the view not reached) is absent, not "all missing". Report the number of timed-out freezes per group.

### ad.2 The projection-direction readings (exploratory; `16` ad.1)

- **Plan:** in V6, V9 and V14 (the breach views whose key discriminates), whether the final plan's main effort lies in the projection's sector, the reported development's sector, or neither (`projectionDirectionReading`). In V14 the reported development is the no-fit deciding fact, so the reading coincides with the directive coding there; report it, do not test it separately.
- **Freeze:** V14 `se_front_r2`'s projection option (`08` ad) beside the `head_later` taps (`projectionReliance`). V4 and V14 remain the map readings; V14's map reading stays weak (~106 m between the heads).

---

## Revision 9 Oct 2026 (ai) — closed items: H3 re-registered, the questionnaire without free text

Researcher decision, 9 Oct 2026: **no open-ended questions in the session** (the Search / Thinker question box stays free text: it is the tool, not a measure). Reviewed and approved with conditions by three professor reviewers — SA measurement, NDM / Paper 2, HCI / trust (`11` §7.25). The instruments are in `08` ai and `07` ai; this revision states what the analysis does with them. Pre-register it as written.

### ai.1 H3, re-registered

- **Primary: the V13 area hit** (`uncertaintyMeasures(…).area.areaHit`, `app/telemetry/probe-measures.ts`): "yes" to *anything you are unsure about or would check?* and **the north edge** among the parts ticked. Logistic model, condition as predictor (as §7.1), the key's position in the participant's order (`keyPosition`) as a covariate; exposure (`aa.2`) as before. It replaces the blind-coded binary from the open text. No coding, so §7.4's double coding does not apply to it.
- **Secondary: the V14 backup, with its confidence** (`.backup.correct`, `.backup.confidence`), **labelled recognition**: the item shows the pair, so it measures whether the participant recognises the inconsistency when shown, not whether they detected it. The confidence allows a recognition-calibration reading (exploratory).
- **What H3 now claims.** Prompted, area-level detection: the participant flagged doubt about the part of the picture where the contradiction lies. It cannot show that the participant identified the two reports. Word the claim so.
- **Gate 2 re-checked in the pilot** (`01` §5: detection in the Haku group within 20–70 %). The closed item may raise the base rate (any doubt about the north edge counts, and seven named parts invite ticking); if the Haku group's hit rate lands above 70 %, H3 has no variance and the item is revised before data collection (candidates: a single "most uncertain" part instead of many; fewer parts). Report the pilot's hit rate, the share of "yes", the mean number of parts ticked and the east-only share (`08` ai.1's caveat).

### ai.2 Multi-select items: binary indicators, never counts

Every option of a multi-select item (V13's parts, `last.basis`, `disagreement.action`) is analysed as its **own binary indicator** (ticked or not), with the option's position in the participant's order as a covariate where order matters. **The number of options ticked is never a measure** (it confounds thoroughness, reading speed and response style with the construct). Options filtered out of a cell (Thinker options in the Haku cell) are structurally missing, not "not ticked".

### ai.3 What is never detection evidence

- **`felt.wrong`** (yes / no / unsure, no content list — a list would cue the planted errors, HCI reviewer) is a global unease item; it is **never** evidence that the participant detected the contradiction, the omission or the planted record.
- **"A report contradicted another"**: no item in the session or the questionnaire asks it before the V14 backup, and no answer elsewhere (`last.basis`, `disagreement.action`, `felt.wrong`) is read as detection.

### ai.4 The questionnaire's walkthrough substitutes (§6.1), now closed

- **`last.basis`** (multi-select): the spread projection on the map; crew and unit radio reports; drone and sensor information; the message log; Search (Haku); Thinker (Thinker cells only); the command directive (in force from V8, so always by the questionnaire); my training and experience; other — no "none". Then **`last.basis.main`**, "which one mattered most?", over the ticked bases (shown when two or more are ticked; with one ticked, that one is the main basis). **Exploratory.** Reliance on the projection and the tools is measured **from the logs** (`09` aa, `16` ab), never from this self-report; the item is read beside the log measures as the participant's account.
- **`disagreement.action`**, shown **only after "yes" to `disagreement.recall`** (a "did not disagree" option is dropped): checked the reports or the log; asked Search; asked Thinker (Thinker cells only); placed the plan where I expected the fire rather than where the projection showed it; adjusted the plan to leave a safety margin; went with the projection anyway; nothing in particular (exclusive). Descriptive, compared with the logged queries and plans.
- **`directive.fit`** (Paper 2's manipulation check, `27` ai): after the retention items.
- **The only difference between cells** is the Thinker filter (`thinker.trust`, `ai.directive_relation`, the Thinker options).
- **Option order** of the multi-select items is drawn once from the scenario seed and is the same for every participant (fixed-last options last); it is logged. A fixed order can favour the first options for everyone alike; it cannot differ between groups.

### ai.5 §5.2, the walkthrough codes

The walkthrough (subsample, after the session) keeps its codes. Its "self-reported basis for the judgement" is now read **against the closed `last.basis`** the participant gave in the session: agreement between the two is reported, and the walkthrough is where the participant's own words about the basis are collected. Nothing in the session is coded from text any more.

### ai.6 Limitations, added

- **The participants' own words are lost.** The open V13 item could show *how* a participant understood the doubt (naming the two reports, an unfalsifiable worry, nothing); the closed item records only where. The free-text promise of §6.1 ("self-reported basis … as short free text") no longer holds; the walkthrough subsample is the only source of free accounts.
- **Prompted options can cue.** The V13 parts name regions of the picture, which may direct attention to the north edge in a participant who had no doubt. The yes/no comes first and the order is shuffled per participant; the cueing cannot be removed, only bounded. Gate 2's pilot check (ai.1) guards against a ceiling.
- **Recognition is not detection.** The V14 backup is reported as recognition (ai.1).
- **One fixed order.** The identical-stimulus invariant (`00` §3) holds for content and order alike (researcher, 9 Oct 2026); position effects are equal across groups but not removed. Per-participant randomisation (the SA reviewer's condition) is open for the supervisors (`11` §7.25).

---

## Revision 10 Oct 2026 (al) — H13 is `reasoning_intent` against `reasoning_once`; the treatment changes of (aj) and (al); the US2 scan-to-find limitation

Follows `27` al and `14` al (review panel, 10 Oct 2026; researcher approved). **Supersedes revision (aa) §aa.6's contrast for H13 ("cells 2 and 3 pooled, 130, against Haku, 70") and revision (ab) §ab.5's AI-verdict covariate.**

### al.1 H13, restated

**Primary (H13).** Whole-plan alignment / sound departure (C) in the keyed no-fit views, as coded in `27` aa.4 and y.2, **`reasoning_intent` against `reasoning_once`** (65 / 65, intention to treat: every Thinker-cell participant who reached V9 with a plan). Model as before: C ~ cell + view + baseline (`baselineCompliance`) + (1 | participant), two-sided α = .05. The Haku cell is not in H13; it enters the descriptive reference and Paper 1. H14 (fit views) and H15 (cell × fit) take the same two cells. The power figures of revision (aa) for 70 vs 130 do not apply; re-run `tools/power/paper2-power.ts` at 65 / 65 with the pilot's exposure and base rate before the pre-registration is locked.

**Expected direction.** With the treatment as frozen (`14` al.8), the `reasoning_intent` Thinker relates the options to the directive's method and aim and did not, in the probe, say that a departure could be justified in the no-fit views. Pre-register the direction only after the researcher decides `14` al.9; as frozen, the prediction is more directive-aligned plans under `reasoning_intent`, not more sound departures.

### al.2 The treatment changed twice in two days — what the analysis must state

- **(aj), 9 Oct 2026:** the directive moved from the user turn into the system instruction of both Thinker cells.
- **(al), 10 Oct 2026:** the directive and P2's opening intent are in `reasoning_intent`'s system instruction only, as data under a framing sentence; rule 5 relates options to the directive's purpose, method and premises with a generic premise trigger and no reporting sentence; the "experienced fire chief" persona is gone; `reasoning_once` has its own prompt (the directive is in the banner and log).
- Any session run before (al) — pilots included — had the earlier treatment (identical cells under (aa)–(aj)). Recommended (the researcher decides): such sessions are **not pooled** with sessions under (al) for H13–H15; the prompt hashes in the server log (`promptHash`, `systemPromptHash`) identify the treatment, and the analysis would keep only sessions whose Open Thinker hashes are (al)'s (`14` al.1).

### al.3 The AI-verdict covariate

The covariate is now `aiVerdicts` (per option line, the line's last verdict phrase; `14` al.5), carried by `openThinkerAnswersBeforePlan` as `aiVerdicts`. Summaries for the analysis (pre-register one): whether any line of the last answers before the plan says `departs`, and whether the line naming the participant's chosen posture says `in_line` / `departs`. The earliest-phrase `aiVerdict` stays in the log for older sessions only and is not an analysis value. In `reasoning_once` verdicts appear only when the participant quoted the directive (`directiveQuoted`); report their count per participant.

### al.4 Limitation: US2 has to be found by scanning (H3, V13)

The V13 contradiction is a north-edge holdover drawn on the map as **US2** (`18` ah.2), and since `12` aj the camera never moves by itself: every view opens on the whole study area, where the flare-up is a few pixels. To see it on the map the participant has to scan and zoom to the north edge; the practice tour now asks the participant to zoom in to see the fire (`15`, tour step `zoom`), identically for everyone. A miss on the V13 area item can therefore reflect not finding US2 (visual search under time pressure) as well as not noticing the inconsistency; the item cannot separate the two. SPOT's pushed report reaches the message log for everyone, and the Thinker cells can also meet it through the digest or a question, so the non-visual route is not equal across conditions. Report this limitation with H3; the map-use covariates (viewport measures, the map agent's subsection) bound it but do not remove it.

## Revision 10 Oct 2026 (al) — map-use covariates

Follows `07` and `12` revision (al). Analysis only (`app/telemetry/map-use-measures.ts`, `mapUseMeasures(records, MAP_ROIS)`); nothing is computed at runtime. Tests: `test/telemetry/map-use.spec.ts`.

### al.1 Regions of interest

Fixed ground boxes per view, in data (`app/render/map-rois.ts`, each checked against the scenario): **`us2`** at V13 (the planted holdover, ±150 m), **`origin_south_edge`** at V9–V10 (the rekindle's edge; US1 at V10), **`head`** at V4–V6 (the head segments' bounding box + 100 m). For each view and region: `onScreenMs` (any part of the box inside the visible bounds while the map is not frozen), `mapVisibleMs`, `firstInViewMs` (from the view's `cycle_start`; null if never), `zoomAtFirst`, `maxZoomOnScreen`. Freeze time (`freeze_started` → `freeze_submitted`) does not count. Per view also: settled moves by input (`wheel`, `drag`, `touch`, `keyboard`, `preset`, `frame`), the maximum zoom, and the map's pixel size at the view's start.

### al.2 Use

Covariates and process measures, never outcomes. (a) A covariate of the V13 detection items: whether `us2` was on screen at a zoom of at least the 2 km level (`maxZoomOnScreen`), and the time to that; the camera never frames US2 (`12` (aj)). (b) A descriptive check that map use does not differ by group (Mann–Whitney on `onScreenMs` and `maxZoomOnScreen` per region). (c) The map's pixel size at each view's start as a nuisance covariate of every map-based measure. On the opening frame every region is on screen, so `firstInViewMs` is 0 unless the participant had moved the map off it; the informative parts are zoom and time on screen after moving. The scan-to-find limitation for US2 is thinker-v2's note.

### al.3 Sessions before (al)

Logs before revision (al) carry no `viewport_changed`; their map-use covariates are missing, not zero.

## Revision (an) — 10 Oct 2026: baseline before order-bearing contact; practice questions in the coding export

Researcher approved (thinker fixes, revision "(an)").

### an.1 Baseline

Since revision (am) (`14`, `15`), the Thinker cells meet the Thinker in the practice view. So the baseline (`baselineCompliance`, §ab) can no longer be described as "before any treatment contact". It is now defined as **before any order-bearing contact**. Order-bearing contact means a Thinker answer that may relate the plan's options to an order. That is the directive's assessment from V8 (`STRATEGY_FROM_VIEW`), which is also where verdict coding starts. `BASELINE_VIEWS` stays **0, 1**, and this is consistent with the definition:

- **VP.** The Thinker carries no order. Both Thinker cells are answered with the `reasoning_once` prompt and no order block, so the practice stimulus is identical across the cells.
- **V1.** The `reasoning_intent` cell's instruction carries P2's opening intent. Its rule 5 forbids saying that an option is in line with the intent or departs from it, and no verdict is coded. Every participant reads the same intent in the message log.

Caveat for the pre-registration: a strict reading under which *any* order text in the Thinker's instruction counts as contact would leave only VP (`BASELINE_VIEWS` = 0). The researcher may choose that reading. The code change would be the constant alone.

### an.2 Practice questions in the coding export

`chatQuestionsForCoding` rows carry **`practice`** (true for view 0). By default, practice questions are **excluded**. `chatQuestionsForCoding(records, salt, { includePractice: true })` keeps them, flagged. The previous-question link is per view, so a main-view question never gets a practice question as its previous one. `blindCodingSheet` is unchanged: its rows carry the view, so a practice row in an inclusive export is visible to the coders as view 0.

## Revision 11 Oct 2026 (au) — 210 = 3 × 70

Researcher decision (`27` au, `02` au). **Sample:** 210 participants, three equal cells of 70 (`radio`; `reasoning_once`; `reasoning_intent`). **Paper 1 / H2:** Haku (70) against the pooled Thinker cells (140), where the text above says 70 / 130, "200 firefighters" or 65 / 65 within the AI group. **Paper 2 / H13–H15:** `reasoning_intent` (70) against `reasoning_once` (70), where revision (al) says 65 / 65. Allocation: blocks of 42, 14 : 14 : 14.

**Power and precision: to recompute for n = 210.** The method and inputs are those already stated; only the group sizes change: H2 by `tools/power/h2-power.ts` (seeded, deterministic; the grid 35/65, 49/91, 70/130 becomes 35/70, 49/98 (30 % attrition), 70/140) and Paper 2 by `tools/power/paper2-power.ts` (65 / 65 and 46 / 46 become 70 / 70 and 49 / 49). Until that is run, **no power, MDE or interval figure in this file or in `27` is claimed for n = 210**: this covers the assumption-based figures of the 17 Sep revisions, the H2 table of the 2 Oct amendment, the Paper 2 figures of revisions (u), (y), (aa) and (al), and the precision sentence "At n = 200 … ±7 points / n = 140 … ±8 points". The attrition range of §6 (25–35 %) applies to 210 as it did to 200.

**Power recomputed, 11 Oct 2026 (au.1).** Same method, seeds and 1000 replicates; only the group sizes changed (`tools/power/h2-power.ts` grid now 35/70, 49/98, 70/140; `tools/power/paper2-power.ts` grid T 70 / S 70, T 49 / S 49, H 70 / S 70; the aa.6 alignment script `power4.ts` re-run from the scratchpad at 70/70, 49/49, 70/140, 49/98, seed 20261008).
- **H2, 16 L2/L3 items, 70 / 140 (was 70 / 130):** Type I 5 %; gap under O-small 82 % (83), O-medium 100 % (100), mixed 54 % (55); GLM interaction under R-medium 53 % (54). At 49 / 98: O-small 68 %, R-medium 40 %, mixed 41 %. Practically unchanged: the Haku group (70) sets the precision.
- **H13 (GLM-C), three no-fit views, `reasoning_intent` vs `reasoning_once` 70 / 70 (was 65 / 65):** null 5 %, aid-moderate 62 % (60), aid-mid 93 % (90), aid-strong 100 %, exp-low 22 % (21), amplifier 63 % (60), wrong-AI 11 % (10). At 49 / 49: 48 %, 83 %, 98 %, 16 %, 47 %, 10 %.
- **H15 (GLM interaction), 70 / 70:** aid-moderate 75 % (70), aid-mid 98 % (94), wrong-AI 61 % (55).
- **Alignment (aa.6 model), cell contrast 70 / 70 (was 65 / 65):** +0.5 logit: C 41 % (37), H14 30 % (28), H13 alignment 48 % (45), group × fit 75 % (67); +0.75 logit: 73 % (68), 56 % (52), 82 % (79), 96 % (95). Within-person fit effect (n = 210): 5 % at a fit-view aligned share of .72, 38 % at .76, 93 % at .80.
- Reading: H13 is powered (≥ 80 %) only for a large effect; H14 is the weakest test; attrition to 49 per cell costs about 10 points in the mid range.

## Revision 19 Oct 2026 (ax) — 100 = 2 × 50; the analysis plan of `30`

Supersedes (au) and, where they conflict, (aa), (al) and (an). `30` §6 governs the hypotheses; this revision fixes the analysis.

- **Sample.** 100 participants, Haku 50 and the guide 50, permuted blocks of 10 (5 : 5) stratified by language (`app/session/assignment.ts`, `rowsSha256` 4a4b080b…38f2, seed 20261005 — into the pre-registration). The pilots and the bridge sample use rescue students, never the professionals' pool.
- **Paper 1.** **H2 (primary):** the per-participant overconfidence gap (mean confidence − proportion correct) on the 24 L2/L3 items of the V2, V4, V5, V7 freezes, group difference with the baseline covariates of (an); the item-level GLM gives the same bias term as a check. **H2r (secondary):** the confidence × accuracy × group interaction (resolution). **H2t (secondary):** the gap on items with `aiStatedKey` false, and the group × stated interaction on accuracy and confidence; `aiStatedKey` is analysis-only (`app/telemetry/freeze-measures.ts`), from the AI answers shown before the freeze and each item's `keyStatements`. **H1, H-T** (hand-over: SPAM-with-tools accuracy minus freeze accuracy, phase A), **H3, H9** as before. One Holm family for the secondaries.
- **Paper 2.** **H13 (primary):** C in V9, V10, V14, guide against Haku, logistic mixed model, group + view, participant intercept, ITT. **H14, H15, H18** (plan-confidence calibration in the keyed views: `plan_confidence_submitted` against the plan's coding) one Holm family. **H17** exploratory within the guide group: C and record-opening after a premise flag shown before the plan. H16 withdrawn. Exposure: `consult_prompt_opened`, chip queries (`viaChip`), and the existing `atomExposure`; the CACE of `27` §5.4 uses "asked a decision question before the plan" as exposure.
- **Paper 3** (pre-registered exploratory): labels — confident error per freeze item (confidence ≥ 75 and wrong) and a miscalibrated plan per keyed view; features — only behaviour logged before the label's moment (`30` §5.4 kinds, map use, tool use, timing); validation — cross-validation leaving whole participants out, then an external test without refitting.
- **Model build.** A forced change of the Thinker's model build during collection is a treatment revision: a period term in every model and a report of both periods (`30` §10).
- **Power.** `tools/power/h2-power.ts` and `paper2-power.ts` are re-run for 50 / 50 and 40 / 40 with 24 items and the two-group contrast; the results go into `30` §11 and replace every power statement for the old n.

## Revision 19 Oct 2026 (ay) — the analysis plan after the skills review (`31`)

`31` §3 governs; this revision fixes what the pre-registration states.

- **H13 (primary).** The outcome is **act-based** (RC): a plan attends the keyed front when its main effort attacks it directly or its secondary task on its sector(s) is direct attack, mop-up or hold-line, the panel having rated such probe plans sound; an attending plan codes C (`codePosture` `attended`, `cellByAct`). The build's label-based cell is the pre-registered sensitivity. V14 is sound only through the secondary route (RC); `soundVia` is reported per view. **Fallback:** a view keyed mixed or below 4-of-5 agreement is reported, not coded; H13 runs on the remaining no-fit views, H14/H15 on the remaining fit views. The L2 boundary sensitivity for V9–V10 (coa F13) and V13's secondary attacks (coa F6) are reported descriptively. The fixed posture order and the directive-mirroring labels are stated as part of the stimulus.
- **H2 (primary).** The 24 items stand. Sensitivities: dual key on the report-keyed numeric items where report and truth bands disagree; a format covariate (map vs choice) and a chance-corrected gap; without stream-told items. **H2t (RC):** items are classed stream-told (every key record pushed before the freeze), AI-told (stated by a shown answer; key recorded or computed) or neither; H2t contrasts AI-told against neither and reports stream-told; `statedLure` is reported; `dropUnscreenable` for the map items is a sensitivity.
- **Exposure** (H1-by-exposure, H9's `plantedExposure`, Paper 3 features, `exposure.csv`): retrieved ∪ digest ∪ recent from `ai_chat_answer_received` (format 0.11.0, `07` (ay)); sensitivity retrieved-only. The descriptive error-class fold (CORRECT, NOT_EXPOSED, EXPOSED_WRONG, STATED_WRONG, STATED_LURE, NOT_APPLICABLE) is reported per item class; the skill's `score_freezes.py` is a pilot-2 cross-check only.
- **H-T** is an item-level mixed logistic model (own vs team × group, item random effects), the second SPAM items being "tool-aided probes" (accuracy only). V13's area item is scored as hits against false alarms. Crossed-key items are also scored per half.
- **Covariates and checks:** (an)'s baseline; command experience (`incidents.commanded`) with an imbalance check between groups; time in view; plan committed before the freeze (`15` r.3); the period term of (ax).
- **Exclusions (§6.2 extended):** recognition of a real fire or department (post-session item), prior use of the web demonstration (game mode removed 21 Oct 2026); both pre-registered with a sensitivity analysis. Believability is reported.
- **Pre-registration list** (adds to (y) and (ax)): the scenario version (package hash at the locked commit); SAGAT tolerances, the haversine map metric and the report-keyed primary with the dual-key sensitivity; the projection-error schedule; fire-validation status PROVISIONAL (Gate A) and the comparison thresholds (0.2.0-proposed); the panel procedure (ratings → key, ≥ 4 of 5, fallbacks); the exposure definition; the three-way told split; the parity statement (between groups); the fixed option order; the known cues (V8/V11 SPAM, V13's U item, V10's freeze into V11).
- **Power.** `h2-power.ts` re-run with the three-way split; `paper2-power.ts` with act-based base rates per view from pilot 2, V14's secondary route and a two-view fallback case; results replace `30` §11's H2t and Paper 2 rows.

## Revision 20 Oct 2026 (ba) — after the critical reading (`32`)

Pre-register as written; `32` §3–§7 holds the definitions.

- **Paper 2, signal detection.** Per keyed view `departed` = the final plan is not aligned (act alignment in V9, V10, V14; `h14Aligned` in V11–V13). Hits in the no-fit views, false alarms in the fit views. H15 (group × fit on alignment) is discrimination; **H15c (new, secondary)** is the criterion: aligned ~ group + view + phase-A share over the six keyed views, target group. **Primary rule:** H13 stays primary unless pilot 2's Haku fit-view departure rate is at least 15 %; then H15 is primary and H13 its pre-stated component. The rule is locked now; pilot 2 supplies only the rate.
- **The plan review** (`32` §3). H13–H15 code the final plan (intention to treat). Reported per keyed view: the cell before and after the review, `revisedAtReview`, the review's dwell, `citedRecordOpened`. **H17 (guide only, exploratory):** the share of no-fit views whose plan moved to C at the review, and opening the cited record before keeping or revising. Exposure is 1 by design; the consult-before-plan exposure stays descriptive.
- **Trust calibration (exploratory).** S-TIAS means for Haku (every cell) and the Thinker (guide); the signed gap between `reliability.projection` and the projection's correct share in the error schedule; reliance on the projection when wrong vs right (`projectionReliance`); the planted value held (H9); cited records opened.
- **New measures (exploratory or covariates).** Roadblock latency (`roadblock-measures.ts`); the share of freeze answers at 25 % (a "don't know" index); AI answer length per view (covariate for confidence in H2 sensitivity models).
- **Resolution** is estimated at group level only (H2r's GLM slope), adjusted for accuracy; no per-person meta-d′ is interpreted. One bias index (H2's gap) and one resolution index are pre-registered; a hierarchical meta-d′ is a sensitivity analysis.
- **Source memory**: a source-monitoring (multinomial processing tree) model as sensitivity to the misattribution rate.
- **Paper 3**: a model counts only if it beats a baseline using the item's difficulty and the person's mean confidence (leave-participants-out); significance by 1000 label permutations within participant.
- **Reactivity**: the `afterFreeze` splits; SPAM `readyLatencyMs` is analysed on its own (experts delay accepting probes).
- **RPD indicators (exploratory)**: `last.possibilities`, `last.basis` (experience vs projection vs the AI), decision time, projection reliance; experience (`years.service`, `incidents.commanded`) as moderator.

## Revision 23 Oct 2026 (be) — the difficulty audit: pre-registered pilot checks, the pretest covariate, the source-memory classes

Source: `docs/audits/2026-10-23-difficulty/` (`audit.md`, `proposal.md` (f), (g)). The changes to the session are `15` (be), to the items `08` (be), to the records `07` (be). They are a treatment revision before pilot 2: no data are pooled across them (`30` §2).

**1. Pilot checks (pre-registered for pilot 2; the thresholds are DRAFT, RC).** Each is computed from the browser log by the named code; a check that fails is reported, and the listed next step is taken before the lock — never a change to a scored item's key after data.

| Check | Target | Computed by |
|---|---|---|
| The rule is understood (public sessions) | ≥ 80 % correct at the first attempt on `primer.q.records` | `primer_check` (attempt 1) |
| Seeking starts early | ≥ 90 % of participants submit at least one Haku or Thinker question by V2's freeze; ≥ 70 % in VP | `isInformationSeekingAct` (`derived-measures.ts`) on `ai_chat_query_submitted` / `query_submitted`, by view |
| Seeking continues | median ≥ 1 question per view in V1–V7 and in V8–V14; views with no seeking act ≤ 40 % | the same records; `timeToFirstInformationSeekingActMs` |
| The practice lesson reaches its record | the forecast record (`evt.wx.01`) retrieved in VP in ≥ 50 % of sessions | `atomExposure` (routes `haku_chat`, `thinker`, `digest`, `recent`), view 0 |
| Key records reached | for the 14 items whose key needs a recorded-only record: the key record retrieved before the freeze in ≥ 50 % of sessions | `freezeItemExposure` / `atomExposure` |
| Items discriminate | per-item accuracy 30–85 % for L2/L3 and 40–95 % for L1; no item below 30 % in both groups (the floor; chance is 25 %) | `freezeItemScores`; `spamMeasures` |
| Confidence is used | the lowest-confidence (25) share ≤ 40 % per participant | `lowestConfidenceShare` |
| Freezes fit their cap | timeouts ≤ 5 % of freezes; no item missing in > 10 % | `freeze_submitted.timedOut`, `missing` |
| Late items | the 8 late items' accuracy (`items.csv` `late_lt60s`) not more than 15 points below their view's other items | `freezeItemScores` × the audit's lead |
| Map | the map-point error median ≤ the tolerance; map-dependent items' accuracy correlated with the pretest score (reported, not a gate) | `haversineMetres` in `freezeItemScores`; `map_pretest_answer` scored against `content/pretest/map-pretest.key.json` |
| The pretest itself | no pretest item answered right by every one of the first five novices (else new marks); completion within the cap ≥ 90 % | `map_pretest_answer`, `map_pretest_completed.endReason` |
| Background groups | firefighters, military and novices: L2/L3 accuracy reported per background; no background group under 35 % on the H2 window | `freezeItemScores` × `role.rank` and the public background items |
| The cue and the notice are seen | the consult notice opened in ≥ 30 % of the views where it is shown; Haku opened while the "New records" badge is up in ≥ 50 % of views (`cycle_start` / `step_boundary_reached` before `tab_selected` "haku") | `consultExposure`; the badge's state rebuilt from those records (`07` (be)) |
| Group parity of seeking | the Haku-question count differs by < 20 % between groups in phase A; the Thinker group's own questions counted apart | the same records, by cell |

If seeking stays under its target after these changes, the next step is not to push more records (which would remove seeking) but to raise the practice lesson to two items and repeat the rule at V2's start. If the late items fall short, the pre-registered fallback is `proposal-items.md` e.2 (ii).

**2. The pretest as a covariate.** The score (0–6, the key file's options) enters only as a covariate: item-level on the map-dependent freeze items (`items.csv` `map_dependence` required or helps) and on map-point error. It is never an exclusion criterion and never shown. Scored in the analysis from the key file; the browser log carries the choices only.

**3. Power.** H2t's power (`30` (az), 49 % at a small effect) assumed 8 of 24 stream-told items and today's seeking; the rule in the tour and primer, the practice lesson and the badge raise seeking in both groups and so shift `toldClass` rates (the AI-told share up, the "neither" stratum down). **Re-run `tools/power/h2-power.ts` with pilot 2's `toldClass` rates before the lock**; the power figures are not changed now.

**4. Source memory (`30` §5.5).** Three facts were classed `record_only` though every record they rest on is pushed (`pp2_560`, `ek15_arrival`, `ek14_fuel`; `audit.md` §7 item 1): they are `pushed` now (`source-memory.ts`, tested), so four facts are pushed controls, two `ai_likely`, one `map`, two lures, and none `record_only`. The class is a covariate; no stimulus changed. `cabins_nw` (`map`) is also stated by two pushed records (`evt.vp.011`, `evt.c01.008`): RC whether it stays `map`.
