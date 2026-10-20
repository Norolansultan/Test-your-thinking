/**
 * The incident's forcing, transcribed from SPEC/18 §6 (weather) and §7 (fire behaviour).
 * Where §7 gives a range ("18–22") the midpoint is used; where it says "not represented" or
 * "surface only" the envelope keeps the surface rate. Expected flags per step: prologue and
 * steps 1–20 from SPEC/18 §7 (`STEP_FLAGS`). The scored flags are per view (SPEC/26 §3, `views.ts`).
 *
 * Authored events are the things the CA cannot produce on its own. Positions are bearing and
 * distance from the ignition point, per SPEC/18 §5 and §7; they are rebound to real features
 * after the site search (SPEC/23).
 *
 * Re-tuned 24 Sep 2026 after roads and brooks became barriers (SPEC/24 §12): cycle 3 envelope 4,
 * and the cycle-4 R1 hold.
 *
 * Tuned 24 Sep 2026 on the generated site (content/site, seed 20080101), SPEC/24 §8: the
 * quantitative breaches in W3, W5, 3, 14, 17 and 19 carry a truth–envelope gap of at least
 * 3 m/min (≥ 60 m a cycle, past the 50 m tolerance), and the categorical spots are placed so the
 * CA reproduces the authored sequence. SPEC/18 §7 carries the same numbers.
 *
 * Phase B widened 1 Oct 2026 (researcher's decision, SPEC/24 revision 1 Oct 2026): steps 12, 13,
 * 14, 18 and 20 run faster so the burned area at 20:00 is back near the authored ~172 ha
 * (CA: 167.7 ha then, was 132.6; 165.6 ha by 5 Oct; 175.9 ha since the rekindles were anchored to the burned edge, 6 Oct 2026). Holds steps raise actual and envelope together; step 14 keeps its
 * 5 m/min gap. Phase A (W1–10), events, seed and flags unchanged.
 */

import type { Flag } from "../../app/scenario/types.js";
import type { CycleForcing } from "./run.js";

type Row = [id: string, clock: string, fromDeg: number, mean: number, gust: number, rosActual: number, rosEnvelope: number];

