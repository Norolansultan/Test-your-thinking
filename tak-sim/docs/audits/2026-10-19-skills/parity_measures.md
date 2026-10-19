# Parity and measurement audit (Phase 1b): tak-sim scenario export 3631cd43b2b9

Auditor: Phase-1b, read-only on the repository. Skills: `wildfire-scenario-pipeline` (`parity_check.py`, `standardisation.md`, `game_design.md`, `geoai_handoffs.md`) and `wildfire-sagat-probes` (`score_freezes.py`, `sagat_rules.md`). Governing design: SPEC/30, with SPEC/27 §7.1, SPEC/08 (ax) and SPEC/09 (ax). This report builds on the phase-1a audits `audits/sagat.md`, `audits/radio.md` and `audits/coa.md` and cites their finding IDs without repeating them.

**Inputs.** The worktree is clean at 3631cd4. I regenerated the package into scratch, and it is byte-identical to `dist/skills/scenario/` (every SHA-256 matches). Between 7394df8, the commit phase 1a audited, and 3631cd4, only `tools/skills/`, two tests and `package.json` changed, so the phase-1a findings apply unchanged.

**Session files.** `SKILLS_SESSIONS_DIR=<scratch> npx vitest run test/tools/skills-responses.spec.ts` passed (7/7). It wrote `session-P-SK1.jsonl` and `session-scripted.jsonl`. I converted them with `npm run skills:export -- --responses … --out <scratch>`, which gave 65 responses and 244 exposure rows.

**Scratch files.** Everything is under `/tmp/claude-0/-home-user/f4c97d84-cd2f-5439-9eeb-476ca5afe486/scratchpad/audits/parity/`. Two scripts compute the guide's digest and the repo's own measures; both import the repo read-only. Nothing was written to the repository.

