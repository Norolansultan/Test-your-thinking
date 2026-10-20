/**
 * Drives on the truck-road graph (SPEC/33 gate R, review R1/R4, 20 Oct 2026). The water shuttle's times were the straight line
 * × 1.4 (`traffic-water.ts` `ROAD_DETOUR`), which on the rebuilt map promised legs 4–10 min shorter than any road allows (the
 * Honkaharju forest road reaches W1 only by R1 → R2 → its east end). Every drive now runs on the roads a fire engine or tanker can
 * use (`TRUCK_ROADS`: the maantie, gravel roads, forest roads — the Koivuoja link included, which is a road to drive, not to park
 * on), with the 16 t timber bridge on R3 closed (a loaded tanker is over its limit, as OUT1/OUT2 find at step 16).
 *
 * The graph is the contract check's (`contract-geom.ts` `roadGraph`, the same join and cut distances as `road_route`), so a
 * drive time here and a `travel_time.*` relation in `contract.json` measure the same road. Routes are cached by their end
 * points (rounded to the metre): the same drive asked twice gives the same answer at no cost.
 */

import { BRIDGE, ROADS } from "../topo-map/roads.js";
import { roadGraph, roadPath, type RoadGraph } from "../topo-map/checks/contract-geom.js";
import { TRUCK_ROADS, type P } from "./deployment.js";

/** The contract check's graph parameters (`contract.ts` `graphFor`): nodes every 20 m, lines joined within 50 m, the cut 40 m round. */
const STEP_M = 20;
const JOIN_M = 50;
const CUT_M = 40;

let graph: RoadGraph | null = null;
const cache = new Map<string, { readonly m: number; readonly path: readonly P[] }>();

function truckGraph(): RoadGraph {
  if (!graph) graph = roadGraph(ROADS.filter((r) => TRUCK_ROADS.has(r.cls)).map((r) => r.line), STEP_M, JOIN_M, [BRIDGE], CUT_M);
  return graph;
}

/** The drive from `a` to `b` on the truck roads, the bridge closed: its length (m, with the short legs off the road at each end) and its route. */
export function truckRoute(a: P, b: P): { readonly m: number; readonly path: readonly P[] } {
  const key = `${Math.round(a.x)},${Math.round(a.y)}>${Math.round(b.x)},${Math.round(b.y)}`;
  let r = cache.get(key);
  if (!r) {
    r = roadPath(truckGraph(), a, b);
    if (!Number.isFinite(r.m)) throw new Error(`no truck road from (${Math.round(a.x)}, ${Math.round(a.y)}) to (${Math.round(b.x)}, ${Math.round(b.y)})`);
    cache.set(key, r);
  }
  return r;
}

/** The point a share `f` (0–1) of the way along a route, by length. */
export function alongRoute(path: readonly P[], f: number): P {
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y); segs.push(d); total += d; }
  let left = Math.min(1, Math.max(0, f)) * total;
  for (let i = 0; i < segs.length; i++) {
    const d = segs[i]!;
    if (left <= d || i === segs.length - 1) {
      const a = path[i]!, b = path[i + 1]!, k = d > 0 ? Math.min(1, left / d) : 0;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    left -= d;
  }
  return path[path.length - 1]!;
}
