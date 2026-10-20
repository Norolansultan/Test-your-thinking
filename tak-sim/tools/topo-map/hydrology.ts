/**
 * Grid hydrology for the generated site (SPEC/33 §4 stage 2), on any n × n grid of cell size `cellM` (row 0 south):
 *
 *   priorityFlood   depression filling with an ε gradient, written from Barnes, Lehman & Mulla (2014), "Priority-Flood: an optimal
 *                   depression-filling and watershed-labeling algorithm for digital elevation models", Computers & Geosciences 62,
 *                   Algorithm 3 ("Priority-Flood+ε"): every cell of the filled surface has a strictly lower neighbour, so D8 routing
 *                   crosses flats and filled depressions towards their spill point; an optional per-cell jitter on ε makes the
 *                   route across a flat wander (a noisy-ε variant of the same algorithm)
 *   d8Receivers     steepest descent on the filled surface (the downslope idea of mapgen4's `assignDownslope`)
 *   accumulate      flow accumulation in topological order (mapgen4's `assignFlow` idea, Kahn's order instead of a sort)
 *   depressions     the filled hollows, each with its level, area, depth and outlet (Azgaar's lake-outlet idea: the lowest shore
 *                   cell the water leaves by)
 *   slopeTan, twi, hand
 *                   Horn slope, the topographic wetness index ln(a / tan β) and the height above the nearest drainage (after
 *                   xarray-spatial `twi_d8`, `hand_d8`)
 *
 * Every function is pure and deterministic (ties broken by cell index through the heap's insertion order).
 */

import { MinHeap } from "./geom.js";

const NB: readonly (readonly [number, number, number])[] = [
  [1, 0, 1], [1, 1, Math.SQRT2], [0, 1, 1], [-1, 1, Math.SQRT2], [-1, 0, 1], [-1, -1, Math.SQRT2], [0, -1, 1], [1, -1, Math.SQRT2],
];
const NB_DC = Int32Array.from(NB.map((n) => n[0]));
const NB_DR = Int32Array.from(NB.map((n) => n[1]));
const NB_F = Float64Array.from(NB.map((n) => n[2]));

export interface Flood {
  /** The filled surface: no cell lower than all its neighbours except on the grid edge. */
  readonly filled: Float64Array;
}

/**
 * Priority-Flood+ε. `isSink(i)` marks extra outlets inside the grid (cells that drain away, e.g. a lake cut by the sheet edge is
 * already on the edge; nothing else needs one here). Edge cells are the seeds.
 */
export function priorityFlood(dem: ArrayLike<number>, n: number, eps = 1e-4, isSink?: (i: number) => boolean, jitter?: ArrayLike<number>): Flood {
  const filled = Float64Array.from(dem as ArrayLike<number>);
  const closed = new Uint8Array(n * n);
  const open = new MinHeap(4 * n);
  const pit = new Int32Array(n * n);
  let pitHead = 0;
  let pitTail = 0;
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n);
    const c = i % n;
    if (r === 0 || c === 0 || r === n - 1 || c === n - 1 || isSink?.(i)) { closed[i] = 1; open.push(filled[i]!, i); }
  }
  while (pitHead < pitTail || open.size > 0) {
    const i = pitHead < pitTail ? pit[pitHead++]! : open.pop();
    const r = Math.floor(i / n);
    const c = i % n;
    const fi = filled[i]!;
    for (let k = 0; k < 8; k++) {
      const rr = r + NB_DR[k]!;
      const cc = c + NB_DC[k]!;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      const j = rr * n + cc;
      if (closed[j]) continue;
      closed[j] = 1;
      if (filled[j]! <= fi + eps) {
        // With `jitter` (0–1 per cell) the raised cell goes back on the priority queue with a noisy ε, so a flat fills in a
        // noisy Dijkstra order and the drainage across it wanders like a mire brook instead of radiating in straight lines.
        if (jitter) { filled[j] = fi + eps * (0.2 + jitter[j]!); open.push(filled[j]!, j); } else { filled[j] = fi + eps; pit[pitTail++] = j; }
      } else open.push(filled[j]!, j);
    }
    if (pitHead === pitTail) { pitHead = 0; pitTail = 0; }
  }
  return { filled };
}

/** Steepest-descent receiver of every cell on `z` (-1 on the edge, which drains off the grid, or where nothing is lower). */
export function d8Receivers(z: ArrayLike<number>, n: number): Int32Array {
  const rec = new Int32Array(n * n).fill(-1);
  for (let r = 1; r < n - 1; r++) {
    for (let c = 1; c < n - 1; c++) {
      const i = r * n + c;
      let best = -1;
      let bs = 0;
      const zi = z[i]!;
      for (let k = 0; k < 8; k++) {
        const j = (r + NB_DR[k]!) * n + c + NB_DC[k]!;
        const s = (zi - z[j]!) / NB_F[k]!;
        if (s > bs) { bs = s; best = j; }
      }
      rec[i] = best;
    }
  }
  return rec;
}

