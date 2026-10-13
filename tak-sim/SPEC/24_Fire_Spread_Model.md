# 24 — Fire spread model: a cellular automaton for the truth and the envelope

**Version 0.1 · 23 September 2026 · Status: adopted in principle; parameters provisional, pending the domain reviewer.** Implemented in `tools/fire-ca/`, tested in `test/fire-ca/`. Amends `03` §6.1 ("Envelopes are authored, not modelled"), which carries a marker. Runs on the site chosen under `23`.

> **Changelog**
> - **9 Oct 2026 (aj)** — rekindles start from the old fire (ignition through the held line; the new fire traced apart, sharing the old edge); the forcing re-tuned behind them (steps 14, 17, 19); keys that moved (aj.1–aj.4).
> - **9 Oct 2026 (ah)** — review fixes: winds re-authored at 15:40–16:00, 17:00–18:00 and 19:20–19:40 so the fire follows the wind meter (per-step check in ah.3); the crown-run spots joined at 15:40; PP4 a north-edge holdover (US2); the `inactive` edge status and the head glow; why the old fire stays put after 17:00; the crown run's rate (FBP C-2); 14 / 14; 162.8 ha at 19:40. See the revision at the end.
> - **9 Oct 2026 (ad)** — control staging: L2 at step 10, L1 and L4 at step 11 (was L2 and L4 at step 10); 14 / 14 flags (`18` ad.4).
> - **8 Oct 2026 (ab)** — the fire is unchanged (14 / 14 flags); what the reports say about it changed; the numeric freeze items are keyed on the reports. See the revision at the end.
> - **8 Oct 2026 (aa)** — the researcher's thermal-inertia change, retuned (option B): steps 10 / 11 / 12 actual 2 / 3 / 4; areas 125.3 ha at 16:20 and 174.8 ha at 19:40; flags 14 / 14 (V7 holds). See the revision at the end.
> - **6–8 Oct 2026 (y)** — rekindles anchored to the burned edge; areas now 128.6 ha at 16:20, 173.6 at 19:40 and ~175.9 at 20:00; the step-6 crown run of 38 m/min accepted; V7 flag mismatch (13 / 14). See the revision at the end.
> - **25 Sep 2026 (p)** — the export builds 14 views from step spans; envelopes and flags per view (`26`).
> - **0.2 · 23 Sep 2026** — Salpa corridor removed from the template; spread-capacity screen added (`tools/fire-ca/screen.ts`, `23` §3 H6).
> - 0.1 · 23 Sep 2026 — created.

---

## 1. What this is, and what it is not

The fire's perimeters and the machine's envelopes are generated **offline, at authoring time**, by a cellular automaton (CA), and then frozen into the scenario as polygons. The instrument still does not simulate fire (`00` §0): no participant's browser ever runs the model, and every participant sees identical geometry. Running a spread model live would break determinism — floating-point results differ between browsers (`05` §3) — and event timing.

What the model buys:

- **Both sides of the judgement from one model.** The truth and the envelope differ only in their inputs, so the error mechanisms M1–M4 are *input differences*, not drawn errors.
- **Flags come out of the model instead of being drawn.** A validator reproduces the authored flag sequence or reports where it fails. Hand-drawn envelopes risk an unintended cue: wrong envelopes that look systematically different from right ones.
- **Geography and speed are checked against each other** (`23` §6).
- **Counterfactual branches are cheap**: rerun with the branch's weather (`03` §9, `11` §2.6).

**Citation.** Alexandridis, A., Vakalis, D., Siettos, C. I., & Bafas, G. V. (2008). A cellular automata model for forest fire spread prediction: The case of the wildfire that swept through Spetses Island in 1990. *Applied Mathematics and Computation, 204*(1), 191–201. The model structure is theirs; the Finnish fuel mapping and the recalibration in §4 are ours. Verify the published parameter values against the paper before citing them.

---

## 2. The model

A square grid of cells, 25 m by default. Each cell is **no fuel**, **unburned**, **burning** or **burned**. On each step, a burning cell burns out and ignites each unburned 8-neighbour with probability

```
p_burn = p_h · (1 + p_veg) · (1 + p_den) · p_w · p_s        (capped at 1)
p_w    = exp(c1·V) · exp(c2·V·(cos θ − 1))
p_s    = exp(a·θ_s)
```

- V is the wind speed (m/s); θ is the angle between the wind's heading and the direction of spread.
- θ_s is the slope angle from the burning cell to the neighbour, in degrees.
- p_veg and p_den belong to the neighbour, the cell about to burn.
- Published values: p_h = 0.58, c1 = 0.045, c2 = 0.131, a = 0.078.

Random draws use a 32-bit integer-only generator (mulberry32) seeded from the project's xorshift64* stream per run label, so every run is bit-reproducible (`05` §3).

---

## 3. Additions to the published model

Each addition is explicit, documented in code, and tested.

### 3.1 Speed is authored, shape is modelled

In the CA the head can advance at most one cell per step, and at these wind speeds it saturates there, so the CA's rate of spread barely responds to wind. Each cycle's number of steps is therefore **calibrated** so that the head advances at the rate authored in `18` §7: "Head ROS (actual)" for the truth, "Envelope assumed" for the envelope. Cells-per-step is measured on uniform reference fuel, not assumed. The CA supplies direction, shape, fuel and terrain heterogeneity, and whether the envelope holds.

### 3.2 Authored events

Things the CA cannot produce itself are scripted per cycle: spot fires, the ridge ignition, the omission surfacing from peat, a spot knocked down. Each event is positioned relative to the ignition point (fixed geography) or to the fire's head ("300 m ahead"), and is either:

- **during the cycle** (default) — after the reported situation is fixed, so the envelope never knows about it; or
- **before the report** — already observed, as when the spotting aircraft reports a spot fire in cycle 18.

### 3.3 Perimeter persistence

