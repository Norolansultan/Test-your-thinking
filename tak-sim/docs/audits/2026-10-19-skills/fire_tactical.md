# Fire and tactical audit (phase 1b): tak-sim export `3631cd43b2b9`, cycles 0–20

Auditor: Phase-1b fire/tactical auditor, 19 Oct 2026. I did not edit the repository. Skills used: `wildfire-fire-behaviour-check` (envelope 0.1.0, `compare_thresholds.json` 0.1.0) and `wildfire-tactical-check` (config 0.2.0). Inputs:
- `tak-sim/dist/skills/scenario/` (DATA_SOURCES, cycles.json, facts.json, perimeters, barriers);
- the specs SPEC/30, 24, 18, 26 and 27 §7;
- `app/scenario/demo-directive.ts`, `tools/fire-ca/scenario-18.ts` and `template-site.ts`, `content/site/*`;
- `audits/coa.md`.

Every script, input, result and verdict GeoJSON is under `audits/fire_tactical/` (see "Files" at the end).

## Summary

1. `fire_check.py` reproduces the exporter: 0 LIKELY_ERROR, 9 REVIEW, 0 INFO. Five of the nine come from how the export pairs fields. Fire type, flame band and head bearing come from step-start records that describe the previous 20 minutes, but they sit beside the CA rate *during* the step (flags at c5, c7, c8, c11-direction, c12-direction). The other four are plausible with a stated reason: c6's 38 m/min (unthinned spruce, FBP C-2 at the scenario's ISI 23), c11's ROS 0 (secured sectors), and c12/c18, which are flagged only because RH is missing.
2. **Not flagged, but it matters most: the phase-B flame bands are 2–3× too short for the scripted rates.** Byram's relation applied to the quoted flames implies 0.2–0.5 kg/m² burned in the flaming front, against about 2–3.3 kg/m² from Kalajoki's own rate/flame pairs. At 7.9–10 m/min a Kalajoki-consistent head flame is about 4 m, not 1–2 m. A second point: the scenario's own design weather (ISI 14–23) gives FBP C-3 rates 2–4× the scripted pine-heath rates. Verdicts: the flame table is fix-the-scenario before Gate A; the RH series and time-aligned export fields are fix-the-data.
3. **Rekindles.** c12 is almost a copy of KAL 4.5: the wind turns from S to WNW and puts the south edge downwind, RH is about 35–38 %, wind 3 m/s gusting 6, and VPK's 16:21 record names smouldering stumps and slash. c18 (US2) is a holdover on a backing edge that never grows, which is consistent. c19 (US3) flares on the *upwind* west edge: plausible, but the weakest of the three against the Kalajoki pattern. There is no evening recovery: RH falls 38 → 26 % and the dew point drops about 10 °C. FMI should confirm that this is credible.
4. **Tactical.** Run 1: every ground placement is INFEASIBLE (null LACES fields). Run 2 fills only record-supported fields and still leaves only 1–3 crews feasible per step. The R2 line crews that the V12–V14 keys rely on have no recorded escape route or safety zone. EK16's 18:41 line is the only complete LCES statement. KY21's stated escape route at 18:40–19:00 runs through the road stretch the front reaches. EK16 holds about 20 minutes past its own trigger in V13. SPEC/27 §7.3 e is superseded: in V11–V14 no crew stands at the SE front's edge (EK12, OUT1 and OUT2 are 517–1513 m away on R2).
5. **Keys.** V9, V12 and V13 hold. V10 holds on its records, but only as a flank attack from the anchor; a realistic flame table makes it marginal. V11 is mixed on the pushed facts: F5 is confirmed, a flank attack from the black is FEASIBLE, and realistic flames would push the key toward D. V14 holds only through the secondary route (F2 confirmed: rescue first, counter the greatest threat). F1: a hose crew sent to a *spreading* rekindle is making a direct attack, whatever the label says.
6. **Prometheus request and Gate A.** The request is written below: 7-member ensemble, FBP mapping for the 13 classes, proposed thresholds with scope rules, and a smoke-tested pipeline. Before Gate A the scenario must add:
   - a flame-length table (it changes V10/V11);
   - a T/RH/dew-point series;
   - a CO proxy;
   - export of the crew sizes, hose carried and shift hours it already has;
   - LCES lines for the R2 crews.

## Fire envelope: per-cycle table

**Fire realism check – demo-scenario 0.1.0-demo (envelope 0.1.0, thresholds 0.1.0).** Prometheus: not yet run.

Method:
- `fire_check.py` was run on `ground_truth/cycles.json` (report: `fire_tactical/fire_check_report.json`).
- Newly burned truth area per cycle, with its fuel and slope, comes from `scripts/fuel_per_cycle.py` (`fuel_per_cycle.json`).
- Length/breadth comes from `scripts/lb.py`, rekindle parts from `scripts/parts.py`, and the records from `facts.json`.
- "FBP" figures are my indicative FBP92 computations, labelled as such and **not** a Prometheus run. They use the RSI equation with C-2/C-3 coefficients and the BUI effect; ISI and BUI come from the SPEC/18 §6 design record, valid for phase A only (y.6).

Verdict codes:
- **P** = plausible with the stated reason.
- **FD** = fix the data (export or records).
- **FS** = fix the scenario (forcing, records or spec text).

