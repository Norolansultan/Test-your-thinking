# 27 — Phase B (Paper 2): design, manipulation, measures and power

**Version 1.1 · 5 October 2026 · Status: governing for phase B (V8–V14) and Paper 2.** Revision (u), reconciled with the build on 5 Oct 2026 (§11). Where this document conflicts with `01`, `02`, `07`, `08`, `09`, `14`, `15`, `16`, `26` or `11` §7.16 on phase B or Paper 2, **this document wins**; those files carry a dated revision (u) note pointing here. It does not change the invariants (`00` §3 and revision (q)), phase A (VP–V7), Paper 1's primary hypothesis (H2) or the rekindle arc.

> **Changelog**
> - **19 Oct 2026 (ay)** — `31`: H13 codes the act (RC); V14 sound only via the secondary route (RC); V14 P2 not contradicted, P1 re-worded (RC); V11 keyed by the panel with a horizon, fallback pre-registered; §7.2's V11 and V14 rows and §7.3 e are stale; ab.3's "measurable with `atomExposure`" corrected; V12's freeze after the plan; the panel keys from plan ratings. See the revision at the end.
> - **19 Oct 2026 (ax)** — `30`: 100 participants, two groups; Paper 2 is the guide (`reasoning_intent`, with a rule-based premise check worded by the model) against Haku, 50 vs 50; H13 primary, H14/H15/H18 secondary, H16 withdrawn, H17 exploratory; the live probe's issue of al.3 is resolved by the frozen premise-evidence table; exposure through the consult notification and the suggested question. See the revision at the end.
> - **11 Oct 2026 (au)** — the planned sample is 210 = 3 × 70 (researcher decision): permuted blocks of 42, 14 : 14 : 14, five blocks per full sample; Paper 2's contrast is 70 vs 70. Allocation table regenerated (new `rowsSha256`). Power to recompute. See the revision at the end.
> - **10 Oct 2026 (al)** — the cells separated (review panel; researcher approved): `reasoning_intent` (the order block and rule 5) against `reasoning_once` (no block; the directive is in the banner); H13 is that contrast again (65 / 65); the live probe shows a Thinker that frames options against the directive but did not flag a justified departure; per-option verdicts as the covariate. See the revision at the end.
> - **9 Oct 2026 (ai)** — the departure note's reason becomes an optional closed choice (six reasons, no tool option; descriptive); `directive.fit` is the post-session manipulation check, after the retention items. See the revision at the end.
> - **9 Oct 2026 (ag)** — SPAM: the ready prompt no longer expires and is forced (clock paused, modal) at the view's end; it can be collapsed; a 60 s answer window; Haku and the Thinker stay usable during an item (D4's lock withdrawn: SPAM measures the commander-plus-tools' knowledge); censored ready latency and per-probe tool use in the measures. See the revision at the end.
> - **9 Oct 2026 (af)** — one shared study link (`?tuotanto`): the hosted study server issues the next allocation code when the participant starts (§2.2 extended); `assignmentSource` in the header; a pilot-only cell filter (`ASSIGN_CELLS`) that breaks the cell balance on purpose. See the revision at the end.
> - **8 Oct 2026 (ab)** — the Open Thinker assesses and never enforces (frozen treatment, `14` ab.2); the phase-A share is dropped as a covariate (baseline = practice + V1); the AI's verdict is a covariate; the departure note and `accountableDeviation`; the digest mitigates the exposure dependence in the no-fit views. See the revision at the end.
> - **8 Oct 2026 (aa)** — **Paper 2 restated and the OPEN of (z) resolved:** a directive-aware Open Thinker (cells 2 and 3 pooled, 130) against Haku (70); the directive reaches both conditions by P2's radio message at V8 and a persistent on-screen line; the primary outcome is whole-plan alignment (H13 no-fit views, H14 fit views, H15 group × fit; H16 and H17 withdrawn); core-sector coding primary, boundary coding sensitivity; blind advice-following coding; power for 70 vs 130 (`power4`). See the revision at the end.
> - **8 Oct 2026 (z)** — **OPEN; resolved by (aa).** The Haku / Open Thinker redesign (`02` revision (z)) withdraws the `linjaus` line, which was the only difference between `reasoning_intent` and `reasoning_once`. H13–H15 and every `linjaus`-based exposure measure lose their manipulation; listed in revision (z). Nothing is re-decided here.
> - **6–7 Oct 2026 (y)** — V14 is a no-fit view; alignment read over the whole plan; accepted sectors from the front polygons; `soundSecondary` for V9, V10 and V14; H14 pre-registered on alignment with a boundary-sector sensitivity; `afterFreeze` / `afterBoundary` splits; power re-run for three no-fit and three fit views; review recommendations for pre-registration. See the revisions at the end.
> - **1.1 · 5 Oct 2026 (u, reconciled)** — this document was written before the phase-B round-2 builds were seen; it now describes what exists. Built since 1.0: the allocation table bound to the participant code (`content/assignment/allocation.json`, `tools/assignment/generate.ts`; §2.2); the opaque `?solu=k4|m7|t2` codes for demonstrations and pilots only; `systemPromptHash` in the server log (§3.2); the strategy-guided prompt's explicit rule confining the directive to `linjaus`, symmetric status definitions without examples (§3.2); the hinge flow with the directive shown again after the check and the two equal-length cell sentences (§3.2, §4.1); SPAM as delivered (V3, V6, V8, V11; 25 / 15 / 20 s; Haku and Thinker locked; §4.3); the exposure-before-plan measure (§3.4); the post-session request not to describe the session. **Researcher decisions of 5 Oct 2026 recorded as decided** (§7.3 c, §7.4, §9 rows 11 and 16): the crews' return to L3 moves from step 13 to step 14, and more no-fit views are added, at least one late. Their corpus changes, keys and power figures arrive with the corpus-rebuild patch (§7.5). §11 lists the build status and every remaining mismatch.
> - **1.0 · 4 Oct 2026 (u)** — created. Paper 2's question, claims and limits; the three cells and their assignment; the strategy-guided Thinker as the manipulation, its prompt principles and its fidelity; how the `linjaus` status is coded as right or wrong; the hinge check and SPAM's role; H13–H17; a power simulation (`tools/power/paper2-power.ts`); the scenario inputs for the corpus and map rebuild; threats; the decisions table that supersedes the matching open items of `11` §7.16. **8 Oct 2026 (aa): §2.3, §3.2–§3.5, §5.4, §5.7 (H13–H17) and §6 are superseded by revision (aa); the contrast is a directive-aware Open Thinker against Haku.**

---

## 0. The decisions in one table

| # | Decision | Section |
|---|---|---|
| U1 | Paper 2's causal question is the **strategy-guided Thinker against Thinker, in phase B**. Both cells get the same directive; they differ only in a fifth answer field, `linjaus`, from V8 on | §1, §2.3 |
| U2 | **Primary outcome: justified deviation (cell C) in the no-fit views** (V9, V10). Its sign separates the two rival readings: an application aid (more C) or a compliance amplifier (more B) | §5.2 |
| U3 | **No randomised no-directive arm.** The base-rate check stays outside the 200 and validates the keys; it is descriptive | §2.4 |
| U4 | **Assignment from a pre-generated allocation table**, bound to the participant code (`?tuotanto&koodi=<code>`; built 5 Oct 2026). The opaque `?solu=k4\|m7\|t2` URL parameter is for the demonstration and pilots only | §2.2 |
| U5 | **The directive stays out of the corpus** in phase B: Thinker (`reasoning_once`) stays directive-blind; only `reasoning_intent` sees it, through the system prompt | §3.2 |
| U6 | **The `linjaus` status is coded right or wrong** against the view's fit, derived from the panel's keys. A wrong status is a measured property of the treatment, not a defect to be tuned away | §3.5 |
| U7 | **A prompt audit before pilot 2**, with fixed decision rules that forbid tuning the prompt toward the keys | §3.3 |
| U8 | **The hinge check (D3)** checks that the directive was received. It is not the check of the AI manipulation; exposure from the log is | §4 |
| U9 | **SPAM is a workload and awareness covariate in phase B**, never the manipulation check and never an outcome of Paper 2 | §4.3 |
| U10 | **Paper 1's phase-B tests (H3, H9, and H10 in V8) nest the Thinker cell**; a pre-registered homogeneity rule decides whether the two Thinker cells may be pooled | §1.4 |
| U11 | **Inputs to the rebuild:** the deciding *quantity* of a no-fit view is recorded only, its *existence* pushed; three conflicting or residual records are fixed; **decided 5 Oct 2026:** at least one late no-fit view (V12–V14) is added, possibly one more, and the crews' return to L3 moves to step 14 | §7 |

---

## 1. The research question and the claims

### 1.1 The question

A superior's directive meets situations it was not written for. **Does an LLM facilitator that keeps the directive in view, and says for each answer whether the recorded situation fits it, help incident commanders apply the directive — keep to it where it fits and depart from it where the situation calls for something else — or does it produce blind compliance?**

The question is about the AI, not about the directive. Every participant gets the same directive at the same moment (`18` revision (t) §t.1). The manipulation is how one group's Thinker treats it.

### 1.2 What Paper 2 can claim

- **A randomised, causal claim about one design feature.** The two Thinker cells are identical in phase A, get the same directive, have the same records, the same retrieval and the same ranking. From V8 they differ only in generation: one model call carries the directive and returns a fifth field. A difference in posture between the cells is caused by that feature, **as implemented with this model and this prompt** (intention to treat).
- **The direction of the effect is informative either way.** More justified deviation in the no-fit views means the feature helps application. Less (more B, blind compliance) means it amplifies compliance. A null with adequate exposure is also a finding: a fit assessment on request does not change how commanders apply a directive.
- **How the AI's own verdicts went.** The share of right and wrong `linjaus` statuses per view (§3.5) is a descriptive result in its own right: how often a facilitator told a commander that the situation fitted a directive when it did not.
- **Secondary randomised contrasts** with Haku (H16): whether either Thinker variant changes application relative to searching by hand.

### 1.3 What Paper 2 cannot claim

- **Not the effect of the directive.** There is no no-directive arm (§2.4). Whether officers comply *because of* the directive is read only descriptively, against the base-rate group.
- **Not the effect of an accurate strategy aid.** The verdict's accuracy is not manipulated. It depends on the model, on the prompt and on the participant's own questions. Effects conditional on a right or wrong verdict are observational (H17, exploratory).
- **Not a general rate of justified deviation.** Fit is designed into particular views (`16` §t.2): a small new front early in phase B; a defensive line on roads later. The findings concern these situations and this directive.
- **Not a claim about recommendations.** The feature assesses fit and never names an action (§3.2). Whether an AI that recommends a posture would do better or worse is a different study (`12` §6.3–§6.4).
- **Not a claim about other models.** The treatment is the pinned model with the pinned prompt. Wording is not bit-reproducible at temperature 0 (`14` revision (q)); every answer is logged and coded.

### 1.4 Relation to Paper 1

- **Same 210 participants, one session.** Paper 1 is read from phase A (H1, H2 and H6 on V1–V7) and from designed events across the session. Paper 2 is read from V8–V14.
- **Paper 1's primary is untouched.** H2's window is phase A, where the two Thinker cells are identical by construction (D1: the cells differ only from V8). Pooling them for H2 is therefore exact, not an approximation.
- **Paper 1's phase-B measures now span two treatments.** H3 (the contradiction, V13), H9 (the planted record, V12) and the V8 half of H10 (anticipation, V7–V8) compare Haku with Haku + LLM. From V8, half the LLM group's model calls carry the directive and a fifth field, which may change how the model handles F7 or the contradiction and how much time a participant spends reading. **Rule (pre-registered):** these tests keep their Haku vs Haku + LLM form, with the Thinker cell entered as a nested factor. If the two Thinker cells differ on the measure (two-sided, α = .10, chosen for sensitivity), the Haku + LLM estimate is reported from `reasoning_once` alone (65 against 70) and the pooled estimate as a sensitivity analysis. V7's half of H10 is phase A and is pooled as before.
- **Paper 2's covariate comes from Paper 1's phase.** The phase-A posture share (V1–V7) is the baseline in every Paper 2 model (§5.5). Phase A is the same task under the offensive intent, so it separates a participant who attacks by habit from one who deviates because of the view.
- **Order of writing.** Paper 1 does not depend on Paper 2. Paper 2 cites Paper 1's phase-A results for its covariate and its description of how the groups used Thinker.

---

## 2. Design

### 2.1 Cells

| Cell | `SessionConfig.cell` (header) | Condition | Tools | Phase A (VP–V7) | Phase B (V8–V14) | n |
|---|---|---|---|---|---|---|
| 1 Haku | `radio` (legacy name) | `directed` | Haku, message log, map | — | Directive at the hinge | 70 |
| 2 Thinker | `reasoning_once` | `substitutive` | As 1 + Thinker | Thinker, four-part answer | Directive at the hinge; Thinker unchanged | 70 |
| 3 Strategy-guided Thinker | `reasoning_intent` | `substitutive` | As 2 | **Identical to cell 2** | Directive at the hinge; Thinker answers carry `linjaus` | 70 |

The header logs the real cell (built: `LogHeader.cell`, with `LogHeader.assignment` saying where it came from, §2.2). The legacy channel field `restatesIntent` (`ChannelSignalEmittedDetail`) belongs to the unused channel and is not the treatment indicator; analyses read the cell from the header only.

### 2.2 Randomisation and concealment

- **Unit and ratio.** The participant; 70 : 70 : 70 (revision (au); before: 70 : 65 : 65), in permuted blocks of 42 (14 : 14 : 14), stratified by session language (fi / en). Echelon is recorded, not stratified (this supersedes `02` revision (f)'s stratification on echelon and the `09` §2 variables): the pool is mostly incident-command level (`15` §8), and each further stratum leaves more incomplete blocks in a pool of 210. The `09` §2 variables enter the analysis as covariates where pre-registered.
- **Generation (built 5 Oct 2026).** `tools/assignment/generate.ts` (`npm run assignment:generate`; `--check` verifies) writes `content/assignment/allocation.json` from the fixed plan in `app/session/assignment.ts`: seed **20261005**, splitmix32-seeded xoshiro128**, a Fisher–Yates shuffle of each block of 42 (14 `radio` : 14 `reasoning_once` : 14 `reasoning_intent`; revision (au), before: 40, 14 : 13 : 13), strata **fi: 6 blocks (240 codes)** and **en: 2 blocks (80 codes)** (DRAFT sizes, **researcher to confirm**; codes are issued in table order within the stratum, and an unused tail of a block, not a new table, absorbs the unknown language split). Each row is `{code, language, block, cell}`. A code is the stratum's letter (`F` / `E`) and five characters from an alphabet without look-alikes, drawn by the same stream, so nothing in it depends on the cell. The file carries `rowsSha256` (SHA-256 of the rows' JSON). `test/session/assignment.spec.ts` checks that regeneration is byte-identical, the 14 : 14 : 14 blocks per stratum, unique codes and the hash. The seed and `rowsSha256` (`4310dfed…d2a8`) go into the pre-registration. The table is committed to the repository and bundled with the app (§11, mismatch M1).
- **Delivery (built 5 Oct 2026, `app/session/preview.ts` `startChoiceFromUrl`).** The study link is `?tuotanto&koodi=<code>`. The app looks the code up in the table (case and surrounding space ignored); the row gives the cell **and the session language** (the stratum; the start page then shows no language choice). The start page shows one neutral start button and never the cell. Rules: an unknown code is refused; a study link without a code does not start; a code together with `?solu=` is refused (two sources of the cell); **`?solu=` in the study configuration is refused unless the link also carries `?pilotti`** (a pilot session). Outside the study, `?solu=k4|m7|t2` (opaque codes; the brief's `haku|thinker|ohjattu` was replaced because "ohjattu" named the guided cell in the link) assigns the cell for a demonstration, and without it the start page offers the three cells. The header logs `participantCode` (the table's code; `preview` otherwise), `cell`, `language` and **`assignment`**: `{source: "table", tableSha256, block}`, or `{source: "url"}` (demonstration), `{source: "url_pilot"}` or `{source: "start_page"}`. **Only `table` sessions enter a confirmatory analysis.** A Thinker request from a table session carries the code; the server refuses a request whose cell is not the code's cell, or whose code is unknown (`server/thinker/handler.ts` `allocationError`, HTTP 400), and logs the code.
- **Concealment.** The participant knows from V1 whether they have Thinker (Haku vs Haku + LLM cannot be concealed). They do not know that the Thinker group is split: the two Thinker cells are identical until the hinge, and the training, the tour and phase A name no `linjaus`. The hinge screen's last sentence differs by cell only after the hinge check (§3.2). Free text is coded blind to cell. The `linjaus` coding cannot be blind (the field exists in one cell only); its status is coded automatically against the keys, and its grounding is coded from the sentence and the retrieved list without the participant's posture in view.
- **Contamination between participants.** Officers come from a few organisations over several weeks and may talk. The post-session screen asks participants not to describe the session to colleagues (built 5 Oct 2026, DRAFT wording in `ui.ts` `done`); the session date is to be logged (not yet: §11, M4); drift in the primary outcome over recruitment time is checked (§8, T12).

