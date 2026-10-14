/**
 * The game world's road graph (`tools/game/build-world.ts`): the topographic map's road polylines turned into
 * nodes and edges in local metres.
 *
 *  1. Roads get a vertex where they cross the kept box's edge (the grid plus margin), and main and gravel roads one
 *     where they cross the playable area's edge (the entry nodes).
 *  2. Vertices are thinned (Douglas–Peucker) and long straight stretches cut into ≤ `maxEdgeM` edges.
 *  3. Junctions: a road's own end within `snapM` of another road joins it there (T-junction); roads that cross
 *     get a shared vertex at the crossing; a main or gravel road's dead end within `connectM` of another main or
 *     gravel road is linked to it (R2 ends 47 m short of the maantie in Lahdenkylä).
 *  4. Points within `mergeM` of each other become one node (first come, lowest id).
 *  5. The graph keeps what lies inside the kept box, plus — so that no stretch inside is cut off — the shortest
 *     outside road (≤ `maxLinkM`) joining each otherwise separate stretch to the network around `anchor` (forest
 *     roads in the north leave from the main road 1–2 km beyond the margin).
 *
 * Everything runs in input order with explicit tie-breaks, so the graph is the same on every run.
 */

import type { RoadClass } from "../../../app/game/contracts.js";
import { ROAD_CLASSES } from "../../../app/game/world/format.js";
import { clipLine, dist, intersect, lerp, project, simplify, type Box, type Pt } from "./geom.js";

export interface RoadLine { readonly cls: RoadClass; readonly pts: readonly Pt[] }

export interface RoadGraphOptions {
  /** Roads are read inside this box (the whole map). */
  readonly outer: Box;
  /** The graph keeps the roads inside this box (the grid plus margin) … */
  readonly keep: Box;
  /** … and the outside roads that link a stretch inside to the network around `anchor`, each ≤ `maxLinkM`. */
  readonly anchor: Pt;
  readonly maxLinkM: number;
  /** The playable area: main/gravel roads crossing its edge give entry nodes. */
  readonly playable: Box;
  readonly simplifyM: number;
  readonly mergeM: number;
  readonly snapM: number;
  readonly connectM: number;
  readonly maxEdgeM: number;
}

export interface BuiltRoadGraph {
  readonly nodes: readonly Pt[];
  readonly edges: readonly { readonly a: number; readonly b: number; readonly cls: RoadClass }[];
  /** Nodes where a main or gravel road crosses the playable area's edge, with the road's class. */
  readonly edgeCrossings: readonly { readonly node: number; readonly cls: RoadClass }[];
  readonly stats: {
    readonly tJunctions: number; readonly crossings: number; readonly connectors: number;
    /** Outside links added, their total length, and stretches inside left unlinked (none within `maxLinkM`). */
    readonly links: number; readonly linkM: number; readonly unlinked: number;
  };
}

interface V extends Pt { readonly forced: boolean; readonly entry: boolean }
interface Piece { readonly cls: RoadClass; pts: V[]; readonly ownStart: boolean; readonly ownEnd: boolean }
interface Split { readonly t: number; readonly p: Pt }
type Edge = { a: number; b: number; cls: RoadClass };

const EPS = 1e-6;
const rank = (cls: RoadClass) => ROAD_CLASSES.indexOf(cls);
const trunk = (cls: RoadClass) => cls === "main" || cls === "gravel";
const v = (p: Pt, forced = false, entry = false): V => ({ x: p.x, y: p.y, forced, entry });
const within = (p: Pt, b: Box) => p.x >= b.x0 - EPS && p.x <= b.x1 + EPS && p.y >= b.y0 - EPS && p.y <= b.y1 + EPS;
const onEdgeOf = (p: Pt, b: Box) => within(p, b) && (Math.abs(p.x - b.x0) < EPS || Math.abs(p.x - b.x1) < EPS || Math.abs(p.y - b.y0) < EPS || Math.abs(p.y - b.y1) < EPS);

