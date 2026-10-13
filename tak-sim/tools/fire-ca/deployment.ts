/**
 * Where every unit, drone and aircraft is, cycle by cycle — SPEC/18 §8.2's timeline bound to the
 * generated site (SPEC/23 §11) and to the fire the CA actually produced (SPEC/24).
 *
 * A unit's day is a list of MOVES (SPEC/18 revision (l)). Between moves it HOLDS: it keeps its own
 * stretch of fire edge, the burned cell nearest its last position, `STANDOFF_M` outside it, so it
 * drifts outward only as the fire grows past it. A move is the only way to change stretch, and
 * every move has a reason (arrive, reassign, withdraw, water, rest, evacuation…) that goes on the
 * radio log in the cycle the unit shows up in its new place. `site-export.ts` refuses to build if
 * a unit jumps further than `MAX_HOLD_STEP_M` between cycles without one.
 *
 * Everything here is in site metres: x east, y north of IGN.
 */

import type { AirKind, UnitTask } from "../../app/scenario/types.js";
import { ROADS } from "../topo-map/roads.js";
import { hm, stepStartS } from "./traffic-text.js";

export interface P { readonly x: number; readonly y: number }

export const polar = (bearingDeg: number, distanceM: number): P => {
  const t = (bearingDeg * Math.PI) / 180;
  return { x: Math.sin(t) * distanceM, y: Math.cos(t) * distanceM };
};

/** Named features, from tools/topo-map (terrain-base.ts, terrain.ts, roads.ts) and SPEC/23 §12. */
export const FEATURES = {
  IGN: { x: 0, y: 0 },
  CP: { x: -1000, y: 400 }, // command point, R1/R3 junction; drone team launches here
  R1_W: { x: -300, y: 400 },
  R1_MID: { x: 900, y: 415 },
  // Review fixes (ah), unit positions: the stretch of R1 inside the burned area (burned out by 14:40), the crews' safety zone in the
  // black during the crown run (15:00–15:20; was the R1/R2 junction and R1 east, ~1 km south-east of the fire in unburned forest).
  R1_BLACK: { x: 210, y: 412 }, // the west end of the burned stretch (250–450 m): the crews step into the black, the vehicles stand at its edge
  // Revision (aj): the middle of that burned stretch, black since ~14:30 — the safety zone EK14 waits in with its terrain vehicle at
  // 15:40–16:20 while the backed wind turns the north-west flank into a head (the road's west end, 80–150 m out, burns at 16:00–16:20).
  R1_BLACK_MID: { x: 350, y: 412 },
  R1_R2: { x: 1500, y: 420 }, // R1/R2 junction
  R2_BOG: { x: 1500, y: -600 }, // R2 along BOG-S's east edge — the water-shuttle route
  R3_BRIDGE_W: { x: 2650, y: 400 }, // R3 west of the 16 t timber bridge "R3:n silta (Kotkanjoki)" (the one name for it, revision (al)), 400 m short of it
  R3_BRIDGE_E: { x: 3150, y: 400 }, // east end of the bridge: where units from the other region are stopped (2 Oct 2026)
  RIDGE: polar(45, 1000), // Kuivakangas esker
  SPR: polar(47, 1750), // Kuusimäki, unthinned spruce
  BIRCH: polar(45, 2300), // birch–aspen strip along Koivuoja
  POND_W1: { x: -1061, y: 1061 }, // Haukilampi, water point W1
  CABINS: { x: -1340, y: 1590 }, // Mökkiranta, SE shore of Karhujärvi (V1)
  BOG_S: polar(168, 1250), // Rahkasuo, drained, 2024 ditch spoil
  VILLAGE: polar(135, 3000), // Lahdenkylä (V2)
  POND_W2: { x: 2250, y: -2250 }, // farm pond at Lahdenkylä, water point W2
  // Revision (al), 10 Oct 2026 (map review panel): water point W3 is on the west bank beside the R3 bridge (Kotkanjoki), ~18 m
  // south of R3 and ~10 m from the water (was (3050, 390), the 16 t bridge deck itself: no tanker fills standing on a load-limited bridge).
  BRIDGE_W3: { x: 3040, y: 372 },
  // Phase-B rebuild round 2 (5 Oct 2026): the defensive lines on the south-east front. Points on the
  // forest road (Honkaharju, tools/topo-map/roads.ts road 48) that runs south of the rekindled front
  // from the origin's south side to R2, and on R2 itself (FIXED_ROADS[5]) — the "lines on roads" the
  // directive names. Crews stand there with their vehicle (`at:` anchors), never on the fire's edge.
  FR_W: { x: 259, y: -382 }, // forest road south of the rekindled front
  FR_MID: { x: 720, y: -490 }, // forest road north of Rahkasuo
  // Revision (al), 10 Oct 2026 (map review panel): 150 m west along the road (was (950, -561), 8 m from the 110 kV line, inside its
  // 36 m corridor); now ~127 m from the line, ~95 m east of FR_MID.
  FR_E: { x: 810, y: -510 }, // forest road ahead of the south-east front
  R2_FR: { x: 1525, y: -842 }, // R2 / forest-road junction
  R2_MID: { x: 1515, y: -1120 }, // R2 between the junction and Lahdenkylä
  R2_S: { x: 1530, y: -1360 }, // R2 towards Lahdenkylä
  // The second rekindle (phase-B rebuild round 2, researcher decision 5 Oct 2026): the origin's old
  // west edge, where the drone sent to it at 19:20 orbits (scenario-18.ts step 19). The CA's ignition
  // centre: 15 m past the burned edge on the 275° ray, overlapping it (revision (aj); was polar(275, 200), then 80 m past the edge).
  ORIGIN_W: { x: -115, y: 10 },
} as const;
export type FeatureId = keyof typeof FEATURES;

/** Sector anchors: the point on each sector's edge a crew works toward (SPEC/18 §5 "Sectors"). */
const SECTOR: Record<string, P> = {
  L1: { x: -300, y: 1150 }, // north flank, R1 to VALLEY-N
  L1B: { x: -500, y: 1600 }, // north flank after the backing wind, toward Karhujärvi ((ah): was (-800, 1350), which after the re-authored winds snapped the crews to the origin's north side, ~450 m from the 17:00 flare-up)
  L3: polar(185, 300), // south of the origin: the old south edge that flares up at step 12 (2 Oct 2026; was BOG-S)
  L3SE: { x: 1600, y: -1500 }, // south-east front toward Lahdenkylä, L-B
  L4: { x: -450, y: -50 }, // origin and rear
  // Review fixes (ah), unit positions (anchor at the heel, then work up both flanks towards the head): the south flank half-way to
  // the head (KY21, 14:40–16:00), the north flank half-way to the head (EK14, 14:40–16:00), and the old fire's east edge, downwind
  // once the wind turns north-west (EK11, 17:00–17:40).
  L2S: polar(60, 900),
  L1N: polar(30, 1000),
  L2E: polar(70, 1700),
  // Revision (aj), 9 Oct 2026 (researcher: no crew at the tip of a head that was crowning twenty minutes earlier): EK12's
  // 15:40 line is the crown-run lobe's SOUTH-EAST flank on the R1 side, the flank upwind in the backed wind (was `head:R`,
  // the tip across Koivuoja beside the spot fires PP2–PP3, reached by a 650 m hose line through the crown-run ground).
  L2SE: { x: 1150, y: 700 },
};

