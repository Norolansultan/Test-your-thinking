/**
 * The generated site's road network (SPEC/33 §4 stage 5): the designed roads (roads-main.ts), then, grown over the terrain by A* on
 * a slope / mire / water cost that makes existing roads cheap to reuse (road-grid.ts):
 *
 *   - a gravel access road to every farmstead;
 *   - forest roads (metsäautotie), each from the forest ground farthest from any road back to the network, leaving it at a near
 *     right angle and ending at a turning place in the forest (a dead end, as Finnish forest roads do);
 *   - tracks (ajopolku) the same way into the gaps that remain, and a track to each lake-shore cottage.
 *
 * Roads keep to firm ground, cross mires only on short straight causeways, never run beside another road, and cross water only at a
 * bridge (main and gravel roads over Kotkanjoki) or a culvert (a brook). Near IGN (inside NEAR_IGN_M) a new road is a spur that
 * joins nothing but its parent, so the scenario's routes and distances (SPEC/33 §3) stay as authored. Deterministic.
 */

import { Mulberry32 } from "../fire-ca/model.js";
import { bearingOf, BRIDGE, cellOf, cellX, cellY, closestOnPolyline, GN, HALF_M, hash2, MinHeap, polar, resample, type P } from "./terrain-base.js";
import { LAKE_ID, lakeAt, LAKES, STREAM_CELL } from "./water.js";
import { riverCrossings } from "./water-query.js";
import { mireAt, MIRE } from "./soil.js";
import { FARMS, PARCELS, parcelAt } from "./fields.js";
import { BRIDGE_S, COMMAND_POINT, COTTAGE_ROAD_ENDS, FIXED_ROADS, HONKAHARJU_ROAD, MAANTIE_S, MOKKIRANTA_JUNCTION, type Road, type RoadClass } from "./roads-main.js";
import { longestMireRun, roadLine, route, squareJunction, straightenCrossings, terrainCost, windowAround } from "./road-grid.js";

export type { Road, RoadClass };
export { BRIDGE, BRIDGE_S, COMMAND_POINT, COTTAGE_ROAD_ENDS, FIXED_ROADS, MAANTIE_S, MOKKIRANTA_JUNCTION };

/** Inside this distance of IGN a generated road is a spur off one road, clear of every other (SPEC/33 §3 travel times). */
export const NEAR_IGN_M = 3600;

/** Where a generated road dead-ends; places.ts decides what stands there. */
export interface RoadEnd { readonly x: number; readonly y: number; readonly cls: RoadClass; readonly heading: number }
/** A lake-shore cottage site: the cottage, and the bearing from it to the water. */
export interface Cottage { readonly x: number; readonly y: number; readonly toWater: number }

const cellP = (i: number): P => ({ x: cellX(i % GN), y: cellY(Math.floor(i / GN)) });

