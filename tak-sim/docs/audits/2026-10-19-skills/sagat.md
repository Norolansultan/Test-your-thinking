# SA probe audit: tak-sim at 7394df8, checked against `wildfire-sagat-probes`

Scope: VP practice freeze (4 items), the V2/V4/V5/V7 freezes (8 items each), the V10/V12/V14 freezes (6 each), SPAM V3/V6/V8/V11 with the V3.b/V6.b second items, the hinge check, the V13/V14 visible probes and the 7 source-memory facts. The items were read from the built content: `buildFreezes()`, `buildPracticeFreeze()`, `SPAM_ITEMS`, `SPAM_SECOND_ITEMS` and `buildHingeCheck()`, with the English from `labels.en.json`. Keys were recomputed with `freeze-keys.ts` against `site-scenario.json`. Records were dumped per step, with tier, time and pushed/recorded status. All scripts ran from the scratchpad. Nothing in the repository was changed, and no tests were run.

## Summary
1. The structure matches the SPEC. The level mix is exactly as SPEC/08 (ax) sets it (phase A 2/2/4, phase B 2/2/2, VP 4). The correct-option position is balanced per level. The 1.3× option-length rule holds in both languages. No item names a tool, and no Kalajoki names appear.
2. Three blocking defects:
   - **F01, V4 `growth_next`:** the key's report basis is never shown in that merged view, and the key contradicts the study's own crown-fire keys. CA truth falls in another band.
   - **F02, V14 `se_front_r2`:** answerable by recall. The freeze now comes at view end, and pushed records give 550–600 m, inside the key band.
   - **F04, SPAM V6.b:** the key rests on later records that cannot be reached when the item is asked. H-T's team side has only 2 items.
3. The should-fix items cluster in these areas:
   - Cueing between items: V5 `wind_shift` → `ek14_shelter`, which also reveals the recorded-only forecast. V7 cues H10 several times.
   - Four new L3 items give no time horizon.
   - 6 of the 8 phase-A L2 items are answered by recalling one record.
   - 9 items show ordinal bands in scrambled order.
   - The 180 s freeze cap is tight for 8 items, and the L3 items come last.
   - `aiStatedKey` can flag a key as stated when it was not, and has no class for an AI stating a lure.
   - Source memory has no lure facts.
   - Some key bases and SPEC/08 tables are stale.
4. Goal coverage leans heavily to containment: 24 of 50 items, and 15 of the 24 in H2's window. No values items appear in V2, V4, V5 or V14. No freeze item covers crew contact or comms, information flow, recon assets or the current wind.
5. Proposals:
   - (a) No Agent-SA items inside the session. Treat F7, `rekindle_sector` and the V14 backup as the existing verification items and add measures from the logs.
   - (b) No QASA block in the professional study. Use a lure-acceptance index from items already in the bank, or run QASA in the student sample.
   - (c) Keep the repo's own measures and add an error-class fold with `basisAtomIds` and a stated-lure class. Use `score_freezes.py` only as a pilot cross-check.

## Findings