/** Where a move goes, in Finnish, for the radio log ("… siirtyy <place>"). */
export const PLACE_FI: Readonly<Record<string, string>> = {
  "edge:L1": "pohjoisreunalle (lohko L1)",
  "edge:L1B": "pohjoisreunalle Karhujärven suuntaan (lohko L1)",
  "edge:L3": "syttymäkohdan eteläreunalle (lohko L3)",
  "edge:L3SE": "kaakkoisrintamalle Lahdenkylän suuntaan (lohko L3)",
  "edge:L4": "syttymäkohdan taakse (lohko L4)",
  "edge:RIDGE": "Kuivakankaan harjulle",
  "edge:SPR": "Kuusimäen kuusikon reunaan",
  "edge:BIRCH": "Koivuojan koivikkoon",
  "edge:L2SE": "kaakkoissivustalle tien R1 puolelle (lohko L2)",
  "edge:L2S": "eteläsivustalle kärkeä kohti (lohko L2)",
  "edge:L1N": "pohjoissivustalle kärkeä kohti",
  "edge:L2E": "vanhan palon itäreunalle (lohko L2)",
  "at:R1_BLACK": "tielle R1 palaneelle alueelle (turva-alue)",
  "zone:R1_BLACK_MID": "tielle R1 palaneen alueen keskelle (turva-alue)",
  "black:HERE": "autolle palaneen alueen kautta",
  "head:L": "kärjen pohjoissivustalle (lohko L2)",
  "head:R": "kärjen eteläsivustalle (lohko L2)",
  "at:CP": "johtopaikalle",
  "at:R1_W": "tielle R1 syttymän länsipuolelle",
  "at:R1_MID": "tielle R1",
  "at:R1_R2": "R1:n ja R2:n risteykseen",
  "at:R2_BOG": "tielle R2 Rahkasuon itäpuolelle",
  "at:R3_BRIDGE_W": "tielle R3 R3:n sillan (Kotkanjoki) länsipuolelle",
  "at:R3_BRIDGE_E": "R3:n sillan (Kotkanjoki) itäpäähän",
  "at:POND_W1": "Haukilammelle (vesipiste W1)",
  "at:POND_W2": "Lahdenkylän lammelle (vesipiste W2)",
  "at:BRIDGE_W3": "R3:n sillan (Kotkanjoki) länsirannalle, vesipiste W3",
  "at:VILLAGE": "Lahdenkylään",
  "at:FR_W": "metsäautotielle (Honkaharju) uuden palon eteläpuolelle",
  "at:FR_MID": "metsäautotielle (Honkaharju) Rahkasuon pohjoispuolelle",
  "at:FR_E": "metsäautotielle (Honkaharju) kaakkoisrintaman eteen",
  "at:R2_FR": "R2:n ja metsäautotien risteykseen",
  "at:R2_MID": "tielle R2 Rahkasuon kaakkoispuolelle",
  "at:R2_S": "tielle R2 Lahdenkylän suuntaan",
};

export const STANDOFF_M = 40;
/** A crew holding its stretch may drift this far in a cycle as the edge moves; beyond it, it must be a logged move. */
export const MAX_HOLD_STEP_M = 450;

/** `zone:<feature>` (revision (aj)): crew and vehicle exactly at a point inside the burned area, a safety zone — no road clearance applies there. */
export type Anchor = `edge:${string}` | `head:${"L" | "R"}` | `at:${FeatureId}` | "black:HERE" | `zone:${FeatureId}`;
export type MoveReason = "arrive" | "reassign" | "withdraw" | "water" | "return" | "rest" | "evacuation";

export interface Move {
  readonly cycle: number;
  readonly to: Anchor;
  readonly reason: MoveReason;
  /** Why, in Finnish, appended to the radio message ("latvapalo", "vesi loppumassa"). */
  readonly whyFi?: string;
  /** What the crew does there, when not the default for the unit and anchor (`taskFor`). */
  readonly task?: UnitTask;
  /**
   * The radio message in full, when the move is not announced in the standard sentence (fix pass 2, 7 Oct 2026,
   * FF11: the L3 sector leader's move of KY21 and VPK is said as a move in progress on the sector leader's order,
   * for command's information — no self-tasking, and nothing the participant would have to acknowledge).
   */
  readonly text?: { readonly fi: string; readonly en: string };
}

/**
 * Where a unit's vehicle can go (SPEC/18 revision (m)). A fire engine or tanker stays on a road a
 * truck can use (II/III class or metsäautotie) and its crew walks to the fire, laying hose; the
 * forest-fire unit's terrain vehicle drives into the forest; the hose robot has no vehicle.
 */
export type VehicleAccess = "road" | "offroad" | "none";

export interface UnitPlan {
  readonly type: string;
  /** Default "road". */
  readonly access?: VehicleAccess;
  readonly moves: readonly Move[];
  /** Cycles whose reported position is not updated (SPEC/18 §10 F2 AVL drift, F3 radio dead zone). */
  readonly stale?: readonly number[];
  /** Cycles the unit is off the map (not yet arrived is implied by its first move). */
  readonly gone?: readonly number[];
  /**
   * The water shuttle (fix pass 2, 7 Oct 2026, researcher decision): a tanker that carries water from the
   * water points to portable basins at the lines (`traffic-water.ts`). It holds no edge and logs no moves:
   * each step it is drawn where the shuttle has it at the step's start (`site-export.ts`).
   */
  readonly shuttle?: true;
}

const m = (cycle: number, to: Anchor, reason: MoveReason, whyFi?: string, task?: UnitTask): Move => ({ cycle, to, reason, ...(whyFi ? { whyFi } : {}), ...(task ? { task } : {}) });
/** A move with its own radio message (`Move.text`). */
const said = (mv: Move, fi: string, en: string): Move => ({ ...mv, text: { fi, en } });

/** Why a reinforcement waits at the command post on arrival (fix pass 2, FC5): the region holds it for another fire. */
export const HELD_FOR_REGION_FI = "alue pitää varalla toisen palon varalta, käyttöön alueen luvalla";
/** The reinforcements the region holds at the command post on arrival (their offers say so, `traffic-requests.ts`). */
export const HELD_FOR_REGION: ReadonlySet<string> = new Set(["EK16", "KY23"]);

/**
 * SPEC/18 §8.2 as moves. Cycle-1 moves are the situation at handover (no radio message: the
 * participant takes over a fire already being fought).
 */
