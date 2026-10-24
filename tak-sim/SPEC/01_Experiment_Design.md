# 01 — Experiment design

**Version 3.1 · 17 September 2026** (v3.0 · 13 September 2026). Supersedes `01_Experiment_Design_v2.md` in full. **8 Oct 2026 (aa): there is no no-LLM control; the groups, H1, H2, H9 and Paper 2's hypotheses read as in the revision (aa) at the end.**

> **Changelog**
> - **24 Oct 2026 (bg)** — H9's freeze item (V12 F7) is scored for H9 only and counts in no SA accuracy or calibration composite (H1, H2 and their secondaries, H-T): its key is the safety default (`09` (bg) §1).
> - **19 Oct 2026 (ax)** — two groups of 50 (`30` §2): Haku against the guide. H2's primary test is the overconfidence gap on 24 phase-A L2/L3 items; resolution is secondary (H2r); H2t (borrowed vs own), H-T (hand-over) and H18 (plan-confidence calibration) are added; Paper 2's H13 is the guide against Haku, H16 withdrawn. See the revision at the end.
> - **8 Oct 2026 (aa)** — the groups after the Haku / Open Thinker redesign: no no-LLM control; H1, H2 and H9 are an Open Thinker increment over a structured LLM chat; Paper 2 resolved in `27` (aa). See the revision at the end.
> - **4 Oct 2026 (u)** — Paper 2's hypotheses H13–H17 added (`27` §5.7); H11 and H12 kept as descriptive levels; revision (t)'s "Group (exploratory)" clause superseded; Paper 1's phase-B tests nest the Thinker cell. See the revision at the end.
> - **4 Oct 2026 (t), review round 2** — H12's sound posture is a direct attack on the new front's sector (L3); whether to add a no-directive arm is a researcher decision (`11` §7.16.2).
> - **4 Oct 2026 (t)** — H8 withdrawn (the rule-3 vs rule-4 collision and the intent-line contrast); Paper 2 restated as H11 (compliance where the directive fits) and H12 (justified deviation where it does not). See the revision at the end.
> - **1 Oct 2026 (r)** — H9 read at V12 only (F7 asked once). See the revision at the end.
> - **25 Sep 2026 (q)** — H9 and H10 read as intention-to-treat; exposure-conditioned versions exploratory (`14` revision (q)).
> - **25 Sep 2026 (p)** — 14 main views (`26`); H7 dropped; H10 added (rekindle anticipation); holdout V1–V7 / V8–V14.
> - **25 Sep 2026 (o)** — the claim restated as machine integration on request; H2 (calibration on blanked L2/L3 SA items, phase A, two-sided) stays the only primary; H1 two-sided; H9 added for the planted record. See the revision at the end.
> - **23 Sep 2026 (j)** — radio removed (`02` revision (j)); the groups are now Haku and Haku + LLM; source selection re-operationalised. See the revision at the end.
> - **17 Sep 2026 (f)** — LLM (facts) group removed. Two groups: Radio (70) and LLM reasoning (130, pull-only); LLM reasoning split 65 / 65 at the hinge (guidance once vs. intent line in AI answers).
> - **17 Sep 2026 (e)** — three Paper 1 groups restored — Radio, LLM, LLM reasoning; both LLM groups pull-only; only the LLM-reasoning group is split at the hinge by how it receives the guidance. Group sizes open (default 70 / 65 / 65).
> - **17 Sep 2026 (d)** — two groups (no AI 70, AI 130); AI group pull-only with group-specific training; AI group split 65/65 at the hinge, the via-AI half receiving query answers framed against the commanded strategy; branch choice adopted with four authored options plus *Ei mikään näistä*, no free text; per-choice alignment feedback removed.
> - **17 Sep 2026 (c)** — only the reasoning-AI group is split by guidance mode; prologue warm-up; 10 freezes × 5 items, 6 SPAM, 9 unprobed (see `15` v1.1).
> - **3.1 · 17 Sep 2026** — Pre-session metacognition battery dropped (F5); H7 reformulated; course-of-action choice added alongside allocation (F7); H8 re-stated for the split guidance design (F4). See `15`, `16`.
Changes from v2: one scenario not two; twenty cycles not nine; `directed` replaces `human`; the conditions table is replaced by the capability matrix in `02`; transfer validation replaced by temporal holdout; retrospective walkthrough decoupled from the session.

---

## 1. Claim and mechanism

Machine projection substitutes for mental simulation. Mental simulation produces not only a forecast but the cues by which its reliability is judged — where a value was guessed, where a source was weak, where an assumption carried weight. Judgements of one's own understanding run on exactly those cues. When the machine performs the integration, the forecast arrives without those cues, and confidence becomes ungrounded: the comparison standard was never built.