| ID | Severity | Where | Finding | Evidence (skill rule or source key) | Proposed fix | Domain reviewer? |
|---|---|---|---|---|---|---|
| F01 | blocking | `freeze.4.growth_next`, freeze-bank.ts:199, key `V4_GROWTH` :72 | The report-keyed key is 5–15 ha (9.5 ha). It extrapolates the reported perimeters at the starts of steps 5 and 6 (23.4 → 32.9 ha).<br>V4 is a merged view and its map draws only step 5's fire (`viewMap` in demo-map.ts; `toRenderableCycle` keeps the view's fire). Step 6's reported area is never shown to anyone, and no area survey falls in steps 5–6.<br>What the participant does have by the freeze: the last survey (DR3 14:35, 17.8 ha, 4.8 ha new); crown fire at intensity 5/5; head rate 7.1 → 10.6 → 14.1 m/min (DR1/DR3 15:05); V3.b SPAM keyed "growth sped up ~2×"; V2 `spruce_behaviour` keyed "climbs into crowns, embers ahead".<br>CA truth is 23.5 ha (band 15–30). A participant who puts together facts the study itself keys as correct answers 15–30 and is scored wrong on an H2 item. | Skill: the correct answer comes from ground truth. SPEC/08 ab.2 keys on "the reports delivered by the freeze", but here the basis was never delivered. Recomputed: `reportedGrowthHa(6)` = 9.5, `growthHa(6)` = 23.5. | Re-key on what was actually delivered (surveys and rates), pre-register a dual key (report band or truth band), or replace the item with one whose report and truth bands agree. Add a test that every report-keyed basis step is drawn in the view. | yes |
| F02 | blocking | `freeze.14.se_front_r2`, freeze-bank-b.ts:221, `V14_R2` :108 | The item can be answered by recall. Since SPEC/30 §5.1 the freeze runs after all step-20 records have arrived. The pushed records: EK11 19:43 "palo 600 m länteen"; KY21 19:52 "Palo noin 550 m päässä"; KY21 19:55 "rintama ei tullut tien lähelle ennen yövuoroa". The recorded DR2 19:47 report gives "palo noin 560 m tiestä". The key band is 450–650.<br>The basis text is stale: it says 546 m with a 96 m margin; recomputed it is 517 m with 67 m. CA truth is 448 m, in band 150–450, 2 m from the edge. | SPEC/08 (ax): "no recall-answerable key". I replicated the logic of the repo's own guard (test/scenario/freeze-bank.spec.ts:212, `se_front_r2` value regex) on `buildDemoScenario()`: it finds 3 hits. Check whether that test passes at 7394df8. | Ask at a horizon no record names (≥ 40–60 min ahead, re-banded), or replace with a consequence item (for example, which line or water route is cut first). Regenerate the basis text. | no |
| F03 | should-fix | `freeze.14.head_later`, freeze-bank-b.ts:215; `freeze.2.head_later` :170 | In V14 the key is 168 m from the head at "now" (19:40), and KY21's pushed 19:52 report places the head. With a 300 m tolerance, tapping where the head is now scores as correct, so the item does not measure L3. In V2 the key is 352 m from the now-head, barely above the tolerance. | Skill: L3 means the future state at the horizon. The repo test only measures distance from the head the map draws (the first step's). | Require the key to lie ≥ 2× tolerance from the head at now (add a test), or lengthen the horizon. | no |
| F04 | blocking | SPAM V6.b, demo-probes.ts:413–424, key atoms :454–460 | The L3 key "Ei turvallinen ajaa" comes from later DR3 road reports (16:26 with low reliability, 16:47). They cannot be reached when the item is asked (25 s into V6, step 8). What can be reached supports the lure as much as the key: evt.wx.03 says the wind backs SE and weakens to 4–5 m/s, and DR2 15:47 reports "ajettavissa varoen". The key atoms even list the lure record.<br>H-T's team accuracy rests on two items (V3.b, V6.b), so half of it rests on this one. | SPEC/30 §5.2: the key "rests on a record the participant can reach". Skill: the key is fixed ground truth from information the participant has had. | Re-author it as an L2 or L3 item whose key follows from reachable records (for example, two road reports that integrate), or key it by an explicit rule as the freeze L3s are. Have R1's projection reviewed. | yes |
| F05 | should-fix | H-T, teaming-measures.ts (`handOverIndex`); SPEC/30 §6 | Team accuracy comes from 2 items, so each person scores 0, 0.5 or 1. Own accuracy comes from 24 different items. The difference mixes item difficulty with the construct difference (online with tools against blanked memory). | Skill: report SAGAT and SPAM separately and analyse by item. | Model it as an item-level mixed logistic model (measure × group, with item random effects). Add at least 4 SPAM L2/L3 items, or write SPAM items parallel to freeze items. | no |
| F06 | should-fix | `freeze.7.lull_meaning`, freeze-bank.ts:304 | The distractor "Palo kiihtyy uudella reunalla tuulen kääntyessä" is supported by records available at V7: evt.wx.04 (16:01, recorded) says the front comes ~17:00 with the wind turning S, then WNW; VPK's recorded objection says "Jos tuuli kääntyy, se voi syttyä uudelleen". It is also what happens at 17:00. That gives an H2 item two defensible answers, and the distractor cues `rekindle_sector` later in the same freeze. | Skill: distractors are plausible but wrong states of the same element. | Replace it with a clearly false state, for example "Palo on sammumassa, jälkisammutus riittää". | yes |
| F07 | should-fix | V5: `wind_shift` :255 → `ek14_shelter` :271 | Cueing inside the freeze:<br>- `wind_shift`'s stem gives the turn ("jos tuuli alkaa puhaltaa etelästä"), and its key (the north edge) answers `ek14_shelter`.<br>- `ek14_shelter`'s stem, "kun tuuli kääntyy ennusteen mukaan", tells every participant about the recorded-only forecast (evt.wx.03, T2) one view before V6.<br>- V6's designed machine error is the stale south-westerly projection, so this weakens it.<br>- It also pre-exposes the source-memory fact `wind_forecast_se`. | Skill: no item may reveal another item's answer or information not yet given. | Move `ek14_shelter` to V4 without "ennusteen mukaan", or drop the phrase and put it before `wind_shift`. Swap the source-memory fact. | no |
| F08 | should-fix | `spruce_behaviour` :154, `crown_drops` :206, `korpioja_spot` :216, `relief_next` :345 | Four of the eight new L3 items give no time horizon relative to "now". Some are conditional on an event; others have no horizon at all. | Skill: L3 states the horizon. SPEC/08 y.2. | Add "seuraavan 20 minuutin / tunnin aikana" to match `keySteps`. | no |
| F09 | should-fix | `spruce_behaviour` :154, `crown_drops` :206 | Both can be answered with general fire knowledge.<br>- `spruce_behaviour`: the stem supplies the premise (the head reaches the dense spruce), and the key is textbook behaviour. Only a novice would pick the distractors.<br>- `crown_drops`: the key is the only option that names a fuel change, and "Koivuoja" / "Birch Creek" literally names birch.<br>Expect a ceiling with professionals and little situation-specific information for H2. | Skill: queries come from SA requirements; avoid floor and ceiling (DEW). | Ask situation-specific consequences (time to reach, which crew or line is affected), or make every option fuel-based and plausible. | yes |
| F10 | should-fix | Phase-A L2: `nearest_head` :134, `fuel_ahead` :140, `work_danger` :188, `spot_cause` :237, `units_enough` :246, `why_north` :313 | Each key paraphrases one pushed record: EK11 on the ridge; DR1 "tiheä kuusikko"; EK12 "Latvapalo alkanut… kipinöintiä"; KY21 "Kipinät lensivät…"; EK11 "Pyydetään lisäyksiköitä"; KY21 "Karhujärven mökit uhattuna". That makes them L1 recall in Endsley's sense: 6 of the 8 L2 items in H2's window. | Skill: the levels must be distinguishable for the analysis (Paper 3). L2 is comprehension relative to goals. | Re-tag them as L1 and replace them with items that integrate two records or relate one to a goal. At minimum, pre-register an H2 sensitivity analysis without them. | no |
| F11 | should-fix | `arrangeOptions`, freeze-bank-core.ts:127; VP `r1_arrival`, V2 `junction_hour`, V4 `growth_next`, V5 `area_hour`, V10 `area_total_hour`/`front_r2_2h`/`cabins_distance`, V12 `village_distance`, V14 `se_front_r2` | Ordinal bands are shown in shuffled order, for example V4 "5–15 \| 15–30 \| Alle 5 \| Yli 30". That adds reading errors unrelated to SA on H2's numeric items. SPAM V3 already uses an ascending `scale`. | Skill: explicit answer format; check the pilot for construct-irrelevant difficulty. | Show bands in ascending order and leave band items out of the position balance. | no |
| F12 | should-fix | `FREEZE_MAX_SECONDS` 180, views.ts:59; `byLevel` and `mapItemsLast` | Phase-A freezes now hold 8 items. SPEC/15 (ax) budgets ≈ 19 s per item, so about 150 s median plus the map items. Items are ordered L1 → L2 → L3, then map items, so a timeout drops H2's L3 items first and drops more of them for slow readers. | Skill: keep freezes short. SPEC/15 ad.1 cap. | Raise the cap to about 240 s for 8-item freezes, or randomise the order within L2/L3 (Endsley). In the pilot, report timeouts by item position. | no |
| F13 | should-fix | Freeze header, ui.ts:469; orchestrator `deliverPushed` | The L3 prompts say "X minuutin kuluttua", with now taken as the start of the step (SPEC/08 y.1). But all of a step's pushed records arrive when the step starts, so the log already holds records stamped up to now + 19 min. The freeze header shows no clock. The problem is worst at V10 and V14, which freeze at view end. | Skill: L3 states the horizon relative to "now". | Header: "Kello pysähtyi klo 15.20. 'Nyt' tarkoittaa tätä hetkeä." This leaves y.2's no-clock rule for prompts intact. | no |
| F14 | should-fix | `freeze.14.road_crossed`, freeze-bank-b.ts:192 | The key, "Tie ei enää pysäytä palon kärkeä", restates the stem's premise ("palon eteneminen … tien yli"). Two of the distractors contradict the stem or are implausible. | SPEC/08 §8.3: no probe may be answerable from its text alone. | Ask about a consequence the stem does not contain (the next barrier, or which crew's line is now exposed). | no |
| F15 | should-fix | `road_jump` :281, `cp_safe` :335, `cabins_reach` :327 | Structural tell: in each, the key is the only negative option among three "Kyllä/Yes" options. `cabins_reach` also has two near-duplicate yes options and an implausible "already". | Skill: plausible distractors of the same element; avoid answer tells. | Write two options per polarity, each with a different reason. | no |
| F16 | should-fix | `aiStatedKey`, ai-stated-key.ts:108; freeze-key-statements.ts :98, :142, :154, :193 | Answers from any earlier view count, from V1 on. Several patterns are generic:<br>- `lull_meaning`: "ei (ole) vielä hallinnassa" / "palo ei ole ohi".<br>- `cabins_reach`: "ei tunnin aikana".<br>- `shift_meaning`: "linjat pysyvät" / "no gap".<br>- `road_jump` (EN): "cross…again".<br>- `fuel_ahead`: "kuusik\w*" matches the place reference.<br>The result is inflated "stated" rates.<br>Band items detect only numbers inside the key band. An AI that states the lure (the map-now 950 m, DR2's "runsaan kilometrin", DR3's 125.9 ha) leaves the item "not stated", so H2t's "own" set contains AI-anchored lure errors. | SPEC/30 §5.3 and H2t's interpretation ("illusion of understanding"). | Count only answers after the basis record and in the freeze's view (or the one before). Tie generic patterns to the element. Add a `statedLure` class (statements of distractors) and report it in H2t. | no |
| F17 | should-fix | source-memory.ts:55–110 | Three problems:<br>- All 7 facts are true, with no lures, so recognition cannot be separated from acquiescence.<br>- The options overlap: Haku returns reports, and "report / log / map" sits beside "Haku". This is the reason given for withdrawing the in-freeze source question (SPEC/08, 2 Oct).<br>- Two of the three "ai_likely" facts (`head_rate_1420`, DR1 14:25 T1; `area_1535`, DR3 15:35 T1) were pushed to everyone, so misattribution of AI-supplied facts cannot be identified. Only `wind_forecast_se` is pull-only, and F07 pre-exposes it. | Skill: no item may reveal information. SPEC/30 §5.5's aim (misattribution). | Add 2 false lure facts. Define the scoring for overlapping sources. Pick ai_likely facts that are recorded-only (T2/T3) and cued by no probe. | yes (wording) |
| F18 | should-fix | R1 element: demo-probes.ts:114 (V2/V5 infra), V6.b | At steps 7–9, R1 has stretches in different states at the same time. The DR reports describe "Kuivakankaan eteläpuolella"; lateral traffic says "tie R1 itään — palo 200 m, savua tiellä, raskaat autot kiertäkää". The stem names no stretch. The V2 and V5 keys rest only on recorded (T2) DR reports. | Skill: one element per item. | Name the stretch in all three items, and flag them as retrieval-dependent in the exposure analysis. | yes |
| F19 | should-fix | `relief_next`, freeze-bank.ts:345 | The key is VPK: 4.0 h at 16:17 (T3, asked-only) against EK12's 3.7 h at 16:28, a 0.3 h margin. EK12 has just had a crown-fire near miss. VPK's own relief request arrives only in V8. An EK12 answer is defensible but scored wrong. | Skill: correct keys against what was available at the freeze. | Widen the margin in the corpus, or key on a record that is explicit and pushed. | yes |
| F20 | should-fix | SPAM V6 (first item), demo-probes.ts:328ff | The record says "EK11 joutui vetäytymään, ei ehditty estää". The distractor "EK11 on vetäytynyt tielle, linja on jätetty" differs from it only by "tielle", while the key's wording ("linja on murtunut") is not in the record at all. | Skill: plausible distractors that are clearly wrong. | Use a distractor that describes a clearly different state. | yes |
| F21 | should-fix | V13 area item, `AREA_OPTIONS`, demo-probes.ts | Participants may choose any number of parts, and a "hit" is the north edge among those chosen. Choosing all 7 guarantees a hit, and there is no false-alarm term. | Skill: correct for guessing. | Score hits against false alarms (north edge as signal, the other six as noise), or allow at most 2 parts. | no |
| F22 | should-fix | Basis texts and SPEC | Basis texts that are stale:<br>- VP `r1_arrival`: "3 m/min ≈ 110 min"; the records say 4 m/min and the code uses 3.5 (97 min). The key is unchanged.<br>- V10 `front_r2_2h`: "1327 m, 3.5 m/min, ~907 m, margin 93, CA ~480 m"; recomputed: 1345 m, 4.0 m/min, 865 m, margin 135, CA 671 m (band 400–700).<br>- V14 `se_front_r2` (F02), and the freeze-bank-b.ts:94 comment "CA ~237 m".<br>SPEC/08's last item tables (ab.6/ad) still show V4 `ek12_where` = the junction, V10 127–135, V12 1600–2000 and V14 150–300/275. The (ah)/(aj) changes never reached SPEC/08.<br>The demo-probes.ts header still says "6 items" and "SPAM tools locked". | Skill: spot-check keys against the records. SPEC/30 §8 domain review. | Regenerate the table (freeze-table.mts) in a SPEC/08 revision. Compute the basis numbers at build time, as demo-directive.ts does. | reviewer packet |
| F23 | should-fix | `CONSULT_PROMPT_AT_S` 60, views.ts:116; V5 freeze at 61 s (seeded) | The consult notice appears at 60 s and the screen blanks 1 s later, which interrupts anyone who clicks it. The V7 freeze is at 73 s. | Skill: the freeze moment must not be signalled. | In freeze views, keep at least 15 s between the notice and the freeze (add a test), or move the notice after the freeze. | no |
| F24 | consider | V7 freeze | Within V7, several items cue H10's `rekindle_sector` before it is asked: the `ky21_where` distractor "Syttymäkohdan eteläreunalla (lohko L3)", `why_north` (units moved north), and the F06 distractor. The reactivity is acknowledged in SPEC/08 (2 Oct), but here it adds up. | Skill: no item may reveal another's answer. | Replace the `ky21_where` distractor, and run the pilot comparison SPEC/08 proposes. | no |
| F25 | consider | Cues across probes | - V4 `korpioja_spot`'s option "kipinät sytyttävät paloja ojan yli" states V5 `spot_cause`'s mechanism.<br>- V3 SPAM's options (13/18 ha) give V3.b its basis.<br>- V3.b's key teaches the acceleration that V4 `growth_next` then penalises (F01). | As above. | Re-author after F01. | no |
| F26 | consider | Distractors | - V12 `front_toward` offers "Johtopaikan", which is not a settlement.<br>- V7 `cabins_reach` and V10 `cabins_distance` offer "Palo on jo mökeillä" with DR1 putting the fire 1700 m away.<br>- V14 `road_crossed` offers "Palo kääntyy takaisin palaneelle alueelle". | Skill: distractors from the same element. | Replace each with a plausible state. | no |
| F27 | consider | Wording, FI and EN | - The V10 `area_total_hour` stem says "koko palon pinta-ala"; V2 and V5 say "palanut ala" for the same element. Make the inclusion of the detached front explicit in all of them.<br>- V10 `cabins_distance` EN "800–1,500 metres" lacks "away".<br>- V6 SPAM EN says "ditch" for Birch Creek.<br>- V2 `fuel_ahead` EN distractors add content: "with few trees"; "along a brook" against FI "rantametsä".<br>- V14 EN "is … in 20 minutes".<br>- In VP `r1_arrival` (FI) the key alone uses "kuluttua"; the three distractors use "-ssa". | Skill: identical wording for repeated elements; FI/EN parity. | Fix the wording, then have it natively reviewed. | native |
| F28 | consider | V14 `shift_change` + `shift_meaning` | Two items cover one element, while values and life safety are missing from V14. Police report two houses refusing to leave, and DR1 at 19:46 sees people in three houses. | Skill: cover all goals. | Replace `shift_meaning` with a life-safety or values item. The freeze comes after the plan, so it cannot cue Paper 2. | yes |
| F29 | consider | V10 `cabins_distance` :147 | It is tagged L2 but worded as a projection ("tunnin kuluttua") and keyed on truth, while DR1 already has ~1700 m on record. | Skill: levels must be distinguishable. | Word it in the present tense. | no |
| F30 | consider | L1 items that need retrieval | V2, V4 and V5 infra rest only on T2 records; V12 `longest_shift` rests on T3 asked-only records. These items measure retrieval, not perception. | Skill: analyse conditional on exposure. | Report them conditional on `freezeItemExposure`. | no |
| F31 | consider | H2 window | The window mixes 2 map items (chance ≈ 0) with 22 four-option items (chance .25) on one 25–100 scale. | Skill: correct for chance by format. | Add a format covariate and a chance-corrected sensitivity analysis. | no |
| F32 | consider | Hinge check and V8 SPAM | Both are crossed two-element keys (line × aim; known × requested). | Skill: one element per item. | Also score each half, for diagnostics. | no |