export const UNIT_PLAN: Readonly<Record<string, UnitPlan>> = {
  EK11: {
    type: "Pelastusyksikkö + säiliö",
    moves: [
      m(1, "head:L", "arrive"),
      m(3, "edge:RIDGE", "reassign", "uusi syttymä harjulla"),
      m(6, "at:R1_BLACK", "withdraw", "latvapalo, turva-alue palaneella alueella"),
      // Revision (aj): the crew takes the brook line with its LCES stated — the spot fires PP1 and PP2 are on the 15:20 map 250–330 m
      // beyond the brook, so the trigger point is a spot behind the line; it fires at 15:29 (PP1) and the crew is out at 15:31.
      // (The spot fires are not named in the move: DR1's three confirmations are the V5 Thinker's recent matches, `test/server/thinker-review-ah.spec.ts`.)
      // Revision (ak): the crew stands at the burned edge on the fire's side of Koivuoja (8 m from the black, the brook ~75 m behind
      // it), knocking the dropped head down before the brook — not "behind the brook" (the far bank, where the map never had it).
      m(7, "edge:BIRCH", "return", "latvapalo laskeutunut koivikkoon; linja palaneen reunasta ojan edessä, perääntymistie palaneen kautta autolle, tähystäjä nimetty"),
      // Review fixes (ah), safety reviewer HIGH: at 15:29 PP1 lands between EK11's crew and its truck and at 15:40 the fire
      // crosses Koivuoja beside it; EK11 radios its pull-back into the burned area at 15:31 and its safety at 15:42 (EXTRA_RADIO).
      // It does not leave the line for the road: V6's SPAM item keys "the fire crossed, the line is broken" against "EK11
      // withdrew to the road" (`demo-probes.ts`).
      // Safety re-check (ah): at 15:40 the crew is at its truck on the forest road (it pulled back through the burned area at 15:31);
      // it takes the line up again at 16:00.
      m(8, "black:HERE", "withdraw", "pistepalo PP1 linjan takana, miehet autolla turvassa", "withdrawn"),
      m(9, "edge:BIRCH", "return", "palo ohitti, linja uudelleen palaneen reunasta"),
      m(11, "at:CP", "rest", "miehistön lepo ja huolto, vapautuksen suunnittelu"),
      // Review fixes (ah): back to the old fire's east edge, which the north-westerly now blows onto unburned forest (was the dead NE tip).
      m(12, "edge:L2E", "return", "luoteistuuli kääntää itäreunan alatuuleen, jälkisammutus", "mop_up"),
      // Phase-B rebuild round 2 (5 Oct 2026): no crew goes to the rekindled front before V11 (was step 13,
      // "painopiste siirtyy etelään", which stated the participant's main effort); from step 14, with the
      // directive in force, the south-east front's crews hold lines on roads (SPEC/27 §7.3 c, e).
      m(14, "at:R2_FR", "reassign", "linja tielle R2 uuden palon itäpuolelle", "road_line"),
      // Fix pass 3 (7 Oct 2026, N1/N2): no drive to W2 at 18.20 — EK13 brings its basin via W2 and R2 — and no gap at the
      // 19.20 shift change: the next shift takes over the vehicle on the line (EXTRA_RADIO, `RELIEVED_AT`).
    ],
  },
  VPK: {
    type: "VPK, säiliöauto",
    moves: [
      m(1, "edge:L3", "arrive"),
      m(4, "edge:L4", "reassign", "jälkisammutus syttymäkohdassa", "mop_up"),
      // Fix pass 3 (N1): VPK is itself a tanker, and the shuttle is busy on the south edge's other line (KY21's).
      m(5, "at:POND_W1", "water", "vesi oli loppumassa; säiliöauto ajoi itse, EK13 oli kiinni KY21:n linjalla"),
      m(6, "edge:L4", "return", undefined, "mop_up"),
      // SPEC/26 §5: on the origin's south edge before the lull, so it is there to object when moved off it.
      m(9, "edge:L3", "reassign", "syttymäkohdan eteläreunan jälkisammutus"),
      said(m(10, "edge:L1B", "reassign", "KY21:n käskystä, lohko 3 hallinnassa"), // against its recorded objection
        "VPK: lohkonjohtaja KY21:n käskystä siirrymme nyt pohjoisreunalle (L1), lohko 3 hallinnassa. Tiedoksi johdolle.",
        "VPK: on the order of KY21, the sector leader, we are moving to the north edge (L1) now, sector 3 under control. For command's information."),
      m(14, "at:FR_MID", "return", "linja metsäautotielle uuden palon eteläpuolelle", "road_line"),
      // Rescue Act §36 (researcher decision 6 Oct 2026, D1): the incident commander decides the evacuation, the police carry it out.
      m(17, "at:VILLAGE", "evacuation", "johdon evakuointipäätös, poliisi toteuttaa"),
      // Fix pass 3 (decision): VPK's question about the two households that stay is answered (the police go on alone,
      // EXTRA_RADIO) and VPK returns to the line on R2; its next shift came out with the vehicle.
      m(19, "at:R2_S", "return", "poliisi jatkaa kahden talon kanssa yksin, VPK palaa linjalle; vuoro vaihdettu", "road_line"),
    ],
    stale: [10], // as KY21: still on the south edge on the 16:20 map, where it objects from
  },
  EK12: {
    type: "Pelastusyksikkö",
    moves: [
      m(1, "head:R", "arrive"),
      // Revision (ak), 10 Oct 2026: both commander reviewers (HIGH) would have EK12 on the lobe's south-east flank ~250 m behind the
      // head here, not at the head as it accelerates into the spruce. Tried (an `edge:L2SF` anchor at (850, 650): the crew at (888, 657),
      // 225 m from the head, hose 300 m) and backed out: the step-5 records it changes re-seed every later draw, and at V5 the frozen
      // Thinker retrieval then loses DR1's PP2 confirmation to the planted F7 grid record on a tie (`test/server/thinker-review-ah.spec.ts`
      // C2) — a property of the instrument, not of the position. Open item for the researcher (`18` ak.4); the 14:45 trigger is
      // indicator-based meanwhile.
      m(5, "edge:SPR", "reassign", "kärki kuusikon reunalla"),
      m(6, "at:R1_BLACK", "withdraw", "läheltä piti -tilanne latvapalossa; vahvuus tarkistettu, kaikki tallessa, ei loukkaantuneita"),
      // Revision (aj): back on the crown-run lobe's south-east flank from R1, the flank upwind in the backed (SSE) wind — not at the
      // tip across Koivuoja beside the spot fires with a 650 m hose line through the crown-run ground (was `head:R`).
      m(8, "edge:L2SE", "return", "latvapalon jälkeen sivustahyökkäys palaneen reunasta, kärjen eteen ei mennä"),
      // Fix pass 3 (N1): the shuttle is busy at KY21's line at 16.20, so EK12 drives to W3 itself (in the lull, as a unit).
      m(10, "at:BRIDGE_W3", "water", "säiliö oli tyhjä; EK13 oli kiinni KY21:n linjalla"),
      // Revision (ak) (reviewer, MEDIUM): L2 was secured at 16:20, so the return is said as what it is — mop-up on a stretch in hand.
      m(11, "head:R", "return", "kärki hallinnassa, jälkisammutus", "mop_up"),
      // Revision (ak) (both reviewers, MEDIUM): its own stretch of R2 south of the junction, between EK11 at the junction and OUT2
      // towards Lahdenkylä (was `at:R2_FR`, 70 m from EK11 on one point for two hours).
      m(15, "at:R2_MID", "reassign", "linja tielle R2 risteyksen eteläpuolelle, kaakkoisrintaman eteen", "road_line"),
    ],
    stale: [7],
  },
  EK14: {
    type: "Maastopaloyksikkö",
    access: "offroad",
    moves: [
      m(1, "at:R1_W", "arrive", undefined, "transit"), // SPEC/18 §8.2: arriving L1
      m(2, "edge:L1", "arrive"),
      // Revision (aj), 9 Oct 2026 (LCES, SOU 2019:7): the wind backs to SSE at 15:40 (forecast at 15:03) and the long north-west
      // flank becomes the head, pushed at EK14's line at 4 m/min. The crew does not work up that flank towards the head (was
      // `edge:L1N`, where the fire burned to within 25 m of it in 15:40–16:00 and again in 16:00–16:20); it pulls back to its
      // terrain vehicle on road R1 at the edge of the burned area and waits there, lookout posted, until the turned edge has
      // passed its old line. Still in the radio dead zone at 16:00 (F3, `stale`): the 16:00 map shows it where it was at 15:40.
      m(8, "zone:R1_BLACK_MID", "withdraw", "tuuli kääntyy kaakkoon ja pohjoissivusta jää alatuuleen; miehet maastoautolle tielle R1 palaneelle alueelle (turva-alue), tähystäjä seuraa reunaa", "withdrawn"),
      m(10, "edge:L1B", "reassign", "pohjoisreuna kääntyi Karhujärveä kohti"),
    ],
    stale: [9],
  },
  // SPEC/26 §5 (D5): the L3 sector leader moves KY21 and VPK to the north flank at step 10; both
  // come back south at step 14 (phase-B rebuild round 2, was 13), to a line on the forest road south of
  // the rekindled front, and leave it before the front reaches the road (step 17).
  KY21: {
    type: "Pelastusyksikkö + maastopalokontti",
    moves: [
      m(3, "edge:L3", "arrive"),
      // Review fixes (ah): from the heel up the south flank towards the head while VPK mops up the origin, back at 16:00 when the wind turns.
      m(5, "edge:L2S", "reassign", "eteläsivustaa kärkeä kohti, syttymäkohta VPK:n jälkisammutukseen"),
      m(9, "edge:L3", "return", "tuuli kääntyy, syttymäkohdan eteläreuna takaisin hoitoon"),
      // KY21's leader is the L3 sector leader (SPEC/26 D5): he moves his own two crews under the pre-agreed release rule
      // (fix pass 3, FF11: "on the sector leader's order" from the sector leader himself read as self-referential).
      // Review of revision (ae), S1: in English the cottages are "the Lakeside Cottages", as everywhere else ("the Bear Lake cabins" read as a
      // second place); the Finnish "Karhujärven mökit" stays, a description of the same cottages beside the map's Mökkiranta.
      said(m(10, "edge:L1B", "reassign", "Karhujärven mökit uhattuna, lohko 3 hallinnassa"),
        "KY21, lohkon L3 johtaja: lohko 3 on hallinnassa, joten siirrän sovitun vapautussäännön mukaan KY21:n ja VPK:n nyt pohjoisreunalle (L1), Karhujärven mökit uhattuna. Siirto käynnissä, tiedoksi johdolle.",
        "KY21, sector L3 leader: sector 3 is in hand, so under the agreed release rule I am moving KY21 and VPK to the north edge (L1) now, the Lakeside Cottages threatened. The move is under way; for command's information."),
      m(14, "at:FR_W", "return", "linja metsäautotielle uuden palon eteläpuolelle", "road_line"),
      // Revision (ak), 10 Oct 2026 (commander review): the road line is held while the road holds. The front meets the road at
      // 18:40–19:00 a hundred metres east of KY21's engine and the road stops it (the stop KY21 itself reports at 19:0x); in the
      // gusts sparks cross the road and the crew's trigger point fires: it withdraws at 19:00 to R2, and the fire crosses the
      // road at 19:00–19:20 fifty metres from its old spot with nobody near. Before: KY21 withdrew at 18:40 with the edge 28 m
      // off, on a trigger point ("150 m from the road") it had already passed when it said it. (Holding to 19:20 was tried and
      // rejected: the map's traced outline then has the crew inside the fire at 19:00 and the crossing burns through its spot.)
      m(18, "at:R2_BOG", "withdraw", "kipinät ylittävät tien puuskissa emmekä saa niitä kiinni, linja siirtyy tielle R2", "road_line"),
    ],
    stale: [10], // the 16:20 map still shows it on the south edge (AVL lag): the radio has it there until its move at 16:22
  },
  // Revision (aj): EK15 states its LCES in the move (the stretch ran at 16:00–16:20 and it takes it from the downwind side in the lull).
  EK15: { type: "Pelastusyksikkö (vahvennus)", moves: [m(10, "at:CP", "arrive"), m(11, "edge:L1B", "reassign", "palokatko pohjoisreunalle Karhujärven suuntaan; perääntymistie palaneelle alueelle, tähystäjä nimetty", "firebreak")] },
  // Held at the CP through step 13 (SPEC/26 §5: no crew on L3 when the old edge flares up; round 2: nor
  // in V10), by the region (fix pass 2, FC5: an in-world reason for the idle hour); at 14 to a line on the
  // forest road ahead of the front. It holds the road while the road stops the fire (18.40–19.00, which it
  // reports at 19.01) and withdraws once the head has crossed (19.00–19.20). FF3, 7 Oct 2026: it withdrew at
  // 19.01 "as the fire crosses", two minutes before reporting that the road had stopped the fire.
  EK16: { type: "Pelastusyksikkö (vahvennus)", moves: [
    m(11, "at:CP", "arrive", HELD_FOR_REGION_FI),
    m(14, "at:FR_E", "reassign", "linja metsäautotielle kaakkoisrintaman eteen", "road_line"),
    m(19, "at:R2_MID", "withdraw", "palo ylitti metsäautotien, linja siirtyy tielle R2", "road_line"),
  ] },
  KY23: { type: "Pelastusyksikkö (vahvennus)", moves: [m(11, "at:CP", "arrive", HELD_FOR_REGION_FI), m(12, "edge:L1B", "reassign", "palokatko pohjoisreunalle Karhujärven suuntaan", "firebreak")] },
  // Round 2 (5 Oct 2026): the other region's crews take the R2 line towards Lahdenkylä (were on the front's edge).
  // The 20 km detour along the main road takes the whole of step 17 (review 6 Oct 2026, D3: they were still at
  // the bridge at 18:37 and on R2 at 18:40): off the map in step 17, on R2 from step 18. UGV1 rides on OUT1's
  // trailer (it has no vehicle of its own).
  OUT1: { type: "Pelastusyksikkö (toinen alue)", moves: [m(16, "at:R3_BRIDGE_E", "arrive", "raskas säiliö ei pääse sillan yli", "blocked"), m(18, "at:R2_S", "reassign", "kiertotietä maantien kautta, linja tielle R2", "road_line")], gone: [17] },
  OUT2: { type: "Pelastusyksikkö (toinen alue)", moves: [m(16, "at:R3_BRIDGE_E", "arrive", "raskas säiliö ei pääse sillan yli", "blocked"), m(18, "at:R2_S", "reassign", "kiertotietä maantien kautta, sadetinlinja Lahdenkylän suojaksi", "road_line")], gone: [17] },
  // The water shuttle (fix pass 2, 7 Oct 2026, researcher decision): on scene from the handover, carrying water from
  // W1/W3 (W2 on the south-east front) to portable basins at the lines, so engines refill there instead of driving away.
  EK13: { type: "Säiliöauto (vedensiirto)", shuttle: true, moves: [m(1, "at:POND_W1", "arrive", undefined, "refill")] },
  UGV1: { type: "Letkunvetorobotti", access: "none", moves: [m(16, "at:R3_BRIDGE_E", "arrive", "OUT1:n perävaunussa", "blocked"), m(18, "at:R2_S", "reassign", "OUT1:n perävaunussa kiertotietä, letkulinja tien R2 varteen", "hose_laying")], gone: [17], stale: [19, 20] },
};