The prediction is a **collapse at the point where integration moves from human to machine**, not a gradient across synthesis levels. Conditions are therefore typed `directed | assistive | substitutive` rather than placed on a continuum.

A counter-consideration is held open rather than dismissed. Collective-behaviour models show that group steering works without signalling and without members knowing who is informed; the inability to notice may be a cost of scalable coordination rather than a defect. The contribution is to state that tension and measure one side of it.

### 1.1 The failure mode being measured

Not error. Not hallucination. Not a machine that lies.

The machine takes two partially-true reports and compresses them into one reasonable summary. The summary is accurate and useful. It loses the one line that would have changed the decision. Nobody can point at a mistake. That is the failure mode, and the whole instrument exists to make it occur under controlled conditions and to detect whether anyone notices.

The clearest instance is authored at cycle 18 and described three ways in `02` §6.

---

## 2. Design

**One scenario. Twenty cycles. One continuous session.** Between-subjects on condition.

One scenario rather than two, because the twenty-cycle incident is the unit of realism: a strategic hinge at its midpoint, a fatigue arc across it, and an information corpus dense enough that querying is a skill. Two shorter scenarios would have given a clean transfer test and a worse study.

One continuous session rather than two sittings, because sustained attention under accumulating fatigue is part of the phenomenon. A commander at hour six is the case of interest, not a confound to be engineered away. Fatigue is therefore **measured**, not avoided: cycle index enters every model, and the pre/post fatigue items in the questionnaire are analysed as an outcome in their own right.

The cost of that decision, stated plainly: there is no second scenario on which to test a proxy without refitting. That cross-scenario test is replaced by a **temporal holdout** — proxies are developed on cycles 1–10 and evaluated on cycles 11–20 with no refitting (`09` §7.3). This is weaker than cross-scenario transfer because content and participant are shared. It is declared as a limitation, not disguised.

---

## 3. Hypotheses

**H1.** Judgement accuracy about whether the projection will hold is equal or higher in `substitutive`. The channel is genuinely informative. *A null or positive result here is required for the study to be about metacognition rather than about a bad tool.*

**H2 (primary).** Confidence–accuracy calibration is substantially worse in `substitutive` than in `assistive`, with little difference between `assistive` and `directed`.

**H3.** Detection of the embedded contradiction is similar in `directed` and `assistive` and markedly lower in `substitutive`. In the first two conditions the contradiction is available to anyone who compares; in the third the comparison has been performed and presented as settled, so detection requires doubting a synthesis.

**H4.** Confidence that actual development falls inside the displayed envelope is higher in `substitutive` and less related to whether it does.

**H5.** Between-participant divergence of judgements, failure localisations and allocations is lower in `substitutive`. Convergence here can be convergence on a wrong picture, which makes it error rather than loss of variety.

**H6 (mechanism).** Cycles carrying the expectation-marking step show better calibration, and the repair is larger in `directed` and `assistive` than in `substitutive`. A repair that fails specifically in `substitutive` localises the mechanism.

**H7 (exploratory).**

> **[SUPERSEDED 2026-09-17]** H7 is reformulated in the amendment below. Baseline metacognitive efficiency, from the pre-session battery, predicts in-task calibration more strongly in `directed` and `assistive` than in `substitutive`.

**H8 (phase B, Paper 2).**

> **[SUPERSEDED 2026-09-17]** H8 is re-stated in the amendment below; guidance mode is no longer nested in condition. Alignment of allocations with the strategic intent delivered at the hinge decays across phase B in `directed` and is sustained in `substitutive`, where the channel restates intent and flags alignment. See `02` §7 for the confound this carries.

**H2, H3 and H6 are the paper.** H1 is a precondition. The rest are reported.

---

## 4. What the instrument must make measurable

This section is the requirements bridge: every item here must have a named record in `07_Telemetry_and_Logging.md` or an authored answer key entry in `04_Data_Model.md`.

### 4.1 Primary

**Judgement accuracy.** Twenty containment judgements per participant, resolved against authored polygon containment with declared tolerance. The collected response is three-way (`holds` / `partly_wrong` / `fundamentally_wrong`); the binary needed for signal-detection analysis is **derived**, never collected. See `08` §3.2.

**Calibration.** Pre-registered primary: Brier score with calibration and resolution components separated, plus the over/underconfidence gap. Secondary: metacognitive efficiency estimated with a measure robust to dynamically varying difficulty, hierarchically pooled. Response-caution parameters are reported alongside. The reason: metacognitive-efficiency ratios share variance with decision caution, and any response-time proxy is entangled with the offline criterion through that shared variance.