**Keys confirmed against the data** (recomputed, basis consistent):
- V2: `nearest_head` (EK11 55 m against 424 m), `junction_hour` (607 m, margin 93).
- V4: `ek12_where` (131 m from R1_BLACK).
- V5: `area_hour` (128 ha; truth 120 ha, same band).
- V7: `rekindle_sector` (L3, step 12), `cabins_reach` (1661 m), `cp_safe` (765 m).
- V10: `area_total_hour` (130.7 ha), `front_r2_2h` (band; see F22).
- V12: `village_distance` (1920 m; truth 1747 m, same band), `longest_shift`.
- V14: `shift_change`.
- Infra keys, F7, hinge check, SPAM V3/V8/V11, V3.b (2.6 → 4.8 ha).

**Items that need a domain reviewer:**
- Freezes: F7 wording; `spruce_behaviour`, `crown_drops`, `korpioja_spot`, `ek14_shelter`, `road_jump`, `cp_safe`, `relief_next`, `growth_next`, `area_hour`, `lull_meaning`, `work_danger`, `units_enough`, `ek12_water`.
- SPAM V6 and V6.b.
- The R1 stretch.
- The V14 backup pair: SPOT/EK14 are both true; KY21/EK16 also look contradictory.
- The source-memory facts.

## Goal × freeze coverage