| Cycle (time) | Check | Result | Reference | Fix or justification |
|---|---|---|---|---|
| 0 (12:00) | ROS 3.5, FL ≤1 m, SW 4/7, RH 30 %; +1.3 ha, 100 % pine heath | pass | KAL 4.4 (pine 2–4 m/min) | **P** |
| 1 (13:20) | ROS 7.1 (authored 6), FL ≤2; pine heath 97 %; L/B 4.07 at 5/9 m/s | pass (L/B tested only below 4 m/s) | KAL 4.1 (L/B 1.4 at 1.5–3.5 m/s); FBP LB 2.3 at mean wind, 4.1 at the gust | **P**. The CA's truth runs on the gust (SPEC/24 §5), so the fire is long. Prometheus on hourly means will be rounder: the ensemble needs a gust member (request below). |
| 2 (13:40) | barrier_crossed (fire creeps over R1, EK11 puts it out); flank 1 < head 2 | pass | KAL 4.4 (roads hold partly) | **P** |
| 3 (14:00) | ROS 10.6 (authored 7) includes the RIDGE ignition 140 m ahead merging; spotting 140 m on a surface fire; EK11 reports "single trees catching" (evt.c03.003) | pass | KAL 4.4 (spots ≤300 m in passive crowning; 9–11 m/min only in slash or cleared lines) | **P**. The rate is spot-inclusive, not a front rate. Torching means passive crown; the export keeps intensity class 3 as surface (a reviewer may read passive). |
| 4 (14:20) | suppression (EK14 wets the R1 verge), flank 0.3 | pass | — | **P** |
| 5 (14:40) | **REVIEW ros_envelope**: surface at 14.1 m/min (>11) | flag | KAL 4.4 | **FD, then P.** The export's surface type comes from DR1 14:45, which describes 14:20–14:40 at 7.1 m/min. The true state in c5 is DR1 15:05 (evt.c06.010): 14.1 m/min, "flames above the treetops", class 5/5. Re-paired, it is active crown at 14.1: above KAL's ~10 m/min transition threshold and just under the 15–30 band, on entry into unthinned spruce (28 % of the new cells are mature spruce). EK12 14:48–14:51 (11 m/min, embers at 150 m) fits. |
| 6 (15:00) | **REVIEW ros_envelope**: active crown 38 m/min (>30); spotting 400 m; 64 % of new cells mature spruce | flag | KAL 4.4/4.6 (15–30; 15–20 in young pine C-4 at ISI 11) | **P (accepted, SPEC/24 ah.7).** (a) The 38 includes spot fires merging into the head; DR1 records 51.3 m/min "including the spot-fire jumps" (evt.c07.011). (b) The fuel is unthinned spruce (C-2), not Kalajoki's young pine. (c) The design ISI is 23 (mean wind), not 11; FBP C-2 at ISI 23.4 and BUI 104 gives about 41 m/min. **FD:** the records should also give the front rate without the jumps. The panel should check that FWI 55 / ISI 23 is within Finnish experience (FMI16). |
| 7 (15:20) | **REVIEW spotting**: 330 m "without active crown"; ROS 38 → 5.3 (with a change_reason) | flag | KAL 4.4/4.6 (2 km in active crown) | **FD, then P.** The spots (PP1/PP2) come from the c6 crown run, but the CA places them in step 7. The c7 fire type (surface, class 4, 2–4 m) is DR1 15:25 describing 15:00–15:20. During c7 the crown drops into birch: EK11 15:22 reports surface fire, 0.3–1 m (evt.c07.003). Fixes: date the spotting to its source step, and reconcile the export's 330 m with DR1's SF3 "about 600 m ahead" (evt.c07.028). Birch stopping the crown matches KAL (deciduous or dense rich-site stands burn as surface fire). |
| 8 (15:40) | **REVIEW direction**: head 55° off downwind; ROS 9.8 (authored 4) | flag | design heuristic (45°) | **FD, then P.** Bearing 40° is HELI1's observed head over 15:20–15:40, when the wind was 220° (0° off). During c8 the wind backs to SSE 165 and the advance runs 22° off downwind (SPEC/24 ah.3). The 9.8 includes the scripted step-8 joins across Koivuoja. Export the bearing of the advance in the same window as the rate, null when the rate is 0. |
| 9 (16:00) | regime_change: the north flank becomes the head (NW); bearing 25° off | pass | KAL 4.1 (flanks change quickly with small wind shifts) | **P** |
| 10 (16:20) | control (L2 in hand); ROS 3.5; SE 3/5; RH 38 % (station) | pass | KAL 4.5 (calm day: edges not burning) | **P**. SPEC/18 §6 rows 10 onward (shower, RH 60 %) are stale (y.6); the station's 38 % is what counts. |
| 11 (16:40) | **REVIEW ros_envelope** (ROS 0) and **REVIEW direction** (50°) | 2 flags | KAL 4.4; heuristic | **P (ROS), FD (direction and type).** The CA's secured sectors (L2 at c10, L1+L4 at c11) leave nothing to burn, so the "thermal inertia" forcing of 3 m/min never reaches the ground (SPEC/24 aa: achieved 0). A held fire in 3 m/s fits Kalajoki's calm day. The export should give fire_type "held"/null and bearing null when the rate is 0. The c11 flame band (DR3, 0.3–1 m) describes 16:20–16:40. |
| 12 (17:00) | **REVIEW direction** (105°) and **REVIEW reignition** (RH None, wind 3) | 2 flags | KAL 4.5 (RH 36 %, 2.5 m/s gusting 6–8, wind shift toward the flank, smouldering spoil) | **P; both flags are FD.** The direction flag comes from a placeholder bearing (0°, zero-rate observed head); the real advance runs ESE, 7–15° off (SPEC/24 ah.3). Reignition: drying yes (RH 38 % at 16:20, 28 % at 18:00, forecast 35–40 %); wind yes (3/6); the shift from S 180 to WNW 285 puts the origin's S/SE edge downwind, as at Kalajoki. The source is recorded: "stumps and logging slash could still be smouldering under the surface; if the wind turns it can flare up" (rekindle.objection, VPK 16:21) and VPK's doubt at 16:45 (t4.private_doubt). The flag is only the missing RH: add the station's T/RH at 17:00. The new cells are pine heath and slash at the origin. **FS (spec text only):** SPEC/18 §7 row 12 and §7.2 still say "2024 ditch-spoil banks in BOG-S", 600 m or 1.64 km out; the CA has it about 65 m from the origin (SPEC/24 aj). **FD:** `smouldering_spots` is empty for c10–c11 although rekindle.objection is there. |
| 13 (17:20) | ROS 7.9 (authored 7); flame band ≤1 m (DR2 17:25, earlier window); DR2 17:45 gives 7.9 m/min with 1–2 m, class 3 | pass | KAL 4.6 (rekindle: 2–4 m/min accelerating over the first hour, then 4–7); Byram | **P for the rate** (a rekindle reaching 7.9 m/min within 40 minutes in WNW 5/8 is faster than Kalajoki, with a stronger wind). **FS for the flames:** 1–2 m at 7.9 m/min implies 0.49 kg/m² burned; Kalajoki-consistent is about 3.8 m. |
| 14 (17:40) | ROS 4.5 (authored 4); flame band 2 (17:20–17:40 record) | pass | — | **P**. The slow-down from 7.9 to 4.5 in gusts of 10 is authored for timing (SPEC/24 aj.3, so the road stops the head at 18:40–19:00), not for a weather reason. State that in the methods. |
| 15 (18:00) | deep burning (KY21: humus and stump roots 20–40 cm, water does not soak in); RH 28 %; ROS 5.3 | pass | KAL 4.2 (DC very high, deep layers dry); B1 (wetting agent) | **P**. A good boreal cue (DC 482 in the design record). |
| 16 (18:20) | ROS 7.1; flames 0.3–1 m (DR2 18:25) against KY21 18:26 "flames a couple of metres, undergrowth catching, ~8 m/min" | pass | Byram | **FS (flames)**: the two records disagree on the same front at the same time. |
| 17 (18:40) | wind event NW 9/14; ROS 10.1 (authored 12); FL ≤2; the Honkaharju road stops the head over ~500 m (KY21, atom.radio.18.4) | pass | KAL 4.4/4.6 (9–11 m/min; service roads held partly, spots jumped one; at 5–7 m/min the head flame was 4 m) | **P for the rate and the stop** (a partial barrier; sparks cross 20 minutes later). **FS for the flames** (1–2 m at 10 m/min means 0.39 kg/m²; Kalajoki-consistent about 4.3 m). |
| 18 (19:00) | **REVIEW reignition** (RH None, wind 7); US2 north-edge holdover; head crosses the road 19:00–19:20 | flag | KAL 4.5 | **P; the flag is FD (missing RH, about 26–28 % between the 18:00 and 19:20 readings).** The source is on record: the north edge has "stumps and litter smoking" all evening (evt.c12.026, evt.c17.009, evt.c18.006). There is no shift toward that flank: under NW 315 the north edge backs. US2 stays 0.09 ha for an hour, which is consistent with a gust-fanned holdover that cannot run. |
| 19 (19:20) | reignition US3 (origin's west edge); RH 26 %, NW 6/11 | pass | KAL 4.5 | **P (weakest).** Drying, wind and source are present (rekindle.objection covers "the origin's edge"). But the west edge faces the NW wind, so this is a flare-up on the upwind edge. It flanks south along the old edge (0.22 → 0.48 ha; centroid bearing 276° → 254°). Recommend a precursor on L4 in the records (smoke at the west edge 18:50–19:10, e.g. from the patrol). No fire change needed. |
| 20 (19:40) | ROS 8 (authored 7), FL ≤2, NW 5/9 easing; RH null | pass | KAL 4.4/4.6 (RH rose 55 → 88 % in three hours; intensity fell, opening a direct-attack window) | **P with a stated reason, at the edge.** The scenario dries through the evening (RH 38 → 28 → 26 %, T 25 → 20 °C; dew point about 9.7 → 2.6 → −0.1 °C by Magnus) behind the front ("dry continental air", 18:01 forecast). FMI should confirm a 10 °C dew-point drop over three hours. The only easing is the wind after 19:30; the SPEC/27 §7.4(i) lull is not implemented. **FD:** RH at 19:40 and 20:00. |

Scale: 160 ha at 20:00 (truth) is about 350 times the Finnish mean fire of 0.45 ha (UEF) and of the same order as Kalajoki (227 ha over two phases). The briefing must frame it as a rare event (SPEC/18 §7 already says "severe end").

### Not validatable by Prometheus (checked against Kalajoki instead)

- The crown transition at c5–c6.
- Spotting at c3, c6, c7 and the step-8 joins.
- The three rekindles (c12, c18, c19).
- Deep burning (c15).
- Barrier stops and crossings (c2, c4, c17, c18).
- Every suppressed phase (main fire from c10; road sprinklers at c17–c18).

The verdicts are in the table. The flame/rate inconsistency is not tested by `fire_check.py`: it checks FL and ROS separately, each against its own band.

## Prometheus request

**To:** FMI (the Prometheus-based spread service offered to rescue services through Ilmanet; Mellevä/MAST tuned fuel grids) and Pelastusopisto (PromS).
**From:** the tak-sim study (scenario `demo-scenario` 0.1.0, export `3631cd43b2b9`).
**Request:** a small Prometheus ensemble on a fictional scenario, as a model-to-model consistency check. It is not a forecast and not a validation of spotting, smouldering or suppression (CWFIS).

1. **Can you run it in your set-up** (Ilmanet or PromS) rather than us reproducing it? We refuse untuned default grids: KOL found untuned Finnish runs either die out or spread several times too far.
2. **Grid frame.** 400 × 400 cells of 25 m; lower-left corner E 514000 N 6741000; EPSG:3067.
3. **DEM.** `content/site/elevation.asc`. It is fictional, not an MML KM2/KM10 DTM. It is flat: 87–93 m around the fire, slope 1–3° mean and ≤9° maximum in the burned cells.
4. **Fuel grid.** `content/site/fuel_truth.asc` (codes 0–12, legend `content/site/site.json`) and the variant `fuel_machine.asc`. The variant differs only where mature spruce is shown thinned: 1,806 cells within 1 km of the fire. Shares: burned by 20:00, pine heath 65 %, mature spruce 26 %, drained peat 3 %; within 1 km, drained peat is 22 %. Our proposed FBP mapping is below; **please replace it with your Finnish lookup and tell us its version.**

| Code | Class (Finnish) | Proposed FBP (to confirm) | Note |
|---|---|---|---|
| 0 | water (vesi) | non-fuel | |
| 1 | gravel road 6–8 m (soratie) | fuel break, as a vector of true width | not a 25 m non-fuel cell |
| 2 | field (pelto) | O-1a, curing from you | curing share was the key tuning knob (KOL) |
| 3 | dry pine heath (kuivahko mänty) | **C-3** | KAL 4.4. The origin is a harvesting block with slash (S-1 if you can mark it). |
| 4 | mature unthinned spruce, low crown base | **C-2** | SPEC/24 ah.7 |
| 5 | thinned spruce (variant grid only) | C-2 with a higher crown base, or M-2 at high conifer share | your call |
| 6 | birch–aspen | D-1/D-2 (green, summer), or M-2 at low conifer share | stopped the crown run |
| 7 | drained pine mire (ojitettu turvemaa) | **C-3** | no FBP type; Kalajoki treated it as C-3 (KAL 4.4). Smouldering is not modelled. |
| 8 | cleared 110 kV corridor | O-1b, your curing | |
| 9 | built | non-fuel | |
| 10 | open bog (avosuo) | non-fuel (baseline) or O-1a with low curing (variant) | unditched bog burned weakly (KAL 4.4) |
| 11 | forest road 4–5 m | fuel break (vector); state your breaching setting | decides whether the head crosses at 19:00–19:20 |
| 12 | brook 1–3 m, wet banks | fuel break (vector), breaching on | |

5. **Ignitions.**
   - Run A: the scripted 12:00 polygon at IGN (E 519000 N 6746000) as a polygon ignition, from `perimeters_scripted.geojson` (cycle 0).
   - Run B (SE front): the scripted 17:20 polygon of the step-12 rekindle (centre about E 519046 N 6745954).
   - If timed ignitions are possible: the RIDGE spot (14:00, 140 m ahead) and the step-8 joins (15:40). Otherwise those cycles are excluded from the comparison.
6. **Weather.** Hourly stream 11:00–20:00, no rain.
   - Wind: from `tools/fire-ca/scenario-18.ts`, direction, mean and gust per 20 minutes. Main features: SW 225–235 at 4–7 m/s (gusts 7–13) until 15:20; backing SSE 165 to SE 130 at 15:40–16:20; S 180 at 16:40; WNW 285 from 17:00 veering to NW 325; the 18:40 event at 9 m/s gusting 14.
   - T/RH: SPEC/18 §6 for phase A; station readings 25 °C / 38 % at 16:20, 22 / 28 % at 18:00, 20 / 26 % at 19:20.
   - Starting codes (design values): FFMC 90, DMC 70, DC 480 (BUI ~103) at 11:40. Tell us whether you need preceding days.
   - Alternative: a real FMI fire-weather day with similar codes (FMI16), not Kalajoki's dates.
   - If your set-up takes sub-hourly wind, we will supply the 20-minute series.
7. **Time step and outputs.**
   - Perimeters every 20 minutes, 12:00–20:00, as GeoJSON in EPSG:3067 with `cycle` and `member`. Our numbering: cycle 0 = 12:00–12:20; cycle n = 13:20 + 20 min × (n−1). Please also output 12:20, 12:40 and 13:00 so the series is continuous.
   - If available, per member: head ROS, HFI, CFB and fire type. **These would ground the flame-length table the scenario lacks.**
   - Also: the Prometheus version, the fuel-grid and lookup version, and the breaching setting.
8. **Ensemble (7 members).**
   - baseline;
   - wind direction ±15°;
   - wind speed ±25 %;
   - **a gust member** (wind speed = the forcing's gust; our truth runs on the gust);
   - the variant fuel grid at baseline.
9. **Our comparison** (pre-registered before we see any output): `fire_tactical/compare_thresholds.proposed.json`, version 0.2.0-proposed.
   - The numeric thresholds stay as before: area ratio 0.67–1.5; IoU ≥ 0.5; head direction ≤ 30°; head rate within 0.5–2× of the ensemble range.
   - Added scope rules, all design choices:
     - IoU only for free-burning cycles of ≥5 ha. In the pipeline smoke test, IoU is 0.45 at 1.3 ha between two outlines of the same fire.
     - Run A covers cycles 0–8 and run B the SE front in cycles 13–20, each with its own ignition. `perimeter_compare.py`'s ignition-to-farthest-point head is stuck at 44° with zero advance from cycle 9.
     - Cycles 3, 6, 7 and 8 (spot merges) and 9–12 (backing wind, flank as head) are excluded from the rate and direction tests.
     - The main fire from cycle 10 and the SE front at 17–18 are upper-bound only (suppressed).
10. **What we expect, and why we need the tuned grid.**
    - FBP C-3 at the scenario's design ISI (14–23, mean wind) gives 12–33 m/min, 2–4× the scripted 6–7 m/min. The same equations give 4.3 m/min at Kalajoki's ISI 9, which matches the 3–4 m/min observed there.
    - C-2 at ISI 23 gives about 41 m/min, against the scripted 38.
    - FBP length/breadth at the mean wind is 2.3–2.8; the scripted fire's is 4.0.
    - So either the scripted pine-heath rates or the design weather is off. Only a run with the tuned grid can tell which.

**Methods paragraph (draft, real numbers only):** "The scripted fire (21 cycles of 20 min) was compared with fire-growth simulations from Prometheus (Tymstra et al. 2010) using Finnish fuel grids [version: pending FMI], the scenario's elevation model (fictional terrain) and [weather: pending]. An ensemble of 7 runs varied wind direction (±15°) and speed (±25 %, plus the gust). For each free-burning cycle we compared burned area, Jaccard overlap, head direction and head advance rate with pre-specified tolerances (area ratio 0.67–1.5, Jaccard ≥ 0.5 for fires ≥ 5 ha, direction ≤ 30°, rate within 0.5–2× of the ensemble range). Prometheus does not represent spotting, smouldering or suppression; these features were checked against observations from the 2021 Kalajoki forest fire (Pelastusopisto 2022). Of [n] cycles, [n] fell outside tolerance [pending]."

## Tactical: per keyed step

**Thresholds:** config 0.2.0.
- PROVISIONAL (US-based, PMS 437 / AR82): hand-tool limit 1.2 m and equipment limit 2.4 m flame length. The aerial limit is MISSING.
- Unverified in every run: CO/MPV25 zone (no values anywhere); manual hose-lay limit (MPV25 tables 3–7 MISSING); line production (MISSING), so no indirect-line timing check could run; segments without a flame band (all flanks and rears in phase B).
- Notes: every flame band was converted to intensity with Byram (approximate).

**The runs:**
- **Run 1** = the export as is.
- **Run 2** fills only record-supported fields, and cites a record id for each one. The fields are `escape_route`, `safety_zone`, `comms`, `water_confirmed`, `hours_on_shift` and `hose_available_m` (laid line + stated spare). Rules (`scripts/evidence.py`):
  - "escape route into the burned area" counts as escape route and safety zone;
  - "our own vehicle" counts as an escape route only;
  - water is confirmed if the tank is ≥50 % or a basin or refill is scheduled; it is false if the unit says "water almost gone" or "pressure stays low" with no refill;
  - a statement carries forward only while the unit keeps its task within 250 m.
- **Run 2b** = run 2 plus `downwind: true` where DR2's road report puts smoke or flames on that crew's road stretch and the crew is downwind by geometry: evt.c16.018 (KY21 and VPK at c16), evt.c17.020 (KY21 and EK16 at c17), evt.c18.024 (EK16 at c18).

Aircraft (drones, SPOT, VD1) come out INFEASIBLE in every run because the script applies LACES to aircraft. That is a script artefact and is excluded from the counts. Persons and CO stay null.

| Step (view) | Run 1 (ground) | Run 2 feasible | Run 2b feasible |
|---|---|---|---|
| 3 (V2) | 0/6 | 3/6: EK12, EK14, VPK | same |
| 7 (V5) | 0/6 | 2/6: EK14, KY21 | same |
| 12 (V9) | 0/9 | 2/9: EK12, EK15 | same |
| 13 (V10) | 0/9 | 2/9: EK12, EK15 | same |
| 14 (V11) | 0/9 | 2/9: EK12, EK15 | same |
| 15 (V11) | 0/9 | 1/9: EK15 | same |
| 16 (V12) | 0/12 | 1/12: EK15 | 1/12 (KY21 and VPK also fail downwind) |
| 17 (V12) | 0/9 | 2/9: EK15, EK16 | 1/9 (EK16 and KY21 fail downwind without CO) |
| 18 (V13) | 0/12 | 2/12: EK15, EK16 | 1/12 (EK16 downwind) |
| 19 (V14) | 0/12 | 1/12: EK15 | same |
| 20 (V14) | 0/12 | 1/12: EK15 | same |

**Why the script's own reference allocation is not usable here.** It is geography-free and has three blind spots:
- It finds "NONE FOUND" as the anchor at every phase-B step, although every rekindle starts on the old black by construction (SPEC/24 aj).
- It sends EK11 and EK12 "to close the pincer at the head" wherever they are.
- It assigns no unit to smouldering spots, because the roster has no `ground_crew` or `hose_team` types.

Two export issues make it worse. The export's segment convention, measured from the ignition point, files the old north-edge crews as "flanks" of the new front. And EK14 (Maastopaloyksikkö) is typed `unknown`, so its intensity and water checks are skipped. The reference allocations below are mine, in Finnish-doctrine terms.

### Step 3 (14:00, V2; phase A)
- **Verdicts.**
  - EK11 (hose attack at the head's left flank, 56 m from the head): run 2 INFEASIBLE on water. "Water almost gone" (evt.c03.003), 24 % in the tank, and a 620 m line on which "the pressure stays low" (evt.c03.040): the MPV25 minimum of ≥3 bar is very likely missed.
  - KY21: no LACES stated on arrival.
  - EK12, EK14 and VPK: FEASIBLE.
- **Reference allocation.**
  - Anchor: the burned area and R1 behind.
  - Flanks: EK11 on the north flank and EK12 on the south flank with hose lines, up to the head's shoulders but not between the head and the RIDGE spot (EK11's own rule, atom.radio.3.2).
  - Rear and south: KY21 and VPK. EK14 holds the north flank.
  - Water: EK13 basin relay; shorten EK11's lay (the road ends 300 m away, evt.c03.030).
  - Reserve: none, so request reinforcement now (KAL lesson: early and in excess). The scenario escalates only at c7.
- **Judgement.** EK11 reports "single trees catching" at 14:02, which is torching (passive crown, 1–2 m flames). That is the very condition EK11 later sets as its 14:45 trigger. A Finnish panel will read the head as already too hot (KAL 4.4: 2.6 m). Spotting at 150 m (evt.c03.009) puts the crew inside the ~300 m zone.

### Step 7 (15:20, V5; phase A)
- **Verdicts (run 2).**
  - EK11 INFEASIBLE on intensity (head 4 m > 2.4). **This is the pairing artefact:** the 2–4 m band describes 15:00–15:20, while EK11's own 15:22 record says 0.3–1 m in birch.
  - EK12 (withdrawn at R1): no comms record in the step.
  - VPK: no safety zone stated.
  - EK14 and KY21: FEASIBLE.
- **Reference allocation.**
  - No crew on the head's front edge while crown-run spots are igniting: SF1 80 m south of the head behind EK11's line, SF2 250 m, SF3 600 m (evt.c07.020/.024/.028).
  - EK11 and EK12 on the lobe's SE flank, 150–200 m back from the tip, from R1. This is the two commander reviewers' position (SPEC/18 ak.4 item 1).
  - HELI1 (ETA) on the head and the spots; DR1 maps the spots with its feed to command.
  - Escalation to company (scripted at c7, correct).
- **Judgement.** The real failure at c7 is spotting exposure behind the line: SF1 cut EK11's way to the truck and the crew withdrew at 15:30 (atom.radio.7.3). The script cannot see this, because the c7 head is typed surface. KAL 4.4/4.6 put spots at ≤300 m in passive crowning and up to 2 km in active crowning.

### Step 12 (17:00–17:20, V9; no-fit; key: direct attack on the new front)
- **Verdicts (run 2).** 7/9 INFEASIBLE: no escape route or safety zone is stated for the crews on the old north and east edges. EK12 and EK15 are FEASIBLE. Water is confirmed for all crews in the step (basin deliveries).
- **Reference allocation.**
  - **Anchor:** the old black at the origin's south edge. The rekindle touches it (SPEC/24 aj).
  - **Main effort:** the new front in L3. Two engines with hose lines go from the anchor along both flanks toward its head (a pincer), working from the black. Candidates:
    - KY23: released 17:00, 0.3 h on shift, 95 % tank (evt.c12.046), 1.05 km away by road.
    - KY21 or VPK: they worked L3 until 16:20 and know the ground; 3.0 h and 5.0 h on shift. KY21 has 680 m of line plus 200 m spare (evt.c12.042).
  - EK13 brings a basin to the origin.
  - DR2 moves from the north flank to over the new front, with its feed to command (KAL: surveillance reports did not reach command).
  - EK14 and EK15 stay on the north edge (smouldering stumps).
  - Request EK16's release from the region (held until 17:40).
  - **Trigger:** gusts >10 m/s (forecast) or flames >2 m means pull back to the Honkaharju road line about 200–350 m ahead (DR2 17:26).
- **Judgement.** Small (0.5–1 ha), low (<1 m), slow (~3 m/min recorded; the CA has 4.5), with light wind now and a strengthening forecast. MV22 says: counter the greatest threat, use the conditions, anticipate. KAL 4.5–4.6: the unattended rekindle became the escape. Act now, from the anchor.

### Step 13 (17:20–17:40, V10; no-fit; same key)
- **Verdicts.** As step 12. KY21's water is unconfirmed (44 %, no refill).
- **Reference allocation.**
  - As step 12, plus a line on the Honkaharju forest road ahead: 210–357 m away, so the head arrives in about 27–45 minutes at the 7.9 m/min the CA runs in this window. The road line uses EK16 once released, and VPK.
  - R2 as the fallback (EK11's 17:41 move).
  - This is "narrow from the anchor + line ahead". The build codes it C only through `soundSecondary`; the same front cannot carry both tasks (coa F7).
- **Judgement.**
  - The records up to 17:40 say 0.9 ha and 0.3–1 m (DR2 17:25, DR3 17:35). The truth over 17:20–17:40 is 7.9 m/min with 1–2 m, class 3, recorded at 17:45. So the window for a direct attack is closing during the view.
  - With Kalajoki-consistent flames at that rate (head about 3.8 m, flanks about 2.5 m), both a head attack and even a flank attack would exceed the PROVISIONAL equipment limit.

### Steps 14–15 (17:40–18:20, V11; fit; key: line or protect, direct attack = D)
- **Verdicts.**
  - Run 2: the road-line crews (EK11, EK16, KY21, VPK) are INFEASIBLE; no ER/SZ is on record before 18:26. KY21 at 18:00 is 116–161 m from the front.
  - Water: KY21's 22 % is followed by an EK13 basin (evt.c15.003/.005); EK16 and EK12 have sprinkler basins topped up by EK13 (evt.c14.017, evt.c15.007).
  - Hours: EK11 6.2 h, VPK 6.0 h, EK14 4.7 h with no rest (relief requested, evt.c15.039).
- **Reference allocation.**
  - Main effort: the Honkaharju road line with sprinklers and trigger points, ahead of the SE front's head.
  - R2 line prepared (EK11, EK12).
  - Lahdenkylä: the evacuation decision.
  - **Plus, legitimately:** one crew on a limited flank attack from the anchor on the front's upwind (W/NW) flank. Pushed facts: 4.5 m/min, 0.3–1 m (DR2 18:05); KY21's flank at 0.3–1 m (evt.c14.025). It needs a trigger to withdraw by 18:30, when the forecast wind event starts.
  - DR2 overhead.
- **Judgement.**
  - A flank attack from the black is FEASIBLE (coa F5; my check agrees). V11 is therefore *mixed* on the pushed facts, and D only if the recorded 18:00 forecast and a 40-minute horizon are weighed.
  - SPEC/27 §7.3 e (crews within 10–15 m of the SE edge) **does not describe this build**: in steps 14–20, EK12, OUT1 and OUT2 are 517–1513 m from the SE front, on R2 (`scripts/crew_dist.py`). SPEC/18 ad.2 (`road_line` tasks) and ak (10 Oct commander review) superseded it. Coa F12 still holds: scripted crews already do the A posture.

### Steps 16–17 (18:20–19:00, V12; fit)
- **Verdicts.**
  - Run 2: EK16 FEASIBLE at c17. Its 18:41 line (atom.radio.17.1) gives a trigger, an escape route east to the log landing at the R2 junction as a safety zone, vehicles turned and a lookout. It is the only complete LCES among the road crews.
  - KY21 at c16–c17: escape route only ("east along the road to R2", atom.radio.16.3), no safety zone.
  - Run 2b: KY21 (c16–c17), VPK (c16) and EK16 (c17) fail the downwind rule. The road had smoke at 18:27 (evt.c16.018) and was "flames at the roadside, not safe to drive" at 18:47 (evt.c17.020). No CO reading exists.
- **Reference allocation.**
  - No direct attack on the head: ~10 m/min, gusts 14, Kalajoki-consistent flames about 4 m (KAL 4.6: direct attack on heads ineffective and very risky).
  - Hold the road with sprinklers, triggers and escape routes. R2 line with EK11, EK12, and OUT1/OUT2 en route.
  - Sprinklers at Lahdenkylä's buildings; evacuation by the police, with VPK assisting.
  - No aircraft (HELI1 recalled). Request the night shift now.
- **Judgement: KY21's escape route is compromised.**
  - At 19:00 the fire sits on the road at chainage 908–1306 m from the R2 junction. KY21 stands at 1290. Its stated escape route "east to R2" therefore runs through the contact stretch.
  - The truth outline covers KY21's spot at 19:00 (8 m inside).
  - A record-consistent alternative exists: the track running north from KY21's stretch is 248 of its 320 m inside the SE front's burned area by 18:40. That is an escape into the black, upwind.
  - **Fix the record text** (KY21 18:26). This does not change the participant key, but a Finnish panel will see it.

### Step 18 (19:00–19:20, V13; fit; the contradiction)
- **Verdicts.**
  - Run 2: EK16 FEASIBLE (carried from 18:41); everyone else on R2 lacks ER/SZ.
  - Run 2b: EK16 fails downwind. "Flames at the roadside" (evt.c18.024); 80–186 m from the front.
- **Reference allocation.**
  - The R2 line and Lahdenkylä are the main effort.
  - EK16 out to R2 at once.
  - KY23 (about 100–140 m from US2) digs out the north-edge holdover. That is mop-up by the crew on scene: the holdover stays 0.09 ha on a backing edge.
  - EK14 keeps its line.
- **Judgement: EK16 stays past its trigger.**
  - EK16's trigger ("head ~200 m from the road or the first spot south of the road") fires at 19:00–19:01. The head is at the road (stop at 18:40–19:00) and sparks cross (KY21, atom.radio.18.0). EK16 is also 186 m from the edge after al.3 moved it 150 m west.
  - Yet EK16 withdraws only at 19:21. SPEC/18 ak.5's "310 m at 19:00" predates al.3.
  - Its escape route stays open (the fire is 90–190 m *west* of it), but the panel will see a crew holding 20 minutes past its own trigger.
  - Fix: withdraw at 19:0x, or state in the record why it stays.

### Steps 19–20 (19:20–20:00, V14; no-fit; key: direct attack on the flare-up, main or secondary)
- **Verdicts.**
  - Run 2: only EK15. No R2 crew (EK11, EK12, EK16, KY21, OUT1, OUT2, VPK) has a recorded escape route or safety zone. KY23 has its own (atom.radio.19.4).
  - Water is confirmed on R2 through the basins and sprinklers (evt.c19.003, evt.c19.016, evt.c20.005, evt.c20.020).
  - Hours: EK12 7.0 h, KY21 5.7 h, EK14 6.3 h; EK11's crew changed at 19:20 (atom.radio.19.3) after a heat-stress alarm (evt.c19.049).
- **Reference allocation.**
  - **Main effort: R2 and Lahdenkylä.** The head runs 8–10.6 m/min toward R2, the tankers' water route. It is about 460–560 m away at 19:40–20:00; records give ~550–560 m. Residents remain in at least two houses.
  - **Secondary: US3**, from the old black. Two engines paired for hose (a single unit is INFEASIBLE on hose, coa) from the north flank: EK15 (3.0 h, 80 %) or KY23 (2.7 h, 77 %), about 1 km by road. The forest contractor's patrol forwarders (10 m³ each, evt.op.04) are the natural asset. US3 is 0.22–0.48 ha, flames <1 m, flanking south.
  - KY23 digs out US2.
  - Request the night organisation early.
- **Judgement.** Rescue first, counter the greatest threat, create a main effort (MV22). A main effort on a 0.3 ha flare-up while the head runs at a road and a village with people in it is unsound. There is no evening lull: RH 26 %, and the SPEC/27 §7.4(i) lull is not implemented. So a head attack also stays unsound.

### For the expert panel
- Whether "Escape route: our own vehicle" is an acceptable escape route for crews on R2 downwind of a 10 m/min head, and which safety zone they would name: the R2-junction log landing, or the Lahdenkylä fields.
- Whether KY21 at 18:40–19:00 and EK16 at 19:00–19:20 would be pulled earlier.
- Whether 0.3–1 m and 1–2 m flame bands are credible at 4.5–10 m/min in dry pine heath at RH 26–28 %.
- Whether the water supply really reaches the work lines: the 620 m and 400 m lines with "pressure stays low" in phase A are below MPV25 hydraulics.
- Whether drone reports reach command: they are recorded, not pushed, by design (SPEC/27 §7.1).

## Keys vs tactics

| View | Build key (`demo-directive.ts`) | Does it hold tactically? | Link to coa.md |
|---|---|---|---|
| V9 | sound `direct_attack` on NEW_FRONT (L3; L2 boundary), main or secondary (`soundSecondary`) | **Yes**, as an anchored flank attack (pincer from the black), not head-on. At 3–4.5 m/min a Kalajoki-consistent head flame is 2.4–2.9 m, beyond hand tools and marginal for hose. | **F1:** a crew with hose lines on a *spreading* rekindle (open flame, 3 m/min, SPOT 17:10) is making a direct attack in Finnish usage; jälkisammutus (mop-up) is for an edge that has stopped. The C/B split by label is not a tactical distinction. Make F1(c) (count mop-up or hold-line on the keyed front as attended, C) the primary coding, or define the labels by the edge's state. |
| V10 | as V9 | **Holds on the records up to 17:40** (0.9 ha, 0.3–1 m) as "narrow from the anchor + line ahead". It is fragile: the CA runs 7.9 m/min in the window, and realistic flames make even a flank attack marginal. | F1 as V9; **F7** (the same front cannot carry the barrier and the flank task). |
| V11 | sound `barrier_line`/`protect_values` on the head's sectors; direct attack = D | **Mixed on the pushed facts.** A limited upwind-flank attack from the black with a trigger at 18:30 is FEASIBLE and doctrinally sound. D holds only if the recorded forecast and a ≥40-minute horizon are weighed. A realistic flame table (head ~3 m, flanks ~2 m) would make it marginal and strengthen D. | **F5 confirmed.** SPEC/27 §7.3 e is superseded (no crew at the SE edge); F12 stands. |
| V12 | as V11 | **Yes**: 7–10 m/min, gusts 14, KAL 4.6. | F10 (freeze cue) is not tactical. Add KY21's escape-route fix (FS). |
| V13 | as V11 (L3) | **Yes**: the head is at or across the road; R2 and Lahdenkylä are next. | **F6:** US2 (0.09 ha, not spreading, KY23 about 140 m away) is mop-up for the crew on scene. US3 at V14 (unattended, flanking) is a direct attack. The panel should key the difference on edge state and crew presence. Fix EK16's trigger timing. |
| V14 | sound `direct_attack` on SECOND_REKINDLE (L4; L1 boundary) as main; or as secondary with main in L3 | **Only the secondary route.** A main effort on the flare-up breaks rescue first / greatest threat (head 8–10 m/min about 460–560 m from R2, residents in Lahdenkylä). The secondary attack needs two units (hose). | **F2 confirmed:** key V14 as secondary-route only (main L4 codes D). F3: the guide's P2 flag cites the SE head, which is the wrong front for this key. |

## Missing data before Gate A

Gate A here means "the fire is validated". Each item is a concrete data item. "Key?" says whether adding it can change a study key.

| # | Data item | Where it goes | Key? |
|---|---|---|---|
| 1 | **Flame-length table:** per step and per segment (head, flanks, rear), consistent with rate and fuel. Anchored on Byram and the Kalajoki pairs (3–4 m/min ↔ 2.6 m; 5–7 m/min ↔ 4–4.4 m; flank about 0.6–0.7 × head) until the SMP table is obtained, or taken from Prometheus HFI. The record bands (DR2, EK16, KY21, SPOT) follow it. | records, `cycles.json` `fl_*` | **Yes:** V10 (head about 3.8 m, flank about 2.5 m at 7.9 m/min: may become mixed), V11 (F5 resolves toward D), V9 (holds only as a flank attack). V12–V14 get stronger. |
| 2 | **Time-aligned export:** fire type, flame band and head bearing for the same window as `ros_head_m_min`; bearing null when the rate is 0; spotting dated to the source step; `smouldering_spots` to catch "voivat kyteä" (rekindle.objection). | exporter | No. It removes 5 false flags and the EK11 c7 artefact. |
| 3 | **T / RH / dew point every step** at the station, including 17:00, 19:00, 19:40 and 20:00. | records | No, unless an evening recovery is authored. That would open the SPEC/27 §7.4(i) lull and could make a head attack sound at V14, which changes V14. |
| 4 | **CO proxy per crew position:** ppm, or an MPV25 zone from a downwind/smoke rule using DR3's smoke column (evt.c14.002: visibility <100 m east). | `placements[].co_ppm`/`zone` | Probably not: the R2 crews are 450–1100 m off with "no smoke on the road" at 19:47 (evt.c20.021). It changes the soundness of KY21 (c17) and EK16 (c18): immediate danger without SCBA. |
| 5 | **Crew sizes:** SPEC/18 §8.1 has them (1+5, 1+3, 1+4) but the export's `persons` is null. | export | No. It supports V14's resource judgement. |
| 6 | **Hose carried per unit and the layout:** MPV25 model, work-line bar and L/min, main/work line lengths, plus the MPV25 manual-lay limit. Records give only "spare hose" and "pressure stays low". | units, placements, thresholds | It changes the feasibility of the secondary route in V9 and V14 (one unit vs two), not the posture. |
| 7 | **Shift hours:** the records have them ("Crew in the field for X h") but the export has null. | export | No. Fatigue flags: EK11 7.2 h, EK12 7.0 h, heat stress at 19:22. |
| 8 | **LCES lines for every crew a key relies on:** R2 crews at 19:00–20:00 (escape route plus a named safety zone: the R2-junction log landing, the Lahdenkylä fields); KY21's 18:26 escape route; EK16's 19:0x withdrawal. | records | No, but the panel's soundness judgement of the A posture rests on it. |
| 9 | **An L4 precursor before US3**, e.g. smoke at the west edge 18:50–19:10. | records | No. |
| 10 | **Prometheus inputs:** FMI-tuned fuel grid and lookup; hourly weather with starting FWI codes; ignition polygons; the breaching setting (see the request). | external | The validation itself. If phase-A rates fall outside tolerance, the forcing changes, which re-tests the 14/14 flags. |
| 11 | **Exporter:** EK14 (Maastopaloyksikkö) typed as an equipment-class unit, not `unknown`. | exporter | No. |

## Not checked

- **Prometheus was not run.** All FBP numbers are my indicative FBP92 computations (RSI with the BUI effect; the LB equation) using SPEC/18 §6 design ISI/BUI, which is valid for phase A only. They are not model output.
- `perimeter_compare.py` was smoke-tested only (truth against reported, `pipeline_smoke.json`): the files load, the CRS is accepted, and buffer(0) repairs the touching MultiPolygons. It is not a comparison.
- The Finnish flame-length table (SMP) is not obtained, so the intensity limits are US-based and PROVISIONAL. MPV25 tables 3–7 (hydraulics, lay lengths) and line production rates are MISSING. CO zones could not be checked anywhere.
- I did not inspect the CA code beyond the forcing rows and events in `scenario-18.ts` and the fuel table. The 12:20–13:20 prologue steps (W3–W5) are not in the export and were not checked.
- No GeoAI follow-up was done: no DTM or terrain-hydrology check (the DEM is fictional), no map series (the verdict GeoJSONs are in `fire_tactical/results/` for cartography), no geo-data provenance pass.
- The app was not run. I did not read the panel record sets view by view (I used the export's facts). The Finnish register of the proposed record fixes is left to native review.
- Kalajoki recognition risk was not re-checked.

## Files

All paths are under `/tmp/claude-0/-home-user/f4c97d84-cd2f-5439-9eeb-476ca5afe486/scratchpad/audits/fire_tactical/`.
- `fire_check_report.json`: the fire check.
- `fuel_per_cycle.json`: fuel and slope of newly burned area per cycle.
- `compare_thresholds.proposed.json`: the proposed comparison thresholds.
- `pipeline_smoke.json` (with `pipeline_truth.geojson` and `pipeline_reported.geojson`): the pipeline smoke test.
- `inputs/run{1,2,2b}_cNN.json`: tactical inputs; run 2 carries `_run2_provenance` with a record id per filled field.
- `results/run{1,2,2b}_cNN.result.json` and `.verdicts.geojson`: tactical results.
- `scripts/`: `evidence.py`, `build_runs.py`, `summarize.py`, `crew_dist.py`, `road_contact2.py`, `lb.py`, `parts.py`, `fuel_per_cycle.py`.
- `crew_records_12_20.txt`: the crew records for steps 12–20.
