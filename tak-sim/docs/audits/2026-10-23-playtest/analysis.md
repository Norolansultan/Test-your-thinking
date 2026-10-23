# Play-test analysis, 23 Oct 2026: two LLM players against the keys

**Status:** analysis only. Nothing in `app/`, `content/`, `server/` or the item banks was changed. **Contains answer keys: for the researcher and the panel only.**

**Harness fixes since this analysis (24 Oct 2026):**
- The harness no longer prints item or option ids; options are lettered as in the app.
- The live-list bug that hid every new log message is fixed: new messages are reported, and runs started from now on stop `wait` at them.
- A SPAM card that closes is announced.
- `score` says how a Haku record reached the player: the rank-1 text, a source label, or retrieved but not shown.

The findings below are on the runs as played, before these fixes.

**Runs** (played on branch `ccr-f481e62c-9ze866`; scored with `npm run -s play -- score`):
- `commander-fi`: "Kari", expert version, Finnish. 31 Haku questions.
- `business-en`: "Laura", public version, English. 25 Haku questions.

Both runs are in the session scratchpad `playtest/<run>/`: `journal.md`, `debrief.md`, `transcript.md`, `score.md`, `score.json`.

**Basis:**
- the keys and the corpus (`npm run review:export` into a scratch folder);
- the difficulty audit `docs/audits/2026-10-23-difficulty/` and `tools/review/difficulty-audit-hand.ts`;
- the wildfire skills: `sagat_rules.md`, `wildfire_sa_requirements.md`, `doctrine.md` and `boreal_fire_behaviour.md`.

**Files here:**
- `items.csv`: one row per item, 61 rows. Each row has both answers, the basis each answer rested on, the id-hint class, any stem or order cue, the verdict and the recommended action.
- `haku.csv`: one row per Haku question, 56 rows. Each row has the top record, a judgement and the record that should have come back.

**Contamination, accounted for throughout:**
1. The harness printed every freeze item's id (`[freeze.5.ek14_shelter]`) and its option ids. The app shows neither. Six ids name the key or its gist; five more rule out options.
2. Haku was the template fallback over lexical retrieval. It shows the text of the rank-1 record and three source labels. The study runs a model over hybrid retrieval, and the model sees all eight records.
3. A harness bug hid every new log message (finding 2).

---

## 1. Summary: the most important findings