### 2.3 Contrasts

| Contrast | Role | Hypothesis |
|---|---|---|
| `reasoning_intent` vs `reasoning_once`, phase B | **Paper 2 primary** | H13 (and H14, H15 secondary) |
| `reasoning_intent` vs Haku, phase B | Secondary | H16a |
| `reasoning_once` vs Haku, phase B | Secondary | H16b |
| Haku + LLM (cells 2 + 3) vs Haku, phase A | Paper 1 primary | H2 (unchanged) |

The primary contrast isolates the one feature: same tool, same retrieval, same directive. H16a and H16b each change two things at once in one of the arms (the tool, and for H16a also the feature), so they describe, they do not isolate. Secondary tests are Holm-corrected as one family (H14, H15, H16a, H16b).

### 2.4 Why there is no no-directive arm

**Researcher decision recommended: no randomised no-directive arm** (closes `11` §7.16.2 b).

- **The question does not need it.** Paper 2 asks what the AI feature does to the application of a directive. Both arms of the primary contrast receive the directive; the contrast is fully randomised without a no-directive arm.
- **What it would answer** is whether the directive changes postures at all (compliance above what officers do anyway). That is a validity question for the keys and for H11–H12, not for H13.
- **What it would cost.** The pool is fixed at about 200. A fourth arm of ~50 takes participants from the existing cells: from Haku (H2's comparison group, Paper 1's primary) or from the Thinker cells (Paper 2's primary). At 50 per cell, the primary Paper 2 power below (§6) falls further, and H2's planned 70/130 falls to about 60/90. Neither paper can afford it.
- **What replaces it.** The base-rate check (`16` §t.5): a small group of officers, not among the 200, runs the same build with no directive at the hinge. Its uses, in order: (1) **validating the keys** — a view whose keyed sound posture almost nobody chooses without the directive goes back to the panel; (2) **reading the ceiling** — if officers without the directive already choose a defensive posture in V11–V14 at 85–90 %, compliance there says little; (3) a descriptive comparison for H11 and H12. It is not a third arm, it is not randomised against the study cells, and no confirmatory test rests on it.
- **The cost of this decision, stated.** Without the arm, "blind compliance" (B at V9–V10) cannot be attributed to the directive rather than to officers' ordinary choice. Paper 2 therefore says "the posture stayed defensive where the keyed sound posture was a direct attack", and attributes it to the directive only as far as the base-rate group allows.

If the researcher reverses this decision, the no-directive arm must take its participants from Haku (so the two Thinker cells keep 65 each) and H2 must be re-powered first (`09` amendment of 2 Oct).

---

## 3. The manipulation and its fidelity

### 3.1 The directive (identical in every cell)

The P2 directive of `18` revision (t) §t.1, delivered once at the hinge (16:40), word for word the same in every cell, shown on the hinge screen and opening V8's message log. It is a duty-officer message, not a corpus atom. **Decision U5: it stays out of the corpus in phase B** (supersedes the open item "The directive is not searchable" in `11` §7.16 as far as phase B is concerned):
- If it were a record, Thinker in `reasoning_once` would retrieve it for some questions and might then assess fit on its own. Part of the control cell would receive the treatment, unmeasured.
- Kept out, every cell reaches the directive the same way (the message log), and the only route by which the AI relates answers to it is the `reasoning_intent` prompt.

### 3.2 The strategy-guided Thinker (cell `reasoning_intent`, V8–V14 only)

**What is the same as cell 2.** The time gate, the index, hybrid retrieval, the routine-line collapse, top-k, the ranking and its tie-break, the records passed to the model (with neutral tags), the four answer fields and their instructions, the model, the effort, the maximum length, the timeout, the latency floor and the fallback rule (`14` revision (q) and its amendments). In V1–V7 the cell-3 participant's request is served by the cell-2 prompt.

**What differs.** From V8, for this cell only, the **server** (never the browser) builds the system prompt from the cell-2 prompt plus a strategy block, and the output schema gains a fifth field. **As built:** the browser sends the question, the view, the virtual time, the language, the session id and the cell (`ThinkerRequest.cell`, required, one of the two Thinker cells), and, for a table-assigned session, the participant code. The server picks the variant from the cell and the view (`thinkerPromptVariant`: `intent` only for `reasoning_intent` from V8), appends the directive from the scenario (never from the client), and, when a code is present, refuses a cell that is not the code's row in the allocation table. A request without a code (demonstration, pilot) is served by the cell it names; the stronger rule "the server reads the cell from the session's allocation, never from the request body" holds only for table sessions (§11, M2). The server logs `promptHash` (the prompt file's hash) and **`systemPromptHash`**, the SHA-256 of the system text actually sent, because the file's hash does not cover the directive appended at run time.

**Prompt design principles.** These bind the prompt text that `server/thinker/` writes (fi and en). The text itself is versioned and hashed in `content/thinker/manifest.json` like the others.

| # | Principle | Why |
|---|---|---|
| P1 | The strategy block gives the directive **verbatim** (`hinge.intentStatement`; English from the labels), under the heading "Voimassa oleva linjaus (P2 klo 16.40)" / "Strategy in force (P2 at 16.40)". Nothing else about it: not that it was changed at the hinge, not the phase-A intent, not why it was issued beyond its own words | The model must know what the participant was told, and nothing the participant was not |
| P2 | The four existing fields are produced under **unchanged** instructions. The prompt says the directive may be used **only** in the fifth field; the answer and its basis come from the records alone. **Built (5 Oct 2026)** as rule 5 of `prompt.intent.*.md`: *"Täytä nämä neljä osaa täsmälleen niin kuin täyttäisit ne ilman linjausta. Älä mainitse niissä linjausta äläkä arvioi niissä tilannetta linjausta vasten. Voimassa olevaa linjausta saat käyttää vain viidennessä osassa."* / *"Fill in these four parts exactly as you would fill them in without the directive. Do not mention the directive in them and do not assess the situation against the directive in them. You may use the directive in force only in the fifth part."* Rules 1–4 are the standard prompt's word for word (tested) | Otherwise the treatment is two treatments (a fit verdict *and* directive-framed answers), and the T cell's four fields stop being a valid control. Leakage is coded (§3.3) |
| P3 | `linjaus` = `{ tila, perustelu }`, `tila` ∈ `sopii` · `ei_sovi` · `ei_liity`. The three statuses are defined **symmetrically**, with equal length and no example: *sopii* — the newest records describe a situation that the strategy, as stated, fits; *ei_sovi* — they describe a situation that the strategy, as stated, does not fit; *ei_liity* — the records do not bear on the strategy's posture or aims. **Built (5 Oct 2026):** *"sopii": tietueiden kuvaama tilanne sopii linjaukseen sellaisena kuin se on kirjoitettu. "ei_sovi": tietueiden kuvaama tilanne ei sovi linjaukseen sellaisena kuin se on kirjoitettu. "ei_liity": tietueiden kuvaama asia ei koske linjauksen toimintatapaa eikä sen tavoitteita.* (the first build's "ei_sovi if *something* in the records does not fit" and "ei_liity if the *question* does not bear" were asymmetric and were replaced); a test checks that the two definitions differ only by the negation | An asymmetric definition (e.g. a warning that the strategy may not fit, or an example of a misfit) would build the expected answer into the prompt. That is special-casing a designed event, which the retrieval rules already forbid (`14` amendment of 1 Oct) |
| P4 | `perustelu` is **one sentence** naming the recorded fact that decides the status, with its source and time (as BASIS does: "DR2 klo 17.25"). With `ei_liity`, it says what the records are about | The participant can check the claim against the record; the citation is coded for grounding |
| P5 | **No recommendation.** The prompt forbids naming, in any field, an action, a posture, a unit, a sector or a tasking as something to do, and forbids imperative or deontic wording ("pitäisi", "kannattaa", "suositellaan", "should"). The status describes the situation's relation to the strategy, never what the commander should do about it. **As built (5 Oct 2026), rule 7 applies to the `linjaus` field only**, with the deontic words named. Extending it to the four fields would give them an instruction the `reasoning_once` prompt does not have, which P2 forbids; the standard prompt itself has no such rule. Recommendations in the four fields are therefore coded in the audit **in both cells alike** (§3.3). **Researcher decision:** keep this reading, or add the same no-recommendation rule to the standard prompt (a change to Paper 1's frozen prompt, `14` revision (q)) (§11, M3) | See below |
| P6 | **Nothing about the design.** The prompt does not mention views, keys, fit being designed, deviation being allowed or expected, the rekindle, the omission, the contradiction or the planted record | The model's verdict must be its own reading of the records (`14` revision (q): "none is special-cased") |
| P7 | **Newest records first**, as rule 2 of the cell-2 prompt: the status is assessed on the latest record per source among those retrieved (built in rule 6) | The verdict must be about the situation now, not about the lull at 16:40 |
| P8 | **Uncertainty goes in the sentence, not in a fourth status.** If the records are mixed, the model picks the status the newest deciding record supports and says what is uncertain (built in rule 6, worded without the words for conflict that the prompt tests forbid) | A fourth "unclear" status would absorb most answers and empty the measure |
| P9 | **Fallback is deterministic:** with no model answer, `tila` = `ei_arvioitu`, sentence "Linjausta ei arvioitu" / "Not assessed". It is logged with the fallback flag | The template has no judgement; it must not invent one |
| P10 | The answer **schema** carries `linjaus` only for this cell from V8; the other cell's schema is unchanged. The full answer and `linjaus.tila` as its own field are logged (`07` revision (u)) | Exposure is coded from the field, not parsed from text |

**The no-recommendation rule, and why it matters for the measure.** The posture field is the participant's own decision (`16` revision (t)). If the AI said "a direct attack on L3 is advisable", the posture would measure **advice-taking** (automation bias in tasking), the cells B and C would code whether the participant followed the AI, and the contrast with Haku would differ in what participants are told to do, not in how the situation reaches them (`12` §6.3). With P5, the AI evaluates the **directive's premise against the records** — still an integration act — and the participant must still choose a posture and, for C, the sector. Stated honestly: `ei_sovi` moves the machine one step toward the decision boundary, because it tells the commander that the order in force does not suit the situation. That is the feature under study; the claim in §1.2 is scoped to it.

**On screen.** A separate, visually distinct last line of the answer, labelled "Linjaus" / "Directive", status first, then the sentence (brief D2). The line is the same size and weight for every status (no colour that ranks the statuses). Built (`RightPanel.tsx` `DirectiveLine`): one accent colour for every status; the fallback's "—" sentence is not shown.

**The first appearance (DEFAULT, researcher to confirm; built 5 Oct 2026).** The `linjaus` line is new at V8 and unexplained. The hinge screen therefore ends, after the hinge check (§4.1), with one sentence that differs by cell and has the same length in both Thinker cells (`ui.ts` `hingeCellNote`; a test holds the two within two characters):
- `reasoning_intent` (`linjaus_line`, 162 characters): *"Thinkerin vastauksissa on tästä eteenpäin rivi Linjaus: koneen arvio siitä, sopiiko tietueiden kuvaama tilanne voimassa olevaan linjaukseen. Arvio voi olla väärä."* — EN (176): "From now on, Thinker's answers have a line Directive: the machine's assessment of whether the situation in the records fits the directive in force. The assessment can be wrong."
- `reasoning_once` (`unchanged`, 163): *"Thinkerin vastauksissa on tästä eteenpäin samat neljä osaa kuin tähän asti: vastaus, perusteet, varmuus ja tieto, joka muuttaisi vastausta. Vastaus voi olla väärä."* — EN (176): "From now on, Thinker's answers have the same four parts as they have had so far: the answer, its basis, its certainty and what new information would change it. It can be wrong." This replaces 1.0's draft *"Thinker vastaa tästä eteenpäin samalla tavalla kuin tähän asti."*, which was less than half the length; the cells now differ in content only, and both carry a caveat.
- Haku: no sentence.

It appears with the directive (shown again) once the check is answered, and is logged once as `hinge_cell_note_shown {noteId}` (after `hinge_check_answered`, before `hinge_pause_end`).

The caveat ("can be wrong") matches the briefing's caveat on the projection; without it the line reads as an authority. DRAFT wording for the native reviewer.

### 3.3 Fidelity: the prompt audit (before pilot 2)

The verdict's behaviour is part of the treatment, so it is measured before data collection and reported, not tuned.

- **Question bank.** For each phase-B view, the authored questions of `content/thinker/authored-queries.json` that bear on the situation, plus 10 neutral questions per view written **without** reference to the keys (fire, crews, water, roads, settlements), at the view's start and at its step boundary for merged views. Each question is run 5 times through the live proxy in both Thinker cells.
- **What is measured.** Per view: the distribution of `tila`; its concordance with the view's fit (§3.5); the share of `linjaus` sentences that cite a record in the retrieved set (grounding); the share of answers in which any field violates P5 (recommendation); the share of `reasoning_intent` answers whose four fields mention the directive (leakage, P2); answer length and latency in both cells.
- **Decision rules, fixed now.**
  - The prompt may be revised **once**, and only for **generic** failures: P5 violations above 5 % of answers, leakage above 5 %, ungrounded citations above 10 %, schema failures. Each revision is a dated amendment with the audit table before and after.
  - The prompt is **never** revised because the status disagrees with the keys. A model that says `sopii` at V10 in most answers is the treatment as it is; the audit table is reported in Paper 2 and the result is read with it.
  - If the length or latency difference between the cells exceeds 30 % (median), the 180 s cap's effect on the `reasoning_intent` cell is reported as a side effect, and a sensitivity analysis uses views not ended by the cap.

### 3.4 Exposure from the log

Coded per participant and per phase-B view, for both Thinker cells (the status fields exist only in `reasoning_intent`; the retrieval fields in both):

| Measure | Definition |
|---|---|
| Answers | Number of `ai_chat_answer_received` in the view |
| Notices by status | Count of `linjaus.tila` ∈ {`sopii`, `ei_sovi`, `ei_liity`, `ei_arvioitu`} |
| **Exposed before the plan** | At least one notice with `tila` `sopii` or `ei_sovi` whose `seq` precedes the coded plan's `seq` (the plan in force at view end, `16` §t.2). The primary exposure indicator |
| Status before the plan | The status of the last such notice (`sopii`, `ei_sovi`, mixed, none) |
| Informed answer | An answer whose retrieved set contains at least one of the view's basis records (`demo-directive.ts` `basisAtomIds`, by content). Defined in both Thinker cells, so deciding-fact exposure can be compared across them |
| Deciding record opened | A Haku result expanded (`result_item_expanded`) whose atom is one of the view's basis records. Defined in all cells |
| Notice-triggered revision | An `allocation_revised` within the view after an `ei_sovi` or `sopii` notice, with its posture before and after |
| Before the boundary | In merged views, whether the notice preceded `step_boundary_reached` |

**Built (`app/telemetry/derived-measures.ts`):** `strategyNoticeExposure` (notices by status per view) and, 5 Oct 2026, `strategyExposureBeforePlan` (per keyed view with a coded plan: exposed before the plan, the last status before it, whether both statuses were received, the count). **Not yet built:** informed answer, deciding record opened, notice-triggered revision, before the boundary (§11, M5).

### 3.5 Whether the AI's `linjaus` is right

**The fit of a view is derived from the panel's keys, not from the researcher's fit column.** Once the panel has keyed a view (`16` §t.3):
- **fit = yes** if every sound posture is aligned (sound ⊆ {`barrier_line`, `protect_values`});
- **fit = no** if no sound posture is aligned (sound ∩ aligned = ∅);
- **fit = mixed** otherwise; a mixed view's notices are reported, not coded.
Until the panel has keyed, the draft fit column (`demo-directive.ts`) is used for the audit only.

Each notice in a keyed view is then coded:

| View fit | `sopii` | `ei_sovi` | `ei_liity` | `ei_arvioitu` |
|---|---|---|---|---|
| yes (V11–V14 draft) | **right** | **wrong** (deviation-inviting) | abstain; **miss** if the answer was informed | not assessed |
| no (V9, V10 draft) | **wrong** (compliance-inviting) | **right** | abstain; **miss** if the answer was informed | not assessed |
| neutral (V8) | not coded | not coded | not coded | not coded |

- **An AI that says `sopii` at V10 is wrong.** That is a measured property of the treatment: how often, under which questions, and with what effect on the posture (H17). It is not a bug, and it is not fixed during the study (§3.3).
- **Grounding** is coded separately: the sentence's cited source and time must match a retrieved record. An ungrounded `ei_sovi` that happens to be right is reported as right and ungrounded.
- **Reported per view:** the share of right, wrong and abstaining notices, per participant and per notice, and the share of participants whose last pre-plan notice was wrong.

---

## 4. The hinge check, and SPAM's role

### 4.1 The hinge check (brief D3)

