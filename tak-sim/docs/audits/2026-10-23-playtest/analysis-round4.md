# Play-test analysis, continued (round 4)

Continues `analysis.md` (§1–§10) and `analysis-round3.md` (§11). Contains keys: researcher only. Data: `training-round4.csv`, `items-round4.csv`, `haku-round4.csv`.

---

## 12. Round 4 on the training-incident version (27 Oct 2026)

**Runs.** Both were played on HEAD `da1904f` of `ccr-f481e62c-9ze866`, revision (bp), in the Haku cell `radio`. Both players were Sonnet, as in round 3.
- `playtest4/commander-fi`: "Kari", expert, Finnish. 13 training items plus S5. 56 main items (55 plus F7). 33 Haku questions (one was the chip), plus 3 in the training.
- `playtest4/business-en`: "Laura", public, English. The same, with 32 Haku questions (one was the chip), plus 3 in the training.

**Method:**
- The main session was scored with `npm run -s play -- score`. `score` does not read the `training_*` records.
- The training figures come from each run's replayed log (`replayRun`, then `session.o.logRecords()`) and from `trainingCovariates` (`app/telemetry/training-measures.ts`).
- The pointer measures use `pointer-measures.ts`, as in round 3.
- Ranks beyond 8 were recomputed offline: `hybridRetrieve` at the question's step with a larger top-k. Every recomputed top 8 matches the logged list.

**What changed since round 3:**
- The training incident replaces the map training and VP's practice freeze.
- VP is now the "first look".
- Six tour steps were rewritten (`15` (bp) §bp.5).
- The main session's records, items and keys are unchanged.