Goal tags as authored (`FreezeItem.goal`). Counts are per freeze; H2's window is the L2/L3 items of V2, V4, V5 and V7.

| Goal | VP | V2 | V4 | V5 | V7 | V10 | V12 | V14 | Total (main) | H2 window |
|---|---|---|---|---|---|---|---|---|---|---|
| safety | – | 2 (ek11_point, nearest_head) | 2 (ek12_where, work_danger) | 1 (ek14_shelter) | 3 (ky21_where, cp_safe, relief_next) | **0** | 2 (longest_shift, f7) | 1 (shift_change) | 11 | 5 |
| values | 1 (first_target) | **0** | **0** | **0** | 2 (why_north, cabins_reach) | 1 (cabins_distance) | 2 (front_toward, village_distance) | **0** | 5 | 2 |
| containment | 2 | 4 (fuel_ahead, area_40, spruce_behaviour, head_later) | 5 (fastest_spread, growth_next, crown_drops, korpioja_spot, head_later) | 5 (head_now, spot_cause, wind_shift, area_hour, road_jump) | 2 (lull_meaning, rekindle_sector) | 3 (south_front_point, area_total_hour, front_r2_2h) | 2 (head_now, head_later) | 3 (road_crossed, head_later, se_front_r2) | 24 | 15 |
| resources | 1 (infra) | 2 (infra, junction_hour) | 1 (infra) | 2 (infra, units_enough) | 1 (infra) | 2 (infra, ek12_water) | **0** | 2 (infra, shift_meaning) | 10 | 2 |

