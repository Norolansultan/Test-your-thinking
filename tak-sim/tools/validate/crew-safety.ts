/**
 * Crew safety check over the frozen scenario bundle (review fixes (ah), 9 Oct 2026, safety reviewer's rule):
 * no crew, vehicle or civilian may end up inside, boxed in by, or cut off by the fire without an explicit radio
 * safety line (escape route / pulling back / all accounted for).
 *
 * Per step and unit, with the positions the map shows (`steps[n].units`, `unitWork[u].vehicle`):
 *   - `near_burning`: the crew or the vehicle is inside, or within `CLEARANCE_M`, of the map's burning zone
 *     (what burned since the last report, `fire.burning_zone`);
 *   - `overrun`: the crew or the vehicle lies in ground the fire burned during the step (the truth at the step's
 *     end less the reported fire at its start);
 *   - `cut_off`: the straight crew-to-vehicle line crosses the burning zone or the step's new fire;
 *   - `downwind` (revision (aj), 9 Oct 2026; LCES, SOU 2019:7): the crew stands downwind of fire that runs at it —
 *     a point of the map's uncontained edge, or of the ground the fire burns during the step (the truth at the
 *     step's end outside the report), lies upwind of the crew within ±`DOWNWIND_HALF_DEG` of the step's spread
 *     heading (the true wind) and within the step's run distance, `headRos.actualMpm` × 20 min (at least
 *     `MIN_RUN_M`), and the fire advanced there (that point's distance from the previous report, or from this
 *     one for the step's burn) at least `advanceMinM`: a quarter of the run, never under two cells, so a backing
 *     edge creeping a cell behind a crew is not a run at it. A crew on a flank beside the fire is not downwind
 *     of it; one ahead of a head, or of a flank the wind has turned into a head, is.
 * A finding passes only when `SAFETY_LINES` names it with the pattern of a radio or log record of that unit in
 * that step which carries the safety line; the record must exist.
 *
 *   npx tsx tools/validate/crew-safety.ts     # exit 1 on any unexplained finding
 */

import { pathToFileURL } from "node:url";
import type { LatLon, Polygon } from "../../app/engine/primitives.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import type { SiteScenarioBundle } from "../../app/scenario/site-scenario.js";
import { sortedKeys } from "../../app/engine/deterministic-object.js";

/** How near the burning zone a crew or a vehicle may stand without a safety line (m). */
export const CLEARANCE_M = 20;

export type SafetyKind = "near_burning" | "overrun" | "cut_off" | "spot_near_line" | "downwind";
/** An unconfirmed spot fire or flare-up this near a crew's line to its vehicle needs a safety line too (safety re-check (ah)). */
export const SPOT_LINE_M = 50;
/** Fire within this angle of the spread heading, seen from the crew, is upwind of it (revision (aj)). */
export const DOWNWIND_HALF_DEG = 45;
/** The least run distance a step is checked for (m): two and a half cells even in a lull (revision (aj)). */
export const MIN_RUN_M = 60;
/** The step's run distance (m): what the head covers in the step at the authored actual rate. */
export const runDistanceM = (actualMpm: number): number => Math.max(MIN_RUN_M, actualMpm * 20);
/** Fire counts as running at a crew only where it advanced at least this far (m): a quarter of the run, never under two cells. */
export const advanceMinM = (runM: number): number => Math.max(50, runM / 4);
export interface SafetyFinding {
  readonly step: number;
  readonly unit: string;
  readonly kind: SafetyKind;
  readonly what: "crew" | "vehicle" | "line";
  readonly distanceM: number;
  /** The record carrying the safety line, when the finding is explained. */
  readonly explainedBy: string | null;
}

/**
 * Explained findings: `step:unit` → the text pattern of that unit's record in that step that gives the safety line
 * (`from`: another unit's record, when a crew leader speaks for the crews beside it).
 * Each entry is a decision, not a blanket exemption; the reason is in the comment.
 */
