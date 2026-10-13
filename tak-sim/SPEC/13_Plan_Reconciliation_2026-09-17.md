# 13 — Plan reconciliation, 17 September 2026

**Status: working document, not governing.** It records conflicts between SPEC v3.0 (13 September 2026) and a set of study-plan decisions made in chat on 16–17 September 2026. Until each fork in §3 is answered, **SPEC v3.0 remains the build specification** and every conflicting item is registered as open in `11` §7.

---

## 1. Why this document exists

The 16–17 September decisions were formed in a conversation that did not have SPEC v3.0 in view. They fall into three kinds:

- several restate what v3.0 already does, in different words;
- several are genuine changes;
- several contradict v3.0 decisions that were made deliberately and have reasoning behind them (invariant I6, the nested Paper 2 design, the load-bearing pre-session battery, the deterministic probe schedule).

Applying them mechanically would leave the spec internally inconsistent. This document separates the three kinds.

**Files reviewed:** `SPEC/00`–`12` (from `SPEC.zip`, 13–16 Sep versions), `ARCHIVE/README.md`, `SAGAT_measurement_spec.md`.
**Not available for review:** `PhD_Simulation_Scenarios.xlsx`, `Data_Management_Plan.md`. Both must be checked once the forks below are answered.
**Note on the loose uploads:** the separately uploaded `00`, `04`, `11` and `12` are *older* than the copies in `SPEC.zip` (they lack the `12` symbology closure). The zip versions were used as the base.

---

## 2. Classification of the chat decisions

### 2.1 Already consistent with v3.0 — no change needed

| Chat decision | Where v3.0 already has it |
|---|---|
| Fire / rescue-services domain | `03` throughout |
| Units of ~3.5 min | Cycles average 3.5 min real time (`03` §2.1) |
| Ground truth fixed and scripted; decisions do not change events | `00` §5, `06` §4.6 |
| Strategy change no later than midway | Hinge between cycles 10 and 11 (`03` §2.3) |
| Change announced explicitly | Duty-officer message at the hinge (`02` §7) |
| No "did the participant notice the steering" measure | v3.0 never had one |
| Three-way judgement of the AI projection with confidence | Type J, `08` §3.2 (`holds` / `partly_wrong` / `fundamentally_wrong`, 0–100) |
| Home / remote testing, long session acceptable | `09` §1, `08` §5.2 |
| Blanked recall freezes with AI locked and no feedback | Type R, `PROBING_BLANKED`, `01` §4.5 |
| Verbatim capture and coding of what participants ask | `07` §2.5 (query and radio text, reformulations, abandoned queries) |
| Group-level analysis goal | `09` §7 |

### 2.2 Genuinely new and compatible — can be applied once confirmed

| Chat decision | Effect |
|---|---|
| N = 200 firefighters | Answers `11` §1.1 in size. Echelon still to confirm (fork F8). Three conditions × ~67 is well above v3.0's 30-per-condition minimum |
| Coding scheme for questions: SA level, function (information / explanation / verification / delegation / challenge), grounding, framing | Extends `11` §4.2 coding manuals; no data-model change |
| Paper 3 focus on how information seeking differs for situation vs projection questions | Extends `09` §7.3; uses existing `07` §2.5 records |
| Intent queries (current priority) after the change | Fits Type R item bank as an L1/L2 intent item; needs invariants |

### 2.3 In conflict with v3.0 — require a decision (see §3)

Listed file by file.

**`00_README.md`**
- §3 **I6 — no language model in any condition** vs. chat references to "LLM queries" and a "reasoning AI that can reason and suggest". → F2
- §2 **One scenario, twenty cycles** vs. chat "5 warm-up + 20 main scenarios in 4 missions". → F4
- §2 **Six blanked freezes** vs. chat 14 SAGAT freezes; **no SPAM** in v3.0. → F6
- §2 Session ~110 min vs. chat ~3 h. → follows from F4/F6
- §2 Conditions `directed` / `assistive` / `substitutive` vs. chat "no AI / query AI / reasoning AI". → F3