**Form.** One forced-choice item on the hinge screen, after the directive has been shown and before V8: *"Mikä on nyt voimassa oleva toimintalinja?"* ("What is the line of action now in force?"), four parallel options, one correct. The distractors cross the directive's two parts as V8's SPAM item did (`26` §t.2): a direct attack with the right aim; the right line with another aim; phase A's intent. All cells answer it.
- **The directive is hidden while the item is answered** and shown again afterwards, without marking the answer right or wrong. Answered with the text on screen, the item would measure reading, not reception. Shown again afterwards, every participant leaves the hinge with the directive in front of them, so a wrong answer does not leave a participant uninformed for the rest of phase B.
- **Logged:** the option chosen, correctness, latency, and the dwell before it.
- **As built (5 Oct 2026):** the hinge screen shows the directive (labelled as from P2) and a button "Olen lukenut linjauksen" / "I have read the directive" (`hinge_check_presented`: the latency's zero and the end of the reading dwell); the item replaces the directive, Continue disabled until one option is chosen (`hinge_check_answered {itemId, optionId}`, one answer only); then the directive is shown again, unmarked, followed by the cell's sentence (§3.2); then Continue (`hinge_pause_end {realDurationMs, dismissedEarly}`). The key is an invariant of the scenario, never in the item (I4). The options are the former V8 SPAM directive item's: *Linjat teiden ja vesistöjen varaan; suojataan Lahdenkylä ja Mökkiranta* (key), and the crossed distractors (direct attack + right aim; right line + "johtopaikka ja vesipisteet"; direct attack + phase A's "kärjen pysäyttäminen koillisessa"), in a seeded order. `hingeCheckMeasure` (`spam-measures.ts`) gives reading time, answer latency, option and correctness. The post-session repeat and the perception item are not built (no post-session questionnaire in the app; §11, M6).

**What it measures.** Whether the participant has taken in the line of action in force when phase B starts. It is the precondition for coding compliance and deviation: a participant who does not know the directive cannot deviate from it.

**What it does not measure.** It is answered before the two Thinker cells differ, so it is **not** a check of the AI manipulation. The manipulation's delivery is checked by exposure from the log (§3.4) and by the audit (§3.3). Being pre-treatment, the check cannot be affected by the cell, so it can be used without bias:
- as a covariate in a sensitivity analysis;
- for a per-protocol sensitivity analysis that excludes participants who failed it. **It is not an exclusion criterion for the primary analysis** (intention to treat).

**Retention (exploratory).** The post-session questionnaire repeats the item (options reordered). The difference between hinge and end measures retention of the directive over phase B; `reasoning_intent` keeps it in every answer, so retention may be higher there (exploratory, two-sided). A second post-session item asks the Thinker cells whether Thinker's answers related to the directive (yes / no / don't know): the participant's perception of the manipulation, reported, not tested.

### 4.2 Why SPAM is not the manipulation check

`26` revision (t) made V8's SPAM item (verbatim recall of the directive) the default manipulation check. **This is superseded.** Under the SPAM redesign (brief D4) a SPAM item is answered with the display visible and the directive stays in the message log, so the item would measure how fast the participant finds it on screen, not whether they took it in. It also comes after the cells start to differ. The hinge check replaces it, and V8's SPAM item should no longer ask the directive (the SPAM work package chooses its replacement).

### 4.3 SPAM's role in phase B

Under D4 (items answerable from the map, the message log and the status strip; Haku and Thinker disabled during the item; ready latency, answer latency and accuracy measured), SPAM measures in phase B:
- **workload**, by the ready-prompt latency. For Paper 2 this is a **fidelity side-effect check**: if `reasoning_intent` has longer ready latencies than `reasoning_once`, the fifth field costs attention; it is reported and entered as a covariate in a sensitivity analysis;
- **momentary awareness** of state that matters for applying the directive, by answer latency and accuracy. It is a process covariate, not an outcome: Paper 2 has no SPAM hypothesis.

**SPAM as delivered (agent C, 4 Oct 2026; `app/session/spam-delivery.ts`, `SpamCard.tsx`, `spam-measures.ts`, `demo-probes.ts`).** *Revised 9 Oct 2026 (ag): the ready prompt no longer expires and is forced before the view ends; it can be collapsed; the answer window is 60 s; Haku and the Thinker are no longer locked. The timings and the lock below are superseded; see the revision at the end.* Four items, at V3, V6, V8 and V11 (none in a freeze view). The ready prompt appears **25 s** into the view; the participant has **15 s** to press ready (else `readyTimedOut`); the item then has **20 s** for an answer (four options), then confidence on the 25/50/75/100 scale. **Haku and Thinker are locked from the item's display until the probe closes**; the map and the message log stay usable (the ready prompt itself does not lock them). Logged: `spam_prompt_shown {cycle, atViewSeconds}`, `spam_ready`, `spam_answered` (response may be null), `recall_confidence_submitted`, `spam_closed`; derived: ready latency, answer latency, correctness, confidence, and whether a Thinker answer was pending at the prompt. Each key rests on a **pushed** record in the message log by the item's moment (`SPAM_KEY_ATOMS`, tested):
- **V3** (14:20): the burnt area by the latest perimeter survey — DR3's pushed 14:35-labelled survey "palanut ala noin 17,8 ha"; a stale lure is DR3's earlier 12,9 ha;
- **V6** (15:40): EK11's line at Koivuoja — "Kipinät lensivät Koivuojan yli … EK11 yritti pitää linjan, mutta palo pääsi yli"; lures: holding, withdrawn to the road;
- **V8** (16:40): what is known of the Mökkiranta cabins (the directive's first aim) — occupancy unknown, police asked to check (EK11 step 9; EK14 repeats at steps 10–11); crossed known/unknown × checked/requested. **This replaces V8's directive-recall item** (§4.2, §9 row 7);
- **V11** (17:40): what the region asks of KY21 — EK11's pushed step-14 line "Alue pyytää KY21:tä toiselle palolle". This replaces the DR3 item, whose key was recorded only.

**Constraints on phase-B SPAM items** (for the SPAM work package; met by the four items above):
- An item must not name or cue a deciding fact of a keyed view before that view's plan is final (as the V11 forecast item was withdrawn for, `26` §t.2).
- An item must be answerable from the screen without the tools (D4). V11's former item (DR3's next task) rested on DR3's step-14 log, which is **recorded only** (`site-scenario.json`, 17:59, T2); it was replaced (above). **Consequence for the rebuild:** V11's item now rests on EK11's pushed step-14 first sentence, so §7.3 b must keep that sentence (the pending patch does) and drop only the thermal-check sentence.
- Under D4 the "in-head vs with-tools" contrast of `15` §5 lapses: with the tools disabled, a group difference in SPAM accuracy is a difference in what is on screen and how it is read, which the groups share.

---

## 5. Measures and the primary analysis

### 5.1 Per-view coding

Unchanged from `16` revision (t) §t.2: each phase-B view's posture (`direct_attack`, `barrier_line`, `protect_values`) and main effort are coded **A** (aligned, sound), **B** (aligned, unsound: blind compliance), **C** (against, sound: justified deviation) or **D** (against, unsound), from `directiveAdherence`. C in V9–V10 requires `direct_attack` with the main effort on the new front's sector (L3, computed from the data). The plan in force at view end is coded; the first submission and `afterBoundary` are reported alongside. Confirmatory analysis uses panel-confirmed keys only.

### 5.2 The primary outcome and model

**Outcome:** C (1) vs B or D (0), in each keyed no-fit view (currently V9 and V10; any no-fit view added under §7.4 and keyed by the panel joins).

**Why this outcome.** The two rival accounts of the feature predict **opposite signs here**:
- *application aid:* the AI's `ei_sovi` helps the commander see that the order does not suit the situation → C rises;
- *compliance amplifier:* the directive, present in every answer, makes it more salient and more binding → B rises, C falls.
In the fit views both accounts predict more compliance, so the fit views cannot separate them; they are secondary (H14, H15). One outcome whose sign discriminates between the two accounts is the cleanest primary.

**Model.** Logistic mixed model: C ~ cell + view + phase-A share + (1 | participant), on `reasoning_intent` and `reasoning_once` participants, intention to treat. The cell coefficient is tested two-sided at α = .05. The phase-A share is each participant's share of `direct_attack` over V1–V7, centred. A view ended by the cap before a plan, or without a plan, is missing, not imputed (`15` r.10).

### 5.3 Secondary outcomes

- **Compliance where the directive fits (H14):** A (1) vs D (0) in V11–V14, same model.
- **Discrimination (H15):** aligned (1) vs against (0) over all keyed views, aligned ~ cell × fit + view + phase-A share + (1 | participant); the test is the cell × fit interaction. Read together with H13: an aid predicts H13 > 0 and H15 > 0; an amplifier predicts H13 < 0 with H15 near zero, because it shifts alignment up in both kinds of view (the simulation in §6 shows this).
- **Against Haku (H16a, H16b):** H13's model, each Thinker cell against Haku.
- **Graded commitment (descriptive):** in the no-fit views, the number of crews allocated to the new front's sector in the plan in force at view end. It carries more information per view than the binary posture and is reported per cell, without a test.

### 5.4 The `linjaus` status as mediator and moderator

- **Not a randomised variable.** Which status a participant receives depends on the questions they ask, and asking may itself change after V8. Analyses that condition on the status are **exploratory** (as `01` revision (q) for H9 and H10).
- **As moderator (H17):** within `reasoning_intent`, C in the no-fit views and A in the fit views by the status before the plan (`ei_sovi`, `sopii`, none); and, in the no-fit views, the share of B after a wrong `sopii` against after no notice.
- **As mediator (exploratory):** the share of the H13 effect carried by "exposed before the plan with a right status", estimated with the cell's randomisation as the instrument for exposure (complier average causal effect, with exposure defined in both cells as an informed answer before the plan). It is reported with its assumptions (exclusion: the fifth field acts only when seen).
- **Symmetric comparison:** among participants with an informed answer before the plan in both Thinker cells (the deciding facts reached them either way), C by cell. Still post-randomisation, so exploratory, but it separates "the AI's verdict" from "the AI's retrieval".

### 5.5 Phase-A posture as baseline

- The phase-A share of `direct_attack` (V1–V7) enters every Paper 2 model as a covariate (`09` revision (t)).
- V7's against V8's posture (the change at the hinge) is reported per cell. V8 is identical up to its first Thinker answer, so a V8 difference between the Thinker cells is an early sign of the feature.

### 5.6 Process measures