/** Cells in upstream-first topological order of the receiver graph (Kahn): every cell comes before its receiver. */
export function topoOrder(rec: Int32Array): Int32Array {
  const n = rec.length;
  const indeg = new Int32Array(n);
  for (let i = 0; i < n; i++) if (rec[i]! >= 0) indeg[rec[i]!]!++;
  const order = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) if (indeg[i] === 0) order[tail++] = i;
  while (head < tail) {
    const i = order[head++]!;
    const j = rec[i]!;
    if (j >= 0 && --indeg[j]! === 0) order[tail++] = j;
  }
  if (tail !== n) throw new Error(`hydrology: receiver graph has a cycle (${n - tail} cells)`);
  return order;
}

/** Flow accumulation in cells (each cell contributes `weight[i]`, default 1). */
export function accumulate(rec: Int32Array, order: Int32Array, weight?: ArrayLike<number>): Float64Array {
  const acc = new Float64Array(rec.length);
  for (let i = 0; i < acc.length; i++) acc[i] = weight ? weight[i]! : 1;
  for (let k = 0; k < order.length; k++) {
    const i = order[k]!;
    const j = rec[i]!;
    if (j >= 0) acc[j]! += acc[i]!;
  }
  return acc;
}

/** tan of the Horn (3 × 3) slope. */
export function slopeTan(z: ArrayLike<number>, n: number, cellM: number): Float32Array {
  const out = new Float32Array(n * n);
  const at = (r: number, c: number) => z[Math.max(0, Math.min(n - 1, r)) * n + Math.max(0, Math.min(n - 1, c))]!;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const dzdx = (at(r - 1, c + 1) + 2 * at(r, c + 1) + at(r + 1, c + 1) - at(r - 1, c - 1) - 2 * at(r, c - 1) - at(r + 1, c - 1)) / (8 * cellM);
      const dzdy = (at(r + 1, c - 1) + 2 * at(r + 1, c) + at(r + 1, c + 1) - at(r - 1, c - 1) - 2 * at(r - 1, c) - at(r - 1, c + 1)) / (8 * cellM);
      out[r * n + c] = Math.hypot(dzdx, dzdy);
    }
  }
  return out;
}

/** Topographic wetness index ln(a / tan β), a = specific catchment area (m² per m of contour). */
export function twi(acc: ArrayLike<number>, tan: ArrayLike<number>, cellM: number): Float32Array {
  const out = new Float32Array(acc.length);
  for (let i = 0; i < out.length; i++) out[i] = Math.log((acc[i]! * cellM) / Math.max(tan[i]!, 0.001));
  return out;
}

/** Height above the nearest drainage: z minus the z of the first cell downstream with accumulation ≥ `drainCells`. */
export function hand(z: ArrayLike<number>, rec: Int32Array, order: Int32Array, acc: ArrayLike<number>, drainCells: number): Float32Array {
  const drainZ = new Float64Array(rec.length);
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k]!;
    const j = rec[i]!;
    drainZ[i] = acc[i]! >= drainCells || j < 0 ? z[i]! : drainZ[j]!;
  }
  const out = new Float32Array(rec.length);
  for (let i = 0; i < out.length; i++) out[i] = Math.max(0, z[i]! - drainZ[i]!);
  return out;
}

export interface Depression {
  readonly id: number;
  /** Water level if it holds a lake: the spill elevation. */
  readonly level: number;
  readonly cells: number;
  readonly maxDepth: number;
  /** Deepest cell. */
  readonly bottom: number;
  /** First cell outside the depression on the flow path from its bottom: where the water leaves. */
  readonly outlet: number;
}

/** The filled hollows (filled − dem > `minDepth`), 8-connected, with level, size, depth and outlet. */
export function depressions(dem: ArrayLike<number>, filled: Float64Array, rec: Int32Array, n: number, minDepth = 0.05): { label: Int32Array; list: Depression[] } {
  const label = new Int32Array(n * n).fill(-1);
  const list: Depression[] = [];
  const stack: number[] = [];
  for (let s = 0; s < n * n; s++) {
    if (label[s]! >= 0 || filled[s]! - dem[s]! <= minDepth) continue;
    const id = list.length;
    let cells = 0;
    let maxDepth = 0;
    let bottom = s;
    let level = Infinity;
    label[s] = id;
    stack.push(s);
    while (stack.length > 0) {
      const i = stack.pop()!;
      cells++;
      const d = filled[i]! - dem[i]!;
      if (d > maxDepth) { maxDepth = d; bottom = i; }
      if (filled[i]! < level) level = filled[i]!;
      const r = Math.floor(i / n);
      const c = i % n;
      for (const [dc, dr] of NB) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        const j = rr * n + cc;
        if (label[j]! < 0 && filled[j]! - dem[j]! > minDepth) { label[j] = id; stack.push(j); }
      }
    }
    let o = bottom;
    let guard = 0;
    while (o >= 0 && label[o] === id && guard++ < n * n) o = rec[o]!;
    list.push({ id, level, cells, maxDepth, bottom, outlet: o });
  }
  return { label, list };
}

/** The receiver path from `start` until `stop(i)` or the grid edge; the stopping cell is included. */
export function flowPath(rec: Int32Array, start: number, stop: (i: number) => boolean, maxCells = 1_000_000): number[] {
  const path: number[] = [start];
  let i = start;
  for (let k = 0; k < maxCells; k++) {
    const j = rec[i]!;
    if (j < 0) break;
    path.push(j);
    if (stop(j)) break;
    i = j;
  }
  return path;
}