In the published model a cell burns out after one step. A fire stalled by calm, rain or a birch strip is then extinct when the later wind arrives, which real fires are not: perimeters smoulder and flare again. At the start of each cycle every burned cell next to unburned fuel is relit. The machine's envelope already makes the same assumption.

### 3.4 Sectors in hand

Crews holding a line are represented by securing a sector of the perimeter: its burning cells are put out and the unburned fuel beside it removed, so it can never relight. From `18` §7 cycle 10 ("L1 and L2 in hand"): everything except L3 (the bog, bearings ≈ 130–260° from IGN) is secured. L3 is where the fire returns.

---

## 4. Calibration

### 4.1 The published values give a fire far too wide

With p_h = 0.58 and c2 = 0.131, the flanks spread nearly as fast as the saturated head. The length-to-breadth ratio on uniform pine heath is **below 1** at 4–14 m/s, and the template run burned about 1,050 ha against the 172 ha authored in `18` §7. Lowering p_h alone does not help: burned area has a sharp percolation threshold around p_h ≈ 0.2, and near it the fire goes out (at p_h = 0.21 it did, at W3–W4).

### 4.2 Provisional boreal recalibration

Alexandridis et al. fitted p_h, c1 and c2 to the Spetses fire. We refit **c2** (directionality) and **p_h** to Finnish conditions:

| Parameter | Published | Provisional |
|---|---|---|
| p_h | 0.58 | 0.45 |
| c1 | 0.045 | 0.045 |
| c2 | 0.131 | 0.6 |
| a | 0.078 | 0.078 |

On uniform pine heath this gives length-to-breadth ≈ 1.3 / 2.8 / 4.3 at 4 / 9 / 14 m/s, in line with the empirical wind relation (Anderson 1983), and the fire survived in all seeds tested. **To be confirmed** with the domain reviewer against the authored rates and area.

### 4.3 Finnish fuel classes (proposed mapping)

Alexandridis's categories: vegetation — agricultural −0.3, thickets 0, pine 0.4; density — sparse −0.4, normal 0, dense 0.3.

| Class | p_veg | p_den | Note |
|---|---|---|---|
| Water, built | — | — | No fuel |
| Gravel road | −0.7 | −0.4 | A 5–6 m road in a 25 m cell: a partial barrier |
| Field | −0.3 | −0.4 | |
| Dry pine heath | 0.4 | 0 | Reference class for calibration |
| Mature spruce, unthinned | 0.4 | 0.3 | Truth in SPR |
| Spruce, thinned | 0.4 | −0.4 | What the stale stand data says (M3) |
| Birch–aspen | −0.3 | 0 | |
| Drained pine mire | 0.4 | −0.4 | Deep peat burning is authored (§6), not modelled |
| Cleared corridor | −0.3 | −0.4 | Power-line corridor |

---

## 5. Truth and envelope

| | Truth | Envelope (the machine) |
|---|---|---|
| Fuel | the site's real stand data | the stale stand data (SPR shown thinned — M3) |
| Wind | the **gust** in `18` §6 (what the fire meets) | the **mean** (M2); in cycle 9 the previous south-westerly (the wind has backed and the model has not caught up) |
| Events | spotting, second ignition, omission, lines | none |
| Start | the fire as it is | the **reported** perimeter; its edge is assumed to be burning |
| Rate | "Head ROS (actual)" | "Envelope assumed" |
| Output | one realisation, seeded | ensemble of 24 runs; the envelope is every cell burned in at least **20%** of runs |

**Why 20%, not 50%.** At 50% the envelope is the machine's median outcome, and a single truth realisation pokes past it about half the time even when the machine is right. The cut-off is a tuned quantity, like the rate-mark mix (`12` §5.2). The display still shows one boundary and no probability (`12` §3).

**The truth is one fire.** Near the calibration point, burned area varies between seeds (about 200–240 ha at cycle 20 in the template). Choosing and freezing one seed is a legitimate authoring decision; the seed and the spread across seeds are recorded.

---

## 6. Deriving the flag