| # | Finding | Evidence | Action |
|---|---|---|---|
| 1 | **The freeze's "now" contradicts its own keys in phase A.** The header says "The clock stopped at 14.00. 'Now' means this moment." The L1/L2 keys, though, rest on that step's records, stamped up to 17 min later. Haku's model is told "records received up to …", with ages counted to the period's **end**. At V12 the reverse happens: the header says 19.00, but `head_now` is keyed to the head as drawn at step 16 (≈18.20–18.40). | `freeze-answers.ts` `freezeNowClock` (start of the last step); `ui.ts` `freezeNow`. `freeze.4.ek12_where` is keyed on `atom.radio.6.1` (EK12, 15:01) under the header "15.00". `freeze.5.hose_short` (15:35) and `lines_breached` (15:22) sit under "15.20". SPEC/14 l.687 and revision (an): ages are counted to the period end. `freeze.12.head_now`: both players were marked wrong, 327 m and 268 m off, both displaced SE by about 40 min of spread. SPEC/08 y.1 already lists the map-item half as open (`11` §7.18). | Researcher decision (D1). Cheapest consistent fix: phase-A stems say "according to the latest reports" instead of "now", the header names the period's span, and V12 `head_now` is keyed at 19.00 or asks where the map last showed the head. |
| 2 | **The "unseen messages" complaint before the V2 and V4 freezes is mostly a harness bug, on top of a real 37–40 s lead.** The step-boundary bursts (14 messages at 65 s in V2, 13 in V4) were in the log before the freeze; the harness never announced them. | `session.snap()` returned the orchestrator's live `radioLog` array (`orchestrator.ts` l.437), so `changeLines` always computed `fresh = 0`. Neither transcript contains "new message(s) in the log" even once. Commander transcript #57–#60: `plan` crossed 63→73 s, printed only "Haku: [Uusia kirjauksia]", then `wait` stopped at the freeze; look #70 shows 14 new messages stamped 14:01–14:17. Laura #106–#108 show the same in V4. | **Harness bug: fixed 24 Oct 2026.** **Design:** audit §4.3 stands. The 8 late items measure reading speed under the open plan (D2). |
| 3 | **The second SPAM item has a hidden 60 s answer window, and the tour says it waits.** Both players lost `probe.s.cycle_3.b`: two Haku questions took 60 s and the card vanished. | `SPAM_ANSWER_TIMEOUT_MS = 60_000` (`demo-probes.ts` l.388); `spam-delivery.ts` `arm`/`answerTimedOut`. `SpamCard.tsx` shows no timer and no expiry text. Tour (`ui.ts` l.656): "The question waits for you … it does not go away" (meant for the ready prompt). | **App text bug:** tour and card text. **Design:** show the remaining time; consider 90–120 s for the retrieval-dependent second items (D4). |
| 4 | **L1 is the hardest level for both players, the reverse of SA theory.** Kari scored L1 14/18, L2 15/16, L3 19/22; Laura scored L1 11/18, L2 14/16, L3 17/22. Map points account for 7 of the 11 L1 misses. The rest are the "now" timing (V4 `ek12_where`) and one ambiguous key (V10 `infra`, missed by both). | `score.md` for both runs. The V10 `south_front_point` tolerance is 100 m; the misses were 112 m and 199 m on a blank basemap. | Treat L1 scores as map reading plus timing until the items in §5 are fixed. Raise V10's tolerance to the others' 200 m. |
| 5 | **Several items are answerable from stems, ids or option scales rather than from the situation.** This breaks `sagat_rules.md`: queries must not cue the answer to other queries or reveal unseen information. | V2 Q2 `ek11_between` reveals the new fire and says EK11 works there, which is the key of Q7 `ek11_point`. V4 Q4 states the withdrawal, the key of Q2 `ek12_where`; Laura answered "from the question's own wording". V4 Q6 `crown_drops` reveals the crown fire, and its key option names a broadleaf strip no surface states. V10 `area_total_hour`'s bands (<143 / 143–155 / 155–167 / >167) reveal a magnitude of about 150 ha to someone whose last figure is 76 ha. | Reword the stems (D3). Recast V10 `area_total_hour` (audit top problem #1, confirmed). |
| 6 | **Haku failed for most natural questions; recency and time-of-record are the gap.** Kari: 4 hits, 7 partial, 13 misses, 6 content gaps, 1 unanswerable. Laura: 7, 3, 12, 2, 1. In 22 of the 32 failures where a right record exists, it was in the lexical top 8 at ranks 2–8, but the template shows rank 1. The "source + time" trick both players invented works only when the clock is in the record text. | `haku.csv`. "Mitä VPK ilmoitti klo 17.24?" returned VD1's battery log, which contains "17.24"; the right record is `evt.c13.008`, VPK 17:24. Every "latest forecast" question at V8 returned the 12.00 or 15.00 forecast (`evt.wx.04` at ranks 3–8). | Pilot the study model on these exact questions (`haku.csv`). SPEC/14: recency for "latest/newest", and source and clock in the indexed text (D10). |
| 7 | **Retrieval-dependent items reward the default, not the search.** SPAM `cycle_6.b`'s key, "no change", is what a non-searcher assumes. Kari found no road report and was right by default. Laura searched: the designed lure (DR2 15:07, `evt.c06.022`) came first and the key record (`evt.c08.012`) fourth, so she was wrong. F7's key, "the line is live", is the doctrinal default the public primer teaches. Both players were right without ever seeing a line record. | `score.md`: F7's key records were never shown to either player. | Score `freeze.12.f7` for H9 only, not in the SA composites. Panel question on 6.b (§5). Pilot the F7 exposure rate. |
| 8 | **V7 and V14 are at ceiling; V2, V4, V5, V10 and V12 hold the variance.** Both players scored 8/8 on V7 and 6/6 on V14. Much of the variance comes from findings 1–5. | `score.md`; the audit's `summary.md` lists V14 as 6/6 passive. | Keep V7/V14 as anchors, but do not read V7–V14 differences as SA change until findings 1–5 are fixed. |

**Scores.** Of the 56 scored items, Kari had 48 right and Laura 42; each lost V3.b to the timeout. I discounted correct answers that rest on the id, a stem or the option scale, made without the basis. That leaves about 44 for Kari and 39 for Laura:
- Kari: `ek11_between`, `ek14_shelter` (he flagged it himself), `cp_safe`, and `area_total_hour` (the option scale);
- Laura: `ek11_between`, `head_unattended`, `cp_safe`.

Correct answers at confidence 25 are self-declared guesses: Kari `2.infra`, `10.area_total_hour`, `2.head_later`, `12.head_later`; Laura `2.area_40`, `4.crown_drops`, `2.head_later`, `12.head_later`.

---

## 2. The players' leads, verified

