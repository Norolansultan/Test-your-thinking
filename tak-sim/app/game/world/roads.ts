/**
 * Game mode (SPEC/29): driving on the road network.
 *
 * `routeOnRoads` finds the quickest way from a point to a point: an off-road leg from the start to a road node, A*
 * over the road graph, and an off-road leg from a road node to the goal (or one off-road leg straight there when that
 * is quicker). Off-road legs are timed cell by cell along their line: open ground is quicker than spruce or bog
 * (`terrainSpeedFactor`), and water stops them. Classes the unit's speed table leaves out (or gives 0) are closed
 * to it, so an engine with no `path` speed never drives a footpath.
 *
 * Deterministic: the open set is ordered by (estimate, node id), candidate nodes by (distance, id), and every
 * distance is `Math.sqrt` arithmetic.
 */

import { FUEL, type GameWorld, type RoadClass, type RoadGraph, type XY } from "../contracts.js";
import { cellOf, distance } from "./grid.js";

/** Road speeds by class, km/h. A class left out, or at 0, is closed. */
export type SpeedTable = Readonly<Partial<Record<RoadClass, number>>>;

export interface RouteOptions {
  /** Off-road speed on open, level ground, km/h; scaled per cell by `terrainSpeedFactor`. Default 5. */
  readonly offRoadKmh?: number;
  /** The longest off-road leg considered, m (to or from the road, or straight to the goal). Default 2000. */
  readonly maxOffRoadM?: number;
}

export interface RoadRoute {
  /** From the start, along the road nodes, to the goal. */
  readonly path: readonly XY[];
  /** The road nodes driven, in order (empty for a straight off-road leg). */
  readonly nodes: readonly number[];
  readonly lengthM: number;
  readonly durationS: number;
  /** The part of `lengthM` driven off-road. */
  readonly offRoadM: number;
}

/** Off the 400 × 400 grid (the road margin): assume mixed forest. */
const OFF_GRID_FACTOR = 0.5;
const SPEED_FACTOR: Readonly<Record<number, number>> = {
  [FUEL.water]: 0,
  [FUEL.road_gravel]: 1,
  [FUEL.field]: 1,
  [FUEL.pine_heath]: 0.7,
  [FUEL.spruce_mature]: 0.4,
  [FUEL.spruce_thinned]: 0.55,
  [FUEL.birch_aspen]: 0.55,
  [FUEL.drained_peat]: 0.45,
  [FUEL.cleared_corridor]: 0.9,
  [FUEL.built]: 0.8,
  [FUEL.open_bog]: 0.25,
  [FUEL.road_forest]: 1,
  [FUEL.brook]: 0.2,
};

/**
 * Off-road speed on a fuel type as a fraction of open ground: 1 on fields and road verges, ~0.7 on pine heath,
 * 0.4 in mature spruce, 0.25 on open bog, 0.2 across a brook, 0 (impassable) on water.
 */
export function terrainSpeedFactor(fuel: number): number {
  return SPEED_FACTOR[fuel] ?? OFF_GRID_FACTOR;
}

// ---------------------------------------------------------------------------
// Graph indexes (built once per graph, cached)
// ---------------------------------------------------------------------------

const BUCKET_M = 250;

interface GraphIndex {
  /** Per node: [neighbour, edge index] pairs, by neighbour id then edge index. */
  readonly adj: readonly (readonly (readonly [number, number])[])[];
  /** Per node: the classes of its edges (bit per `RoadClass`). */
  readonly classMask: Uint8Array;
  readonly buckets: Map<number, number[]>;
  readonly bx0: number;
  readonly by0: number;
  /** Connected components over the edges whose class is open in a mask, by mask. */
  readonly components: Map<number, Int32Array>;
}

const CLASS_BIT: Readonly<Record<RoadClass, number>> = { main: 1, gravel: 2, forest: 4, track: 8, path: 16 };
const CLASSES: readonly RoadClass[] = ["main", "gravel", "forest", "track", "path"];
const indexes = new WeakMap<RoadGraph, GraphIndex>();
const bucketKey = (bx: number, by: number) => bx * 100_003 + by;

function indexOf(g: RoadGraph): GraphIndex {
  const hit = indexes.get(g);
  if (hit) return hit;
  const adj: (readonly [number, number])[][] = g.nodes.map(() => []);
  const classMask = new Uint8Array(g.nodes.length);
  g.edges.forEach((e, i) => {
    adj[e.a]!.push([e.b, i]);
    adj[e.b]!.push([e.a, i]);
    classMask[e.a] = classMask[e.a]! | CLASS_BIT[e.cls];
    classMask[e.b] = classMask[e.b]! | CLASS_BIT[e.cls];
  });
  for (const list of adj) list.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  let bx0 = Infinity;
  let by0 = Infinity;
  for (const p of g.nodes) { bx0 = Math.min(bx0, p.x); by0 = Math.min(by0, p.y); }
  const buckets = new Map<number, number[]>();
  g.nodes.forEach((p, id) => {
    const k = bucketKey(Math.floor((p.x - bx0) / BUCKET_M), Math.floor((p.y - by0) / BUCKET_M));
    const list = buckets.get(k);
    if (list) list.push(id); else buckets.set(k, [id]);
  });
  const idx: GraphIndex = { adj, classMask, buckets, bx0, by0, components: new Map() };
  indexes.set(g, idx);
  return idx;
}