/**
 * Forces a vertex wherever the line meets the box's edge: vertices lying on it are marked, and a vertex is put in
 * where a segment crosses it. `entry` marks them as entry points too.
 */
function markBoxEdge(pts: readonly V[], box: Box, entry: boolean): V[] {
  const mark = (p: V) => (onEdgeOf(p, box) ? v(p, true, entry || p.entry) : p);
  const out: V[] = [mark(pts[0]!)];
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1]!;
    const b = pts[k]!;
    const ts: number[] = [];
    for (const x of [box.x0, box.x1]) if (b.x !== a.x) ts.push((x - a.x) / (b.x - a.x));
    for (const y of [box.y0, box.y1]) if (b.y !== a.y) ts.push((y - a.y) / (b.y - a.y));
    for (const t of ts.filter((t) => t > EPS && t < 1 - EPS).sort((p, q) => p - q)) {
      const p = lerp(a, b, t);
      if (within(p, box)) out.push(v(p, true, entry));
    }
    out.push(mark(b));
  }
  return out;
}

/** Thins a piece between its forced vertices, then cuts long edges. */
function thin(pts: readonly V[], tol: number, maxEdgeM: number): V[] {
  const out: V[] = [];
  let start = 0;
  for (let k = 1; k < pts.length; k++) {
    if (!pts[k]!.forced && k !== pts.length - 1) continue;
    const run = simplify(pts.slice(start, k + 1), tol);
    out.push(...(out.length > 0 ? run.slice(1) : run));
    start = k;
  }
  const dense: V[] = [out[0]!];
  for (let k = 1; k < out.length; k++) {
    const a = out[k - 1]!;
    const b = out[k]!;
    const n = Math.ceil(dist(a, b) / maxEdgeM);
    for (let s = 1; s < n; s++) dense.push(v(lerp(a, b, s / n)));
    dense.push(b);
  }
  return dense;
}

/** A spatial hash of segments (piece, segment index). */
class SegmentIndex {
  private readonly cells = new Map<number, [number, number][]>();
  constructor(private readonly pieces: readonly Piece[], private readonly size: number) {
    pieces.forEach((pc, pi) => {
      for (let si = 0; si + 1 < pc.pts.length; si++) {
        const a = pc.pts[si]!;
        const b = pc.pts[si + 1]!;
        for (const k of this.keys(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y))) {
          const list = this.cells.get(k);
          if (list) list.push([pi, si]); else this.cells.set(k, [[pi, si]]);
        }
      }
    });
  }
  private keys(x0: number, y0: number, x1: number, y1: number): number[] {
    const out: number[] = [];
    for (let cx = Math.floor(x0 / this.size); cx <= Math.floor(x1 / this.size); cx++) {
      for (let cy = Math.floor(y0 / this.size); cy <= Math.floor(y1 / this.size); cy++) out.push(cx * 1_000_003 + cy);
    }
    return out;
  }
  /** Segments whose cells meet the box around `p` (± r), unique, by (piece, segment). */
  near(p: Pt, r: number): [number, number][] {
    const seen = new Set<number>();
    const out: [number, number][] = [];
    for (const k of this.keys(p.x - r, p.y - r, p.x + r, p.y + r)) {
      for (const [pi, si] of this.cells.get(k) ?? []) {
        const id = pi * 1_000_003 + si;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push([pi, si]);
      }
    }
    return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  segment(pi: number, si: number): [Pt, Pt] {
    const pts = this.pieces[pi]!.pts;
    return [pts[si]!, pts[si + 1]!];
  }
}