function buildNetwork() {
  const roads: Road[] = [...FIXED_ROADS, HONKAHARJU_ROAD];
  const roadId = new Int32Array(GN * GN).fill(-1);
  const roadDist = new Float64Array(GN * GN).fill(1e9);
  const ends: RoadEnd[] = [];
  const cottages: Cottage[] = [];
  // Distance to the nearest road, kept up to date incrementally (a bounded Dijkstra from each new road's cells).
  const heap = new MinHeap(4096);
  const addToGrid = (line: readonly P[], id: number) => {
    for (const p of resample(line, 8)) {
      if (Math.abs(p.x) >= HALF_M || Math.abs(p.y) >= HALF_M) continue;
      const i = cellOf(p.x, p.y);
      if (roadId[i]! < 0) roadId[i] = id;
      if (roadDist[i]! > 0) { roadDist[i] = 0; heap.push(0, i); }
    }
    while (heap.size > 0) {
      const i = heap.pop();
      const d = heap.lastKey;
      if (d > roadDist[i]!) continue;
      const r = Math.floor(i / GN);
      const c = i % GN;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if ((dr === 0 && dc === 0) || r + dr < 0 || r + dr >= GN || c + dc < 0 || c + dc >= GN) continue;
        const j = i + dr * GN + dc;
        const nd = d + (dr !== 0 && dc !== 0 ? 28.28 : 20);
        if (nd < roadDist[j]! && (nd < 1500 || roadDist[j]! >= 1e9)) { roadDist[j] = nd; heap.push(nd, j); }
      }
    }
  };
  roads.forEach((r, k) => addToGrid(r.line, k));

  // Field parcels (a road runs along a field's edge rather than across it).
  const inField = new Uint8Array(GN * GN);
  for (const p of PARCELS) {
    const reach = Math.hypot(p.halfLen, p.halfWid);
    for (let r = Math.max(0, Math.floor((p.cy - reach + HALF_M) / 20)); r <= Math.min(GN - 1, Math.floor((p.cy + reach + HALF_M) / 20)); r++) {
      for (let c = Math.max(0, Math.floor((p.cx - reach + HALF_M) / 20)); c <= Math.min(GN - 1, Math.floor((p.cx + reach + HALF_M) / 20)); c++) {
        if (parcelAt(cellX(c), cellY(r)) >= 0) inField[r * GN + c] = 1;
      }
    }
  }
  const costFor = (cls: RoadClass) => {
    const base = terrainCost(cls, false);
    for (let i = 0; i < GN * GN; i++) if (inField[i]) base[i] = base[i]! + 0.6;
    return base;
  };
  const COST = { gravel: costFor("gravel"), forest: costFor("forest"), track: costFor("track"), path: costFor("path") };
  /** Generated roads keep 25–90 m off other roads (they meet them, they do not run beside them). */
  const effective = (cost: Float32Array, i: number) => (roadId[i]! >= 0 ? 0.25 : cost[i]! + (roadDist[i]! < 90 ? 1.5 : 0));

  /**
   * Routes a new road from `start` (its far end) back to the network and adds it, junction first. Returns false when no route is
   * found, the road would be too short, or (near IGN) it would come near a second road.
   */
  const grow = (start: number, cls: "gravel" | "forest" | "track" | "path", minLen: number, maxLen: number, deadEnd: boolean): boolean => {
    const cost = COST[cls];
    const s = cellP(start);
    const cells = route((i) => effective(cost, i), [start], (i) => roadId[i]! >= 0, undefined, { heuristic: (i) => roadDist[i]!, window: windowAround([s], roadDist[start]! * 1.5 + 600) });
    if (!cells) return false;
    const junctionCell = cells[cells.length - 1]!;
    const parent = roads[roadId[junctionCell]!]!;
    if (parent.cls === "path") return false;
    const j = closestOnPolyline(cellP(junctionCell).x, cellP(junctionCell).y, parent.line);
    let line = roadLine([...cells].reverse(), j, s, 12);
    line = squareJunction(line, parent.line, 60);
    line = straightenCrossings(line, (p) => mireAt(p.x, p.y) !== 0, (p) => lakeAt(p.x, p.y) !== undefined, 400);
    const len = line.reduce((t, p, k) => (k ? t + Math.hypot(p.x - line[k - 1]!.x, p.y - line[k - 1]!.y) : 0), 0);
    if (len < minLen || len > maxLen) return false;
    if (resample(line, 5).some((p) => lakeAt(p.x, p.y) !== undefined)) return false;
    // Short, straight mire crossings only (SPEC/33 §2.3): no stretch over 420 m on mire, no road over a third on it.
    const mireRun = longestMireRun(line, (p) => mireAt(p.x, p.y) !== 0);
    if (mireRun > 380) return false;
    if (len > 500 && resample(line, 20).filter((p) => mireAt(p.x, p.y) !== 0).length * 20 > len * 0.25) return false;
    if (riverCrossings(line).length > 0) return false;
    // Near IGN: a spur only — no point of it within 80 m of a road other than its parent (but its first 120 m).
    if (line.some((p) => Math.hypot(p.x, p.y) < NEAR_IGN_M)) {
      const parentId = roadId[junctionCell]!;
      for (const p of resample(line, 20).slice(7)) {
        const i = cellOf(p.x, p.y);
        if (roadDist[i]! < 80 && roadId[i] !== parentId) {
          for (let dr = -4; dr <= 4; dr++) for (let dc = -4; dc <= 4; dc++) {
            const k = i + dr * GN + dc;
            if (k >= 0 && k < GN * GN && roadId[k]! >= 0 && roadId[k] !== parentId) return false;
          }
        }
      }
    }
    const id = roads.length;
    roads.push({ cls, line });
    addToGrid(line, id);
    if (deadEnd) {
      const a = line[line.length - 2]!;
      const b = line[line.length - 1]!;
      ends.push({ x: b.x, y: b.y, cls, heading: bearingOf(b.x - a.x, b.y - a.y) });
    }
    return true;
  };

  // Farm access roads (III b): from each farmstead to the nearest road.
  for (const f of FARMS) {
    const i = cellOf(f.x, f.y);
    if (roadDist[i]! > 40) grow(i, "gravel", 0, 3000, false);
  }

  /** Coverage: repeatedly the forest cell farthest from any road gets a road, until none is farther than `gapM`. */
  const cover = (cls: "forest" | "track", gapM: number, minLen: number, maxLen: number, maxCount: number, salt: number) => {
    const tried = new Uint8Array(GN * GN);
    let made = 0;
    for (let guard = 0; guard < maxCount * 6 && made < maxCount; guard++) {
      let best = -1;
      let bd = gapM;
      for (let r = 4; r < GN - 4; r += 3) for (let c = 4; c < GN - 4; c += 3) {
        const i = r * GN + c;
        if (roadDist[i]! <= bd || tried[i] || LAKE_ID[i]! >= 0 || MIRE[i] || STREAM_CELL[i]! >= 0) continue;
        const x = cellX(c);
        const y = cellY(r);
        // The designed roads serve the fire's own ground; within 1.6 km only tracks (which do not enter the fuel grid), none
        // within 0.9 km.
        if (Math.hypot(x, y) < (cls === "track" ? 900 : 1600)) continue;
        bd = roadDist[i]!;
        best = i;
      }
      if (best < 0) break;
      // Blank out the neighbourhood so a failed target is not retried endlessly.
      for (let dr = -6; dr <= 6; dr++) for (let dc = -6; dc <= 6; dc++) { const k = best + dr * GN + dc; if (k >= 0 && k < GN * GN) tried[k] = 1; }
      // Jitter the end point a little (not every road ends exactly at the gap's centre).
      const jx = (hash2(best, salt, 7001) - 0.5) * 120;
      const jy = (hash2(best, salt, 7003) - 0.5) * 120;
      const p = cellP(best);
      const s = cellOf(Math.max(-HALF_M + 30, Math.min(HALF_M - 30, p.x + jx)), Math.max(-HALF_M + 30, Math.min(HALF_M - 30, p.y + jy)));
      const target = LAKE_ID[s]! >= 0 || MIRE[s] ? best : s;
      if (grow(target, cls, minLen, maxLen, true)) made++;
    }
  };
  cover("forest", 650, 350, 6500, 170, 1);

  // One network: each part not yet joined to the maantie's (the north, behind the river) is linked to it by a forest road along the
  // cheapest route between them. A forest road, so the public (main and gravel) network keeps its one river crossing near IGN.
  for (let guard = 0; guard < 4; guard++) {
    const comp = new Int32Array(GN * GN).fill(-1);
    let nComp = 0;
    for (let s = 0; s < GN * GN; s++) {
      if (roadId[s]! < 0 || comp[s]! >= 0) continue;
      const stack = [s];
      comp[s] = nComp;
      while (stack.length > 0) {
        const i = stack.pop()!;
        const r = Math.floor(i / GN);
        const c = i % GN;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= GN || cc >= GN) continue;
          const j = rr * GN + cc;
          if (roadId[j]! >= 0 && comp[j]! < 0) { comp[j] = nComp; stack.push(j); }
        }
      }
      nComp++;
    }
    const mainComp = comp[cellOf(MAANTIE_S[0]!.x + 30, MAANTIE_S[0]!.y)]!;
    const others = new Map<number, number[]>();
    for (let i = 0; i < GN * GN; i++) if (comp[i]! >= 0 && comp[i] !== mainComp) (others.get(comp[i]!) ?? others.set(comp[i]!, []).get(comp[i]!)!).push(i);
    const largest = [...others.entries()].sort((a, b) => b[1].length - a[1].length || a[0] - b[0])[0];
    if (!largest || largest[1].length < 5) break;
    // Dry ground first (mires much dearer), so the link keeps to firm land like any forest road.
    const dry = terrainCost("forest", false, 14);
    const cells = route((i) => (roadId[i]! >= 0 ? 0.25 : dry[i]! + (inField[i] ? 0.6 : 0)), largest[1], (i) => comp[i] === mainComp);
    if (!cells) break;
    const from = roads[roadId[cells[0]!]!]!;
    const to = roads[roadId[cells[cells.length - 1]!]!]!;
    const a = closestOnPolyline(cellP(cells[0]!).x, cellP(cells[0]!).y, from.line);
    const b = closestOnPolyline(cellP(cells[cells.length - 1]!).x, cellP(cells[cells.length - 1]!).y, to.line);
    let line = roadLine(cells.slice(1, -1), undefined, undefined, 12);
    line = straightenCrossings(squareJunction([a, ...line, b], from.line, 60), (p) => mireAt(p.x, p.y) !== 0, (p) => lakeAt(p.x, p.y) !== undefined, 400);
    const id = roads.length;
    roads.push({ cls: "forest", line });
    addToGrid(line, id);
  }
  cover("track", 440, 200, 1300, 170, 2);

  // Lake-shore cottages (none within NEAR_IGN_M + 900 m: SPEC/23 §13): one to three per lake ≥ 8 ha, each with a track.
  const rng = new Mulberry32(0xc077a6e);
  for (const lake of LAKES) {
    if (lake.big || lake.areaHa < 8) continue;
    const n = 1 + Math.floor(rng.nextFloat() * Math.min(3, lake.areaHa / 25));
    for (let k = 0; k < n; k++) {
      const bearing = rng.nextFloat() * 360;
      // Walk in from outside to the shore along this bearing.
      let edge: P | null = null;
      for (let s = lake.r * 3 + 400; s >= 0; s -= 10) {
        const q = polar(bearing, s);
        if (lakeAt(lake.cx + q.x, lake.cy + q.y)?.id === lake.id) { const b = polar(bearing, s + 10); edge = { x: lake.cx + b.x, y: lake.cy + b.y }; break; }
      }
      if (!edge) continue;
      const back = polar(bearing, 35);
      const c = { x: edge.x + back.x, y: edge.y + back.y };
      if (Math.hypot(c.x, c.y) < 4500 || Math.abs(c.x) > HALF_M - 50 || Math.abs(c.y) > HALF_M - 50) continue;
      if (mireAt(c.x, c.y) !== 0 || lakeAt(c.x, c.y) || cottages.some((q) => Math.hypot(q.x - c.x, q.y - c.y) < 250)) continue;
      const ci = cellOf(c.x, c.y);
      if (roadDist[ci]! > 40 && !grow(ci, "track", 0, 1600, false)) continue;
      cottages.push({ x: c.x, y: c.y, toWater: (bearing + 180) % 360 });
    }
  }

  // Footpaths (polku) down to the shore of lakes that have no cottage, from the nearest road: fishing and berry paths.
  for (const lake of LAKES) {
    if (lake.big || lake.areaHa < 3 || Math.hypot(lake.cx, lake.cy) < 4500) continue;
    if (cottages.some((c) => Math.hypot(c.x - lake.cx, c.y - lake.cy) < lake.r * 2 + 300)) continue;
    const bearing = rng.nextFloat() * 360;
    let edge: P | null = null;
    for (let s = lake.r * 3 + 400; s >= 0; s -= 10) {
      const q = polar(bearing, s);
      if (lakeAt(lake.cx + q.x, lake.cy + q.y)?.id === lake.id) { const b = polar(bearing, s + 25); edge = { x: lake.cx + b.x, y: lake.cy + b.y }; break; }
    }
    if (!edge || Math.abs(edge.x) > HALF_M - 50 || Math.abs(edge.y) > HALF_M - 50 || mireAt(edge.x, edge.y) !== 0) continue;
    const ei = cellOf(edge.x, edge.y);
    if (roadDist[ei]! > 60 && roadDist[ei]! < 900) grow(ei, "path", 80, 1100, false);
  }

  // Mökkiranta: a track either way along the cottage row from the road's end, 60 m behind the shore.
  const karhu = LAKES.find((l) => l.name === "Karhujärvi")!;
  /** Out from the lake's inside point on bearing `b` to the first dry ground, then `back` m on. */
  const behindShore = (b: number, back: number): P => {
    for (let s = 0; s < 1500; s += 5) {
      const q = polar(b, s);
      if (lakeAt(karhu.cx + q.x, karhu.cy + q.y)?.id !== karhu.id) { const o = polar(b, s + back); return { x: karhu.cx + o.x, y: karhu.cy + o.y }; }
    }
    return MOKKIRANTA_JUNCTION;
  };
  const base = bearingOf(MOKKIRANTA_JUNCTION.x - karhu.cx, MOKKIRANTA_JUNCTION.y - karhu.cy);
  const shoreArm = (sign: 1 | -1): P[] => {
    const pts: P[] = [MOKKIRANTA_JUNCTION];
    for (const k of [1, 2, 3, 4, 5]) {
      const p = behindShore(base + sign * 7 * k, 70);
      // The arm ends where a straight stretch to the next cottage would cut a bay of the lake or cross a mire.
      const wet = (q: P) => [[0, 0], [25, 0], [-25, 0], [0, 25], [0, -25]].some(([dx, dy]) => lakeAt(q.x + dx!, q.y + dy!));
      if (resample([pts[pts.length - 1]!, p], 5).some((q) => wet(q) || mireAt(q.x, q.y) !== 0)) break;
      pts.push(p);
    }
    return resample(pts, 20);
  };
  const MOKKIRANTA_TRACKS: Road[] = [{ cls: "track", line: shoreArm(1) }, { cls: "track", line: shoreArm(-1) }];
  return { roads: [...roads, ...MOKKIRANTA_TRACKS], ends, cottages };
}