export const SAFETY_LINES: Readonly<Record<string, { readonly re: RegExp; readonly inStep?: number; readonly from?: string }>> = {
  // V1, 13:20 (the handover): both head crews in a direct attack on the head's sides, EK11 states the LCES for both (revision (aj)).
  "1:EK12": { re: /^EK11: kärjen molemmat laidat suorassa sammutuksessa/, from: "EK11" },
  // V2, 13:40: direct attack on the head's left side, low flames: escape route into the black, lookout. The same assignment
  // and the same arrangement through V2–V3 (steps 3–4; revision (aj)).
  "2:EK11": { re: /^EK11: hyökkäämme kärjen vasenta laitaa suoraan/ },
  // V2 second step and V3 (steps 3–4): the esker ignition ahead of the head — EK11's 14:0x line (revision (ak): attack from the flank, not
  // from between the head and the spot).
  "3:EK11": { re: /^EK11: uusi palo harjulla/ },
  "4:EK11": { re: /^EK11: uusi palo harjulla/, inStep: 3 },
  // V4, 14:40: the forest-fire unit's pump right at the north edge; the head crews' trigger point before the crown run (revision (aj)).
  "5:EK14": { re: /^EK14: työskentelemme pohjoisreunalla aivan reunassa/ },
  "5:EK11": { re: /^EK11: kärki kiihtyy kuusikkoon/ },
  "5:EK12": { re: /^EK11: kärki kiihtyy kuusikkoon/, from: "EK11" },
  // V5, 15:20–15:40: EK11 back on the Koivuoja birch strip after the crown run; PP1 lands behind it (safety reviewer, HIGH).
  // It pulls back into the burned area at 15:31; at 15:42, as the fire crosses Koivuoja beside it, it reports its safety.
  "7:EK11": { re: /^EK11: pistepalo PP1 takanamme/ },
  // V7, 16:20: EK14 back from the radio dead zone (F3) takes the new line on the flank that ran at 16:00–16:20; it says where it
  // waited and that all are accounted for (revision (aj): it withdrew into the black at 15:40, so steps 8–9 have no finding).
  "10:EK14": { re: /^EK14: yhteys palasi/ },
  // V8, 16:40: EK15's firebreak on the north edge, downwind of the stretch that ran before the lull (revision (aj)).
  // SPEC/31 (radio, the move said as speech): "EK15: siirrymme …" (was "EK15 siirtyy … (lohko L1) (…)").
  "11:EK15": { re: /^EK15: siirrymme pohjoisreunalle Karhujärven suuntaan, lohko L1; palokatko .*perääntymistie palaneelle alueelle, tähystäjä nimetty/ },
  // V12, 18:20–19:00: the road lines ahead of the south-east front — KY21's trigger point (it leaves at 18:40), EK16's escape
  // route along the road (stated at 18:4x, the head crosses at 19:00–19:20 and EK16 withdraws) (revision (aj)).
  "16:KY21": { re: /^KY21: rintama lähestyy metsäautotietä/ },
  // Revision (ak): KY21 holds the road through the stop (18:40–19:00) — the traced outline has the fire at the road's verge, so the
  // crew on the road reads as inside it by a few metres — under the 18:26 line's LCES (sprinklers, trigger, escape route east along
  // the road, lookout), and withdraws at 19:00 as sparks cross.
  "17:KY21": { re: /^KY21: rintama lähestyy metsäautotietä/, inStep: 16 },
  // Revision (al): EK16 150 m west along the road (off the 110 kV corridor) stands ~185 m downwind of the running head already on
  // the 18:40 map; the same 18:4x report (trigger point, escape route east to the log landing, lookout) covers it.
  "17:EK16": { re: /^Kärki lähestyy metsäautotietä luoteesta/ },
  // SPEC/31 D8: at 19:0x, its trigger point met, EK16 states why it stays and its LCES (escape route east, lookout, the new trigger).
  "18:EK16": { re: /^EK16: laukaisupiste täyttyi klo 19\.00, .*perääntymistie itään .*tähystäjä seuraa/ },
};

