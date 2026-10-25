/**
 * Build-time export of the incident on the generated site into the bundle the app reads
 * (`app/scenario/site-scenario.json`, typed by `app/scenario/site-scenario.ts`).
 *
 * Joins three things: the CA run (SPEC/24) for fire geometry and flags, the forcing (SPEC/18 §6)
 * for wind, and the deployment plan (`deployment.ts`, SPEC/18 §8.2) for units and aircraft.
 * Every coordinate is converted exactly through ETRS-TM35FIN, the same grid the basemap is
 * georeferenced in (`site-meta.json`), so the fire lines up with the terrain drawn under it.
 * The CA's own frame is a local equirectangular approximation; it is only used to get back to
 * grid metres.
 */

import type { LatLon, Polygon } from "../../app/engine/primitives.js";
import type { SiteScenarioBundle, SiteStep, SiteAircraft, SiteView } from "../../app/scenario/site-scenario.js";
import type { InteractionEvent, UnitTask, UnitWork } from "../../app/scenario/types.js";
import { dilate, FIRE_OUTLINE, latLonToMetres, traceMask, traceMaskWithHoles } from "./geometry.js";
import { headPoint, liveHeadPoint, type CycleForcing, type ScenarioRunResult, type SiteModel } from "./run.js";
import { MAIN_VIEW_COUNT, PRACTICE_STEP } from "../../app/scenario/views.js";
import { toSiteView, type ViewResult } from "./views.js";
import { capPushed, displaceForPointers, holdForSeeking, radioIntoViews, trafficIntoViews, type StepRadio } from "./view-traffic.js";
import { itemRecordIds } from "../review/difficulty-audit.js";
import { tm35ToWgs84, wgs84ToTm35 } from "./tm35.js";
import { sortedKeys } from "../../app/engine/deterministic-object.js";
import { englishNames } from "../../app/i18n/place-names.js";
import {
  AIR_KIND, AIR_PLAN, FEATURES, LOOP_FOOTPRINT_M, LOOP_OFFSET_M, MAX_HOLD_STEP_M, moveMessageEn, moveMessageFi, ORBIT_RADIUS_M, PATROL_RADIUS_M, polar,
  EXTRA_RADIO, PRACTICE_AIR, PRACTICE_UNITS, sectorAnchor, STANDOFF_M, THERMAL_FOOTPRINT_M, UNIT_NUDGE, UNIT_PLAN, type P,
  HOSE_SLACK, HOSE_TASKS, WATER_POINTS, roadPoints, MAX_HOSE_M, HOSE_REACH_M, OFFROAD_BEHIND_M, taskFor, TRUCK_ROADS, VEHICLE_FIRE_CLEARANCE_M,
} from "./deployment.js";
import { crossingMessageEn, crossingMessageFi, detectCrossings, detectStops, stopMessageEn, stopMessageFi } from "./crossings.js";
import { bilingual, englishById, holdEn, radioEnglish, withoutEnglish } from "./traffic-english.js";
import { buildFireDisplay } from "./fire-display.js";
import { cycleTraffic, newTrafficState, reportedExtent, siteTrafficHelpers, toInteractionEvents, type TrafficAircraft, type TrafficCycleInput } from "./traffic.js";
import { distanceTransform, makeFireProbe } from "./traffic-fire.js";
import { practiceTraffic } from "./traffic-practice.js"; import { forecastTraffic } from "./traffic-forecast.js"; import { patrolTraffic } from "./traffic-patrol.js"; import { refillTrip, shuttleJobAt, shuttlePosition, withTankLevels } from "./traffic-water.js"; import { makePlacer } from "./placement.js";
import type { SpotLabels } from "./fire-display.js";
import { hm, isBog, stepStartS } from "./traffic-text.js";
import { ANCHOR_PLACE } from "./traffic-places.js";

/** Forcing index of step n is PROLOGUE + n - 1 (W1–W5 are steps −4…0, forcing indices 0–4). */
const PROLOGUE = 5;
/** Where on its orbit each thermal multicopter starts (degrees added to the step's phase). */
const ORBIT_PHASE_DEG: Readonly<Record<string, number>> = { DR1: 0, DR2: 120, DR3: 240 };
/** The sector polygons' outer radius (m): past the corners of the ±3500 m map. */
const SECTOR_OUTER_M = 5000;
/**
 * The region's other two fires (revision (al), 10 Oct 2026, map review panel): P2's directive speaks of three fires in the
 * region ("Alueella on kolme maastopaloa"), the region takes DR3 "toiselle palolle" at 17.59 and holds EK16 and KY23 for
 * another fire; no record names or places them. Static, for the live map's Area (20 km) level only: more than 8 km from
 * IGN, inside the ±10 km map. No record gives their size or place, so nothing in the corpus changes.
 */
export const REGION_FIRES: readonly { readonly id: string; readonly nameFi: string; readonly nameEn: string; readonly haFi: string; readonly haEn: string; readonly at: P }[] = [
  { id: "RF1", nameFi: "Kuikkalammen palo", nameEn: "Loon Pond fire", haFi: "noin 40 ha", haEn: "about 40 ha", at: { x: -6300, y: 6100 } },
  { id: "RF2", nameFi: "Kaitajärven palo", nameEn: "Narrow Lake fire", haFi: "noin 15 ha", haEn: "about 15 ha", at: { x: 8300, y: -1400 } },
];
const round = (v: number) => Math.round(v * 1e6) / 1e6;
/** No two units nearer each other than this on the map (review fixes (ah), unit positions). */
const MIN_UNIT_GAP_M = 60;
/** Whether an anchor puts a crew on a fire edge (not at a road point or in the black). */
const onEdgeAnchor = (a: string): boolean => a.startsWith("edge:") || a.startsWith("head:");
/** How far a fire-break or mop-up crew walks along its edge from where it took the stretch over (m). */
const WALK_RANGE_M = 220;
/** The way a crew walks along its edge while it holds (fire break, mop-up): fixed per unit, deterministic. */
const walkSign = (id: string): number => ([...id].reduce((s, c) => s + c.charCodeAt(0), 0) % 2 === 0 ? 1 : -1);
/** Tasks that hold a line: a quiet edge near a crew doing one of these is contained on the map (review fixes (ah), F2). */
const HOLDING_TASKS: ReadonlySet<UnitTask> = new Set<UnitTask>(["hose_attack", "pump_attack", "peat_soak", "firebreak", "road_line", "mop_up", "hose_laying"]);
export interface ExportInput {
  readonly site: SiteModel;
  readonly ignitionTm35: { readonly eastM: number; readonly northM: number };
  readonly forcing: readonly CycleForcing[];
  readonly result: ScenarioRunResult;
  /** VP and V1-V14 built from step spans (`views.ts`). */
  readonly views: readonly ViewResult[];
}