Reported per cell and per phase-B view: Thinker queries (count, and share with a question about the new front's area in V9–V10); Haku queries; deciding records opened (§3.4); time from view start to the coded plan; plan revisions and notice-triggered revisions; views ended by the cap. These describe how the outcome came about; none is a hypothesis.

### 5.7 Hypotheses (pre-registration-ready)

Numbered after `01`'s H1–H12; H8 stays withdrawn and is not reused.

- **H13 (Paper 2 primary). Justified deviation.** In the keyed no-fit views, the share of postures coded C (a direct attack with the main effort on the new front's sector) differs between the strategy-guided Thinker cell (`reasoning_intent`) and the Thinker cell (`reasoning_once`). Logistic mixed model, cell + view + phase-A share, participant random intercept, intention to treat, two-sided, α = .05. *Reading stated in advance:* higher in `reasoning_intent` supports the application-aid account; lower supports the compliance-amplifier account (more B, blind compliance).
- **H14 (secondary). Compliance where the directive fits.** In the keyed fit views (V11–V14), the share coded A differs between the same two cells. Same model, two-sided.
- **H15 (secondary). Discrimination.** The difference in alignment between fit and no-fit views differs between the same two cells (cell × fit interaction on aligned postures over all keyed views). Two-sided.
- **H16 (secondary). Against Haku.** (a) `reasoning_intent` vs Haku and (b) `reasoning_once` vs Haku differ in the share coded C in the keyed no-fit views. Two-sided each.
- **H17 (exploratory). The verdict carries over.** Within `reasoning_intent`, in a keyed view, the posture is more often on the side the last pre-plan `linjaus` status implies (aligned after `sopii`, against after `ei_sovi`) than after no notice, whether the status is right or wrong. Observational; reported with exposure counts.

**Multiplicity.** H13 is Paper 2's only primary. H14, H15, H16a and H16b form one family, Holm at α = .05. H17 and everything in §5.4 are exploratory.

### 5.8 H11 and H12, restated

`01` revision (t)'s H11 (compliance in V11–V14) and H12 (justified deviation in V9–V10) are **levels**, read against the base rate. They stay as **descriptive** results, reported per view and per cell, with the base-rate group beside them. Their "Group (exploratory)" clause is replaced by H13–H16.

### 5.9 Analysis set and missing data

- **Intention to treat:** every participant randomised to a Thinker cell who reached V9 with a plan. Missing views are missing (no imputation); the mixed model uses the views present.
- **Sensitivity:** per-protocol (hinge check correct); views not ended by the cap; plans given after the boundary in merged views; exposure-conditioned (exploratory).
- **Session language** enters as a covariate (`09` revision (r)).

---

## 6. Power

### 6.1 Method

`tools/power/paper2-power.ts`, run with `npx tsx tools/power/paper2-power.ts [--reps 1000] [--seed 20261004]`. Deterministic: a seeded xoshiro128** stream per grid cell, no unseeded randomness, no clock (the style of `h2-power.ts`). 1000 replicates per cell, α = .05, two-sided.

**Data-generating process (assumptions, not pilot values):**

| Quantity | Value | Basis |
|---|---|---|
| Participant propensity to attack the edge | N(0, 1.0²) on the logit scale | Moderate between-person consistency (latent ICC ≈ .23) |
| Phase A | 7 views, P(direct attack) = logistic(0.4 + 0.8·u) | Offensive intent: direct attack common (~58 %); the share is the covariate |
| No-fit base rate in the Thinker cell | V9 .25; V10 .50 | V9: the front is not on the map and no crew is there; V10: crews already move to it on the radio (§7.2) |
| A direct attack is on the new front's sector | .85 | The rest is D |
| Fit views | P(aligned) = .88 at u = 0 | The ceiling risk (crews already keep a safe distance) |
| Exposure in `reasoning_intent` | pExp per view (scenario) | At least one `sopii`/`ei_sovi` notice before the plan |
| Verdict right | pCorrect (scenario) | §3.5 |
| Effect of a right / wrong notice | ±δ on the logit, toward the sound / unsound side | Per exposed view |
| Compliance push | γ toward aligned in every phase-B view of `reasoning_intent` | The amplifier account |
| Haku | Same as `reasoning_once` on this measure | No evidence either way; H16 power is then H13's with 70 controls |
| Added late no-fit views (§7.4) | Two, base rate .30 each | Harder than V10 (no crews already engaged) |

**Estimators:** GLM-C, a participant-clustered logistic model on the no-fit views (C ~ cell + view + phase-A share, sandwich SE; a population-averaged stand-in for the mixed model, as in `h2-power.ts`); Share-C, a Welch t on each participant's share of C; GLM-int, the cluster-robust cell × fit interaction on aligned postures over all keyed views (H15).

### 6.2 Results

Run of 4 Oct 2026, 1000 replicates per cell, seed 20261004. The first table gives each scenario's population effect (20 000 per cell, the two current no-fit views); the second gives power. "Exp" is the share of no-fit views in which a `reasoning_intent` participant was exposed before the plan; "correct" is the verdict's accuracy; δ the per-exposure shift. The full grid (including H 70 / S 65 for H16) is printed by the tool.

| Scenario | C in V9–V10, T → S | A in V11–V14, T → S |
|---|---|---|
| null | 33 % → 33 % | 84 % → 84 % |
| aid-weak (exp .5, correct .7, δ 1.0) | 33 % → 37 % | 85 % → 85 % |
| aid-moderate (exp .6, correct .8, δ 1.5) | 33 % → 43 % | 85 % → 88 % |
| aid-mid (exp .7, correct .85, δ 1.75) | 33 % → 49 % | 84 % → 90 % |
| aid-strong (exp .8, correct .9, δ 2.0) | 33 % → 55 % | 85 % → 92 % |
| exp-low (exp .3, correct .8, δ 1.5) | 33 % → 38 % | 84 % → 86 % |
| exp-high (exp .9, correct .8, δ 1.5) | 34 % → 49 % | 84 % → 90 % |
| amplifier (γ 0.7, no aid) | 33 % → 23 % | 84 % → 91 % |
| wrong-AI (exp .6, correct .3, δ 1.5) | 34 % → 29 % | 84 % → 76 % |

Power (H13 = GLM-C; H15 = GLM-int), `reasoning_once` vs `reasoning_intent`:

| Scenario | 65 / 65, 2 no-fit views: H13 · H15 | 65 / 65, 4 no-fit views: H13 · H15 | 46 / 46, 2 views: H13 · H15 | 46 / 46, 4 views: H13 · H15 |
|---|---|---|---|---|
| null (type I) | 4 % · 5 % | 6 % · 6 % | 4 % · 5 % | 5 % · 6 % |
| aid-weak | 10 % · 13 % | 15 % · 16 % | 10 % · 10 % | 12 % · 10 % |
| aid-moderate | 39 % · 68 % | 65 % · 79 % | 29 % · 51 % | 50 % · 65 % |
| aid-mid | 70 % · 96 % | 94 % · 99 % | 56 % · 84 % | 84 % · 93 % |
| aid-strong | 95 % · 100 % | 100 % · 100 % | 85 % · 99 % | 99 % · 100 % |
| exp-low | 14 % · 24 % | 19 % · 30 % | 11 % · 18 % | 19 % · 22 % |
| exp-high | 70 % · 93 % | 95 % · 99 % | 53 % · 82 % | 82 % · 92 % |
| amplifier | 50 % · 6 % | 72 % · 4 % | 36 % · 6 % | 57 % · 5 % |
| wrong-AI | 12 % · 61 % | 13 % · 73 % | 8 % · 48 % | 13 % · 58 % |

Share-C (Welch on per-participant shares) runs 2–9 points below GLM-C throughout. H16 (each Thinker cell vs Haku, 65 / 70) has about H13's power (e.g. aid-moderate 38 %, aid-mid 73 %, amplifier 47 % with two views). No fit failed in any cell.

### 6.3 Reading

- **Type I error holds** (4–6 %), so the cluster-robust stand-in is usable for planning.
- **As the design stands (two no-fit views, 65 / 65), H13 is powered only for a large effect.** 80 % power needs the share of C to move by roughly 15–20 points (aid-mid +15 points: 70 %; aid-strong +22: 95 %). A moderate effect of about 10 points in either direction — an aid (+11) or an amplifier (−10) — is detected with 39–50 % probability. After 30 % attrition (46 / 46) every figure falls by 10–15 points.
- **Exposure is the parameter that matters most.** With the same per-exposure effect, exposure .3 gives 14 %, .6 gives 39 %, .9 gives 70 %. The ITT effect is exposure × per-exposure effect, and exposure is unknown until pilot 2. This is the strongest argument for §7.1: deciding quantities that must be looked up make participants ask in the no-fit views.
- **Two more no-fit views** raise H13's power by about 25 points for moderate effects (aid-moderate 39 → 65 %; amplifier 50 → 72 %) and remove the order confound (§7.4). Two more views and exposure near .9 together give about 95 %.
- **The interaction (H15) is more powerful for an aid** (68 % vs 39 % at aid-moderate), because the fit views add information, **but it is blind to the amplifier** (4–6 %): a push toward compliance raises alignment in both kinds of view and leaves the interaction near zero. It also responds to a wrong AI (61 %), which H13 hardly sees (12 %), because a wrong verdict in the fit views lowers A. H13 stays primary because only its sign separates the two accounts the question names (§5.2); H15 is the more sensitive secondary for an aid, and H14 and H15 together catch a wrong AI.
- **What would fix it, in order of cost:** (1) raise exposure through the scenario (§7.1, recorded-only deciding quantities in V9–V10) — no change to the instrument; (2) add one or two late no-fit views (§7.4) — a scenario rebuild and panel keys; (3) a graded secondary measure (crews committed to the new front's sector, §5.3), which carries more information per view; it was not simulated, because its distribution has no basis yet. Moving participants from Haku to the Thinker cells would help Paper 2 a little and cost H2 (Paper 1's primary) more; it is not recommended. A one-sided test is not available, because both directions are hypotheses.
- **Honest summary for the pre-registration:** with the scenario as it is, a null on H13 would be uninformative about moderate effects. Pilot 2 must estimate exposure in V9–V10 (share of Thinker-cell participants with an informed answer before the plan) and the Thinker cell's base rate of C; the simulation is re-run with those values before the pre-registration is locked, as for H2 (`09` §8).

---

## 7. What the scenario must provide (inputs to the corpus and map rebuild)

Every statement below was checked on 4 Oct 2026 against `app/scenario/site-scenario.json` (traffic tiers, radio items and their `pushed` flag, unit positions per step, the reported and true perimeters) and `app/scenario/demo-story.ts`. Distances were computed from the perimeters and the R2 line (`tools/topo-map/roads.ts` `FIXED_ROADS[5]`) in local metres about the ignition point. The rebuild is done in its own branch (brief D5); nothing here changes a record.

### 7.1 The principle: existence pushed, deciding quantity recorded

Revision (t) showed that the directive's fit is visible from pushed messages in every view but V11 (`18` §t.4), so H11–H13 measure applying the directive to what the participant has been told. That is acceptable for H13 — the two Thinker cells receive identical pushed messages — but it costs the primary contrast power: a participant who has been told everything has little reason to ask, so few `linjaus` notices about the deciding facts arrive before the plan, and exposure is the parameter the power depends on most (§6.3).

**Rule for no-fit views (recommended):** the **existence** of the new situation is pushed (a crew or SPOT reports at once that there is fire where there was none — realism, and Paper 1's detection measures need it); the **deciding quantity** — size, rate, flame length, distance — is recorded only (drone measurements, sensor logs, crews' size-up lines). Applying the directive then needs the records, in every cell alike. In the autonomous-assets setting (`02` revision (o) §2), drone measurements going to the log rather than the radio is the ordinary route. **Domain reviewer to confirm** that a commander would not normally hear these quantities by radio within the 20 minutes.

Fit views keep their pushed facts: there the directive fits and the measure is compliance; a recorded-only fact matters only where the surface invites deviation (V11's forecast, which is already recorded only).

### 7.2 Per view

| View | Deciding facts now (tier, verified) | Recommended | Reason |
|---|---|---|---|
| V8 (step 11) | EK12 16:42 small flame on the head's south flank (pushed); DR3 16:46 north edge 1.8 m/min (recorded); VPK→EK14 echo (T4, recorded) | No change | Neutral view; H10's cue set must not change |
| V9 (step 12) | SPOT 17:01 "Avotulta ja savua … noin 200 m syttymäkohdasta" (story bubble, **pushed**, at view open). 17:00 forecast: wind turns W, then NW and strengthening, gusts over 10 m/s (**recorded only**). No crew on L3 (radio: EK11 → L2, KY23 → L1). **No V9 record gives the flare-up's size or rate** | Keep SPOT pushed (existence; the omission's detection). **Add one recorded-only record** in step 12 that gives the deciding quantity (e.g. SPOT or a drone at ~17:10: the flare-up's size, about a few tenths of a hectare, flame height and that it runs E), consistent with the CA's step-12 new front | Today a commander in V9 cannot learn from any record whether the flare-up is small enough to attack; the key rests on SPOT's wording only. A record makes the no-fit judgement answerable and gives the AI a fact to cite |
| V10 (step 13) | **Pushed:** DR2 17:25 thermal "erillinen palo … noin 1,1 ha, liekit 0,3–1 m"; EK16 17:28 "noin 1 m/min"; VPK 17:32 "noin 1 m/min"; KY21 17:30 "liekit alle 0,3 m, reuna ryömii hitaasti"; DR3 17:35 perimeter "Erillinen uusi palo, noin 1,1 ha"; EK11 17:22 "hehkuvaa kariketta ja pientä liekkiä". Radio (pushed, at view open): EK11 "siirtyy syttymäkohdan eteläreunalle (lohko L3) **(painopiste siirtyy etelään)**", EK16, KY21, VPK all to L3 | **Recorded only:** DR2 17:25, DR3 17:35, EK16 17:28, VPK 17:32 (the size and the rate). **Keep pushed:** EK11 17:22 (existence, no number), KY21 17:30 without its rate clause. **Reword** EK11's move reason: drop "painopiste siirtyy etelään" (the world must not state the participant's main effort); keep a reason that names the fire ("avotulta syttymäkohdan eteläpuolella"). **Decided (researcher, 5 Oct 2026):** the crews' return to L3 moves from step 13 to step 14 (§7.3 c) | Today every deciding quantity and the world's own main-effort choice reach the participant at view open; V10's C largely ratifies what the crews are already doing |
| V11 (14+15) | 18:00 forecast (recorded only), 17:00 forecast (recorded only); DR2 7.5 m/min (recorded; step 14 is a merged view's first step, so all its traffic is recorded); step 15: EK11 6, EK12 7, DR2 7.3, EK16 8, KY21 6, VPK 7 m/min (pushed). EK11 story step 14 (pushed): the residue (§7.3 b) | Keep. Fix the residue | V11 is the fit view whose fit rests on a record, as designed |
| V12 (16+17) | EK11 18:41 ~10 m/min (pushed); EK11 18:42 gusts 14 (pushed); EK12 radio: the forest road stopped the fire over ~250 m (pushed); DR1 18:25 5.0 m/min (recorded) | Keep | Fit view; realism (a fire stopped at a road is radioed at once) |
| V13 (18) | OUT2 radio: the head crossed the forest road (pushed); DR2 19:05 10.6 m/min (pushed); DR2 19:06 "tie R2, palo noin 560 m tiestä" (recorded) | Keep; see §7.3 d on what the R2 figures measure | Fit view; also H3's view — no change that touches the contradiction |
| V14 (19+20) | VPK 19:18 (step 18, pushed): two houses in Lahdenkylä refuse to leave; DR1 19:26 "tie R2, palo noin 530 m tiestä" (recorded); **EK14 story step 19 (pushed): "noin 200 m tiestä"** (§7.3 a) | Remove or reword EK14's line; R2's distance stays recorded only (DR1) | Conflict |

### 7.3 Conflicting and residual records

**(a) EK14's ~200 m to R2 (V14).** `demo-story.ts` step 19, pushed: *"Kaakkoisrintama lähestyy huoltotietä R2, noin 200 m tiestä. Vesikuljetusreitti voi katketa."* Verified against the data:
- the SE front's nearest point is **528 m** from R2 at 19:20 (true perimeter at the end of step 18), **500 m** at 19:40 (reported perimeter, start of step 20) and **374 m** at 20:00 (true perimeter); DR1's recorded 19:26 check says **~530 m**, which agrees;
- **EK14 is on the north edge** (L1, "pohjoisreuna, Karhujärven puoli"), about **1.3 km** from the SE front and **1.4 km** from R2 at steps 18–20 (unit positions in `site-scenario.json`), so it is not placed to see the front reach R2 at all.
**Input:** remove the line, or give it to a unit on the SE front (EK12, OUT1 or OUT2, all within ~15 m of the front at steps 18–20) with the CA's distance (≈ 500 m at 19:40). The `26` amendment of 2 Oct ("R2 approached (about 200 m at step 19)") is superseded by the CA values.

**(b) EK11's step-14 line (V11) still states the dropped thermal-check rule.** `demo-story.ts` step 14, pushed at V11's opening: *"Alue pyytää KY21:tä toiselle palolle. Ei vapauteta ennen lämpökamera­varmistusta."* The second sentence is hinge rule 3, withdrawn (`18` §t.2). For Paper 2 it is worse than a residue: in `reasoning_intent` the model may cite it as a rule in force and assess fit against it, and in every cell it reads as a second directive. **Input:** drop the second sentence. The first duplicates DR3's recorded 17:59 landing ("alue on pyytänyt DR3:n toiselle palolle") in a different unit. **Reconciled 5 Oct 2026:** keep EK11's first sentence — V11's SPAM item now rests on it (§4.3) — and drop only the second; the pending patch does exactly this. Note also two soft hyphens (U+00AD) in step 14's "lämpökamera­varmistusta" and step 15's "kastelu­ainetta": they break lexical matching in Haku and Thinker for those words; remove them.

**(c) V10: the world shows the deviation.** At V10's opening the radio moves EK11, EK16, KY21 and VPK to L3, with EK11's reason "painopiste siirtyy etelään" (the main effort moves south). The scripted crews thus make, in front of the participant, the choice the key calls justified deviation. Two inputs, in order of cost:
1. **Reword the reasons** (radio text only): no "painopiste"; the move names the fire, not a posture or a main effort.
2. **Decided (researcher, 5 Oct 2026):** the crews' return to L3 moves from step 13 to step 14, so that in V10, as in V9, no crew is on the new front and the posture is the participant's own reading. **At step 14 the crews take a defensive line, consistent with the directive.** Cost, carried by the corpus-rebuild branch (not this one): `26` §5's step-13 return and `deployment.ts` `UNIT_PLAN` change; the CA re-run if the new front depends on suppression at step 13, and the 14 flags re-checked; V10's freeze items that name crews on L3 re-checked. With the move, the step-13 radio that carries "painopiste siirtyy etelään" must change or go; the 4 Oct patch file still has it (§7.5).

**(d) What the drones' R2 distances measure.** DR1 18:46 (V12) and DR2 19:06 (V13) say "tie R2, palo noin 560 m tiestä". The drone road check measures the nearest point of the whole fire to the whole road (`traffic-drones.ts`). Until about 19:10 that nearest point is the old perimeter's north-east corner at R2's north end (527 m from R2, unchanged since step 11), **not the SE front**, which is 829 m from R2 at 18:40 and 673 m at 19:00 (reported perimeters). A commander reading "560 m" at 18:46 as the head's distance is misled. **Input:** the road check should report the distance from the active front named in the record (e.g. "kaakkoisrintama noin 800 m tiestä R2"), or name the part of the fire it measured. Domain reviewer to confirm the wording.

**(e) Crews on the SE front's edge in the fit views.** *Superseded 19 Oct 2026 (ay): in the current build no crew stands at the SE front's edge in V11–V14 (see the revision at the end).* At steps 18–20 EK12, OUT1 and OUT2 stand within ~10–15 m of the SE front with hose lines ("Linja pitää", "Pidämme linjan"), while the directive says no direct attack on the edge and the key codes `direct_attack` as D in V11–V14. Whether this is flank work from an anchor (compatible with the directive) or direct attack is the domain question already open (`11` §7.16.1). **Input:** if the domain reviewer reads it as direct attack, the scripted crews contradict the directive in every fit view and the rebuild should move them to work that reads as defensive (firebreaks, wetting ahead on R2, as OUT2's step-17 move already says: "palokatko Lahdenkylän suojaksi"). Either way, crew messages after the hinge must not use the words of a posture option.

### 7.3.1 Not changed by this document

The objection (V7), the echo (V8), the rekindle (V9), the contradiction (V13), the planted record F7 (V12), the 14 flags and the step → view map are Paper 1's designed events and stay as they are. Every input above must leave them unchanged; agent D's tests already assert most of them (`rekindle.spec`, `planted.spec`, `views.spec`).

### 7.4 More no-fit views

**Two reasons, not one.**
1. **Power** (§6): two no-fit views per participant are the binding limit on H13.
2. **The order confound.** Today both no-fit views come first (V9, V10) and all fit views after (V11–V14). Fit is then confounded with time since the hinge, with fatigue and with the fire's growth (`09` revision (t)). A no-fit view late in phase B decouples them and lets H15 separate "the directive fits" from "later in the evening".

**What a usable no-fit view needs** (constraints on the rebuild):
- the misfit must be at the **main-effort** level: the posture field asks the posture of the main effort, so a small spot fire that one crew should attack while the head is the main effort does not register;
- the keyed sound posture must be against the directive (a direct attack), on a sector the data can compute (as `newFrontSector`);
- the existence is pushed and the deciding quantity recorded only (§7.1);
- it must not change H3's contradiction (V13), H9's F7 item (V12), the flag sequence or the rekindle arc;
- the panel must key it without being told it was designed (`16` §t.3).

**Candidates, for the domain reviewer** (neither is in the data today):
- **(i) The evening lull at V14's second step (19:40–20:00).** The 18:00 forecast already says the wind eases to 5–6 m/s after 19:30 (recorded). If the CA's head rate at step 20 drops to the creeping range (it is 7 m/min now; `site-scenario.json` step 20 `headRos.actualMpm`) and the evening humidity rises, a direct attack on the slowed head before R2 is the classic sound choice, against the directive's letter but for its aim (Lahdenkylä). Cost: CA forcing at step 20, V14's flag (Q) re-checked, and V14 becomes a merged view whose fit changes at the boundary — its key must then be split by step (`afterBoundary`).
- **(ii) A second flare-up of the old edge, late.** A Kalajoki-type rekindle repeated at step 18–19 in a sector with no crew, small and slow, large enough to be the main threat to one settlement. It repeats V9's misfit type late, which is what the order confound needs. Cost: a new CA ignition, new atoms, and care that it does not cue or compete with V13's contradiction.

**Decided (researcher, 5 Oct 2026):** more no-fit views are added — **at least one late (V12–V14), possibly one more** — for power (§6.3) and to break the order confound. They are implemented on the corpus-rebuild branch; the domain reviewer checks realism and the panel keys them without being told they were designed. **Their keys, the updated fit table and the re-run power figures (§6.2's four-view columns are the planning values until then) arrive with that patch.** If the added view's fit is mixed under the panel's keys, it is reported, not coded (§3.5).

### 7.5 What the pending corpus patch does, and what it does not yet do (5 Oct 2026)

The corpus and map changes are **not on this branch**. They are in a separate patch (`phase-b-corpus-rebuild.patch`, commit of 4 Oct 2026 on the corpus-rebuild branch), which waits for the Thinker index to be rebuilt on the researcher's machine (`npm run thinker:index`; `npm run thinker:eval -- --write`): nine atoms' texts change, so five index-dependent tests fail until then. Nothing on this branch changes a record text, an atom id, a tier, `site-scenario.json` or `content/thinker/index.json`.

**In the 4 Oct patch file:**
- **V10 (step 13):** DR2's 17:25 thermal image and DR3's 17:35 mapping (~1,1 ha) become T2 sensor-feed records (recorded only, §7.1); the four crews on the new front (EK11, EK16, KY21, VPK) radio that it is a new small fire and that they are on it, with no rate (their "noin 1 m/min" and KY21's "ryömii hitaasti" go).
- **Step 13 story:** the R2 line is KY21's (on the new front, "runsaan kilometrin" from R2), not EK14's.
- **§7.3 b:** EK11's step-14 line keeps "Alue pyytää KY21:tä toiselle palolle." and drops the thermal-check sentence (V11's SPAM key is kept).
- **§7.3 a:** the step-19 line is EK12's on the SE front ("heading for R2"), with no distance; the distance stays in DR1's recorded road report (~530 m).
- Head-crossing radio names its step window; `demo-directive.ts` keys and basis records for V10, V13 and V14; English for every changed record.

**Decided 5 Oct 2026 and, per the coordinator, implemented on the corpus-rebuild branch, but not in the 4 Oct patch file this document was checked against** (to be verified when the patch is merged): the crews' return to L3 moved to step 14 with a defensive line there (§7.3 c); the added no-fit view(s), at least one late (§7.4), with their keys and power figures.

**Not yet in the 4 Oct patch file** (each is an open input; researcher or domain reviewer as in §9):
1. **A V9 recorded-only size record** (§7.2: e.g. SPOT or a drone at ~17:10 giving the flare-up's size, flame height and direction). V9 still has no record that gives the deciding quantity.
2. **Removing "painopiste siirtyy etelään"** from EK11's step-13 move reason (§7.3 c 1). Still in `site-scenario.json` (the world states the participant's main effort). The decided move of the return to step 14 must not carry it either.
3. **The soft hyphens** (U+00AD) in step 14's "lämpökamera­varmistusta" (dropped with the sentence) and step 15's "kastelu­ainetta" (still there; it breaks lexical matching for that word).
4. **The crews within ~10–15 m of the SE edge in V11–V14** (EK12, OUT1, OUT2 with hose lines, "Linja pitää") that read as a direct attack against the defensive directive (§7.3 e). Unchanged, pending the domain reviewer's reading.
5. **More misfit views** beyond what the branch adds (§7.4; the 4 Oct file has none; the 5 Oct decision adds at least one late view).
6. **The drones' R2 distances** (§7.3 d), which measure the old NE corner until about 19:10. Unchanged.

---

## 8. Threats to validity

| # | Threat | Effect | Mitigation |
|---|---|---|---|
| T1 | **Exposure dilution.** The feature acts only when a participant asks, in a no-fit view, a question whose answer bears on the posture, before the plan | ITT effect = exposure × per-exposure effect; low exposure gives a null that says little | §7.1 (recorded deciding quantities raise the need to ask); exposure reported per view; CACE (§5.4) |
| T2 | **The verdict's accuracy is part of the treatment** | A null may mean "a wrong AI", not "no effect of a right one" | Audit (§3.3) and per-view correctness (§3.5) reported with H13 |
| T3 | **Leakage into the four fields** (P2) | Two treatments at once; the control's four fields no longer comparable | Audit threshold; leakage coded in the study data |
| T4 | **Length and latency** of `reasoning_intent` answers | Less time inside the 180 s cap; more workload | Audit; SPAM ready latency; cap-ended views as a sensitivity analysis |
| T5 | **Order confound** (no-fit first, fit later) | H15 confounds fit with time | §7.4 |
| T6 | **The world contradicts or pre-empts the directive** (V10's crews; crews on the SE edge in V11–V14) | V10's C measures endorsement; D in fit views may follow the crews | §7.3 c, e |
| T7 | **Ceiling in the fit views** | H14 has little room | H14 is secondary; base-rate group reads the ceiling |
| T8 | **Draft keys** | A key the panel does not hold makes C and B meaningless | Panel-confirmed keys only; fit derived from them (§3.5) |
| T9 | **Posture labels echo the directive's words** (`11` §7.16.1 D3) | Pull toward the aligned options in every cell | Same in all cells; native and domain reviewers |
| T10 | **Demand.** The `linjaus` line tells the S cell that fit is being judged, which may legitimise deviation whatever the status | Part of the feature, not separable | Stated as part of the treatment; the hinge sentence keeps the T cell's screen of equal length |
| T11 | **Paper 1's phase-B tests span two treatments** | H3, H9, H10 (V8) biased if the cells differ | §1.4 rule |
| T12 | **Contamination between participants** | Later participants arrive knowing about the rekindle or the line | Post-session request; session date logged; drift check over recruitment time |
| T13 | **Allocation tampering** through the URL | Self-selection into cells | U4 (§2.2) |
| T14 | **Fallback imbalance.** API failures give `ei_arvioitu` | Exposure falls unevenly over time | Fallback rate reported per cell and per day; sensitivity without fallback answers |
| T15 | **Small n, one scenario, one directive** | Low power; narrow generalisation | §6; claims scoped (§1.3) |
| T16 | **Language.** The fi and en prompts are two prompts | Verdicts may differ by language | Language as a covariate; audit run in both |
| T17 | **Attrition** before V9 | Fewer analysable participants | Power reported at 46/46 |

---

## 9. Decisions

This table supersedes, for phase B, the matching rows of `11` §7.16 and §7.16.2 (b) and (c); `11` carries a dated note.

| # | Item | Default in this document | Who |
|---|---|---|---|
| 1 | Paper 2's primary outcome and contrast (H13) | C in the keyed no-fit views, `reasoning_intent` vs `reasoning_once` | **Researcher** |
| 2 | Randomised no-directive arm (`11` §7.16.2 b) | None; base-rate group outside the 200, descriptive, used first to validate keys | **Researcher** |
| 3 | Assignment in study mode | Pre-generated table bound to the participant code; URL parameter for demo and pilots only. **Built 5 Oct 2026** (§2.2); stratum sizes fi 240 / en 80 DRAFT | **Researcher** (confirm stratum sizes, M1) |
| 4 | The directive in the corpus (`11` §7.16 "not searchable") | Stays out of the corpus in phase B | **Researcher** |
| 5 | The hinge sentences explaining the line (§3.2) | Built 5 Oct 2026, equal length (162 / 163 fi, 176 / 176 en), both with a caveat | **Researcher**; native reviewer for wording |
| 6 | Manipulation check form (`11` §7.16.2 c) | Hinge forced-choice item, directive hidden while answering, shown again after; post-session repeat (retention) and perception item | **Researcher** |
| 7 | V8's SPAM item | **Done:** replaced by the Mökkiranta-cabins item (§4.3) | Researcher (confirm) |
| 8 | Paper 1 phase-B pooling rule (§1.4) | Cell nested; Thinker cell alone if the cells differ at α = .10 | **Researcher** |
| 9 | Prompt audit rules (§3.3) | One generic revision allowed; never toward the keys | **Researcher** |
| 10 | Existence pushed, quantity recorded (§7.1, §7.2: V9 add, V10 demote) | Recommended | **Domain reviewer** (realism), then researcher |
| 11 | V10's crews: reword reasons; or move the return to step 14 (§7.3 c) | **Decided 5 Oct 2026:** the return moves to step 14, where the crews take a defensive line; on the corpus-rebuild branch | Researcher (decided); domain reviewer |
| 12 | EK14's ~200 m line (§7.3 a) | Remove, or move to an SE-front unit with the CA's ≈ 500 m | Researcher (rebuild) |
| 13 | EK11's step-14 thermal-check sentence (§7.3 b) | Drop | Researcher (rebuild) |
| 14 | Drone road-check wording (§7.3 d) | Distance from the named front | **Domain reviewer** |
| 15 | Crews on the SE edge in V11–V14 (§7.3 e) | Flank work from an anchor = compatible, pending the domain question | **Domain reviewer** |
| 16 | A late no-fit view (§7.4) | **Decided 5 Oct 2026:** at least one late (V12–V14), possibly one more; on the corpus-rebuild branch; keys and power with that patch | Researcher (decided); domain reviewer; **expert panel** keys it |
| 17 | Fit derived from the panel's keys (§3.5) | sound ⊆ aligned → yes; disjoint → no; else mixed | **Expert panel** keys; rule fixed here |
| 18 | V9's sector (`11` §7.16.1 D14) and V10's key | Unchanged (L3) | **Expert panel**, domain reviewer |
| 19 | Base-rate group size and timing | Before the keys are frozen, so it can send keys back | **Researcher** |

---

## 10. Changes to other documents (revision (u))

Each file carries a dated revision (u) note that points here and says what it supersedes; no earlier text is rewritten.

| File | What changes |
|---|---|
| `00` | Index row for `27`; changelog |
| `01` | H13–H17 added; H11 and H12 descriptive; the "Group (exploratory)" clause superseded; Paper 1's phase-B tests nest the cell |
| `02` | Cell 3 is the strategy-guided Thinker (supersedes revision (t)'s "intent-line split still open" and "cells 2 and 3 are one group in every analysis" for phase B); assignment from a table; the directive stays out of the corpus |
| `07` | `ai_chat_answer_received` carries `linjaus` (`tila`, `perustelu`) in `reasoning_intent`; the header logs the real cell; the hinge check is logged |
| `08` | The hinge check is an instrument; SPAM is not the manipulation check |
| `09` | Paper 2's analysis plan and power (supersedes revision (t)'s "No Paper 2 power simulation has been run" and the exploratory group clause); debrief for the S cell |
| `11` | §7.16: dated note; rows superseded by §9 |
| `14` | The strategy-guided prompt variant: principles P1–P10, the fifth field, the fallback status, the audit |
| `15` | The hinge screen's order (directive → check → sentence); SPAM's role in phase B |
| `16` | Fit derived from the panel's keys; C/B per cell; the base-rate group's role |
| `26` | V8's SPAM item is no longer the manipulation check; the R2 "about 200 m at step 19" superseded by the CA values |

**Debrief addition (`09` §5.1).** Participants in `reasoning_intent` are told that the `linjaus` line was the machine's own assessment, that it was sometimes wrong, and that the views were written so that the directive did not fit all of them.

---

## 11. Build status and remaining mismatches (5 Oct 2026)

What exists on branch `claude/awesome-tesla-yyyq02` after the reconciliation, against this document's code-level requirements.

| Requirement | Status | Where |
|---|---|---|
| Three cells, real cell in the header (§2.1) | Built | `header.ts`, `preview.ts` |
| Allocation table, blocks 14 : 14 : 14 (42; revision (au)), stratified by language, seeded, regenerable byte-identically (§2.2) | Built 5 Oct | `app/session/assignment.ts`, `tools/assignment/generate.ts`, `content/assignment/allocation.json`, `test/session/assignment.spec.ts` |
| Study link by participant code; `?solu=` for demonstrations and pilots only; code and cell logged; cell never shown (§2.2) | Built 5 Oct | `preview.ts` `startChoiceFromUrl`, `App.tsx`, `LogHeader.assignment` |
| Server builds the prompt and appends the directive; client never sends it (§3.2) | Built | `server/thinker/handler.ts` |
| `systemPromptHash` of the text actually sent | Built | server log line |
| Directive used only in `linjaus` (P2); symmetric statuses, no examples (P3); no recommendation in `linjaus` (P5) | Built 5 Oct (prompt rules 5–7); manifest hashes updated | `server/thinker/prompt.intent.{fi,en}.md`, `content/thinker/manifest.json`, `test/engine/prompt.spec.ts` |
| Fifth field, schema for that cell only, fallback `ei_arvioitu`, status logged as its own field (P9, P10) | Built | `thinker-protocol.ts`, `model.ts`, `queries.ts` |
| `linjaus` line on screen, same weight for every status | Built | `RightPanel.tsx` `DirectiveLine` |
| Hinge check: directive hidden while answering, shown again after (§4.1) | Built (re-show added 5 Oct) | `orchestrator.ts`, `JudgementPanel.tsx` |
| Hinge sentences by cell, equal length, DRAFT, logged as shown (§3.2) | Built 5 Oct | `ui.ts` `hingeCellNote`, `hinge_cell_note_shown`, `test/session/hinge-note.spec.ts` |
| SPAM under D4 (§4.3) | Built (agent C) | `spam-delivery.ts`, `SpamCard.tsx`, `spam-measures.ts` |
| Exposure before the plan (§3.4) | Built 5 Oct | `derived-measures.ts` `strategyExposureBeforePlan` |
| Post-session request not to describe the session (§2.2) | Built 5 Oct (DRAFT) | `ui.ts` `done` |
| Prompt audit (§3.3) | Not built; runs against the live proxy before pilot 2 | — |

**Remaining mismatches (not resolved here):**
- **M1. The table is in the client bundle.** §2.2 asks that the table be stored outside the recruitment workflow and read "server-side, or a signed token in the link". The brief asked for a committed table, and the Haku cell has no server, so the browser looks the code up in a bundled copy. A participant who reads the bundle could find other codes' cells; codes are not guessable from each other, and every session logs `assignment`, so a table session with a code not issued to that participant is detectable. Before recruitment the researcher should decide whether to (a) accept this, (b) serve the lookup from the Thinker server for all cells, or (c) issue signed links. The recruiter needs only the code list, not the cells. The stratum sizes (fi 240, en 80) are DRAFT.
- **M2. The cell still travels in the Thinker request.** For table sessions the server refuses a cell that is not the code's; demonstration and pilot sessions are served by the cell they name. §3.2's "never from the request body" holds for table sessions only, and only if the client sends the code (an edited client could omit it; the server log would then lack `participantCode`).
- **M3. P5 is applied to `linjaus` only** (see the P5 row): applying it to the four fields would break P2. Researcher decision.
- **M4. The session date and a unique session id are not logged.** The header's `startedAtIso` is the epoch placeholder and `sessionId` is `preview-session` (determinism lint forbids the wall clock in `app/`; the upload pipeline that would stamp them is not built). §2.2's drift check over recruitment time (T12) needs the date; until then it must come from the server log's `loggedAt` (Thinker cells only) or from the session's file metadata.
- **M5. Exposure measures not yet derived:** informed answer (needs `basisAtomIds` by content), deciding record opened, notice-triggered revision, before the boundary (§3.4); the `linjaus` correctness coding (§3.5) waits for the panel's keys.
- **M6. No post-session questionnaire in the app:** the hinge item's retention repeat and the perception item (§4.1) are not built.
- **M7. Corpus inputs not yet in the pending patch** (§7.5 list): V9's recorded size record; "painopiste siirtyy etelään"; the step-15 soft hyphen; the SE-edge crews in V11–V14 against the defensive directive; the drones' R2 wording; and confirmation that the 5 Oct decisions (return at step 14, late no-fit view) are in the patch that is merged.
- **M8. Counterbalancing of the Type E order** is by a hash of the participant code (`expectationOrderOf`), not balanced within the allocation table's cells; with 65–70 per cell it is near balance by chance only. Stratifying it in the table would change the generator (and the seed's table).

---

## 12. Readiness round, work package I (5 Oct 2026)

- **Allocation strata (researcher decision R3; supersedes §2.2's and §9 row 3's "fi 240 / en 80").** English 6 blocks (240 codes, generated first), Finnish 1 block (40 codes, pilots); seed unchanged (20261005); `rowsSha256` **529f15f8…fe89** (supersedes 4310dfed…d2a8). DRAFT sizes, researcher to confirm.
- **M6 built (DRAFT).** The post-session questionnaire (`app/session/questionnaire.ts`, texts in `app/i18n/study-texts.ts`) repeats the hinge item first (options rotated by two, logged in `questionnaire_presented.retentionOptionOrder`) and asks the Thinker cells the perception item (`ai.directive_relation`: yes / no / don't know); answers are logged raw (`questionnaire_submitted`). The debrief follows it (`debrief_shown`, `debrief_closed`), with the `reasoning_intent` paragraph of §10.
- **Study shell.** Consent (`consent_decided`, the first record after the header; declining: BOOT → ABORTED), preflight (`preflight_result` with the checks; hard failure: PREFLIGHT → ABORTED), a pre-session fatigue item; the consent text is a placeholder for the ethics board. Consent is asked before the preflight (SPEC/05 §2 has the reverse), so no environment data are recorded before consent — researcher to confirm.
- **SPAM practice.** VP carries one practice SPAM item (`probe.s.practice`, after VP's freeze, at 45 s; not scored), and the guided tour explains the ready prompt and the locked tools (step `spam`), identical in all cells.
- **English glossary (R2)** in the English briefing and from the message log (`glossary_opened`, `glossary_closed`). *Superseded 9 Oct 2026 (revision (ae), `15` ae.2): the glossary is removed; English sessions name places and codes in English (`18` ae).*
- **Review packet:** `npm run review:export` writes strings, corpus and draft keys (CSV and Markdown) to `review-packet/` (gitignored).

---

## Revision 6–7 Oct 2026 (y) — V14 no-fit, whole-plan coding, H14 on alignment, power for 3 + 3 views

Researcher decisions of 6 and 7 Oct 2026; built and tested as `16` revision (y).

### y.1 The keyed views

| View | Fit | Sound main effort | Accepted sectors (core; boundary-only) | `soundSecondary` |
|---|---|---|---|---|
| V9, V10 | no | `direct_attack` | L2 + L3 (L3; L2): the new front's step-13 polygon | direct attack on the new front in L2/L3, main effort anywhere with an aligned posture |
| V11, V12 | yes | `barrier_line` / `protect_values` | L2 + L3 (L3; L2): the head's polygon in the view's first step | — |
| V13 | yes | `barrier_line` / `protect_values` | L3 | — |
| V14 | **no** | `direct_attack` | L1 + L4 (L4; L1): the second flare-up's step-19 polygon | direct attack on the flare-up in L1/L4, **main effort in L3** (Lahdenkylä) with an aligned posture |

Accepted sectors are computed from the mapped front polygons (every sector a vertex falls in, or the nearest one for a vertex in a gap), never hard-coded (`demo-directive.ts`). V14 is §7.4's late no-fit view. The no-fit set is now V9, V10 and V14, against the fit set V11–V13, which breaks the confound of fit with time since the hinge.

### y.2 Coding rules

- **Whole-plan alignment.** A secondary direct attack makes the plan **against** the directive (cell C or D), whatever the main posture.
- **Unlisted secondary attack.** A secondary attack that the key does not list as sound makes the plan unsound **only when the main posture is aligned** (V11–V13: D). A main-effort direct attack at V9 with a second attack elsewhere stays C.
- **Timing.** Each coded plan carries `afterBoundary` (merged views) and `afterFreeze`. Both are reported as splits beside the plan in force at view end.

### y.3 H14, restated (pre-registered; supersedes H14 in §5.3 and §5.7)

**H14 (secondary). Compliance where the directive fits.** In the keyed fit views (V11–V13), the share of **aligned** plans (A∪B = 1 vs C∪D = 0, `h14Aligned`) differs between the cells. The model is H13's, two-sided, in the Holm family. Soundness and the A/B/C/D cell stay **descriptive** in the fit views. **Sensitivity analyses:**
- plans that are sound only through a boundary-only sector (`viaBoundarySector`) are recoded as unsound **(superseded by revision (aa) aa.4: core sectors are the primary coding; `viaBoundarySector` is true wherever accepting the boundary sectors changes the plan's coding, defined for every outcome where `sound` is coded)**;
- at V14, C via L4 only is compared with C via L1 + L4.

### y.4 Power for three no-fit and three fit views (paper2-reviewer, 7 Oct 2026)

This re-runs §6's model with the no-fit set V9, V10 and V14 (round 2) and the fit set V11–V13. P(direct attack on the keyed sector) = 1.0 (`power2-phead1.txt`; .85 and .65 were also run). 1000 replicates, seed 20261004, α = .05 two-sided. T = `reasoning_once`, S = `reasoning_intent`. **The DGP still models the `linjaus` exposure that revision (z) withdraws; superseded by the power run of revision (aa) aa.6.**

| Scenario | H13 GLM-C, 65 / 65 | 46 / 46 | Share-C, 65 / 65 | H15 GLM-int, 65 / 65 | 46 / 46 |
|---|---|---|---|---|---|
| null | 5 % | 6 % | 4 % | 5 % | 5 % |
| aid-weak (exp .5, correct .7, δ 1.0) | 15 % | 11 % | 6 % | 14 % | 11 % |
| aid-moderate (exp .6, correct .8, δ 1.5) | **60 %** | 47 % | 16 % | 70 % | 54 % |
| aid-mid (exp .7, correct .85, δ 1.75) | **90 %** | 80 % | 32 % | **94 %** | 88 % |
| aid-strong (exp .8, correct .9, δ 2.0) | 100 % | 97 % | 66 % | 100 % | 100 % |
| exp-low (exp .3, correct .8, δ 1.5) | 21 % | 18 % | 8 % | 25 % | 21 % |
| exp-high (exp .9, correct .8, δ 1.5) | 91 % | 77 % | 32 % | 96 % | 87 % |
| amplifier (γ 0.7, no aid) | **60 %** | 45 % | 51 % | 5 % | 5 % |
| wrong-AI (exp .6, correct .3, δ 1.5) | 10 % | 10 % | 49 % | 55 % | 46 % |

Population shares, T → S:
- C in the no-fit views: 26.9 → 43.2 % (aid-mid); 26.8 → 17.5 % (amplifier).
- A in the fit views: 84.4 → 89.8 % (aid-mid).

**Not reconciled.** The output has no H14 (alignment) column. The figures quoted as "H14 aid-mid 32 %, amplifier 51 %, wrong-AI 49 %" are in fact the Share-C column, a Welch test on C in the no-fit views. An H14 power figure needs a run with the alignment outcome.

### y.5 Recommended pre-registrations from the persona reviews (researcher to decide; `11` §7.18)

1. **H9 exposure split:** H9 reported separately for participants who met the planted record and for those who also saw the contradicting record.
2. **H2:** the map items analysed separately from the option items, with the response-bias term reported beside accuracy.
3. **H4** read as a difference in confidence level only.
4. **Fallback-rate sensitivity:** every Thinker analysis repeated without the sessions above a declared share of fallback answers.
5. **Session language** as a covariate in every model (already in §5.9 for Paper 2; to be extended to Paper 1).
6. **An attention check and pre-session experience items:** open; not built.

---

## Revision 8 Oct 2026 (z) — OPEN: Paper 2 needs revision after the 8 Oct redesign

> **Superseded by revision (aa), below.** The open items and options (a)–(c) are resolved there; the list of affected measures stays accurate as a record of what the `linjaus` withdrawal removed.

The researcher's decision of 8 Oct 2026 (`02` revision (z)) has two parts:
- every cell gets the same structured Haku chat;
- both Thinker cells get the same Open Thinker.

**No answer carries `linjaus` any more.** The cells `reasoning_once` and `reasoning_intent` are still allocated (14 : 14 : 14 since revision (au)) and logged, but they **receive identical treatments**. This revision does not re-decide anything. It lists what is affected and must be revised before pre-registration.

**Hypotheses left without a manipulation:**
- **H13** (primary): `reasoning_intent` vs `reasoning_once` on C in the no-fit views. The cells no longer differ, and the reading in §5.2 (application aid vs compliance amplifier) rests on the `linjaus` verdict.
- **H14** (alignment in the fit views) and **H15** (cell × fit): the same two cells, so no manipulation.
- **H17** (within `reasoning_intent`, by the last `linjaus` status): no status exists.
- **H16a/b** (each Thinker cell vs Haku) survive only as **Haku + Open Thinker vs Haku**. Haku itself is now an LLM chat (`02` §z.2).

**Measures that relied on the `linjaus` line:**
- §3.4 exposure: notices by status, exposure before the plan, and notice-triggered revisions. `strategyNoticeExposure` and `strategyExposureBeforePlan` return nothing for new logs.
- §3.5: the status coded right or wrong against fit, and the descriptive result in §1.2 on how the AI's own verdicts went.
- §5.4 mediator and moderator analyses: the CACE with exposure as the treatment received, and the symmetric comparison.
- §3.2–§3.3: the prompt audit P1–P10 as a fidelity check (leakage, grounding of `linjaus`, recommendation in `linjaus`).
- §3.2 / §4.1 / §10, the hinge sentence and the debrief by cell. The build still shows the `reasoning_intent` sentence announcing a "Linjaus" line, and the debrief still tells those participants that the line existed. Both are stale in code (`02` §z.5).
- §6 and y.4, power: every scenario's DGP is driven by `linjaus` exposure (pExp, pCorrect, δ, γ), so the figures do not describe the current design.
- T10 (demand from the line), and §1.4's nested-cell rule for Paper 1's phase-B tests (moot now that the Thinker cells are identical).

**Still valid:**
- the directive and its delivery (§3.1);
- the posture coding, the keys and the sectors (y.1–y.3);
- the hinge check (§4.1) and SPAM's role (§4.3);
- the base-rate check;
- the set of no-fit and fit views.

**Options for the researcher (not decided):**
- **(a) Merge cells 2 and 3.** Paper 2 becomes Haku vs Haku + Open Thinker, on C and on alignment. The Open Thinker *may* recommend, so this becomes an advice-taking design, the reading that P5 excluded.
- **(b) Re-introduce a cell difference through the Open Thinker,** e.g. the directive in its prompt for one cell. This would be pre-registered as new.
- **(c) Drop the randomised Paper 2 contrast** and report the H11/H12 levels descriptively.

Each option needs a new power run (`tools/power/paper2-power.ts`).

---

## Revision 8 Oct 2026 (aa) — Paper 2 restated: a directive-aware Open Thinker against Haku

Researcher decisions of 8 Oct 2026 (final round, after persona iteration 4: D1, D2). **Resolves revision (z)'s OPEN section.** Built in the final fix pass: `orchestrator.ts` (`directive_shown`), `RightPanel.tsx` (the directive line), `server/thinker/prompt-open.{fi,en}.md` and `model.ts` `openPlanContext`, `app/telemetry/derived-measures.ts`, `freeze-measures.ts`. Tests: `test/server/thinker-open.spec.ts`, `test/telemetry/*`, `test/session/*`. **Supersedes** §2.3's contrasts, §3.2–§3.5 (the `linjaus` manipulation), §5.4, §5.7's H13–H17, §6 and y.4 (power), and revision (z)'s options a–c. Everything not named here stands (§3.1, y.1–y.3 except the coding default in aa.4, §4, the base-rate check).

### aa.1 The design

> **Superseded in part by revision (ab):** the Open Thinker's rule list below (rules 1–6) is replaced by the frozen treatment "assess, never enforce" (`14` §ab.2, `27` ab.1).

| | Haku group | Open Thinker group |
|---|---|---|
| Cells | `radio` (70) | `reasoning_once` + `reasoning_intent` (130), **pooled** |
| Directive | P2's radio message at V8 and the persistent "Johdon linjaus / Command directive" line from V8 | identical |
| Haku chat (standard prompt) | yes, neutral | yes, neutral |
| Open Thinker | no | yes, **directive-aware**, identical in both cells |

- **The contrast is a directive-aware Open Thinker against Haku.** Cells 2 and 3 are identical by design. They are still allocated (14 : 14 : 14 since revision (au)) and logged, and the analysis pools them. There is **no A/A negative control any more**: the cell label carries no treatment, so a difference between 2 and 3 can only be noise. It is reported as a descriptive check, not a test.
- **Directive delivery (D1).** The directive reaches **both** conditions, in every cell, as P2's radio message at V8 (the hinge) **and** as a persistent line at the top of the right panel from V8 on (`SessionSnapshot.directiveInForce`, label "Johdon linjaus" / "Command directive"). Its display is logged once as `directive_shown {view, messageId, clockLabel}` (`07` revision (aa)). Before V8 nothing is shown; the practice view has none.
- **The Open Thinker (D2).** One prompt for both AI cells (`prompt-open.{fi,en}.md`, frozen in the manifest), plain-text answers. Its rules:
  1. ground the answer in the records and cite them as [T#, time];
  2. mark inference, and say what is unknown and what would settle it;
  3. give options with their trade-offs;
  4. when the commander discusses a situation or proposes or asks about a decision, say whether the reasoning is in line with the higher strategy and, if it departs, what in the records would justify departing, as an assessment and not a prohibition; the commander decides;
  5. a life-safety hard stop: never advise withdrawal or evacuation as an order, raise them as questions;
  6. refer to sectors and units by the context's ids.
- **Plan context, built server-side for every question** (`openPlanContext`, from the view and clock the client reports): the clock and view; the sector ids and labels (L1–L4); the crews and drone teams on scene, with the **autonomous** assets (VD1, UGV1) listed separately; the plan's posture options and secondary-task options; and the intent in force: **the phase-A intent before V8, the directive verbatim from V8**. The directive is read from the scenario, so it cannot drift from what P2 said.
- **Haku stays neutral** (standard prompt, unchanged, no directive, no history).

### aa.2 What Paper 2 can and cannot claim

> **Revision (ab):** the "live model is untested" bullet reads as ab.4; the Open Thinker now assesses and leaves the call (ab.1).

- **Can:** whether a conversational, directive-aware advisor, on top of the same structured retrieval chat, changes the share of phase-B plans aligned with the command's directive, and how that differs between views where the directive fits and where it does not.
- **Cannot** separate "directive-aware" from "advisor". Haku + Open Thinker differs from Haku in having an open conversation, history, recommendations *and* the directive; no cell has an advisor without the directive. The effect is the package.
- **Not an accuracy-controlled aid.** The Open Thinker's relation to the directive is free text; whether it was right at each view is a property of the model, the prompt and the participant's questions (T2 carries over). It is reported per view through the blind coding in aa.4.
- The live model's behaviour is **untested**: no API key has been available, and the prompts were exercised against stubs only (`11` §7.18.2).

### aa.3 Hypotheses restated (supersede §5.7's H13–H17)

> **Superseded in part by revision (ab):** the model line's "phase-A share" is dropped as a covariate (post-treatment); the baseline is the practice view and V1 (ab.2).

The outcome is **whole-plan alignment** (`aligned`, `h14Aligned`: A∪B = 1, C∪D = 0; in phase B a secondary direct attack is against the directive, `16` revision (y)). Contrast: Open Thinker group (130) against Haku (70). Model: aligned ~ group + view + phase-A share + (1 | participant), logistic mixed model, two-sided, α = .05, on the plan in force at view end. (The view sets below, no-fit V9, V10, V14 and fit V11–V13, are **confirmed by the researcher 8 Oct 2026**.)

- **H13 (primary). Alignment where the directive does not fit.** In the keyed no-fit views (V9, V10, V14) the share of aligned plans differs between the groups. The sign is not predicted: an advisor that flags a departure may lower alignment (justified deviation, cell C); one that argues for the line may raise it.
- **H14 (secondary). Alignment where the directive fits.** In the keyed fit views (V11–V13) the share of aligned plans differs between the groups (y.3's H14 with the contrast replaced).
- **H15 (secondary). Discrimination.** The group × fit interaction on alignment over all six keyed views. An advisor that helps apply the line only where it fits shows as a positive interaction; a uniform push shows as a main effect only.
- **H16 and H17 are withdrawn.** H16 (each Thinker cell against Haku) is now H13–H15 itself; H17 (the `linjaus` status) has no status.
- **Multiplicity.** H13 is the only primary. H14 and H15 form one family, Holm at α = .05. Everything else is exploratory or descriptive.
- **H11 and H12** (levels of compliance and justified deviation) stay descriptive, per view and per group, against the base-rate group.

### aa.4 Coding and measures (`derived-measures.ts`, `freeze-measures.ts`)

- **Primary soundness and cell** (`sound`, `cell`) count the **core sectors only**. The coding that also accepts the boundary-only sectors is the **sensitivity**: `soundWithBoundary`, `cellWithBoundary`, and `viaBoundarySector` (true where accepting the boundary sectors changes the plan's coding). This reverses y.1–y.3's default, where the boundary sectors were accepted and the recoding was the sensitivity.
- `mainAligned`: the main posture alone is within the directive. `aligned` also reads the secondary sector.
- **Plan timing.** Besides `afterFreeze` and `afterBoundary` (for the plan in force at view end), `firstAfterFreeze` and `firstAfterBoundary` give the first plan submitted after the freeze opened or after the merged view's step boundary. The analysis uses the plan in force at view end; the "first after" plans are the sensitivity.
- **Exposure to a deciding record.** `atomExposure(records, atomIds, beforeSeq)` says whether a record reached the participant before a plan, and by which routes (pushed bubble, Haku or Open Thinker retrieval); `answerRelaysAtom` screens whether an answer states it (`09` revision (aa)). `strategyNoticeExposure` and `strategyExposureBeforePlan` return nothing for new logs.
- **Advice-following, coded blind.** `openThinkerAnswersBeforePlan` lists, per keyed view, the Open Thinker answers received before the plan in force, with each question, text, times and fallback flag. It codes nothing. Coders read the answers **without the key** and code whether the plan follows the advice. This replaces §3.5's status coding and H17.

### aa.5 Pre-registrations recommended by the reviewers (the researcher decides)

1. **An intensity-matched phase-A baseline:** V3 against V9, and V4–V6 against V11–V13, so that the posture in V9–V14 is read against phase-A views of the same fire intensity, not the phase-A average.
2. **The base-rate group under the phase-A intent**, not only under the directive: what officers do anyway when given the intent that applied before V8.
3. Core-sector coding primary and boundary coding sensitivity (aa.4); the blind advice-following coding fixed before any key is applied to the answers.
4. A fallback-rate sensitivity (Open Thinker turns that showed the "unavailable" state, `14` revision (aa)) and session language as a covariate.

### aa.6 Power (paper2-4, 8 Oct 2026)

`power4.ts`, derived from `tools/power/paper2-power.ts`; 1000 replicates, seed 20261008, α = .05 two-sided. No-fit baselines for cell C: V9 .25, V10 .30, V14 .30. Three fit views at a base of .88 aligned; P(correct sector) .85. Population aligned share: no-fit .685, fit .845. "Both" is the same log-odds shift of the Open Thinker group in both view sets.

| Scenario | Design | C, no-fit | H14: alignment, fit | H13: alignment, no-fit | group × fit |
|---|---|---|---|---|---|
| null | Haku 70 vs Open Thinker 130 | 5 % | 5 % | 5 % | 6 % |
| both +0.5 logit | 70 vs 130 | 50 % | **40 %** | 60 % | 84 % |
| both +0.5 logit | 65 / 65 (the old cell contrast) | 37 % | 28 % | 45 % | 67 % |
| both +0.75 logit | 70 vs 130 | 84 % | **70 %** | 93 % | 99 % |
| both +0.75 logit | 65 / 65 | 68 % | 52 % | 79 % | 95 % |
| both +0.75, half act on the advice (ITT about +0.4) | 70 vs 130 | 34 % | 25 % | 39 % | 60 % |

- **H14 is the weakest test.** With 70 vs 130 it has 40 % power at a +0.5 logit shift and 70 % at +0.75 (65 / 65: 28 % and 52 %), because the fit views sit near the ceiling. **H13 has the power** (60 % and 93 %). The interaction is powered for a uniform shift because it adds the two view sets.
- With 30 % attrition (49 vs 91) power falls by 2–4 points in the null-to-moderate rows.
- The pooled 130 vs 70 design beats the cell contrast it replaces by 10–20 points; the price is the confound in aa.2.
- Within-person fit effect on alignment (everyone, n = 200): 5 % power if the fit views' aligned share is .72, 37 % at .76, 88 % at .80. The fit views must be clearly easier to follow than the no-fit views.
- The output also holds amplifier, attack-bias, no-fit-only and fit-only rows (`power4-out.txt`, scratchpad).

### aa.7 Not changed and not done

- The hinge check (§4.1), SPAM's role (§4.3), the posture keys and sectors (y.1), the base-rate check, T5 (V14 as a late no-fit view mitigates it, §7.4) and T7 (ceiling in the fit views).
- **Stale by this revision:** §3.2–§3.5 (the strategy-guided Thinker, its audit and status coding), §5.4, §5.7's H13–H17 wording, §6 and y.4 (power), T10, and the hinge-sentence and debrief text about a "Linjaus" line in §3.2, §4.1 and §10 (the code no longer shows or logs that sentence, and the debrief no longer mentions the line; `02` revision (aa)).
- **Open** (`11` §7.18.2): the Open Thinker's live-model behaviour; whether the persona and the recommendations in its prompt are acceptable to ethics; whether P2's message plus the banner needs a stronger check than the hinge check's recall item.

---

## Revision 8 Oct 2026 (ab) — the Open Thinker assesses; the covariates; the departure note; the AI's verdict

Researcher decisions of 8 Oct 2026 after persona round 5 (D1, D3, D5, D6, D7; `FIXPASS6.md`, `11` §7.18.4). Details: `14` and `02` revision (ab) (the Open Thinker's prompt, the digest, the clocks), `16` revision (ab) (the coding), `09` revision (ab) (measures). **The contrast of revision (aa) is unchanged:** a directive-aware Open Thinker (cells 2 and 3 pooled, 130) against Haku (70), the directive on both sides.

### ab.1 The treatment as frozen (supersedes aa.1's rule list for the Open Thinker)

The Open Thinker **assesses, never enforces**. Its eight rules are quoted in `14` §ab.2; in design terms: the directive is a duty officer's order, not a safety finding; a tactic is judged against it only when it is a plan option (posture, secondary task), anything else is "not covered" (a crew's burnout from a held road is in line and not a plan option, `16` ab.1); the absence of a record is not evidence; no imperatives; at least two options with trade-offs, no recommendation and no "safer option" stance; a departure can be justified by a small, new or unattended fire or a risk the directive did not foresee, and "departures are reported up the chain"; withdrawal and evacuation questions get records and questions and no verdict. Both tools use the recency rule (the latest record per source, a record older than about 30 minutes is stated as old) and are given the true clock "records received up to HH:MM". Haku's prompt adds D7 (the directive is in the banner, not in its records). Output: about 100 words (cap 320 tokens), `gemini-3.5-flash`, thinking off, temperature 0, `modelVersion` logged.

**What this does to the claim.** Revision (aa) described an Open Thinker that tells the commander whether the reasoning is in line. Round 5 showed that, unconstrained, it enforced; the treatment is now an **assessor that leaves the call and says departures are reported**. The package claim of aa.2 stands ("directive-aware" cannot be separated from "advisor"), but the direction of H13 is now less obviously "toward alignment": an assessor that names the records that justify a departure may lower alignment in the no-fit views.

### ab.2 Coding and covariates (supersede aa.3's model and aa.4 where they differ)

- **Model.** `aligned ~ group + view + baselineCompliance + (1 | participant)`, logistic mixed, two-sided, α = .05, on the plan in force at view end. **The phase-A share is dropped as a covariate (D6):** it is post-treatment, the Open Thinker being on offer from V1 on. The baseline is `baselineCompliance`: the share of `direct_attack` among the plans in force at the end of the practice view and V1 (before any treatment contact, `16` ab.4). Pre-register this.
- **The AI's verdict is a covariate (D6).** For each Open Thinker answer `aiVerdict` (`in_line` / `departs` / `not_covered` / null) is logged (`07` revision (ab)) and joined in `openThinkerAnswersBeforePlan`. It exists only in the Open Thinker group, so it enters the **within-group, exploratory** analysis (what the advice said and whether the plan followed it, beside the blind advice-following coding of aa.4), not the group contrast. It is a pattern screen, not a coding of correctness.
- **The departure note (D5), a measure.** From V8 a plan may carry "I am departing from the command directive" and a one-line reason, in both conditions (`02` ab.4). (*Revision (ai): the reason is an optional closed choice; see the revision at the end.*) `accountableDeviation` splits the **C plans** (against the directive, sound) into with and without the note: whether the departure the Open Thinker licenses is reported. The note is not part of the cell and not an outcome of H13–H15; the group difference in the note share among C plans is descriptive. The reason is not coded. No transmission exists: it is a participant-side declaration only.
- **Resume-aware coding.** `directiveAdherence` takes the last attempt after a replayed view (`attemptStartSeq`), and `openThinkerAnswersBeforePlan` is filtered to that attempt (`16` ab.3). `finalPlanPerView` serves H5.
- **Primary coding unchanged:** core sectors; boundary sectors as sensitivity (aa.4).

### ab.3 Exposure in the no-fit views

Paper-2 reviewers noted that C in the no-fit views depends on the participant meeting the deciding record (the V9 SPOT 17:10 flare-up, now naming its sector, L3; `26` revision (ab)). The Open Thinker now carries a **digest of the step's latest records** with every request (`14` §ab.4), so the Open Thinker group meets it by construction; the SPOT record is recorded, not pushed, so Haku's group meets it only through its own search (Haku's chat or the Haku tab). This **mitigates but does not remove** the dependence: it makes exposure differ by design between the groups in the no-fit views, as part of the package. Exposure remains measurable with `atomExposure` (`09` aa.2).

### ab.4 What stays open

- **The retrieval re-selection** is closed: the declared `collapse3` is kept, the rule's narrow preference for `collapse3+cap3` is a documented post-freeze mismatch (`14` §ab.6).
- **The live word count** (104–140 words against a 100-word limit) and a full live re-run of the new prompt (pilot 1).
- **Whether a one-line "departure noted" channel is enough:** there is no transmission up the chain, by design.
- **Stale by this revision:** aa.1's six-rule list for the Open Thinker; aa.3's model line "phase-A share"; aa.7's open item on the live model (read as ab.4).

## Revision 9 Oct 2026 (af) — one shared study link; the server issues the next allocation code

Researcher, 9 Oct 2026: "Why would I share separate links? Unique keys should be created when the user starts the simulation … not on localhost." §2.2's **Delivery** is extended; the generation, the table and its hash are unchanged.

### af.1 Delivery

- **The shared link** is `https://<host>/?tuotanto`, the same for every participant. On the start page the participant chooses the language and presses start; then, and only then (outside the run loop, `05` I3), the browser calls `POST /api/assign` once with a session id it has just generated and the language. The hosted study server answers with the **next unused code of the allocation table in table order within that language's stratum** (`server/production/auto-assign.ts`); the browser looks the code up as for a `?koodi=` link and runs the session under it (`app/session/auto-assign.ts`). The answer carries the code only, never the cell.
- **Balance.** Codes go out in exactly the order the permuted blocks lay them down, so the shared link reproduces the blocked randomisation of §2.2: within each language every completed block of 42 holds 14 : 14 : 14 (revision (au); before 40, 14 : 13 : 13). As with links, a code issued but never run leaves a gap; analysis is by the cell logged.
- **Persistence and no reissue.** The server writes each issue (code, cell, language, block, session id, time) to `<SESSION_LOG_DIR>/issued-codes.json` atomically before answering, reads it back on start (a file written for another table stops the server), and skips codes already present in an uploaded session's header (manual links). A repeated request with the same session id gets the same code. The browser stores the session id (before the request) and the code in local storage: the same link in the same browser resumes the unfinished session (`05` §9) or reuses the code; a finished session is not run again from that browser.
- **Guard.** At most `ASSIGN_RATE_PER_HOUR` new codes per client address per hour (default 20) and `ASSIGN_MAX` codes in all (default: the table's length).
- **Only on the hosted study server.** The route exists only when the production server runs with `AUTO_ASSIGN=1` (set by `scripts/host-study.ps1` and the Dockerfile). Otherwise, and always in the Vite dev server, it answers 404 and the `?tuotanto` start page says, in Finnish and English, that the link is not active and to contact the researcher. There is never a random or demonstration fallback in the study, and a local run never consumes or creates a code.
- **Manual links** `?tuotanto&koodi=<code>` work as before. The demonstration start page is unchanged.
- **Header.** `assignment` gains `assignmentSource`: `"server"` (issued by `/api/assign`) or `"link"` (`?koodi=`); absent before 9 Oct 2026 (all link). `source: "table"` sessions of both kinds enter the confirmatory analysis.
- **Admin.** The data page and `/api/admin/assignments` list the issued codes with cell, language, block, issue time, session id and the session's status (complete, partial, …, not started), the cell filter in force, the cap and the codes left (`docs/DEPLOYMENT.md` §6, §7.1).

### af.2 The pilot cell filter (`ASSIGN_CELLS`)

For the professors' pilot (researcher, 9 Oct 2026) everyone runs `reasoning_intent` (Search + guided Thinker, which has both tools). `ASSIGN_CELLS=reasoning_intent` makes the server walk the same sequence and issue only that cell's codes, in sequence order; codes of other cells stay unissued (and usable as manual links). **Trade-off:** the sequence's order and the concealment are kept, but the filter **deliberately breaks the blocked balance between cells** (the filtered-out cells receive nobody). It is a pilot setting only and **must be unset for the study**. `host-study.ps1` defaults to it (`-Cells all` for the full sequence), the Dockerfile never sets it, and the server's start lines and the admin page show it whenever it is in force. The English stratum holds 78 `reasoning_intent` codes (13 per block × 6) and the Finnish one 13: ample for a pilot of 3–10 people. Pilot sessions consume real table codes: before the study either keep `issued-codes.json` (the study continues after them, the pilot's codes being gaps) or move it aside to reissue them, and analyse pilot sessions apart.

### af.3 Changes to other documents

`02` (assignment) and `15` (study start) refer here; `11`'s row "Assignment from a pre-generated table" records the shared link; `docs/DEPLOYMENT.md` §1, §2, §6, §7, §7.1, §8.

## Revision 9 Oct 2026 (ag) — SPAM: the ready prompt waits and is forced at the view's end; it can be collapsed; the tools stay at hand

Researcher decisions, 9 Oct 2026. For SPAM this supersedes §4.3's "15 s to press ready (else `readyTimedOut`)", "20 s for an answer" and "Haku and Thinker are locked from the item's display until the probe closes", and **D4's tool lock** (`08` revision (u)). The four items, their moment (25 s into V3, V6, V8, V11; 45 s in VP) and their keys are unchanged. Built in `app/session/spam-delivery.ts`, `orchestrator.ts` (`endView`, `skipView`, `resumeForcedSpam`), `SpamCard.tsx`, `spam-measures.ts`, `app/telemetry/resume.ts`; tests `test/session/spam.spec.ts`, `test/session/spam-forced.spec.ts`, `test/scenario/practice-spam.spec.ts`, `test/telemetry/spam-measures.spec.ts`, `test/render/spam-card-ui.spec.ts`.

### ag.1 Delivery

- **No expiry.** The ready prompt ("Valmis vastaamaan?" / "Ready to answer?") stays until "Ready" is pressed. The ready latency is still measured from `spam_prompt_shown` and keeps its meaning as a workload index; it may now be longer than 15 s. `readyTimeoutMs` is withdrawn from the probe (`04`).
- **Collapsible.** The participant may minimise the prompt to a pill ("Kysymys odottaa – avaa" / "A question is waiting – open") and expand it with a click. Nothing is cancelled: the probe stays pending, the ready latency runs on, and the forcing below still applies. Logged `spam_collapsed` / `spam_expanded`.
- **Forced at the view's end.** If "Ready" has not been pressed when the view's time ends (the minimum with the period confirmed, the participant's confirmation after the minimum, or the 150 s cap), then before the view closes the view's clock is **paused** at that moment (as a freeze pauses it: no cue, the cap included, fires), the item is shown as a **modal step** over the map and the decision strip, with the same answer window, and the view ends — at that same view moment, with the end it was holding — when the probe closes. None of V3, V6, V8, V11 has a freeze; in VP the freeze comes before the prompt, so a forced item never meets one.
- **Answer window 60 s** (was 20 s), after a voluntary "Ready" and in the forced item alike, and in the practice item: the tools are usable (below) and a query takes time. No answer: `spam_answered` with `response: null`, `timedOut: true`; an option without its confidence: the confidence is missing.
- **Haku and the Thinker stay usable** while the item is open, voluntary and forced. The decision strip is still held while an item is open (`decisionHeld`; `toolsLocked` now means a visible probe only). In the forced item's paused end-of-view state the view's step is kept (the plan step, or "waiting for the view's end"), so the tools' step gate accepts queries there (tested). The right column (message log, Haku, Thinker) stays usable over the forced modal.
- **A merged view's step boundary** (V6, V11, 65 s) waits for an open **item** only, never for the ready prompt. An item said ready to at once closes by 85 s (25 s + 60 s), so the second step may now arrive up to 20 s late, and a later "Ready" delays it further; the delay is logged (`step_boundary_reached.atViewSeconds`).
- **Demonstration skip** (`allowViewSkip` only): skipping the view while the ready prompt is up logs `spam_ready` with `skipped: true` and `spam_closed`, no item — as a skipped freeze leaves its items missing; a prompt not yet due is not logged, as a freeze still to come is not. An open item cannot be skipped.
- **Resume.** A session interrupted during a forced item resumes **into** it (`planSessionResume` target `spam_forced`; `session_resumed.resumedAt: "spam_forced"`): the view is not replayed (no new `cycle_start`; its time had run out), the item is shown again (`spam_ready` `forced`, `resumed`), and the view ends with the end it held when the probe closes.
- **Visibility** (the old button was "a little bit disappearing"): the prompt is a strong amber band (#f4a261) with a large amber-filled "Ready" button with dark text (#1c1b19, contrast about 9:1 on the dark theme) and a slow glow that `prefers-reduced-motion` turns off; the pill keeps the same styling. The practice item looks and behaves the same.
- **The tour and help texts** (Finnish and English) say the question waits for the participant, can be minimised, appears before the period ends if it has not been answered, and that the map, the message log and the search tools can be used while answering (no tool is named).

### ag.2 Records and derived measures

- `spam_ready` may carry `forced: true` with `atViewSeconds` (the view moment the clock stands at) and `viewEndedBy` (the end it holds), `resumed: true` (re-shown after an interruption), or `skipped: true`. `timedOut: true` occurs only in logs before this revision. New kinds `spam_collapsed`, `spam_expanded` (`probeId`). Same format version, not yet released (`record-kinds.ts`).
- `spam-measures.ts`, per probe: `readyLatencyMs` to the first item display, with **`readyCensored`** (= `forced`) when the participant had not said ready by the view's end; `forced`, `skipped`, `collapses`; `answerLatencyMs` from the last item display before the option (it now includes any query time); `itemOpenMs` (was `toolsLockedMs`); and the tool use inside the item's window, display to close: **`hakuQueries`** (free text, navigation, Haku's chat), **`thinkerQueries`** (the Open Thinker), **`toolQueries`**, **`toolQueryIds`** (linking to the queries' own records, which carry the view), and **`answeredAfterToolAnswer`** (a tool answer reached the screen between the display and the option). A replayed view's prompt is measured on its own records.

### ag.3 What SPAM measures now

With the tools at hand, SPAM measures the **commander-plus-tools' situation knowledge** — the joint system's performance — not individual, in-head awareness. The researcher's reasoning: the questions are the task as the commander would do it for real, with the search and the Thinker at hand. §4.3's sentence "with the tools disabled, a group difference in SPAM accuracy is a difference in what is on screen and how it is read, which the groups share" lapses: both groups have tools (Haku; Haku plus the Open Thinker), so **a group difference on SPAM now reflects the tool difference**, which fits Paper 1's question (the LLM facilitator against Haku). In phase B the Open Thinker is directive-aware, so V8 and V11 carry Paper 2's manipulation as well (`11` §7.22). The ready latency remains a workload index (censored when forced); for Paper 2 SPAM stays a covariate and a fidelity check, never an outcome. The items remain answerable from the screen alone (each key rests on a pushed record, §4.3); the tools are optional.

### ag.4 Analysis consequences (for the analysis plan; open with the supervisors, `11` §7.23)

- **Forced probes are a measurement change.** Their ready latency is censored at the view's end (a lower bound), and their answer comes after the view's information is complete, the clock paused. The plan treats them by a **sensitivity analysis with and without forced probes** (accuracy and answer latency), and models the ready latency as censored (a survival model, or the uncensored probes only as the sensitivity check); the share of forced probes is reported per group.
- **Per-probe tool-use covariates** (`toolQueries`, `hakuQueries`, `thinkerQueries`, `answeredAfterToolAnswer`) enter the SPAM models; **answer latency now includes query time**, so it is read with the tool-use covariate (or for probes without a query separately), no longer as pure retrieval-from-memory time.
- The step-boundary delay in V6 and V11 (ag.1) is logged and can be checked as a covariate of the second step's freeze-free views.

### ag.5 Changes to other documents

`08` revision (ag) (SPAM's lock and windows); `11` §7.23 (the open note for the supervisors); `04` (`readyTimeoutMs` withdrawn, the answer window's default 60 s); `15` §5's "in-head vs with-tools" contrast reads as superseded (SPAM is with tools); `record-kinds.ts` carries the record changes.

---

## Revision 9 Oct 2026 (ai) — the departure reason closed; `directive.fit` as the manipulation check

Researcher decision, 9 Oct 2026: no open-ended questions in the session (`09` ai, `11` §7.25). Two Paper 2 instruments change.

### ai.1 The departure reason (supersedes ab.2's "one-line reason")

When "I am departing from the command directive" is ticked (V8 on, both conditions), the plan panel shows **"Pääasiallinen syy" / "Main reason"**: an **optional single choice, nothing preselected**, no text field:

| id | Finnish | English |
|---|---|---|
| `crew_safety` | Miehistön turvallisuus | Crew safety |
| `protect_people_property` | Ihmisten tai rakennusten suojaaminen | Protecting people or buildings |
| `new_fire_info` | Uusi tieto palosta (leviäminen, uusi pesäke) | New information about the fire (spread, new spot fire) |
| `directive_unfit` | Linjaus ei sovi nykytilanteeseen | The directive does not fit the current situation |
| `resources` | Voimavarat eivät riitä linjauksen mukaiseen toimintaan | Not enough resources to carry out the directive |
| `other` | Muu | Other |

- **No "a tool suggested it" option** (two of three reviewers; the HCI reviewer's dissent is in `11` §7.25). AI-licensed departures are read from the log (`aiVerdict`, `openThinkerAnswersBeforePlan`).
- **Descriptive only.** Reported per group among the noted departures, beside `accountableDeviation`; not an outcome of H13–H15 and not coded further. Missing (box ticked, no reason) is reported as such.
- **The Thinker never sees it.** The Thinker request carries no plan; its plan context is derived on the server from the view alone (`openPlanContext`), tested (`test/session/closed-items.spec.ts`).
- Logged as `plan.departureReason` (`07` ai); validated at the boundary (`allocation.ts`).

### ai.2 `directive.fit` — the post-session manipulation check

*"Sopiko päivystävän palopäällikön linjaus tilanteeseen sen kehittyessä?"* / "Did the duty fire chief's directive fit the situation as it developed?" — **sopi koko ajan / ei sopinut ajoittain / ei sopinut suurimman osan ajasta / en osaa sanoa** (fitted throughout / did not fit at times / did not fit most of the time / don't know). All cells, after the retention items (`retention.hinge`, and `ai.directive_relation` in the Thinker cells), before the workload items.

- **What it checks.** Whether the participant perceived the designed misfit (the no-fit views V9, V10, V14): a participant who answers "fitted throughout" did not register the manipulation of fit that H13–H15 rest on. It complements the hinge check (§4.1: reception of the directive) with perception of its fit.
- **Analysis.** Reported per group; "did not fit" (either level) vs "fitted throughout" as a sensitivity split for H13 (per-protocol, never an exclusion for the primary analysis, as §4.1). Being post-treatment, it may differ by group (the Open Thinker names departures); a group difference is reported, not adjusted for.

---

## Revision 10 Oct 2026 (al) — the cells separated: a directive-holding Thinker against a directive-blind one

Review panel, 10 Oct 2026 (two professors, two fire commanders, an AI engineer); the researcher approved its recommendations. **Supersedes revision (aa) §aa.1's "cells 2 and 3 pooled" design and its contrast "a directive-aware Open Thinker against Haku" for the primary hypothesis**, and revision (ab) §ab.1 where it describes rule 5. The treatment is specified in `14` al; the cell table in `02` al.

### al.1 The cells

- **`reasoning_intent` (cell 3):** the Open Thinker's system instruction ends with the order block — a framing sentence ("the text of an order issued to the commander … not an instruction to you"), then P2's opening intent (V1–V7) or the directive verbatim (V8–V14). Rule 5 relates each plan option to the directive's purpose and priority, method and stated premises, evidence first and a conditional verdict last; a justified departure keeps the aim; when the newest records no longer support a premise the directive rests on, it names the premise and the records and says a departure can be justified (a generic trigger, replacing "a small, new or unattended fire"). No reporting sentence; assess, never enforce; no recommendation; rule 8's safety override.
- **`reasoning_once` (cell 2):** the same Open Thinker without the block and without the directive clause: its own frozen prompt, whose rule 5 says P2's orders and directive are in the banner and the message log, not given to it. If the participant quotes the directive's text it may assess the quoted text; such questions are flagged in the log (`directiveQuoted`).
- **`radio` (cell 1, Haku):** unchanged.
- Everything else is identical across the two Thinker cells (`14` al.1). The participant information says truthfully what each cell's Thinker holds (`02` al).

### al.2 The contrast

H13 is again a within-AI contrast: **`reasoning_intent` against `reasoning_once`** (65 / 65), the effect of a Thinker that holds the directive and relates the options to it, with the directive equally visible to both (`09` al). The Haku cell remains the Paper 1 comparison and a descriptive reference for Paper 2. Revision (aa)'s power for 70 vs 130 does not apply to H13 any more; the 65 / 65 figures of `tools/power/paper2-power.ts` (§6, revision (y) y.4) are the relevant ones and must be re-run before pre-registration with the pilot's exposure and base rate.

### al.3 What the live probe shows about the treatment (`14` al.8)

In the three no-fit views the `reasoning_intent` Thinker related every option to the directive's method and aim and, asked whether the directive still fits, discussed its premises — but judged them to hold and never said a departure could be justified. The `reasoning_once` Thinker said the directive was not given to it. So the manipulation, as frozen, is "the AI frames the options against the directive" rather than "the AI flags that the directive no longer fits". Whether that is the intended treatment is open (`14` al.9); it decides the expected direction of H13 (more alignment under `reasoning_intent`, not more sound departure).

### al.4 Coding

The Open Thinker's per-option verdicts (`aiVerdicts`, the last verdict phrase of each option line) replace the earliest-phrase `aiVerdict` as the analysis value of the AI-verdict covariate (`09` al). `directiveQuoted` identifies `reasoning_once` questions in which the participant brought the directive's text to the Thinker (a cross-over of treatment content, to be reported).

### ar. Authored directive premises (11 Oct 2026; `14` ar)

The Open Thinker's two authored, frozen directive premises (P1, P2) are part of the directive-aware `reasoning_intent` treatment, not a second manipulation: they restate the directive's own stated reasons, are identical for every participant, appear only in `reasoning_intent` from V8, and are hashed (`premisesSha256`, `systemPromptHash`). They are a treatment revision of `reasoning_intent`; sessions before it are not pooled with sessions after it for H13-H15 (`09` al). Their wording could hint at which views are no-fit (demand effect); instructors check it before the pilot (`11` §7.27). The verdict covariate may be read by premise id.

---

## Revision 11 Oct 2026 (au) — 210 = 3 × 70

Researcher decision, 11 Oct 2026. The planned sample is **210 participants in three equal cells of 70**: `radio` (Haku / Search only), `reasoning_once` (Haku + Open Thinker without the directive) and `reasoning_intent` (Haku + Open Thinker with the commander's intent / directive). Before: 200, permuted blocks of 40, 14 : 13 : 13 (70 : 65 : 65).

- **Allocation.** Permuted blocks of **42**, **14 : 14 : 14** (`BLOCK_SIZE`, `BLOCK_COMPOSITION` in `app/session/assignment.ts`); five full blocks = 210. Strata unchanged: English 6 blocks (now 252 codes; the surplus block absorbs the unknown split and drop-outs), Finnish 1 block (42 codes, pilots). Seed 20261005 unchanged; the block size changes the shuffle stream, so **every code and cell is new**: `content/assignment/allocation.json` regenerated by `tools/assignment/generate.ts`, `rowsSha256` **3f813613…8ccd** (supersedes 529f15f8…fe89 and 4310dfed…d2a8). Codes issued from an earlier table (pilots) are not valid for the study.
- **Contrasts.** Paper 1, H2 and the other Haku vs Haku + LLM contrasts: Haku **70** against the pooled Thinker cells **140** (`02` au, `09` au). Paper 2, H13–H15 (revision (al)): `reasoning_intent` **70** against `reasoning_once` **70**. Haku (70) stays the Paper 1 comparison and the descriptive reference for Paper 2.
- **Power.** The power figures computed for 70 / 130 (and 65 / 65, 46 / 46, 35 / 65, 49 / 91) are **to recompute for n = 210** (`tools/power/h2-power.ts` for H2 at 70 vs 140; `tools/power/paper2-power.ts` for Paper 2 at 70 vs 70, and 49 vs 49 after 30 % attrition); none is restated here. Figures in §6, y.4, aa.6 and al.1 describe the older n; read them as a method record, not as the present power.
- **Not changed:** the recruited-vs-completed question (`15` §9), the cells' treatments, the language strata, the code format.

**Power recomputed, 11 Oct 2026 (au.1).** Same method, seeds and 1000 replicates; only the group sizes changed (`tools/power/h2-power.ts` grid now 35/70, 49/98, 70/140; `tools/power/paper2-power.ts` grid T 70 / S 70, T 49 / S 49, H 70 / S 70; the aa.6 alignment script `power4.ts` re-run from the scratchpad at 70/70, 49/49, 70/140, 49/98, seed 20261008).
- **H2, 16 L2/L3 items, 70 / 140 (was 70 / 130):** Type I 5 %; gap under O-small 82 % (83), O-medium 100 % (100), mixed 54 % (55); GLM interaction under R-medium 53 % (54). At 49 / 98: O-small 68 %, R-medium 40 %, mixed 41 %. Practically unchanged: the Haku group (70) sets the precision.
- **H13 (GLM-C), three no-fit views, `reasoning_intent` vs `reasoning_once` 70 / 70 (was 65 / 65):** null 5 %, aid-moderate 62 % (60), aid-mid 93 % (90), aid-strong 100 %, exp-low 22 % (21), amplifier 63 % (60), wrong-AI 11 % (10). At 49 / 49: 48 %, 83 %, 98 %, 16 %, 47 %, 10 %.
- **H15 (GLM interaction), 70 / 70:** aid-moderate 75 % (70), aid-mid 98 % (94), wrong-AI 61 % (55).
- **Alignment (aa.6 model), cell contrast 70 / 70 (was 65 / 65):** +0.5 logit: C 41 % (37), H14 30 % (28), H13 alignment 48 % (45), group × fit 75 % (67); +0.75 logit: 73 % (68), 56 % (52), 82 % (79), 96 % (95). Within-person fit effect (n = 210): 5 % at a fit-view aligned share of .72, 38 % at .76, 93 % at .80.
- Reading: H13 is powered (≥ 80 %) only for a large effect; H14 is the weakest test; attrition to 49 per cell costs about 10 points in the mid range.

## Revision 19 Oct 2026 (ax) — Paper 2 under `30`: the guide against Haku

Supersedes (al), (ar) and (au) where they conflict; `30` governs.

- **Cells.** `reasoning_intent` (the guide, 50) against `radio` (Haku, 50); `reasoning_once` is no longer allocated (its code stays for demonstration codes and old logs). The guide is the Open Thinker with the order block, the authored premises P1, P2 and rule 5 — with one change: **the premise statuses come from a frozen premise-evidence table, not from the model** (`30` §3; `content/thinker/premise-evidence.json`, hashed in the manifest; `server/thinker/premise-check.ts`). The model words the options; a departing option names the contradicted premise and the aim it keeps or risks; `departure_justifiable` only when the table has a contradiction. This resolves al.3: the flag is right by construction in V9, V10 and V14 (once the deciding record is in) and absent in V8 and V11–V13; T2 (the verdict's accuracy) shrinks to the wording.
- **The claim is the package:** an integrating AI that carries the leader's intent and checks its premises, against a retrieval AI. The directive reaches both groups as before (the radio message at V8 and the on-screen line). Separating intent from integration is a later study (`30` §7).
- **Exposure** (§6.3's binding parameter): the content-free consult notification at 60 s in every view (both groups) and the suggested question "What has changed that matters for my plan?" in the guide group from V8 (`30` §4). Pushed AI content was considered and rejected (`30` §9): it would break §7.1.
- **Hypotheses.** H13 primary (C in V9, V10, V14, guide vs Haku); H14, H15 and H18 (plan-confidence calibration in the keyed views) one Holm family; H17 exploratory in the guide group: C and opening the cited record after a flag shown before the plan; **H16a/b withdrawn.** §5.2's reading of the sign stands.
- **Freezes in V10 and V14 run after the plan** (`26` (ax)), so no freeze item cues the no-fit plan; §4.3's cueing rule now covers freezes.
- **Keys.** A keyed view holds only with clear panel agreement (at least 4 of 5); the open domain questions of §7.1 and §7.3 e close before the pilot (`30` §8).
- **Power** is re-run for 50 / 50 and 40 / 40 (`30` §11); the (y) y.4 and (aa) aa.6 figures are superseded. **Treatment revision:** no pooling across 19 Oct 2026.

## Revision 19 Oct 2026 (ay) — Paper 2 after the skills review (`31`)

`31` §3.1–§3.4, §4 govern.

- **H13 codes the act (RC).** A plan attends the deciding front when its main effort attacks it directly or its secondary task on its sector(s) is direct attack, mop-up or hold-line; an attending plan codes C once the panel has rated the probe plans (V9-f, V10-f, V14-d) sound. The label-based cell is the sensitivity. One-line task definitions in the practice tour and the renamed "Linjan pito tiellä tai vesistöllä" reduce the ambiguity at its source.
- **V14 (RC).** Sound only through the secondary route (main effort aligned in Lahdenkylä's sector, the flare-up attacked as the secondary); a main effort on the 0.3 ha flare-up with the head ~550 m from R2 and residents in Lahdenkylä codes D — §7.4's first constraint now applied to V14. V14 stays a no-fit view (C is reachable), so H13 keeps three views. **§7.2's V14 row is stale:** the SE front's distance to R2 need not stay recorded (it is not V14's deciding quantity, the flare-up's size is); the pushed road-crew lines stay and the freeze item that leaked is redesigned (`08` (ay)).
- **Premises.** V14 P2 is not contradicted (as V13: the directive names no line and R2 is held); P1 is re-worded so a new fire or rekindle since the directive contradicts it (RC); `30` §3's "sparks over R2" are over the Honkaharju forest road. The flag still fires in V14 on P1.
- **V11.** Keyed by the panel with an explicit 20–40 min horizon and the whole record set after the flame-length table (`31` §3.11); **§7.2's V11 row** (6–8 m/min pushed) is stale against the corpus (DR2 4.5 m/min pushed at 18:05; the forecast recorded). **Fallback pre-registered:** a view keyed mixed or below 4-of-5 is reported, not coded; H14/H15 on the remaining fit views, H13 on the remaining no-fit views; `paper2-power.ts` gains the two-view case.
- **§7.3 e is superseded.** In the build, EK12, OUT1 and OUT2 hold R2 517–1 513 m from the SE front at steps 14–20 (`18` ad.2 `road_line`, ak); no scripted crew works the SE edge in V11–V14. The remaining domain question is the mirror one (coa F12): in the fit views the scripted crews already take the aligned posture on the keyed sector, so an A plan can be ratification — reported as a limitation, read against the base-rate group; no corpus or CA change.
- **§7.1 stands;** the briefing says that units' answers to the command post appear in the records; the domain reviewer judges the SPOT second-pass framing (radio DF-01) and "uusi rintama" → "uusi palo" (DF-02, fixed).
- **ab.3 corrected:** exposure was *not* measurable with `atomExposure` for the digest; the answer now carries the digest's and recent matches' ids, the browser logs them, and exposure is retrieved ∪ digest ∪ recent (`14` (ay), `07` (ay)).
- **Cueing (§4.3):** V12's freeze also runs after the plan; the V8 and V11 SPAM items and V13's U item stay and are stated in the pre-registration; the departure reason reads "Uusi tieto palosta"; V13's area list uses "Länsipuoli".
- **The panel keys from plan ratings** (rating sheets, blind to labels; `16` (ay)); fit is derived from the key as before. The panel is told CO is unknown and does not rate burnouts.