/** Step 3: T-junction moves, crossing and connector split points, connector edges. */
function junctions(pieces: Piece[], o: RoadGraphOptions) {
  const splits: Split[][][] = pieces.map((pc) => pc.pts.slice(1).map(() => []));
  const connectors: [Pt, Pt, RoadClass][] = [];
  let tJunctions = 0;
  const index = new SegmentIndex(pieces, 100);
  const moves: [number, number, Pt][] = [];
  pieces.forEach((pc, pi) => {
    const ends: [number, boolean][] = [[0, pc.ownStart], [pc.pts.length - 1, pc.ownEnd]];
    for (const [vi, own] of ends) {
      if (!own) continue;
      const e = pc.pts[vi]!;
      type Hit = { pi: number; si: number; t: number; q: Pt; d: number };
      let best: Hit | null = null;
      let bestTrunk: Hit | null = null;
      for (const [pj, sj] of index.near(e, Math.max(o.snapM, o.connectM))) {
        if (pj === pi) continue;
        const [a, b] = index.segment(pj, sj);
        const pr = project(e, a, b);
        if (pr.d <= o.snapM && (!best || pr.d < best.d)) best = { pi: pj, si: sj, ...pr };
        if (trunk(pieces[pj]!.cls) && pr.d <= o.connectM && (!bestTrunk || pr.d < bestTrunk.d)) bestTrunk = { pi: pj, si: sj, ...pr };
      }
      if (best) {
        splits[best.pi]![best.si]!.push({ t: best.t, p: best.q });
        moves.push([pi, vi, best.q]);
        tJunctions++;
      } else if (bestTrunk && trunk(pc.cls)) {
        splits[bestTrunk.pi]![bestTrunk.si]!.push({ t: bestTrunk.t, p: bestTrunk.q });
        connectors.push([e, bestTrunk.q, pc.cls]);
      }
    }
  });
  for (const [pi, vi, q] of moves) {
    const old = pieces[pi]!.pts[vi]!;
    pieces[pi]!.pts[vi] = { x: q.x, y: q.y, forced: old.forced, entry: old.entry };
  }

  // Crossings, on the moved geometry.
  let crossings = 0;
  const moved = new SegmentIndex(pieces, 100);
  const inner = (t: number) => t > 1e-9 && t < 1 - 1e-9;
  pieces.forEach((pc, pi) => {
    for (let si = 0; si + 1 < pc.pts.length; si++) {
      const a = pc.pts[si]!;
      const b = pc.pts[si + 1]!;
      for (const [pj, sj] of moved.near(lerp(a, b, 0.5), dist(a, b) / 2 + 1)) {
        if (pj < pi || (pj === pi && sj <= si + 1)) continue;
        const [c, d] = moved.segment(pj, sj);
        const x = intersect(a, b, c, d);
        if (!x || (!inner(x.t) && !inner(x.u))) continue;
        const p = lerp(a, b, x.t);
        if (inner(x.t)) splits[pi]![si]!.push({ t: x.t, p });
        if (inner(x.u)) splits[pj]![sj]!.push({ t: x.u, p });
        crossings++;
      }
    }
  });
  return { splits, connectors, tJunctions, crossings };
}

/** A binary min-heap of [key, node], ordered by key then node id. */
class MinHeap {
  private readonly a: [number, number][] = [];
  get size(): number { return this.a.length; }
  private lt(i: number, j: number): boolean {
    const p = this.a[i]!;
    const q = this.a[j]!;
    return p[0] < q[0] || (p[0] === q[0] && p[1] < q[1]);
  }
  push(key: number, node: number): void {
    this.a.push([key, node]);
    for (let i = this.a.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (!this.lt(i, p)) break;
      [this.a[i], this.a[p]] = [this.a[p]!, this.a[i]!];
      i = p;
    }
  }
  pop(): [number, number] {
    const top = this.a[0]!;
    const last = this.a.pop()!;
    if (this.a.length > 0) {
      this.a[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1;
        let m = i;
        if (l < this.a.length && this.lt(l, m)) m = l;
        if (l + 1 < this.a.length && this.lt(l + 1, m)) m = l + 1;
        if (m === i) break;
        [this.a[i], this.a[m]] = [this.a[m]!, this.a[i]!];
        i = m;
      }
    }
    return top;
  }
}