| Lead | Verdict | Evidence and meaning |
|---|---|---|
| 1. The V2 freeze ("klo 14.00") and the 15.00 freeze ask about messages stamped 14:01–14:17 and 15:01. ("V5 freeze (15.00)" in Laura's journal is the app's V4: her view numbering counts the practice.) | **Confirmed as an app inconsistency.** The records arrive before the freeze; the players' blindness was **harness-only**. | The records are delivered in bursts (`orchestrator.ts` `deliverPushed`): V2's step-3 records at 65 s with the freeze at 105 s, a 40 s lead; V4's step-6 records at 65 s with the freeze at 102 s, a 37 s lead. V5 and V7 push everything at 0 s, but the clock still reads 15.20 and 16.20 while the log runs to 15:38 and 16:37. The freeze header defines "now" as the clock on screen, the start of the view's last step (SPEC/08 y.1, `31` F13). The L1/L2 keys rest on that step's later-stamped records, and the briefing says each period "sums up 20 or 40 minutes". Laura's `ek12_where` = "spruce edge" is right by the stated "now". The map adds to it: a merged view draws its first step's fire, so the drawn fire lags as well (Kari V2, V9, V13). |
| 2. A SPAM question (V3, item 2 of 2) disappeared while the player asked Haku twice. | **Confirmed as app behaviour, not shown to the participant**, plus a harness reporting gap. | There is a 60 s answer window per item (`demo-probes.ts` l.388); item 2 opens the moment item 1's confidence is given (`spam-delivery.ts` `itemDone`). The card has no timer and no expiry text (`SpamCard.tsx`). The tour's "The question waits for you … it does not go away" describes the ready prompt, but readers apply it to the question. Laura's single Haku question at V6.b (30 s) did not lose the item, which fits a 60 s window. The harness's 30 s per Haku question is a DRAFT cost (`costs.ts`), so the real loss rate is a pilot question. |
| 3. Haku returned records stamped later than the newest log message and the view's clock (EK12 14:58 at 14:40; TILANNEKUVA 18:55 in V12). | **Confirmed as intended; not a leak beyond the step.** | `time-gate.ts` makes a step's records reachable from the step's start (SPEC/26 §2). SPEC/14 l.687 states that "records received up to" can be later than the client's clock; the model counts ages to the period end (revision (an)). The pushed log has the same horizon: every pushed record of a step arrives in one burst. **Meaning for the study:** Haku cannot see beyond the period, but it appears to see the future relative to the screen clock and the freeze's "now". Before a phase-A freeze it can return key records stamped after the header's "now": `evt.c03.018` (14:06) for `2.infra`, `evt.c06.003` (15:01) for `4.infra`. Same fix as lead 1: one definition of "now". |
| 4. The planted 20 kV record (H9) and VPK's 16:21 smouldering warning were never seen, yet V12 asks about the line. | **Confirmed. It is the intended H9 design, but the item does not measure SA.** | The F7 records are all recorded only: `f7.grid_record` (step 6), `f7.planted_record` (step 8, JOHTOPAIKKA 15:46), `f7.heli_line_clearance` (step 9). No pushed record mentions the line before V12. The audit's hand row (`passive: no`, "verification item by design") and SPEC/01 (aa) agree: H9 is read among the exposed, with an intention-to-treat headline. Because the key is the safe default, unexposed participants score "correct" (both did), so the item adds noise to V12's L2 accuracy. VPK's objection (`rekindle.objection`, step 10) is likewise recorded only by design (H10); no item needs it. Laura asked about the line only after the freeze; the planted record was 4th and not shown. |
| 5. Numeric projections: are the figures (area, ROS) in the log? | **Confirmed for V10 and V2, not for V5.** | Pushed area figures: 0.6 ha (VP), 10.1 ha (13:20), 24.3 ha (14:35), 76.4 ha (15:35), then SPOT "about 160 ha" (step 17) and "about 170 ha" (step 18). **No area figure exists in any tier between 15:35 and 17:35.** The 17:35 DR3 survey (153.6 ha, `evt.c13.034`) is recorded only, and the key treats it as the lure. So `10.area_total_hour` has no basis without a search, and with one the participant finds the lure. `2.area_40` needs the recorded 13.55 and 14.15 surveys or a geometric estimate. `5.area_hour` has its figure pushed (76.4 ha, 35.8 ha new). `2.junction_hour` has no distance anywhere: it is map only, and both players chose the lure. `10.front_r2_80` has "a good kilometre" pushed, with the rate drawn or recorded (SPOT 17:10, 3 m/min). |
| 6a. Freeze 5, Birch Creek ("Koivuoja"): does the log support three options? | **Partly confirmed: hard, not mis-keyed.** | At the 15.20 freeze the log supports the designed lure (KY21 15:22: wet banks stopped the surface fire along 100 m) and the key (spot fires PP1/PP2 already beyond the creek; crown-run embers at 200–400 m). The id `road_jump` is a leftover from before SPEC/33's rebuild, harmless in the app. Panel question in §5. |
| 6b. Freeze 2, spruce: is "slows, moist floor" defensible? | **Partly confirmed.** | `boreal_fire_behaviour.md` (KAL 4.4–4.6): dense spruce on rich sites dried slowly and burned as surface fire, no active crown. The only pushed description is "tiheä kuusikko" (DR1 13:41), with no site type or slash. The key is the right default for 27–29 °C, RH 25–30 % and a fire warning, but an expert can defend the distractor. |
| 6c. V14 contradiction probe, pair a. | **Not confirmed.** | The key is the SPOT/EK14 pair (`demo-probes.ts` `CONTRADICTION_BACKUP_AUTHORED`). Pair a is a designed non-contradiction. Both players chose the key. |
| 6d. "Alder Creek" is far from the head on the map. | **Confirmed (map labelling).** | Korpioja is one long brook running from west of Bear Lake east across the north of the fire. Its one label in the opening frame sits by the Lakeside Cottages, and the crossing ahead of the crown run has no label nearby. |
| 6e. The wind label "E 165°" reads as east. | **Confirmed (Finnish UI only).** | `ui.ts` l.521: in the Finnish compass E = etelä (south). Kari read it as east for a moment. The English UI shows "S 165°". |
| 7. Finnish strings in the English UI; the "From From" typo; no glossary entry for "burnout". | **Strings: harness-only. Typo: app data. Burnout: app content gap.** | The Finnish strings are in `tools/play/screen.ts`. For OUT1/OUT2, `unit-roster.ts` has `from: "From outside the region"` under the label "From", so the app shows "From: From outside the region" (`HelpCard.tsx` l.201). Neither glossary has burnout/taustapoltto (4 records), trigger point/laukaisupiste (4) or release rule/vapautussääntö (`atom.radio.10.3`, a V7 key record). |
| 8. The plan form cannot capture key decisions. | **Design observations (D11).** | |