/** Status traffic that is not a move: a unit that stops being able to move or report (SPEC/18 §8.2). */
export const EXTRA_RADIO: readonly { readonly cycle: number; readonly from: string; readonly text: string; readonly textEn: string; readonly atOffsetS?: number; /** Recorded, not pushed (revision (aj)). */ readonly recorded?: true }[] = [
  // Round 2 (5 Oct 2026): with the crews on road lines, no crew stands on the front's edge to radio the head's
  // rate in V12 (EK11 did until the rebuild). EK16, on the forest road ahead of the front, sees it come: the CA's
  // head runs 11 m/min in step 17 (achieved 10.6; DR2 measures 10.6 at 19.05), in 9 m/s, gusts 14, from the
  // north-west; the road stops it in 18:40–19:00 and it crosses in 19:00–19:20 (since the rekindles were anchored to
  // the burned edge, 6 Oct 2026; was 18:40–19:00).
  // Revision (ak) (both reviewers, HIGH): the road crew ahead of the head states its trigger point and a safety zone that is not downwind —
  // the R2 junction clearing 600 m east along the road; the head crosses the road 600 m WEST of EK16 at 19:00–19:20 (crossings.ts), so the
  // [revision (al): EK16 moved 150 m west off the 110 kV corridor (FR_E); the head now crosses ~450 m west of FR_E (~520 m from EK16's
  // crew), still west, so the escape route east is never cut; the landing is ~720 m east along the road and drawn on the map (a
  // 60 × 40 m log landing in the junction's south-east corner, tiles only); measured in SPEC/18 al.3]
  // route east is never cut, and the edge is ~170 m off at 19:20 when EK16 withdraws (the trigger). Flames stay 1–2 m: DR2's 19:05
  // thermal says the same and the two are a cited non-contradictory pair (`demo-probes.ts`).
  { cycle: 17, from: "EK16", text: "Kärki lähestyy metsäautotietä luoteesta, etenee kaakkoon arviolta 10 m/min, liekit 1–2 m. Pidämme tien. Laukaisupiste: kun kärki on noin 200 m tiestä tai ensimmäinen pistepalo syttyy tien eteläpuolelle, siirrymme R2:lle. Perääntymistie tietä pitkin itään R2:n risteyksen puutavaran varastoalueelle (turva-alue), autot käännettyinä, tähystäjä nimetty.",
    textEn: "The head is approaching the forest road from the north-west, spreading south-east at roughly 10 m/min, flames 1–2 m. We are holding the road. Trigger point: when the head is about 200 m from the road or the first spot fire starts south of the road, we move to R2. Escape route east along the road to the log landing at the R2 junction (safety zone), vehicles turned round, lookout posted." },
  // D3 (6 Oct 2026): the detour is said as the convoy leaves the bridge; the move at step 18 says where it arrived.
  { cycle: 17, from: "OUT1", text: "OUT1 ja OUT2 lähtevät kiertotielle maantien kautta, noin 20 km. UGV1 kulkee OUT1:n perävaunussa. Perillä tiellä R2 noin klo 19.05.",
    textEn: "OUT1 and OUT2 are leaving by the detour along the main road, about 20 km. UGV1 rides on OUT1's trailer. On road R2 at about 19.05." },
  // Fix pass 3 (decisions, 7 Oct 2026): the 19.20 shift change keeps the vehicles on the line, and the police answer VPK's
  // question about the two households that stay (VPK's request, step 18, `traffic-requests.ts`).
  { cycle: 19, from: "EK11", text: "Vuoronvaihto klo 19.20: seuraava vuoro otti EK11:n auton ja linjan tiellä R2, ei katkosta. Edellinen vuoro huoltoon johtopaikalle.",
    textEn: "Shift change at 19.20: the next shift took over EK11's vehicle and the line on road R2, no gap. The outgoing shift goes to the command post for rest." },
  // At the end of step 18 (19.19), after VPK's question and before VPK's return at 19.21 that cites it (fix pass 4).
  { cycle: 18, atOffsetS: 1170, from: "POLIISI", text: "Poliisi Lahdenkylästä: kaksi taloa kieltäytyy lähtemästä, jatkamme suostuttelua yksin. VPK voi palata linjalle.",
    textEn: "Police at Lahdenkylä: two households refuse to leave, we carry on persuading them on our own. VPK can return to the line." },
  // Fix pass 5 (8 Oct 2026): units held by the region are released by the region before they move (the moves go out from 90 s into the step).
  { cycle: 12, atOffsetS: 30, from: "HÄTÄKESKUS", text: "Alue vapauttaa KY23:n käyttöönne, KY23 on nyt johdon käytettävissä.",
    textEn: "The region releases KY23 to you; KY23 can now be tasked by command." },
  // Review fixes (ah), 9 Oct 2026 (safety reviewer): a crew within 20 m of the burning zone, overrun or cut off from its vehicle
  // says how it stays safe (escape route, pull-back, headcount); `tools/validate/crew-safety.ts` requires these lines.
  { cycle: 2, atOffsetS: 400, from: "EK11", text: "EK11: hyökkäämme kärjen vasenta laitaa suoraan letkulla, liekit matalat. Perääntymistie palaneelle alueelle, tähystäjä nimetty.",
    textEn: "EK11: we are attacking the head's left side directly with a hose, low flames. Escape route into the burned area, lookout posted." },
  // Revision (aj), 9 Oct 2026 (LCES at every exposure, `tools/validate/crew-safety.ts` `downwind`): the handover's direct attack
  // on both sides of the head, said once for both crews; the trigger point before the crown run (14:4x); KY21's trigger point on
  // the forest road at 18:2x. Recorded, not pushed (T2: in Haku and Thinker), so the views' pushed budget is unchanged. EK15's
  // firebreak line (16:4x) carries its escape route in its move message, EK16's road line (18:4x) in its report above.
  { cycle: 1, atOffsetS: 240, from: "EK11", recorded: true, text: "EK11: kärjen molemmat laidat suorassa sammutuksessa, EK11 vasen ja EK12 oikea laita, liekit alle metrin. Perääntymistie palaneelle alueelle, tähystäjät nimetty.",
    textEn: "EK11: both sides of the head under direct attack, EK11 the left and EK12 the right, flames under a metre. Escape route into the burned area, lookouts posted." },
  // Revision (ak), 10 Oct 2026 (commander review): a trigger point is an indicator that comes BEFORE the danger, not the danger
  // itself — torching single trees and flames over two metres precede a crown run; "if the fire crowns" would have the crews
  // 90 m from a head that is already running at 30 m/min (the near miss EK12 then reports is the run outpacing even this trigger).
  { cycle: 5, atOffsetS: 300, from: "EK11", recorded: true, text: "EK11: kärki kiihtyy kuusikkoon ja liekit nousevat. Laukaisupiste sovittu: kun yksittäiset puut alkavat soihduta tai liekit ylittävät kaksi metriä, EK11 ja EK12 irtautuvat kärjen laidoilta palaneelle alueelle ja tielle R1 odottamatta latvapaloa. Tähystäjät nimetty.",
    textEn: "EK11: the head is accelerating into the spruce and the flames are rising. Trigger point agreed: when single trees start torching or the flames go over two metres, EK11 and EK12 break off from the head's flanks into the burned area and to road R1, without waiting for the fire to crown. Lookouts posted." },
  // Revision (ak): the road is the line — the trigger to leave it is fire taking hold on the far side, not a distance the edge
  // had already passed when the line was said (it stood 116 m off at 18:20). KY21 holds through the stop (18:40–19:00) under
  // this line's LCES (the T2 tier is at its band's top, so the 18:4x step carries no line of its own; its generated report says
  // the sprinklers are on) and withdraws at 19:00 when the trigger fires (its move message).
  { cycle: 16, atOffsetS: 400, from: "KY21", recorded: true, text: "KY21: rintama lähestyy metsäautotietä, reuna noin 100 m tiestä. Sadettimet päälle kun reuna on tiellä. Laukaisupiste: jos kipinät sytyttävät tien eteläpuolen emmekä saa niitä heti kiinni, siirrymme tielle R2. Autot käännettyinä, perääntymistie tietä pitkin itään R2:lle, tähystäjä nimetty.",
    textEn: "KY21: the front is approaching the forest road, the edge about 100 m from the road. Sprinklers on when the edge reaches the road. Trigger point: if sparks light the south side of the road and we cannot catch them at once, we move to road R2. Vehicles turned round, escape route east along the road to R2, lookout posted." },
  // Revision (ak) (reviewer, HIGH): the esker ignition is 140 m ahead of the head; EK11 says it attacks it from the north flank, never
  // from between the head and the spot, with its escape into the black (the 14:0x line explains steps 3–4 in `crew-safety.ts`).
  // Worded without "pistepalo"/"syttymä": a lexical match on those took a V5 retrieval slot from DR1's PP2 confirmation
  // (`test/server/thinker-review-ah.spec.ts` C2) and moved the V7 objection's documented ranks.
  { cycle: 3, atOffsetS: 300, from: "EK11", recorded: true, text: "EK11: uusi palo harjulla noin 150 m kärjen edessä. Hyökkäämme siihen pohjoissivustalta, emme mene kärjen ja uuden palon väliin. Perääntymistie palaneelle alueelle, tähystäjä nimetty.",
    textEn: "EK11: a new fire on the esker about 150 m ahead of the head. We attack it from the north flank, we do not go between the head and the new fire. Escape route into the burned area, lookout posted." },
  { cycle: 5, atOffsetS: 400, from: "EK14", text: "EK14: työskentelemme pohjoisreunalla aivan reunassa moottoriruiskulla. Perääntymistie palaneelle alueelle, maastoauto takanamme, tähystäjä nimetty.",
    textEn: "EK14: we are working right at the north edge with the portable pump. Escape route into the burned area, the terrain vehicle behind us, lookout posted." },
  { cycle: 7, atOffsetS: 650, from: "EK11", text: "EK11: pistepalo PP1 takanamme, autolle menevän reitin vieressä. Vedämme miehet pois linjalta palaneen alueen kautta autolle. Vahvuus tarkistettu, kaikki tallessa.",
    textEn: "EK11: spot fire PP1 is behind us, beside the way to our truck. We are pulling the crew off the line through the burned area to the truck. Headcount done, all accounted for." },
  { cycle: 8, atOffsetS: 150, from: "EK11", text: "EK11: palo ylitti ojan vierestämme. Miehet siirtyivät palaneelle alueelle turvaan, perääntymistie palaneen kautta autolle. Vahvuus tarkistettu, kaikki tallessa.",
    textEn: "EK11: the fire crossed the brook beside us. The crew moved into the burned area to safety, escape route through the burned area to the truck. Headcount done, all accounted for." },
  { cycle: 19, atOffsetS: 60, from: "KY23", text: "KY23: savua ja pientä liekkiä noin 120 m pohjoiseen, autolle menevän reitin itäpuolella. Perääntymistie autolle länsikautta, kaikki tallessa.",
    textEn: "KY23: smoke and a small flame about 120 m to the north, east of the way to our truck. Escape route to the truck round the west side, all accounted for." },
  // Revision (aj): the crew pulled back to its vehicle at 15:40, before the turned flank reached its old line (not out ahead of it after 16:00).
  { cycle: 10, atOffsetS: 30, from: "EK14", text: "EK14: yhteys palasi. Odotimme maastoautolla tiellä R1 palaneella alueella, kunnes kääntynyt reuna oli ohittanut entisen linjamme klo 16 jälkeen. Siirrymme nyt palaneen kautta uudelle linjalle Karhujärven puolelle. Kaikki tallessa, maastoauto mukana.",
    textEn: "EK14: back in radio contact. We waited at the terrain vehicle on road R1 in the burned area until the turned edge had passed our old line after 16.00. We are moving through the burned area to the new line on the Karhujärvi side now. All accounted for, the terrain vehicle with us." },
  { cycle: 14, atOffsetS: 30, from: "HÄTÄKESKUS", text: "Alue vapauttaa EK16:n käyttöönne, EK16 on nyt johdon käytettävissä.",
    textEn: "The region releases EK16 to you; EK16 can now be tasked by command." },
  { cycle: 19, from: "OUT1", text: "UGV1 juuttui pehmeään maahan tien R2 ojanvarressa, letkunveto pysähtyi. Yritämme vetää sen irti.",
    textEn: "UGV1 got stuck in soft ground in the ditch beside road R2, hose laying has stopped. We are trying to pull it free." },
];