**Contradiction detection.** Binary, from the open uncertainty probe at cycle 18, coded blind, with a forced-choice backup at cycle 20. Confidence in the overall picture is captured immediately before and after the detection window.

**Envelope coverage confidence.** Stated confidence that actual development falls inside the envelope, scored against whether it did.

### 4.2 Secondary

- Failure-localisation accuracy: distance from marked geometry to the nearest actual breach.
- **Relative accuracy on rejection:** was the participant's drawn correction closer to the actual outcome than the machine's envelope was? Binary, and the single most interpretable number the study produces.
- **Doubt–action coherence:** after a rejection, is the allocation consistent with the correction, with the envelope, or with neither? The second pattern — stated rejection followed by an allocation that assumes the envelope — is the most interesting failure in the design.
- Allocation robustness: branches under which the chosen allocation remains viable.
- **Allocation safety:** branches under which the chosen allocation exposes a crew to an untenable position. Scored separately from robustness; a robust-but-unsafe allocation is a distinct and important outcome.
- Decision-space narrowing: options preserved or foreclosed.
- Source-selection behaviour: which units are asked, whether selection tracks authored reliability, and — in every condition — whose lateral traffic the participant chooses to read.
- Tier-4 discovery: for each of the three load-bearing lateral items, whether it was reached, by which route, and in which cycle.

### 4.3 Process and telemetry

Specified for capture in `07` and for derivation in `09` §6. In summary:

- every click, with target identity and latency from the relevant stimulus onset;
- dwell and revisits per element;
- **drawer open/close events, which are the cleanest reliance measure in the design**;
- query text verbatim, with composition timing and reformulation chains, including abandoned queries;
- retrieval results and misses;
- which returned items were opened and how far they were scrolled;
- probe response latencies and confidence-slider dynamics, including reversals;
- viewport and layer state;
- allocation changes.

### 4.4 Two probe modes are required

Blanking is a property of the probe set, not of the freeze. The containment judgement needs the envelope on screen; the recall probe needs the picture blank. Both halt the clock and disable the channel. Building only one mode makes half the measures impossible.

### 4.5 No outcome feedback during the session

Participants are never told whether a judgement was correct. With trial-by-trial feedback, confidence can be driven by reinforcement history and the measure stops being metacognitive. Full debrief follows the session, asynchronously and in writing (`09` §5).

---

## 5. Two gates that cannot be fixed later

These are pilot exit criteria. Failing either means re-authoring, not re-analysing.

**Gate 1 — containment accuracy.** Judgement accuracy must land between **60% and 80%** in pilot. Outside that band, calibration measures are uninterpretable: at ceiling there is no error variance to be calibrated against, at floor the task is not the task.

**Gate 2 — contradiction detection.** Detection in the `directed` condition must land between **20% and 70%**. Outside that band H3 has no variance.

Mitigation is authored in advance, not improvised: **three candidate contradictions of graded subtlety** and **thirty containment items for twenty slots** exist so that pilot 2 tunes by selection rather than by re-authoring. Selection is recorded in the scenario version.

---

## 6. Allocation space

Each ground formation and aerial asset is assigned to one of a fixed task set per sector. The task set is sized so that meaningful distinct allocations number roughly twenty to sixty. Each allocation has **viability**, **robustness** and **safety** pre-computed against every authored branch. A larger allocation space makes that pre-computation intractable and pushes scoring back onto rater judgement.

A free-text rationale accompanies each allocation and carries the stated-premises artifact.

---

## 7. Pre-session battery

> **[SUPERSEDED 2026-09-17]** The metacognition battery is dropped. The pre-session component is consent, demographics (incl. echelon) and AI literacy only (~15 min). Baseline metacognition comes from the prologue (warm-up) — see `15` §3 and §7.

Administered online **several days before** the session, never on the day. A half-hour of confidence-monitoring practice immediately beforehand would prime the monitoring under test.

| Component | Duration | Notes |
|---|---|---|
| Consent, demographics | 5 min | Role, years of service, incident-command experience, prior simulation exposure, self-reported familiarity with the scenario region |
| AI literacy | 10 min | Validated instrument plus a short performance component. Pre-register the direction: prior work found higher AI literacy predicted *greater* overestimation and worse metacognitive accuracy |
| Metacognition battery | 30 min | Two blocks of different task type, one low-knowledge and one knowledge-based, so domain-generality is checked rather than assumed. Adaptive staircase holding first-order accuracy near 70–75%. Multi-point confidence. 100+ trials |

The battery is the offline criterion for Paper 3 and the covariate for H7. It is load-bearing, not preliminary: per-participant metacognitive efficiency comes from here, because twenty in-scenario judgements cannot support a per-participant estimate.