export function exportSiteScenario({ site, ignitionTm35, forcing, result, views }: ExportInput): SiteScenarioBundle {
  const frame = site.frame;
  const xll = ignitionTm35.eastM - site.ignitionM.eastM;
  const yll = ignitionTm35.northM - site.ignitionM.northM;

  /** Site metres (x east, y north of IGN) → WGS84 through TM35. */
  const fromSite = (p: P): LatLon => {
    const q = tm35ToWgs84(ignitionTm35.eastM + p.x, ignitionTm35.northM + p.y);
    return { lat: round(q.lat), lon: round(q.lon) };
  };
  const toSite = (gridEast: number, gridNorth: number): P => ({ x: gridEast - site.ignitionM.eastM, y: gridNorth - site.ignitionM.northM });
  const reproject = (poly: Polygon | null): Polygon | null =>
    poly === null ? null : poly.map((ring) => ring.map((q) => {
      const m = latLonToMetres(frame, q);
      const w = tm35ToWgs84(xll + m.eastM, yll + m.northM);
      return { lat: round(w.lat), lon: round(w.lon) };
    }));
  const reprojectAll = (polys: readonly Polygon[]) => polys.map((p) => reproject(p)!);
  const circle = (c: P, radiusM: number, n = 24): Polygon => {
    const ring: LatLon[] = [];
    for (let k = 0; k < n; k++) ring.push(fromSite({ x: c.x + Math.sin((2 * Math.PI * k) / n) * radiusM, y: c.y + Math.cos((2 * Math.PI * k) / n) * radiusM }));
    ring.push(ring[0]!);
    return [ring];
  };

  const steps: SiteStep[] = [];
  const radio: StepRadio[] = [];
  /** Each unit's true position (site metres), whether it works a fire edge, and what the map shows (a stale report keeps the old place). */
  let unitState: Record<string, { pos: P; onEdge: boolean; shown: P; task: UnitTask; shownWork: UnitWork | null; anchor: string; shownAnchor: string }> = {};
  const hoseTooLong: string[] = [];

  const truckRoadPoints = roadPoints(TRUCK_ROADS);
  const { roadNear, placeNear, landCoverAt, sectorOf, settlements } = siteTrafficHelpers();
  const wgsToSite = (q: LatLon): P => { const t = wgs84ToTm35(q); return { x: t.eastM - ignitionTm35.eastM, y: t.northM - ignitionTm35.northM }; };
  const traffic: InteractionEvent[] = [];
  const trafficState = newTrafficState();
  const trafficStateEn = newTrafficState(), english: Record<string, string> = {}; // the English run (`traffic-english.ts`)
  /** Grid metres → WGS84 (the frame the CA masks are in). */
  const gridToWgs = (p: { x: number; y: number }): LatLon => { const w = tm35ToWgs84(xll + p.x, yll + p.y); return { lat: round(w.lat), lon: round(w.lon) }; };
  // The first secured sector (scenario-18.ts control_sector): contained from the report after it on.
  // Every step with a control event (staged since 2 Oct 2026: steps 10 and 11): its arcs, from the next report on.
  const controlStages = forcing.flatMap((fc, i) => ((fc.events ?? []).some((e) => e.kind === "control_sector") && result.cycles[i + 1]
    ? [{ fromForcing: i + 1, arcs: fc.events!.flatMap((e) => (e.kind === "control_sector" ? [{ from: e.fromBearingDeg, to: e.toBearingDeg }] : [])), mask: result.cycles[i + 1]!.masks.reported }]
    : []));
  const cutOffLog: string[] = [];
  /** Where each road unit's vehicle stood last step (site metres); forgotten when the unit moves. */
  const vehicleAt: Record<string, P> = {};
  const unreachableLog: string[] = [];
  /** How far each unit's vehicle moved this step without a unit move (m), for its crew's report. */
  let vehicleMoved: Record<string, number> = {};
  /** How far a road unit's crew without a hose line works from a usable road (m). */
  const WALK_REACH_M = 600;
  /** How far a crew looks for fire before its attack counts as mop-up (m). */
  const COLD_RADIUS_M = 300;
  /** Whether a drone camera covered a grid point, per cycle (index n); filled as the cycles are built. */
  const seenBy: ((p: { x: number; y: number }) => boolean)[] = [];
  const anyRoadPoints = roadPoints(null);
  const positionsByCycle: Record<string, P>[] = [];
  const jumps: string[] = [];
  /** The day's spot-fire labels (persistent from step to step, FF9); the practice view has its own. */
  let spotLabels: SpotLabels = [];
  /** Where crews worked a line in the steps so far (grid metres; F2: a held edge they leave is inactive). */
  const crewHistory: { x: number; y: number }[] = [];
  /** Where each unit took over its current stretch (site metres; a holding crew walks at most WALK_RANGE_M from it). */
  const homeOf: Record<string, P> = {};

  // The practice step (W2, PRACTICE_STEP; SPEC/26 D3 as amended 1 Oct 2026) comes first: units from
  // PRACTICE_UNITS, its own traffic (`traffic-practice.ts`), no radio, and nothing carried into
  // step 1, so steps 1-20 are exactly what they were without it.
  for (const n of [PRACTICE_STEP, ...Array.from({ length: 20 }, (_, i) => i + 1)]) {
    const c = result.cycles[PROLOGUE + n - 1]!;
    const f = forcing[PROLOGUE + n - 1]!;
    const prev = forcing[PROLOGUE + n - 2]!;
    const mask = c.masks.reported;
    const heading = (prev.windFromDeg + 180) % 360;
    const headG = liveHeadPoint(frame, mask, result.cycles[PROLOGUE + n - 2]?.masks.reported ?? null, heading); // the live front's head (2 Oct 2026)
    const head = headG ? toSite(headG.eastM, headG.northM) : FEATURES.IGN;
    // What crews and the map say the head did over the last 20 minutes: the live front's measured advance (2 Oct 2026; was the authored rate).
    const prevMask = result.cycles[PROLOGUE + n - 2]?.masks.reported ?? null;
    const headAdvanceM = (): number => {
      const probe = makeFireProbe(frame, site.ignitionM, mask, prevMask, null, c.masks.separateReported);
      if (!headG || !probe.isSeparate(head)) return probe.advanceM(head, 400);
      // A head on a new separate patch (the rekindle at 17:20) ran from where it was ignited, not from the old fire,
      // whose advance leaves the patch out (review 6 Oct 2026, A8: the 17:20 head read 0 m/min).
      const lit = new Uint8Array(mask.length);
      for (const k of [PROLOGUE + n - 2, PROLOGUE + n - 1]) { const m = result.cycles[k]?.masks.ignited; if (m) for (let i = 0; i < m.length; i++) if (m[i]) lit[i] = 1; }
      const d = distanceTransform(frame, lit)[Math.floor(headG.northM / frame.cellSizeM) * frame.cols + Math.floor(headG.eastM / frame.cellSizeM)]!;
      return Number.isFinite(d) ? d : 0;
    };
    const observedRate = prevMask ? Math.round(headAdvanceM() / 2) / 10 : prev.headRosActualMpm;

    const nearestEdge = (target: P, standoffM: number): P => {
      const tx = target.x + site.ignitionM.eastM;
      const ty = target.y + site.ignitionM.northM;
      let best = Infinity;
      let bx = tx;
      let by = ty;
      for (let i = 0; i < mask.length; i++) {
        if (!mask[i]) continue;
        const col = i % frame.cols;
        const x = (col + 0.5) * frame.cellSizeM;
        const y = ((i - col) / frame.cols + 0.5) * frame.cellSizeM;
        const d = (x - tx) ** 2 + (y - ty) ** 2;
        if (d < best) { best = d; bx = x; by = y; }
      }
      const dist = Math.sqrt(best);
      const step = dist > 0 ? Math.min(standoffM, dist) / dist : 0;
      return toSite(bx + (tx - bx) * step, by + (ty - by) * step);
    };
    const resolveTarget = (code: string, standoffM: number): P => {
      if (code === "head") return head;
      if (code.startsWith("edge:")) return nearestEdge(sectorAnchor(code.slice(5)), standoffM);
      if (code.startsWith("at:")) return sectorAnchor(code.slice(3));
      throw new Error(`unknown target "${code}"`);
    };

    // The reported fire's outlines in site metres, for walking crews apart along an edge.
    const tracedReported = traceMask(frame, mask, 0.75, FIRE_OUTLINE);
    const outlines: P[][] = [tracedReported.main, ...tracedReported.others]
      .filter((poly): poly is Polygon => poly !== null)
      .map((poly) => poly[0]!.map((q) => { const g = latLonToMetres(frame, q); return toSite(g.eastM, g.northM); }));
    /** The edge point `alongM` metres along the outline from the vertex nearest `from`, pushed `standoffM` outward. */
    const alongEdge = (from: P, alongM: number, standoffM: number): P => {
      let ring: P[] = [];
      let at = 0;
      let best = Infinity;
      for (const o of outlines) o.forEach((q, i) => { const d = Math.hypot(q.x - from.x, q.y - from.y); if (d < best) { best = d; ring = o; at = i; } });
      if (ring.length < 3) return from;
      const n = ring.length - 1; // closed ring
      const dir = alongM < 0 ? -1 : 1;
      // On a small fire the stretches shrink with its outline (2 Oct 2026: on the 2 ha rekindle, 300 m went round into the head's cone).
      let perim = 0;
      for (let k = 0; k < n; k++) perim += Math.hypot(ring[k + 1]!.x - ring[k]!.x, ring[k + 1]!.y - ring[k]!.y);
      let left = Math.abs(alongM) * Math.min(1, perim / 1200);
      let i = at;
      let p = ring[i]!;
      while (left > 0) {
        const j = (i + dir + n) % n;
        const q = ring[j]!;
        const seg = Math.hypot(q.x - p.x, q.y - p.y);
        if (seg >= left) { p = { x: p.x + ((q.x - p.x) * left) / seg, y: p.y + ((q.y - p.y) * left) / seg }; break; }
        left -= seg;
        p = q;
        i = j;
      }
      const cx = ring.reduce((s, q) => s + q.x, 0) / ring.length;
      const cy = ring.reduce((s, q) => s + q.y, 0) / ring.length;
      const d = Math.hypot(p.x - cx, p.y - cy) || 1;
      return { x: p.x + ((p.x - cx) / d) * standoffM, y: p.y + ((p.y - cy) / d) * standoffM };
    };

    // Crews and vehicles (`placement.ts`): outer edge with a standoff, never ahead of the head or where the fire gets this step; the truck on the crew's side.
    const placer = makePlacer({ frame, ignitionM: site.ignitionM, reported: mask, truth: c.masks.truthAtEnd, head, headingDeg: (f.windFromDeg + 180) % 360, headRosMpm: f.headRosActualMpm, standoffM: STANDOFF_M, vehicleClearM: VEHICLE_FIRE_CLEARANCE_M, prevReported: prevMask });
    /** Where the vehicle is while its crew works at `crew` on foot, and the crew's path to it; null for the robot. */
    const vehicleFor = (id: string, crew: P): { at: P; pathM: number } | null => {
      const access = UNIT_PLAN[id]!.access ?? "road";
      if (access === "none") return null;
      if (access === "road") {
        const before = vehicleAt[id];
        // Reachability is checked while the crew holds its stretch (A10); after a move the vehicle parks afresh: checking it from
        // its pre-move spot cut EK11's crew at Koivuoja (step 7) off from every road behind the crown run.
        const r = placer.park(crew, truckRoadPoints, before, HOSE_REACH_M);
        if (before) { const d = Math.hypot(r.at.x - before.x, r.at.y - before.y); if (d > 0) vehicleMoved[id] = d; }
        vehicleAt[id] = r.at;
        return r;
      }
      const r = placer.vehicleFor(crew, anyRoadPoints);
      vehicleAt[id] = r; // the road it came in by: where a `black:HERE` pull-back takes the crew (revision (aj), EK14 at 15:40)
      const d = Math.hypot(r.x - crew.x, r.y - crew.y);
      const t = d > 0 ? Math.min(OFFROAD_BEHIND_M, d) / d : 0;
      return { at: { x: crew.x + (r.x - crew.x) * t, y: crew.y + (r.y - crew.y) * t }, pathM: d * t };
    };
    /**
     * A road engine's crew stands where a usable road is in a straight, fire-free line: within hose reach when it lays
     * hose, within a 600 m walk otherwise (3 Oct 2026: OUT2's firebreak crew ended up with the fire between it and every road).
     */
    const reachOf = (id: string, task: UnitTask): number | undefined =>
      (UNIT_PLAN[id]!.access ?? "road") !== "road" ? undefined : HOSE_TASKS.has(task) || task === "hose_attack" ? HOSE_REACH_M : WALK_REACH_M;
    // A cold edge (positions audit item 16): after the lull, no fresh fire on the report and none during the step within 300 m.
    const coldAt = (p: P): boolean => n >= 11 && placer.isCold(p, COLD_RADIUS_M);
    const workOf = (id: string, crew: P, onEdge: boolean, planned: UnitTask): UnitWork => {
      // Fire in peat is soaked and dug, not put out from the surface — judged by the ground the crew reports (`landCoverAt`).
      // An attack on an edge that is no longer burning is mop-up: the crew stays, the task says what it does there.
      const onPeat = isBog(landCoverAt(crew));
      const attack = planned === "hose_attack" || planned === "pump_attack";
      const task: UnitTask = planned === "hose_attack" && onPeat ? "peat_soak" : attack && onEdge && coldAt(crew) ? "mop_up" : planned;
      if (!onEdge) return { task, vehicle: null, hoseM: null };
      const vp = vehicleFor(id, crew);
      if (!vp) return { task, vehicle: null, hoseM: null };
      const v = vp.at, d = vp.pathM;
      const hoseM = HOSE_TASKS.has(task) ? Math.max(20, Math.ceil((d * HOSE_SLACK) / 20) * 20) : null;
      if (hoseM !== null && hoseM > MAX_HOSE_M) hoseTooLong.push(`${id} cycle ${n}: ${hoseM} m of hose (${task})`);
      return { task, vehicle: fromSite(v), hoseM };
    };

    // Units: a move takes a crew to a new stretch (and goes on the radio); otherwise it holds its own.
    vehicleMoved = {};
    const units: Record<string, LatLon> = {};
    const unitWork: Record<string, UnitWork> = {};
    const placedAt: Record<string, number> = {}; // anchor -> units already arriving there this cycle
    // No two crews on one spot (positions audit): a crew within 40 m of one placed earlier walks along the edge.
    const crewSpots: P[] = [];
    // Review fixes (ah), unit positions: no two units within MIN_UNIT_GAP_M of each other — crews on an edge walk along it,
    // units at a road point take the next free road point (they stacked on R2 and at the R2 junction).
    const tooNear = (r: P) => crewSpots.some((o) => Math.hypot(o.x - r.x, o.y - r.y) < MIN_UNIT_GAP_M);
    const spread = (q: P, onEdge: boolean, reachM?: number): P => {
      const roads = reachM === undefined ? undefined : truckRoadPoints;
      let r = onEdge && roads ? placer.hold(q, reachM, roads) : q;
      for (let k = 1; onEdge && k <= 6 && tooNear(r); k++) r = placer.crewAt(alongEdge(q, (k % 2 === 1 ? 1 : -1) * 120 * Math.ceil(k / 2), STANDOFF_M), reachM, roads);
      if (!onEdge && tooNear(r)) {
        const free = truckRoadPoints.filter((pt) => !tooNear(pt) && Math.hypot(pt.x - q.x, pt.y - q.y) <= 400)
          .sort((a, b) => Math.hypot(a.x - q.x, a.y - q.y) - Math.hypot(b.x - q.x, b.y - q.y) || a.x - b.x || a.y - b.y);
        if (free[0]) r = placer.vehicleFor(free[0], truckRoadPoints);
      }
      crewSpots.push(r);
      return r;
    };
    for (const id of sortedKeys(UNIT_PLAN)) {
      const plan = UNIT_PLAN[id]!;
      const practiceAt = n === PRACTICE_STEP ? PRACTICE_UNITS[id] : undefined;
      const mv = n === PRACTICE_STEP ? (practiceAt ? { cycle: n, to: practiceAt, reason: "arrive" as const } : undefined) : plan.moves.find((x) => x.cycle === n);
      const st = unitState[id];
      if (!mv && !st) continue; // not yet on scene
      if (plan.gone?.includes(n)) continue;
      if (plan.shuttle && !mv && st) {
        // The water shuttle is where its run has it at the step's start (`traffic-water.ts`), on the road nearest that.
        let p = placer.vehicleFor(shuttlePosition(trafficState, (n - 1) * 1200), truckRoadPoints);
        // Filling at a water point, or carrying water to a line (fix pass 3, 7 Oct 2026: "veden täydennys" read as filling all the time).
        const job = shuttleJobAt(trafficState, (n - 1) * 1200);
        const filling = job?.kind === "fill";
        if (tooNear(p)) { const free = truckRoadPoints.filter((pt) => !tooNear(pt) && Math.hypot(pt.x - p.x, pt.y - p.y) <= 400).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y) || a.x - b.x || a.y - b.y); if (free[0]) p = placer.vehicleFor(free[0], truckRoadPoints); }
        crewSpots.push(p);
        st.pos = p; st.shown = p; st.anchor = "shuttle"; st.shownAnchor = "shuttle"; st.task = filling ? "refill" : job ? "water_shuttle" : "staging"; st.shownWork = workOf(id, p, false, st.task);
        units[id] = fromSite(p);
        unitWork[id] = st.shownWork;
        continue;
      }
      if (mv) {
        const lastVehicle = vehicleAt[id]; // where its truck stood (the black:HERE move goes there)
        delete vehicleAt[id]; // a unit that moves parks afresh
        const a = mv.to;
        const nudge = UNIT_NUDGE[id] ?? { x: 0, y: 0 };
        let p: P;
        if (a.startsWith("head:")) {
          const o = polar(heading + (a.endsWith("L") ? -90 : 90), 300);
          p = placer.crewAt({ x: head.x + o.x, y: head.y + o.y });
        } else if (a.startsWith("edge:")) {
          const s = sectorAnchor(a.slice(5));
          p = placer.crewAt({ x: s.x + nudge.x, y: s.y + nudge.y });
        } else if (a.startsWith("black:")) {
          // Back to the truck through the burned area (review fixes (ah), safety re-check): crew and vehicle together where the truck stood.
          p = placer.vehicleFor(lastVehicle ?? st?.pos ?? FEATURES.IGN, truckRoadPoints);
        } else if (a.startsWith("zone:")) {
          // A safety zone inside the burned area (revision (aj)): crew and vehicle exactly there; no road clearance from the fire applies.
          p = sectorAnchor(a.slice(5));
        } else {
          // At a point, crew and vehicle are together — on the road nearest the point.
          const s = sectorAnchor(a.slice(3));
          // Review fixes (ah): no nudge into burned ground (the safety zone in the black on R1: a nudged point there had no road out).
          const nudged = { x: s.x + nudge.x * 0.4, y: s.y + nudge.y * 0.4 };
          const nc = Math.floor((nudged.x + site.ignitionM.eastM) / frame.cellSizeM), nr = Math.floor((nudged.y + site.ignitionM.northM) / frame.cellSizeM);
          p = placer.vehicleFor(mask[nr * frame.cols + nc] || (WATER_POINTS as readonly string[]).includes(a.slice(3)) ? s : nudged, truckRoadPoints); // a safe road point no other vehicle took; at a water point no nudge (gate R: EK12 parked across the bridge from W3)
        }
        // Crews arriving at one anchor take their own stretch of it: 150 m apart, alternating sides.
        // Crews already holding this anchor count too (review fixes (ah): units arriving at one anchor in different steps stacked).
        const holding = sortedKeys(unitState).filter((u) => u !== id && unitState[u]!.anchor === a && !UNIT_PLAN[u]!.moves.some((x) => x.cycle === n)).length;
        const k = (placedAt[a] ?? 0) + holding;
        placedAt[a] = (placedAt[a] ?? 0) + 1;
        if (k > 0 && onEdgeAnchor(a) && tooNear(p)) p = placer.crewAt(alongEdge(p, (k % 2 === 1 ? 1 : -1) * 150 * Math.ceil(k / 2), STANDOFF_M));
        p = a.startsWith("black:") || a.startsWith("zone:") ? p : spread(p, onEdgeAnchor(a), reachOf(id, taskFor(id, mv)));
        // A stale report on a move step (AVL drift, dead zone) keeps the old place, vehicle and task on the map (review 6 Oct 2026, A3:
        // VPK and KY21 must still show on the south edge at 16:20, where they object from).
        const keep = plan.stale?.includes(n) && st ? st : null;
        unitState[id] = { pos: p, onEdge: onEdgeAnchor(a), shown: keep ? keep.shown : p, task: taskFor(id, mv), shownWork: keep ? keep.shownWork : null, anchor: a, shownAnchor: keep ? keep.shownAnchor : a };
        homeOf[id] = p;
        if (n > 1) { const trip = mv.reason === "water" ? refillTrip(n, lastVehicle ?? p, p) : undefined; radio.push({ cycle: n, atOffsetS: 0, from: id, kind: "move", text: moveMessageFi(id, mv, trip), textEn: moveMessageEn(id, mv, trip), reason: mv.reason }); } // a water move states its road trip (review R1)
      } else {
        const reach = reachOf(id, st!.task);
        // A fire-break crew cuts on along the edge (60–80 m a step, `18` ab.2) and a mop-up crew works along its stretch, so neither
        // stands on one spot for hours (review fixes (ah)); each walks one way, the way fixed per unit.
        const doing = st!.shownWork?.task ?? st!.task;
        const walk = !st!.onEdge || plan.stale?.includes(n) ? 0 : doing === "firebreak" ? 70 : doing === "mop_up" ? 50 : 0;
        const stepTo = walk > 0 ? alongEdge(st!.pos, walkSign(id) * walk, STANDOFF_M) : st!.pos;
        // ...within WALK_RANGE_M of where it took the stretch over (EK15 walked 900 m down to the origin's west edge, where the 19:20 flare-up must find no crew).
        const home = homeOf[id] ?? st!.pos;
        const from = Math.hypot(stepTo.x - home.x, stepTo.y - home.y) <= WALK_RANGE_M ? stepTo : st!.pos;
        const p = spread(st!.onEdge ? placer.hold(from, reach, reach === undefined ? undefined : truckRoadPoints) : st!.pos, st!.onEdge, reach);
        const d = Math.hypot(p.x - st!.pos.x, p.y - st!.pos.y);
        if (d > MAX_HOLD_STEP_M) jumps.push(`${id} cycle ${n}: ${Math.round(d)} m without a move`);
        st!.pos = p;
        if (!plan.stale?.includes(n)) { st!.shown = p; st!.shownAnchor = st!.anchor; }
      }
      const u = unitState[id]!;
      // A stale report (AVL drift, dead zone) freezes the whole picture of the unit, vehicle and task included.
      if (!plan.stale?.includes(n) || !u.shownWork) u.shownWork = workOf(id, u.pos, u.onEdge, u.task);
      units[id] = fromSite(u.shown);
      unitWork[id] = u.shownWork;
    }
    for (const q of placer.backedOut) console.log(`step ${n}: vehicle at (${Math.round(q.x)}, ${Math.round(q.y)}) backed out along its road ahead of the flank (placement.ts)`);
    for (const q of placer.unreachable) unreachableLog.push(`step ${n}: vehicle at (${Math.round(q.x)}, ${Math.round(q.y)}) has no parking spot reachable by road outside the burning zone`);
    for (const q of placer.cutOff) cutOffLog.push(`step ${n}: crew at (${Math.round(q.x)}, ${Math.round(q.y)}) has no road reachable without crossing the fire`);
    // The water shuttle never reports a crossing or a stop: it holds no line.
    if (n >= 1) positionsByCycle.push(Object.fromEntries(sortedKeys(unitState).filter((id) => !UNIT_PLAN[id]!.gone?.includes(n) && !UNIT_PLAN[id]!.shuttle).map((id) => [id, unitState[id]!.pos])));

    /**
     * Who measured the head's rate (FC9, 7 Oct 2026; the map credited EK11 every time): a thermal drone whose
     * footprint covers the head, else the mapping loop, else the spotter aircraft, else the crew nearest the head.
     */
    const headObserver = (flights: Readonly<Record<string, string>>): string => {
      for (const id of sortedKeys(flights)) {
        const f = flights[id]!;
        if (AIR_KIND[id] === "drone" && f.startsWith("orbit:") && Math.hypot(resolveTarget(f.slice(6), 0).x - head.x, resolveTarget(f.slice(6), 0).y - head.y) <= THERMAL_FOOTPRINT_M) return id;
      }
      const loop = sortedKeys(flights).find((id) => flights[id] === "loop");
      if (loop) return loop;
      // The helicopter bucketing the head sees it (fix pass 3: steps 8–9 credited a crew 700 m off).
      const heli = sortedKeys(flights).find((id) => flights[id] === "bucket");
      if (heli) return heli;
      const crews = sortedKeys(unitState).filter((id) => !UNIT_PLAN[id]!.shuttle && !UNIT_PLAN[id]!.gone?.includes(n) && unitState[id]!.onEdge);
      const crew = crews.reduce<string | null>((a, id) => (!a || Math.hypot(unitState[id]!.pos.x - head.x, unitState[id]!.pos.y - head.y) < Math.hypot(unitState[a]!.pos.x - head.x, unitState[a]!.pos.y - head.y) ? id : a), null);
      // A crew within 450 m of the head can judge its run; else the spotter aircraft, else the nearest crew.
      if (crew && Math.hypot(unitState[crew]!.pos.x - head.x, unitState[crew]!.pos.y - head.y) <= 450) return crew;
      const spot = sortedKeys(flights).find((id) => flights[id] === "patrol");
      return spot ?? crew ?? "EK11";
    };

    // Aircraft and sensor footprints.
    const aircraft: SiteAircraft[] = [];
    const seen: ((g: { x: number; y: number }) => boolean)[] = [];
    const covers: Record<string, (g: { x: number; y: number }) => boolean> = {};
    const flights = n === PRACTICE_STEP ? PRACTICE_AIR : AIR_PLAN[n] ?? {};
    for (const platformId of sortedKeys(flights)) {
      const flight = flights[platformId]!;
      const kind = AIR_KIND[platformId]!;
      if (flight.startsWith("orbit:")) {
        const t = resolveTarget(flight.slice(6), 0);
        const orbit: P[] = [];
        // Each platform its own phase on the circle, so two drones over one target are two markers (review 6 Oct 2026, A5).
        for (let k = 0; k <= 16; k++) { const o = polar((k * 360) / 16 + n * 70 + (ORBIT_PHASE_DEG[platformId] ?? 0), ORBIT_RADIUS_M); orbit.push({ x: t.x + o.x, y: t.y + o.y }); }
        aircraft.push({ platformId, kind, position: fromSite(orbit[0]!), track: [FEATURES.CP, ...orbit].map(fromSite), footprint: circle(t, THERMAL_FOOTPRINT_M) });
        if (kind === "drone") seen.push((covers[platformId] = (g) => Math.hypot(g.x - site.ignitionM.eastM - t.x, g.y - site.ignitionM.northM - t.y) <= THERMAL_FOOTPRINT_M));
      } else if (flight === "loop") {
        const track = traceMask(frame, dilate(frame, mask, LOOP_OFFSET_M), 0.75, FIRE_OUTLINE).main;
        const covered = dilate(frame, mask, LOOP_FOOTPRINT_M);
        const area = traceMask(frame, covered, 0.75, FIRE_OUTLINE).main;
        if (kind === "drone") seen.push((covers[platformId] = (g) => { const c = Math.floor(g.x / frame.cellSizeM), r = Math.floor(g.y / frame.cellSizeM); return c >= 0 && r >= 0 && c < frame.cols && r < frame.rows && covered[r * frame.cols + c] === 1; }));
        const ring = reproject(track)![0]!;
        const lead = headPoint(frame, dilate(frame, mask, LOOP_OFFSET_M), heading);
        aircraft.push({ platformId, kind, position: lead ? fromSite(toSite(lead.eastM, lead.northM)) : ring[0]!, track: ring, footprint: reproject(area) });
      } else if (flight === "patrol") {
        const circuit = circle({ x: head.x / 2, y: head.y / 2 }, PATROL_RADIUS_M, 32)[0]!;
        aircraft.push({ platformId, kind, position: circuit[(n * 5) % 32]!, track: circuit, footprint: null });
      } else if (flight.startsWith("scoop:")) {
        // Water drone: shuttles between the water point nearest its target and the target.
        const t = resolveTarget(flight.slice(6), 0);
        const pond = WATER_POINTS.map((w) => FEATURES[w]).reduce((a, b) => (Math.hypot(b.x - t.x, b.y - t.y) < Math.hypot(a.x - t.x, a.y - t.y) ? b : a));
        aircraft.push({ platformId, kind, position: fromSite(t), track: [pond, t, pond].map(fromSite), footprint: null });
      } else {
        // Helicopter bucket circuit between water point W1 (Haukilampi) and the head.
        aircraft.push({ platformId, kind, position: fromSite(head), track: [FEATURES.POND_W1, head, FEATURES.POND_W1].map(fromSite), footprint: null });
      }
    }

    const seenNow = (g: { x: number; y: number }) => seen.some((f) => f(g));
    if (n >= 1) seenBy[n] = seenNow;
    const fi = PROLOGUE + n - 1;
    // F2 (review fixes (ah)): the crews working a line where the map shows them hold the edge near them; the stretches
    // they held earlier stay "inactive" when they leave. Grid metres. The practice view carries nothing into step 1.
    const toGridP = (q: P) => ({ x: q.x + site.ignitionM.eastM, y: q.y + site.ignitionM.northM });
    const crewsNow = sortedKeys(unitState).filter((id) => units[id] !== undefined && HOLDING_TASKS.has(unitWork[id]?.task ?? "staging")).map((id) => toGridP(unitState[id]!.shown));
    const fire = buildFireDisplay({
      frame,
      ignition: { x: site.ignitionM.eastM, y: site.ignitionM.northM },
      now: mask,
      past: [1, 2, 3].flatMap((k) => (result.cycles[fi - k] ? [{ mask: result.cycles[fi - k]!.masks.reported, clock: result.cycles[fi - k]!.clock }] : [])),
      control: ((act) => (act.length > 0 ? { arcs: act.flatMap((x) => x.arcs), mask: act[act.length - 1]!.mask } : null))(controlStages.filter((x) => fi >= x.fromForcing)),
      head: headG ? { x: headG.eastM, y: headG.northM } : null,
      headingDeg: heading,
      crews: crewsNow,
      crewHistory: n === PRACTICE_STEP ? [] : crewHistory.slice(),
      newFires: c.masks.newFiresReported, // F4 / revision (aj): the old edges that flared up again, labelled US on the map
      seenNow,
      seenPrev: seenBy[n - 1] ?? (() => false),
      cycleStartS: (n - 1) * 1200,
      cycleMinutes: 20,
      toWgs: gridToWgs,
      labels: spotLabels,
    });
    if (n !== PRACTICE_STEP) crewHistory.push(...crewsNow);
    // The step's traffic (SPEC/18 revision (n)), from what can be observed now.
    if (n >= 1 || n === PRACTICE_STEP) {
      const flights = n === PRACTICE_STEP ? PRACTICE_AIR : AIR_PLAN[n] ?? {};
      const toGrid = (q: P) => ({ x: q.x + site.ignitionM.eastM, y: q.y + site.ignitionM.northM });
      const air: TrafficAircraft[] = sortedKeys(flights).map((id) => ({ id, kind: AIR_KIND[id]!, flight: flights[id]!, covers: (q: P) => covers[id]?.(toGrid(q)) ?? false,
        target: flights[id]!.startsWith("orbit:") || flights[id]!.startsWith("scoop:") ? resolveTarget(flights[id]!.slice(6), 0) : head }));
      const nowS = (n - 1) * 1200;
      const input: TrafficCycleInput = {
        n,
        wind: { fromDeg: f.windFromDeg, meanMs: f.meanMs, gustMs: f.gustMs },
        windPrev: { fromDeg: prev.windFromDeg, meanMs: prev.meanMs, gustMs: prev.gustMs },
        observedRateMpm: observedRate, // the same measured rate the map's head mark shows
        headingDeg: heading,
        head,
        ...reportedExtent(frame, mask),
        units: sortedKeys(unitState).map((id) => {
          const u = unitState[id]!;
          const mv = UNIT_PLAN[id]!.moves.find((x) => x.cycle === n);
          return { id, pos: u.shown, vehicle: u.shownWork?.vehicle ? wgsToSite(u.shownWork.vehicle) : null, vehicleMovedM: mv || UNIT_PLAN[id]!.stale?.includes(n) ? 0 : Math.round(vehicleMoved[id] ?? 0), task: u.shownWork?.task ?? u.task, hoseM: u.shownWork?.hoseM ?? null, onEdge: u.onEdge, moved: mv?.reason ?? null,
            arrivedCycle: n === PRACTICE_STEP ? n : Math.min(...UNIT_PLAN[id]!.moves.map((m) => m.cycle)), silent: !!UNIT_PLAN[id]!.stale?.includes(n),
            // The sector label is the sector the unit's marker lies in (review 6 Oct 2026, A9: EK14 on the "north flank" at (239, 436) lay in L2).
            anchor: u.shownAnchor, place: ANCHOR_PLACE[u.shownAnchor]?.place ?? placeNear(u.shown), sector: sectorOf(u.shown),
            // M8 (review fixes (ah)): a unit whose map report is stale on its move step (AVL lag at the step's start) is logged by AVL
            // later in the step where the move took it, not where the stale map still shows it.
            ...(mv && UNIT_PLAN[id]!.stale?.includes(n) ? { avl: { pos: u.pos, place: ANCHOR_PLACE[u.anchor]?.place ?? placeNear(u.pos), sector: sectorOf(u.pos), task: u.task } } : {}) };
        }).filter((u) => units[u.id] !== undefined),
        aircraft: air,
        spotFires: fire.spot_fires.map((s) => ({ pos: wgsToSite(s.position), confirmed: s.confirmed, callsign: s.callsign })),
        detections: fire.detections.filter((d) => nowS - d.time < 600).map((d) => wgsToSite(d.position)),
        fire: makeFireProbe(frame, site.ignitionM, mask, result.cycles[PROLOGUE + n - 2]?.masks.reported ?? null, c.masks.truthAtEnd, c.masks.separateReported),
        landCoverAt, placeNear, roadNear, settlements,
      };
      const { fi, en } = bilingual(n, (tape, lang) => (n === PRACTICE_STEP ? practiceTraffic(input) : cycleTraffic(input, lang === "fi" ? trafficState : trafficStateEn, tape)));
      const evs = toInteractionEvents(n, fi, fromSite, sectorOf, placeNear);
      traffic.push(...evs);
      Object.assign(english, englishById(evs, en)); withTankLevels(unitWork, trafficState, n === PRACTICE_STEP); // the tank in the hover card (2 Oct 2026)
    }
    steps.push({
      index: n,
      id: c.id,
      clock: c.clock,
      areaHa: c.areaHa,
      wind: { fromDeg: f.windFromDeg, meanMs: f.meanMs, gustMs: f.gustMs },
      headRos: { actualMpm: f.headRosActualMpm, envelopeMpm: f.headRosEnvelopeMpm, achievedMpm: c.achievedHeadRosMpm },
      observedHead: {
        anchor: fromSite(head),
        bearingDeg: heading,
        rateMpm: observedRate, // measured: the live front's advance over the last 20 minutes
        observerId: headObserver(n === PRACTICE_STEP ? PRACTICE_AIR : AIR_PLAN[n] ?? {}),
        // The helicopter judges the head's run by eye: a 5 m/min band round the measured rate (fix pass 4, M1).
        ...(headObserver(n === PRACTICE_STEP ? PRACTICE_AIR : AIR_PLAN[n] ?? {}) === "HELI1" ? { rateBand: [Math.floor(observedRate / 5) * 5, Math.floor(observedRate / 5) * 5 + 5] as const } : {}),
      },
      reported: reproject(c.reported)!,
      // The new fires (rekindles) come traced apart by the run, sharing the old edge (revision (aj); was a step-20 clip of the west flare-up).
      reportedDetached: reprojectAll(c.reportedDetached),
      truthAtEnd: reproject(c.truthAtEnd)!,
      truthDetached: reprojectAll(c.spotFires),
      units,
      unitWork,
      aircraft,
      fire,
    });
    if (n === PRACTICE_STEP) { unitState = {}; spotLabels = []; } // the practice map is not carried into step 1
  }

  const viewRecords: SiteView[] = views.map((v) =>
    toSiteView(v, { frame, reproject, reprojectAll, gridToWgs, clockOfStep: (step) => steps.find((st) => st.index === step)!.clock }));

  // The sectors tile the map by bearing from the ignition point exactly as `sectorOfPoint` (traffic-places.ts) labels the
  // messages, the origin included (review 6 Oct 2026, A9: the inner 300 m ring and bearings 80–100° lay in no sector, and
  // the first rekindle with them). One outer radius past the map's corners.
  const wedge = (fromDeg: number, toDeg: number): Polygon => {
    const span = (toDeg - fromDeg + 360) % 360;
    const pts: P[] = [];
    for (let k = 0; k <= 12; k++) pts.push(polar(fromDeg + (span * k) / 12, SECTOR_OUTER_M));
    pts.push(FEATURES.IGN);
    const ring = pts.map(fromSite);
    ring.push(ring[0]!);
    return [ring];
  };

  // A crew with the fire between it and every road would be drawn with its truck across the fire: a build error (review 3 Oct 2026).
  if (unreachableLog.length > 0) console.warn(`vehicles with no road route round the burning zone (placement.ts):\n  ${unreachableLog.join("\n  ")}`);
  if (cutOffLog.length > 0) throw new Error(`crews cut off from their road by the fire (placement.ts; move the crew or its anchor):\n  ${cutOffLog.join("\n  ")}`);
  if (hoseTooLong.length > 0) throw new Error(`hose lines longer than ${MAX_HOSE_M} m (deployment.ts — move the crew or its vehicle):\n  ${hoseTooLong.join("\n  ")}`);
  if (jumps.length > 0) throw new Error(`units jump without a logged move (deployment.ts):\n  ${jumps.join("\n  ")}`);

  // Crossings of roads and brooks during cycle n go on the radio at the start of cycle n + 1.
  const crossings = detectCrossings(site, forcing, result.cycles.map((c) => c.masks));
  const perCycle: Record<number, number> = {};
  for (const x of crossings) {
    const n = x.forcingIndex - PROLOGUE + 1; // the session cycle it happened in
    if (n < 1 || n >= 20) continue;
    perCycle[n] = (perCycle[n] ?? 0) + 1;
    if (perCycle[n]! > 2) continue; // the two largest per cycle
    const pos = positionsByCycle[n - 1]!;
    let nearest: { id: string; distM: number } | null = null;
    for (const id of sortedKeys(pos)) {
      const d = Math.hypot(pos[id]!.x - x.at.x, pos[id]!.y - x.at.y);
      if (!nearest || d < nearest.distM) nearest = { id, distM: d };
    }
    const withdrew = nearest !== null && UNIT_PLAN[nearest.id]!.moves.some((mv) => mv.reason === "withdraw" && (mv.cycle === n || mv.cycle === n + 1));
    const airborne = sortedKeys(AIR_PLAN[n + 1] ?? {})[0];
    const from = nearest && nearest.distM <= 1500 ? nearest.id : airborne ?? "EK11";
    radio.push({
      cycle: n + 1, atOffsetS: 0, from, kind: "crossing",
      text: crossingMessageFi(x, forcing[x.forcingIndex]!.gustMs, nearest ? { ...nearest, withdrew } : null, [hm(stepStartS(n)), hm(stepStartS(n + 1))]),
      textEn: crossingMessageEn(x, forcing[x.forcingIndex]!.gustMs, nearest ? { ...nearest, withdrew } : null, [hm(stepStartS(n)), hm(stepStartS(n + 1))]),
      at: fromSite(x.at),
    });
  }
  // Where a road or brook stopped the fire: once per barrier, at most one a cycle, from the nearest crew.
  const stopsReported: Record<number, boolean> = {};
  for (const x of detectStops(site, result.cycles.map((c) => c.masks))) {
    const n = x.forcingIndex - PROLOGUE + 1;
    if (n < 1 || n >= 20 || stopsReported[n]) continue;
    // Not where the same line was just crossed: "crossed" and "stopped" for one road in one breath contradict.
    if (crossings.some((c) => c.barrier.id === x.barrier.id && (c.forcingIndex === x.forcingIndex || c.forcingIndex === x.forcingIndex - 1))) continue;
    stopsReported[n] = true;
    const pos = positionsByCycle[n - 1]!;
    let from = "EK11";
    let best = Infinity;
    for (const id of sortedKeys(pos)) {
      const d = Math.hypot(pos[id]!.x - x.at.x, pos[id]!.y - x.at.y);
      if (d < best) { best = d; from = id; }
    }
    radio.push({ cycle: n + 1, atOffsetS: 0, from, kind: "stopped", text: stopMessageFi(x, [hm(stepStartS(n)), hm(stepStartS(n + 1))]), textEn: stopMessageEn(x, [hm(stepStartS(n)), hm(stepStartS(n + 1))]), at: fromSite(x.at) });
  }
  for (const r of EXTRA_RADIO) radio.push({ ...r, atOffsetS: r.atOffsetS ?? 0, kind: "hold" });
  // Authored suppression that held a line (scenario-18.ts events with a radio line) goes out mid-cycle.
  forcing.forEach((f, fi) => {
    const n = fi - PROLOGUE + 1;
    for (const e of f.events ?? []) {
      if (e.kind !== "control_sector" && e.radioFi && n >= 1) radio.push({ cycle: n, atOffsetS: 600, from: e.radioFrom ?? "EK11", kind: "hold", text: e.radioFi, textEn: holdEn(e.radioFi) });
    }
  });
  // Delivery within each cycle: moves first (they explain the map), then crossings, 25 s apart.
  const order = { move: 0, crossing: 1, stopped: 2, hold: 3 } as const;
  radio.sort((a, b) => a.cycle - b.cycle || order[a.kind] - order[b.kind] || (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  const slot: Record<number, number> = {};
  const timed = radio.map((r): StepRadio => {
    if (r.atOffsetS > 0) return r;
    slot[r.cycle] = (slot[r.cycle] ?? -1) + 1;
    return { ...r, atOffsetS: 90 + 25 * slot[r.cycle]! };
  });

  const wx = forecastTraffic(), op = patrolTraffic(), pointed = displaceForPointers(capPushed(trafficIntoViews([...traffic, ...wx.events, ...op.events]), radioIntoViews(timed)), itemRecordIds()); // forecasts and the mop-up patrol ((ah)): own ids, T2, not pushed; (bm): the pointers' slots, never an item's record
  const capped = holdForSeeking(pointed); // (bk): two records held for seeking
  const firstCycle = (id: string) => Math.min(...UNIT_PLAN[id]!.moves.map((mv) => mv.cycle));
  const half = 3500;
  const sw = fromSite({ x: -half, y: -half });
  const ne = fromSite({ x: half, y: half });

  return {
    generatedBy: "npm run fire:ca (tools/fire-ca/site-export.ts)",
    site: site.name,
    seed: result.seed,
    flagMatches: views.filter((v) => !v.view.practice && v.matches).length,
    viewCount: MAIN_VIEW_COUNT,
    ignition: fromSite(FEATURES.IGN),
    extent: { south: sw.lat, west: sw.lon, north: ne.lat, east: ne.lon },
    features: Object.fromEntries(sortedKeys(FEATURES).map((k) => [k, fromSite(FEATURES[k])])),
    sectors: [
      { id: "L1", label: "Pohjoinen", geometry: wedge(280, 20) },
      { id: "L2", label: "Koillinen", geometry: wedge(20, 100) }, // fix pass 3 (researcher decision): a compass name like the others (was "Kärki", the head, which moved on)
      { id: "L3", label: "Etelä", geometry: wedge(100, 220) },
      { id: "L4", label: "Länsi", geometry: wedge(220, 280) },
    ],
    regionFires: REGION_FIRES.map((f) => ({ id: f.id, nameFi: f.nameFi, nameEn: f.nameEn, haFi: f.haFi, haEn: f.haEn, at: fromSite(f.at) })),
    units: sortedKeys(UNIT_PLAN).map((id) => ({ id, type: UNIT_PLAN[id]!.type, availableFromCycle: firstCycle(id) })),
    steps,
    views: viewRecords,
    traffic: capped.traffic, radio: withoutEnglish(capped.radio),
    pointerDisplaced: pointed.displaced, // revision (bm): the generated records the pointers displaced from the stream
    // Revision (ae), 9 Oct 2026: the generator writes one set of proper names; the English records get the
    // English place names and codes here, from the one table (`app/i18n/place-names.ts`).
    // determinism-lint-allow: the generator's own insertion order is kept (as before (ae)); only the values are mapped.
    english: Object.fromEntries(Object.entries({ ...english, ...wx.english, ...op.english, ...radioEnglish(capped.radio) }).map(([id, en]) => [id, englishNames(en)])),
  };
}