/** Step 5: which edges stay — those inside `keep`, and the outside links that join each inside stretch to the anchor's. */
function selectEdges(nodes: readonly Pt[], edges: readonly Edge[], o: RoadGraphOptions) {
  const n = nodes.length;
  const core = nodes.map((p) => within(p, o.keep));
  const kept = edges.map((e) => core[e.a]! && core[e.b]!);
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]!]!; i = parent[i]!; }
    return i;
  };
  const union = (a: number, b: number) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb); };
  const used = new Uint8Array(n);
  edges.forEach((e, i) => { if (kept[i]) { union(e.a, e.b); used[e.a] = 1; used[e.b] = 1; } });
  const adj: [number, number][][] = nodes.map(() => []);
  edges.forEach((e, i) => { adj[e.a]!.push([e.b, i]); adj[e.b]!.push([e.a, i]); });

  let anchor = -1;
  for (let i = 0; i < n; i++) if (used[i] && (anchor < 0 || dist(nodes[i]!, o.anchor) < dist(nodes[anchor]!, o.anchor))) anchor = i;
  let links = 0, linkM = 0, unlinked = 0;
  const tried = new Set<number>();
  for (let s = 0; s < n; s++) {
    if (!used[s] || find(s) === find(anchor) || tried.has(find(s))) continue;
    const root = find(s);
    tried.add(root);
    // Dijkstra from the whole stretch to the nearest node already joined to the anchor's network.
    const d = new Float64Array(n).fill(Infinity);
    const via = new Int32Array(n).fill(-1);
    const heap = new MinHeap();
    for (let i = 0; i < n; i++) if (used[i] && find(i) === root) { d[i] = 0; heap.push(0, i); }
    let hit = -1;
    while (heap.size > 0) {
      const [du, u] = heap.pop();
      if (du > d[u]! || du > o.maxLinkM) continue;
      if (used[u] && find(u) === find(anchor)) { hit = u; break; }
      for (const [w, ei] of adj[u]!) {
        const dw = du + dist(nodes[u]!, nodes[w]!);
        if (dw < d[w]!) { d[w] = dw; via[w] = ei; heap.push(dw, w); }
      }
    }
    if (hit < 0) { unlinked++; continue; }
    links++;
    linkM += d[hit]!;
    for (let u = hit; via[u]! >= 0;) {
      const ei = via[u]!;
      const e = edges[ei]!;
      kept[ei] = true;
      used[e.a] = 1; used[e.b] = 1;
      union(e.a, e.b);
      u = e.a === u ? e.b : e.a;
    }
  }
  return { kept, links, linkM, unlinked };
}

/** 1 for every node connected to `start` (over all edges). */
export function reachableFrom(nodeCount: number, edges: readonly { readonly a: number; readonly b: number }[], start: number): Uint8Array {
  const adj: number[][] = Array.from({ length: nodeCount }, () => []);
  for (const e of edges) { adj[e.a]!.push(e.b); adj[e.b]!.push(e.a); }
  const seen = new Uint8Array(nodeCount);
  if (start < 0 || start >= nodeCount) return seen;
  seen[start] = 1;
  const stack = [start];
  while (stack.length > 0) for (const w of adj[stack.pop()!]!) if (!seen[w]) { seen[w] = 1; stack.push(w); }
  return seen;
}