/** Component id per node over the edges of the open classes (−1: a node with no open edge). */
function componentsOf(g: RoadGraph, idx: GraphIndex, mask: number): Int32Array {
  const hit = idx.components.get(mask);
  if (hit) return hit;
  const comp = new Int32Array(g.nodes.length).fill(-1);
  let next = 0;
  for (let s = 0; s < g.nodes.length; s++) {
    if (comp[s]! >= 0 || (idx.classMask[s]! & mask) === 0) continue;
    comp[s] = next;
    const stack = [s];
    while (stack.length > 0) {
      const u = stack.pop()!;
      for (const [w, ei] of idx.adj[u]!) {
        if (comp[w]! < 0 && (CLASS_BIT[g.edges[ei]!.cls] & mask) !== 0) { comp[w] = next; stack.push(w); }
      }
    }
    next++;
  }
  idx.components.set(mask, comp);
  return comp;
}

function maskOf(classes: readonly RoadClass[]): number {
  let m = 0;
  for (const c of classes) m |= CLASS_BIT[c];
  return m;
}

/** Nodes within `radiusM` of `xy` that touch a class in `mask`, by (distance, id). */
function nodesWithin(g: RoadGraph, idx: GraphIndex, xy: XY, radiusM: number, mask: number): { id: number; d: number }[] {
  const out: { id: number; d: number }[] = [];
  const bxA = Math.floor((xy.x - radiusM - idx.bx0) / BUCKET_M);
  const bxB = Math.floor((xy.x + radiusM - idx.bx0) / BUCKET_M);
  const byA = Math.floor((xy.y - radiusM - idx.by0) / BUCKET_M);
  const byB = Math.floor((xy.y + radiusM - idx.by0) / BUCKET_M);
  if (!((bxB - bxA + 1) * (byB - byA + 1) <= g.nodes.length)) {
    // A circle wider than the network (or an infinite one): scan every node instead of every bucket.
    g.nodes.forEach((p, id) => {
      if ((idx.classMask[id]! & mask) === 0) return;
      const d = distance(xy, p);
      if (d <= radiusM) out.push({ id, d });
    });
    return out.sort((p, q) => p.d - q.d || p.id - q.id);
  }
  for (let bx = bxA; bx <= bxB; bx++) {
    for (let by = byA; by <= byB; by++) {
      for (const id of idx.buckets.get(bucketKey(bx, by)) ?? []) {
        if ((idx.classMask[id]! & mask) === 0) continue;
        const d = distance(xy, g.nodes[id]!);
        if (d <= radiusM) out.push({ id, d });
      }
    }
  }
  return out.sort((p, q) => p.d - q.d || p.id - q.id);
}

/**
 * The road node nearest `xy` (ties: lowest id), or null when none lies within `maxM`. `classes` limits it to nodes
 * on a road of those classes.
 */