Outside the freezes:
- **SPAM:** V3 and V3.b cover containment; V6 covers containment and V6.b resources; V8 covers values; V11 resources.
- **Hinge:** strategic guidance.
- **Source memory:** containment ×3, weather, resources ×2, values.

Seed sub-goals (`wildfire_sa_requirements.md`) that no freeze covers:
- **1.2 Crew contact and comms.** The F3 radio dead zone and EK14's silence at step 9 are designed into the scenario but never probed.
- **3.3 Information flow.** Only F7, which concerns record integrity.
- **3.4 Recon assets.** Drones grounded in V6, DR3 taken at 17:59, DR1 limited by gusts at 18:42.
- **The current wind or forecast as L1.** For the environmental cue class, `wind_shift` supplies the wind in its stem.
- **2.1 Attack mode against intensity.** Only `work_danger` comes close.

Fatigue (1.3) has 4 items, two of them redundant in V14.

## Conflicts with SPEC/30 needing a decision

1. **SPAM with tools, two items under one "ready"** (SPEC/30 §5.2). The skill defines SPAM as display-only, one query per ready, with latency as the SA index.
   - *Pros:* it measures the joint system (team SA), which is the teaming question.
   - *Cons:* latency now includes query time; the second item has no ready latency of its own; it is not Durso SPAM.
   - *Decision:* call it a "tool-aided probe", and analyse its accuracy without a latency-as-SA claim.