**`01_Experiment_Design.md`**
- §7 **Pre-session battery is load-bearing** (per-participant metacognitive efficiency, Paper 3 offline criterion, H7) vs. chat decision to drop the metacognition test. → F5
- §6 **Allocation task** (20–60 allocations, viability / robustness / safety, doubt–action coherence) vs. chat **2 × 2 fixed-choice decision** (aligned/against strategy × sound/unsound). → F7
- H8 assumes nested guidance mode. → F4

**`02_Conditions_and_Information_Routing.md`**
- §1 condition definitions vs. chat naming. → F3
- §1 "directed" is not a no-AI condition: it has the radio panel and browsing. A chat "no AI" group would need a definition.
- §7.2 **Guidance mode nested inside condition** vs. chat **within-subject** radio vs. maintained guidance, with a persistent on-screen intent display for the no-AI group. v3.0 §7.2 states a within-subject structure is incompatible with a single twenty-cycle scenario. → F4

**`03_Scenario_Master.md`**
- §2 single incident with one hinge; within-subject Paper 2 needs at least two guidance episodes. → F4
- §4.3 probe placement (R at 2, 5, 9, 13, 16, 19) vs. chat 12 main + 2 warm-up freezes and SPAM in 5 units. → F6
- §9–10 branches and viability table exist to score allocations; their scope changes if F7 replaces allocation.

**`04_Data_Model.md`**
- §8 `ProbeType` has no SPAM type; `ProbeMode` has no non-halting mode. → F6
- §7 `AllocationSpace` vs. a `DecisionOption` 2 × 2 type. → F7
- §11 `SessionConfig` has no guidance-order counterbalance. → F4
- `ConditionId` values. → F3

**`05_System_Architecture.md`**
- §7 retrieval closure (I6) vs. LLM. → F2
- §4 freeze machine: both modes halt the clock; SPAM requires a probe that does not. → F6

**`06_UI_and_Interaction.md`**
- Allocation surface vs. fixed-choice decision panel. → F7
- Persistent intent display for a no-AI group is not in the layout. → F4

**`07_Telemetry_and_Logging.md`**
- Needs SPAM records (`spam_ready`, `spam_answered`) if F6 adopts SPAM.
- Needs decision-before/after-alignment-feedback records if F7 adopts the 2 × 2 with AI feedback.
- Needs generated-response capture if F2 admits an LLM.

**`08_Probes_and_Instruments.md`**
- §2 deliberately **deterministic** scheduling (random freezes could land in the contradiction window) vs. chat "random freeze timing, 2–3 counterbalanced schedules". → F6
- §3.1 three items per freeze vs. chat 10–15 (or 4–5).
- §8.4 practice effects are handled by cycle index; chat adds 5 no-AI warm-ups vs. v3.0's three practice cycles in the participant's own condition. → F4/F5

**`09_Methods_and_Analysis.md`**
- §2 recruitment target 110–130 officers vs. 200 firefighters. → F8
- §8 per-participant metacognitive efficiency from the battery. → F5
- §11 limitation "guidance mode nested". → F4

**`10_Build_Plan_and_Acceptance.md`**
- M5, M6 (channel vocabulary, I6), M7 (probe types and schedule), M8 (allocation table), M10 (training) all change depending on F2–F7.

**`12_Map_Symbology_and_Projection.md`**
- No direct conflict. §6.3 excludes machine-recommended tasking (`AllocationRecommendation` asserted empty); a "reasoning AI that suggests" would reopen that. → F2

**`SAGAT_measurement_spec.md`** (written in chat, 16 Sep)
- Built on the 25-scenario plan without knowledge of v3.0. Conflicts with `00` §2, `02` §7.2, `08` throughout. **Marked non-governing** until the forks are answered.

---

## 3. The forks

