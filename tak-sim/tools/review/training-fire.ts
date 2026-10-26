/**
 * The training incident's fire, its S2 keys, S4's memory place and the road codes' places (SPEC/08 (bp) §§bp.3–bp.4), computed from
 * the site, never typed. Every rule checks a margin and throws when it fails.
 * - The fire: a small egg-shaped edge "as mapped at 10.00" beside R5, its head 120 m short of the road (12 minutes at 10 m/min); a
 *   report puts the head at the road at 10.12; the projection to 10.42 is 300 m on in the spread's direction. North-east preferred
 *   (then N, E, NW, SE). The road crossed at ≥ 50°; the edge ≥ 24 m from water, in no field, ≥ 100 m from R5 and wholly on one side
 *   of it; the key over land, ≥ 60 m from water, ≥ 140 m inside the lock; the lure (30 min counted from the drawn edge) ≥ 100 m from
 *   the key; everything ≥ 400 m from the line. Of those, the one with the most room (water and the lock's edge).
 * - EK51 (the engine at the fire) at the fire's tail; the head at R5 is DR8's 10.12 report; the blocked point of R6 300 m from the
 *   R5/R6 junction (EK52's 10.14 report).
 * - S4's memory place: EK53 on a drivable road ≥ 160 m from its ends and every junction, 80–320 m from open water, ≥ 400 m from every
 *   other item's points and from the line: of those, the one farthest from the other items' points.
 * - The road codes: on their roads, 25–75 % along each, as far as possible from every item's point and junction.
 */

import { bearing, byPosition, crossings, dist, lineDist, offset, pathLength, ringArea, alongPath, type Px } from "./map-training-geometry.js";
import { tangentAt } from "./training-s1.js";
import type { Site } from "./training-site.js";

/** 10 m/min is 2.5 px a minute; mapped 10.00, at the road 10.12, projected to 10.42. */
export const FIRE = { pxPerMin: 2.5, mapped: "10.00", report: "10.12", target: "10.42", reportMin: 12, targetMin: 30, lengthPx: 44, halfWidthPx: 8.5 } as const;
export const DIRECTIONS = [{ deg: 45, id: "ne" }, { deg: 0, id: "n" }, { deg: 90, id: "e" }, { deg: 315, id: "nw" }, { deg: 135, id: "se" }] as const;
export type DirectionId = (typeof DIRECTIONS)[number]["id"];

const along = (a: Px, b: Px, n: number): Px[] => Array.from({ length: n + 1 }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }));
const ringOf = (pts: readonly Px[]) => pts.map((p) => [p.x, p.y] as const);

export interface FireKey {
  readonly dir: { readonly deg: number; readonly id: DirectionId };
  /** The head at R5 (10.12), the drawn head (10.00), the edge, the burnt core, the key (10.42) and the lure. */
  readonly atRoad: Px; readonly drawnHead: Px; readonly polygon: readonly Px[]; readonly burnt: readonly Px[]; readonly key: Px; readonly lure: Px;
  readonly tail: Px; readonly ek51: Px;
  readonly crossDeg: number; readonly polygonToRoadM: number; readonly drawnHeadToRoadM: number; readonly areaHa: number;
  readonly fireToWaterM: number; readonly keyToWaterM: number; readonly keyInsideLockM: number; readonly lureOffM: number; readonly lineM: number;
  /** The side of R5 the edge lies on, as a compass point from the road ("s" or "n"). */
  readonly side: "n" | "s";
}