**The battery is a separate deliverable from the instrument** and is not built on this codebase. See `11` §2.

---

## 8. Portability

The engine treats domain as data. The same conditions, cycle structure and measures instantiate in a military or industrial-crisis scenario, which is the cross-domain replication that would license any claim of transferability beyond emergency response. Identical instruments across domains are what would make that claim honest. Nothing in the code may assume wildfire semantics: fire-specific vocabulary lives in the scenario bundle and the Finnish string table, not in the engine.

---

## Amendment 2026-09-17

**H7 (exploratory, reformulated).** Baseline calibration from the prologue (identical for everyone, no AI) predicts in-task calibration more strongly in `directed` and `assistive` than in `substitutive`.

**H8 (Paper 2, re-stated).** Within the reasoning-AI group, strategy alignment of course-of-action choices decays across phase B when guidance is delivered once and is sustained when guidance is maintained by the AI. Blind compliance (option B, `16` §3) is higher under AI-maintained guidance. Guidance mode is randomised within that group, so the contrast is not confounded with integration level.

**§6 addition.** Each cycle also contains a four-option course-of-action choice with confidence, before the allocation (`16`). Allocation, its scoring and doubt–action coherence are unchanged.

**§4.1 addition.** Blanked freezes carry five SA items each (2 × L1, 2 × L2, 1 × L3), each with confidence (`15` §4.4).

---

## Revision 17 Sep 2026 (d) — supersedes earlier amendments where they conflict

### Consequence for the design's claim

With one AI group, Paper 1 compares **AI support vs. none**. It can no longer separate *integration* from *machine retrieval*, which was the v3.0 primary contrast (`substitutive` vs. `assistive`). This is a deliberate narrowing and must be stated as a limitation (`09` §11).

### Hypotheses, restated for two groups

Throughout, "AI" means the pull-only AI group, and phase A is the primary window.

**H1.** Judgement accuracy is equal or higher in the AI group. *(Precondition, unchanged in role.)*

**H2 (primary).** Confidence–accuracy calibration is worse in the AI group than in the no-AI group.

**H2a (mechanism, new).** Within the AI group, calibration worsens with the share of queries that retrieve integrated `meaning`/`projection` answers (delegated comprehension/projection) and improves with the share of fact-checking queries.

**H3.** Detection of the embedded contradiction is lower among AI participants who queried the affected flank (they receive a settled synthesis) than among no-AI participants who accessed both reports. Tested conditional on access.

**H4, H5.** As before, with AI vs. no AI.

**H6 (mechanism).** Expectation-marking cycles repair calibration more in the no-AI group than in the AI group.

**H7 (exploratory).** Prologue calibration predicts main-block calibration more strongly in the no-AI group.

**H8 (Paper 2).** In phase B, strategy alignment of course-of-action choices decays less in cell 3 than in cell 2, and the difference grows with the number of phase-B queries. Blind compliance (option B) is higher in cell 3.

---

## Revision 17 Sep 2026 (e) — supersedes revision (d) where they conflict

The three-group hypotheses of v3.0 (H1–H6) apply again with `directed` = Radio, `assistive` = LLM, `substitutive` = LLM reasoning, **read under pull-only access**: integration reaches participants only through their own questions. Revision (d)'s "Consequence for the design's claim" is withdrawn — the integration contrast is back.

**H2a (kept from (d)).** Within the LLM groups, calibration worsens with the share of queries answered by integrated `meaning`/`projection` content.

**H3 (pull-only reading).** Among participants who queried the affected flank at cycle 18, contradiction detection is lower in LLM reasoning (settled synthesis) than in LLM (both reports returned separately) and Radio.

**H8 (Paper 2).** Within LLM reasoning, phase-B alignment decays less in the intent-line cell than in the once cell, increasingly with the number of phase-B queries.

---

## Revision 17 Sep 2026 (f) — supersedes revisions (d) and (e) where they conflict

**Consequence.** Paper 1 compares **LLM reasoning with no AI**. Without an LLM-facts group, an effect cannot be attributed to *integration* as distinct from *having an AI to ask*. State this in `09` §11 and in the paper.

Hypotheses as in revision (d), with "AI" = LLM reasoning:
- **H1** accuracy equal or higher with LLM reasoning (precondition).
- **H2 (primary)** calibration worse with LLM reasoning than with Radio, phase A.
- **H2a** within LLM reasoning, calibration worsens with the share of queries answered with `meaning` / `projection` content.
- **H3** among participants who reached both cycle-18 reports (Radio) or queried the affected flank (LLM reasoning), detection is lower with LLM reasoning.
- **H4–H7** as (d), LLM reasoning vs. Radio.
- **H8 (Paper 2)** in phase B, alignment decays less in cell 3 than in cell 2, increasingly with query volume.

