/**
 * Grid geometry for the fire CA (SPEC/24 §3): cell <-> metres <-> WGS84, mask tracing into the
 * project's `Polygon` type, tolerance buffers and connected components. All integer or
 * fixed-order arithmetic; no iteration over object keys.
 */

import type { LatLon, Polygon, Ring } from "../../app/engine/primitives.js";

const METRES_PER_DEG_LAT = 111_320;

/** Maps a grid to the ground. `origin` is the south-west corner of cell (0, 0). */
export interface GridFrame {
  readonly origin: LatLon;
  readonly cols: number;
  readonly rows: number;
  readonly cellSizeM: number;
}

/** Local equirectangular projection — adequate at the ~10 km scale of one incident. */
export function metresToLatLon(frame: GridFrame, eastM: number, northM: number): LatLon {
  const lat = frame.origin.lat + northM / METRES_PER_DEG_LAT;
  const lon = frame.origin.lon + eastM / (METRES_PER_DEG_LAT * Math.cos((frame.origin.lat * Math.PI) / 180));
  return { lat, lon };
}

export function latLonToMetres(frame: GridFrame, p: LatLon): { eastM: number; northM: number } {
  return {
    northM: (p.lat - frame.origin.lat) * METRES_PER_DEG_LAT,
    eastM: (p.lon - frame.origin.lon) * METRES_PER_DEG_LAT * Math.cos((frame.origin.lat * Math.PI) / 180),
  };
}

export function cellIndex(frame: GridFrame, col: number, row: number): number {
  return row * frame.cols + col;
}

/** The cell containing a point given in grid metres, or -1 outside the grid. */
export function cellAtMetres(frame: GridFrame, eastM: number, northM: number): number {
  const c = Math.floor(eastM / frame.cellSizeM);
  const r = Math.floor(northM / frame.cellSizeM);
  if (c < 0 || r < 0 || c >= frame.cols || r >= frame.rows) return -1;
  return r * frame.cols + c;
}

/** All cells whose centre lies within `radiusM` of a point (grid metres), ascending. */
export function cellsInDisk(frame: GridFrame, eastM: number, northM: number, radiusM: number): number[] {
  const out: number[] = [];
  const s = frame.cellSizeM;
  const c0 = Math.max(0, Math.floor((eastM - radiusM) / s));
  const c1 = Math.min(frame.cols - 1, Math.floor((eastM + radiusM) / s));
  const r0 = Math.max(0, Math.floor((northM - radiusM) / s));
  const r1 = Math.min(frame.rows - 1, Math.floor((northM + radiusM) / s));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const dx = (c + 0.5) * s - eastM;
      const dy = (r + 0.5) * s - northM;
      if (dx * dx + dy * dy <= radiusM * radiusM) out.push(r * frame.cols + c);
    }
  }
  return out;
}

/** Dilates a mask by a Euclidean radius in metres (the containment tolerance). */
export function dilate(frame: GridFrame, mask: Uint8Array, radiusM: number): Uint8Array {
  const out = mask.slice();
  const k = Math.floor(radiusM / frame.cellSizeM);
  if (k <= 0) return out;
  const offsets: [number, number][] = [];
  for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) {
    if ((dc * dc + dr * dr) * frame.cellSizeM * frame.cellSizeM <= radiusM * radiusM) offsets.push([dc, dr]);
  }
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const c = i % frame.cols;
    const r = (i - c) / frame.cols;
    for (const [dc, dr] of offsets) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc >= 0 && nr >= 0 && nc < frame.cols && nr < frame.rows) out[nr * frame.cols + nc] = 1;
    }
  }
  return out;
}

/** 8-connected components of a mask, each as an ascending list of cell indices; ordered by first cell. */
export function components(frame: GridFrame, mask: Uint8Array): number[][] {
  const seen = new Uint8Array(mask.length);
  const out: number[][] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    const comp: number[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length > 0) {
      const j = stack.pop()!;
      comp.push(j);
      const c = j % frame.cols;
      const r = (j - c) / frame.cols;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dc === 0 && dr === 0) continue;
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= frame.cols || nr >= frame.rows) continue;
        const n = nr * frame.cols + nc;
        if (mask[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    comp.sort((x, y) => x - y);
    out.push(comp);
  }
  return out;
}