const NET = buildNetwork();
/** Every road: FIXED_ROADS (0–9), the Honkaharju forest road (10, id "honkaharju"), the generated roads, the Mökkiranta tracks. */
export const ROADS: readonly Road[] = NET.roads;
export const ROAD_ENDS: readonly RoadEnd[] = NET.ends;
export const COTTAGES: readonly Cottage[] = NET.cottages;

/** The road the scenario names by `id` (SPEC/33 §3: a stable name, not an index). */
export function roadById(id: string): Road {
  const r = ROADS.find((x) => x.id === id);
  if (!r) throw new Error(`roads: no road with id "${id}"`);
  return r;
}
/** Index in ROADS (and topo-features.json `roads`) of the road named `id`. */
export const roadIndexById = (id: string): number => ROADS.indexOf(roadById(id));

/** Bridges: every place a main or gravel road crosses Kotkanjoki (BRIDGE and BRIDGE_S among them). */
export const BRIDGES: readonly P[] = (() => {
  const out = ROADS.filter((r) => r.cls === "main" || r.cls === "gravel").flatMap((r) => riverCrossings(r.line));
  for (const must of [BRIDGE, BRIDGE_S]) if (!out.some((b) => Math.hypot(b.x - must.x, b.y - must.y) < 30)) out.push(must);
  return out;
})();
/** Forest roads, tracks or paths crossing the river — none by construction. */
export const UNBRIDGED_CROSSINGS: readonly { readonly cls: RoadClass; readonly at: P }[] = ROADS
  .filter((r) => r.cls !== "main" && r.cls !== "gravel")
  .flatMap((r) => riverCrossings(r.line).map((at) => ({ cls: r.cls, at })));