Each must be answered before the corresponding spec files are edited. Recommended answers are given where v3.0's reasoning is strong; they are recommendations, not decisions.

**F1 — Which document is the base?**
Either v3.0 stays the base and chat decisions are applied on top, or the chat plan replaces it.
*Recommendation:* keep v3.0 as the base. It is more developed, internally consistent and already covers most of the chat plan (§2.1).

**F2 — Is there a language model in the instrument?**
v3.0 excludes one entirely (I6) so that every output is authored, controlled and reproducible, and so that the omission at cycle 18 is designed rather than incidental. The chat plan mentions LLM queries and a reasoning AI.
*Recommendation:* keep I6. Communication analysis does not need an LLM: `assistive` and `substitutive` already capture free-text queries verbatim. If an LLM is wanted, it breaks I1 (determinism), I6, the reachability rule and the controlled omission, and needs its own design round.

**F3 — How do the chat group names map to v3.0 conditions?**
Candidate mapping: no AI → `directed`; query AI → `assistive`; reasoning AI → `substitutive`. But `directed` is "directed retrieval without machine query", not "no information support", and `substitutive` pushes integrated signals rather than answering questions with reasoning.
*Needs your confirmation.*

**F4 — Paper 2: nested (v3.0) or within-subject (chat)?**
Within-subject needs at least two guidance episodes, which means either two hinges in the one scenario (one delivered each way) or multiple missions. That changes `03` structurally and multiplies authoring. With N = 200, a third option opens: keep v3.0's single hinge and run guidance mode **between subjects inside the `assistive` and `substitutive` groups** (radio-only vs. maintained), leaving Paper 1 intact.
*Needs your decision.* This is the largest structural question.

**F5 — Drop the pre-session metacognition battery?**
v3.0 makes it the offline criterion for Paper 3 and the covariate for H7. The chat plan replaces it with in-task warm-ups. With 20 judgements plus 18 recall items per person, a per-participant efficiency estimate is weak; Paper 3's validation target would have to be redefined (e.g., in-task calibration, hierarchically estimated).
*Needs your decision,* and if dropped, H7 and `09` §7.3 must be rewritten.

**F6 — Probe schedule: v3.0's six deterministic blanked freezes, or more freezes plus SPAM?**
v3.0 already collects 20 visible judgements with confidence per person plus 18 blanked recall items; freeze timing is fixed to protect the contradiction and omission windows. Adding SPAM needs a non-halting probe mode.
*Recommendation:* keep deterministic scheduling; decide separately whether to add SPAM and whether to raise recall items per freeze from 3.

**F7 — Decision task: allocation (v3.0) or 2 × 2 fixed choices (chat), or both?**
The allocation task carries doubt–action coherence, robustness, safety and decision-space narrowing. The 2 × 2 choice gives cleaner Paper 2 scoring (alignment × soundness).
*Possible combination:* keep allocation in all cycles and add a 2 × 2 fixed-choice intent decision in phase B only.
*Needs your decision.*

**F8 — Who are the 200 firefighters?**
v3.0 places the participant at *pelastusjoukkue* command level (`09` §4). If the 200 include crew-level firefighters without incident-command experience, the role and briefing must change or experience enters as a stratification variable.
*Needs your confirmation.*

---

## 3a. Answers received, 17 September 2026

**F2.** A reasoning-AI group is required in Paper 1. For now it is built the same way as the query group: a closed retrieval engine returning pre-compiled, reviewed information packages by key word and meaning. An LLM compiles the packages offline (LLM-wiki pattern); no LLM runs during a session. I1 and I6 stand. Specified in `14_Retrieval_and_Response_Engine.md`.

**F3.** Provisional mapping: no AI = `directed`, query AI = `assistive`, reasoning AI = `substitutive`. The reasoning group is request-driven for now, which departs from `02` §1.2 ("pushed, not offered"); see `14` §7.