const R = 6_371_000;
function toXY(p: LatLon, o: LatLon): { x: number; y: number } {
  return { x: ((p.lon - o.lon) * Math.PI / 180) * R * Math.cos((o.lat * Math.PI) / 180), y: ((p.lat - o.lat) * Math.PI / 180) * R };
}
type XY = { x: number; y: number };
function inRing(p: XY, ring: readonly XY[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
/** Inside the polygon: in the outer ring and in no hole. */
function inPoly(p: XY, poly: readonly XY[][]): boolean {
  return poly.length > 0 && inRing(p, poly[0]!) && !poly.slice(1).some((h) => inRing(p, h));
}
function segDist(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
/** Distance to a set of polygons: 0 inside, else to the nearest edge. */
function distTo(p: XY, polys: readonly XY[][][]): number {
  let best = Infinity;
  for (const poly of polys) {
    if (inPoly(p, poly)) return 0;
    for (const ring of poly) for (let i = 1; i < ring.length; i++) best = Math.min(best, segDist(p, ring[i - 1]!, ring[i]!));
  }
  return best;
}

export function crewSafetyFindings(bundle: SiteScenarioBundle = SITE_SCENARIO): SafetyFinding[] {
  const o = bundle.ignition;
  const xy = (polys: readonly Polygon[]) => polys.map((poly) => poly.map((ring) => ring.map((q) => toXY(q, o))));
  const out: SafetyFinding[] = [];
  const recordsOf = (step: number, unit: string): string[] => [
    ...bundle.radio.filter((r) => r.cycle === step && r.from === unit).map((r) => r.text),
    ...bundle.traffic.filter((e) => e.cycle === step && e.actor === unit && e.lang === "fi").map((e) => e.content),
  ];
  for (const s of bundle.steps.filter((x) => x.index >= 1)) {
    const burning = xy(s.fire.burning_zone);
    const before = xy([s.reported, ...s.reportedDetached]);
    const after = xy([s.truthAtEnd, ...s.truthDetached]);
    const overrun = (p: XY) => distTo(p, after) === 0 && distTo(p, before) > 0;
    // Fire that runs during the step (revision (aj)): the map's uncontained edge (its advance since the last report) and the
    // outline of what the step burns (its advance past this report), where the advance is at least `advanceMinM`.
    const runM = runDistanceM(s.headRos.actualMpm);
    const lastReport = xy(s.fire.perimeters_past[0]?.geometry ? [s.fire.perimeters_past[0].geometry] : []);
    const running: XY[] = [
      ...s.fire.perimeter_current.filter((seg) => seg.status === "uncontained").flatMap((seg) => seg.line.map((q) => toXY(q, o))).filter((q) => lastReport.length === 0 || distTo(q, lastReport) >= advanceMinM(runM)),
      ...after.flatMap((poly) => poly[0]!).filter((q) => distTo(q, before) >= advanceMinM(runM)),
    ];
    const heading = ((s.wind.fromDeg + 180) * Math.PI) / 180;
    const hx = Math.sin(heading), hy = Math.cos(heading);
    const downwindOf = (p: XY): number => {
      let best = Infinity;
      for (const q of running) {
        const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
        if (d === 0 || d > runM || (dx * hx + dy * hy) / d < Math.cos((DOWNWIND_HALF_DEG * Math.PI) / 180)) continue;
        best = Math.min(best, d);
      }
      return best;
    };
    for (const unit of sortedKeys(s.units)) {
      const crew = toXY(s.units[unit]!, o);
      const work = s.unitWork[unit];
      const vehicle = work?.vehicle ? toXY(work.vehicle, o) : null;
      const found: Omit<SafetyFinding, "explainedBy" | "step" | "unit">[] = [];
      for (const [what, p] of [["crew", crew], ["vehicle", vehicle]] as const) {
        if (!p) continue;
        const d = distTo(p, burning);
        if (d < CLEARANCE_M) found.push({ kind: "near_burning", what, distanceM: Math.round(d) });
        if (overrun(p)) found.push({ kind: "overrun", what, distanceM: 0 });
      }
      const dw = downwindOf(crew);
      if (Number.isFinite(dw)) found.push({ kind: "downwind", what: "crew", distanceM: Math.round(dw) });
      if (vehicle) {
        const spots = s.fire.spot_fires.filter((f) => !f.confirmed).map((f) => toXY(f.position, o));
        const near = Math.min(...spots.map((q) => segDist(q, crew, vehicle)));
        if (near < SPOT_LINE_M) found.push({ kind: "spot_near_line", what: "line", distanceM: Math.round(near) });
        const len = Math.hypot(vehicle.x - crew.x, vehicle.y - crew.y);
        for (let k = 1; k * 10 < len; k++) {
          const t = (k * 10) / len, p = { x: crew.x + (vehicle.x - crew.x) * t, y: crew.y + (vehicle.y - crew.y) * t };
          if (distTo(p, burning) === 0 || overrun(p)) { found.push({ kind: "cut_off", what: "line", distanceM: Math.round(k * 10) }); break; }
        }
      }
      if (found.length === 0) continue;
      const line = SAFETY_LINES[`${s.index}:${unit}`];
      const record = line ? recordsOf(line.inStep ?? s.index, line.from ?? unit).find((t) => line.re.test(t)) ?? null : null;
      for (const f of found) out.push({ ...f, step: s.index, unit, explainedBy: record });
    }
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const all = crewSafetyFindings();
  for (const f of all) console.log(`${f.explainedBy ? "explained" : "UNEXPLAINED"}  step ${f.step} ${f.unit} ${f.kind} (${f.what}, ${f.distanceM} m)${f.explainedBy ? ` — "${f.explainedBy.slice(0, 80)}"` : ""}`);
  const bad = all.filter((f) => !f.explainedBy);
  console.log(`crew safety: ${all.length} finding(s), ${bad.length} without a radio safety line`);
  process.exit(bad.length > 0 ? 1 : 0);
}