/**
 * A crew's own report of its stretch at one step, in place of the generated estimate (`crewSees` and the road-line tail; the
 * draws are still made, so nothing else in the step moves). `{near}` is the generated distance to the nearest fire, rounded to 50 m.
 *
 * Fix pass 7 (9 Oct 2026, researcher's open item "KY21 undercuts its own V14 road_crossed premise"): on R2 north of the forest-road
 * junction, KY21's pushed V14 report read "no edge of our own, the fire 400 m west" — the stretch of the fire north of the Honkaharju
 * road, which reads as the road still holding — with no word of the head that crossed that road at 19.00–19.20 (EK16, pushed) and
 * now runs south-east past KY21's south-west. It now says both, so it agrees with the crossing and the `road_crossed` key ("the road
 * no longer stops the head"), and its 400 m is no longer a distance to the south-east front (V14 `se_front_r2`).
 */
export const LINE_REPORTS: Readonly<Record<string, { readonly fi: string; readonly en: string }>> = {
  "KY21@20": {
    fi: "kärki ylitti metsäautotien ja on nyt lounaassamme, menee kaakkoon kohti tietä R2 risteyksen eteläpuolella. Omalla pätkällämme ei reunaa; metsäautotien pohjoispuolella palo noin {near} m länteen",
    en: "the head crossed the forest road and is now to our south-west, running south-east towards road R2 south of the junction. No edge on our own stretch; north of the forest road the fire is about {near} m to the west",
  },
};