const ROWS: readonly Row[] = [
  ["W1", "11:40", 225, 4, 7, 3, 3],
  ["W2", "12:00", 225, 4, 7, 4, 3], // envelope 4 → 3 (2 Oct 2026 projection audit P2-e): the practice view no longer teaches "the fire stays well inside"
  ["W3", "12:20", 230, 5, 9, 6, 3],
  ["W4", "12:40", 230, 5, 8, 5, 5],
  ["W5", "13:00", 230, 5, 9, 8, 2.5],
  ["1", "13:20", 230, 5, 9, 6, 6],
  ["2", "13:40", 230, 5, 9, 6, 6],
  ["3", "14:00", 235, 6, 11, 7, 4],
  ["4", "14:20", 230, 6, 10, 7, 7],
  ["5", "14:40", 230, 6, 11, 14, 7], // 2 Oct 2026 audit: was 11 — the head accelerating into the spruce
  ["6", "15:00", 225, 7, 13, 30, 8], // the crown run (FBP C-2 at ISI 15–20: 22–31 m/min); was 20. The CA achieves 38 m/min (accepted: the spots merge with the head)
  ["7", "15:20", 220, 6, 11, 8, 9], // envelope 8 → 9 (2 Oct 2026): the crown-run spots now carry the head on past the brook
  // Review fixes (ah), 9 Oct 2026 (wind vs fire): the meter and the fire's spread disagreed by 45–110° at 15:40, 16:00,
  // 17:00, 17:20 and 18:00. Steps 8–9: under SSW 200 the long north-west flank, not the blocked head, did the spreading,
  // and a flank pushed obliquely moves out along its normal (NW), not along the wind; the backing now comes at 15:40
  // (SSE 165, SE 140 at 16:00), so the flank that runs NW does so with the wind. The rates fall 8 → 4 and 7 → 4 so the
  // wider front burns about the same area (125.1 ha at 16:20, was 126.6). Steps 12–16: below.
  ["8", "15:40", 165, 6, 10, 4, 6], // (ah): was 200 / 8
  ["9", "16:00", 140, 5, 9, 4, 1.5], // (ah): was 160 / 7
  // Thermal inertia (researcher, 8 Oct 2026; retuned to keep SPEC/26 §3's 14/14 the same day, option B): the fuel heated
  // through the afternoon keeps the fire spreading a little through the lull and its end. Step 10 stays a lull (2 m/min
  // actual, ~3.5 achieved; was 1.5), and the decay carries into 16:40 (3; was 1). Step 12 stays at 4: at 5 the front
  // reaches the Honkaharju forest road a step early and crosses it at 18.40–19.00 with no stop first (the road's stop
  // and the 19.00–19.20 crossing are V13–V14's designed sequence). The researcher's larger values at steps 7–9
  // (18/12/9), 10 (6.5), 12 (5) and 19–20 (10.5/9) broke the views V5, V7 and V13 and cut off the north-flank crew.
  ["10", "16:20", 130, 3, 5, 2, 1], // the lull: light, backing wind (was 4/7); envelope 2 → 1 (projection audit P1-c); thermal inertia 1.5 → 2
  ["11", "16:40", 180, 3, 5, 3, 1], // cooling gradually (was 1)
  // (ah) steps 12–16: the front passes at about 17 and the wind veers from S straight to WNW (was SW 240 at 17:00, which
  // blew the flare-up back into the black, and W 270 at 17:20): the rekindle by the origin then runs east-south-east
  // along the old south flank and south-east with the north-westerly, as the meter says. (Revision (al): this comment said
  // "the slope up to the Honkaharju esker pulls the front south". The ground falls gently south from the origin to the forest
  // road, ~93 → 87 m; Honkaharju is a low sand rise, and the esker is Kuivakangas, north-east of the origin. It is the
  // north-westerly, not the slope, that drives the front south.) With these winds it reached the forest road a step early; the rates at 14–16 fall
  // (8/6/9 → 6/4/7) so the road still stops it at 18.40–19.00 and the head still crosses at 19.00–19.20 (V13–V14).
  ["12", "17:00", 285, 3, 6, 4, 1], // a fresh flare-up in a 3 m/s evening wind (was 6); (ah): was 240
  ["13", "17:20", 285, 5, 8, 7, 9], // evening surface fire in 5 m/s (was 9; the afternoon fire did 6–7 in the same wind); (ah): was 270
  // Revision (aj), 9 Oct 2026: the rekindle now grows out of the old edge (step 12 below), which brought the front to the
  // Honkaharju forest road a step early (stop 18:20–18:40, crossing 18:40–19:00). Step 14 falls 6 → 4 (the evening surface
  // fire in 5 m/s; the same 4 as 18:00) so the road stops it at 18:40–19:00 again; step 17 rises 11 → 12 in the wind event
  // (9 m/s, gusts 14) so the head crosses in the gusts at 19:00–19:20 as designed, and the machine's 5 → 4 there (it keeps
  // the evening rate through the event: V12's quantitative breach). Checked: 14 / 14 view flags.
  ["14", "17:40", 290, 5, 10, 4, 6], // (was 11); (ah): was 280 / 8; (aj): 6 → 4
  ["15", "18:00", 300, 6, 11, 4, 6], // 2 Oct 2026: was 1 (deep peat); the depth breach is in burn depth, not spread; (ah): was 290 / 6
  ["16", "18:20", 310, 6, 10, 7, 7], // 3 Oct 2026 (researcher): 7 → 9, the evening front runs harder as the wind rises toward the 18:40 event; the machine stays at 7 (V12 is Q); (ah): 9 → 7
  ["17", "18:40", 315, 9, 14, 12, 4], // (aj): 11 → 12, envelope 5 → 4
  ["18", "19:00", 315, 7, 12, 11, 11], // 3 Oct 2026 (researcher): 9 → 11 behind the wind event; envelope with it (V13 holds)
  ["19", "19:20", 325, 6, 11, 10, 3], // (ah): was 320 (the front veering on; the fire then runs south-east as the meter says); envelope 4 → 3 (2 Oct 2026): V14's quantitative margin was 3–5 cells and went to 0 when the step-18 spot moved onto unburned ground; (aj): 9 → 10, the head still runs after the crossing (the south-east front closes on R2 ~565 m at 19:40, ~430 m at 20:00)
  ["20", "19:40", 325, 5, 9, 7, 4], // (ah): was 320; envelope 7 → 4 so V14 se_front_r2's projection keeps its own band (see freeze-bank-b.ts)
];