2. **Report-keyed numeric L3 keys** (SPEC/08 ab). The skill says "correct answer from ground truth".
   - *Pros:* fair to the information that was given.
   - *Cons:* it scores linear extrapolation, not projection. In the same freeze the map items are truth-keyed, so "L3" is defined two ways inside H2's window. F01 shows the failure mode.
   - *Decision:* pre-register the primary key (report or truth) and a sensitivity analysis on the other, or credit an answer that matches either where the two disagree (V2 `area_40`, V4 `growth_next`, V10 `front_r2_2h`, V14).
3. **Freezes after the plan in V10 and V14** (SPEC/30 §5.1). The skill allows this when the order is fixed for everyone, which it is.
   - *Cons:* "now" is ambiguous, recall replaces L3 (F02, F03), and the moment becomes predictable.
   - *Decision:* define "now" as the view's end for these freezes, re-horizon their L3 items, and state the clock (F13).
4. **Freezes at a random moment in the other views.** Whether the plan has been committed varies by participant. The skill says the order (decision or freeze first) must be the same for everyone. SPEC/15 r.3 mitigates this with a covariate.
   - *Decision:* keep it, but the covariate must be in the pre-registration.
5. **No Agent-SA family.** The skill recommends one; the SPEC has none. The source question was withdrawn for reactivity, and SPEC/08 (x) says no freeze item asks whether the projection holds. See proposal (a).
6. **No QASA block.** The skill makes it optional. See proposal (b).
7. **H-T mixes SAGAT and SPAM in one difference score.** The skill says report them separately. See F05.
8. **L3 horizons.** The skill assumes participants are briefed on a projection horizon. The SPEC states a horizon per item instead, and 4 items have none (F08).
   - *Decision:* adopt the rule "every L3 stem names its horizon".