**Data** (beside round 3's files): `training-round4.csv`, `items-round4.csv`, `haku-round4.csv`. Their verdicts are DRAFT.

### 12.1 Summary

| # | Finding | Action |
|---|---|---|
| 1 | **Pointer follow-up collapsed.** Followed within the window (rank ≤ 8): Kari 0/12, Laura 2/12. Round 3: 7/12 and 5/12. Kari fails (bm)'s ≥ 15 % manipulation check. (bp)'s rewrite of the tour's `hakuRecords` step dropped round 3's sentence "When the command centre acknowledges a unit's report on the radio, the details are in the records". It also dropped the list of record kinds (round 3 transcripts: business-en l.670, commander-fi l.387; now `ui.ts` l.483 and l.682). The training never shows an acknowledgement. Kari read the JOKE lines as an information-flow failure (journal 395). Result: V5 `reinforcements` went from 2/2 via P2's pointer to guesses at 25 (Kari wrong). `hose_short` was wrong in both runs, at confidence 100 and 75. | R27 |
| 2 | **T6's head mark is drawn about 100 m west of its point.** `markElement` ("head", `app/render/ui/training-overlay.ts`) centres the whole label "▲ 10.12" on the point, so the triangle sits about 25 px to the west. Both players started their 300 m from the triangle: Kari 63 m and Laura 98 m west of the point. Their errors were 64 m and 100 m. The geometry itself is right: mark to key is 299 m. | B17 |
| 3 | **T13 (`s4.records`) is not a records item in practice.** T6's stem gives the rate ("nopeus noin 10 m/min", `training-texts-fi.ts` l.44), and T7's feedback quotes the record. Kari never saw `trn.r06` (his T7 search showed `trn.r08`), yet answered at confidence 100. Counted by how players reach the facts, records make up 2 of 9 items (22 %). That is below §bp.7's 30 % floor. | R28 |
| 4 | **The training's own stems miss their key records, one language each.** Asked as Haku questions, the Finnish S3.1 stem ranks `r08` first and `r06` second. The English S3.3 stem ranks `r03` first and `r07` second. Laura's T9 failed this way; her answer was right only by a guess at 25. The cause is a declared function word ("on" in Finnish, "are" in English). In a 12-record corpus such a word still carries BM25 weight once the named-source rule counts the record as matched. | B18 |
| 5 | **S5's Finnish limitation question reaches H10's records in the session.** Asked in a Finnish session from step 10, "Onko palo hallinnassa?" ranks `rekindle.in_hand.log` 2nd and `rekindle.overruled` 3rd. Those are the "L3 in hand" lure. "Is the fire contained?" retrieves none of them. Players do re-ask S5's questions: Laura did both in VP (her #1, #3). The taught-questions guard runs these questions on the training corpus only. | B19 |
| 6 | **S5 promises what the live template does not give.** The recording shows "Matala / Low … incomplete". The template showed unrelated records as "varma"/"certain": Kari T7, Laura T9, and Laura's VP #3 (S5's own question). The study model's prompt (rules 3 and 6) behaves like the recording. The template is still the study's fallback and the public demo's answer path. | R29 |
| 7 | **One real structural overlap.** The Finnish S3.2 stem "Mikä on tien R6 tila säiliöauton kannalta viimeisimpien tietojen mukaan?" copies the frame of V2/V5 `infra`: "Mikä on tien R1 tila Kuivakankaan eteläpuolella viimeisimpien tietojen mukaan?". It passes the four-word test only because the road code breaks every 4-gram. It brings back the R1 series' subject, which (bn) removed from the tour. No measurable effect this round. | R30 |
| 8 | **The training shows in Laura's questions, not in hit rates.** She named a source in 22 of 31 typed questions (round 3: 10/26) and a record clock in 7 (round 3: 1). She read every clock off an earlier BASIS line, which she says T9 taught her. Kari is unchanged (20/32; 5 clocks). Hits: Kari 10/33, Laura 13/32 (round 3: 8/30, 12/28). All 5 non-hits among the 12 record-clock questions were vehicle-location (AVL) lines winning the clock rule. | B22 |
| 9 | **The harness cues the training.** S3 cards print an open "-- Haku --" pane with its command, although the app keeps Haku closed to keep `seek_first` clean. S4's exposure omits "Remember where unit EK53 is." Both players searched before answering S3.1; `seek_first` is 1 for both, with a latency of 15 s, which is the harness's typing cost. | B20, B21 |
| 10 | **The training fits its cap.** It took 9.25 min (Kari) and 9.07 min (Laura) of 12, plus 60 s of S5. S3 was the longest section (3.1–3.2 min). All 20 choice answers were right (Laura's T9 by guess). | Keep; pilot 2 measures |

### 12.2 The training, item by item

**Time** (from `training_*` wall times; harness costs are DRAFT: 20 s per answer, 10 s per feedback, 30 s per search):

| | Kari | Laura | Target (`15` (bp) §bp.3, `09` (bp) §bp.4) |
|---|---|---|---|
| Intro + S1 | 150 s | 144 s | |
| S2 | 76 s | 76 s | |
| S3 | 193 s | 188 s | no section median over 3.5 min |
| S4 | 136 s | 136 s | |
| `durationMs` (S1–S4) | 555 s = 9.25 min | 544 s = 9.07 min | cap 720 s; expected 9–11 min with S5 |
| S5 dwell | 60 s | 60 s | outside the cap |
| `endReason` | completed | completed | |

Kari said "about 100 s left" (journal 186); the log shows 165 s left. Laura's "about 9 of 12" is right.

**Items** (✓ = right; the point error and confidence are first answers; rt = `training_answer.rtMs`):

| # | Item: what it teaches (§bp.4) | Key | Kari | Laura | What they used | Did the feedback teach it? |
|---|---|---|---|---|---|---|
| T1 | `s1.place`: find a named place | R5/R6 junction | 7 m, 23 s | 7 m, 20 s | map labels; Kari zoomed to 1 km | Yes: road codes are how reports name places (K j.20, L j.18). |
| T2 | `s1.measure`: measure a distance | about 300 m | ✓, R&B 279 m, 31 s | ✓, R&B 289 m, 28 s | R&B and scale bar | Yes, though both already knew. The zoom kept from T1 hid A until Kari reset the map (j.27). |
| T3 | `s1.slope`: fire and slope | towards B | ✓ | ✓ | Kari: doctrine. Laura: the primer and the stem. | Partly. Laura learnt "closer contours = steeper". Kari objects to a 3.1 % slope (§12.3). |
| T4 | `s1.water`: a road must reach the water | fill point 2 | ✓ | ✓ | map; the stem's "the only links" | Yes. Kari raises a realism objection (§12.3). |
| T5 | `s2.now`: the log is newer than the map | at R5 | ✓ | ✓ | DR8 10.12 in the log | Yes. Kari notes that "now = latest report" is a quiz convention (j.65). |
| T6 | `s2.project`: project by the clock | 300 m NE of R5 | 64 m, 28 s | 100 m, 28 s | both started from the drawn ▲ | The method, yes. The errors come from the misplaced ▲ (B17). |
| T7 | `s3.records1`: where the rest of the traffic is (`seek_first`) | 1.1 ha (`trn.r06`) | ✓ at 50, 55 s. Searched: `r08` shown, `r06` rank 2; estimated about 1 ha from the polygon. | ✓ at 75, 50 s. Searched the stem: `r06` shown. | the log has only EK51's 0.4 ha | Yes: both state "log = part; ask by source and time" (K j.99–100, L j.65). |
| T8 | `s3.older`: a record can be older; compare clocks | blocked (`trn.r09`) | ✓ at 100. Searched: `r09` shown. | ✓ at 100. Searched: `r09` shown. | the log line, plus a search "in case" | Only in words. Both used "latest", which ranks `r09` first, so the older-record lure never appeared. |
| T9 | `s3.records2`: status is filed when asked | four (`trn.r07`) | ✓ at 75. Stem asked: `r07` shown. | ✓ at 25, a guess. Stem asked: `r03` shown, `r07` rank 2. | the log's "two men on the line" | Yes. Laura: "the answer was behind the 10.08 basis item" (j.82). |
| T10 | `s4.memory`: memory on the blank map (`point_memory`) | EK53 on R6 | 24 m, conf 50 | 6 m, conf 50 | anchored on the road and lake; converted scales (the blank map is about 1.7× larger) | Yes. Kari did not know which unit to remember (B21). |
| T11 | `s4.log`: where a fact is in the log | DR8 | ✓ at 100 | ✓ at 100 | memory of DR8 10.12 | Yes: "sender and clock at the start of the line". |
| T12 | `s4.map`: what the map showed | south | ✓ at 100 | ✓ at 100 | map memory, plus the log text `trn.r03` "south of road R5" | Nothing new for either; the item can also be answered from the log. |
| T13 | `s4.records`: a fact that was in the records | 10 m/min | ✓ at 100 | ✓ at 100 | T6's stem and T7's feedback | No for Kari ("memory of the training text", j.168); partly for Laura ("nearly free", j.113). |
| S5 | one ordinary and one incomplete answer | — | 60 s | 60 s | both examples | Yes, and both saw that the live template contradicted it (K j.179–182, L j.119). |

**Covariates** (`trainingCovariates`):

| | Kari | Laura | Read |
|---|---|---|---|
| `point_visible` | 7 m | 7 m | The harness gives a pixel grid, so LLM errors are not human-like. |
| `point_memory` | 24 m | 6 m | Both converted between the two scales by arithmetic. |
| `seek_first.searchedBefore` | 1 | 1 | Cued by the harness's open Haku pane (B20), the S3 card ("Haku … käytössäsi"), the primer (Laura) and the stem's "DR8's latest survey". |
| `seek_first.seekLatencyMs` | 15 000 | 15 000 | This is the harness's `hakuType` cost, not the player's latency. |

**The training's Haku:** 4 of 6 questions showed the key. The two misses (Kari T7, Laura T9) are B18's stems; the study model would have seen the key at rank 2.

### 12.3 The players' claims, verified or refuted

| Claim | Verdict | Evidence |
|---|---|---|
| **K1.** T13 is answerable from T6's stem and T7's feedback, so the source mix is wrong. | **Confirmed.** | The T6 stem says "nopeus noin 10 m/min" (`training-texts-fi.ts` l.44; en l.42). T7's feedback quotes `r06`. T13's own feedback admits the second route. Kari's only T7 search showed `trn.r08` (haku-round4 t1), yet he answered T13 at 100 (log seq 44). The labelled mix is 3/9 (33 %); by route it is 2/9 (22 %). §bp.8's "no key in the stem" holds per item but fails across items. |
| **K2.** T6's feedback shows about 60 m between the drawn 10.12 marker and the stated 300 m. | **Confirmed, as a drawing offset.** | From `incident.json` items[5]: the s2_head mark is at (60.919358, 27.505605) and the key 299 m from it. The ▲ is drawn about 25 px west, because the label "▲ 10.12" is centred on the point (screen `commander-fi/screens/019`). Kari started at (655,578), 63 m west of the point; Laura at (647,574) (transcript #42), 98 m west. |
| **K3.** S4's live map shows calm wind; S2's scene shows SW 3 m/s. | **Confirmed. Harmless.** | Screen 029: "pohjoinen 000° · 0 m/s". Screen 019: "lounas 225° · 3 m/s". `memoryExposureScene` reuses the `s1` scene (`scenes.ts` l.86–90), whose wind is 0 m/s for S1.3. The incident is the same, at 10.18. (B25) |
| **K4.** T4 rules out a portable pump at the lake shore "by fiat". | **Confirmed as a realism objection. The key is right as worded.** | ★ is 246 m from water (`key.json` `starToWaterM`). Laying 250 m of hose by hand is routine (doctrine.md §5b: water first, more than 80 % of hose laid by hand). In the main session EK14's pump draws from a portable tank (`evt.c01.031`, `evt.c03.029`). The stem fixes the method ("a tanker brings it water by road"). The item is already on §bp.10's domain list. (R31) |
| **K5.** T3 asks about slope in flat terrain. | **Partly confirmed.** | The rise is 7.5 m over 240 m (3.1 %, `key.json`). boreal_fire_behaviour.md l.13: "in flat Finnish terrain slope matters little". With no wind, the direction B is right, but an expert can defend "equally fast". It is on §bp.10's list. (R32) |
| **K6.** The training repeats the main scenario's structure. | **Partly confirmed. One overlap is real; no change was measured.** | See the table below. |
| **L1.** T6 is confusing ("100 m off"). | **Confirmed. An app rendering bug, not her error.** | She started on the ▲ glyph, 98 m west of the point (K2). (B17) |
| **L2.** T10's blank map has a different zoom and no labels. | **Confirmed, by design.** | The live frame is about 4.4 m/px and the blank map about 2.6 m/px (screens 029/030): each map fits the square to its own size, as in the main session. The only printed name is "Narrow Lake"; road codes are hidden on purpose, and the feedback says so. Keep. |
| **L3.** Nothing in the training lists the record kinds. | **Partly refuted, but right about the tour.** | T7's feedback names "drone surveys, units' status and other filed information"; T9's adds "filed when asked". (bp) removed round 3's tour list ("weather forecasts … messages from other authorities") and the acknowledgement sentence. (R27) |
| **L4.** The 60 s card leaves room for only one search. | **Confirmed for the harness.** | A search costs 30 s (`costs.ts`). rt was 50–55 s with one search (log). For people it is unknown; pilot 2 measures `rtMs`. A miss is costly with the template, which shows one record. |
| **Both.** The first look's tour says "one question" but two came. | **Confirmed.** | `ui.ts` l.489/685: "You will try one in this first look." VP carries `practice-spam.ts` (W1) and `practice-measure.ts` (the R3 bridge). Both players answered two (K j.251–255; L j.157). (B23) |

**K6 in detail: training feature, main counterpart, round 4 against round 3.**

| Training | Main counterpart | Items it could affect | Round 3 → round 4 (K / L) |
|---|---|---|---|
| S3.2: the stem frame "Mikä on tien X tila … viimeisimpien tietojen mukaan?", a tanker, a blocked road | V2/V5 `infra` (the same frame in Finnish), SPAM 6.b | `2.infra`, `5.infra`, `probe.s.cycle_6.b` | 2.infra ✓✓ → ✗✓ (guesses at 25); 5.infra ✓✓ → ✓✓; 6.b ✗✗ → ✗✓. Laura's 6.b came from "latest road reports" (#18), the wording of her T8 search. |
| S1.4: a vehicle needs a road to the water | `north_help` "carry", the bridge, W1/W3 filling | `7.north_help`, `14.infra`, `4.infra`, `7.infra` | Unchanged; all at the same confidence (north_help at 25 in all 4 Sonnet runs). |
| S2.1/S2.2: "now" and projection from the latest report | every "latest reports" item; the `head_later` and band items | L1 "now" items, `head_later` ×3, L3 bands | L3 bands unchanged. head_later: K 1/2 → 0/2 scored; L 1/2 → 1/2 scored. |
| S3.1: drone surveys are in the records | DR3's recorded 14.15 survey | `2.area_40`, SPAM 3.b | Laura via the pointer in both rounds; Kari ✗ → ✓ by extrapolation. |
| S3.3: status "when asked"; "10 m/min NE"; head "at the road" | the "(kysyttäessä)" records; DR1/DR2 rates; DR1 13.22 | no keyed item | — |

The shared structure is the format being taught, and it is intended. The overlap that reaches a scored subject is S3.2's Finnish stem: it rehearses the exact R1 question frame that (bn) wanted to keep retrieval-dependent. In LLM runs this changed nothing measurable. For people, who search less, it is a cue that road states are a thing to ask about.

### 12.4 Transfer to the main session, against round 3

**Scores** (55 items, F7 excluded):

| Run | All | L1 | L2 | L3 | Wrong at confidence ≥ 75 |
|---|---|---|---|---|---|
| K-fi, round 3 | 45 | 14 | 13 | 18 | `south_flank` 75 |
| L-en, round 3 | 48 | 16 | 12 | 20 | `hose_short` 75, 6.b 75 |
| **K-fi, round 4** | **45** | **16** | **12** | **17** | `hose_short` 100 |
| **L-en, round 4** | **47** | **16** | **13** | **18** | `hose_short` 75 |

Kari's answers changed on 12 items (6 gained, 6 lost); Laura's on 3. The model is the same, so a change of 1 or 2 items is noise.

**H2 window** (gap = confidence − accuracy):

| Run | S right | S confidence | S gap | P right | P confidence | P gap |
|---|---|---|---|---|---|---|
| K-fi, round 3 | 7/9 | .53 | −.25 | 12/14 | .66 | −.20 |
| L-en, round 3 | 6/9 | .50 | −.17 | 14/14 | .64 | −.36 |
| **K-fi, round 4** | **5/9** | **.53** | **−.03** | **13/14** | **.66** | **−.27** |
| **L-en, round 4** | **6/9** | **.39** | **−.28** | **12/14** | **.70** | **−.16** |

**The nine seek-dependent items:**

| Item | Round 3 K / L | Round 4 K | Round 4 L | How the key was reached in round 4 |
|---|---|---|---|---|
| V2 `south_flank` | ✗ / ✗ | ✗ flames, 50 | ✗ flames, 50 | Neither followed EK12's pointer. Kari's "Mitä EK12 ilmoitti klo 13.50?" (#7) had the key `evt.c02.022` at rank 4, behind AVL 13.50. |
| V2 `area_40` | ✗ / ✓ | ✓ 50 | ✓ 50 | Kari extrapolated. Laura followed DR3's pointer (#9, rank 1). |
| V2 `junction_hour` | ✓ / ✗ | ✓ 50 | ✗ 25 | map estimate / guess |
| V2 `head_later` | ✓ / ✓ | ✗ 422 m | ✓ 114 m | rate × clock |
| V5 `hose_short` | ✓ / ✗ | ✗ withdrawn, **100** | ✗ withdrawn, 75 | Neither followed EK11's pointer, so both took the pushed 15.30 withdrawal (the lure). |
| V5 `reinforcements` | ✓ / ✓ | ✗ heavy, 25 | ✓ three, 25 | Neither followed P2's pointer; both guessed. |
| V7 `north_help` | ✓ / ✓ | ✓ 25 | ✓ 25 | guess; pointer not followed |
| V7 `rekindle_sector` | ✓ / ✓ | ✓ 75 | ✓ 25 | doctrine / guess |
| V7 `cp_safe` | ✓ / ✓ | ✓ 75 | ✓ 50 | the safe default |

**Pointers** (`pointerFollowUps`; followed = rank ≤ 8 in the window, shown = rank 1):

| | K round 3 | K round 4 | L round 3 | L round 4 |
|---|---|---|---|---|
| Real: followed · shown | 4/6 · 1/6 | **0/6 · 0/6** | 2/6 · 2/6 | **1/6 · 1/6** (DR3) |
| Decoy: followed · shown | 3/6 · 2/6 | **0/6 · 0/6** | 3/6 · 1/6 | **1/6 · 0/6** (EK14, rank 3) |
| All | 58 % | **0 %** | 42 % | **17 %** |

Item classes in round 4:
- Followed: 2 instances, both right (Laura's `area_40` and 3.b).
- Heard, not followed: 12 instances, 7 right. Both `hose_short` answers were wrong at ≥ 75, which is (bm) §4's pre-stated "heard, not followed → confident error" case, twice.

**Haku:**

| Run | Questions | Hit | Partial | Miss | Gap | Should-have record in top 8 | Names a source (typed) | Names a record clock |
|---|---|---|---|---|---|---|---|---|
| K-fi, round 3 | 30 | 8 | 8 | 12 | 2 | 20/25 | 18/29 | 9 (5 pointer clocks) |
| L-en, round 3 | 28 | 12 | 6 | 9 | 1 | 20/23 | 10/26 | 1 (the tour example) |
| **K-fi, round 4** | **33** | **10** | **8** | **10** | **5** | **24/27** | **20/32** | **5** (4 from PERUSTEET) |
| **L-en, round 4** | **32** | **13** | **7** | **8** | **4** | **27/27** | **22/31** | **7** (all from BASIS) |

- Pooled round 4, questions naming a source: 19 hit, 9 partial, 11 miss, 3 gap (42). Questions naming none: 4, 6, 5, 6 (21). Naming a source still helps, as in round 3.
- Record-clock questions: 7 hits in 12. The 5 non-hits were all AVL lines (K#5, #7, #23; L#5, #29). B22 explains the mechanism.
- Laura reused S5's examples in VP: #1 "How much water does EK11 have?" (a miss: VESIHUOLTO 12.12 at rank 2) and #3 "Is the fire contained?".

**New retrieval failures** (full list in `haku-round4.csv`):

| Question | Shown | Should have returned (rank) | Cause |
|---|---|---|---|
| L#5 "What did EK12 report at 13.28?"; L#29 "…OUT1 … at 18.35?"; K#5 "Mitä EK14 ilmoitti klo 13.34?" | AVL 1–2 min off | the when-asked status at the named minute (2) | The clock boost is flat within ±2 min, and a named clock un-collapses routine families (`hybrid.ts` l.142, l.401–402). |
| K#17 "Mitä EK14 on viimeksi ilmoittanut pohjoisreunan tilanteesta…" | AVL EK14 15.31 | `evt.c07.036` (3) | The AVL line is newest. |
| L#21 "What is the latest weather forecast for the evening: wind and gusts?" | 13.21 | `evt.wx.04` 16.01 (4) | Topic words beat the latest-state preference. Laura then believed nothing newer than 15.03 existed (journal 292, 306). |
| Training: the Finnish S3.1 stem; the English S3.3 stem | `trn.r08`; `trn.r03` | `trn.r06` (2); `trn.r07` (2) | A function word ("on", "are") scores in a 12-record corpus (B18). |

**L1 map points** (tolerance 200 m):

| Item | K round 3 | K round 4 | L round 3 | L round 4 |
|---|---|---|---|---|
| V2 `ek11_point` | 249 ✗ | 38 ✓ | 104 ✓ | 128 ✓ |
| V5 `head_now` | 312 ✗ | 128 ✓ | 263 ✗ | 247 ✗ |
| V10 `south_front_point` | 215 ✗ | 70 ✓ | 116 ✓ | 52 ✓ |
| V12 `head_now` | 334 ✗ | 410 ✗ | 309 ✗ | 247 ✗ |
| Right · median | 0/4 · 281 m | **3/4 · 99 m** | 2/4 · 190 m | 2/4 · 188 m |

**The lessons the players say they used, against their logs:**

| Lesson | In the log? |
|---|---|
| Ask by source and time | **Laura: yes.** 7 record-clock questions, 5 hits; her "8 times out of 10" (debrief l.12) is 5 of 7. **Kari: partly.** His debrief counts V9/V10 as source plus time, but #25, #26 and #28 named no time. |
| Read the BASIS clocks | **Laura: yes.** All 7 of her clocks came from earlier answers. **Kari: 4 of 5.** |
| Measure with R&B | **Laura: 6 times**, as she says: 2 in the training and 4 `tak_rb_measured` in the main session. **Kari: 3.** |
| Anchor blank-map points on names (T10) | **Kari: 3/4 L1 points** (round 3: 0/4). **Laura: 2/4** in both rounds. |
| Project from the latest report (T6) | **L3 bands: right** in both runs. **`head_later` points:** Kari 0/3, Laura 2/3. |
| Acknowledgement lines point to records (Laura, "like T9", journal 185) | **V2 only.** Not in V5, V7 or V12. |

**What is the model, what is noise, and what is the training:**
- **Design, not noise:** the pointer collapse. It is large in both runs, its mechanism is the removed tour sentence, and the players' own reasoning matches it: Kari read the acks as an information-flow failure; Laura inferred the cue once, from T9.
- **Probably the training:** Laura's wording (source and BASIS clocks); she cites T7/T9, and round 3's Laura used the tour's examples instead.
- **Unclear:** Kari's L1 points. He cites T10, but round 3's misses were only 15–134 m over tolerance, so small shifts flip them.
- **Noise:** totals, the S/P counts within ±2, and single-item flips (`return_danger`, `crown_drops`, `junction_hour`, Laura's 6.b).
- **The model:** both rounds used Sonnet, which is underconfident on both classes (all gaps negative). Nothing can be read about H2 itself.

### 12.5 Study validity

**a. Leakage.**
- No training key equals a main key: `key.json` against `review-packet/keys.md`.
- The subject overlaps are S3.2's Finnish stem (R30) and S1.4's fill-point and access subject (no measured effect).
- S5's Finnish question reaches the H10 arc in the session (B19). Over the session corpus, at every step:
  - "Onko palo hallinnassa?": `rekindle.in_hand.log` at 2 and `rekindle.overruled` at 3, from step 10.
  - "Is the fire contained?": nothing.
  - "Onko palo rajattu?": nothing in either corpus.
- `test/training/names.spec.ts` passes. Its four-word rule cannot see a frame whose only differing word is the road code.

**b. Does the training teach "always search"?**
- **The texts comply.** §bp.8's no-imperative rule holds, and Laura read the feedback as "where information is" (debrief l.25).
- **In Laura's words:** "T8 (the answer was in the log; the record was older) kept me from feeling 'always search'. But in the main session the constant 'New records' button, 'Ready to answer?' prompts and the tour text … pushed me to search each period anyway."
- **Her behaviour did not follow the words.** Both players searched on all three S3 cards, including T8, whose answer was in the log. Both searched in all 15 main views, as in round 3, so this is not attributable to the training.
- **Expect a ceiling on `seek_first` in people too.** The S3 card names Search; the S3.1 stem names a DR8 survey that the log lacks. `09` (bp) §bp.4 drops the covariate if it is near 100 %. (R34)

**c. S5 against the live tool:**

| S5 shows | The live template did | The study model would (`prompt.*.md`) | Which is it |
|---|---|---|---|
| An answer with no record says "Low / incomplete" | It showed an unrelated record as "varma/certain": K T7, L T9, L VP #3, K #4, K #10 | Rule 3 ("say so directly"); rule 6 ("Certain only when the newest records state the answer") | A template artefact. But the template is the study's fallback on proxy failure and the public demo's answer path. |
| The answer names its source and time | PERUSTEET lists 3 source labels; the answer is rank 1 verbatim | It answers from up to 8 records | Consistent |
| Recent = certain | B6's "epävarma (tieto klo …)" on records over 30 min old; Kari called it Haku's most useful signal (debrief l.28) | Rule 2 | Consistent |
| Asking by source and time works | It failed 5 times to AVL clock ties | The model sees both records (ranks 1–2) | A display artefact; the ranking is shared (B22) |

### 12.6 Remaining fixes

**Bugs:**
- **B17.** The training's head mark: draw "▲" centred on its point, with the label beside it (`training-overlay.ts` `markElement`).
  - Check the "point" mark (the dot sits about 6 px left of its point) and the "unit" mark (the symbol sits above its point) the same way.
  - Test: every mark's glyph centre lies within 3 px of its projected point. Re-check S2.2's margin "lure ≥ 100 m from the key".
- **B18.** Add each S3 stem verbatim, plus "Kuinka suuri palo on?" and "How big is the fire?", to `test/training/retrieval.spec.ts`.
  - Fix in the retrieval: a declared function word should add no BM25 score, not only no "match" (`function-words.ts`, `hybrid.ts`).
  - Then check the main corpus (dated `14` amendment).
- **B19.** S5's Finnish limitation question → "Onko palo rajattu?". Run the taught-questions guard over the session corpus at every step for every training question, in both languages (`taught-questions-guard.spec.ts`). Parity counts change (`30` (bp) §bp.1.3).
- **B20.** Harness: do not print the "-- Haku --" pane on S3 cards until `haku` is used (`tools/play/training-pages.ts` l.138–141).
- **B21.** Harness: print `ui.memoryExposure` during S4's exposure (`training-pages.ts` l.98–99).
- **B22.** Clock rule: grade the boost (exact minute > ±1 > ±2), and keep routine families collapsed unless their own minute is named (`hybrid.ts` `clockMatch`, `withRecordsAtClock`). Dated `14` amendment; re-run `eval-playtest` with `haku-round4.csv` held out.
- **B23.** The tour's `spam` step: "You will try two in this first look" (or "one prompt with two questions"); `ui.ts` l.489/685. Native check.
- **B24.** The tour's `decision` step says "Confirming the allocation ends the period" (`ui.ts` l.485/683). Before `minViewSeconds` it does not: Kari confirmed V3 at 70 s and the view ended at 124 s. Reword.
- **B25.** S4's exposure info card shows "N 0 m/s": show the incident's wind or no wind card (`scenes.ts` `memoryExposureScene`).
- **B26.** Check that the live map returns to the opening frame at each new S1 item. The harness kept T1's 1 km zoom into T2, which hid A (K j.27).
- **Still open from round 3:**
  - B11: raw JSON register records; `ref.water.w1` at L#12 rank 7, `ref.stand.spruce` at L#14 rank 8.
  - B14: `REPORTING_FI` is unchanged.
  - B15: "ennuste" still names no source (K#30, #33).
  - B16: Contacts still shows "Vesi 33 %" with no time.
  - B12 and B13 were retired with the map training and the tour examples.

**Researcher decisions:**
- **R27.** Restore the acknowledgement cue before pilot 2. Options:
  - (a) put round 3's sentence back in `hakuRecords`, fi/en;
  - (b) teach it in the training after `seek_first`, for example in S3.3's feedback, with one JOKE-style line in S3's log after 10.08;
  - (c) accept lower follow-up and re-state (bm)'s 15 % check.
  - Evidence: 0/12 and 2/12 followed; V5 pointer items fell to guesses or the lure.
- **R28.** T13. Options:
  - (a) take the rate out of T6's stem (state the head at R5 and give the rate as "the rate DR8 measured" only after S3);
  - (b) ask in S4 about a filed fact that no feedback before S4 quotes, such as EK52's 60 % (`trn.r10`); this is seek-dependent like the main items, which Laura asked for (debrief l.34), but it tests searching before a memory check;
  - (c) keep it, recount the mix as 2/9 and add §7.37 item 3's tenth records item.
- **R29.** The template fallback: show "epävarma / not found" when the shown record shares no content word with the question (`template-answer.ts`). Or accept, and report the answer source by session (`09` (bp) §bp.4's last row).
- **R30.** S3.2's Finnish stem: choose a subject outside the scored set, or accept and analyse V2/V5 `infra` and 6.b conditionally (R11, R22).
- **R31.** S1.4: move ★ beyond a hand-laid hose distance from the lake, or remove the pump (a tanker that must refill). Domain reviewer (§bp.10).
- **R32.** S1.3: a steeper B, or the panel decides whether "equally fast" is defensible at 3 %.
- **R33.** H10's plan measure. Kari moved L3 into his V7 plan after the V7 freeze and wrote that its rekindle item prompted it (journal 641). Pre-register reading H10 plans committed before V7's freeze (`sectorAnticipation.first.afterFreeze`).
- **R34.** `seek_first`: it was 1/1 here, cued by the harness, the card and the stem. Decide now whether to drop "Haku" from the S3 card's first sentence, or accept the risk of a ceiling.

**Main-session issues raised again (only what is new since §11.7):**
- **Log burst after an early confirm** (R6 stands).
  - Two-step views: Kari confirmed before the 65 s boundary in 4 of 6 (V6, V11, V12, V14) and revised 2 (V4, V12). Laura confirmed before it in 2 of 6, plus 2 within 5 s after (V2, V4), and revised 1 (V4).
  - New: the tour's own sentence misleads (B24), and the training says nothing about it (L debrief l.14).
- **Requests with no answer channel.** Not new (D11). The tour's `decision` step already calls them context; Kari quoted it (journal 751) and still listed it as his fourth unmet need.
- **The chip.** Not new (R23).
- **AVL beacons.** New mechanism and evidence: B22.
- **Mill Brook.** R18 is open. New: both players asked whether people live there (K#16 "Onko Myllyojalla asutusta…", L#15 "Are there homes at Mill Brook…"). Laura first read the NE label as a village (journal 238). Add the name to R18.
- **H9 and H10.**
  - Never displayed, but retrieved three times: H10's objection at rank 6 in K#20 (V7, before the freeze, via a police question: noise) and at rank 3 in K#32 (V13); H9's planted record at rank 4 in L#30 (V13).
  - Laura did ask about the line, but only after F7 asked her (journal 360). Before F7, neither player did, as in every round.
  - By (bn) S9's retrieved-only rule, Kari counts as exposed to H10 through noise. This supports R24's rank bands.

### 12.7 Limits

- **Sample.** One run per cell. The model is the same as round 3, but Kari changed 12 item answers with no net change, so one-run differences are mostly noise.
- **Template Haku.** "Shown" means rank 1, while the study model reads up to 8, in the training too (`14` (bp) §bp.1). Most misses here would be answers with the model.
- **The harness inflates the covariates.** It gives a pixel grid, so point errors of 6–24 m are arithmetic, not tapping. Its costs set the training's length (20 s per answer, 30 s per search) and `seekLatencyMs` (15 s). Its open Haku pane and missing exposure line cue S3 and S4.
- **LLM diligence.** Both read every log row, searched in every view and mined BASIS clocks. Pointer follow-up and search rates for people may be lower still.
- **Self-reports.** Kari's "about 100 s left" (it was 165 s), his source-plus-time list (it included topic-only questions) and Laura's "8 of 10" (it was 5 of 7) were each overstated. Their claims about items were leads, checked above.
- **No real-time pressure.** `look` is free.