## Summary
1. Between-group parity is clean, because both groups share one gate: H = pushed ∪ Haku and G = pushed ∪ Haku ∪ Thinker ∪ digest give 0 parity problems, also per phase under SPEC/08 (ax)'s 2/2/4 and 2/2/2 mixes; the raw 784 are the deliberate pushed-vs-recorded split (SPEC/27 §7.1).
2. The real asymmetry is what arrives without a search: the guide's per-step digest puts 137 recorded facts into the model's context on any Thinker question (including `evt.wx.03`, the key of H2's `wind_shift` and `ek14_shelter` and of V6.b; both F7 records; `rekindle.in_hand.log`), and the browser exposure fold `atomExposure` logs none of them.
3. H2's 24 items by key route: 7 pushed, 1 mixed (answerable from the pushed part), 2 recorded-only (both in the guide's digest), 14 no-fact L3 (4 of them on recorded bases by my mapping); pushed-key items can be marked "AI-stated" although the stream told everyone, which blurs H2t.
4. `score_freezes.py` reproduces `calibrationPairs` / `overconfidenceGap` exactly on like-for-like subsets (H2 gap .510, Brier .487), but its classes are unusable as they are: empty `fact_ids` make every wrong L3 answer EXPOSED_WRONG (11 of 13 in H2's window on P-SK1; 8 with basis facts), it pools practice, SPAM and hinge, and its map metric differs by about 0.25 %.
5. Standardisation: identical pushed stimulus and honest open-loop framing are met; the gaps are exposure logging, language-only stratification, an unpinned model build and no believability or recognition item; game mode is separated in code, not in knowledge (its "Summer afternoon" replays the 17:00 rekindle, the 15:30 de-energising of the 110 kV line that pre-answers F7, and the 17:40 recall).
6. Status: Gate A (fire) is open; B and D are blocked by coa F1–F3 and sagat F01/F02/F04; C passes for availability but not for exposure logging; not ready to pilot.

## Parity between groups

### Method
- **Channel files** (built by `build_channels.py` from the export; the H file goes in `parity_check.py`'s radio slot, G in its AI slot):
  - **H** (Haku group) = the 246 pushed messages + the 21 `haku.cNN` packages.
  - **G** (guide) = H + the 21 `thinker.cNN` packages + 21 digest packages.
- **The digest packages** were computed with the repo's own functions (`latestDigest(reachableAtoms(step), [], rosterForView(view))`, `server/thinker/model.ts`).
  - Retrieval is passed as empty, which gives the part of the digest that is in the model's context on *every* guide question in that step, whatever the question retrieved. A retrieved record is skipped from the digest only because the model already has it.
  - Steps run from W2 (exported as cycle 0) to 20.
- **A second pair separates "available" from "arrives without a search":**
  - **H_auto** = pushed only.
  - **G_auto** = pushed ∪ digest. The digest needs at least one Thinker question in that step; the consult notice at 60 s invites one in every view.
- **The level mix is checked per phase.** `--level-mix` applies one mix to every `freeze_id`, so the items are split: A = V2, V4, V5, V7 (32 items), B = V10, V12, V14 (18), and the rest = VP, SPAM and hinge (12).
- **Within-cycle timing was checked.** `orchestrator.deliverPushed` delivers every pushed record of a step at that step's start, and merged-view freezes fall at least 10 s after the boundary (`FREEZE_AFTER_BOUNDARY_S`). So cycle granularity is exact for freezes.

### Result

| Run | Facts delivered | Items | Problems |
|---|---|---|---|
| Raw export: pushed vs retrievable (reproduced) | 1007 | 62 | **784** = 763 `channel_missing` (761 recorded facts + `duty.v1`/`duty.v8`) + 21 `item_uses_unavailable_fact`. Deliberate (SPEC/27 §7.1) |
| **H vs G**, all items | 1007 | 62 | **0** |
| H vs G, phase A, `--level-mix L1=2,L2=2,L3=4` | 1007 | 32 | **0** |
| H vs G, phase B, `--level-mix L1=2,L2=2,L3=2` | 1007 | 18 | **0** |
| H vs G, VP + SPAM + hinge (no mix) | 1007 | 12 | **0** |
| **H_auto vs G_auto** (no search) | 383 | 62 | **158**: see below |

**Why H vs G is zero.** It holds by construction, and it is the right gate result. Haku and Thinker share one time gate (`reachableAtoms`, by step). Their packages are identical fact for fact (1005 facts each, with no timing differences). The digest is a subset of that gate. No fact is delivered before `cycle_true_from`. The planted F7 record is the only `is_ground_truth: false` fact, and it reaches both groups.

**The 158 problems in the no-search pair:**
- **137 `channel_missing`, all in G only.** These are recorded facts the guide's model receives without a search: 102 T2, 23 T3, 12 T4; 69 in phase A and 68 in phase B. The most frequent sources are the weather station (21), VPK (20), the water log (19) and the drone team (16). Phase-B entries such as the SPOT second passes (`atom.demo.12.1`, `atom.demo.19.3`) are deliberate, per SPEC/27 ab: "makes exposure differ by design … as part of the package".
- **21 `item_uses_unavailable_fact`.** These are the same 21 as in the raw run. Six of these dependencies, on five items, reach the guide's model automatically before the item:

| Item | Fact | In the G digest at step | H2? |
|---|---|---|---|
| `freeze.5.wind_shift` (L3) | `evt.wx.03` (15:00 forecast, SE turn), `evt.wx.02` | 6 (V4 after its boundary); `wx.02` 1–5 | **yes** |
| `freeze.5.ek14_shelter` (L3) | `evt.wx.03` | 6 | **yes** |
| `probe.s.cycle_6.b` (L3, H-T team side) | `evt.wx.03` (`evt.c08.013` not in the digest) | 6 | H-T |
| `freeze.12.f7` (L2, H9) | `f7.grid_record` ("line still live"); also `f7.planted_record` in the step-8 digest | 6–7; planted 8 | H9 |
| `freeze.12.longest_shift` (L1) | `evt.c17.035` (KY21 4.7 h; the digest also carries VPK 6.6 h, `evt.c17.042`) | 17 | – |

**Why this matters: the exposure fold cannot see the digest.**
- `atomExposure` (`app/telemetry/freeze-measures.ts:339–356`) folds bubbles, Haku results and chat answers' `retrieved` only.
- SPEC/14 (ah) line 731 says so: "do not count these records, as they do not count the digest".
- Yet SPEC/27 ab (line 798) states "Exposure remains measurable with `atomExposure`". For the guide group that is not true.
- The data exist. The Thinker server log carries `digest` and `recent` ids and `queryId` per answer (`handler.ts:228, 245, 371`), so the server log can be joined to the browser log.
- Affected measures: `exposure.csv`, `freezeItemExposure`, `plantedExposure` (H9's split), and any NOT_EXPOSED class. All of them undercount the guide's exposure.
- The "recent matches" block (up to 4 current-step records per chat request, both tools) is likewise unlogged in the browser. It is question-dependent, so it was not computed here.

### Items by key route
Key route is read from the exported `fact_ids`, which are the bank's `keyAtomIds`. P = pushed (everyone has it), R = recorded only (exposure depends on search), G-dig = in the guide's no-search digest by the item's cycle.

**H2's window (24 items: the L2/L3 items of V2, V4, V5, V7)**

| Item | Lvl | Key route | Key facts / basis (no-fact items: auditor's mapping from the bank's `basis` text, DRAFT) |
|---|---|---|---|
| 2.nearest_head | L2 | **PUSHED** | `atom.demo.3.0`, `atom.radio.3.0` |
| 2.fuel_ahead | L2 | **PUSHED** | `atom.demo.2.0` |
| 4.fastest_spread | L2 | MIXED | `atom.demo.6.0` P, `evt.c06.015` P, `evt.c06.017` R (answerable from the pushed pair) |
| 4.work_danger | L2 | **PUSHED** | `atom.demo.6.0`, `atom.radio.6.0`, `atom.radio.6.1` |
| 5.spot_cause | L2 | **PUSHED** | `atom.radio.7.1`, `7.2` |
| 5.units_enough | L2 | **PUSHED** | `atom.demo.7.0`, `atom.radio.7.1`, `7.2` |
| 7.lull_meaning | L2 | **PUSHED** | `atom.demo.10.0`, `evt.c10.004` |
| 7.why_north | L2 | **PUSHED** | `atom.radio.10.3`, `evt.c10.029` |
| 5.wind_shift | L3 | **RECORDED** (G-dig s6) | `evt.wx.03`, `evt.wx.02` |
| 5.ek14_shelter | L3 | **RECORDED** (G-dig s6) | `evt.wx.03`; the stem itself also states the forecast (sagat F07) |
| 2.area_40 | L3 | NONE; basis R | EK11 7.8 ha (P), DR3 13:55 10.3 ha and 14:15 12.9 ha (`evt.c02.029`, `evt.c03.036`: R, not in the digest) |
| 2.spruce_behaviour | L3 | NONE; basis P + knowledge | `atom.demo.2.0` (dense spruce ahead); the rest of the cited basis is future (sagat F09) |
| 2.junction_hour | L3 | NONE; basis map | reported perimeters on the map (identical for all) |
| 2.head_later | L3 | NONE; CA truth | map head + rates |
| 4.growth_next | L3 | NONE; basis P/map, defective | `evt.c04.033` (P); the step-6 perimeter is never drawn (sagat F01) |
| 4.crown_drops | L3 | NONE; basis P + knowledge | `atom.demo.6.0`; the Koivuoja map name |
| 4.korpioja_spot | L3 | NONE; basis P + knowledge | `atom.demo.6.0` (embers 200–400 m ahead) |
| 4.head_later | L3 | NONE; CA truth | map |
| 5.area_hour | L3 | NONE; basis P | `evt.c04.033`, `evt.c07.031` (DR3 17.8 / 56.6 ha) |
| 5.road_jump | L3 | NONE; basis P + knowledge | `atom.radio.7.1`, `7.2` (first crossing) |
| 7.rekindle_sector | L3 | NONE; basis **R** | `rekindle.objection` (VPK 16:21; R, not in the digest), `evt.wx.04` (R, G-dig s9). The counter-cue `rekindle.in_hand.log` ("L3 under control") is in the G digest at s10 |
| 7.cabins_reach | L3 | NONE; CA truth / map | – |
| 7.cp_safe | L3 | NONE; basis **R** | `evt.wx.04` (R, G-dig s9) + map |
| 7.relief_next | L3 | NONE; basis **R** | crew hours `evt.c09.022` (VPK 4.0 h, T3), `evt.c10.017` (EK12 3.7 h, T3), `evt.c10.012` (EK11 4.5 h, P). Older VPK/KY21 hour lines are in the G digest at s6/s8 |

**The other 38 items**
- **PUSHED (17):**
  - practice: `infra`, `first_target`, `head_now`;
  - main freezes: 2.`ek11_point`, 4.`ek12_where`, 7.`ky21_where`, 10.`infra`, 10.`south_front_point`, 14.`infra`, 14.`shift_change`, 14.`road_crossed`, 14.`shift_meaning`;
  - SPAM: practice, V3, V6, V8 and V11 first items (V8's `evt.c11.048` and V11's `atom.demo.14.0` are also in the digest).
- **MIXED (3):** 10.`ek12_water` (T4 part), 10.`cabins_distance` (T2 part), SPAM V3.b (DR3 14:15, R).
- **RECORDED (8):**
  - the infra items 2/4/5/7 (T2, none in the digest);
  - 12.`longest_shift` (T3, partly G-dig);
  - 12.`f7` (G-dig: grid record and planted record);
  - 12.`front_toward` (`atom.demo.17.1`, R);
  - SPAM V6.b (G-dig `wx.03`).
- **NONE (10):** practice `r1_arrival`; 5.`head_now` and 12.`head_now` (L1 map items with empty `fact_ids`); 10.`area_total_hour`; 10.`front_r2_2h`; 12.`village_distance`; 12.`head_later`; 14.`se_front_r2`; 14.`head_later`; the hinge check (its key is `duty.v8`, pushed to all, so effectively PUSHED).

### H2 window: the "told / not exposed" risk for Paper 1
- **Told by the stream: 8 items (7 pushed + `fastest_spread`).**
  - Everyone has the key in the message log, and exposure is equal by design. They act as recall items; sagat F10 already re-reads 6 of them as L1.
  - New risk for H2t: `aiStatedKey` (`ai-stated-key.ts:97–125`) counts any Haku or Thinker answer that restates the key. A pushed-key item restated by the AI is then classed "borrowed", although the participant had it from the stream.
  - Pre-register a three-way split: stream-told (key pushed), AI-told only (key recorded or computed, and stated by an answer), and neither. Run H2t's contrast on the last two, or report the stream-told stratum separately.
- **Exposure that depends on search and on group: 2 keyed items + 4 basis items.**
  - Keyed: `wind_shift`, `ek14_shelter`. Basis: `area_40`, `rekindle_sector`, `cp_safe`, `relief_next`.
  - In H, exposure needs a search. In G, the digest supplies `wx.03` (after V4's boundary), `wx.04` (V6, step 9) and the in-hand log (V7) on any question, but never DR3's 13:55/14:15 surveys or VPK's objection.
  - Because the digest is unlogged, exposure-conditioned readings will **overcount NOT_EXPOSED in the guide group** for exactly these items, and H9's `plantedExposure` will misplace guide participants (the digest carries the grid record at steps 6–7 and the planted record at step 8).
- **Computed L3 with no record route: 8 items.** These are `junction_hour`, both `head_later`, `growth_next`, `cabins_reach`, and the knowledge-based `spruce_behaviour`, `crown_drops`, `korpioja_spot`. (`road_jump` and `area_hour` have pushed bases.)
  - The only "told" route is an AI stating the projection, and the guide is designed to state projections.
  - `aiStatedKey` reads answer text, so it is the right detector. Its pattern risks are sagat F16.
  - Two of these items are map items. `h2tSplit` counts them as not stated unless `dropUnscreenable`, so pre-register that sensitivity.
- **Net.** H2 (all 24 items, ITT) is not biased by any of this. H2t, H1-by-exposure, H9's split and Paper 3's exposure features are biased unless the digest and recent ids are folded in from the server log.

## Scoring and calibration

**Runs.**
- P-SK1 is the driven Haku-group session from the test (header condition `directed`; rotating options, every map answer at the ignition point, confidence cycling 25–100). It is not behavioural data.
- The scripted session has 3 rows. One of them (`freeze.2.1`) is not in the bank, and `score_freezes.py` drops it silently (`if not it: continue`).
- There is no guide-group session: the helpers drive the Haku group only, and no live model is available.

| Subset (P-SK1) | `score_freezes.py`: conf / acc / gap / Brier | Repo (`calibrationPairs`, `overconfidenceGap`): conf / acc / gap / Brier |
|---|---|---|
| Whole exported bank (62 rows) | .586 / .177 / .406 / .380 | n/a: this mixes practice, SPAM and hinge (hinge has no confidence) |
| **H2 window (24)** | **.677 / .167 / .510 / .487** | **67.7 / .1667 / .5104 / .4870** |
| Phase A freezes (32) | .625 / .188 / .438 / .469 | 62.5 / .1875 / .4375 / .4688 |
| Main freezes (50) | .595 / .160 / .435 / .401 | 59.5 / .160 / .435 / .4013 |
| By level, main | L1 .143, L2 .143, L3 .182 | L1 .143, L2 .143, L3 .182 |

- **The formulas agree exactly.** For H2 the skill script's numbers match `calibrationPairs` once its items file is restricted to the window.
- **`aiStatedKey`** gives 36 rows and 0 stated, because the session has no AI answers. H2t's not-stated gap therefore equals H2's (.510). I could not compare it to anything in the skill, which has no told class.
- **Exposure classes agree** on all 28 items that have key atoms (repo `freezeItemExposure.allReached` vs the skill's `first_seen_cycle ≤ cycle`). That holds in this session; mid-view divergence is sagat (c).

**Disagreements found.**
1. **Map distance metric.** The repo scores with spherical haversine on WGS84. The skill uses Euclidean EPSG:3067. The skill's distances are 0.24–0.26 % larger on all 8 map items (for example 1252.1 vs 1255.2 m). An answer within about 0.75 m outside the 300 m ring (0.5 m at 200 m) scores correct in the repo and wrong in the skill. No score flipped here. Pre-register the repo's metric.
2. **Pooling.** The skill scores freezes, SPAM, the hinge check and practice items together. The skill's own rule says to report SAGAT and SPAM separately, and DATA_SOURCES says to drop practice items. It must be fed per-subset item files (as here: `items_h2/main/phaseA/spam_main.json`).
3. **No AI-told class, and blind to the digest.** See the parity section.

**The L3 problem.**
- The skill computes `ok = all(... for fid in it.get("fact_ids", []))`. For an item with no `fact_ids`, `all([])` is `True`, so every wrong answer becomes EXPOSED_WRONG, read as a "mental-model error".
- 22 of the 50 main-freeze items have empty `fact_ids`: 20 L3 items plus the L1 map items 5.`head_now` and 12.`head_now`.
- On P-SK1, 16 of 18 wrong main-bank L3 answers were EXPOSED_WRONG. In H2's window it was 11 of 13; the other two (`wind_shift`, `ek14_shelter`) are NOT_EXPOSED because `wx.03` was never searched.

**Proposed treatment.** I demonstrated it in `score_freezes_basis.py` and `items_h2_basis.json` in scratch.
- **(a) A separate basis field.**
  - Keep `fact_ids` for the key and add `basis_fact_ids` + `basis_kind` ∈ {record, map, knowledge, ca_truth} per L3 item. These are the delivered records a fair projection rests on, panel-confirmed and taken from each bank `basis` string.
  - Report-keyed items take their survey records; forecast items take `evt.wx.*`.
  - `map` counts as exposed for everyone, since the map is an identical stimulus.
  - `knowledge` / `ca_truth` items with no record get **NOT_APPLICABLE**: scored, but never given an exposure class.
  - On P-SK1's H2 window this moves L3 from 11 EXPOSED_WRONG / 2 NOT_EXPOSED to 8 / 5. `area_40`, `rekindle_sector` and `cp_safe` become NOT_EXPOSED.
- **(b) Fold the server log's `digest` and `recent` ids into exposure** as a `model_context` route, joined on `queryId`.
- **(c) Add STATED_WRONG and STATED_LURE from `aiStatedKey`** (sagat proposal c), plus the stream-told stratum above.
- **(d) Patch the script itself** (skill owner): `ok = bool(fids) and all(...)`, else NOT_APPLICABLE; and a `--probe` / `--drop-practice` filter.

**Recommendation.**
- **Use the error-class *taxonomy* for the pilot as a descriptive layer** (CORRECT / NOT_EXPOSED / EXPOSED_WRONG / NOT_APPLICABLE / STATED_*). Compute it in the repo (`freeze-measures.ts`: seq-anchored, route-aware, with the digest folded in).
- **Run `score_freezes.py` only as the independent cross-check**, on per-subset files, with `basis_fact_ids` exported.
- **Do not adopt its classes as they stand.** As they stand they would report most H2 L3 errors as mental-model errors, and would undercount the guide's exposure.
- **Calibration.** Either tool reproduces H2; the repo's `overconfidenceGap` stays primary, as pre-registered. Add the skill's Brier score as a descriptive extra if wanted.

## Standardisation

| Requirement (`standardisation.md` / `game_design.md`) | SPEC/30 design and build | Verdict | Risk / action |
|---|---|---|---|
| Identical stimulus: fire, events, messages, map | Scripted CA, open loop; one pushed stream for both groups (parity 0); same envelope on the map (SPEC/02 (o)); the camera never moves (`12` aj) | Met | – |
| AI content fixed per package; temperature 0; fixed model; prompt hash; "same facts regardless of phrasing" | Live LLM at temperature 0; prompts hashed in the manifest; `THINKER_EXPECTED_MODEL_VERSION` exists. The guide's facts depend on the question plus a G-only digest; build drift has been observed (§10) | Partly; deliberate for the treatment | Pin the build before the pilot (SPEC/30 §8). Describe the digest as part of the guide package in the methods text. Log it as exposure |
| AI projection accuracy schedule | The map envelope's errors are scheduled and identical across groups. The Thinker's own projections are unscheduled (live) | Partly; deliberate | Keep it; code the Thinker's projections from logs post hoc |
| Open loop with honest role framing | `briefing.ts` ROLE_TEXT: "the situation runs as recorded … the units do not receive your records" | Met | – |
| Believability and "reminded you of a real fire?" items (§3.5; the pipeline's recognition reminder) | Questionnaire has `felt.wrong` and a generic `prior.knowledge`; no believability item and no recognition item | **Not met** | Add both post-session items. Add "recognised Kalajoki" to the exclusion list (09 §6.2 has prior knowledge, not recognition) |
| Fixed timing, never participant-paced | View minimum 120/130 s, cap 150 s, ends at the later of the minimum and the participant's confirmation (up to 30 s of self-paced exposure); freezes pre-planned; V10/V14 after the plan; consult notice at 60 s | Mostly | Pre-register time-in-view as a covariate (it also drives search counts). Notice/freeze collision is sagat F23 |
| Same modality in both channels | Text everywhere | Met | – |
| Exposure logging (`participant,fact_id,first_seen_cycle`) | Bubbles, Haku results and chat `retrieved` are logged; the digest (G only) and recent matches (both groups) are not; the server log has them, with `queryId` | **Gap** | Join the server log into `atomExposure`, `plantedExposure` and `exposure.csv`. Fix SPEC/27 ab's "measurable with `atomExposure`" |
| Stratified randomisation on wildfire experience | Permuted blocks stratified by language only (SPEC/30 §2); experience is collected post-session (`role.rank`, `incidents.commanded`); 09 (ax)'s H2 covariates are (an)'s posture baseline | **Gap** (n = 50 per arm) | Stratify on `incidents.commanded` (collected before assignment), or pre-register experience as an H2 covariate and an imbalance check |
| Counterbalancing of error/fit order | One scenario version; the fit/time confound is acknowledged (27 §7.4); the decided late no-fit view is unverified in this build | Open | Confirm the late no-fit view is in the corpus; otherwise pre-register the order confound |
| Pre-registration list | Present: allocation seed and `rowsSha256`; model pin rule and period term; missing ≠ wrong; exclusion rules (09 §6.2); Paper 3 features | Partly | Add: scenario version (package hash at the locked commit); SAGAT tolerances and report-vs-truth keys (sagat conflict 2); the projection error schedule; fire-validation status (provisional, Gate A); panel procedure (≥ 4/5); exposure definition (retrieved ∪ digest ∪ recent, with a sensitivity analysis); the three-way told split; the map distance metric |
| Game mode (SPEC/29) vs `game_design.md` | Points, grades, win/lose and outcome feedback: all on the "avoid during the session" list. Code separation is good: never loaded under `?tuotanto`, no data pooled. The sole knowledge control is "participants never see it" (SPEC/30 §8, a researcher task); no questionnaire item asks about it | **Not enough** | See below |

**Game-mode separation: the specific risk.** SPEC/29 §2.3 says the game's scenarios "do not replay the study's incident minute by minute". `app/game/scenarios/summer-afternoon.ts` nevertheless replays several keyed events:
- "the rekindle at the origin's old edge at 17:00 (SPOT reports it)" with a radio at 17:01. This is the study's V9 no-fit event and H10's `rekindle_sector` key.
- "The 110 kV line stays live until 15:30". This tells a player that the planted F7 record ("de-energised, confirmed", 15:46) is true, which pushes H9 toward the wrong value.
- "the region takes units back at 17:40".
- `evening-wind.ts` adds the Lahdenkylä evacuation with "two households refuse to leave" and the 19:00 north-westerly at Lahdenkylä (V12–V14 L3 keys).

It also uses the same call signs (EK11…OUT2) and the same terrain.

A professional who has played it holds L3 foreknowledge for H2 and H10, a wrong prior for H9, and phase-B anticipation for H13. With recruitment running over months in a small community, and a public repository and demo, "never shown before a session" is a hope, not a control. Recommended, before recruitment:
- (a) gate or withdraw the public demonstration start page while recruitment runs;
- (b) move or replace the game's 17:00 rekindle, 15:30 line switch, 17:40 recall and the refusing households, or use other terrain (SPEC/29 §5.2);
- (c) add a post-session item, "Had you used the web demonstration or the game mode before today?", with a pre-registered exclusion and sensitivity rule;
- (d) offer the game only as an after-action debrief once recruitment has closed. `game_design.md` endorses this kind of after-action review "after all measures".

## Scenario status – 3631cd43b2b9

Open gate: **A** (fire not validated). B and D are also blocked. C passes for availability between groups and is open for exposure logging. Not ready to pilot.

| Area | Status | Blocking issue | Skill / action |
|---|---|---|---|
| Data contract (EPSG:3067, IDs, versions) | OK | Atom ids are kept instead of F###, which is documented. All data are synthetic; there is no MML DEM, FBP grid or risk maps | `geo-data-engineering`: none needed for synthetic data |
| Fire (Gate A) | **Open** | CA forced to authored rates; no flame length, ISI or smoke field; no Prometheus or `perimeter_compare`; OGC-invalid multipolygons from step 12 (DATA_SOURCES) | `wildfire-fire-behaviour-check` (envelope only). The researcher explicitly accepts the fire as PROVISIONAL in the pre-registration |
| Tactics | Open | Every placement fails LACES because the LACES fields are null (DATA_SOURCES); crews ~10–15 m from the SE front in V11–V14 (27 §7.3 e) | `wildfire-tactical-check`; domain reviewer |
| Options (Gate B) | **Blocked** | coa F1 (C vs B hangs on a label), F2 (V14 main effort on 0.3 ha), F3 (V14 P2 premise flag); no panel ratings yet | `wildfire-coa-authoring`; expert panel |
| Channels / radio (Gate C content) | Should-fix | radio CS-01 (real EK/KY codes), DF-03 (V14 R2 distance pushed) | `wildfire-radio-realism`; Pelastusopisto VERIFY list |
| Parity between groups (Gate C) | **0 problems** (availability) | Exposure logging misses the G-only digest (137 facts) and the recent matches in both groups | Fold the server-log `digest`/`recent` into exposure |
| Items (Gate D) | **Blocked** | sagat F01 (`growth_next`), F02 (`se_front_r2` recall), F04 (V6.b unreachable key) | `wildfire-sagat-probes`; domain reviewer |
| Scoring / exposure classes | Not ready | Vacuous L3 class; no basis ids; no told class; map metric differs by about 0.25 % | Add `basis_fact_ids` and the repo fold; the skill script as cross-check |
| Map | Not reviewed | – | `cartography-geoviz` before the pilot |
| Standardisation | Partly | Exposure logging; stratification; model pin; believability and recognition items | See the table above |
| Game mode | Not enough | Keyed events replayed in a public demo | Gate the demo, change the event timeline, add an item |

Parity check:
- **0 problems** for H (pushed ∪ Haku) vs G (pushed ∪ Haku ∪ Thinker ∪ digest), on all items and per phase with the 2/2/4 and 2/2/2 mixes.
- For reference, the raw pushed-vs-retrievable run gives 784 (by design).
- The no-search pair gives 158: 137 G-only digest facts, and 21 item dependencies of which 5 reach G automatically (`wind_shift`, `ek14_shelter`, V6.b, `f7`, `longest_shift`).

Standardisation risks:
- **Exposure undercount in the guide group.** The digest is not logged in the browser; it biases H2t, H9's split and Paper 3 features.
- **Told-by-stream items** (8 of H2's 24) are counted as "AI-stated" when an answer repeats them.
- **Game mode** pre-teaches the 17:00 rekindle, the F7 line status and the evening run at Lahdenkylä.
- **Randomisation** is not stratified on experience at n = 50 per arm.
- **The model build** is not yet pinned (observed drift, SPEC/30 §10).
- **No believability or recognition item**, and no recognition exclusion.
- **Up to 30 s of self-paced view time.**

Next three actions:
1. **Close the content blockers in one domain-review packet before Gate D.** Gate B: coa F1–F3. Gate D: sagat F01, F02, F04. In the same packet, have the researcher record the fire as PROVISIONAL (Gate A) and run `wildfire-fire-behaviour-check` on `cycles.json`.
2. **Fix exposure measurement before pilot 2.**
   - Join the Thinker server log's `digest`/`recent` into `atomExposure`, `plantedExposure` and `exposure.csv`.
   - Export `basis_fact_ids` and `basis_kind` per item, and implement the five-class fold plus NOT_APPLICABLE in `freeze-measures.ts`.
   - Pre-register the three-way told split for H2t and the exposure definition.
   - Run `score_freezes.py` per subset as the cross-check.
3. **Before recruitment, close the standardisation gaps.**
   - Pin the model build.
   - Gate the demo and game, and de-duplicate the game's event timeline.
   - Add the believability, recognition and prior-demo items with their exclusion rules.
   - Stratify on, or pre-register, command experience.

## Not checked
- **No guide-group session and no live model.** The vitest helpers drive the Haku group only, and no Thinker API key was available. `aiStatedKey`, H2t and real Thinker exposure could not be measured. The digest effect is derived from the code, not observed.
- **The digest is the guaranteed subset only.** I computed it with retrieval passed as empty. Real requests add more records once retrieval removes some, and the recent-match block (question-dependent, both tools) was not computed.
- **The `basis_fact_ids` mapping is DRAFT.** It is my reading of each bank `basis` string, not panel-confirmed. The P-SK1 numbers come from a synthetic answer pattern and only illustrate the class shift.
- **Not run:** the full vitest suite, the typecheck and the app. The UI was not viewed, including how the consult notice or the freezes look.
- **Not opened:** the Thinker server logs and the analysis models in SPEC/09 beyond (an) and (ax).
- **Game mode:** I read the scenario headers and event lists only. Whether the demonstration start page is actually deployed publicly was not verified.
- **Map review (`cartography-geoviz`), fire realism and Finnish wording** are out of scope here.