export function nearestNode(world: Pick<GameWorld, "roads">, xy: XY, maxM = Infinity, classes: readonly RoadClass[] = CLASSES): number | null {
  const g = world.roads;
  const idx = indexOf(g);
  const mask = maskOf(classes);
  // Widen the search ring by ring (nodesWithin scans every node once a ring outgrows the network).
  for (let r = BUCKET_M; ; r *= 2) {
    const radius = Math.min(r, maxM);
    const hits = nodesWithin(g, idx, xy, radius, mask);
    if (hits.length > 0) return hits[0]!.id;
    if (radius >= maxM) return null;
    if (r > 1e7) return nodesWithin(g, idx, xy, Infinity, mask)[0]?.id ?? null;
  }
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/** Seconds to cross from `a` to `b` off-road at `ms` m/s on open ground; Infinity across water. */
function offRoadSeconds(world: Pick<GameWorld, "grid" | "fuel">, a: XY, b: XY, ms: number): number {
  const len = distance(a, b);
  if (len === 0) return 0;
  const step = world.grid.cellM / 5;
  const n = Math.max(1, Math.ceil(len / step));
  let t = 0;
  for (let k = 0; k < n; k++) {
    const f = (k + 0.5) / n;
    const cell = cellOf(world.grid, { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
    const factor = cell < 0 ? OFF_GRID_FACTOR : terrainSpeedFactor(world.fuel[cell]!);
    if (factor <= 0) return Infinity;
    t += len / n / (ms * factor);
  }
  return t;
}

/** A binary heap of [priority, node] ordered by priority, then node id. */
class Heap {
  private readonly items: [number, number][] = [];
  get size(): number { return this.items.length; }
  private less(i: number, j: number): boolean {
    const a = this.items[i]!;
    const b = this.items[j]!;
    return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  }
  private swap(i: number, j: number): void {
    const t = this.items[i]!;
    this.items[i] = this.items[j]!;
    this.items[j] = t;
  }
  push(priority: number, node: number): void {
    this.items.push([priority, node]);
    for (let i = this.items.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): [number, number] {
    const top = this.items[0]!;
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.less(l, m)) m = l;
        if (r < this.items.length && this.less(r, m)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
}

/** How many nodes near each end are tried as the place to join or leave the road. */
const CANDIDATES = 10;
/** … and how many of each other road network (cut off from the nearest) within reach. */
const PER_NETWORK = 3;

/**
 * The quickest route from `from` to `to` for a unit with these road speeds (km/h by class), or null when there is
 * none (both ends cut off by water, or no open road within reach).
 */
export function routeOnRoads(
  world: Pick<GameWorld, "grid" | "fuel" | "roads">,
  from: XY,
  to: XY,
  speedKmhByClass: SpeedTable,
  opts: RouteOptions = {},
): RoadRoute | null {
  const g = world.roads;
  const idx = indexOf(g);
  const offMs = (opts.offRoadKmh ?? 5) / 3.6;
  const maxOff = opts.maxOffRoadM ?? 2000;
  const speedMs = (cls: RoadClass) => Math.max(0, speedKmhByClass[cls] ?? 0) / 3.6;
  let open = 0;
  let vmax = offMs;
  for (const c of CLASSES) if (speedMs(c) > 0) { open |= CLASS_BIT[c]; vmax = Math.max(vmax, speedMs(c)); }
  if (vmax <= 0) return null;

  // Where to join or leave the road: the nearest few nodes, and the nearest few of every other network in reach (a
  // stretch of forest road cut off from the rest must not trap a unit standing on it; a lake may block the very
  // nearest). With nothing in reach, the same over every node, however far.
  const comp = componentsOf(g, idx, open);
  const ends = (p: XY) => {
    let near = nodesWithin(g, idx, p, maxOff, open);
    if (near.length === 0) {
      near = [];
      g.nodes.forEach((q, id) => { if ((idx.classMask[id]! & open) !== 0) near.push({ id, d: distance(p, q) }); });
      near.sort((a, b) => a.d - b.d || a.id - b.id);
    }
    const out = near.slice(0, CANDIDATES);
    const perComp = new Map<number, number>();
    for (const c of out) perComp.set(comp[c.id]!, (perComp.get(comp[c.id]!) ?? 0) + 1);
    for (const c of near.slice(CANDIDATES)) {
      const k = perComp.get(comp[c.id]!) ?? 0;
      if (k < PER_NETWORK) { perComp.set(comp[c.id]!, k + 1); out.push(c); }
    }
    return out;
  };
  const offLeg = (a: XY, b: XY) => (offMs > 0 ? offRoadSeconds(world, a, b, offMs) : distance(a, b) === 0 ? 0 : Infinity);

  // The goal side: the time from each candidate node to the goal.
  const goalLeg = new Map<number, number>();
  for (const { id } of ends(to)) {
    const t = offLeg(g.nodes[id]!, to);
    if (t < Infinity) goalLeg.set(id, t);
  }
  let best = distance(from, to) <= maxOff ? offLeg(from, to) : Infinity;
  let bestEnd = -1; // −1: the straight off-road leg

  const n = g.nodes.length;
  const gScore = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const heap = new Heap();
  const h = (id: number) => distance(g.nodes[id]!, to) / vmax;
  for (const { id } of ends(from)) {
    const t = offLeg(from, g.nodes[id]!);
    if (t < gScore[id]!) { gScore[id] = t; heap.push(t + h(id), id); }
  }
  while (heap.size > 0) {
    const [f, u] = heap.pop();
    if (f >= best) break;
    if (closed[u]) continue;
    closed[u] = 1;
    const gu = gScore[u]!;
    const leave = goalLeg.get(u);
    if (leave !== undefined && gu + leave < best) { best = gu + leave; bestEnd = u; }
    for (const [v, ei] of idx.adj[u]!) {
      if (closed[v]) continue;
      const e = g.edges[ei]!;
      const ms = speedMs(e.cls);
      if (ms <= 0) continue;
      const gv = gu + e.lengthM / ms;
      if (gv < gScore[v]!) { gScore[v] = gv; prev[v] = u; heap.push(gv + h(v), v); }
    }
  }
  if (best === Infinity) return null;

  const nodes: number[] = [];
  for (let k = bestEnd; k >= 0; k = prev[k]!) nodes.push(k);
  nodes.reverse();
  const path: XY[] = [from];
  for (const id of nodes) {
    const p = g.nodes[id]!;
    if (distance(path[path.length - 1]!, p) > 0) path.push(p);
  }
  if (distance(path[path.length - 1]!, to) > 0) path.push(to);
  let lengthM = 0;
  for (let k = 1; k < path.length; k++) lengthM += distance(path[k - 1]!, path[k]!);
  const offRoadM = nodes.length === 0 ? lengthM : distance(from, g.nodes[nodes[0]!]!) + distance(g.nodes[nodes[nodes.length - 1]!]!, to);
  return { path, nodes, lengthM, durationS: best, offRoadM };
}
