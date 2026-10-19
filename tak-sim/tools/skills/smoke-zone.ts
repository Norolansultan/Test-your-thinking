/**
 * A CO-zone PROXY per ground crew from the downwind/smoke rule (SPEC/31 §5 D4, coa F15). The scenario has no CO value
 * anywhere (`co_ppm` stays null); MPV25 defines its zones by CO, so this is a stand-in for the tactical check and the
 * panel packet, never a measurement, and it changes no key. The rule (wildfire-tactical-check `downwind_work`, KAL 7.4):
 * downwind of an active front in smoke counts as the immediate-danger area unless a CO reading below 75 ppm is given.
 *
 * - Downwind: within 500 m of a burning edge of the window (`burningEdges`: the reported edge that advanced over it) and
 *   within ±45° of the step's downwind bearing (the forcing's wind blows FROM `from_deg`), seen from that edge.
 * - In smoke, from a record of the window:
 *   - a crew's own report of smoke or flames where it is ("tie autollemme on savun peitossa", "savua tiellä", "painaa
 *     savua linjan yli", "liekit tien reunassa"): the crews within 200 m of the reporting crew;
 *   - a drone's road observation ("tiehavainto: metsäautotie (Honkaharju) …, palo noin 100 m tiestä — savua tiellä"; the
 *     record is placed where the drone is, so the road it names decides): the crews within 100 m of that road and within
 *     the stated fire distance + 300 m of a burning edge;
 *   - the drone's smoke-column report ("Savu laskeutuu palon itäpuolelle …"): the crews within 500 m of a burning edge
 *     on that side (±45°).
 * - Clear: the same two record kinds saying the road or water point is free of smoke ("ei savua tiellä", "vapaa savusta").
 *
 * Zone: downwind and in smoke → `immediate_danger`; downwind, nothing reported → `danger`; downwind, reported clear →
 * `rescue_ops`; not downwind but in smoke → `danger`; otherwise `rescue_ops`. `downwind` is exported as the rule's
 * condition itself (downwind AND in smoke), because `tactical_check.py` reads `downwind: true` as "in smoke without a CO
 * reading" and fails the placement.
 */

import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import type { Observation } from "./fire-observations.js";
import { bearing, dist, distToSegment, signedAngle, type EN } from "./geo.js";
import { barrierLayer } from "./spatial.js";

export const DOWNWIND_M = 500;
export const CREW_REPORT_M = 200;
export const ON_ROAD_M = 100;
export const ROAD_STRETCH_M = 300;
const SECTOR_DEG = 45;

const SMOKE_AT = /(?<!ei )savua tiellä|savun peitossa|painaa savua|liekit tien reunassa/;
const CLEAR_AT = /\bei savua tiellä|vapaa savusta/;
const SIDES: readonly (readonly [string, number])[] = [
  ["pohjois", 0], ["koillis", 45], ["itä", 90], ["kaakkois", 135], ["etelä", 180], ["lounais", 225], ["länsi", 270], ["luoteis", 315],
];
const SETTLES = /Savu laskeutuu palon (\p{L}+?)puolelle/u;
const ROADS: readonly (readonly [RegExp, string])[] = [[/metsäautotie \(Honkaharju\)/, "Honkaharju forest road"], [/\btie (R\d)\b/, "$1"]];

export type Zone = "immediate_danger" | "danger" | "rescue_ops";

export interface ZoneProxy {
  readonly zone: Zone;
  readonly downwind: boolean;
  readonly downwindOfFront: boolean;
  readonly smoke: readonly string[];
  readonly clear: readonly string[];
  readonly basis: string;
}

type Edges = readonly (readonly EN[])[];

/** Whether `p` lies within `maxM` of a vertex of `edges`, within ±45° of `towardDeg` as seen from that vertex. */
function onSide(p: EN, edges: Edges, towardDeg: number, maxM: number): boolean {
  for (const line of edges) for (const v of line) {
    const d = dist(v, p);
    if (d >= 1 && d <= maxM && Math.abs(signedAngle(towardDeg, bearing(v, p))) <= SECTOR_DEG) return true;
  }
  return false;
}

const nearEdges = (p: EN, edges: Edges, maxM: number): boolean => edges.some((line) => line.some((v) => dist(v, p) <= maxM));

/** The road a drone's road observation names, as the basemap's road name (`spatial.ts`); null when it names none. */
export function roadNamed(text: string): string | null {
  for (const [re, name] of ROADS) { const m = text.match(re); if (m) return m[0].replace(re, name); }
  return null;
}

function nearRoad(p: EN, name: string): boolean {
  for (const b of barrierLayer()) {
    if (b.type !== "road" || b.name !== name) continue;
    for (let i = 0; i + 1 < b.coords.length; i++) if (distToSegment(p, b.coords[i]!, b.coords[i + 1]!) <= ON_ROAD_M) return true;
  }
  return false;
}

const GROUND = new Set(SITE_SCENARIO.units.map((u) => u.id));

/** Whether a record's statement (smoke or clear) applies at the crew position `p`. */
function appliesAt(o: Observation, p: EN, edges: Edges): boolean {
  if (GROUND.has(o.source)) return o.xy !== null && dist(o.xy, p) <= CREW_REPORT_M;
  const road = /tiehavainto/.test(o.text_fi) ? roadNamed(o.text_fi) : null;
  if (!road) return false;
  const stated = o.text_fi.match(/palo noin (\d+) m tiestä/);
  return nearRoad(p, road) && nearEdges(p, edges, (stated ? Number(stated[1]) : 0) + ROAD_STRETCH_M);
}

/** The proxy for a crew at `p` in a window with these burning edges, wind and records. */
export function zoneProxy(p: EN, edges: Edges, windFromDeg: number, obs: readonly Observation[]): ZoneProxy {
  const downwindDeg = (windFromDeg + 180) % 360;
  const downwindOfFront = onSide(p, edges, downwindDeg, DOWNWIND_M);
  const smoke: string[] = [];
  const clearIds: string[] = [];
  for (const o of obs) {
    const m = o.text_fi.match(SETTLES);
    const side = m ? SIDES.find(([w]) => w === m[1]) : undefined;
    if (side && onSide(p, edges, side[1], DOWNWIND_M)) smoke.push(o.id);
    else if (SMOKE_AT.test(o.text_fi) && appliesAt(o, p, edges)) smoke.push(o.id);
    else if (CLEAR_AT.test(o.text_fi) && appliesAt(o, p, edges)) clearIds.push(o.id);
  }
  const clear = smoke.length > 0 ? [] : clearIds;
  const zone: Zone = downwindOfFront
    ? (smoke.length > 0 ? "immediate_danger" : clear.length > 0 ? "rescue_ops" : "danger")
    : (smoke.length > 0 ? "danger" : "rescue_ops");
  const where = downwindOfFront ? `downwind (within ${DOWNWIND_M} m of a burning edge, ±${SECTOR_DEG}° of ${downwindDeg}°)` : "not downwind of a burning edge";
  const said = smoke.length > 0 ? `smoke or flames reported: ${smoke.join(", ")}` : clear.length > 0 ? `reported clear of smoke: ${clear.join(", ")}` : "no smoke report";
  return { zone, downwind: downwindOfFront && smoke.length > 0, downwindOfFront, smoke, clear, basis: `PROXY, no CO reading: ${where}; ${said}` };
}