export function fireKey(s: Site, avoid: Px): FireKey {
  const r5 = s.road("R5").pts, r5Ring = ringOf(r5);
  const roadRings = s.uncut.map((pc) => ringOf(pc.pts));
  const roadClear = (q: Px, px: number) => roadRings.every((r) => lineDist(q, r) >= px);
  for (const dir of DIRECTIONS) {
    const cands: (FireKey & { room: number })[] = [];
    r5.forEach((p, i) => {
      if (!s.inArea(p, 50) || !s.clear(p)) return;
      const t = tangentAt(r5, i);
      const crossDeg = Math.min(...[0, 180].map((k) => Math.abs(((dir.deg - t - k + 540) % 360) - 180)));
      if (crossDeg < 50) return;
      const h0 = offset(p, dir.deg + 180, FIRE.reportMin * FIRE.pxPerMin);
      const o = offset(h0, dir.deg + 180, FIRE.lengthPx);
      const c = { x: (o.x + h0.x) / 2, y: (o.y + h0.y) / 2 };
      const egg = (scale: number, at: Px) => Array.from({ length: 32 }, (_, k) => {
        const th = (k / 32) * 2 * Math.PI, a = Math.cos(th) * scale * FIRE.lengthPx / 2, w = Math.sin(th) * scale * FIRE.halfWidthPx * (1 - 0.25 * Math.cos(th));
        const r = (dir.deg * Math.PI) / 180;
        return { x: Math.round((at.x + a * Math.sin(r) + w * Math.cos(r)) * 10) / 10, y: Math.round((at.y - a * Math.cos(r) + w * Math.sin(r)) * 10) / 10 };
      });
      const polygon = egg(1, c);
      // The burnt core: the fire's earlier edge, nearer the tail.
      const burnt = egg(0.55, offset(o, dir.deg, 0.55 * FIRE.lengthPx / 2));
      const key = offset(p, dir.deg, FIRE.targetMin * FIRE.pxPerMin);
      const lure = offset(h0, dir.deg, FIRE.targetMin * FIRE.pxPerMin);
      const ek51 = offset(o, dir.deg + 180, 5);
      if (!polygon.every((q) => s.inArea(q, 12) && s.waterDist(q) >= 6 && !s.inField(q) && roadClear(q, 10) && s.clear(q))) return;
      const polygonToRoad = Math.min(...polygon.map((q) => lineDist(q, r5Ring))) * s.mpp;
      const crossesR5 = polygon.some((q, k) => crossings(q, polygon[(k + 1) % polygon.length]!, r5Ring) > 0);
      if (polygonToRoad < 100 || crossesR5) return;
      if (!s.inArea(key, 35) || s.waterDist(key) < 15 || !along(p, key, 15).every((q) => s.waterDist(q) >= 4 && s.clear(q)) || !s.clear(key)) return;
      if (dist(lure, key) * s.mpp < 100 || !s.clear(lure) || !s.clear(ek51) || s.waterDist(ek51) < 4 || !s.inArea(ek51, 8)) return;
      if (dist(key, avoid) < 60 || dist(p, avoid) < 60) return;
      const room = Math.min(...polygon.map(s.waterDist), s.waterDist(key), ...polygon.map(s.edgePx));
      // The side of R5: the bearing from the road's nearest point to the edge's middle.
      const foot = r5.reduce((b, q) => (dist(q, c) < dist(b, c) ? q : b), r5[0]!);
      const sideDeg = bearing(foot, c);
      const side = sideDeg > 135 && sideDeg < 225 ? "s" : sideDeg < 45 || sideDeg > 315 ? "n" : null;
      if (!side) return;
      const all = [...polygon, key, lure, p, ek51, ...along(p, key, 15)];
      cands.push({
        dir, atRoad: p, drawnHead: h0, polygon, burnt, key, lure, tail: o, ek51, crossDeg: Math.round(crossDeg * 10) / 10,
        polygonToRoadM: Math.round(polygonToRoad), drawnHeadToRoadM: Math.round(dist(h0, p) * s.mpp), areaHa: Math.round((ringArea(ringOf(polygon)) * s.mpp * s.mpp) / 1000) / 10,
        fireToWaterM: Math.round(Math.min(...polygon.map(s.waterDist)) * s.mpp), keyToWaterM: Math.round(s.waterDist(key) * s.mpp), keyInsideLockM: Math.round(s.edgePx(key) * s.mpp),
        lureOffM: Math.round(dist(lure, key) * s.mpp), lineM: Math.round(Math.min(...all.map(s.lineM))), side, room,
      });
    });
    cands.sort((a, b) => (b.room - a.room) || byPosition(a.atRoad, b.atRoad));
    const best = cands[0];
    if (best) {
      if (best.areaHa < 0.6 || best.areaHa > 1.05) throw new Error(`training fire: the drawn edge is ${best.areaHa} ha (the story needs 0.6–1.05 ha at 10.00)`);
      const { room: _room, ...key } = best;
      return key;
    }
  }
  throw new Error("training fire: no R5 crossing with room for the fire and the projection");
}