`03` §4.2 names the flags and `03` §5 says a categorical breach falls outside the envelope "categorically — not merely further in the same direction". The spec gives no operational rule. **Proposed rule** (needs the researcher's sign-off, `11` §7.5):

- **holds** — every burned cell at the horizon lies within the envelope dilated by the declared containment tolerance (escapes smaller than 3 cells are treated as model noise);
- **categorical** — some escaped fire is **detached** from the dilated envelope (a new front), or the fire escaped where the envelope projected little growth (along the escape's bearing, under 25% of the envelope's largest growth);
- **quantitative** — otherwise: the fire got further in the direction the envelope projected.

Some categorical breaches are about **mechanism**, which geometry cannot see. The author records a basis:

- `mechanism` — a regime change the envelope's model lacks (cycle 6: crown fire with spotting). The CA must still show a real breach; the basis makes it categorical.
- `depth` — the failure is below the surface (cycle 15: deep peat burning). No area breach is needed.

---

## 7. Using the tool

```
npm run fire:ca -- [--site generated|template] [--out <dir>] [--seed <u64>] [--ensemble <n>] [--cell <m>]
                   [--ph <p_h>] [--c2 <c2>] [--tolerance <m>] [--burn-share <0..1>]
```

It prints a per-cycle table (target and achieved head rate, envelope rate, burned area, expected and derived flag, and the evidence), and writes `fire-ca.json` (polygons and evidence) and `fire-ca.geojson` (open in QGIS). Today it runs on a **template site**: a synthetic fuel grid laid out from the `18` §5 table, not a real place. After the site search (`23`), `loadRealSite` reads the site's rasters exported from QGIS as ESRI ASCII grids in ETRS-TM35FIN: a truth fuel raster, the machine's fuel raster and optionally elevation, with a legend from raster codes to fuel classes.

---

## 8. Results on the template site — and what they say about the scenario

> **[SUPERSEDED 2026-09-24]** by §11: the decisions below are taken, and the tool now runs on the generated site by default.

Default settings, seed 20080101, Salpa corridor removed: burned area 94 ha at cycle 6 (authored 58) and 211 ha at cycle 20 (authored 172). The template passes the spread screen of `23` §3 H6 (connected burnable patch ≈ 4,960 ha; fuel share 92–100% in each spread direction). Head rates track the authored ones in phase A. **18 of 25 flags** match the authored sequence. The mismatches are findings about the scenario, not defects to tune away on a placeholder site:

1. **The quantitative breaches are too small to detect** (W5, 14, 17, 19). In `18` §7 truth and envelope rates differ by only 2–3 m/min: **40–60 m per 20-minute cycle**. That is at or below any sensible containment tolerance, so the envelope "holds". Either the rate differences grow, or the tolerance shrinks below what a participant can resolve on the map (`23` §8). **Decision needed.**
2. **A second ignition ahead of the head is, by the spec's own definition, categorical** (W3, cycle 3). A new, detached front is "not merely further in the same direction". Either `03` §4.2 flags these cycles C, or the definition of categorical changes. **Decision needed.**
3. **Cycle 9's categorical breach is weak in geometry.** The wind backs 70°; the machine working from the previous wind still projects growth roughly northward. It needs a `mechanism` basis (the flank becoming a head), or a larger difference in the machine's stale wind.
4. **Phase B growth is weak on the template.** After the cycle 10 lines, the omission fire grows slowly in sparse drained-peat fuel, and the village threat of cycle 17 does not develop. This depends on the real site's fuel and cannot be judged on the template.

---

## 9. Limitations

- Crown fire, spotting, smouldering and suppression are authored, not modelled.
- The square grid carries a mild directional bias (the 8-neighbourhood); the ensemble and Douglas–Peucker smoothing reduce its visibility.
- The grid is aligned to ETRS-TM35FIN grid north; at ≈ 27.3° E this differs from true north by about 0.3°, around 40 m across an 8 km grid.
- The "achieved head rate" measures the leading edge of the whole footprint along the wind heading. It under-reads a secondary front such as the omission fire.

---

## 10. Tests

`test/fire-ca/model.spec.ts`, `geometry-flags.spec.ts` and `run.spec.ts`: wind-factor properties; bit-identical runs for a seed; one-step burnout; no-fuel cells never burn; downwind spread exceeds upwind; length-to-breadth above 2 at 9 m/s under the provisional calibration; persistence and secured sectors; CCW closed rings and 8-connectivity in tracing; the flag rule's four cases; ETRS-TM35FIN round trip; ASCII-grid parsing; scenario-run determinism; head-rate calibration; and hidden events staying out of the reported perimeter.

---

## 11. Revision 24 Sep 2026 — the generated site, the §8 decisions, and the app bundle

**The CA now runs on the terrain the participant sees.** `npm run fire:ca` defaults to `--site generated`: it loads `content/site/{fuel_truth,fuel_machine,elevation}.asc` through `loadRealSite`, the grids the basemap (`23` §11) was drawn from. `--site template` keeps the §7 template for comparison. This closes the `23` §13 verification finding: nothing loaded the generated grids before.

**§8 decisions, taken by tuning `18` §6–§7 (transcribed in `tools/fire-ca/scenario-18.ts`):**

1. **Quantitative breaches get a detectable gap.** Every Q cycle now has truth running at least 3 m/min above the envelope (≥ 60 m a cycle, beyond the 50 m tolerance). Changed rows (actual / envelope, m/min): W3 6 / 3 (was 6 / 4), W5 8 / 2.5 (7 / 5), 3 7 / 5 (7 / 7), 14 7 / 2 (6 / 4), 17 11 / 5 (10 / 7), 19 9 / 4 (9 / 7). The tolerance stays at 50 m.
2. **A spot the flag calls Q lands close enough to merge.** The W3 spot across R1 is 70 m ahead of the head (was 440 m from IGN), and the cycle-3 RIDGE ignition is 140 m ahead (was 250 m). Each joins the main fire within its cycle, so the escape is "further in the same direction". `03` §4.2 and the definition of categorical are unchanged.
3. **Cycle 9 has a `mechanism` basis:** the north flank becomes a head that the machine, still on the previous wind, treats as a flank.
4. **Cycle-6 spotting is 200–250 m** (was 300–350 m), the short end of `18` §7's 200–400 m. The crown run then drops in BIRCH in cycle 7 as authored.

**Results, default settings, seed 20080101 (frozen):**

| Site | Flags matching | Area, cycle 6 | Area, cycle 20 | Spread screen (H6) |
|---|---|---|---|---|
| Generated (`content/site`) | **25 / 25** | 56 ha (authored 58) | 164 ha (authored 172) | PASS: 4,945 ha; NE 99%, NW 92%, SE 99% |
| Template (§7) | 24 / 25 (cycle 3 holds) | 67 ha | 168 ha | PASS |

**Across seeds on the generated site:** 1 → 23, 42 → 23, 777 → 24, 2030 → 22 of 25. The misses are borderline Q/H cases (W3, W5, 3, 5, 7, 14), the thin margin §5 predicts for a 50 m tolerance. Seed 20080101 is frozen as an authoring decision (§5, "the truth is one fire"), and the spread across seeds is recorded here.

**The fire on the ground (generated site, seed 20080101).** The head runs NE over Kuivakangas (RIDGE) into Kuusimäki (SPR), crowns in cycle 6 and drops at Koivuoja (BIRCH), about 2.8 km NE of IGN. When the wind backs (cycle 9), the north flank runs NNW. It stops about 1.6 km short of Mökkiranta and is held from cycle 10. The 2024 ditch-spoil fire surfaces in Rahkasuo at 17:00, 1.75 km S of IGN (cycle 12). It stays a **separate front** for the rest of the session and runs SE under the north-westerlies. At 20:00 its head is about 0.8 km from the centre of Lahdenkylä, held on the village fields.

**Detached fronts are first-class.** Because the Rahkasuo front never joins the main fire, the CA's result now carries `reportedDetached` and `envelopeDetached` alongside `spotFires` (truth). The contract carries them as `CycleSpec.detachedFronts`, `CycleSpec.actualDetachedAtEnd` (truth) and `Envelope.detachedParts`. These are islands of the same single boundary, not a second band (`12` §3.1).

**The app bundle.** The generated run also writes `app/scenario/site-scenario.json` through `tools/fire-ca/site-export.ts`. The file holds cycles 1–20 with the reported fire, envelope, truth, wind, the observed head rate, and unit and aircraft positions (`18` revision (k) §k.3). Every coordinate goes through ETRS-TM35FIN (`tm35ToWgs84`), the grid the basemap is georeferenced in. This removes the ~0.3° grid-north offset of the CA's local frame (§9), so the fire lines up with the terrain drawn under it. `app/scenario/demo-scenario.ts` builds the demo contract from this file. `test/scenario/site-scenario.spec.ts` checks that every derived flag matches the canonical sequence, that all geometry lies inside the extent, that drones are grounded in cycles 8–9, and that the omission stays hidden when reported.

**Rate marks use the authored actual rate** (`18` §7, previous cycle), not the CA's achieved head rate. §9 already notes that the achieved rate under-reads a secondary front: it reads 0 m/min through cycles 10–15, while the Rahkasuo front is the active one.

---

## 12. Revision 24 Sep 2026 (b) — roads and brooks as barriers

**Before this revision the fire could not be stopped by anything on the map but water.** Forest roads, tracks and brooks were drawn on the basemap but absent from the fuel grid. Gravel roads were in it only as a fuel of lower rate, which a fire crosses within a few steps. A participant looking at the map would expect roads and brooks to matter; the model ignored them.

**Barrier fuel classes.** The fuel grid (`tools/topo-map/build.ts`) now rasterises three linear breaks. Tracks (*ajopolku*) and paths are too narrow and stay out.

| Class | Width | Crossed at full rate when | Otherwise (ember leak per contact) |
|---|---|---|---|
| `road_gravel` (R1–R3, farm roads, main roads) | 6–8 m | gust ≥ 9 m/s and spread within 45° of the wind's heading | 1% |
| `road_forest` | 4–5 m | gust ≥ 7 m/s, within 60° | 2% |
| `brook` | 1–3 m, wet banks | gust ≥ 6 m/s, within 60° | 3% |

In other words, a barrier stops flanks and backing fire, and a head fire in light wind. A head fire in a strong wind crosses it, and so does authored spotting, which jumps anything. The truth runs on the gust and the machine's envelope on the mean wind, so a gust-driven crossing the machine cannot see is one natural way an envelope fails (M2). On a uniform-pine test grid over 60 steps, a gravel road stops the fire in 19 of 20 seeds at 5 m/s, and fails in all 20 at 10 m/s (`test/fire-ca/model.spec.ts`).

**Re-tuning.** Two cycles changed.
- **Cycle 3:** envelope rate 4 m/min (was 5).
- **Cycle 4:** the gusting head (10 m/s) jumps R1 north of the head, where the machine's 6 m/s mean cannot follow. That would breach an authored "holds". SPEC/18 §7 cycle 4 already has "the line along R1 holds", so the event list now makes it happen: EK14 wets the north verge of R1 (`remove_fuel`, 90 m) and stops the slop-over, and says so on the radio.

Results, seed 20080101:

| | Flags | Area, cycle 6 | Area, cycle 20 |
|---|---|---|---|
| 1 Oct 2026, phase B widened | **25 / 25** (views 14 / 14) | 48 ha (authored 58) | **168 ha** (authored 172) |
| This revision | **25 / 25** | 48 ha (authored 58) | **133 ha** (authored 172) |
| Previous (§11) | 25 / 25 | 56 ha | 164 ha |

The fire is now about 23% smaller than authored at 20:00, because roads and brooks really slow it. **For the reviewer:** keep that, or raise phase-B rates to recover about 170 ha.

**What the fire did at the barriers** (`tools/fire-ca/crossings.ts`, from the CA masks):
- **Cycle 1:** creeps across R1 at one point; EK11 puts it out.
- **Cycle 4:** held at R1 by EK14.
- **Cycle 6 (crown run):** embers jump the Kuusimäki forest road and Korpioja, with no crew near.
- **Cycle 8:** stopped at Koivuoja's wet banks.
- **Cycle 18:** stopped at the Honkaharju forest road.

Each goes on the radio (`18` revision (l)).

---

## Revision 25 Sep 2026 (p) — views from step spans

The forcing and the CA run are unchanged (25 steps, same seed). `site-export.ts` builds the 14 views of `26` §3 from step spans. A merged view's envelope projects to the end of its second step, and its flag is computed from that envelope. The CI flag check becomes the 14-flag sequence of `26` §3. The rekindle moves (`26` §5) change `UNIT_PLAN` only.

---

## Revision 1 Oct 2026 — phase B widened

The researcher's answer to §12's question: raise phase-B rates so the fire is back near the authored ~172 ha at 20:00. Five rows of the forcing change (`scenario-18.ts`, `18` revision 1 Oct 2026); on "holds" steps the actual and envelope rates rise together, and step 14 keeps its 5 m/min gap. Phase A (W1–10), the seed, the events (the step-12 rekindle in BOG-S, F7) and the flag rule are unchanged.

| Step | 10 | 13 | 15 | 20 |
|---|---|---|---|---|
| Burned area, before (ha) | 99.7 | 100.8 | 102.4 | 132.6 |
| Burned area, after (ha) | 99.7 | 101.9 | 108.1 | **167.7** |

Step flags 25 / 25, view flags 14 / 14 (7H / 3Q / 4C).

**R2.** The Rahkasuo front still does not reach R2 at step 13. Its nearest burned cell is 766 m west of the road (941 m before). It closes to 66 m by step 20 and crosses nowhere (`crossings.ts`). §7's "Fire crosses R2" at step 13 is therefore still not what the CA shows.

## Revision 2 Oct 2026 — staged control, the live head, separate fires

- **Control is staged.** `control_sector` runs at step 10 for L2 (20°→130°) and L4 (260°→330°), and at step 11 for L1 (330°→20°). The exporter shows every stage as contained from the report after it (`site-export.ts` `controlStages`).
- **The observed head is the live front's** (`run.ts` `liveHeadPoint`). It is the furthest point along the heading of what burned since the last report. A separate patch under 1 ha (a spot fire) is skipped while a front grows elsewhere. The whole mask is used only when nothing grew. Over the whole mask the head had stayed on the dead NE tip, 2 km from the rekindled front.
- **Separate fire = not connected.** A fresh patch is a separate fire when it does not touch the previous fire (`traffic-fire.ts`). Before, any fresh cell more than 400 m out counted, which capped every measured advance at 20 m/min.
- **Truth head for map keys.** `truthHeadAtEndOf` (`freeze-keys.ts`) takes the furthest vertex within the part of the fire that the next report's head lies on.
- **Forcing and area.** The forcing changes are listed in `18` (amendment 2 Oct, later). Area is 123.6 ha at 16:20 and 157.4 ha at 19:40.

---

## Revision 6–8 Oct 2026 (y) — rekindles on the burned edge; current areas; the crown run accepted

- **The rekindles are anchored to the burned edge** (researcher decision, 6 Oct 2026). The step-12 and step-19 ignitions are placed on the actual burned edge of the origin, not at a fixed bearing and distance (`scenario-18.ts`, `placement.ts`). The CA's backing spread is not used to place them.

  | Rekindle | Position | Size |
  |---|---|---|
  | V9 | ~120 m from the point of origin | — |
  | V10 | — | ~0.8 ha |
  | V14 | ~130 m west of the point of origin | ~0.3 ha |

- **Areas** (CA, seed unchanged):
  - 16:20 (step 10): 128.6 ha (was 123.6);
  - 19:40 (step 20): 173.6 ha (was 157.4 / 160.3);
  - **20:00: ~175.9 ha** (165.6 ha on 5 Oct; 167.7 ha on 1 Oct).

  The area is now slightly above the authored ~172 ha.
- **The step-6 crown run.** The achieved head rate is **38 m/min** (forcing 30 m/min actual, 8 m/min envelope). It is accepted as it is (researcher default, 6 Oct 2026). The head rate the participant reads around it is in the records only; rate marks are not drawn (`12` revision (y)).
- **Achieved head rates, steps 11–15** (A8, 6 Oct 2026): 0, 5.3, 8.4, 8.8 and 6.3 m/min.
- **The observed head's observer** (FC9) follows who actually watches the head:
  - DR1 to step 7;
  - HELI1 at steps 8–9, with step 9 a band of 5–10 m/min marked as an estimate;
  - then EK11, DR3, EK11 at steps 10–12;
  - DR2 from step 13.
- **The V14 step-20 flare-up outline** is drawn clipped while SPOT reports it burning (`reportedDetached`). This was accepted on 8 Oct 2026.
- **Flags: 13 of 14 views match (was 14 / 14 at HEAD). Superseded by revision (aa): 14 of 14 after the thermal-inertia retune.** In the current build, **V7** (step 10, the lull) derives `breach_quantitative` ("further in the projected direction") against its expected `holds` (`site-scenario.json` `flagMatches: 13`). Not reconciled: the researcher decides whether V7's flag changes or the forcing is adjusted (`11` §7.18).
- **Not changed:** the seed (20080101) and phase A's forcing.

---

## Revision 8 Oct 2026 (aa) — thermal inertia through the lull (option B); flags back to 14 / 14

Researcher change of 8 Oct 2026 to `tools/fire-ca/scenario-18.ts` (not edited by the docs or generator passes), retuned the same day to keep `26` §3's 14 / 14. The seed (20080101) and phase A's forcing are unchanged.

**The idea.** The fuel heated through the afternoon keeps the fire spreading a little through the lull and its end. Step 10 stays a lull; the decay carries into 16:40. Forcing rows (step, clock, wind from °, mean, gust m/s, actual and envelope head rate m/min):

| Step | Clock | Wind | Actual | Envelope | Was (actual) |
|---|---|---|---|---|---|
| 10 | 16:20 | 130°, 3, 5 | **2** (achieved 3.5) | 1 | 1.5 |
| 11 | 16:40 | 180°, 3, 5 | **3** (achieved 0) | 1 | 1 |
| 12 | 17:00 | 240°, 3, 6 | **4** (achieved 3.5) | 1 | 4 |

- **Step 12 stays at 4.** At 5 m/min the front reaches the Honkaharju forest road a step early and crosses it at 18:40–19:00 with no stop first; the road's stop and the 19:00–19:20 crossing are V13–V14's designed sequence (`08` revision (aa): `road_crossed`).
- **Larger values were tried and rejected:** the researcher's first values at steps 7–9 (18 / 12 / 9), 10 (6.5), 12 (5) and 19–20 (10.5 / 9) broke the views V5, V7 and V13 and cut off the north-flank crew.
- **Flags: 14 of 14 views match.** This supersedes revision (y)'s "13 of 14", where V7 derived `breach_quantitative` against an expected `holds`. V7 now holds (`site-scenario.json` `flagMatches: 14`).
- **Areas (CA, as exported):** 125.3 ha at 16:20 (step 10; was 128.6) and 174.8 ha at 19:40 (step 20; was 173.6). The 20:00 area is not in the site file.
- **Achieved head rates, steps 10–15:** 3.5, 0, 3.5, 6.7, 8.8 and 5.2 m/min (revision (y): 0, 5.3, 8.4, 8.8, 6.3 for steps 11–15).
- **Rekindles** are still anchored to the burned edge (revision (y)); their ignition rows are unchanged (`anchor: "edge"`, step 12: 135°, 80 m, 35 m radius; step 19: 275°, 80 m, 30 m).
- **The achieved step-6 head rate** is 38 m/min and accepted (the spots merge with the head).
- **Reports that depend on the CA** (`traffic-drones.ts`, `traffic-lateral.ts`): the drone edge direction is the outward normal where the edge advanced most, and an edge under 2 m/min is reported as backing (`18` revision (aa)).

---

## Revision 8 Oct 2026 (ab) — the fire is unchanged; what the reports say about it changed

Fix pass 6 (8 Oct 2026) changed no fire forcing and no CA parameter: `tools/fire-ca/scenario-18.ts` and the fire physics checker were not edited. Read from `app/scenario/site-scenario.json` on 8 Oct 2026, the exported series equal those at HEAD (the file's `steps[].areaHa` and `observedHead.rateMpm` are identical to the committed ones): the burnt area is 121.5 ha at step 9, 125.3 ha at step 10, 133.6 ha at step 15 and 174.8 ha at step 20, and **`flagMatches` is 14 of 14**, as in revision (aa). (The V10 freeze basis of revision (aa) quoted ~135.8 ha at step 15; the CA gives 133.6 ha, and `08` revision (ab) corrects the basis.)

What changed is the **reports** drawn from the same fire (`18` revision (ab)): a thermal rate record now carries its window and says when it includes spot-fire jumps, and the station gives temperature and humidity at 16:20, 18:00 and 19:20. The numeric L3 freeze items are keyed on these reports and not on the CA's later truth (`08` revision (ab) ab.1–ab.3), which is the reason for restating here that the **truth series did not move**: the reported and the true fire differ by design, and the freeze keys use the reported one.

---

## Revision 9 Oct 2026 (ad) — control staging

`control_sector` runs at step 10 for L2 (20°→130°) and at step 11 for L1 (330°→20°) and L4 (260°→330°) — one adjoining arc. **Supersedes revision (y)'s "step 10 for L2 and L4".** View flags 14 / 14; the designed sequence of V13–V14 is unchanged (`18` ad.4).


---

## Revision 9 Oct 2026 (ah) — review fixes: the fire follows the wind meter; the edge's status; the crown run's rate

Scenario-realism review of 9 Oct 2026 (researcher's findings F2–F8, wind vs fire). `tools/fire-ca/scenario-18.ts`, `fire-display.ts`, `site-export.ts`, `deployment.ts`; `app/scenario/site-scenario.json` regenerated. **Where this revision and earlier ones differ, this revision applies.**

### ah.1 Why the fire and the wind meter disagreed

The meter shows the step's forcing wind (`steps[n].wind`); the CA spreads under that wind's gust. The CA's wind handling is correct (`model.ts` `windFactor`); the mismatch had four causes:

1. **15:40 (SSW 200):** the head was blocked by fields, open bog and Koivuoja, and the spreading was done by the 2.5 km north-west flank. A long flank pushed obliquely by the wind moves out along its own normal (north-west), so the visible advance was 331° against a meter blowing to 20°.
2. **16:00 (S–SE 160):** the same flank, still oblique to the wind.
3. **17:00 (SW 240) and 17:20 (W 270):** the flare-up at the origin's south edge was blown back into the burned area and the secured line; it could only grow south. The slope up to the Honkaharju esker also pulls the south-east front south.
4. **18:00 (WNW 290):** the slope again; and 19:00 the PP4 spot fire placed upwind (ah.3).

The drone-reported head bearings use the previous step's wind (they describe the last 20 minutes, which the map shows). With the winds below the change between steps is ≤ 45° except at the front's passage (16:40 → 17:00), when the map shows no growth (16:40 has none).

### ah.2 The re-authored forcing

| Step | Clock | Wind from (was) | Actual head rate m/min (was) | Envelope | Machine wind |
|---|---|---|---|---|---|
| 8 | 15:40 | **165** (200) | **4** (8) | 6 | **230** (was the truth) |
| 9 | 16:00 | **140** (160) | **4** (7) | 1.5 | 230 |
| 12 | 17:00 | **285** (240) | 4 | 1 | — |
| 13 | 17:20 | **285** (270) | 7 | 9 | — |
| 14 | 17:40 | **290** (280) | **6** (8) | 6 | — |
| 15 | 18:00 | **300** (290) | **4** (6) | 6 | — |
| 16 | 18:20 | 310 | **7** (9) | 7 | — |
| 19 | 19:20 | **325** (320) | 9 | 3 | — |
| 20 | 19:40 | **325** (320) | 7 | **4** (7) | — |

- **The backing comes at 15:40** (SSE 165, SE 140 at 16:00, SE 130 at 16:20), so the north-west flank runs north-west with the wind. The machine misses the whole backing (V6 = steps 8+9 both at 230): the designed V6 error is kept and starts at the view's first step. Rates fall so the wider front burns about the same area (125.1 ha at 16:20, was 126.6).
- **Step-8 events (new):** two ignitions carry the head across Koivuoja into the crown-run spot fires (44.4°/2466 m r 65 m; 42.7°/2840 m r 45 m). Without them the spots stayed an 8 ha fire of their own past the brook all evening, the "detached front" that the rekindle arc reserves for the rekindles (V9 must show none).
- **The front passes at about 17:00:** the wind veers from S (16:40) to WNW 285. The flare-up at the origin then runs east-south-east along the old south flank, and south-east with the north-westerly. The rates of steps 14–16 fall so that the forest road still stops the head at 18:40–19:00 and the head still crosses at 19:00–19:20 (V13–V14).
- **Step 20's envelope rate 7 → 4** keeps V14's projection in another band than the report-keyed key (`08` revision (ah)).
- **Flags 14 / 14.** Areas: 94.4 ha at 15:40 (end of step 7: 68), 125.1 at 16:20, 127.1 at 17:20, 137.3 at 18:20, 148.4 at 19:00, **162.8 ha at 19:40** (was 174.8). The road's stop is at 18:40–19:00 (600 m of contact) and the head crossing at 19:00–19:20.

### ah.3 Per-step check: fire advance against the meter

Advance = from the nearest cell of the previous step's fire (and this step's authored ignitions) to the new burned cells; "farthest" is the single farthest new cell, "mean" the distance-weighted mean direction of new cells ≥ 50 m out. Δ = advance − the direction the meter's wind blows to.

| Step | Clock | Before: wind → to; farthest Δ / mean Δ | After: wind → to; farthest Δ / mean Δ |
|---|---|---|---|
| 1–7 | 13:20–15:20 | unchanged (3 and 6: the authored spot fires) | unchanged |
| 8 | 15:40 | 200 → 20; −47 / −52 | 165 → 345; −22 / −24 |
| 9 | 16:00 | 160 → 340; +65 / −29 | 140 → 320; −5 / +2 |
| 10 | 16:20 | 130 → 310; +5 / +10 | 130 → 310; +5 / +5 |
| 12 | 17:00 | 240 → 60; −15 / −23 (rekindle grows south) | 285 → 105; −15 / −7 |
| 13 | 17:20 | 270 → 90; +22 / +29 | 285 → 105; −6 / −10 |
| 14 | 17:40 | 280 → 100; +35 / +9 | 290 → 110; +11 / +11 |
| 15 | 18:00 | 290 → 110; +43 / +10 | 300 → 120; +15 / +7 |
| 16 | 18:20 | 310 → 130; +5 / +13 | 310 → 130; +5 / +23 |
| 17 | 18:40 | 315 → 135; 0 / +4 | 315 → 135; 0 / −6 |
| 18 | 19:00 | 315 → 135; +11 / +3 (PP4 upwind not counted) | 315 → 135; −11 / −33 (the road stops the head; the front spreads east along it) |
| 19 | 19:20 | 320 → 140; −5 / +16 | 325 → 145; −10 / +19 |
| 20 | 19:40 | 320 → 140; −5 / +18 | 325 → 145; −10 / +26 |

### ah.4 PP4 becomes a holdover (F4)

The step-18 spot fire at 8°/1170 m lay 160 m north of the north edge in a north-westerly: upwind, where no ember lands. It is now **a holdover on the old north edge**: fire that crept through roots and humus past the edge east of EK14's stretch flares up in the 18:40 wind event (19°/1225 m from the ignition point, ~75 m outside the burned edge of L1, `before_report`, so on V13's map). The map labels it **US2** (an old edge flaring up again, `rekindle: true` on the event, `FireDisplayInput.rekindleAt`); the origin's west-edge flare-up at 19:20 becomes US3. SPOT reports the north edge flaring up; EK14's own line holds; KY23's lateral "smoke to the east, rekindle unconfirmed" is the reconciling item. V13 still holds.

### ah.5 The edge's status (F2) and the head glow (F7)

`perimeter_current.status` gains **`inactive`**: quiet, not spreading, no crew.
- **uncontained:** the edge advanced more than 37.5 m since the last report;
- **contained:** quiet, within 150 m of a crew working a line there (hose line, pump, fire break, road line, mop-up, hose laying), as the map shows the crews;
- **inactive:** quiet with no crew, where the sector was secured (the control events) or where a crew held it earlier and has left.
The origin's rear is contained in phase A, where VOL1 and KY21 work. At 16:40–17:20 every edge within 300 m of the origin is inactive alike, so the edge that flares up at 17:00 is not singled out (V9's omission is not cued). Head fire: an edge that advanced and faces the spread (within 60° of the heading), within 300 m of the drawn edge furthest along the heading; the observed head mark can sit on a spot fire ahead of the edge (15:40). V6 has a head glow again; V7's is ~740 m (was 1.6 km, flanks included).