const PROLOGUE_FLAGS: readonly Flag[] = ["holds", "holds", "breach_quantitative", "holds", "breach_quantitative"];

/**
 * SPEC/18 §7's per-step flags, steps 1–20 (the old SPEC/03 §4.2 cycle sequence). Since SPEC/26
 * the scored flags belong to views (`CANONICAL_FLAG_SEQUENCE`, `app/scenario/views.ts`); these stay
 * as the CA's step-level authoring check, which the forcing was tuned against (SPEC/24 §11–§12).
 */
export const STEP_FLAGS: readonly Flag[] = [
  "holds", "holds", "breach_quantitative", "holds", "breach_quantitative", "breach_categorical", "holds",
  "breach_quantitative", "breach_categorical", "holds", // 1-10
  "holds", "breach_categorical", "holds", "breach_quantitative", "breach_categorical", "holds",
  "breach_quantitative", "holds", "breach_quantitative", "holds", // 11-20
];

const EVENTS: Readonly<Record<string, CycleForcing["events"]>> = {
  // Spots that the authored flag calls quantitative land close enough ahead of the head to merge
  // with it within the cycle (SPEC/24 §8 decision 2); a spot that stays detached reads categorical.
  W3: [{ kind: "ignite", anchor: "head", bearingDeg: 30, distanceM: 70, radiusM: 15, note: "spot fire 30 m across R1" }],
  W4: [{ kind: "extinguish", anchor: "ignition", bearingDeg: 20, distanceM: 440, radiusM: 60, note: "VPK knocks the R1 spot down" }],
  // SPEC/33 stage 7 (20 Oct 2026, the rebuilt map): 100 m ahead, radius 25 (was 140 m, radius 20). On the new ground the 140 m spot
  // grew into the spruce patches on the esker's flank and the live head measured 13.3 m/min, over the flame table's crown limit
  // (12 m/min) at 14:00, an hour before the authored crown run; at 100 m it measures 10.8 m/min (10.6 on the old map, same flame band).
  "3": [{ kind: "ignite", anchor: "head", bearingDeg: 40, distanceM: 100, radiusM: 25, note: "second ignition on RIDGE, 100 m ahead (ember or lightning)" }],
  // SPEC/24 §12: the gusting head (10 m/s) jumps R1 north of the head where the machine's mean wind
  // (6 m/s) cannot; EK14, working that stretch of R1, wets the north verge and holds it. Cycle 4
  // stays "holds" because a crew acted, and the radio says so.
  // SPEC/33 stage 7: 63°, 880 m (was 57°): on the rebuilt map R1 runs ~20–70 m further north east of the head (its new line), so the
  // wetted verge moves east with it; the fire's south-east flank is then ~590 m from the R1/R2 junction at 15:00 (V2 junction_hour,
  // contract 450–650 m; 671 m with the old disk).
  "4": [{ kind: "remove_fuel", anchor: "ignition", bearingDeg: 63, distanceM: 880, radiusM: 90, note: "EK14 wets the north verge of R1 and holds the slop-over", radioFrom: "EK14", radioFi: "Palo yritti ylittää tien R1 kärjen kohdalla puuskissa. Kastelimme tien pohjoisreunan, ylitys pysäytetty. Linja pitää." }],
  "6": [
    // §7's 200–400 m crown-run spotting (2 Oct 2026 audit: 300 and 400 m, was 200 and 250, which the run overran inside the step).
    { kind: "ignite", anchor: "head", bearingDeg: 38, distanceM: 300, radiusM: 20, note: "crown-run spotting 200–400 m ahead" },
    { kind: "ignite", anchor: "head", bearingDeg: 55, distanceM: 400, radiusM: 20, note: "crown-run spotting 200–400 m ahead" },
  ],
  // The spots the crown run threw ahead show on the 15:20 map (PP1, PP2) in the pine past the brook, so the run does not simply stop at Koivuoja.
  "7": [
    // SPEC/33 stage 7: PP1 35°, 200 m (was 40°, 250 m): on the rebuilt map Koivuoja bends south-east past the head, and the 250 m spot
    // fell beyond the Koivuoja forest road; at 200 m it lands just over the brook, as the 15:40 radio says (embers over Koivuoja).
    { kind: "ignite", timing: "before_report", anchor: "head", bearingDeg: 35, distanceM: 200, radiusM: 20, note: "crown-run spot fire past the brook (PP1)" },
    { kind: "ignite", timing: "before_report", anchor: "head", bearingDeg: 52, distanceM: 330, radiusM: 20, note: "crown-run spot fire past the brook (PP2)" },
  ],
  // Review fixes (ah), 9 Oct 2026: with the backing now at 15:40 the head no longer runs north-east over Koivuoja into the
  // crown-run spot fires on its own, which then stayed an 8 ha fire of their own past the brook all evening (on every map from
  // 16:20, the "detached front" the rekindle arc reserves for the rekindles). Embers and the flank fire carry the head across
  // the brook into them in this step, as the 15:40 radio says ("Kipinät lensivät Koivuojan yli … palo pääsi yli").
  "8": [
    { kind: "ignite", anchor: "ignition", bearingDeg: 44.4, distanceM: 2466, radiusM: 65, note: "the head crosses Koivuoja into the crown-run spot fires" },
    // SPEC/33 stage 7: on the rebuilt map the farther crown-run spot (PP2) lies east of the Koivuoja forest road; the old 42.7°/2840 m
    // disk lit the road's west side and left PP2 a separate 3 ha fire all evening. At 42.4°/2789 m, radius 60, the flank fire
    // crosses the forest road into it within the step (the radio's creep over the road at 15:40–16:00).
    { kind: "ignite", anchor: "ignition", bearingDeg: 42.4, distanceM: 2789, radiusM: 60, note: "and joins the furthest of them across the forest road" },
  ],
  // SPEC/18 §7 cycle 10 (revised 2 Oct 2026: no shower): the wind eases and backs, the north-flank
  // head runs back over its own burnt ground, and crews report L2 in hand and L1 nearly (L1 secured at 16:40); L4 (origin and rear)
  // goes to mop-up. Everything except L3 Etelä (the origin's south side, bearings ~130–260) is secured.
  // Staged (2 Oct 2026 audit): the head (L2) at step 10; the north flank, still running NW in the backing wind, at step 11.
  // Fix pass 7 (9 Oct 2026, researcher's open item "L2 and L4 secured in one step"): the rear (L4, the origin's west and north-west
  // side) is no longer secured with the head at step 10 but at step 11, with the north flank it adjoins (one arc, 260°–20°, worked by
  // the north-flank crews: EK14, KY21, VPK and EK15 from 16:40), so the head and the rear are secured in different steps. Tried and
  // rejected: L4 at step 9 (the CA then reaches the Honkaharju road a step early and crosses it with no stop, breaking V13–V14's
  // designed sequence) and at step 12 (no crew near the rear at 17:00, and V10's area key 2.6 ha from a band edge). With step 11: 14 / 14 view flags, the
  // road's stop at 18.40–19.00 and the crossing at 19.00–19.20 unchanged, V10–V14's report-keyed keys unchanged or within their bands.
  "10": [{ kind: "control_sector", fromBearingDeg: 20, toBearingDeg: 130, note: "L2 (the head) in hand as the wind eases and backs" }],
  "11": [
    { kind: "control_sector", fromBearingDeg: 330, toBearingDeg: 20, note: "L1 (the north flank) in hand in the light wind" },
    { kind: "control_sector", fromBearingDeg: 260, toBearingDeg: 330, note: "L4 (origin and rear) in hand" },
  ],
  // The rekindle (researcher decision 2 Oct 2026, Kalajoki-type): at the origin, where it all started.
  // Fire smouldering in stumps, slash and deep humus crept past the mapped south edge of the clear-cut;
  // as the front passes and the wind veers from south to west-north-west (17:00; (ah), was "south-west, west by 17:20")
  // it flares up SE of the ignition point, on L3 with no crew there, and runs east-south-east along the old south
  // flank, then SE with the north-westerly. Revision (aj), 9 Oct 2026 (researcher: a rekindle starts FROM the old fire):
  // the ignition disk overlaps the burned edge on the 135° ray (centre 30 m past the edge, radius 40 m: the unburned
  // half of the disk, ~6 cells, catches, the first row of them 8-adjacent to the old edge), so there is no unburned gap
  // in the grid; the new fire is still drawn as its own front from 17:20 (`new-fire.ts`, step 13 `reportedDetached`),
  // sharing the old edge. Its centre is ~65 m from the ignition point (was 80 m past the edge, ~120 m out, with a
  // two-cell gap on every map from 17:20 to 20:00). The first unburned ring outside the old edge is the held line
  // (L2's, secured at 16:20, reaching one cell into L3): the rekindle surfaces through it (`model.ts` ignite).
  // SPEC/33 stage 7 (20 Oct 2026, the rebuilt map): 130°, 35 m past the edge, radius 45 (was 135°, 30 m, 40). The Honkaharju forest
  // road now runs ~330 m south of the origin; from the old disk the front reached it at 18:20–18:40 and crossed it in the 18:40 gusts,
  // a step early, with no stop first. From this disk (still on L3's edge, 130°) the front is ~110 m from the road at 18:00, the road
  // stops it at 18:40–19:00 over ~600 m and the head crosses it in the gusts at 19:00–19:20, as V12–V14 are designed (sweep of
  // bearings 130–160°, 5–45 m past the edge, radius 25–45 m, seed 20080101: this was the one disk that gave that sequence).
  "12": [{ kind: "ignite", anchor: "edge", bearingDeg: 130, distanceM: 35, radiusM: 45, rekindle: true, note: "the omission: smouldering at the origin's south edge flares up as the wind turns" }],
  // 2 Oct 2026 audit P5: was 1350 m @30°, which the 15:40–16:00 widening had already burned (a no-op); now ~180 m
  // north of EK14's crew on the L1B edge (217, 986), ~160 m outside the fire's north edge, on unburned ground.
  // 3 Oct 2026 review: 12° put it on EK15's crew-to-truck line; 8° keeps it ~90 m west of that line.
  // Review fixes (ah), 9 Oct 2026 (F4): a spot fire 160 m NORTH of the north edge in a north-westerly lay upwind, where no
  // ember can land. The contradiction is now a holdover on the old north edge: fire that crept through roots and humus
  // past the edge east of EK14's stretch flares up in the 18:40 wind event (an uudelleensyttymä, labelled US like the
  // origin's rekindles). SPOT sees new smoke and flame on the north edge; EK14's own line holds. Both reports stay true.
  // Revision (aj), 9 Oct 2026: a holdover is the old edge itself flaring up, so its cells are 8-adjacent to the burned north
  // edge (the 19°/1225 m disk lay 150 m north of it, in unburned ground). At 27°, 1155 m from the ignition point, radius
  // 25 m: two cells on the unburned side of the edge at (500–550, 1025–1050), ~140 m east of KY23's crew, ~290 m east-
  // north-east of EK14's, ≥ 100 m off every crew-to-vehicle line (KY23 radios it at 19:21 as the reconciling lateral
  // item of SPEC/18 §7.1). The edge there faces north; by bearing it lies in L2's wedge (20–100°). In the north-westerly
  // it backs and creeps along the edge, never runs at the crews. The "edge" anchor is not used: the 27° ray runs on into
  // the fire's north-east bulge, so its outermost burned cell is not this edge.
  // SPEC/33 stage 7 (20 Oct 2026, the rebuilt map): 26.3°, 1170 m (was 27°, 1155 m). On the new ground the north edge there lies
  // ~15 m further out, and the old disk caught a single cell; this one lights two cells of the held line on the north-facing edge.
  "18": [{ kind: "ignite", timing: "before_report", anchor: "ignition", bearingDeg: 26.3, distanceM: 1170, radiusM: 25, rekindle: true, note: "the contradiction: a holdover on the old north edge flares up east of EK14's line (SPOT reports it)" }],
  // The second rekindle (phase-B rebuild round 2, researcher decision 5 Oct 2026; SPEC/27 §7.4 candidate
  // (ii)): a late misfit view for the directive. Stumps and slash smouldering past the origin's old west
  // edge flare up in the evening north-westerly, in sector L4, where no crew works. Anchored to the burned
  // edge (review 6 Oct 2026, D4; was 200 m @275°, 138 m from any burned cell). Revision (aj), 9 Oct 2026: the disk
  // overlaps the old west edge (centre 15 m past the footprint's edge on the 275° ray, radius 30 m), so its cells touch
  // the old fire; its centre is ~115 m west of the ignition point (FEATURES.ORIGIN_W, where DR2 orbits; was 80 m past
  // the edge, two cells of unburned ground between). Before the 19:20 report, so it is on V14's map and inside the
  // machine's envelope (V14 stays quantitative; checked 14/14), and V13 (step 18) is untouched. The CA grows it from
  // ~0.25 ha at 19:20 south along the old edge; the map draws it as its own front at 19:20 and 19:40 (`new-fire.ts`), in
  // L4 and L1 at both (at 25 m out it reached bearing 216°, into L3, by 19:40: the view's sound sectors are L1 and L4).
  "19": [{ kind: "ignite", timing: "before_report", anchor: "edge", bearingDeg: 275, distanceM: 15, radiusM: 30, rekindle: true, note: "the second rekindle: the origin's old west edge flares up, sector L4, no crew there" }],
};