/** The point `metres` along R6 from the R5/R6 junction (EK52's blocked point) and its bearing from the junction. */
export function r6Point(s: Site, metres: number): { readonly at: Px; readonly bearingDeg: number } {
  const r6 = s.road("R6").pts;
  const path = dist(r6[0]!, s.r5r6) <= dist(r6.at(-1)!, s.r5r6) ? r6 : [...r6].reverse();
  if (pathLength(path) * s.mpp < metres + 200) throw new Error("training: R6 is too short for the blocked point");
  const at = alongPath(path, metres / s.mpp);
  if (!s.clear(at)) throw new Error("training: R6's blocked point lies in the band");
  return { at, bearingDeg: Math.round(bearing(s.r5r6, at)) };
}

export interface MemoryKey { readonly at: Px; readonly road: string; readonly toWaterM: number; readonly fromEndsM: number; readonly fromJunctionM: number; readonly toOtherItemsM: number; readonly insideLockM: number; readonly lineM: number }

export function memoryKey(s: Site, others: readonly Px[]): MemoryKey {
  const cands: MemoryKey[] = [];
  for (const pc of s.pieces) for (const p of pc.pts) {
    const fromEnds = Math.min(dist(p, pc.pts[0]!), dist(p, pc.pts.at(-1)!)) * s.mpp;
    const fromJunction = Math.min(...s.junctions.map((j) => dist(j, p))) * s.mpp;
    const water = s.waterDist(p) * s.mpp;
    if (fromEnds < 160 || fromJunction < 160 || water < 80 || water > 320 || !s.inArea(p, 60) || !s.clear(p)) continue;
    const away = Math.min(...others.map((q) => dist(p, q))) * s.mpp;
    if (away < 400) continue;
    const road = s.named.find((n) => n.piece === pc)?.code ?? "unnamed";
    cands.push({ at: p, road, toWaterM: Math.round(water), fromEndsM: Math.round(fromEnds), fromJunctionM: Math.round(fromJunction), toOtherItemsM: Math.round(away), insideLockM: Math.round(s.edgePx(p) * s.mpp), lineM: Math.round(s.lineM(p)) });
  }
  cands.sort((a, b) => (b.toOtherItemsM - a.toOtherItemsM) || byPosition(a.at, b.at));
  const best = cands[0];
  if (!best) throw new Error("training s4.memory: no place for the unit");
  return best;
}

/** The road codes on their roads: 25–75 % along, as far as possible from `points` (≥ 120 m), ≥ 400 m from the line. */
export function roadLabels(s: Site, points: readonly Px[]): { readonly road: string; readonly at: Px; readonly awayM: number }[] {
  return s.named.map((n) => {
    const total = pathLength(n.piece.pts);
    let run = 0;
    const cands = n.piece.pts.map((p, i) => { if (i > 0) run += dist(n.piece.pts[i - 1]!, p); return { p, at: run / total }; })
      .filter((c) => c.at >= 0.25 && c.at <= 0.75 && s.inArea(c.p, 40) && s.clear(c.p))
      .map((c) => ({ p: c.p, away: Math.min(...points.map((q) => dist(c.p, q))) }))
      .sort((a, b) => (b.away - a.away) || byPosition(a.p, b.p));
    if (!cands[0] || cands[0].away * s.mpp < 120) throw new Error(`training: no clear place for the label ${n.code}`);
    return { road: n.code, at: cands[0].p, awayM: Math.round(cands[0].away * s.mpp) };
  });
}