9. **SPEC/08 rule (d) conflicts with the bank.** Rule (d) says "never the fire's position at the envelope's horizon, never beyond it". The `head_later` items at V4/V14 ask for exactly that position, and V2/V12 `head_later`, `area_40`, `area_hour`, `village_distance` and others go past the horizon.
   - *Decision:* retire or restate rule (d) explicitly.
10. **Chance correction.** The skill asks for it per format. H2's gap uses raw proportion correct (F31).

## Proposals

**(a) Agent-SA items: what the AI projected, how reliable it has been, and items that catch its errors.**
- *Fit with the research question.* It fits conceptually: the question is about teaming, and over-acceptance is part of it. As in-session freeze items it is a poor fit, for four reasons:
  - The groups are asymmetric. Haku makes no projections, so "what did the AI project" can only be answered in the guide group, or is about different agents in each group.
  - The AI is a live LLM. There is no fixed key, and participant-specific keys taken from the log would need per-person options.
  - Error-detection items need a known AI error, and planted errors were moved to the professor's environment (SPEC/30 §7).
  - Reactivity. Like the withdrawn source question, these items prompt participants to cross-check the AI and would narrow the H2 and H2t differences. They also break the "no tool words" rule.
- *Blanking* is not an obstacle: memory of the conversation can be probed with the screen blank.
- *Cost:* about 20 s per item, so 1.3 min for one per phase-A freeze.
- *Recommendation:* add none in the session. Three items the study already has are "only answerable by checking the raw records":
  - F7 at V12 (the planted record);
  - `rekindle_sector` at V7 (retrieval omits VPK's objection for broad questions, ranked 245th);
  - the V14 backup.

  Tag them `family: verification`. Then use logs and existing measures: analyse them conditional on whether an AI answer before the freeze relayed the planted or omitted record (`answerRelaysAtom`); add `projectionReliance`; and add verification behaviour (opening the record an answer cited).
- *Optional:* two post-session questions for both groups on the perceived reliability of the tool they used (~30 s), compared with reliability computed from the log. This is exploratory and not for H2.
- If the researcher wants an in-session item, the only symmetric target is the shared spread projection (V5 or V7: "how did the last projection hold?"). That conflicts with the SPEC/08 (x) decision.

**(b) QASA: true/false statements with confidence (acceptance bias c, sensitivity d′).**
- *How many and where:* per-participant d′ and c need at least 10 true and 10 false statements. 30–40 is stable; a pooled hierarchical model can work with 12–16. They would go at the end of the V2/V4/V5/V7 freezes, after the existing items so they cannot cue them, at 4–8 per freeze.
- *Time:* about 8–10 s per statement with confidence, so 16 statements ≈ 2.5 min and 32 ≈ 5 min. The session is already about +8 min.
- *What it adds to H2:* acceptance bias c is a direct test of "illusion of understanding" (a liberal guide group) next to the confidence − accuracy gap.
- *Risks:*
  - False statements read on a blank screen can be encoded as true (the misinformation effect), contaminating later plans (Paper 2) and source memory.
  - True statements leak facts and even out exposure (Papers 1 and 3).
  - The 25–100 scale puts 25 below the T/F chance level of 50.
  - With a live LLM, "AI-sourced" false statements cannot be scripted.
- *Replacing part of H2:* not advised. H2's power (70 % small, 100 % medium) is computed for 24 four-option items. Swapping 8 of them for 16 T/F statements changes the scale and needs `h2-power.ts` re-run.
- *Recommendation:* leave it out of the professional study. Compute a lure-acceptance index at no time cost from the stale or report-now lures already in the bank: V2 `junction_hour` (map now), V10 `area_total_hour` (DR3 figure), V10 `front_r2_2h` ("runsaan kilometrin"), V12 `village_distance` (records), V3 SPAM (13 ha), V6.b (latest report). Run QASA in the student sample if wanted.

**(c) Exporting to `score_freezes.py` error classes, against the repo's own measures.**

The repo is richer in several ways:
- It orders exposure by log sequence, so a record pushed after the freeze is not counted. `score_freezes.py` uses `first_seen_cycle ≤ cycle`, which miscounts mid-view freezes.
- It records the route (bubble / haku / haku_chat / thinker) and the time before the freeze.
- It screens whether an answer actually relayed a record (`answerRelaysAtom`).
- It has `aiStatedKey`, H2, H2t and projection reliance.

Ported as it is, `score_freezes.py` would misclassify H2's own items. L3 items have empty `keyAtomIds`, and `all([])` is true, so every wrong L3 answer would become EXPOSED_WRONG ("mental-model error") even when the participant never saw the basis. It also has no told or lure class and expects points in EPSG:3067.

*Recommendation:*
- Add an `errorClass` fold to freeze-measures.ts with five classes: NOT_EXPOSED, EXPOSED_WRONG, STATED_WRONG (the AI stated the key), STATED_LURE (the AI stated a distractor) and UNSCREENED.
- Give L3 items `basisAtomIds`: the delivered reports a report-keyed key rests on, and the forecast for the wind items.
- Report the JE96 classes descriptively.
- Export a CSV in the `score_freezes.py` format only as an independent cross-check in pilot 2. This costs about half a day.
- Pre-register partial credit (for example, 0.5 within 2× map tolerance) only if it is wanted, since both tools support it.

## Not checked
- I did not run the vitest suite, the typecheck or the app, so whether `freeze-bank.spec.ts:212` currently fails (F02) is unconfirmed. I did not view the UI. In particular I did not check whether the blank freeze map shows the Koivuoja broadleaf strip or place labels, or whether the V4 15:20 head lies inside the map frame (bank comment "RESEARCHER CHECK").
- No live Thinker or Haku answers were generated. The told/not-told risk is judged from the content and the prompts' design, not measured. Before pilot 2, run `thinker:probe` with about 10 typical questions per phase-A view against the `keyStatements`. High-risk items: `spruce_behaviour`, `wind_shift`, `ek14_shelter`, `korpioja_spot`, `road_jump`, `work_danger`, `why_north`, `units_enough`, `spot_cause`.
- The English corpus translations of records, `questionnaire.ts` rendering of the source-memory block, `practice-spam.ts` beyond its key, SPEC/09's analysis models and the power tools were not reviewed in depth.
- I did not validate the fire behaviour of the CA or the realism of fuels and terrain; the domain reviewer covers that.
- The Finnish register was not checked by a native speaker.
