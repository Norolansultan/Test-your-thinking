# 30 — Two-group teaming design: 100 participants, own and team understanding, guided Thinker

**Status:** Governing from 19 Oct 2026 for the groups, the guided Thinker, the measures and hypotheses named here. Where it conflicts with `01`, `08`, `09`, `15`, `26` or `27`, this document wins; each of those carries a short revision note pointing here.
**Scope:** the study with professionals (100 participants), its two groups, what the guide does, what is measured, the hypotheses of Papers 1–3, what moves to other samples, and the checklist before the pilot.

> **Changelog**
> - **19 Oct 2026 (ay)** — the skills review (`31`) amends §3 (V14 P2 not contradicted; P1 re-worded, DRAFT; "sparks over the Honkaharju forest road"), §4 (the notice yields to a freeze due within 15 s), §5.1 (V12's freeze after the plan; "now" = the view's end for view-end freezes; the 240 s cap; the V4 and V14 items re-authored), §5.2 (tool-aided probes; H-T as an item-level model), §5.3 (three-way told split; digest and recent matches logged), §5.5 (two lure facts), §6 (H13 codes the act, RC; V14 sound only via the secondary route, RC; fallbacks), §8 (replaced by `31` §6), §11 (re-runs). See the revision at the end.
> - **19 Oct 2026** — created. Researcher decisions of 14–19 Oct 2026: only 100 participants; two groups instead of three; the study is framed as human–AI teaming (how teaming with an AI changes the commander's own situational understanding and metacognition, and whether an AI can act as a facilitator and strategic guide); a critical review cut the additions that cost more than they bring (§9).

---

## 1. The research question

How does teaming with an AI change a commander's own situational understanding and metacognition, and can an AI that facilitates and guides strategically support decisions without taking the thinking away?

The two groups give the AI two roles, read through Endsley's three SA levels:

| Group (cell id) | The AI's role | SA level the AI supports | Who does the rest |
|---|---|---|---|
| Haku (`radio`) | Information facilitator: finds and summarises records | L1 (perception) | The commander comprehends and projects |
| Guide (`reasoning_intent`) | Strategic facilitator: Haku plus the Open Thinker, which connects facts, states uncertainty, asks back, and from V8 relates the situation to the leader's intent with a rule-based premise check | L2–L3 (comprehension, projection) and intent | The commander decides |

The guide never decides and never recommends a posture (the frozen rule "assess, never enforce", `14` ab.2, stays).

## 2. Groups and allocation

- **100 participants, 50 : 50**, permuted blocks of 10 (5 `radio` : 5 `reasoning_intent`), stratified by session language as before (`27` §2.2). DRAFT strata, researcher to confirm: English 12 blocks (120 codes), Finnish 2 blocks (20 codes, pilots and Finnish sessions). The seed stays 20261005; the table, its `rowsSha256` and the composition are new (`app/session/assignment.ts`, `tools/assignment/generate.ts`, `content/assignment/allocation.json`).
- **`reasoning_once` is no longer allocated.** Its code path stays (demonstration codes, old logs) but no participant code carries it.
- **Paper 1** compares Haku with the guide in phase A (V1–V7), where the guide is the Open Thinker on request; before V8 it carries P2's opening intent as data only, as built.
- **Treatment revision.** Sessions run before this document are not pooled with sessions after it for any hypothesis.

## 3. The guide in phase B: a rule-based premise check, worded by the model

From V8, when the higher command's directive is in force, the guide's decision answers carry the status of the directive's two authored premises (P1, P2; `content/thinker/directive-premises.json`).

1. **The status is not the model's judgement.** A premise-evidence table (`content/thinker/premise-evidence.json`, hashed in the Thinker manifest) gives, for each phase-B view and each premise, `contradicted` or `not_contradicted`, and for a contradiction the atom ids of the deciding records and the virtual time from which it holds (never before the deciding record has been received). DRAFT statuses (panel to confirm, §8): V9 P1 contradicted (SPOT 17:01, the new fire); V10 P1 contradicted (SPOT 17:01, DR2 17:25, DR3 17:35); V14 P1 contradicted (the second flare-up) and P2 contradicted (EK16: the head crossed the Honkaharju road, 19:00–19:20); V8, V11, V12, V13 none. V13's sparks over R2 are a panel decision, not the model's.
2. **The server looks it up** (`server/thinker/premise-check.ts`, a pure function of view and the records clock) and overwrites the model's premise statuses with the table's; the model's own premise rating is not used. A `departure_justifiable` verdict is allowed only when the table has a contradicted premise (the existing downgrade rule, now against the table).
3. **What the participant sees.** The premise line is a fixed template in the session language, never model text, for example "P2 Roads or water ahead of each fire still give a line that can be held — no longer holds: EK16 19.22." (the record's time, in the dot format of the answers) When nothing is contradicted the line reads "Directive premises: no newest record contradicts P1 or P2." The model writes only the options and their trade-offs; prompt rule 5 tells it that departing options name the contradicted premise and say which aim they keep or put at risk.
4. **Pull only, assess only.** The line appears only in decision (`options`) answers the participant asked for; lookups and safety answers carry none; nothing is pushed.
5. **Logged** in the Thinker server log per answer: the table version and hash, the statuses and atom ids shown, and whether a flag was shown; the client's answer record carries the same statuses.
6. **Fidelity.** Unit tests: a flag in every no-fit view (V9, V10, V14) once its record is in, none in V8 and the fit views, none before the deciding record's time. The live probe (`npm run thinker:probe`) then checks only the wording (departing options name the premise; no recommendation, no imperative).

## 4. Exposure without pushing content

Paper 2's power depends most on whether participants consult the AI before their plan (`27` §6.3). Pushing AI content was considered and rejected (§9): it would break `27` §7.1 (deciding quantities are recorded, not pushed) and remove the information seeking that Paper 1's control measures and Paper 3 need.

- **Consult notification (both groups, every main view V1–V14).** At 60 s on the view's clock a non-modal notice appears beside the tool button: "New reports since your last plan" with one button that opens Haku (Haku group) or the Thinker (guide group). It carries no content, is identical in fit and no-fit views and is never triggered by a record (it would otherwise flag the no-fit views). If a freeze or a SPAM item is open at 60 s, it waits until that closes. Logged: `consult_prompt_shown`, `consult_prompt_opened`, `consult_prompt_dismissed`.
- **Suggested question (guide group, V8–V14).** One chip above the Thinker's input: "What has changed that matters for my plan?" (fi: "Mikä on muuttunut niin, että sillä on merkitystä suunnitelmalleni?", native check §8). It submits that question as typed; logged as the ordinary chat query with `viaChip: true`.

## 5. Measures

### 5.1 Own situational understanding: blanked freezes

As built (V2, V4, V5, V7, V10, V12, V14), with two changes:

- **Two more L3 items in each phase-A freeze** (V2, V4, V5, V7: 2×L1, 2×L2, 4×L3; H2's window grows from 16 to 24 L2/L3 items). The new items follow `08`'s rules (consequences the envelope does not draw, report-keyed numeric keys with margins, the 1.3× option rule, no recall-answerable key) and are DRAFT until the domain review (§8).
- **No-fit views V10 and V14: the freeze comes after the plan is final** (at the view's end, after the plan-confidence click, before the next view), so its items cannot point participants at the deciding front before their plan (`27` §4.3's rule for SPAM, now applied to freezes). Cost: V10's freeze can cue the next view (V11, a fit view), which affects H14 only; V14 is the last view. The `afterFreeze` splits stay. V2, V4, V5, V7 and V12 keep their pre-planned random moment.

### 5.2 Team situational understanding: SPAM with the tools

Since `27` revision (ag) the tools stay usable during a SPAM item. **V3 and V6 get a second SPAM item at L2 or L3** whose key rests on a record the participant can reach with Haku or the Thinker; both items follow one "ready". Each person then has own understanding (freeze, display blanked) and team understanding (SPAM accuracy and latency, tools at hand) in phase A; the difference is the hand-over index (§6, H-T). V8 and V11 keep one item (phase-B cueing rules).

### 5.3 What the AI stated: the told / not-told split

A blanked freeze item answered correctly may be remembered from the AI (borrowed) or worked out (own). For every L2/L3 freeze item, `aiStatedKey` (analysis, `app/telemetry/freeze-measures.ts`) reports whether a Thinker or Haku answer shown to that participant before the freeze stated the item's key, by the item's authored `keyStatements` (fi and en patterns; generic band and sector matching as a fallback). Two coders audit a sample of matches. Pilot 2 estimates how often the AI states a key; items stated in more than 15 % of guide sessions are rewritten before the main study.

### 5.4 Metacognitive monitoring and control

- **Confidence on every freeze and SPAM item** (as built, 25/50/75/100).
- **Plan confidence:** after each main view's plan is final, one item: "How confident are you that your plan fits the situation?" (25/50/75/100). Logged `plan_confidence_submitted`. Calibration is read in the keyed views (V9–V14); in phase A it is a Paper 3 signal.
- **Control from the logs:** consulting after low confidence, opening a record an AI answer cited, revising the plan, answering the consult notification. The logging kinds defined but not emitted before this document are now emitted: `pointer_track`, `query_first_keystroke`, `query_edit`, `decision_option_hovered`, `probe_option_hovered`, `probe_answer_changed`, `frame_stats`.

### 5.5 Source memory (post-session)

Seven facts from the session, each with one question: "Where did this come from for you?" — I worked it out myself / a report, the message log or the map / Haku / the Thinker (guide group only) / I did not know this. Shown after the existing post-session items and before the workload items. With the log (who stated the fact first, whether its record was retrieved), it measures misattribution: AI-supplied knowledge remembered as one's own (`11` §7.15, the replacement named when the in-freeze source question was withdrawn on 2 Oct 2026). DRAFT facts, domain and native review (§8).

## 6. Hypotheses

Two-sided, α = .05. One primary per paper; each paper's secondaries are one Holm family.

**Paper 1 — phase A (V1–V7), guide vs Haku.**
- **H2 (primary). Overconfidence.** Per participant, mean confidence minus proportion correct on the L2/L3 items of the V2, V4, V5, V7 freezes (24 items); compared between groups in a participant-level model with item random effects as specified in `09` (the gap estimator of `tools/power/h2-power.ts` is its stand-in). *Supersedes* the confidence × accuracy interaction as primary; resolution becomes H2r (secondary).
- **H2t (secondary). Borrowed versus own.** H2 on the items whose key the AI had not stated to that participant (`aiStatedKey` false); and the group × stated interaction on accuracy and on confidence. The pre-stated reading: overconfidence concentrated in not-stated items is an illusion of understanding from teaming.
- **H1 (secondary).** Accuracy on the same items.
- **H-T (secondary). Hand-over.** The group difference in (team accuracy on the SPAM L2/L3 items) minus (own accuracy on the freeze L2/L3 items of phase A).
- **H3 / H9** (planted record, `09`): unchanged.

**Paper 2 — phase B (V8–V14), the guide as a package** (an integrating AI that also carries the leader's intent and checks its premises) **vs Haku.** The claim is about the package; separating intent from integration is a later study.
- **H13 (primary). Justified departure.** Share of postures coded C in the keyed no-fit views (V9, V10, V14); logistic mixed model, group + view, participant random intercept, intention to treat.
- **H14 (secondary).** Aligned plans in the fit views V11–V13.
- **H15 (secondary).** Group × fit on aligned plans over all keyed views.
- **H18 (secondary). Plan-confidence calibration** in the keyed views, by group.
- **H17 (exploratory, guide only).** After a premise flag shown before the plan: C, and opening the cited record before deciding.
- *Withdrawn:* H16a/H16b (merged into H13), and every contrast with `reasoning_once`.

**Paper 3 — predicting metacognitive state (exploratory, pre-registered).** Labels: per freeze item, a confident error (confidence ≥ 75 and wrong); per keyed view, a miscalibrated plan. Features: only the logged behaviour of §5.4 before the label's moment, fixed in the pre-registration. Validation: cross-validation that leaves whole participants out; then an external test on the student sample (§7) or the professor's environment without refitting.

**Source memory (exploratory).** Misattribution rate by group.

## 7. What moves elsewhere

- **Student / bridge sample (rescue students):** the told-versus-facilitated experiment (two check-in versions within the AI group, randomised per participant) and Paper 3's external test. It needs its own spec before it runs.
- **The professor's dynamic environment:** AI-drafted team guidance with planned errors, AI outages, guidance that changes outcomes.
- **Not in the professional study:** pushed AI check-ins, per-team drafts, an AI-outage view.

## 8. Before the pilot (people, not code)

| Item | Who |
|---|---|
| The public repository holds the answer keys, panel keys, premises and scenario: make it private, or move the keys out, before recruitment | Researcher (GitHub settings) |
| Panel keys for V9–V14 hold only with clear agreement (at least 4 of 5 experts); a view without it is reported, not coded | Expert panel |
| The premise-evidence table (§3), the eight new L3 items (§5.1), the two SPAM items (§5.2) and the seven source-memory facts (§5.5) | Domain reviewer, panel |
| Finnish wording of every new text (chip, notification, items, questions) | Native speaker |
| The open domain questions of `27` §7.1 (deciding quantities by radio) and §7.3 e (crews on the south-east edge in the fit views) | Domain reviewer |
| Pin the model build (§10) and record it in the pre-registration | Researcher |
| Ethics: the notification, the plan-confidence item, the source-memory block | Researcher, ethics board |
| Strata sizes of the allocation table (§2) | Researcher |
| Participants never see the web demonstration or game mode before their session | Researcher |

## 9. What was considered and cut (critical review, 15–19 Oct 2026)

- **Pushed AI check-ins at every view** — breaks `27` §7.1, removes information seeking, turns the live model into authored text, and creates told-item contamination. Replaced by §4.
- **Two check-in versions (told / facilitated) within the guide group** — the facilitating version previews freeze questions, splits Paper 1's treatment into two, and doubles the authored content. Moved to the student sample (§7).
- **A third group** (leader's voice without premise check) — 33 per group leaves every contrast underpowered; Paper 2 states the package claim instead.
- **A source question in every freeze** — withdrawn on 2 Oct 2026 for good reasons (reconstructive answers, reactivity); replaced by §5.5.
- **AI-drafted team guidance with planned errors** — a separate automation-bias study (§7).

## 10. Model drift

The Thinker's configured model (`gemini-3.5-flash`) was observed answering as another build (`gemini-3.6-flash`, `14` ar probe). Over months of recruitment the treatment would drift.

- **Pin:** `THINKER_EXPECTED_MODEL_VERSION` (server environment). When set, an answer from any other build is refused as a model error (the participant sees the ordinary "unavailable" answer) and logged `modelVersionMismatch`; the server also logs `modelVersionChanged` when a session's build differs from its first answer's.
- **Monitor:** run `npm run thinker:probe` weekly during data collection and keep its log.
- **Pre-registered rule:** a forced change of model build is a treatment revision; sessions are analysed with a period term, and the change is reported.
- **Worth checking:** an open-weights model with a permissive licence, run locally (fixed build, no network during a session, replicable). Its Finnish needs a probe first.

## 11. Power

`tools/power/h2-power.ts` and `tools/power/paper2-power.ts` (shared helpers in `power-lib.ts`), re-run 19 Oct 2026 for this design: 1000 replicates per cell, seeds 20261002 (H2) and 20261004 (Paper 2), α = .05 two-sided; 50 / 50, 40 / 40 (20 % attrition) and a reference row (the old plan). The assumptions are the tools' (SPEC/09 amendment of 2 Oct 2026, SPEC/27 §6), not pilot values; pilot 2 re-estimates exposure and the stated-key rate, and the tools are re-run before the pre-registration locks.

**H2 (overconfidence gap, primary) and H2r (resolution), 16 → 24 L2/L3 items, Haku / guide:**

| Scenario (population Δgap) | 50 / 50 | 40 / 40 | 70 / 140 (ref.) |
|---|---|---|---|
| Small overconfidence, δ +0.4 (+.064) — gap | 54 → **70 %** | 50 → 59 % | 82 → 92 % |
| Medium overconfidence, δ +0.8 (+.124) — gap | 99 → **100 %** | 96 → 99 % | 100 % |
| Resolution λ 0.5 — GLM× (H2r) | 31 → 39 % | 26 → 34 % | 53 → 63 % |
| Mixed (λ 0.75, δ +0.4) — gap | 31 → 41 % | 27 → 34 % | 54 → 64 % |
| Null — gap / GLM× | 6 / 5 % | 5 / 7 % | 6 / 4 % |

**H2t (30 % of the guide group's items stated by the AI; on those the guide is more accurate, +1.5 logit, and confident):**

| Scenario | Gap on all items, 50 / 50 (16 → 24) | Gap on not-stated items (H2t), 50 / 50 | 40 / 40 all · not-stated |
|---|---|---|---|
| Not-stated δ +0.4 | 23 → 29 % | 49 → **64 %** | 27 · 54 % |
| Not-stated δ +0.8 | 77 → 86 % | 97 → 99 % | 77 · 98 % |
| Cancellation (not-stated δ +0.4, borrowed confidence lags, pooled Δgap ≈ 0) | **5 %** | 53 → **63 %** | 5 · 53 % |

**Paper 2 (H13 justified departure in V9, V10, V14; H14 aligned in V11–V13; H15 group × fit), guide vs Haku; "exp" is the share of no-fit views in which the participant asked a decision question before the plan; the flag is always right (§3):**

| Scenario | C, Haku → guide | H13 50 / 50 · 40 / 40 · 70 / 70 | H14 | H15 |
|---|---|---|---|---|
| Check, exp .6, δ 1.0 | 26.9 → 37.0 | 41 · 40 · 56 % | 27 · 18 · 32 % | 70 · 56 · 84 % |
| Check, exp .6, δ 1.5 | 26.7 → 42.1 | 77 · 69 · 90 % | 40 · 33 · 49 % | 92 · 86 · 98 % |
| Check, exp .8 (notification), δ 1.0 | 26.9 → 40.3 | **66** · 60 · 80 % | 43 · 36 · 55 % | 89 · 85 · 98 % |
| Check, exp .8, δ 1.5 | 26.7 → 47.4 | **94** · 87 · 99 % | 67 · 57 · 81 % | 100 · 98 · 100 % |
| Compliance amplifier, γ 0.7 | 27.1 → 17.4 | 50 · 40 · 61 % | 38 · 32 · 51 % | 4 · 5 · 6 % |
| Null | 26.9 → 27.0 | 7 · 5 · 5 % | 5 % | 5 % |

**Reading.**
1. H2 is powered for a medium overconfidence effect (100 %; 99 % after attrition); a small effect reaches 70 % with 24 items (59 % at 40 / 40). The two added L3 items per freeze are worth 9–16 points.
2. Resolution (H2r) and the mixed effect are under 41 %: they stay secondary.
3. H2t is not optional: when the AI states keys and borrowed confidence lags, the all-items test shows nothing (5 %) while the not-stated test keeps 63 %; even calibrated borrowing halves the all-items power.
4. H13 is powered only if the notification works: exposure .8 with a +20-point effect gives 94 % (87 % at 40 / 40); +13 to +15 points give 66–77 %; exposure .6 with a small effect, 41 %. The amplifier reading (−10 points) has 50 %.
5. H15 is the most sensitive test of the check (89–100 %) but blind to the amplifier (4–6 %); H14 is the weakest (27–67 %). Most of H14's and H15's power rests on the assumption that the "no premise contradicted" line in the fit views moves posture toward aligned by the same δ; if that line has no effect, both fall. A null on H13 or H14 says little about moderate effects.

---

## Revision 19 Oct 2026 (ay) — after the skills review (`31`)

`31` governs where it differs from the text above. In short:

- **§3.** V14 P2 is `not_contradicted` (the directive names no line; R2 is held, as V13's own note reasons); V14 P1 stays contradicted (SPOT 19:23), so the flag still fires in V14 and §11's exposure assumption holds. P1 is re-worded (DRAFT, panel and native speaker) so that a new fire or rekindle since the directive contradicts it in V9, V10 and V14 and nothing else does; crew safety is not made a premise (V11 stays fit). Item 1's "V13's sparks over R2" reads "over the Honkaharju forest road". Both are **RC** (researcher to confirm before the pre-registration); the table is re-hashed after the panel.
- **§4.** The consult notice is deferred past a freeze due within 15 s (sagat F23).
- **§5.1.** The V4 `growth_next` item is re-authored so its basis is delivered and its report and truth bands agree (RC); V14's `se_front_r2` and `head_later` are replaced; every L3 stem names its horizon; ordinal bands ascend; the cap is 240 s for 8-item freezes. **V12's freeze also runs after the plan** (its items cue the aligned cell in a fit view; H14), so the sentence "V2, V4, V5, V7 and V12 keep their pre-planned random moment" reads "V2, V4, V5 and V7". For a view-end freeze "now" is the view's end, stated in the header.
- **§5.2.** The second items are "tool-aided probes" (accuracy with the tools; no latency-as-SA claim); H-T is an item-level mixed model, not a two-item difference; pilot 2 decides on more items.
- **§5.3.** Items are classed stream-told / AI-told / neither; H2t contrasts the last two (RC). The guide's digest and both tools' recent matches are logged in the browser and count as exposure (retrieved ∪ digest ∪ recent; sensitivity retrieved-only). `aiStatedKey` counts only answers after the basis record and in the freeze's view or the one before; `statedLure` is reported.
- **§5.5.** Two false lure facts; the `ai_likely` facts are recorded-only and uncued.
- **§6.** **H13 codes the act (RC):** a plan attends the keyed front when its main effort attacks it directly or its secondary task on its sector is direct attack, mop-up or hold-line (panel to rate the probe plans); an attending plan codes C; the label-based coding is the sensitivity. **V14 is sound only through the secondary route (RC):** a main effort on the flare-up codes D. Fallback: a view keyed mixed or without 4-of-5 agreement is reported, not coded. H2 adds a dual-key sensitivity on the report-keyed numeric items, a format covariate and a chance-corrected sensitivity.
- **§8** is replaced by `31` §6 (one ordered list, merged with `11` §7.30).
- **§11.** The H2 rows stand (24 items unchanged). The H2t figure is an upper bound under the three-way split; `h2-power.ts` is re-run. `paper2-power.ts` is re-run with act-based base rates per view, V14's secondary route and a two-view fallback case. Point 4's reading does not cover the fallback.
- **The scenario.** A provisional flame-length table (Byram, Kalajoki pairs) replaces the phase-B flame bands before the panel sees the record sets (RC for the keys); the station's T/RH every step; LCES lines for the R2 crews; the game's scenarios no longer replay keyed events and the demonstration is gated during recruitment (`31` §5, §2.5).