---

## Revision 23 Sep 2026 (j) — Haku vs. Haku + LLM

Follows `02` revision (j): the participant cannot ask a unit or the duty officer. Both groups search the same recorded database with the same query builder (`25`); the AI group also has the AI drawer.

**Hypotheses.** H1–H8 of revision (f) stand, reading "Radio" as **Haku**, and "LLM reasoning" as **Haku + LLM**. H3 becomes: *among participants who reached both cycle-18 reports (Haku: through the builder or as pushed bubbles; Haku + LLM: also through a narrow AI question), detection is lower with Haku + LLM.*

**What the contrast now isolates.** With identical search tools and nothing reachable only by asking, the groups differ **only** in the AI. Revision (f)'s caveat still holds: without an LLM-facts arm the effect is *integration plus having an AI to ask*, not integration alone. But the earlier second confound is gone: the two groups no longer have different routes to unrecorded knowledge.

**Measures.** §4's source-selection measure changes:
- *Which units are asked*: **withdrawn**.
- *Whose traffic the participant reads*: kept, now measured as the KUKA (source) slot choices in the query builder (`07` revision (j)).
- *Whether selection tracks authored reliability*: kept, computed on KUKA choices against `SourceClass.reliability`.

**Gate 2** (contradiction detection within 20–70%) now applies to the **Haku** group.

**Scope statement for the papers.** The study measures metacognition over **recorded** information. What crews knew but never recorded is unavailable to every participant (`19` revision (b)). The participant is still framed as the incident commander, and a commander who cannot transmit is a declared realism limitation (`09` revision (j)).

---

## Revision 25 Sep 2026 (o) — the claim restated; calibration on SA stays primary

Follows `02` revision (o): both groups see the projection, the AI is presented as an analysis agent, and one planted false record is added.

### §1, the claim, restated

With the projection shown to both groups, the manipulation is no longer machine projection. It is **machine integration of recorded situation information, on request**. The mechanism is carried over: when the agent integrates, the participant receives conclusions without the cues their own integration would have produced (which source was weak, which report was old, where two records disagreed). Confidence in their own understanding of the situation then loses its grounding.

### Hypotheses, restated (supersede revisions (f) and (j) where they conflict)

- **H2 (primary, the only primary).** Confidence–accuracy calibration on the **blanked SAGAT Level 2 and Level 3 items** is worse in Haku + LLM than in Haku. It is modelled item by item as a confidence × accuracy interaction (`09` §7.1 form). The primary window is **phase A** (freezes in views V2, V4, V5, V7 after revision (p); four freezes, as before), where cells 2 and 3 do not yet differ. The direction is predicted, and the test is **two-sided**.
- **H1 (accuracy, now two-sided and no longer a precondition).** SA accuracy on the same items differs between the groups. Two mechanisms predict opposite directions, and both are stated in advance. **Support:** retrieval and integration give a better picture. **Offloading:** the picture is held by the agent, not by the participant, so blanking removes it.
- **Reading H1 and H2 together.** Worse calibration with equal accuracy means ungrounded confidence. Lower accuracy with unchanged confidence means offloading plus overconfidence. The pre-registration states both readings.
- **H9 (new, secondary). The planted record** (fault F7, never corrected). Among participants who encountered the false record, holding the false value at the freezes of views V7 and V12 (`26` §4) is more frequent in Haku + LLM. Encountering it means opening the record in Haku or receiving an AI answer that cites it. Process measures: opening the cited source or running a Haku query on the topic after the AI answer (verification), and the time to do so.
- **H3–H8 are unchanged.** H6 uses Type E as before. Type J is again the same task in both groups and enters H2's sensitivity analysis.

**Sensitivity analyses** (pre-registered, not primary): H2 over all eight main-block freezes with cell as a covariate; H2 on Type J judgements.

**§4.1, primary.** Read "calibration" as calibration on the blanked L2/L3 SA items. The Brier decomposition and the over/underconfidence gap are kept as descriptive companions.

---

## Revision 25 Sep 2026 (p) — fourteen views and the rekindle

Follows `26`.