/**
 * The machine keeps working from the prevailing south-westerly when the wind backs (SPEC/18 §7
 * cycle 9: the north flank becomes a head on ground unobserved since cycle 8).
 */
const MACHINE_WIND: Readonly<Record<string, number>> = { "8": 230, "9": 230 }; // (ah): "8" added, the machine misses the whole backing (V6 = steps 8+9)

/**
 * SPEC/18 §7: cycle 6 is a crown run with spotting (mechanism); cycle 9 is the wind backing onto a
 * flank the machine still treats as a flank (mechanism); cycle 15 is deep burning (depth) in the humus layer and stump roots on the
 * mineral soil north of the Honkaharju road, 20–40 cm (revision (al); was "deep peat": the drained peat of Rahkasuo lies ~170 m
 * south of the road, which the fire crosses only at 19:00–19:20).
 */
const CATEGORICAL_BASIS: Readonly<Record<string, "mechanism" | "depth">> = { "6": "mechanism", "9": "mechanism", "15": "depth" };

export const SCENARIO_18_FORCING: readonly CycleForcing[] = ROWS.map(([id, clock, fromDeg, mean, gust, rosActual, rosEnvelope], index) => {
  const expectedFlag = index < 5 ? PROLOGUE_FLAGS[index]! : STEP_FLAGS[index - 5]!;
  const events = EVENTS[id];
  const machineWind = MACHINE_WIND[id];
  return {
    id,
    clock,
    windFromDeg: fromDeg,
    ...(machineWind !== undefined ? { machineWindFromDeg: machineWind } : {}),
    meanMs: mean,
    gustMs: gust,
    headRosActualMpm: rosActual,
    headRosEnvelopeMpm: rosEnvelope,
    expectedFlag,
    ...(CATEGORICAL_BASIS[id] !== undefined ? { categoricalBasis: CATEGORICAL_BASIS[id]! } : {}),
    ...(events ? { events } : {}),
  };
});
