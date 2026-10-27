# Play-test analysis, continued (round 3)

Continues `analysis.md` (§1–§10), which would exceed 500 lines with this section. Contains keys: researcher only. Data: `items-round3.csv`, `haku-round3.csv`, `pointers-round3.csv`.

---

## 11. Round 3 on the search-training version (25 Oct 2026)

**Runs.** Both were played on HEAD of `ccr-f481e62c-9ze866`, revisions (bh) to (bo), Haku cell `radio`. The players were **Sonnet**; every earlier round used Opus players.
- `playtest3/commander-fi`: "Kari", expert, Finnish. 61 items, 30 Haku questions (one was the chip).
- `playtest3/business-en`: "Laura", public, English. 61 items, 28 Haku questions (two were the chip).

Scored with `npm run -s play -- score`. The pointer measures come from `pointerFollowUps`, `pointerFollowUpRates` and `pointerItemClasses` (`app/telemetry/pointer-measures.ts`), run on each run's replayed log (`replayRun`, then `session.o.logRecords()`, as `score.ts` does).

**Caveats:**
- One run per cell, and a different model from earlier rounds. Differences of one or two items are noise.
- Haku is the template fallback over lexical retrieval. It shows the text of the first record that is not a question; the study model sees all 8.
- Every retrieval rank below was recomputed offline at the question's step. Each one matches what the harness showed.

### 11.1 Summary