export function buildRoadGraph(lines: readonly RoadLine[], o: RoadGraphOptions): BuiltRoadGraph {
  // 1–2. Clip to the map, force vertices on the box edges, thin.
  const pieces: Piece[] = [];
  for (const line of lines) {
    for (const run of clipLine(line.pts, o.outer)) {
      let pts = markBoxEdge(run.pts.map((p) => v(p)), o.keep, false);
      if (trunk(line.cls)) pts = markBoxEdge(pts, o.playable, true);
      pieces.push({ cls: line.cls, pts: thin(pts, o.simplifyM, o.maxEdgeM), ownStart: run.ownStart, ownEnd: run.ownEnd });
    }
  }

  // 3. Junctions.
  const { splits, connectors, tJunctions, crossings } = junctions(pieces, o);

  // 4. Nodes: every vertex and split point, merged within mergeM.
  const nodes: Pt[] = [];
  const hash = new Map<number, number[]>();
  const key = (cx: number, cy: number) => cx * 1_000_003 + cy;
  const nodeAt = (p: Pt): number => {
    const cx = Math.floor(p.x / o.mergeM);
    const cy = Math.floor(p.y / o.mergeM);
    let best = -1;
    let bestD = o.mergeM;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const id of hash.get(key(cx + dx, cy + dy)) ?? []) {
          const d = dist(p, nodes[id]!);
          if (d < bestD || (d === bestD && id < best)) { bestD = d; best = id; }
        }
      }
    }
    if (best >= 0) return best;
    const id = nodes.length;
    nodes.push({ x: p.x, y: p.y });
    const k = key(cx, cy);
    const list = hash.get(k);
    if (list) list.push(id); else hash.set(k, [id]);
    return id;
  };
  const edgeByKey = new Map<string, number>();
  const edges: Edge[] = [];
  const entryCls = new Map<number, RoadClass>();
  const addEdge = (a: number, b: number, cls: RoadClass) => {
    if (a === b) return;
    const k = a < b ? `${a}:${b}` : `${b}:${a}`;
    const at = edgeByKey.get(k);
    if (at === undefined) { edgeByKey.set(k, edges.length); edges.push({ a, b, cls }); }
    else if (rank(cls) < rank(edges[at]!.cls)) edges[at] = { ...edges[at]!, cls };
  };
  pieces.forEach((pc, pi) => {
    const seq: number[] = [];
    pc.pts.forEach((p, k) => {
      const id = nodeAt(p);
      seq.push(id);
      if (p.entry) {
        const had = entryCls.get(id);
        if (had === undefined || rank(pc.cls) < rank(had)) entryCls.set(id, pc.cls);
      }
      if (k + 1 < pc.pts.length) {
        const s = [...splits[pi]![k]!].sort((p1, p2) => p1.t - p2.t || p1.p.x - p2.p.x || p1.p.y - p2.p.y);
        for (const sp of s) seq.push(nodeAt(sp.p));
      }
    });
    for (let k = 1; k < seq.length; k++) addEdge(seq[k - 1]!, seq[k]!, pc.cls);
  });
  for (const [a, b, cls] of connectors) addEdge(nodeAt(a), nodeAt(b), cls);

  // 5. Keep the inside and its links; renumber the nodes kept edges use, in order.
  const { kept, links, linkM, unlinked } = selectEdges(nodes, edges, o);
  const used = new Uint8Array(nodes.length);
  edges.forEach((e, i) => { if (kept[i]) { used[e.a] = 1; used[e.b] = 1; } });
  const remap = new Int32Array(nodes.length).fill(-1);
  const outNodes: Pt[] = [];
  nodes.forEach((p, i) => { if (used[i]) { remap[i] = outNodes.length; outNodes.push(p); } });
  const outEdges = edges.filter((_, i) => kept[i]).map((e) => ({ a: remap[e.a]!, b: remap[e.b]!, cls: e.cls }));
  const edgeCrossings = [...entryCls.keys()].filter((id) => used[id]).sort((p, q) => p - q).map((id) => ({ node: remap[id]!, cls: entryCls.get(id)! }));
  return {
    nodes: outNodes,
    edges: outEdges,
    edgeCrossings,
    stats: { tJunctions, crossings, connectors: connectors.length, links, linkM, unlinked },
  };
}