/** True if any cell of `cells` is in, or 8-adjacent to, a set cell of `mask`. */
export function touches(frame: GridFrame, cells: readonly number[], mask: Uint8Array): boolean {
  for (const i of cells) {
    const c = i % frame.cols;
    const r = (i - c) / frame.cols;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= frame.cols || nr >= frame.rows) continue;
      if (mask[nr * frame.cols + nc]) return true;
    }
  }
  return false;
}

/** Centroid of cells, in grid metres. */
export function centroidMetres(frame: GridFrame, cells: readonly number[]): { eastM: number; northM: number } {
  let e = 0;
  let n = 0;
  for (const i of cells) {
    const c = i % frame.cols;
    e += (c + 0.5) * frame.cellSizeM;
    n += ((i - c) / frame.cols + 0.5) * frame.cellSizeM;
  }
  return { eastM: e / cells.length, northM: n / cells.length };
}

export function maskCells(mask: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) out.push(i);
  return out;
}

// ---------------------------------------------------------------------------
// Mask -> polygon
// ---------------------------------------------------------------------------

// Directions: 0 = east, 1 = north, 2 = west, 3 = south.
const DX = [1, 0, -1, 0] as const;
const DY = [0, 1, 0, -1] as const;

interface Edge {
  readonly x: number;
  readonly y: number;
  readonly dir: number;
}

/**
 * Traces the outer boundary of every 8-connected blob in `mask` as counter-clockwise rings of
 * cell-corner coordinates. Edges run with the burned cell on their left. At a vertex with two
 * outgoing edges (diagonally touching cells) the rightmost turn is taken, which keeps
 * diagonal neighbours in one ring — matching the 8-connectivity used everywhere else.
 */
function traceRings(frame: GridFrame, mask: Uint8Array): { x: number; y: number }[][] {
  const { cols, rows } = frame;
  const at = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows && mask[r * cols + c] === 1;
  const edges: Edge[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!at(c, r)) continue;
      if (!at(c, r - 1)) edges.push({ x: c, y: r, dir: 0 });
      if (!at(c + 1, r)) edges.push({ x: c + 1, y: r, dir: 1 });
      if (!at(c, r + 1)) edges.push({ x: c + 1, y: r + 1, dir: 2 });
      if (!at(c - 1, r)) edges.push({ x: c, y: r + 1, dir: 3 });
    }
  }
  const key = (x: number, y: number) => y * (cols + 1) + x;
  const byStart = new Map<number, number[]>();
  edges.forEach((e, idx) => {
    const k = key(e.x, e.y);
    const list = byStart.get(k);
    if (list) list.push(idx); else byStart.set(k, [idx]);
  });
  const used = new Uint8Array(edges.length);
  const rings: { x: number; y: number }[][] = [];
  for (let start = 0; start < edges.length; start++) {
    if (used[start]) continue;
    const ring: { x: number; y: number }[] = [];
    let idx = start;
    while (!used[idx]) {
      used[idx] = 1;
      const e = edges[idx]!;
      ring.push({ x: e.x, y: e.y });
      const ex = e.x + DX[e.dir]!;
      const ey = e.y + DY[e.dir]!;
      const candidates = (byStart.get(key(ex, ey)) ?? []).filter((j) => !used[j]);
      if (candidates.length === 0) break;
      const preference = [(e.dir + 3) % 4, e.dir, (e.dir + 1) % 4];
      let chosen = candidates[0]!;
      for (const d of preference) {
        const hit = candidates.find((j) => edges[j]!.dir === d);
        if (hit !== undefined) { chosen = hit; break; }
      }
      idx = chosen;
    }
    rings.push(ring);
  }
  return rings;
}