---

## 3. Per view

Abbreviations:
- **C** commander, **N** novice; **P** pushed, **R** recorded only.
- Haku results: ✓ hit, ½ partial, ✗ miss, ∅ no record exists at that step.
- Item verdicts: OK; HF = hard but fair; U = unfair; A = ambiguous; MK = mis-keyed; T = timing; Cu = cued.

| View | Natural needs: C / N | On screen | Haku (who: question → result) | Items: answers K/L, verdict |
|---|---|---|---|---|
| **VP 12.00** | C: head, ROS, flame length, crews' escape routes, water, the wind turn, values. N: "what is happening"; the forecast, because the tour says so. | 13 P at 0 s (to 12:18); small fire on the map. | Both asked for the forecast: ✓ `evt.wx.01` rank 1. The practice search lesson works: both found the forecast item answerable only by search and said so. | 5/5 each. `r1_arrival` OK: both computed 320 m ÷ 4 m/min. The first doubt about "now" (clock 12.00, log to 12:18) starts here. |
| **V1 13.20** | C: head over R1 at 8 m/min with 3–4 m flames (attack mode), EK11's safety at the head, water, **air support**, the directive's "forest road and bog". N: water left (the primer stressed it), "new reports". | P2 directive and 18 P. Contacts show water %. | K: helicopter ∅ (no request or ETA record before 15:39); EK12 hose ½. L: water % ✗ ×2 (the T3 "when asked" records `evt.c01.020/.024/.035` were ranks 2–5, and Laura never opened Contacts, which shows water %); "new reports" unanswerable. | No probes. |
| **V2 13.40→14.00** | C: the spruce ahead (crown risk), spotting, EK11 50 m from the head, EK12's pressure, air support. N: crown risk; "latest drone reports". | 4 P at 0 s, then **14 P at 65 s** (spot fire on the esker, EK11 moves there, water almost out). The harness hid the burst. The map keeps step 2's fire; units move at 65 s. | K: air support ∅; spots ahead ✗ (`evt.c02.006/.009` R). L: crown risk ½ (only DR1 13:41 exists); latest drone reports ✗ (DR1 14:06 road report rank 7). | K 6/8, L 5/8. `ek11_between` Cu/T: both right from the stem, neither saw the records. `south_flank` OK. `area_40` HF (no area pushed since 13:20). `spruce_behaviour` A for experts. `junction_hour` HF/map: both chose the lure. `ek11_point` U: both placed EK11 at its 13:40 spot, 352 m off, although Q2's stem said EK11 was on the esker. `infra` HF. `head_later` OK. |
| **V3 14.20** | C: EK11's safety on the esker, water everywhere, growth, a nearer water point. N: a nearer water point; the SPAM's survey. | 12 P (24.3 ha; tanks 4–25 %). | Both asked for a nearer water point ✗: `evt.c03.025` (EK13 filling at W3, the R3 bridge) was rank 8 for K and absent for L. Both asked for the previous survey ✗ (the 14.35 survey ranked 1, the 14.15 one 2–3), then asked "DR3 … 14.15" ✓. | SPAM 3 OK (both). SPAM **3.b lost by both to the 60 s window** while searching for its key record. |
| **V4 14.40→15.00** | C: is the head in the spruce, crown fire → crews out (EK12 moving to the spruce edge at 14:41), escape routes, water, timing of the wind turn. N: has the water basin arrived. | 4 P, then **13 P at 65 s** (crown fire, withdrawals, 14.1 m/min). The harness hid the burst; Kari read it with `look`, Laura did not. | K: EK12's position and escape ✗ (`evt.c05.020` EK12 when asked; got the 14:58 hose-pressure line); wind-turn timing ✓ `wx.02`. L: basin ✗ (`evt.c05.019` rank 3), then "Water supply at 14.47" ✓. | K 7/8, L 6/8. `ek12_where` T: Laura's "spruce edge" is true at the stated 15.00. `head_unattended` Cu: the stem states the withdrawal; Laura answered from the wording. `crown_drops` Cu: the place name answers it, and no surface states the strip. `korpioja_spot` OK, but the map label confuses. `head_later` U: truth jumped about 980 m in 20 min against a pushed 14.1 m/min (518 m and 792 m off; tolerance 300 m). `infra`, `fastest_spread`, `return_danger` OK. |
| **V5 15.20** | C: where the head and spots are, crews' safety, **reinforcements and air**, the wind turn (who is on the north edge). N: houses NE; the wind turn (only after the freeze). | 17 P at 0 s (crown fire dropped, Alder Creek crossed, 76.4 ha, hose short). Clock 15.20, log to 15:38. | K: units alerted ∅ (no dispatch or ETA record for EK15/16 or KY23); values NE ∅ (none exist). L: houses NE ∅; "When will the wind turn to the south?" ✓ `wx.03` after the freeze. | K 7/8, L 6/8. `ek14_shelter` HF, passive no (the 15.00 forecast is R); Kari right with an id hint, Laura wrong. `area_hour`: Kari wrong with an expert slowdown (90–140), Laura right with naive linear growth; truth 148 ha, 8 ha over the band edge. `road_jump` HF. `infra` OK: pushed EK11 15:03 and EK12 15:07 support it, so the audit's "passive no" should be "partly". `head_now`: Laura 214 m off (tolerance 200). |
| **V6 15.40→16.00** | C: has the wind turned, the north edge (EK14 downwind), cottage occupancy, spots, the helicopter. N: people at the cottages. | The helicopter first appears (DRONERYHMÄ 15:41), EK14 withdraws, "E 165°"; at 65 s HELI1 16:01 and "occupancy unknown, police asked" 16:02. | K: cottage occupancy ∅ (the record is step 9); R1 latest ✗ (`evt.c08.012` not in the top 8). L: cottages ½ (got the wind turn); R1 latest ✗: the 15:07 lure ranked 1, the key record 4th. | SPAM 6 OK (both). **6.b**: Kari right by default ("no change", without a report); Laura wrong from the retrieved lure. |
| **V7 16.20** | C: north-edge ROS and flames, cottages, who is where, the next wind shift, fatigue (EK11 4.5 h). N: has the police checked the cottages. | 18 P (KY21 moves itself and VOL1 under a "release rule"; EK15 asks for a task). | K: police ½ (`atom.demo.9.1` rank 2); "what did the command post log at 16.20" ✗ (`rekindle.in_hand.log` not in the top 8; the planted record was rank 3, a label only). L: police ½. Neither found VPK's 16:21 objection (R, by design). | 8/8 both (**ceiling**). `cp_safe`: no record and a strong id hint, so discount. `north_help` and `lull_meaning`: id hints, but pushed. |
| Hinge 16.40 | | P2 directive. | | The check was answered right by both. |
| **V8 16.40** | C: lines between the fire and the cottages, **the latest forecast** (which village first), reserves. N: the latest forecast (KY21 asks for one). | 18 P. | 5 forecast questions (K ×3, L ×2) all ✗: `evt.wx.04` (16.00) ranked 3–8, with the 12.00 or 15.00 forecast at rank 1. | SPAM 8 OK (both). |
| **V9 17.00** | C: rekindles on the south edge, timing of the W/NW wind. N: the forecast. | SPOT 17:01: new fire SE of the origin, "not on the map". | K: new fire's speed ✗ (`atom.demo.12.1` rank 2), then "SPOT 17.10" ✓. L: NW forecast ✓ `wx.05`. | No probes. |
| **V10 17.20 (freeze at 17.40)** | C: the US1 size and rate, who goes there, R2 status, the NW wind. N: nothing asked. | 10 P (R2 "still passable … a good kilometre"). | K: US1 ½; "VPK at 17.24" ✗ (VD1's battery log matched the token "17.24"; `evt.c13.008` is the right record). | K 4/6, L 2/6. `infra` A: both chose "threatened" (§5). `area_total_hour` U (no basis; option scale; 12-ha bands). `front_r2_80` HF: Kari right with SPOT's rate from Haku, Laura wrong. `south_front_point` U (tolerance 100 m; 112 m and 199 m off). `ek12_water`, `cabins_distance` OK. |
| **V11 17.40→18.00** | C: will the lines be ready before the front (ROS), Bay Village, R2. N: the current hectares, after the V10 freeze. | P2: EK16 released; KY21 to another fire. At 65 s: the **EK16 burnout request**, Bay Village 2.6 km. | K: ROS to the forest road ½ (DR2 17:45, 7.6 m/min, R, not in the top 8); "VPK 17.58" ✗ (rank 4; the top was the 12:00 alarm, which contains "VPK"). L: latest DR3 hectares ✗ (17:55 at rank 3), then "DR3 … 17.55" ✓. | SPAM 11 OK (both). |
| **V12 18.20→18.40 (freeze at 19.00)** | C: does the forest-road line hold, **CO and escape routes** downwind, the burnout, the evacuation, the area. N: a route for OUT1/OUT2. | OUT1 and OUT2 cannot cross R3. At 65 s: the evacuation as "command's decision", the trigger point, burnout off, SPOT ~160 ha. | K: CO ∅ (**no CO reading anywhere in the corpus**); "VPK 18.38" ✗ (rank 8); "situation picture 18.35" ½ (got 18:55's 163.8 ha). L: the detour ∅ (step 17). | 5/6 both. `head_now` MK against the header (both displaced SE). `f7` right by both from the default with no exposure, so not an SA measure. `longest_shift`, `front_toward`, `village_distance` and `head_later` OK. |
| **V13 19.00** | C: did the front cross, are the R2 lines ready, the residents who stay, US2. N: the power line (cued by the freeze). | 18 P (the US2 flare-up, police with two households). | K: US2 ½; "what is new in 10 min" unanswerable. L: the 20 kV line ✓ `f7.grid_record`; "Distribution company at 19.18" ✗ (`f7.grid_at_line` rank 8). | Uncertainty probe: both chose the north edge (the key area). |
| **V14 19.20→19.40 (freeze at 20.00)** | C: the front's distance to R2, sprinklers, US3, the night shift. N: the distance to R2. | 18 P, then the step-20 burst (OUT1: 900 m; KY21). | K: US3 ½ (SPOT 19:30 `atom.demo.19.3` not in the top 8). L: distance to R2 ✗ (`evt.c19.009` "850 m", `evt.c19.027` "900 m" not in the top 8). | 6/6 both (**ceiling**). Contradiction probe right by both. |

**Natural needs that no record serves.** These commander questions have no answer in the corpus, and all are SA requirements in `wildfire_sa_requirements.md`:
- air support status and ETA (Goal 3.2);
- reinforcement dispatch and ETA (Goal 3.2);
- CO readings (Goal 1.1 L1; MPV25 defines the zones by CO).

The novice's needs (water, "what is new", "latest") are mostly served by records, but lexical Haku does not reach them.

---

## 4. Retrieval failures (template Haku, lexical top 8)

The full list is in `haku.csv`. The pattern, with representative cases:

| Question (run #) | Returned (rank 1) | Should have returned (its rank) | Cause |
|---|---|---|---|
| "Onko uutta sääennustetta? Milloin tuuli kääntyy länteen…" (K17) | `evt.wx.01` 12.00 forecast | `evt.wx.04` 16.00 forecast (3) | No recency. The same at K18, K19, L17 and L18 (ranks 3–8). |
| "Paljonko uutta … edellisessä DR3:n kehäkartoituksessa?" (K7); "previous perimeter mapping before 14.35" (L8) | the newest survey, 14:35 | `evt.c03.035` 14:15 (3 and 2) | No sense of "previous" or "latest". |
| "latest road report road R1 south of Dry Heath" (L15) | `evt.c06.022` 15:07 (the designed lure) | `evt.c08.012` 15:47 (4) | No recency, so the wrong SPAM answer. |
| "Latest DR3 perimeter mapping: how many hectares burned now?" (L20) | the 14:35 survey | `evt.c14.033` 17:55 (3) | No recency. |
| "Mitä VPK ilmoitti klo 17.24?" (K23) | VD1 battery log ("swap at 17.24") | `evt.c13.008` VPK 17:24 (absent) | The time token matches the text, not the record's clock. "VPK 17.58" (K25) and "VPK 18.38" (K27) return the 12:00 alarm, whose text contains "VPK". |
| "Onko kärjen lähellä lähempää vedenottopaikkaa…" (K6); "a water point closer than Pike Pond" (L7) | KY21 "road ends 250 m"; VOL1 Pike Pond | `evt.c03.025` EK13 at W3, R3 bridge (8 / absent) | The concept (other water points) is not lexical. |
| "Missä EK12 on nyt kärkeen nähden…" (K9) | EK12 14:58 hose pressure | `evt.c05.020` / `evt.c05.011` EK12 status and location (absent) | "When asked" status lines lose to chatter. |
| "How much water do the crews have left?" (L2, L3) | EK12 hose-pressure chatter | `evt.c01.020/.024/.035` "when asked" (2–5) | As above; the Contacts pane would have answered. |
| "Syttymäkohdan kaakkoispuolelle on syttynyt uusi palo. Kuinka nopeasti…" (K20) | KY21 15:22 Alder Creek | `atom.demo.12.1` SPOT 17:10 (2) | Lexical noise ("uusi palo"). |
| "How far is the south-east front from road R2 now?" (L25) | EK12 "heading for R2" | `evt.c19.009` / `evt.c19.027` (absent) | Distances in status lines are not matched. |

**For the study.** In 22 of the 32 failures the right record was in the top 8 at ranks 2–8; the study's model sees all 8, so it may rescue them. The other 10 are absent from the lexical top 8; the vector half may or may not reach them. Pilot 2 should rerun exactly these questions (both languages) through the real Haku and log, for each one, whether the answer quotes the "should have" record. Both players found a workaround: they read the PERUSTEET/BASIS line and asked by source and time. That worked 6 times out of 11, only when the time appears in the record's text. Few real participants will find it.

---

## 5. Items to send to the expert panel

| Item | Question for the panel |
|---|---|
| `freeze.2.spruce_behaviour` | The stand is "tiheä kuusikko" (dense spruce) at 27–29 °C, RH 25–30 %, SW 5–6 m/s gusting 9–10, with a forest-fire warning. Is "climbs into the crowns and throws embers" clearly the most likely, or is "slows, damp spruce floor" defensible (KAL: dense spruce on rich sites burned as surface fire)? What one detail in DR1 13:41 would settle it? |
| `freeze.5.road_jump` | The crown fire dropped into the birch strip at 15:21, the wet banks stopped the surface fire along 100 m, and spots PP1/PP2 are already beyond. Would you expect embers to cross Birch Creek within 40 min? |
| `freeze.10.infra` | "R2 still passable; the new fire a good kilometre from the road; R2 is the tankers' shuttle route", with a NW wind forecast to strengthen. Is "passable; the fire is not near" the right answer, or "passable for now, but threatened"? Both players chose the latter. |
| `freeze.5.area_hour` | 76.4 ha at 15:35 with 35.8 ha new in 20 min, but the crown fire has dropped. Is 140–190 ha the expected area in an hour? The truth is 148 ha; the report key's 184 ha is a linear extrapolation of the burst. Where should the band edges lie? |
| `freeze.4.head_later` | During a crown run with 14.1 m/min reported and embers 200–400 m ahead, where should "the head in 20 minutes" be keyed? The truth is about 980 m ahead; the tolerance is 300 m. |
| `freeze.4.crown_drops` | Is "the crown fire drops in the broadleaf strip along a brook" a fair L3 expectation when no record or map layer shows the strip? Should the strip be stated earlier, for example in a terrain report? |
| `freeze.2.junction_hour` | Is the edge's distance to the R1/R2 junction an element a commander tracks at 14.00, and is it answerable without a stated distance? |
| `freeze.10.area_total_hour` | Are 12-ha bands at about 155 ha meaningful SA, when the last pushed area is 76 ha (15:35)? |
| SPAM `cycle_6.b` | When the key ("no change") is a non-searcher's default, does the item measure retrieval? |
| `freeze.12.f7` | Should an item whose key is the safety default count towards SA accuracy, or only towards H9? |
| `freeze.7.cp_safe` | Is it answerable without any stated distance to the command post (about 760 m, map only)? |

---

## 6. Recommended fixes

### Bugs (fix without a research decision)

**App:**
1. **Tour SPAM text** (`ui.ts` l.467 fi, l.656 en). It says the question "waits … does not go away". Make it say that the prompt waits, but each question, once shown, has a time limit. Show the remaining time, or at least an expiry line, on the card (`SpamCard.tsx`).
2. **OUT1/OUT2 roster** (`unit-roster.ts` l.55–56): `from: "From outside the region"` renders as "From: From outside the region". Change it to "Outside the region".
3. **Glossary, both languages:** add burnout / taustapoltto, trigger point / laukaisupiste, and release rule / vapautussääntö (a V7 key record); consider humus layer / kunttakerros.
4. **The "Fire / Palo" zoom button** frames the whole study area by design (`MapView.tsx` l.85–95), but both players expected it to zoom to the fire. Rename the button; the design itself is unchanged.

**Audit:** in `difficulty-audit-hand.ts`, `freeze.5.infra` passive "no" should be "partly". The pushed EK11 15:03 (`evt.c06.008`: glowing litter and small flames on R1) and EK12 15:07 support "passable with care"; both players answered it without the key record.

**Harness (all fixed 24 Oct 2026):** the `radioLog` aliasing; item and option ids; SPAM expiry announced; `score` shows how a Haku record reached the player. Still open: the practice feedback image path; the "period N s" readout after a freeze; the roster colon (`help.ts` l.68).

### Decisions for the researcher

- **D1. One definition of "now".** Today the freeze header and the screen clock use the period start, while the records, the L1/L2 keys and Haku's ages use the period end. Two options:
  - (a) Cheapest: phase-A L1/L2 stems say "according to the latest reports" instead of "now" or "right now", and the header adds the span ("this period's reports cover 14.00–14.20"). The L3 horizons stay counted from the clock, as y.1 has them.
  - (b) Principled: show the span on the TAK card ("14.00–14.20") and make "now" the period end everywhere. This re-horizons the L3 keys by one step; recheck `2.junction_hour`, `2.area_40`, `5.area_hour`, `4.head_later` and the other L3 bands.

  Either way, re-key V12 `head_now` (open item `11` §7.18).
- **D2. Late phase-A items** (V2 40 s, V4 37 s; 8 items). Options:
  - accept and report them as "reading under load";
  - drop or reword the items whose only basis is the 65 s burst;
  - push the second step's key records at the view's start. This breaks the step model; not recommended.
- **D3. Stem cues** (`sagat_rules.md`):
  - V2: reword `ek11_between` so it neither reveals the new fire nor places EK11 ("What does the situation on the esker mean for the crews nearest the head?"), or move `ek11_point` before it.
  - V4: reword `head_unattended` without stating the withdrawal, or drop `ek12_where`.
  - V4: state the birch strip somewhere before `crown_drops`.
- **D4. SPAM answer window.** 60 s per item, with Haku at about 30 s a question, leaves room for one search. For retrieval-dependent second items, consider 90–120 s and a visible timer. Pilot-log timeouts by item.
- **D5. V10 `area_total_hour`.** Push one phase-B area figure (V9 or V10), or recast the item as growth. Make sure the bands do not reveal the magnitude.
- **D6. F7 scoring.** Score `freeze.12.f7` for H9 only, outside the SA composites. Estimate the exposure rate in pilot 2; neither player had a reason to ask before the freeze, and a low rate threatens H9's power.
- **D7. The forecasts are never pushed** (audit (b)). A commander would get the 15.00 and 16.00 updates by radio. Push at least the 15.00 update or a P2 line; `5.ek14_shelter` depends on it.
- **D8. Map and texts:**
  - label Korpioja near the crown-run crossing;
  - "E 165°" → "etelä 165°" or degrees only (Finnish);
  - V10 `south_front_point` tolerance 200 m;
  - re-check the R1 road-report series. At step 5, DR1 and DR3 say "unsafe" while DR2 says "with care"; DR2 then says "no flames" at 15:07 and "low fire 10 m from the road" at 15:27. If that is not an intended lure, it is a consistency issue for `wildfire-fire-behaviour-check`.
- **D9. Content gaps for natural commander questions:**
  - a helicopter request and ETA in V1–V2;
  - reinforcement dispatch and ETAs in V5;
  - at least one CO reading at the critical moments (14.00 esker; 18.40 forest road), because MPV25 zones are CO-based.
- **D10. Retrieval** (SPEC/14):
  - recency for "latest / newest / viimeisin";
  - the source name and clock in the indexed text;
  - check "what is new since …" with the model.
- **D11. Plan form and role** (design observations only):
  - The form cannot carry the commander's real decisions: pull EK12 off the spruce edge (14:41), approve or refuse EK16's burnout (18:06; doctrine: backfiring is rare in Finland, "do not make it a wise default"), decide about the two households (VOL1 19:18), task EK15 (16:37), or decide the evacuation.
  - The form has no barrier choice for a defensive line, and no field for a deviation rationale (Kari V6).
  - `atom.radio.17.0` ("command's evacuation decision") makes a decision on the participant's behalf. Both players felt bypassed.
  - Options: (a) say in the tour that requests addressed to command are context, and that units act on standing orders; (b) reword `atom.radio.17.0` (for example, "P2's evacuation decision"); (c) add a free "orders" field, which changes the measured task.

---

## 7. LLM players: where they were more diligent, or luckier, than people

**More diligent:**
- They read every message of every burst (Laura: "read all 19 messages"), with `look` free and no real clock. People skim 10–26 messages while the plan is open.
- They did exact arithmetic on every figure (320 ÷ 4; 2,350 − 40 × 8).
- Both invented the source + time query trick by V3.
- Kari quoted MPV25, KAL and LACES from the skills. A real commander knows the doctrine but rarely reasons so explicitly under time.

**Luckier, or test-wise:**
- They used item ids: Kari said so for `ek14_shelter`.
- They used stems and the option scale: Laura on `ek11_between` and `head_unattended`; Kari on `area_total_hour`.
- They chose the "safety-sounding" option on items with no basis (`ek11_between`, `cp_safe`, `f7`).

**Less diligent than a person:** they trusted the harness's change lines and did not `look` after `plan`. A person would have seen the log grow, so part of the V2/V4 miss is harness-induced.

**Not proof of easiness:** their high V7 and V14 scores come from complete reading. For people with less reading time, the late items in V2 and V4 and the map items will be harder than these runs suggest.

---

## 8. Limits of this play-test

- **Two LLM players, one run each.** No variance, no fatigue, no real-time pressure. The view caps, the freeze cap and the SPAM window ran on the harness's DRAFT costs (`costs.ts`: Haku 15 + 15 s).
- **Haku was the template fallback over lexical retrieval** (`haku-transport.ts`). It shows the rank-1 record's text and three source labels. The study runs a model over hybrid retrieval, so every retrieval finding here must be rerun with the study model (§4).
- **The players saw the ids** of every freeze item and option. Six ids name the key, and five more narrow the options (`items.csv`, `harness_id_hint`). The correct answers on those items are discounted above.
- **A harness bug hid new log messages** for the whole session (finding 2). The "I never saw it" reports for the V2 and V4 bursts overstate what a participant would miss.
- **Not available to the players:** the intro video, the primer's illustrations, the tour's pointers, hovers and the window-size behaviour. The map was drawn at one window size.
- **One coder, with keys.** The verdicts in `items.csv` are DRAFT. The panel items in §5 need fire officers.