| # | Finding | Action |
|---|---|---|
| 1 | **The (bk) conversions now discriminate.** On H2's seek-dependent window S (9 items), Kari scored 7/9 and Laura 6/9; the five earlier runs scored 8–9/9. On the passive items P they scored 12/14 and 14/14. Every wrong answer at confidence ≥ 75 in this round is a seek-dependent lure: `south_flank` (Kari), `hose_short` (Laura) and SPAM 6.b (Laura). | Keep. |
| 2 | **The key records of the converted items were reached only through pointers.** `reinforcements` 2/2 (P2's pointer, record shown at rank 1). `hose_short` and `south_flank` pointers were followed by Kari only. No natural question, and no chip, returned any converted item's key record. | Keep. Fix R13 and R14. |
| 3 | **Pointers are noticed but the kinds are unequal.** Followed: Kari 7/12, Laura 5/12, above the 15 % check. Both players chose by sender and kind noun ("P2", "perimeter survey" yes; "flight status", "sensor log", "replenishment order", "observations" no). Real pointers are harder to retrieve than decoys: shown at rank 1 for 16/48 natural follow-up forms against 33/48. | R14, B14 |
| 4 | **V7 `north_help`'s pointer is masked.** JOKE 16.36 "EK14:n viesti kirjattu" comes one minute after EK14's pushed 16.35 cottage question, so it reads as acknowledging that question. Neither player followed it. Both chose the key at confidence 25, without the record. | R13 |
| 5 | **The training transferred.** Questions that named a source: 11 hits, 11 partial, 6 misses out of 28. Questions that did not: 9, 3, 12 (+3 gaps) out of 27. Laura used the tour's examples verbatim 4 times; Kari asked by source and time 9 times. Hit rate: Laura 6/20 → 12/28, Kari 6/23 → 8/30. The record that should have come back was in the top 8 for 40 of 48 questions. | Keep. Pilot the model. |
| 6 | **The (bh) item fixes held:** V10 `infra` 2/2 at confidence 100; V5 `area_hour` 2/2; SPAM 3.b 2/2; `r1_arrival` 2/2. V4 `head_later` was 2/2, but only because both players counted the rate over a longer span (it is exploratory). | Keep. |
| 7 | **Every L1 miss (6 of 6) is a map point.** V5 `head_now`: both marks sit on Koivuoja about 300 m upstream of a key that lies at the Myllyoja–Koivuoja confluence. V12 `head_now`: both marks about 300 m short of the forest road; 1 right in 7 runs over the three rounds. | R17, R18 |
| 8 | **App content bug:** the four register reference records render as raw JSON in English and as "(reference)" in Finnish (lead a). | B11 |

### 11.2 Did this round's changes work?

**Scores, main session.** 55 items, practice and F7 excluded. The four converted slots changed wording, so the comparison is slot by slot.

| Run | All | L1 | L2 | L3 |
|---|---|---|---|---|
| K-fi, 23 Oct (Opus) | 47 | 14 | 14 | 19 |
| L-en, 23 Oct | 41 | 11 | 13 | 17 |
| K-en, 24 Oct | 45 | 14 | 13 | 18 |
| K-fi, replay | 49 | 16 | 14 | 19 |
| L-en, replay | 47 | 14 | 15 | 18 |
| **K-fi, round 3 (Sonnet)** | **45** | **14** | **13** | **18** |
| **L-en, round 3 (Sonnet)** | **48** | **16** | **12** | **20** |

- **L1:** all 6 misses are map points (Kari 215–334 m, Laura 263–309 m).
- **L2 misses:** `south_flank` (both), `hose_short` (Laura), SPAM 6.b (both).
- **Wrong at confidence ≥ 75:** Kari `south_flank` 75; Laura `hose_short` 75 and 6.b 75.

**H2 window** (23 items; V4 `head_later` exploratory; the earlier runs scored on the same slots):

| Run | S: right | S: mean confidence | S: gap | P: right | P: mean confidence | P: gap |
|---|---|---|---|---|---|---|
| 5 earlier runs (old wordings) | 8, 8, 8, 8, 9 of 9 | .50–.67 | −.22 to −.47 | 12–13 of 14 | .59–.77 | −.16 to −.34 |
| K-fi, round 3 | 7/9 | .53 | −.25 | 12/14 | .66 | −.20 |
| L-en, round 3 | 6/9 | .50 | −.17 | 14/14 | .64 | −.36 |

- The intended accuracy gap between S and P now appears.
- Every LLM run is underconfident (negative gap), so nothing can be read about H2 itself.

**The nine seek-dependent items:**

| Item | Earlier 5 runs | K-fi, round 3 | L-en, round 3 | How the key was reached in round 3 |
|---|---|---|---|---|
| V2 `south_flank` (converted) | 5/5 (old `lost` lure) | ✗ `flames` 75 | ✗ `flames` 50 | **Wrong by the default** (the stale pushed EK12 13.20 report) in both runs. Kari followed the pointer: "…JOKE vastaanotti klo 14.09? Onko linjalla vettä?" put the key `evt.c03.021` at rank 4, and the template showed EK12's 14.07 water status, so this is a template artefact. Laura did not follow it: her one question in the 40-second window went to DR3. |
| V2 `area_40` | 3/5 | ✗ 25 | ✓ 50 | Laura: DR3's 14.15 survey via its pointer, shown. Kari: no survey; extrapolated from 10.1 ha. |
| V2 `junction_hour` | 3/5 | ✓ 50 | ✗ 25 | Map only; Laura could not find the junction. |
| V2 `head_later` | 5/5 | ✓ 85 m | ✓ 138 m | Rate × clock, as training task 6 teaches. |
| V5 `hose_short` (converted) | 5/5 | ✓ 50 | ✗ `withdrawn` 75 | Kari: pointer followed; the key `evt.c07.032` was rank 2 (source label only), and the template showed EK11's 15.37 access line, from which he inferred "hose". Laura: not followed ("routine"), so **wrong by the lure** (the pushed 15.30 withdrawal). |
| V5 `reinforcements` (new) | (`wind_shift` 5/5) | ✓ 75 | ✓ 100 | **P2's pointer**, record shown at rank 1, in both runs. |
| V7 `north_help` (re-keyed) | 5/5 (old key) | ✓ 25 | ✓ 25 | Pointer heard, not followed (§11.5 m). Kari answered by analogy to EK11's access line seen in V5; Laura guessed. |
| V7 `rekindle_sector` | 5/5 | ✓ 50 | ✓ 25 | Reasoning or guess. |
| V7 `cp_safe` | 5/5 | ✓ 75 | ✓ 50 | The safe default. |

**Other changes:**
- **(bh)/(bi):** both runs right on `r1_arrival`, V10 `infra` (confidence 100), V5 `area_hour` and SPAM 3.b.
- **Template fallback (B6):** the age label appeared on 9 of Kari's answers and 11 of Laura's, and no record over 30 minutes old was marked "varma"/"certain". EK14's cottage questions were skipped as answers twice.
- **Consult notice (R6):** shown at 70 s in all six merged views for both players. Single-step views: shown only when the plan came after 60 s of view time (Kari 9/14 views, Laura 8/14).
- **Chip (B1):** drawn from V8 and used 3 times (§11.5 c).
- **Myllyoja rename:** both players still could not place the brook (§11.5 h).

### 11.3 Pointers

**Follow-up within the window:** followed = retrieved at rank ≤ 8; shown = rank 1.

| Window class | K-fi real | K-fi decoy | L-en real | L-en decoy |
|---|---|---|---|---|
| View start → freeze | 2/3 (V5 EK11, P2) | 2/3 (V2 EK14, V7 EK13) | 1/3 (V5 P2) | 2/3 (V2 EK14, V7 EK13) |
| Step boundary → freeze | 2/3 (V2 EK12, V12 SPOT) | 0/1 | 1/3 (V2 DR3) | 0/1 |
| View start → view end | — | 0/1 | — | 0/1 |
| Step boundary → view end | — | 1/1 | — | 1/1 |
| **All: followed · shown** | **4/6 · 1/6** | **3/6 · 2/6** | **2/6 · 2/6** | **3/6 · 1/6** |
| Median latency | 36 s | 45 s | 15 s | 36 s |

- **Manipulation check (≥ 15 %): passed by both** (58 %, 42 %). The real − decoy difference in the comparable classes is 0 and +0.67 for Kari, −0.33 and +0.33 for Laura; nothing can be read at n = 2.
- **Item classes before each item's moment:**
  - Followed: 7 item instances, 6 right. The miss was Kari's `south_flank`, key at rank 4.
  - Heard, not followed: 7, of which 4 right (`north_help` ×2 at confidence 25, `front_toward` from the pushed log, and Kari's SPAM 3.b).
  - Laura's `hose_short` at confidence 75 is exactly (bm) §4's pre-stated "heard, not followed → confident error" case.
- **V2's two real pointers share one 40-second window** (both delivered at 65 s, freeze at 105 s). At about 30 s per question, each player could follow only one: Kari EK12, Laura DR3.
- **Kari's SPAM 3.b counts as "heard, not followed",** although he retrieved the 14.15 survey at rank 2 while answering. `pointerItemClasses` ends the window at `spam_prompt_shown` (R16).
- **Pointers are never search results:** no pointer appeared in any retrieved list. The (bm) time gate works.

**Retrievability of the pointed record** (lexical, at each pointer's step; columns are top 8 · shown):

| Form | Real | Decoy |
|---|---|---|
| A: "Mitä EK11 ilmoitti?" / "What did EK11 report?" | 12/12 · 4/12 | 12/12 · 8/12 |
| B: echo of the kind ("Mitä EK11:n täydennystilauksessa oli?" / "What was in EK11's replenishment order?") | 7/12 · 4/12 | 11/12 · 5/12 |
| C: source + the pointer's clock | 12/12 · 4/12 | 12/12 · 10/12 |
| D: source + the record's clock | 12/12 · 4/12 | 12/12 · 10/12 |
| **All** | **43/48 · 16/48** | **47/48 · 33/48** |

- **Worst cases:**
  - EK11's "täydennystilaus" / "replenishment order" echo: rank 42 (fi) and 51 (en); "täydennys" matches the "veden täydennys" vehicle-location lines.
  - EK12's "tilanneilmoitus" / "situation update": rank 10 (fi) and 4 (en).
  - SPOT's "havainnot": not ranked (fi), rank 6 (en). "Mitä SPOT havaitsi?" shows SPOT 14.02, because "havaita" is not a reporting word.
- **Extremes:** P2 is shown in 8/8 forms; EK12 and EK11 in 0/8.
- **Why:** each real pointer points to a unit report in a minute crowded with the same unit's vehicle-location, "when asked" and lateral lines. Each decoy points to a unique record (sensor log, situation picture, EK13's only line).
- **Consequence:** under the pre-registered measure (rank ≤ 8) the kinds are nearly balanced; "shown" rates and template-fallback sessions are not.

### 11.4 Training and Haku

- **Asking by source and time:** Kari named a source in 18 of 29 typed questions and gave a clock in 9 (5 of them a pointer's clock). Laura named a source in 10 of 26, and used the tour's examples verbatim 4 times.
- **Following acknowledgements:** both followed JOKE lines because the tour's records step says to. Laura: "From period 2 on I treated 'acknowledged / received / logged' lines as a sign that there was something to ask for."
- **Practice lesson:** Laura: "That was the moment it became a working habit."
- **Map training:**
  - Lessons used later: road distance; the log is newer than the map (both marked V12's head from EK16 18.41, not the drawn edge); count from the latest report (V2 `head_later` 2/2).
  - Task 4 misled both players (§11.5 k).
  - Laura's 150 m errors on tasks 1 and 6 are a harness artefact (§11.5 b).
- **Tour example that misleads:** "What did DR1 report at 12.05?" shows DR1's 12.03 sensor log; the intended 12.05 record is rank 2 in both languages. Laura noticed ("slightly odd"). (bn) states that every example ranks first; that is untrue for this one (B13).

| Run | Questions | Hit | Partial | Miss | Gap | Record that should have come back: in top 8 |
|---|---|---|---|---|---|---|
| K-fi, 23 Oct | 31 | 4 | 7 | 13 | 6 (+1) | |
| L-en, 23 Oct | 25 | 7 | 3 | 12 | 2 (+1) | |
| K-en, 24 Oct | 32 | 9 | 6 | 17 | — | |
| K-fi, replay | 23 | 6 | 4 | 9 | 4 | |
| L-en, replay | 20 | 6 | 2 | 9 | 3 | |
| **K-fi, round 3** | **30** | **8** | **8** | **12** | **2** | **20/25** |
| **L-en, round 3** | **28** | **12** | **6** | **9** | **1** | **20/23** |

**New retrieval failures** (lexical; full list in `haku-round3.csv`):

| Question (step) | Shown | Should have returned (its rank) | Cause |
|---|---|---|---|
| "Mitä SPOT havaitsi ennen klo 18.43…?" (17) | SPOT 14.02 | `atom.demo.17.1` (6) | "havaita" is not a reporting word |
| "Mitä EK11 tilasi täydennyksenä, jonka JOKE vastaanotti klo 15.36?" (7) | EK11 15.37 access line | `evt.c07.032` (2) | same-source neighbours in the same minute; "tilata" is not a reporting word |
| "Onko EK12:lla perääntymistie ja tähystäjä kuusikon reunassa?" (5) | EK12 14.41 move | `evt.c05.020` 14.47, "Perääntymistie: oma auto" (16) | the "when asked" status loses to lateral lines. Kari concluded wrongly that nothing existed |
| "Milloin sammutushelikopteri saapuu?" (7) | VPK 12.04 "saapunut" | `atom.demo.1.0` (16) | the compound matches the vehicle-location lines' "sammutus" |
| "Onko uutta sääennustetta…?" (11); "Is there a new weather forecast?" (11) | 15.03; 13.21 | `evt.wx.04` (5; 6) | "uutta" / "new" is not a recency cue ((bi): undecided) |
| "Milloin tuuli ennusteen mukaan heikkenee illalla…?" (18) | 13.21 | `evt.wx.06` (5) | no recency word, and "ennusteen" does not name SÄÄENNUSTE |
| "Mitä tiedetään … uudesta palosta? Kuinka suuri se on…" (12, fi) | SPOT 17.01 | `atom.demo.12.1` (6) | the English twin ranks it 1 |
| "Where is the southern fire front now…?" (14) | 13.21 forecast | `evt.c14.008` (3) | "front" matches the weather front |
| "How far is the south-east front from road R2 now?" (19); the Finnish twin | EK12 19.22; DR2 17.21 | `evt.c19.009` "850 m" (14; 50) | distances in status lines are not matched |
| "What do the road reports say about road R1 south of Dry Heath?" (8), both languages | the 15.07 lure | `evt.c08.012` (3) | no recency word. In Finnish even "viimeisimmät tiehavainnot" ranks the lure first (key rank 2); the English "latest road reports" ranks the key first |
| "Mitä DR3:n edellinen kehäkartoitus näytti?" (4) | 14.35 survey | `evt.c03.035` (2) | the previous cue only cancels recency (D10 design) |

### 11.5 Leads, verified

**a. Raw JSON for the R3 bridge question: confirmed, an app content bug, not the harness.**
- The record is `ref.road.r1`: step 2, T2, recorded, source "register", clock 13.20. It is road R1's register entry (forest road, 32 t), not the bridge's.
- It is one of four `REFERENCE_FEATURES` in `app/scenario/demo-scenario.ts` (`ref.stand.spruce`, `ref.road.r1`, `ref.water.w1`, `ref.ditch.bog`). None has a human-readable text:
  - English shows `content/i18n/authored.en.json`'s "reference_road: {…}".
  - Finnish falls back to "(reference)" (`template-answer.ts` `recordText`).
- The model's record lines (`server/thinker/model.ts`) carry the same text.
- "Load limit" matched "load_limit_t". Read as the bridge's limit, "32 t" contradicts OUT1/OUT2 and V14 `infra`'s key. Laura ignored it.

**b. Training grid offset: confirmed, harness only.**
- `trainingSvg` (`map-training-overlay.ts`) adds a 28 px margin when `grid` is on and labels the grid in extract pixels. `freeze-grid.ts` labels the freeze map in the PNG's own pixels. The two harness grids follow different conventions.
- Laura read image pixels: task 1 (200,520) against the key (172,495) is a 28/25 px offset × 4 m, so about 150 m.
- Read by the labels, the grid is correct (Kari: 32, 2 and 1 m). The app's taps are unaffected (B12).

**c. The chip returns one record already in the log: template only, as expected.**
- The retrieval is D10's topic-free rule: the 8 newest gated records, newest first. In V8 those are KY23 16.58, then records back to 16.55 (3 of 8 pushed). The template shows rank 1.
- Design note: even the study model gets only the step's last 3–4 minutes, and the chip's own words ("kirjattu" / "records") suggest records the participant has not seen (R23).

**d. Stale forecasts: partly confirmed, from missing cues, not from the named-source rule.**
- The forecast records have source SÄÄENNUSTE (shown "Weather forecast" in English); their text opens "Ennuste: Ilmatieteen laitos…", which is why players call them FMI. Clocks and steps: 12.07 (−3), 13.21 (1), 15.03 (6), 16.01 (9), 17.01 (12), 18.01 (15). P2's 15.05 headline is pushed.
- Kari's "uusin sääennuste" (V11, step 14) returned 17.01, the newest reachable: **correct**.
- The 13.21 return was a different question (V13, "Milloin tuuli ennusteen mukaan…", no cue, source not named), labelled "epävarma (tieto klo 13.21)", not "varma". The debrief misremembers it.
- Genuinely stale returns: Kari's question 19 and Laura's question 17 ("uutta" / "new"), and Laura's question 22 (word sense).
- Laura's "latest forecast" at 14.40 returned 13.21, the newest reachable (15.03 is step 6).
- Language asymmetry: "Mitä uusin ennuste sanoo tuulesta?" at step 18 shows 15.03, while "What does the latest forecast say about the wind tonight?" shows 18.01 (B15, R21).

**e. Contacts water lags: app design, a presentation issue.**
- The Contacts pane's tank figure (`UnitWork.waterPct`, `app/scenario/types.ts`) is the tank at the step's start. EK12 was at 4 % at 14.00 (step 3). EK13 refilled it at 14.01 (VESIHUOLTO: 88 %); asked at 14.07 it was 77 %.
- The pane gives the figure no time, and the "last message" clock beside it (EK12 13.34) reads as the figure's time (B16).

**f. "7 km" spans 10.7 km: app design.**
- The preset is `extentCamera` (`MapView.tsx` `ZOOM_LEVELS` id `palo`): the whole study area, about 7 km tall. In the harness's 1000 × 680 px landscape frame it fits the height, so the frame shows about 10.7 km across. The label names the area, not the frame's width.

**g. Consult notice after consulting Haku: as specified (R6, `30` bi.1).**
- It depends on plans, not on Haku use. Kari's V2 notice came at 70 s after the boundary burst, which followed his Haku questions at 21 s and 51 s, and it was true.
- Suppressing it after a consult would tie exposure to tool use. Keep.

**h. Myllyoja and Koivuoja read as one brook: confirmed (map labelling).**
- In the contract (`content/site/contract.json`; site metres from the ignition) these are two brooks:
  - Myllyoja runs W–E at y ≈ 1.3–1.9 km.
  - Koivuoja runs from (480, 2800) and joins Myllyoja at (1922, 1554).
  - Near the crown run they run parallel 100–150 m apart.
- The V4 15.20 key head (1663, 1588) lies between them, about 260 m from the confluence.
- Labels: the basemap's "Myllyoja" is at (−1126, 1907), by Mökkiranta, 2.8 km west. The overlay's "Myllyoja" is at (2267, 1458), 600 m east, downstream of the confluence. The basemap's "Koivuoja" is at (969, 2435), 1.1 km north-west on the upper reach. **No label lies within 600 m of the crossing.**
- Both V5 `head_now` marks lie on Koivuoja about 300 m upstream of the key (Laura 16 m from the brook's line).
- The keys of V4 `korpioja_spot` and V5 `road_jump` agree (neither brook stops the fire). The felt contradiction comes from the records:
  - radio 7.3 (15.22): the wet banks stopped the fire;
  - radio 8.4 (15.43): "metsäautotien (Koivuoja)" stopped it;
  - radio 8.3 (15.42): embers crossed.
- R18.

**i. `hose_short`, "two true records": not confirmed.**
- At the freeze the log runs to 15.38. The latest EK11 state is the recorded 15.35 "palasimme linjalle… varaletkua alle 200 m" (the key). It supersedes the pushed 15.30 withdrawal (the designed lure).
- EK11's 15.37 line (carry the hose 350 m) supports "hose".
- The next withdrawal (15.41) is step 8, after the freeze.
- `tired` has partial support in EK11's recorded 15.33 lateral line ("porukka alkaa olla väsynyttä… vaihdetaanko suuttimet") but not for "needs relief at once".
- Kari never read the 15.35 text (rank 2), so the conflict is a template artefact.

**j. V4 `return_danger` lacks the wind-turn answer: confirmed as an expert's objection; the key stands.**
- The options are water, spot fires behind the crews (key), the head turning back, and exhaustion. P2's pushed 15.05 headline forecasts the turn for 15.30–16.00, the classic flank danger.
- PP1 behind EK11 at 15.30 supports the key. Adding the turn would create a second defensible answer.
- Over all rounds: 6 right in 7. Panel question (R20).

**k. Training task 4: confirmed, the picture misleads.**
- In the extract, the road at ★ (R7) and road R6 at fill point 1 both run off the top edge.
- The 6.4 km route to fill point 1 goes round the lake's south end and is drawn only in the feedback.
- From the picture a northern link is the natural assumption. Both players chose 1 (R19).

**l. R1 road items and the 20 kV item: confirmed, as designed.**
- V2 `infra`: both right at confidence 25 by inference from the pushed R1 crossing.
- V5 `infra`: both right from the pushed EK11 15.03 and EK12 15.07 lines.
- SPAM 6.b: 0/2; retrieval decides it (§11.4). Over all rounds: 2 right in 7.
- F7: both right by the default.
- Since (bn) the tour's list of record kinds no longer names road reports, so nothing reveals that they exist before 6.b's own wording (Laura learnt it there).
- One H9 exposure through noise: Laura's V6 question "Where is the fire heading now that the wind has turned?" pulled `f7.grid_record` to rank 8 through the word "fire". It counts as retrieved exposure and was never displayed (R24).

**m. `north_help`: did they get EK14's pointer? Confirmed: both received `atom.ptr.10.0` (16.36, window from the view's start to the freeze, 73 s); neither followed it.**
- In the log it directly follows EK14's pushed 16.35 cottage question (`evt.c10.029`): same source, same minute. Kari wrote that he took it for that question's acknowledgement. Laura judged it routine.
- The record is easy to find: "Mitä EK14 ilmoitti?" / "What did EK14 report?" shows it, because B6 skips the cottage question at rank 1. With the pointer's clock ("klo 16.36") it is rank 3.
- **Only this pointer has a pushed line from its named source in the minute before it** (R13).

### 11.6 Other findings

- **V12 `head_now`: 1 right in 7 runs.**
  - The key is the CA truth at 19.00, 32 m from the Honkaharju road. Both marks are about 300 m north-west of it.
  - The pushed stream gives EK16 18.41 ("approaching from the north-west, about 10 m/min; trigger at about 200 m") and EK16 18.47 ("we hold the road with sprinklers"), which implies the head was still ≥ 200 m away at 18.47.
  - The distances that place it closer (KY21 18.26: 100 m; DR2 18.47: 80 m) are recorded only.
  - `head_later` repeats the same offset (R17).
- **V14 contradiction probe** (unscored): Kari chose "none" and argued different places. SPOT 19.01 "uran itäpuolella" against EK14 19.02 "oma linjamme pitää" is a contradiction only if the flare is on EK14's line, and the pair does not say so (R26).
- **CO readings now exist** (`atom.demo.17.2`, EK16 18.45). Neither player asked about CO.

### 11.7 Remaining fixes

**Bugs:**
- **B11.** Register records: write readable fi/en texts naming the feature, for example "Tierekisteri (1.9.2024): tie R1, metsäautotie, kantavuus 32 t".
  - Where: `app/scenario/demo-scenario.ts` `REFERENCE_FEATURES`; `content/i18n/authored.en.json` (four `reference_*` strings); remove the `(${record.kind})` fallback in `app/session/template-answer.ts` `recordText`.
  - Then `npm run thinker:index -- --carry`.
  - Keep `ref.stand.spruce`'s designed register error.
- **B12.** Harness: label the training grid in PNG pixels as `freeze-grid.ts` does, or say "x,y = grid labels" (`map-training-overlay.ts` `trainingSvg`, `tools/play/commands.ts` `trainingAnswer`).
- **B13.** The tour's example "Mitä DR1 ilmoitti klo 12.05?" / "What did DR1 report at 12.05?" ranks `evt.vp.008` second (`evt.vp.006` first). Either replace it with an example that ranks first or correct `15` (bn) §1's sentence; and require rank 1 in `test/render/tour-records-step.spec.ts`.
- **B14.** Add havaita (havaitsi, havainnot), tilata (tilasi), observe(d)/observations and order(ed) to `REPORTING_FI` / `REPORTING_EN` (`app/retrieval/named-source.ts`). Dated `14` amendment; re-run `eval-playtest` with `haku-round3.csv` held out.
- **B15.** Make "ennuste" (all inflections) name SÄÄENNUSTE, and "forecast" alone name "Weather forecast" (`namesSource` aliases). This ends the fi/en asymmetry.
- **B16.** Contacts: date the tank figure, for example "vesi 4 % (klo 14.00)" (`app/render/ui/tak/shell.ts` `takContacts`, `ContactsPane.tsx`).

**Researcher decisions:**
- **R13.** Re-time `evt.c10.029` (EK14's pushed cottage question) to 16.33 or earlier, or move `evt.c10.028` and `atom.ptr.10.0` earlier.
  - Add to `validator.ts` #17: no pushed record from a pointer's named source in the 2 minutes before it.
- **R14.** Pointer kinds. Options:
  - (a) one neutral noun ("viesti" / "message") for all 12;
  - (b) make the kind nouns reporting words when a source is named, and require echo forms at rank ≤ 3 for all 12;
  - (c) pre-register follow-up by kind as a covariate.
  - Decide before pilot 2.
- **R15.** V2's two real pointers in one 40-second window: accept it and model the window (as (bn) does), or move V2's freeze later.
- **R16.** `pointerItemClasses`: for SPAM items, count questions up to `spam_answered`, not the prompt.
- **R17.** V12 `head_now` / `head_later`: push a distance at 18.4x, re-key to the latest pushed report, or ask the panel. Check EK16 18.47 against its own trigger.
- **R18.** Label both brooks near the confluence, about (1500, 1480) and (1700, 1660) site m, if `12` (al) allows; or name the confluence in KY21 15.22 / EK11 15.24. Send radio 7.3, 8.3 and 8.4 to `wildfire-fire-behaviour-check`.
- **R19.** Training task 4: say that the roads shown are the only links, or mark the top-edge roads as dead ends (`app/i18n/map-training-texts.ts`, `tools/review/map-training.ts`, `content/pretest/map-training.key.json`).
- **R20.** Panel: V4 `return_danger`.
- **R21.** Recency cues "uusi/uutta/uusin + (sää)ennuste" and "new (weather) forecast", left undecided in (bi). Evidence: Kari's question 19, Laura's question 17.
- **R22.** SPAM 6.b: fix the Finnish latest-state ranking for the R1 series, or analyse 6.b only conditionally (R11).
- **R23.** The chip: rank recorded-only records first for "records" wording, or accept.
- **R24.** H9 exposure: report it by rank band (1–3 / 4–8) or as displayed, beside (bn) S9's retrieved-only figure.
- **R25.** The previous cue: prefer the second-newest record of the named source or topic (SPAM 3.b's natural question).
- **R26.** V14 contradiction backup: add "EK14:n linjan kohdalla" to SPOT 19.01, or accept "none".
- **For the retrieval owner, with the model and the hybrid index:** the helicopter compound, EK12's LACES status, the distances to R2 at 19.20, the Finnish US1 size question. Use `haku-round3.csv` as a held-out set.

### 11.8 The Sonnet players and the limits

**Probably the model:**
- More questions (30 and 28, against 23 and 20 in the replay).
- Lower confidence; underconfident on both item classes.
- Kari lost `crown_drops` and `road_jump`, which all three Opus Kari runs had right; he took the single-record lure (radio 7.3).
- **Less accurate self-reports.** Kari's "uusin sääennuste returned a stale varma forecast" and "EK12 never reported a retreat route", and Laura's "every forecast question returned 13.00", were each wrong or overstated (§11.5 d, §11.4). Their "unfair item" lists were leads, not evidence.

**Not clearly the model:**
- Map precision: Kari missed four L1 points by 15–134 m over tolerance; Laura was within 74–138 m after the grid lesson.

**Like people:**
- They chose pointers by the sender and how important the kind sounded, skipped "routine" lines, and did not ask about the power line or smouldering before the freezes.

**Limits:**
- One run per cell, and a model change.
- Template Haku over lexical retrieval: "shown" here means rank 1, whereas the study model sees 8.
- The harness costs are DRAFT; 30 s per question caps V2's 40-second window at one follow-up.
- The verdicts in the three CSVs are DRAFT.

---

## 12. Round 4 on the training-incident version (27 Oct 2026)

Continued in `analysis-round4.md`, with `training-round4.csv`, `items-round4.csv` and `haku-round4.csv`.