function signedArea(ring: readonly { x: number; y: number }[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Douglas–Peucker on an open polyline. */
function simplify(points: readonly { x: number; y: number }[], epsilon: number): { x: number; y: number }[] {
  if (points.length < 3) return points.slice();
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let maxD = -1;
  let maxI = 0;
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const len = Math.hypot(dx, dy);
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const d = len === 0 ? Math.hypot(p.x - first.x, p.y - first.y) : Math.abs(dy * p.x - dx * p.y + last.x * first.y - last.y * first.x) / len;
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD <= epsilon) return [first, last];
  const left = simplify(points.slice(0, maxI + 1), epsilon);
  const right = simplify(points.slice(maxI), epsilon);
  return left.slice(0, -1).concat(right);
}

/** Options for turning a cell mask into outlines. */
export interface OutlineOptions {
  /**
   * Draw the outline as a natural fire front instead of a cell staircase: resample, then Taubin
   * smoothing, which rounds the 25 m steps and the CA's 45-degree facets into curves without
   * shrinking the area (Laplacian smoothing alone would). Real fronts are smooth, lobed and
   * elliptical under a steady wind (Anderson 1983; FARSITE's Huygens wavelets), never octagons.
   * Moves the line by well under one cell; the flags are computed on the masks, not on this.
   */
  readonly smooth?: boolean;
}

/** Fire outlines everywhere in the scenario build use this. */
export const FIRE_OUTLINE: OutlineOptions = { smooth: true };

/** Areas (burnt area, burning zone, projection bands) keep no piece or hole smaller than this, in cells (25 m: 6 cells ≈ 0.4 ha). */
const SMOOTH_MIN_AREA_CELLS = 6;

/** Resample a closed ring (no duplicate end point) at `step` spacing, in the ring's own units. */
function resampleRing(ring: readonly { x: number; y: number }[], step: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  let carry = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!, b = ring[(i + 1) % ring.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let t = carry;
    while (t < len) { out.push({ x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len }); t += step; }
    carry = t - len;
  }
  return out;
}

/**
 * Taubin lambda|mu smoothing of a closed ring: each pass pulls every point toward the mean of its
 * neighbours within `reach` (lambda), then pushes back (mu), so curvature is smoothed but the ring
 * does not shrink. Rings too small to smooth are returned unchanged.
 */
export function smoothRing(ring: readonly { x: number; y: number }[], passes = 8, reach = 2): { x: number; y: number }[] {
  let pts = resampleRing(ring, 0.5); // half a cell
  const n = pts.length;
  if (n < 4 * reach + 4) return ring.slice();
  const step = (src: { x: number; y: number }[], f: number) => src.map((p, i) => {
    let sx = 0, sy = 0;
    for (let k = -reach; k <= reach; k++) { if (k === 0) continue; const q = src[(i + k + n) % n]!; sx += q.x; sy += q.y; }
    const mx = sx / (2 * reach), my = sy / (2 * reach);
    return { x: p.x + f * (mx - p.x), y: p.y + f * (my - p.y) };
  });
  for (let k = 0; k < passes; k++) pts = step(step(pts, 0.5), -0.53);
  return pts;
}

/** A traced ring (closed, cell units) as the outline to draw: smoothed if asked, then simplified. */
function outlineOf(ring: { x: number; y: number }[], simplifyCells: number, opts: OutlineOptions): { x: number; y: number }[] {
  if (!opts.smooth) return simplify(ring.concat([ring[0]!]), simplifyCells);
  const smooth = smoothRing(ring);
  return simplify(smooth.concat([smooth[0]!]), Math.min(simplifyCells, 0.15));
}

/**
 * Outer boundaries of every blob in `mask`, in grid metres (x east, y north from the grid's
 * south-west corner), largest first, simplified by Douglas–Peucker at `simplifyCells` cells.
 * Used by the map generator (tools/topo-map), which draws in metres, not WGS84.
 */
export function traceMaskMetres(frame: GridFrame, mask: Uint8Array, simplifyCells = 0.75, minAreaCells = 1, opts: OutlineOptions = {}): { x: number; y: number }[][] {
  return traceRings(frame, mask)
    .map((ring) => ({ ring, area: signedArea(ring) }))
    .filter((r) => r.area >= minAreaCells)
    .sort((p, q) => q.area - p.area || p.ring[0]!.y - q.ring[0]!.y || p.ring[0]!.x - q.ring[0]!.x)
    .map(({ ring }) => outlineOf(ring, simplifyCells, opts).map((p) => ({ x: p.x * frame.cellSizeM, y: p.y * frame.cellSizeM })));
}

export interface TracedOutline {
  /** The largest blob's outline, as the project Polygon (one outer ring, closed, CCW). */
  readonly main: Polygon | null;
  /** Every other blob (spot fires), each as its own Polygon. */
  readonly others: readonly Polygon[];
}

/**
 * Traces a mask into polygons in WGS84. Holes (unburned islands) are not represented: the
 * study's judged artefact is the outer boundary (SPEC/12 §3.1). Rings are simplified with
 * Douglas–Peucker at `simplifyCells` cell widths, which removes the staircase without moving
 * the boundary by more than that distance.
 */
export function traceMask(frame: GridFrame, mask: Uint8Array, simplifyCells = 0.75, opts: OutlineOptions = {}): TracedOutline {
  const rings = traceRings(frame, mask)
    .map((ring) => ({ ring, area: signedArea(ring) }))
    .filter((r) => r.area > 0) // outer boundaries only; holes are clockwise
    .sort((p, q) => q.area - p.area || p.ring[0]!.y - q.ring[0]!.y || p.ring[0]!.x - q.ring[0]!.x);
  const toPolygon = (ring: { x: number; y: number }[]): Polygon => {
    const simple = outlineOf(ring, simplifyCells, opts);
    const latlon: LatLon[] = simple.map((p) => metresToLatLon(frame, p.x * frame.cellSizeM, p.y * frame.cellSizeM));
    const first = latlon[0]!;
    const lastPt = latlon[latlon.length - 1]!;
    if (first.lat !== lastPt.lat || first.lon !== lastPt.lon) latlon.push(first);
    const outer: Ring = latlon;
    return [outer];
  };
  const main = rings.length > 0 ? toPolygon(rings[0]!.ring) : null;
  return { main, others: rings.slice(1).map((r) => toPolygon(r.ring)) };
}

/**
 * Like `traceMaskMetres`, but keeps holes: each outer ring (CCW) with the holes (CW) that lie
 * inside it, in grid metres. For areas that are rings, such as the band a fire burned in its last
 * cycle (SPEC/12 revision 24 Sep (c), burning zone), which an outer-only outline would fill in.
 */
export function traceMaskWithHoles(frame: GridFrame, mask: Uint8Array, simplifyCells = 0.75, minAreaCells = 1, opts: OutlineOptions = {}): { outer: { x: number; y: number }[]; holes: { x: number; y: number }[][] }[] {
  const toMetres = (ring: { x: number; y: number }[]) => outlineOf(ring, simplifyCells, opts).map((p) => ({ x: p.x * frame.cellSizeM, y: p.y * frame.cellSizeM }));
  // A smoothed outline drops pieces under SMOOTH_MIN_AREA_CELLS: one- or two-cell unburned islands
  // and slivers are too small to round, and would stay as sharp squares at map scale.
  const minArea = opts.smooth ? Math.max(minAreaCells, SMOOTH_MIN_AREA_CELLS) : minAreaCells;
  const rings = traceRings(frame, mask).map((ring) => ({ ring, area: signedArea(ring) })).filter((r) => Math.abs(r.area) >= minArea);
  const outers = rings.filter((r) => r.area > 0).sort((p, q) => q.area - p.area || p.ring[0]!.y - q.ring[0]!.y || p.ring[0]!.x - q.ring[0]!.x);
  const inside = (pt: { x: number; y: number }, ring: readonly { x: number; y: number }[]) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i]!, b = ring[j]!;
      if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  };
  const out = outers.map((o) => ({ outer: toMetres(o.ring), holes: [] as { x: number; y: number }[][] }));
  for (const h of rings.filter((r) => r.area < 0)) {
    // A hole's vertices sit on cell corners shared with its outer ring; test a point just inside the hole.
    const p = { x: h.ring[0]!.x + 0.25, y: h.ring[0]!.y + 0.25 };
    // Smallest enclosing outer ring (outers are sorted largest first, so search from the end).
    for (let k = outers.length - 1; k >= 0; k--) {
      if (inside(p, outers[k]!.ring)) { out[k]!.holes.push(toMetres(h.ring)); break; }
    }
  }
  return out;
}