### ah.6 Why the old fire does not spread again after 17:00 (researcher's question)

The control events secure the old fire's sectors for good (L2 at 16:20, L1 and L4 at 16:40). Per stretch of the old perimeter after 17:00 (bearing from the ignition point; the share of perimeter faces at 19:00):

| Bearing | Stretch | What stops it |
|---|---|---|
| 0–30° | north edge, Karhujärvi side | crews (EK14, EK15, KY23; KY21 and VOL1 until 17:40) on ~20 % of it; the rest faces the north-westerly, so it backs; the secured line |
| 30–60° | the old head | road R1 and Koivuoja (~20 %), open bog and fields (~18 %); the secured line on the rest |
| 60–130° | the old east and south-east flank | the secured line only, facing downwind: held by the **mop-up patrol** (the region's forestry contractor, two forwarders with water, four men, from 16:45; `traffic-patrol.ts`, its rounds logged at 17:25, 18:05, 18:50 and 19:25) and EK11 on the east edge at 17:00–17:40. At 18:50 a stump flares up inside the line and is put out. |
| 130–260° | L3, the origin's south side | not secured, no crew: **this is where the old edge flares up (17:00)** |
| 260–360° | the origin's rear, the north-west edge | faces the wind and backs into the black; the secured line; **the origin's west edge flares up anyway in the 19:00 wind (19:20)** |

No CA slop-over was added on the downwind east flank: a detached patch there at 18:40 would turn V12 from quantitative to categorical (researcher, via the coordinator: option (a), operational records only). The lull of 16:00–17:00 (~6 ha in an hour) is the backing wind easing to 3 m/s over the fire's own burnt ground, humidity 35–40 % (the 16:01 forecast, the station at 16:20).

### ah.7 The crown run's rate (F3)

The step-6 crown run is authored at 30 m/min actual (8 m/min envelope) and the CA achieves ~38 m/min measured with the spot fires that merge into the head within the step (`18` revision (ab): the record says it includes the spot-fire jumps). This is faster than Kalajoki's 15–20 m/min active crown fire (Pelastusopisto 2022, §4.6) on purpose: the scenario's stand is an unthinned mature spruce stand in a drought (BUI ~104) with ISI 23 (mean wind) to 69 (gust), and the Canadian FBP System's C-2 (boreal spruce) fuel type gives roughly 22–31 m/min for a fully active crown fire at ISI 15–20 with BUI near 100 (Forestry Canada Fire Danger Group 1992, ST-X-3), the source the forcing comment cites. The Swedish inquiry into the 2018 fires (SOU 2019:7) describes crown-fire runs in Nordic spruce under the 2018 drought that outran the resources sent against them; the exact rates it reports should be checked against the inquiry before they are quoted. Kalajoki is the reference for the surface rates (2–3 m/min on peat, 9–11 m/min on mineral soil), which the scenario keeps.

### ah.8 Other fire-display changes

- **F5:** drone thermal detections are sampled by a seeded integer hash (about one cell in three) with a jitter inside the cell, and capped by the same hash; deterministic (no `Math.random`), no longer a diagonal lattice.
- **Bundle:** 992 traffic records; byte-identical on regeneration.

---

## Revision 9 Oct 2026 (aj) — rekindles start from the old fire; the forcing re-tuned behind them

Scenario-realism follow-up (researcher, 9 Oct 2026): a rekindle or holdover must start FROM the old fire — no unburned gap between the old and the new fire, in the grid and on the map. Code: `tools/fire-ca/new-fire.ts` (new), `run.ts`, `model.ts`, `views.ts`, `fire-display.ts`, `site-export.ts`; test `test/scenario/rekindle-contiguity.spec.ts`.

### aj.1 What was wrong

Every rekindle lay outside the burned edge with unburned cells between (the chebyshev gap from the ignited cells to the ground burned before): the origin's south-edge rekindle (step 12) 2 cells (50 m), the north-edge holdover (step 18) 6 cells (150 m), the origin's west-edge flare-up (step 19) 2 cells (50 m). The first unburned ring outside the old edge is the **held line** the control events dug (`secureSector` removes fuel from every unburned 8-neighbour of the secured sectors' burned cells; L2's line, secured at 16:20, reaches one cell into L3), so an "edge-anchored" ignition at 80 m could not touch the edge, and on every map from 17:20 to 20:00 the south-east front was a separate polygon with a white strip between it and the old fire (the browser check of build 0187dd1, V10–V14).

### aj.2 The fix

- **Ignition through the line.** `FireAutomaton.ignite(cells, throughLines)`: a rekindle's disk lights the held line's cells too where they are burnable ground (a dug or wetted strip; never water or built ground): fire that crept under the line through roots and humus surfaces on its far side. The disks now overlap the edge: step 12 at 135°, 30 m past the edge, radius 40 (6 cells, the first row 8-adjacent to the old edge; centre ~65 m from the origin, was ~120 m); step 18 at 27°, 1155 m from the origin, radius 25 (2 cells on the held line at (500–550, 1025–1050), ~140 m east of KY23's crew; was 19°/1225 m, 150 m north of the edge; by bearing it is in L2's wedge, on the fire's north-facing edge); step 19 at 275°, 15 m past the edge, radius 30 (6 cells; centre ~115 m west of the origin). Chebyshev gap 1 (touching) for all three; ember spot fires (W3, steps 3, 6, 7) keep gaps of 4–21 cells; step 8's ignition is the head crossing Koivuoja into the spots, by design.
- **The new fire traced apart.** The map still needs the new fire as a front of its own (V10's new front, V13's holdover, V14's flare-up: `reportedDetached`, labels, keys), so `new-fire.ts` splits the footprint: the fire grown from each rekindle is every cell burned since its ignition that is 8-connected to its ignited cells through such cells (one breadth-first wave from every seed, so two new fires that meet stay distinct up to their meeting line); the old fire is the rest. The two outlines share the old edge. The same split applies to the truth at the horizon, to the views' envelopes and isochrones (the old fire's projection stays a held part, the front's a growing one), to the traffic's "new separate fire" (`masks.separateReported`, the rekindles first on a report) and to the US labels (`fire-display.ts`: a marker while the new fire is under 1 ha and new or still spreading). The step-20 clip of the west flare-up (`rekindleStillBurning`) is gone.

### aj.3 The forcing behind it

With the rekindle grown out of the edge the front reached the Honkaharju forest road a step early (stop 18:20–18:40, crossing 18:40–19:00) and V12 fell to *holds*. Re-tuned: step 14 actual 6 → 4 m/min (the evening surface fire in 5 m/s; the same 4 as 18:00); step 17 actual 11 → 12 in the wind event (9 m/s, gusts 14), its envelope 5 → 4 (the machine keeps the evening rate through the event: V12's quantitative breach); step 19 actual 9 → 10 (the head still runs after the crossing). The road stops the head at 18:40–19:00 (KY21 radios it at 19:0x) and the head crosses in the gusts at 19:00–19:20 (EK16). **View flags 14 / 14** (step flags 23 / 25: steps 14 and 17 are *holds* at step level, their views breach as authored). The south-east front now closes on R2 more slowly: ~568 m at 19:20, ~557 m at 19:40, ~456 m at 20:00 (was 567 / 450 / 322). Areas 127.9 ha at 17:20, ~145 ha at 19:00, ~156 ha at 19:40 (was 162.8). DR2's 19:05 thermal reads 10.1 m/min (was 10.6).

### aj.4 Consequences for the keys (recorded here; decided in `08`/`11` as needed)

- V12 `village_distance`: the report-keyed value is ~1920 m; the upper edge moves 2000 → 2100 m (options "1600–2100", "yli 2100").
- V14 `se_front_r2`: the report-keyed value ~546 m, the projection's 40-minute isochrone ~568 m and the records' ~550–580 m all fall in one band; edges 150/450/650 (margins 96 and 82 m). The item's projection-reliance reading (fix pass 7) is therefore **lost until the item is re-designed** — an open item for the researcher.
- V12's branch statement "advances furthest south-east, over 300 m" → 250 m (the SE advance over 18:20–19:00 is ~340 m).
- Drone road reports now reach 600 m from the drone's target (was 550), so DR2 still checks R2 at 19:4x.