**F4.** There is exactly one guidance episode, at the hinge, and the question is how it survives through phase B. The no-AI group receives it once, as in v3.0. The AI participants are split between guidance maintained by AI and guidance delivered the same way as for the no-AI group. This removes the v3.0 confound between guidance mode and condition. Phase A (cycles 1–10) is identical for everyone and remains Paper 1's clean window.

Sub-question: whether both AI groups are split (5 cells: no-AI ~67; query-once ~33; query-maintained ~33; reasoning-once ~33; reasoning-maintained ~33; Paper 2 contrast ~67 vs ~67) or only the reasoning-AI group (4 cells; Paper 2 contrast ~33 vs ~33). Answered later the same day: only the reasoning-AI group is split.

**Files to amend once the sub-question is answered:** `02` §1 and §7.2, `04` §11 (`SessionConfig.guidanceMode`), `05` §7 (retrieval), `07` §2.5 (package ids and types per query), `09` §2 and §11, `10` M5–M6, `01` H8.

**F5.** Metacognition battery dropped; five warm-up cycles give the baseline (`15` §3, §7).

**F6.** 14 blanked freezes, 6 SPAM probes, 5 cycles with neither, deterministic schedule (`15` §4–§5).

**F7.** Combined: a four-option course-of-action choice followed by the v3.0 allocation (`16`).

**F8.** The 200 firefighters are mostly at incident-command level; echelon is stratified and modelled (`15` §8).

**Revisions later on 17 Sep (c).** Only one AI group, reasoning AI, is split by guidance mode. Ten freezes with five SA items each (2 × L1, 2 × L2, 1 × L3), six SPAM probes, nine unprobed cycles. The warm-up is a prologue to the main incident, identical for everyone, with two freezes and one SPAM probe. Implemented in `15` v1.1, `16` v1.1 and the amendments to `00`–`10`.

**Revision (d), 17 Sep.** Two groups: no AI (70) and AI (130), the AI group split 65/65 at the hinge. The AI is pull-only with group-specific training. The via-AI half gets query answers framed against the commanded strategy; per-choice feedback is removed. The handoff's branch choice is adopted (four options plus *Ei mikään näistä*, no free text). See `17` §7.

Remaining open items are listed in `11` §7.1.

---

## 4. Change log for this pass

| File | Change | Why |
|---|---|---|
| `13_Plan_Reconciliation_2026-09-17.md` | Created | Records the conflict analysis without altering governing documents |
| `11_Open_Design_Register.md` | v3.1: §1.1 updated with the 200-participant figure; new §7 lists forks F1–F8 as open | The register is the governing place for undecided items (`00` §1.3) |
| `SAGAT_measurement_spec.md` | Status banner added: non-governing draft | It conflicts with v3.0 and must not be built from until the forks are answered |
| `14_Retrieval_and_Response_Engine.md` | Created (v0.1, proposed) | Implements the F2/F3 answers: closed hybrid retrieval of LLM-compiled, human-reviewed packages |
| `11_Open_Design_Register.md` | v3.2: F2 answered, F3 provisionally answered, F4 answered in principle | Answers received 17 Sep |
| `15_Session_Structure_and_Probe_Schedule.md` | Created (governing) | F5, F6, F8 |
| `16_Decision_Task.md` | Created (governing) | F7 |
| `00_README.md` | Study-shape table updated; precedence rule 5 for dated amendments; index rows | Keeps the front page true |
| `01`–`10` | Version 3.1: changelog, `[SUPERSEDED 2026-09-17]` markers at conflicting sections, dated amendment at the end of each file | Traceable changes without deleting v3.0 reasoning |
| `11_Open_Design_Register.md` | v3.3: F5–F8 answered; §4.1 reduced; §7.1 remaining items | Register stays the single list of open questions |
| `12_Map_Symbology_and_Projection.md` | Unchanged | No conflict |
| `15` v1.1, `16` v1.1, `00`–`11` | Revision (c): single split AI group, 10/6/9 schedule, five items per freeze, prologue | Kalle's revisions of 17 Sep |