/**
 * The practice view (SPEC/26 D3, VP = step W2, 12:00; researcher decision 1 Oct 2026): SPEC/18
 * §8.2's W2 row — EK11 on scene by R1 (the head's north flank, which is at R1 then), VPK on L4,
 * DR1 just launched over the head; EK12 still en route. Only the W2 map uses it: the handover moves
 * of step 1 place every unit afresh, so steps 1–20 do not depend on it.
 */
export const PRACTICE_UNITS: Readonly<Record<string, Anchor>> = { EK11: "head:L", VPK: "edge:L4" };
export const PRACTICE_AIR: Readonly<Record<string, Flight>> = { DR1: "orbit:head" };

/** Units arriving at the same anchor in the same cycle are spread along the edge by nudging their target. */
export const UNIT_NUDGE: Readonly<Record<string, P>> = {
  EK11: { x: 0, y: 0 }, EK13: { x: 0, y: 0 }, VPK: { x: -150, y: 0 }, EK12: { x: 150, y: -120 }, EK14: { x: -120, y: 150 }, KY21: { x: 180, y: -60 },
  EK15: { x: -250, y: 120 }, EK16: { x: 220, y: 160 }, KY23: { x: -220, y: -120 }, OUT1: { x: 250, y: -150 }, OUT2: { x: -150, y: 250 }, UGV1: { x: 60, y: 60 },
};

/**
 * The task a move sets, unless the move names one. On a fire edge: water through a hose line
 * (site-export.ts turns it into peat work wherever the crew stands on bog); the forest-fire unit
 * pumps from natural water; the robot lays hose. At a point: what the reason says.
 */
export function taskFor(unit: string, mv: Move): UnitTask {
  if (mv.task) return mv.task;
  if (mv.to.startsWith("at:")) {
    switch (mv.reason) {
      case "water": return "refill";
      case "rest": return "rest";
      case "withdraw": return "withdrawn";
      case "evacuation": return "evacuation";
      case "arrive": return "staging";
      case "reassign":
      case "return": return "transit";
    }
  }
  if ((UNIT_PLAN[unit]?.access ?? "road") === "none") return "hose_laying";
  if (UNIT_PLAN[unit]?.access === "offroad") return "pump_attack";
  return "hose_attack";
}

/** Tasks that draw water from the unit's own vehicle through a hose line. */
export const HOSE_TASKS: ReadonlySet<UnitTask> = new Set(["hose_attack", "peat_soak", "mop_up"]);
/** Points along every road of the given classes (all if null), 10 m apart: where a vehicle can stop. */
export function roadPoints(classes: ReadonlySet<string> | null): P[] {
  const pts: P[] = [];
  for (const r of ROADS) {
    if (classes && !classes.has(r.cls)) continue;
    for (let i = 1; i < r.line.length; i++) {
      const a = r.line[i - 1]!, b = r.line[i]!;
      const k = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10));
      for (let j = 0; j < k; j++) pts.push({ x: a.x + ((b.x - a.x) * j) / k, y: a.y + ((b.y - a.y) * j) / k });
    }
  }
  return pts;
}

/** Road classes (tools/topo-map/roads.ts) a fire engine or tanker can drive: II/III class and metsäautotie. */
export const TRUCK_ROADS: ReadonlySet<string> = new Set(["main", "gravel", "forest"]);
/** A parked vehicle keeps this far from the reported fire. */
export const VEHICLE_FIRE_CLEARANCE_M = 60;
/** A terrain vehicle drives in to about this far behind its crew. */
export const OFFROAD_BEHIND_M = 80;
/** Hose follows the ground, not a ruler: laid length ≈ straight distance × this, in 20 m lengths. */
export const HOSE_SLACK = 1.15;
/** Longest hose line an engine's crew can lay and supply (SPEC/18 revision (m)); longer is a build error. */
export const MAX_HOSE_M = 800;
/** How far a hose-laying crew stands from a usable road, on foot round the fire (placement.ts): the longest line, less slack and a length. */
export const HOSE_REACH_M = Math.floor(MAX_HOSE_M / HOSE_SLACK) - 20;

