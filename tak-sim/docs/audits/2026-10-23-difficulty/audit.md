# Difficulty audit, 23 Oct 2026: can a participant who does not search build a good enough picture?

**Status:** an audit only. It changes nothing in `app/`, `content/` or `server/`. The proposal is in `proposal.md` (with `proposal-map.md` and `proposal-items.md`).
**The question (researcher, 23 Oct 2026):** is the simulation too hard for novices, and even for firefighters? Do participants realise that they must actively SEEK information to build a good enough operational picture? Only 155 of the 876 traffic records (`site-scenario.json` `traffic[].tier`) are `T1_pushed`. Firefighters also read topographic maps less often than soldiers do.
**Files:** `items.csv` has one row per item (60 rows). `summary.md` has the computed tables. Both are written by `npx tsx tools/review/difficulty-audit.ts`, which joins the built scenario with the hand table `tools/review/difficulty-audit-hand.ts`. They contain TRUTH (the keys), so they are for the researcher and the panel only.

---

## 1. How information reaches a participant (checked in the code)

| Surface | What it holds | Action needed | Where in the code |
|---|---|---|---|
| **Message log** (*Viestiloki*). The TAK shell's GeoChat "rooms" are the same log grouped by source. | Only PUSHED records: T1 traffic, story beats and crew radio marked pushed, and P2's two messages. That is 10–18 records per view (`summary.md`, "Records per view"). | None. In a single-step view every first-step record arrives **at 0 s, in one burst**. In a merged view (V2, V4, V6, V11, V12, V14) the second step's records arrive together at the step boundary, **65 s** in. | `orchestrator.ts` `deliverPushed`; `GeoChatPane.tsx`; `shell.ts` `geoChatRooms` |
| **Map** | The latest reported perimeter, earlier perimeters, spot fires, heat detections, unit symbols (in a merged view, from the second step on), the head's rate mark (m/min), the projection bands, the wind arrow, the sector outlines with 9 px codes, the labels R1–R3, the R3 bridge, the CP and 20 kV, and the basemap's names and contours. | None (zoom and pan help). | `map-overlay.ts`, `fire-layers.ts`, `demo-map.ts` |
| Not on the map | The water points W1–W3 (removed at the researcher's decision, revision (am)), forest types (the MML-style basemap draws forest white, with no spruce or broadleaf), any area in hectares, any distance, and the km grid (removed). | — | `map-overlay.ts` header; SPEC/33 §9 |
| **Freeze map** | Only the plain basemap, with names and contours. It has **no fire, no overlay, no sector codes and no road labels**. It has a scale bar. | Map points are placed from memory against the terrain. | `FreezeMap.tsx`, `map-overlay.ts` |
| Contacts / Video panes (TAK) | Each unit's task, water %, and the time of its last pushed message. One thermal frame per drone. | One click | `ContactsPane.tsx`, `VideoPane.tsx` |
| **Records** (everything else) | The other 721 traffic records (T2 system logs and sensor feeds, T3 "when asked" status answers, T4 unit-to-unit traffic), crew radio and story beats that are not pushed, the designed F7 records, and **every weather forecast** (`evt.wx.01`–`06` are all T2, never pushed). | **Seeking**: **Haku** (both groups; a language-model answer over the hybrid retrieval's top 8 records) or the **Thinker** (guide group). Records are released by step: a view's first-step records at 0 s, a merged view's second-step records at 65 s (`time-gate.ts`). | `queries.ts`, `hybrid.ts`, `server/thinker/` |
| Not available in the study | The index search exists only in the demonstration (not under `?tuotanto`). Nobody can ask a unit, because the participant cannot transmit, so the T3 "ask_unit" items are records like any other. | — | `App.tsx` `indexedSearch={!study}`; `queries.ts` header |

**Cues to seek.**
- At 60 s a content-free notice appears: "New reports since your last plan" (`consult-notice.ts`).
- GeoChat counts unread messages, but only pushed ones. Nothing counts the new records waiting in the records.

**What participants are told** (both groups; the experts see the tour only, and the public sessions see the primer too):
- The tour's log step: "Reports from the units and other actors arrive in the message log with their sender and time."
- The primer's screen page (public only): "the message log, where the units' reports arrive". Its check question is "Where do you see the units' reports?", keyed "In the message log".
- The only hint that the log is incomplete is one clause in the tour's welcome: "The units' answers to the command post's questions appear in the records."
- The Haku text says that Haku answers "from the reports and records received so far". **Nothing says that the log shows only part of the traffic.** The instructions in fact teach the opposite. This is the most direct cause of the researcher's concern, and the cheapest one to fix (`proposal.md` §a).

**Time budget.**
- A view lasts at least 120 s (130 s when merged) and at most 150 s of view time.
- In that time the participant reads 10–18 pushed messages that arrive in one or two bursts, makes a plan, and from V8 also keeps or revises it.
- A phase-A freeze falls at a pre-planned moment: V2 105 s, V4 102 s, V5 61 s, V7 73 s. The phase-B freezes come at the view's end, at 120 s or more.
- A SPAM prompt appears at 25 s and waits for "ready". It is then answered within 60 s with the log and the tools open.

## 2. Method

**Computed** by `tools/review/difficulty-audit.ts` from `buildDemoScenario()`:
- For each of the 60 items (the 4 practice-freeze items, the 50 scored freeze items, and the 6 SPAM items V3, V3.b, V6, V6.b, V8, V11):
  - the key records (`keyAtomIds` ∪ `basisAtomIds`; for SPAM, `SPAM_KEY_ATOMS` and `SPAM_SECOND_KEY_ATOMS`);
  - each record's tier;
  - whether it was pushed or recorded only before the item's moment, and in which view;
  - its **lead**: the view seconds between its arrival and the item's moment.
- An item that combines several records needs the last of them. Duplicate reports count from the first (`anyOf`).
- "Late" means that a freeze's last key record arrived less than 60 s before the freeze.
- Findability: for the 15 items whose key needs a recorded-only record, one or two plain questions in each language. Each was run through Haku's retrieval (`hybridRetrieve`, its frozen configuration, top 8) over the records reachable at the moment. These are **lexical ranks only**: the vector half needs the embedding model, which this environment does not have.
- **Records per view**: the number pushed against the number recorded only.

**Judged by hand** (`difficulty-audit-hand.ts`, one row per item with its reason; DRAFT, one coder; a second coder is needed before anything rests on it):
- the channels (a) pushed, (b) on the map without action, (c) only by seeking, (d) inference or domain knowledge, (e) map reading that no record does for you;
- **passive accessibility**: a participant who never searches can answer yes, partly or no;
- **map dependence**: none, helps or required;
- whether the key rests on a map fact, or a fact shown on no surface, that no record states;
- which pushed records a hand "yes" rests on, when the item's own key records are recorded only.

The tool checks two things:
- a hand "yes" never sits on an item whose every key record is recorded only, unless pushed records are named for it (and those are checked to be pushed in time) or the stem itself states the premise;
- a hand "no" never sits on an item whose key records are all pushed.

"Passive yes" assumes that the participant reads every pushed message and the map within the view's time. It is an upper bound on what a non-searcher can know, not a prediction of accuracy.

## 3. Headline numbers

| | Items | Passive yes | Partly | No | A key record recorded only | Map required | Freeze record late (< 60 s) |
|---|---|---|---|---|---|---|---|
| Scored freeze items | 50 | **34 (68 %)** | 11 (22 %) | 5 (10 %) | 12 (24 %) | **11 (22 %)** | **8 (16 %)** |
| SPAM items | 6 | 4 (67 %) | 1 | 1 | 2 | 0 | (not applicable) |
| All scored | 56 | **38 (68 %)** | 12 (21 %) | 6 (11 %) | 14 (25 %) | 11 (20 %) | 8 |
| H2 window (V2–V7 freeze, L2/L3, 24 items) | 24 | 16 (67 %) | 6 (25 %) | 2 (8 %) | 3 | 4 | 5 |
| Per level: L1 / L2 / L3 | 18 / 16 / 22 | 83 % / 75 % / **50 %** | 11 / 13 / 36 % | 6 / 13 / 14 % | | 22 / 6 / 27 % | 17 / 25 / 5 % |

Per view, see `summary.md`. V12 is the hardest freeze without seeking (2 of 6 items passive yes, 3 of 6 map-required). V14 is the easiest (6 of 6). V2 has the most items that are partly or not passive (4 of 8).

**Reading.**
1. **Seeking is necessary for a minority of the items, but it is never taught.**
   - Six scored items cannot be answered without a search: V2 `area_40`, V5 `infra`, V5 `ek14_shelter`, V10 `area_total_hour`, V12 `f7` and SPAM V6.b. Twelve more need a search for part of their basis.
   - Three of the six were built to be retrieval-dependent: V12 `f7` and SPAM V6.b on purpose, and V5 `infra` through the drone road reports. A non-searcher is at chance (25 %) on all six.
   - The 721 recorded-only traffic records (82 %) are mostly routine. What matters is that the **forecasts, the drone road reports, the perimeter-survey series and the units' status answers** are among them.
2. **Most of the difficulty lies elsewhere.** Much of what makes items hard has nothing to do with seeking:
   - **map reading** (11 freeze items need the map; 5 of them are "mark on the blank map" items, answered on a basemap without the fire, the sectors or the road labels);
   - **projection without figures** (7 L3 items rest on a map fact, or a fact shown nowhere, that no record states; §4.2);
   - **domain knowledge** (V2 `spruce_behaviour`, V4 `crown_drops`, `korpioja_spot` and `return_danger`, V5 `road_jump`: fire behaviour a novice does not know);
   - **timing** (§4.3).
3. **The stream tells about half the keys.** The 56 scored items split three ways:
   - 27 (48 %) have every key record pushed;
   - 15 have no key record at all (map, knowledge or fire-model keys);
   - 14 need a record that is recorded only.

   In the H2 window, 11 of 24 items have every key record pushed. The told split's `stream_told` class reads `keyAtomIds` only, so it can differ by an item or two. `30` (az) assumed 8 of 24 stream-told for its power run. Its H2t "neither" stratum is therefore a little smaller than planned, and pilot 2's `toldClass` rates should replace both figures.

## 4. Lists

### 4.1 Items a non-searcher cannot answer (passive "no") and where a seeker finds the basis

| Item | Basis, recorded only | Findability (lexical top 8) |
|---|---|---|
| V2 `area_40` (L3) | DR3's 13.55 and 14.15 perimeter surveys (the growth series). The map prints no area. | fi "Kuinka suuri palanut ala on?": ranks 2 and 1. **en "How large is the burnt area?": neither in the top 8** |
| V5 `infra` (L1) | DR2's 15.27 road report on R1 | "What is the state of road R1?": not in the top 8 (fi or en). "road report road R1": 4th |
| V5 `ek14_shelter` (L3) | The 15.00 forecast update (`evt.wx.03`) | **fi "Mikä on sääennuste?": the two older forecasts rank 4–6, the current one is not in the top 8**. en: 4th |
| V10 `area_total_hour` (L3) | Nothing gives the key. The recorded 17.35 survey (153.6 ha, "no edge moved") is the lure. The new front's growth is only drawn. | fi 2nd (the lure); en not in the top 8 |
| V12 `f7` (L2) | The distribution company's log (V4) and HELI1 (V6). A verification item by design (H9). | 1st and 4th (fi); 1st and 2nd (en) |
| SPAM V6.b (L2) | DR2's 15.27 and 15.47 road reports | Plain question: neither in the top 8. "road report road R1": only the 15.47 one (4th). Older R1 reports from other drones crowd out the 15.27 one. |

The lexical half alone already shows that **Finnish and English questions find different records**, and that a plain question about a road or the forecast can return stale records. The pilot must check the full Haku (vector half and model) on these questions (`proposal.md` §f).

### 4.2 Keys that rest on a map fact, or a fact shown on no surface, that no record states before the freeze

| Item | What is unstated |
|---|---|
| V2 `junction_hour` (L3) | The fire's distance to the R1/R2 junction. It has to be measured with the scale bar and extrapolated with the head's rate. The map's ~950 m now is the lure. |
| V2 `head_later` (L3, map point) | The head an hour ahead. V2's projection ends at 40 minutes. |
| V4 `crown_drops` (L3) | **The broadleaf strip along Birch Creek is stated in no record before step 7, and the basemap has no forest types.** Only knowledge that brook valleys carry birch can answer it, cued by the name Koivuoja (Birch Creek). |
| V4 `head_later` (L3, map point) | The head 20 minutes ahead, beyond the projection's isochrone (a breach view) |
| V7 `cp_safe` (L3) | The fire's distance to the command post (~760 m). The turn away from the CP is in the recorded forecast only. |
| V10 `area_total_hour` (L3) | The new front's growth in hectares. It is drawn only, and the recorded survey is the lure. |
| V12 `head_later` (L3, map point) | The head an hour ahead. V12's projection ends at 19.20. |

Five more items are **map-point L1 items** (VP, V2 `ek11_point`, V5, V10 `south_front_point`, V12): their information is drawn, but the answer is a point on the blank basemap. This is map reading in its purest form. V10's tolerance is 100 m; the others' is 200 m. Four choice items need the map as well: V2 `junction_hour`, V7 `cp_safe`, V10 `front_r2_80` and V12 `front_toward`.

### 4.3 Freeze items whose key arrives less than 60 s before the freeze

All of them are in the merged phase-A views. The freeze falls after the step boundary (65 s), so a second-step record has only 10–45 s before the blank screen. V2's draw (105 s) leaves 40 s, and V4's (102 s) leaves 37 s.

| View | Items (lead) |
|---|---|
| V2 | `ek11_between` L2, `south_flank` L2, `ek11_point` L1 (40 s) |
| V4 | `infra` L1, `ek12_where` L1, `fastest_spread` L2, `head_unattended` L2, `return_danger` L3 (37 s) |

These eight items depend on reading the second burst (6–9 messages in V4) at once, while the plan task is open. **Five of the eight are in the H2 window or are V4's L1 items. All of V4's L2 items are late.** No phase-B freeze is late, because those freezes come at the view's end. The SPAM items are not counted, because the log and the tools are open while answering.

## 5. Top problem items (for the panel)

1. **V10 `area_total_hour` (L3)**: no passive route, and a seeker finds the lure. The key needs hectares of growth that only the drawn perimeters show. Novices, and most firefighters, cannot read hectares off a map.
2. **V4 `crown_drops` (L3)**: the key's fact is on no surface before the freeze. Answering it takes domain knowledge plus a cue from the place name. Novices are near chance, and the name is a cue in both languages.
3. **V5 `ek14_shelter` (L3)**, with V5 `wind_shift`, V7 `cp_safe` and V7 `rekindle_sector`: these rest on forecasts that are **never pushed**. The plain Finnish question for the forecast does not retrieve the current forecast in the lexical half. `wind_shift` survives only because its stem states the premise.
4. **V2 `junction_hour` (L3) and V2 `area_40` (L3)**: these are V2's map-reading and estimation pair, in the first scored freeze. One needs a distance by scale bar, the other hectares from polygons or a two-record survey series that is recorded only. Firefighters' unfamiliarity with topographic maps applies here directly.
5. **The V4 late cluster** (`ek12_where`, `fastest_spread`, `head_unattended`, `return_danger`, `infra`): the crown-run burst arrives 37 s before the freeze, while the plan is open. These items measure reading speed under load as much as SA.

These follow closely: SPAM V6.b (the older road report is hard to retrieve) and the five map-point L1 items on the blank basemap (map reading measured as perception).

## 6. What the audit does not cover, and its limits

- **Accuracy is not predicted.** "Passive yes" is an upper bound. Pilot data per item (§f of the proposal) replace this.
- **Hand judgement by one coder.** The channels, "passive" and "map" columns need a second coder (a fire officer) on a sample before the panel relies on them.
- **Findability is the lexical half only.** The Haku chat fuses lexical and vector scores (0.5 / 0.5) and then the model writes an answer. A record outside the lexical top 8 may still be found, and one inside may not be quoted.
- **Reading load is not modelled.** The audit does not model 10–18 messages per burst, the length of the message texts, or the language (English sessions read the English records).
- **The Thinker group** reaches the same records. The digest and the recent matches can bring a key without a search (`freeze-measures.ts` exposure routes). That is a group difference by design, not a difficulty difference.

## 7. Side findings (outside the question, for the researcher)

1. **Three source-memory facts are classed `record_only`, but every one of their records is pushed** (`source-memory.ts`):
   - `pp2_560` (`evt.c07.028`, pushed in V5);
   - `ek15_arrival` (`atom.radio.10.2` and `evt.c10.032`, both pushed in V7);
   - `ek14_fuel` (`evt.c07.036` in V5 and `evt.c10.017` in V7).

   The `expected` class is an analysis covariate (`30` §5.5), so these three should be re-classed, or their records demoted, before pilot 2.
   `cabins_nw` (`expected: map`) is also stated by two pushed records (`evt.vp.011` in VP and `evt.c01.008` in V1).
2. **Every weather forecast is recorded only** (`evt.wx.01`–`06`). The map's wind arrow shows the current wind, never the forecast. In the lexical half, the plain Finnish question "Mikä on sääennuste?" retrieves the older forecasts rather than the current one at step 7. Pilot 2 should check whether the full Haku (with the vector half) returns the newest forecast. If not, the retrieval's recency boost for the forecast source is the place to look; that is a `14` matter, not a content change.
3. **The tour and the primer teach that the log is complete** (§1). This is the cheapest fix of all (`proposal.md` §a).
4. **V7 `ky21_where`**: the map symbol still shows KY21 on the south edge by design (UNIT_PLAN stale), so the map is that item's lure. This is intended, but it means the item penalises those who trust the map more than the log. Novices and map-oriented participants are more exposed to that.

## Appendix: every item (generated from `items.csv`; the full prompts, keys and notes are there)

Key records: `P` pushed, `R` recorded only, then the view it reached the participant in and its lead before the moment, when it arrived in the item's own view. Channels: (a) pushed, (b) on the map, (c) seeking, (d) inference or knowledge, (e) map reading. `*` means the key rests on a map fact, or a fact on no surface, that no record states. Lead: the last key record's lead in view seconds ("—" when every one came in an earlier view, or the item has no key record).

| Item | Level | Key | Key records | Channels | Passive | Map | Lead (s) |
|---|---|---|---|---|---|---|---|
| `practice.infra` | L1 | Available; tankers can fill up there | evt.vp.013 PV0 69s | a | yes | none | 69 |
| `practice.first_target` | L2 | Road R1 | evt.vp.002 PV0 69s; evt.vp.003 PV0 69s; evt.vp.011 PV0 69s | a,d | yes | helps | 69 |
| `practice.r1_arrival` | L3 | In more than an hour | — | a,d | yes | helps | — |
| `practice.head_now` | L1 | map point (200 m) | evt.vp.002 PV0 69s; evt.vp.008 PV0 69s | b,e | yes | required | 69 |
| `2.infra` | L1 | Not safe to drive, flames at the roadside | evt.c03.018 RV2 40s; evt.c02.013 RV2 105s; atom.demo.1.1 PV1 | c,d | partly | none | — |
| `2.ek11_between` | L2 | EK11 can be caught between the head and the new fire | atom.radio.3.0 PV2 40s; atom.demo.3.0 PV2 40s; evt.c03.007 PV2 40s | a,d | yes | helps | 40 **late** |
| `2.south_flank` | L2 | The edge is kept low, but the head gets past | evt.c01.004 PV1; evt.c03.021 PV2 40s | a,d | yes | none | 40 **late** |
| `2.area_40` | L3 | 20–35 hectares | — | c,d,e | no | helps | — |
| `2.spruce_behaviour` | L3 | It climbs into the crowns and throws embers ahead | atom.demo.2.0 PV2 105s | a,d | yes | none | 105 |
| `2.junction_hour` | L3 | 400–700 metres away | — | b,d,e | partly | required * | — |
| `2.ek11_point` | L1 | map point (200 m) | atom.radio.3.0 PV2 40s | a,b,e | yes | required | 40 **late** |
| `2.head_later` | L3 | map point (300 m) | — | b,d,e | partly | required * | — |
| `4.infra` | L1 | Available; tankers can fill up there | evt.c06.003 RV4 37s; evt.c06.007 PV4 37s | a,c | yes | none | 37 **late** |
| `4.ek12_where` | L1 | On road R1 in the burned area | atom.radio.6.1 PV4 37s | a,b | yes | helps | 37 **late** |
| `4.fastest_spread` | L2 | In the north-east (sector L2) | atom.demo.6.0 PV4 37s; evt.c06.017 PV4 37s; evt.c06.019 RV4 37s | a,b,d | yes | helps | 37 **late** |
| `4.head_unattended` | L2 | No one is attacking the head; it spreads freely | atom.radio.6.0 PV4 37s; atom.radio.6.1 PV4 37s; evt.c06.008 PV4 37s | a,d | yes | none | 37 **late** |
| `4.return_danger` | L3 | Spot fires starting behind them | atom.demo.6.0 PV4 37s | a,d | yes | none | 37 **late** |
| `4.crown_drops` | L3 | In the broadleaf strip along Birch Creek | — | d | partly | helps * | — |
| `4.korpioja_spot` | L3 | No, embers start fires across the creek | — | a,d,e | yes | helps | — |
| `4.head_later` | L3 | map point (300 m) | — | b,d,e | partly | required * | — |
| `5.infra` | L1 | Passable with care, low fire at the roadside | evt.c07.016 RV5 61s | c | no | none | 61 |
| `5.lines_breached` | L2 | A new fire is burning beyond Alder Creek with no one fightin | atom.radio.7.2 PV5 61s; evt.c07.007 PV5 61s | a,d | yes | helps | 61 |
| `5.hose_short` | L2 | Too little hose to keep up with the head | evt.c07.007 PV5 61s; evt.c07.032 PV5 61s | a,d | yes | none | 61 |
| `5.ek14_shelter` | L3 | Move to safety in the burned area | evt.wx.03 RV4 | c,d | no | helps | — |
| `5.wind_shift` | L3 | The north edge | evt.wx.03 RV4; evt.wx.02 RV1 | d,e | yes | helps | — |
| `5.area_hour` | L3 | 140–190 hectares | evt.c07.031 PV5 61s | a,d | yes | none | 61 |
| `5.road_jump` | L3 | No, embers will fly across the brook and start a new fire | atom.radio.7.3 PV5 61s; atom.radio.7.2 PV5 61s | a,d | yes | helps | 61 |
| `5.head_now` | L1 | map point (200 m) | — | b,e | yes | required | — |
| `7.infra` | L1 | Available; tankers can fill up there | evt.c10.023 RV7 73s; atom.radio.10.0 PV7 73s | a,c | yes | none | 73 |
| `7.ky21_where` | L1 | Moving to the north edge (sector L1) | atom.radio.10.3 PV7 73s | a | yes | none | 73 |
| `7.lull_meaning` | L2 | The edges calm for now; the fire is not over | atom.demo.10.0 PV7 73s; evt.c10.002 PV7 73s | a,d | yes | none | 73 |
| `7.north_help` | L2 | EK14 gets more crews on the north edge | atom.radio.10.3 PV7 73s; atom.radio.10.4 PV7 73s; atom.radio.10.1 PV7 73s | a,d | yes | helps | 73 |
| `7.rekindle_sector` | L3 | L3 South | atom.radio.10.3 PV7 73s | a,d,e | partly | helps | 73 |
| `7.cabins_reach` | L3 | No, it is too far at the present rate of spread | evt.c10.008 PV7 73s; evt.c01.008 PV1 | a,d,e | yes | helps | — |
| `7.cp_safe` | L3 | No, the fire and smoke stay far from it | — | b,d,e | partly | required * | — |
| `7.relief_next` | L3 | VOL1's crew | evt.c01.012 PV1; evt.c01.004 PV1; atom.radio.2.0 PV2; atom.radio.3.1 PV2; evt.c10.011 PV7 73s | a,d | yes | none | 73 |
| `10.infra` | L1 | Passable; the fire is not near the road | atom.demo.13.0 PV10 120s | a | yes | helps | 120 |
| `10.ek12_water` | L2 | EK12 stays on the line; more water is brought to it | evt.c13.032 PV10 120s; evt.c13.035 RV10 120s | a,c,d | yes | none | 120 |
| `10.cabins_distance` | L2 | 1,500–2,500 metres away | evt.c11.015 RV8; evt.c12.011 PV9 | a | yes | helps | — |
| `10.area_total_hour` | L3 | 155–167 hectares | — | c,d,e | no | helps * | — |
| `10.front_r2_80` | L3 | 650–950 metres away | atom.demo.13.0 PV10 120s | a,b,d,e | partly | required | 120 |
| `10.south_front_point` | L1 | map point (100 m) | atom.demo.12.0 PV9; atom.demo.13.0 PV10 120s | a,b,e | yes | required | — |
| `12.longest_shift` | L1 | Unit EK11 | evt.c17.008 RV12 65s; evt.c17.024 RV12 65s; evt.c17.033 RV12 65s; evt.c17.029 RV12 65s; evt.vp.002 PV0; evt.c10.011 PV7 | c,d | partly | none | — |
| `12.f7` | L2 | The line is live; safety distances apply and no water is dir | f7.grid_record RV4; f7.heli_line_clearance RV6 | c | no | none | — |
| `12.front_toward` | L2 | Bay Village | atom.demo.17.1 RV12 65s; evt.c17.009 PV12 65s | b,c,d | partly | required | 65 |
| `12.village_distance` | L3 | 1,600–2,100 metres away | evt.c17.009 PV12 65s | a,d | yes | helps | 65 |
| `12.head_now` | L1 | map point (200 m) | — | b,e | yes | required | — |
| `12.head_later` | L3 | map point (250 m) | — | b,d,e | partly | required * | — |
| `14.infra` | L1 | No; the bridge does not carry a heavy tanker | atom.radio.16.0 PV12; atom.radio.16.1 PV12 | a | yes | none | — |
| `14.shift_change` | L1 | EK11 and VOL1 | atom.radio.19.3 PV14 130s; atom.radio.19.1 PV14 130s | a | yes | none | 130 |
| `14.road_crossed` | L2 | The next barrier ahead of the head is road R2 with its lines | atom.radio.18.4 PV13; atom.radio.19.2 PV14 130s; atom.radio.19.0 PV14 130s | a,d | yes | helps | 130 |
| `14.residents` | L2 | People are still in the village, so the lines must hold | atom.radio.18.6 PV13; atom.radio.19.1 PV14 130s | a,d | yes | none | 130 |
| `14.se_front_r2` | L3 | No, the front will still be hundreds of metres from the road | evt.c20.034 PV14 65s; evt.c20.042 PV14 65s; evt.c18.015 PV13 | a,d | yes | none | 65 |
| `14.flare_next` | L3 | It spreads south-east with the wind | atom.demo.19.2 PV14 130s; atom.demo.20.1 PV14 65s | a,b,d | yes | helps | 65 |
| `SPAM 3` | L1 | About 24 ha | evt.c04.033 PV3 25s | a | yes | none | 25 |
| `SPAM 3.b` | L2 | Sped up: about a third more new area | evt.c03.035 RV2; evt.c04.033 PV3 25s | a,c,d | partly | none | 25 |
| `SPAM 6` | L1 | The fire has crossed the ditch, the line is broken | atom.radio.8.3 PV6 25s | a | yes | none | 25 |
| `SPAM 6.b` | L2 | No change: low fire at the roadside, passable with care | evt.c07.016 RV5; evt.c08.012 RV6 25s | c,d | no | none | 25 |
| `SPAM 8` | L1 | Not known: the police have been asked to check | atom.demo.9.1 PV6; evt.c11.049 PV8 25s | a | yes | none | — |
| `SPAM 11` | L1 | To move to another fire in the region | atom.demo.14.0 PV11 25s | a | yes | none | 25 |