- **H7 is dropped.** With one practice view, there is no prologue calibration baseline. The baseline metacognitive-efficiency covariate is dropped with it (`09` revision (p)).
- **H10 (new, secondary).** Anticipation of the rekindle (a unit allocated to L3, or bog content in Type E or SA answers, in views V7–V8) is less frequent in Haku + LLM than in Haku. The predicted mechanism is Thinker's broad-question drop of the recorded objection (`26` §5). The test is two-sided.
- **Counts.** Hypotheses read over 14 main views: Type J and course of action 14, freezes 7 (phase A 4, so H2's data are unchanged), Type E 7 against 7 for H6, and H8's phase-B decay over 7 views.
- **Paper 3 holdout:** V1–V7 develop, V8–V14 evaluate.

---

## Revision 25 Sep 2026 (q) — live Thinker

H1, H2, H9 and H10 are tested as randomised group contrasts (intention-to-treat). With live generation over retrieval, what each AI participant received depends on their questions, so the exposure-conditioned readings of H9 and H10 are exploratory (`09` revision (q)).

---

## Revision 1 Oct 2026 (r) — F7 asked once

Follows `08` revision (r) and `26` revision (r).

- **H9** is read at **the freeze of V12 only**. F7 is asked once; V7's freeze no longer carries a line item. This supersedes "at the freezes of views V7 and V12" in revision (o).
- **H2's data are unchanged.** The infrastructure items added to every freeze are L1, and the F7 item (L2) falls in phase B, so neither enters the phase-A L2/L3 item set. The freeze-position covariate and sensitivity analysis are in `09` revision (r).
- No hypothesis is added. Decision commitment time and allocation revisions are exploratory measures (`09` revision (r)).

---

## Revision 4 Oct 2026 (t) — H8 withdrawn; Paper 2 restated as compliance and justified deviation

Follows `18` revision (t) (one directive from P2 replaces the four hinge rules) and `16` revision (t) (the main effort's posture).

### H8 is withdrawn

H8 is withdrawn in every form:
- §3's H8, and the re-statements in the amendment of 17 Sep and in revisions (d), (e) and (f);
- the readings carried forward by revisions (j) ("H1–H8 … stand"), (o) ("H3–H8 are unchanged") and (p) ("H8's phase-B decay over 7 views").

Its test case in the scenario was the collision of hinge rules 3 and 4 at V11 (the release request; `26` §3). Both rules are dropped, so the collision no longer exists. Its contrast (intent-line cell against once cell) rests on the intent-line split, which is not implemented (`02` revision (t)). The number H8 is not reused.

### Paper 2, restated

**The question.** A superior's directive does not fit every situation it will meet. Do commanders **comply where it fits and deviate, for sound reasons, where it does not?** The directive is the same for every participant (`18` revision (t)). The measure is the main effort's posture in every view (`16` revision (t)).

- **H11 (Paper 2): compliance where the directive fits.** In V11–V14, the share of postures aligned with the directive (`barrier_line` or `protect_values`). It is estimated per view and read against the base rate of officers who saw the same views without the directive (`16` revision (t) §t.5). If the directive has an effect, compliance should be above the base rate. The comparison is two-sided.
- **H12 (Paper 2): justified deviation where it does not fit.** In V9 and V10, the share of `direct_attack` with the main effort on the new front's sector (L3: from V10 the map's detached front; in V9, before the front is mapped, only SPOT's "vanhan eteläreunan ulkopuolella" against L3's label "Etelä"; round 3), which is the sound posture there (draft key, `16` §t.2). It is estimated per view and read against the same base rate. A share below the base rate means that the directive is followed where the situation calls for something else (blind compliance, cell B). The comparison is two-sided.
- **Group (exploratory).** Whether H11 or H12 differs between Haku and Haku + LLM. Two-sided, no direction predicted. The directive is not searchable by Thinker or Haku (`02` revision (t)), so any difference must come through how the situation is read, not through access to the directive.

**Modest claims.**
- Each estimate rests on two views (H12) or four (H11) per participant.
- The keys are drafts until the panel confirms them.
- The base-rate group is small (`16` §t.5).
- Fit is designed into particular views, so the claim is about **these** situations: a small new front early in phase B, and a defensive line on roads later. It is not a general rate of justified deviation.

**Unchanged.** H1, H2 (the only primary), H9 and H10. The posture field adds one required choice to every view's plan, in both groups and in both phases. H2's window (the phase-A freezes) is unaffected, apart from the few seconds the extra field takes.

**Pre-registration.** H8 is withdrawn before the pre-registration is locked, so no registered plan is departed from. The pre-registration states H11 and H12, the per-view coding and the base-rate comparison (`09` revision (t)).

---

## Revision 4 Oct 2026 (u) — Paper 2's hypotheses (`27`)

Follows `27` (governing for phase B and Paper 2). **This supersedes**, in revision (t):
- the bullet **"Group (exploratory)"** (whether H11 or H12 differs between Haku and Haku + LLM). The group contrasts are now H13–H16 below;
- the reading of H11 and H12 as hypotheses tested against the base rate. **H11 and H12 stay as descriptive levels**, reported per view and per cell beside the base-rate group (`27` §5.8). The base-rate group is not randomised and no confirmatory test rests on it (`27` §2.4).

**Paper 2's question** (`27` §1.1): does an LLM facilitator that keeps the directive in view, and says for each answer whether the recorded situation fits it, help commanders apply the directive, or does it produce blind compliance? The cells are those of revisions (f) and (j); cell 3 is now built as the **strategy-guided Thinker** (`reasoning_intent`, `27` §3.2).

**Hypotheses** (numbered after H12; H8 stays withdrawn and is not reused):
- **H13 (Paper 2 primary). Justified deviation.** In the keyed no-fit views (V9, V10, and any no-fit view added and keyed under `27` §7.4), the share of postures coded C differs between `reasoning_intent` and `reasoning_once`. Two-sided, α = .05, intention to treat. Higher in `reasoning_intent` supports an application aid; lower supports a compliance amplifier (blind compliance through the AI).
- **H14 (secondary).** Compliance (A) in the keyed fit views (V11–V14) differs between the same two cells.
- **H15 (secondary).** Discrimination: the cell × fit interaction on aligned postures over all keyed views.
- **H16 (secondary).** (a) `reasoning_intent` vs Haku and (b) `reasoning_once` vs Haku on C in the keyed no-fit views.
- **H17 (exploratory).** Within `reasoning_intent`, the posture follows the last `linjaus` status received before the plan, whether that status is right or wrong.

H14, H15, H16a and H16b are one family, Holm at α = .05. Models, outcomes and the analysis set are in `27` §5 and `09` revision (u).

**Paper 1's phase-B tests.** H3 (V13), H9 (V12) and the V8 half of H10 compare Haku with Haku + LLM, and from V8 the two Thinker cells differ. They keep their form with the Thinker cell as a nested factor; if the two cells differ on the measure (α = .10), the Haku + LLM estimate comes from `reasoning_once` alone and the pooled one is a sensitivity analysis (`27` §1.4). H1, H2 and H6 (phase A) are unaffected: the cells are identical there.

---

## Revision 6 Oct 2026 (w) — H6 withdrawn

Researcher decision, 6 Oct 2026, while cutting the session toward one hour (`08` revision (w)).

- **H6 is withdrawn**, and with it Type E (expectation marking), its only instrument.
- **Why:**
  - The manipulation no longer did what H6 needs. Since revision (o), the projection has been on the map from the moment a view opens. Type E came when the decision panel opened, 20 s in. The projection was hidden while the participant drew, but they had already seen it. So the drawn expectation was anchored on the machine's, not generated before it.
  - The cost was high for a secondary hypothesis. Seven map drawings take about six minutes of session time.
- **The confirmatory set is unchanged:** H1, H2, H9, H10, and Paper 2's H13. H3–H5 stand as before. H10's anticipation is read from the allocation to L3, the outlook and the SA answers in V7–V8; the Type E content is gone (`09` revision (w)).
- Revision (u)'s "H1, H2 and H6 (phase A) are unaffected" now reads "H1 and H2".

---

## Revision 6 Oct 2026 (x) — the view asks only for the decision; situation awareness is measured only in the freezes

Researcher decision, 6 Oct 2026. Built 6 Oct 2026. Details: `08`, `09`, `15`, `16` revision (x).

**What changes.** Inside a view, the participant is asked only what they decide: the sector plan (`16` revision (s)). The following are withdrawn:
- the containment judgement (Type J, *"Pitääkö ennuste paikkansa…"*), with its confidence and its follow-ups (breach point, correction, branch choice);
- the outlook.

Situation awareness, comprehension and projection are measured only in the blanked freezes.

**Why.**
1. **J set a verification frame in every view.** Asked 14 times whether the projection holds, participants of both groups spent the view checking the machine. That is the behaviour the study compares between the groups, so the instrument imposed it.
2. **J taught that the projection fails.** The wording invites doubt, and the 7H/3Q/4C flags teach a base rate of about one failure in two. Natural over-reliance, the AI risk under study, was trained away by the instrument.
3. **Rejections cost more.** "Holds" ended the question; a rejection brought three or four more steps. That biased J and its calibration toward "holds".
4. **A per-view forecast (J or the outlook) rehearses what the freeze L3 items measure.** It also forces every participant to build their own picture. That is what the offloading account of H1 says AI users may skip, so the instrument would narrow the very group difference H1 and H2 look for. When the forecast came before the freeze in the same view, the freeze could also be answered from memory of one's own answer.
5. **Thinker could be asked J itself.** Haku cannot answer it, so the groups did different tasks.

**Hypotheses.**
- **H1, H2, H9, H10 and Paper 2 (H13–H17) are unchanged in content.** Their data come from the freezes, the plan and the probes, not from J or the outlook.
- **H3 and H4** stay on Type U.
- **H5** (divergence) is read from the plans; J's localisations are gone.
- **J's role in H2's sensitivity analysis (revision (o)) ends.**
- **New exploratory measure: reliance on the projection.** It is read from behaviour, without being asked (`09` revision (x)).

**The projection** stays on the map from the view's start, for both groups. The briefing describes it as one information source among others. It keeps the researcher's general model caveat of 1 Oct 2026 ("Malli ei näe kaikkea, ja ennuste voi olla väärä"). Nothing says how often the projection holds, or that checking it is the task (`15` revision (x)).

---

## Revision 8 Oct 2026 (aa) — the groups after the Haku / Open Thinker redesign; Paper 2's contrast

Researcher decisions of 6–8 Oct 2026 (`02` revisions (z) and (aa)). Details: `09` and `27` revision (aa). This revision updates the hypotheses of revisions (o), (j) and (u), which the earlier redesign revision (z) did not reach in this file.

**The groups.** There is **no no-LLM control**. Both groups ask a language model in free text over the same time-gated records:
- **Haku group (70):** the structured chat (four fields, standard prompt, no history, no recommendation by form).
- **AI group (140; 130 before revision (au), 11 Oct 2026):** the same Haku chat **plus the Open Thinker** (conversation with history, plan context, may recommend). The allocation cells `reasoning_once` and `reasoning_intent` (14 : 14 of the 42-block) are identical by design and pooled.

**Paper 1.** The claim of revision (o), "machine integration on request", reads as *an open advisory conversation on top of a structured LLM retrieval chat*.
- **H1** (accuracy equal or higher) and **H2** (calibration worse; the only primary; blanked phase-A L2/L3 items, two-sided) are the effect of the Open Thinker increment, not of "AI against no AI".
- **H9** (the planted false record held at V12) no longer contrasts "found by hand" with "passed on by the AI": the record is reachable through the Haku chat in both groups. Exposure is measured with `atomExposure`, `answerRelaysAtom` and `plantedFalseValueHeld` (`09` revision (aa)); the headline stays intention-to-treat. H3 and H10 are read the same way.
- **H4 and H5** stand with the same re-reading. H6 is withdrawn (revision (w)).
- Replayed freezes: the first answer per view and item counts and a replayed view is dropped (`09` aa.3).

**Paper 2.** Resolved in `27` revision (aa): a **directive-aware Open Thinker against Haku** (140 against 70 since revision (au); 130 before), the directive delivered to both conditions as P2's radio message at V8 and a persistent on-screen line. H13 (primary): whole-plan alignment in the no-fit views; H14: the same in the fit views; H15: group × fit. H16 and H17 are withdrawn. H11 and H12 stay descriptive.

**Stale in this file:** §2's and revision (j)'s group descriptions ("no AI"), revision (d)'s "AI group split 65 / 65 at the hinge", revision (u)'s H8 and H13–H17 wording, and every "Radio / no-AI" reading of H1–H5.

## Revision 19 Oct 2026 (ax) — two groups; the hypotheses of `30`

`30` governs. In short:

- **Groups.** Haku (`radio`, 50) and the guide (`reasoning_intent`, 50). `reasoning_once` is no longer allocated. In phase A the guide is the Open Thinker on request; from V8 it carries the directive and a rule-based premise check (`30` §3).
- **Paper 1 (phase A, V1–V7).** **H2 (primary): overconfidence** — the per-participant gap (mean confidence − proportion correct) on the L2/L3 items of the V2, V4, V5, V7 freezes (24 items, `30` §5.1), guide against Haku. The confidence × accuracy interaction (resolution) is **H2r, secondary**. **H2t (secondary):** H2 on the items the AI had not stated to the participant (`aiStatedKey` false) and the group × stated interaction. **H1 (secondary):** accuracy on the same items. **H-T (secondary):** the hand-over index, team accuracy (SPAM with the tools, `30` §5.2) minus own accuracy (freezes). H3 and H9 unchanged.
- **Paper 2 (phase B, V8–V14).** **H13 (primary):** justified departure (C) in the no-fit views V9, V10, V14, guide against Haku, as a package (an integrating AI that carries the leader's intent and checks its premises). H14, H15 and **H18** (plan-confidence calibration) secondary, one Holm family; H17 exploratory (after a premise flag); **H16a/b withdrawn** (merged into H13). §1.2's claims read accordingly; separating the intent from the integration is a later study (`30` §7).
- **Paper 3** (`30` §6): a pre-registered exploratory model of metacognitive state from logged behaviour, validated leaving whole participants out and tested externally.
- **Treatment revision:** sessions before 19 Oct 2026 are not pooled with sessions after it.