/** Where a move goes, in English (session language "en"; DRAFT translation). */
const PLACE_EN: Readonly<Record<string, string>> = {
  "edge:L1": "to the north flank (sector L1)",
  "edge:L1B": "to the north flank towards Karhujärvi (sector L1)",
  "edge:L3": "to the south edge by the point of origin (sector L3)",
  "edge:L3SE": "to the south-east front towards Lahdenkylä (sector L3)",
  "edge:L4": "behind the point of origin (sector L4)",
  "edge:RIDGE": "to the Kuivakangas esker",
  "edge:SPR": "to the edge of the Kuusimäki spruce stand",
  "edge:BIRCH": "to the Koivuoja birch stand",
  "edge:L2SE": "to the south-east flank on the R1 side (sector L2)",
  "edge:L2S": "to the south flank, towards the head (sector L2)",
  "edge:L1N": "to the north flank, towards the head",
  "edge:L2E": "to the old fire's east edge (sector L2)",
  "at:R1_BLACK": "to road R1 in the burned area (safety zone)",
  "zone:R1_BLACK_MID": "to road R1 in the middle of the burned area (safety zone)",
  "black:HERE": "to its truck through the burned area",
  "head:L": "to the north flank of the head (sector L2)",
  "head:R": "to the south flank of the head (sector L2)",
  "at:CP": "to the command post",
  "at:R1_W": "to road R1 west of the origin",
  "at:R1_MID": "to road R1",
  "at:R1_R2": "to the R1/R2 junction",
  "at:R2_BOG": "to road R2 east of Rahkasuo",
  "at:R3_BRIDGE_W": "to road R3 west of the R3 bridge (Kotkanjoki)",
  "at:R3_BRIDGE_E": "to the east end of the R3 bridge (Kotkanjoki)",
  "at:POND_W1": "to Haukilampi (water point W1)",
  "at:POND_W2": "to Lahdenkylä pond (water point W2)",
  "at:BRIDGE_W3": "to the west bank at the R3 bridge (Kotkanjoki), water point W3",
  "at:VILLAGE": "to Lahdenkylä",
  "at:FR_W": "to the forest road (Honkaharju) south of the new fire",
  "at:FR_MID": "to the forest road (Honkaharju) north of Rahkasuo",
  "at:FR_E": "to the forest road (Honkaharju) ahead of the south-east front",
  "at:R2_FR": "to the junction of R2 and the forest road",
  "at:R2_MID": "to road R2 south-east of Rahkasuo",
  "at:R2_S": "to road R2 towards Lahdenkylä",
};
/** Why a unit moves, in English. */
const WHY_EN: Readonly<Record<string, string>> = {
  "uusi syttymä harjulla": "new ignition on the esker",
  "latvapalo, turvaetäisyys": "crown fire, safe distance",
  "latvapalo, turva-alue palaneella alueella": "crown fire, safety zone in the burned area",
  "pistepalo PP1 linjan takana, miehet autolla turvassa": "spot fire PP1 behind the line, the crew safe at the truck",
  "latvapalo laskeutunut koivikkoon; linja palaneen reunasta ojan edessä, perääntymistie palaneen kautta autolle, tähystäjä nimetty": "the crown fire has dropped into the birch stand; the line from the burned edge in front of the brook, escape route through the burned area to the truck, lookout posted",
  "latvapalon jälkeen sivustahyökkäys palaneen reunasta, kärjen eteen ei mennä": "after the crown run a flank attack from the burned edge, nobody goes ahead of the head",
  "tuuli kääntyy kaakkoon ja pohjoissivusta jää alatuuleen; miehet maastoautolle tielle R1 palaneelle alueelle (turva-alue), tähystäjä seuraa reunaa": "the wind is backing to south-east and the north flank is now downwind; crew to the terrain vehicle on road R1 in the burned area (safety zone), a lookout watches the edge",
  "palo ohitti, linja uudelleen palaneen reunasta": "the fire has passed, the line taken up again from the burned edge",
  "luoteistuuli kääntää itäreunan alatuuleen, jälkisammutus": "the north-westerly puts the east edge downwind, mop-up",
  "pohjoissivustaa kärkeä kohti, kannoilla vain jälkisammutusta": "up the north flank towards the head, only mop-up left at the heel",
  "eteläsivustaa kärkeä kohti, syttymäkohta VPK:n jälkisammutukseen": "up the south flank towards the head, the origin left to VOL1's mop-up",
  "tuuli kääntyy, syttymäkohdan eteläreuna takaisin hoitoon": "the wind is turning, back to the south edge by the origin",
  "latvapalo laskeutunut koivikkoon": "the crown fire has dropped into the birch stand",
  "miehistön lepo ja huolto, vapautuksen suunnittelu": "crew rest and maintenance, planning the release",
  "säiliö tyhjä": "tank empty",
  "miehistö ollut kentällä 7,5 tuntia, vaihto": "crew 7.5 hours in the field, change of shift",
  "jälkisammutus syttymäkohdassa": "mop-up at the point of origin",
  "vesi riittää enää hetken": "water will last only a little longer",
  "syttymäkohdan eteläreunan jälkisammutus": "mop-up on the south edge by the point of origin",
  "KY21:n käskystä, lohko 3 hallinnassa": "on KY21's order, sector 3 under control",
  "avotulta syttymäkohdan eteläpuolella": "open fire south of the point of origin",
  "johdon evakuointipäätös, poliisi toteuttaa": "the incident commander's evacuation decision, carried out by the police",
  "vuoronvaihto": "change of shift",
  "poliisi jatkaa kahden talon kanssa yksin, VPK palaa linjalle; vuoro vaihdettu": "the police carry on with the two households alone, VPK returns to the line; the shift has changed",
  "vesi oli loppumassa; säiliöauto ajoi itse, EK13 oli kiinni KY21:n linjalla": "the water was running out; the tanker drove itself, EK13 was busy at KY21's line",
  "säiliö oli tyhjä; EK13 oli kiinni KY21:n linjalla": "the tank was empty; EK13 was busy at KY21's line",
  "kärki kuusikon reunalla": "the head is at the spruce edge",
  "kärki hallinnassa, jälkisammutus": "the head is in hand, mop-up",
  "läheltä piti -tilanne latvapalossa; vahvuus tarkistettu, kaikki tallessa, ei loukkaantuneita": "near miss in the crown fire; headcount checked, everyone accounted for, no injuries",
  "pohjoisreuna kääntyi Karhujärveä kohti": "the north flank turned towards Karhujärvi",
  "kaakkoisrintama vahvistetaan": "the south-east front is reinforced",
  "Karhujärven mökit uhattuna, lohko 3 hallinnassa": "the Lakeside Cottages are threatened, sector 3 under control",
  "palokatko pohjoisreunalle Karhujärven suuntaan": "a firebreak on the north flank towards Karhujärvi",
  "palokatko pohjoisreunalle Karhujärven suuntaan; perääntymistie palaneelle alueelle, tähystäjä nimetty": "a firebreak on the north flank towards Karhujärvi; escape route into the burned area, lookout posted",
  "syttymäkohdan eteläpuolelle": "to the area south of the point of origin",
  "kaakkoisrintama laajenee": "the south-east front is widening",
  "raskas säiliö ei pääse sillan yli": "the heavy tanker cannot cross the bridge",
  "kiertotietä maantien kautta": "by the detour along the main road",
  "kiertotietä maantien kautta, sadetinlinja Lahdenkylän suojaksi": "by the detour along the main road, a sprinkler line to protect Lahdenkylä",
  "letkulinja kaakkoisrintamalle": "a hose line to the south-east front",
  "vesi loppumassa": "water running out",
  "linja tielle R2 uuden palon itäpuolelle": "a line on road R2 east of the new fire",
  "linja tiellä R2": "the line on road R2",
  "linja metsäautotielle uuden palon eteläpuolelle": "a line on the forest road south of the new fire",
  "linja tielle R2 kaakkoisrintaman eteen": "a line on road R2 ahead of the south-east front",
  "linja tielle R2 risteyksen eteläpuolelle, kaakkoisrintaman eteen": "a line on road R2 south of the junction, ahead of the south-east front",
  "palo lähestyy metsäautotietä, linja siirtyy tielle R2": "the fire is nearing the forest road, the line moves to road R2",
  "kipinät ylittävät tien puuskissa emmekä saa niitä kiinni, linja siirtyy tielle R2": "sparks are crossing the road in the gusts and we cannot catch them, the line moves to road R2",
  "linja metsäautotielle kaakkoisrintaman eteen": "a line on the forest road ahead of the south-east front",
  "palo ylitti metsäautotien, linja siirtyy tielle R2": "the fire has crossed the forest road, the line moves to road R2",
  [HELD_FOR_REGION_FI]: "the region is holding us in reserve for another fire, to be tasked with the region's leave",
  "kiertotietä maantien kautta, linja tielle R2": "by the detour along the main road, a line on road R2",
  "letkulinja tien R2 varteen": "a hose line along road R2",
  "OUT1:n perävaunussa": "on OUT1's trailer",
  "OUT1:n perävaunussa kiertotietä, letkulinja tien R2 varteen": "on OUT1's trailer by the detour, a hose line along road R2",
};

/** The radio message for a move, in English (`moveMessageFi`'s sentence, DRAFT translation). */
export function moveMessageEn(unit: string, mv: Move): string {
  const place = PLACE_EN[mv.to] ?? mv.to;
  const why = mv.whyFi ? ` (${WHY_EN[mv.whyFi] ?? mv.whyFi})` : "";
  if (mv.text) return mv.text.en;
  switch (mv.reason) {
    case "arrive": return `${unit} has arrived ${place.replace(/^to /, "at ")}${why}.`;
    case "reassign": return `${unit} is moving ${place}${why}.`;
    case "withdraw": return `${unit} is withdrawing ${place}${why}.`;
    // The map shows the unit at its water point from the step's start, so the message is the present state (fix pass 5, 8 Oct 2026).
    case "water": return `${unit} is refilling water: ${place.replace(/^to /, "")}${why}. Away from the line for about 20 min, back at about ${hm(stepStartS(mv.cycle) + 1290)}.`;
    case "return": return `${unit} is returning to the line, ${place.replace(/^to /, "")}${why}.`;
    case "rest": return `${unit} is moving ${place}${why}.`;
    case "evacuation": return `${unit} is helping the evacuation, ${place.replace(/^to /, "")}${why}.`;
  }
}

/** The radio message for a move, as the unit reports it. */
export function moveMessageFi(unit: string, mv: Move): string {
  const place = PLACE_FI[mv.to] ?? mv.to;
  const why = mv.whyFi ? ` (${mv.whyFi})` : "";
  if (mv.text) return mv.text.fi;
  switch (mv.reason) {
    case "arrive": return `${unit} saapunut ${place}${why}.`;
    case "reassign": return `${unit} siirtyy ${place}${why}.`;
    case "withdraw": return `${unit} vetäytyy ${place}${why}.`;
    case "water": return `${unit} täyttämässä vettä: ${place}${why}. Poissa linjalta noin 20 min, palaa noin ${hm(stepStartS(mv.cycle) + 1290)}.`;
    case "return": return `${unit} palaa linjalle, ${place}${why}.`;
    case "rest": return `${unit} siirtyy ${place}${why}.`;
    case "evacuation": return `${unit} avustaa evakuoinnissa, ${place}${why}.`;
  }
}

/**
 * Aircraft. `orbit:<target>` circles a point (thermal multicopters DR1/DR2, ~35 min per battery);
 * `loop` flies the perimeter at +150 m (VTOL DR3 mapping); `patrol` is the spotting aircraft's
 * wide circuit; `bucket` is the helicopter working the head. Targets: `head`, `edge:<sector>`,
 * `at:<feature>`. A cycle with no entry for a platform means it is on the ground (SPEC/12 §6.5:
 * the footprint disappears, and the coverage gap is visible as an absence).
 */
/** `scoop:<target>`: the water drone shuttles between the water point nearest the target and the target. */
export type Flight = `orbit:${string}` | "loop" | "patrol" | "bucket" | `scoop:${string}`;

export const AIR_PLAN: Readonly<Record<number, Readonly<Record<string, Flight>>>> = {
  1: { DR1: "orbit:head", SPOT: "patrol" },
  2: { DR1: "orbit:head", DR3: "loop" },
  3: { DR1: "orbit:edge:RIDGE", DR3: "loop", SPOT: "patrol" },
  4: { DR1: "orbit:head", DR2: "orbit:edge:L3", DR3: "loop" },
  5: { DR1: "orbit:head", DR2: "orbit:edge:L3", DR3: "orbit:edge:SPR" },
  6: { DR1: "orbit:head", DR2: "orbit:edge:L3", DR3: "orbit:edge:SPR", SPOT: "patrol" },
  7: { DR1: "orbit:head", DR2: "orbit:edge:L3", DR3: "loop" },
  8: { DR2: "orbit:edge:L3", HELI1: "bucket" }, // DR1, DR3 grounded: heli working north of R1
  9: { HELI1: "bucket" }, // DR2 battery swap: nothing observes the north flank
  10: { DR3: "orbit:edge:L1B" }, // relaunch, tasked north: no drone images the origin's south edge before the flare-up (positions audit 2 Oct 2026; was the perimeter loop)
  11: { DR1: "orbit:at:CABINS", DR3: "orbit:edge:L1B", VD1: "scoop:edge:L1B" },
  // Tasked north at steps 10–11; the origin's south edge is watched by no drone until it flares up. SPOT's patrol reports the open fire at 17:01.
  12: { DR1: "orbit:at:CABINS", DR2: "orbit:edge:L1B", DR3: "orbit:edge:L1", SPOT: "patrol", VD1: "scoop:edge:L1B" }, // DR2 on the north flank: no drone on L3 until the flare-up is reported
  // DR2 and VD1 work the rekindled front where it is (the L3 edge south of the origin).
  // Round 2 (5 Oct 2026): VD1 stays on the north flank (was scooping onto the rekindled front): in V10 no
  // crew and no asset works the new front, so a direct attack there is the participant's own reading.
  13: { DR2: "orbit:edge:L3", DR3: "loop", VD1: "scoop:edge:L1B" },
  14: { DR2: "orbit:edge:L3SE", DR3: "loop", VD1: "scoop:edge:L3SE" }, // DR3 release requested; it leaves for the other fire at 17.59
  // Fix pass 2 (7 Oct 2026, FC3): from 18.00 to the handover a thermal drone stays over the south-east front (DR2,
  // which follows the running front; audit item 17: L3 by the origin is cold by now) and DR1 over Lahdenkylä, through
  // the evening wind event and to 20.00 (was: one drone at a time, none at 19.40–20.00). Battery swaps keep them up
  // (`drone-battery.ts`: the generator and the spare packs at the CP from 16.40). SPOT's patrol reports the origin's
  // old west edge flaring up again at step 19 (`demo-story.ts`; DR2 was sent to it, leaving the front uncovered).
  15: { DR1: "orbit:at:VILLAGE", DR2: "orbit:edge:L3SE", VD1: "scoop:edge:L3SE" },
  16: { DR1: "orbit:at:VILLAGE", DR2: "orbit:edge:L3SE", VD1: "scoop:edge:L3SE" },
  17: { DR1: "orbit:at:VILLAGE", DR2: "orbit:edge:L3SE", SPOT: "patrol", VD1: "scoop:edge:L3SE" },
  18: { DR1: "orbit:at:VILLAGE", DR2: "orbit:edge:L3SE", SPOT: "patrol", VD1: "scoop:edge:L1" },
  19: { DR1: "orbit:at:VILLAGE", DR2: "orbit:edge:L3SE", SPOT: "patrol", VD1: "scoop:edge:L3SE" },
  20: { DR1: "orbit:at:VILLAGE", DR2: "orbit:edge:L3SE", SPOT: "patrol" },
};

export const AIR_KIND: Readonly<Record<string, AirKind>> = {
  DR1: "drone", DR2: "drone", DR3: "drone", HELI1: "helicopter", SPOT: "fixed_wing",
  VD1: "water_drone", // SPEC/18 revision (n): arrives with the company-level reinforcements, cycle 11
};

export const ORBIT_RADIUS_M = 120;
/** Ground footprint of a thermal multicopter's camera at working height. */
export const THERMAL_FOOTPRINT_M = 300;
export const LOOP_OFFSET_M = 150;
export const LOOP_FOOTPRINT_M = 300;
export const PATROL_RADIUS_M = 2500;
/** Water points the water drone can scoop from (it takes the one nearest its target). */
export const WATER_POINTS = ["POND_W1", "POND_W2", "BRIDGE_W3"] as const;

export function sectorAnchor(code: string): P {
  const f = (FEATURES as Record<string, P>)[code];
  const s = SECTOR[code];
  if (s) return s;
  if (f) return f;
  throw new Error(`unknown sector or feature "${code}"`);
}
