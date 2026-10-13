/**
 * What a crew or a camera can know about the fire at a place (review 1 Oct 2026, items 2, 5, 6):
 * the REPORTED fire now and one step ago (the CA's reported masks), queried around a site point.
 * Never truth and never the future — a drone that reports heat, a measured rate or a cold edge
 * reports what these masks contain inside its footprint, so it cannot contradict the fire state.
 */

import { components, type GridFrame } from "./geometry.js";
import type { P } from "./deployment.js";

/**
 * Kept for reference only: until 2 Oct 2026 fresh fire further than this from the old fire counted as
 * a separate fire, which capped every measured advance at 20 m/min and called the 39 m/min crown run
 * a "separate fire". A separate fire is now one whose patch does not touch the old fire (`separate`).
 */
export const JUMP_M = 400;

export interface FireProbe {
  /** Reported burned area (ha) within `r` metres of `p`. */
  burnedHa(p: P, r: number): number;
  /** Area (ha) that burned during the last step (reported now, not one step ago) within `r` of `p`. */
  freshHa(p: P, r: number): number;
  /** How far (m) the edge moved within `r` of `p` over the last step: the largest distance of a freshly burned cell from the old fire (cells of new separate fires excluded). */
  advanceM(p: P, r: number): number;
  /** As `advanceM`, with where that largest advance was measured (the freshly burned cell; null when nothing advanced). */
  advanceAt(p: P, r: number): { readonly m: number; readonly at: P | null };
  /**
   * How far (m) the edge moves within `r` of `p` during THIS step, as a crew on it sees it burn: the
   * largest distance from the fire now of a cell that burns by the step's end (0 without `next`). A
   * crew's rate is the fire in front of it, not the last step's run (review 6 Oct 2026, A2: EK11 radioed
   * the crown run's 38 m/min at 15:22, when its own edge moved 5 m/min).
   */
  currentAdvanceM(p: P, r: number): number;
  /** Area (ha) within `r` of `p` that burns during this step (0 without `next`). */
  currentFreshHa(p: P, r: number): number;
  /** Whether the reported cell at `p` belongs to a new separate fire (its patch touches nothing of the fire one step ago). */
  isSeparate(p: P): boolean;
  /** Distance (m) from `p` to the nearest reported burned cell, up to `maxM` (Infinity beyond). */
  distanceM(p: P, maxM?: number): number;
  /** Whether the point itself is inside the reported fire. */
  inside(p: P): boolean;
  /** Distance (m) from `p` to the fire as reported one step ago (Infinity if none within 5 km). */
  distancePrevM(p: P): number;
  /** Centroids within `r` of `p` of the old fire and of what burned since: the way the edge moved is old → fresh. */
  centroids(p: P, r: number): { readonly old: P | null; readonly fresh: P | null };
  /** Direction (deg) the edge moved at `p`: from the nearest cell of the fire one step ago to `p` (the outward normal; null without such a cell within `maxM`). */
  outwardBearing(p: P, maxM: number): number | null;
  /** The reported burned cell nearest `p` within `maxM`, or null. */
  nearestBurned(p: P, maxM: number): P | null;
  /** Area of one grid cell, ha. */
  readonly cellHa: number;
  /** Every freshly burned cell (site metres) with how far it lies from the old fire (m), and whether it is part of a new separate fire (its patch does not touch the old fire). */
  readonly fresh: readonly { readonly p: P; readonly advanceM: number; readonly separate: boolean }[];
}

/** Two-pass chamfer distance (m) to the nearest set cell of `mask`; Infinity where there is none. */
/**
 * Euclidean distance (m) from every cell to the nearest masked cell: two raster passes that carry
 * each cell's nearest masked cell (not a summed step length, which overstates oblique distances by
 * up to 8 %; consistency review items 10 and B: reported distances follow the CA).
 */
export function distanceTransform(frame: GridFrame, mask: Uint8Array): Float32Array {
  const { cols, rows, cellSizeM: cs } = frame;
  const d = new Float32Array(mask.length).fill(Infinity);
  const near = new Int32Array(mask.length).fill(-1);
  for (let i = 0; i < mask.length; i++) if (mask[i]) { d[i] = 0; near[i] = i; }
  const relax = (i: number, j: number) => {
    const s = near[j]!;
    if (s < 0) return;
    const v = Math.hypot((s % cols) - (i % cols), Math.floor(s / cols) - Math.floor(i / cols)) * cs;
    if (v < d[i]!) { d[i] = v; near[i] = s; }
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c > 0) relax(i, i - 1);
      if (r > 0) { relax(i, i - cols); if (c > 0) relax(i, i - cols - 1); if (c + 1 < cols) relax(i, i - cols + 1); }
    }
    for (let c = cols - 2; c >= 0; c--) relax(r * cols + c, r * cols + c + 1);
  }
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const i = r * cols + c;
      if (c + 1 < cols) relax(i, i + 1);
      if (r + 1 < rows) { relax(i, i + cols); if (c + 1 < cols) relax(i, i + cols + 1); if (c > 0) relax(i, i + cols - 1); }
    }
    for (let c = 1; c < cols; c++) relax(r * cols + c, r * cols + c - 1);
  }
  return d;
}

/**
 * A probe over the reported masks of this step and the last, and (`next`) the fire at the step's end,
 * which only `currentAdvanceM` and `currentFreshHa` read. `ignitionM` turns site metres (x east,
 * y north of the ignition) into grid metres.
 */
/**
 * `separate` (revision (aj)): the cells of a new fire first on this report, given by the run (`masks.separateReported`,
 * the rekindles' own cells, `new-fire.ts`); without it, a patch that touches nothing of the previous report. A rekindle
 * now grows out of the old edge, so connectivity alone would no longer find it.
 */
export function makeFireProbe(frame: GridFrame, ignitionM: { readonly eastM: number; readonly northM: number }, now: Uint8Array, prev: Uint8Array | null, next: Uint8Array | null = null, separate: Uint8Array | null = null): FireProbe {
  const cs = frame.cellSizeM;
  const cellHa = (cs * cs) / 10_000;
  const toPrev = prev ? distanceTransform(frame, prev) : null;
  const toNow = distanceTransform(frame, now);
  const cellOf = (p: P) => ({ c: Math.floor((p.x + ignitionM.eastM) / cs), r: Math.floor((p.y + ignitionM.northM) / cs) });
  const around = (p: P, rM: number, f: (i: number) => void) => {
    const { c: c0, r: r0 } = cellOf(p);
    const k = Math.ceil(rM / cs);
    for (let dr = -k; dr <= k; dr++) {
      for (let dc = -k; dc <= k; dc++) {
        const c = c0 + dc, r = r0 + dr;
        if (c < 0 || r < 0 || c >= frame.cols || r >= frame.rows || Math.hypot(dc, dr) * cs > rM) continue;
        f(r * frame.cols + c);
      }
    }
  };
  const fresh = (i: number) => now[i] === 1 && (!prev || prev[i] === 0);
  const coming = (i: number) => next !== null && next[i] === 1 && now[i] === 0;
  const siteOf = (i: number): P => { const c = i % frame.cols, r = (i - c) / frame.cols; return { x: (c + 0.5) * cs - ignitionM.eastM, y: (r + 0.5) * cs - ignitionM.northM }; };
  // A patch of the fire now that touches nothing of the fire one step ago is a new, separate fire.
  const separateCell = new Uint8Array(now.length);
  if (separate) { for (let i = 0; i < now.length; i++) separateCell[i] = separate[i] && now[i] ? 1 : 0; }
  else if (prev) for (const comp of components(frame, now)) if (!comp.some((i) => prev[i])) for (const i of comp) separateCell[i] = 1;
  const freshList: { p: P; advanceM: number; separate: boolean }[] = [];
  if (toPrev) {
    for (let i = 0; i < now.length; i++) {
      if (!fresh(i)) continue;
      const c = i % frame.cols, r = (i - c) / frame.cols;
      const v = toPrev[i]!;
      freshList.push({ p: { x: (c + 0.5) * cs - ignitionM.eastM, y: (r + 0.5) * cs - ignitionM.northM }, advanceM: Number.isFinite(v) ? v : 0, separate: separateCell[i] === 1 });
    }
  }
  const advanceAt = (p: P, r: number): { m: number; at: P | null } => {
    if (!toPrev) return { m: 0, at: null };
    let best = 0, at = -1;
    around(p, r, (i) => { if (fresh(i) && !separateCell[i]) { const v = toPrev[i]!; if (Number.isFinite(v) && v > best) { best = v; at = i; } } });
    return { m: best, at: at >= 0 ? siteOf(at) : null };
  };
  return {
    cellHa,
    fresh: freshList,
    burnedHa(p, r) { let n = 0; around(p, r, (i) => { if (now[i]) n += 1; }); return n * cellHa; },
    freshHa(p, r) { let n = 0; around(p, r, (i) => { if (fresh(i)) n += 1; }); return n * cellHa; },
    advanceM: (p, r) => advanceAt(p, r).m,
    advanceAt,
    currentAdvanceM(p, r) {
      let best = 0;
      around(p, r, (i) => { if (coming(i)) { const v = toNow[i]!; if (Number.isFinite(v) && v > best) best = v; } });
      return best;
    },
    currentFreshHa(p, r) { let n = 0; around(p, r, (i) => { if (coming(i)) n += 1; }); return n * cellHa; },
    isSeparate(p) { const { c, r } = cellOf(p); return c >= 0 && r >= 0 && c < frame.cols && r < frame.rows && separateCell[r * frame.cols + c] === 1; },
    distanceM(p, maxM = 5000) {
      const { c, r } = cellOf(p);
      if (c < 0 || r < 0 || c >= frame.cols || r >= frame.rows) return Infinity;
      const v = toNow[r * frame.cols + c]!;
      return v <= maxM ? v : Infinity;
    },
    inside(p) { const { c, r } = cellOf(p); return c >= 0 && r >= 0 && c < frame.cols && r < frame.rows && now[r * frame.cols + c] === 1; },
    distancePrevM(p) {
      const { c, r } = cellOf(p);
      if (!toPrev || c < 0 || r < 0 || c >= frame.cols || r >= frame.rows) return Infinity;
      const v = toPrev[r * frame.cols + c]!;
      return v <= 5000 ? v : Infinity;
    },
    centroids(p, rM) {
      const acc = { ox: 0, oy: 0, on: 0, fx: 0, fy: 0, fn: 0 };
      around(p, rM, (i) => {
        if (!now[i]) return;
        const c = i % frame.cols, r = (i - c) / frame.cols;
        const x = (c + 0.5) * cs - ignitionM.eastM, y = (r + 0.5) * cs - ignitionM.northM;
        if (fresh(i)) { acc.fx += x; acc.fy += y; acc.fn += 1; } else { acc.ox += x; acc.oy += y; acc.on += 1; }
      });
      return {
        old: acc.on > 0 ? { x: acc.ox / acc.on, y: acc.oy / acc.on } : null,
        fresh: acc.fn > 0 ? { x: acc.fx / acc.fn, y: acc.fy / acc.fn } : null,
      };
    },
    outwardBearing(p, maxM) {
      if (!prev) return null;
      const near = { d: Infinity, x: 0, y: 0 };
      around(p, maxM, (i) => {
        if (!prev[i]) return;
        const q = siteOf(i);
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < near.d) { near.d = d; near.x = q.x; near.y = q.y; }
      });
      if (near.d < 1 || !Number.isFinite(near.d)) return null;
      return ((Math.atan2(p.x - near.x, p.y - near.y) * 180) / Math.PI + 360) % 360;
    },
    nearestBurned(p, maxM) {
      let best: P | null = null;
      let bestD = Infinity;
      around(p, maxM, (i) => {
        if (!now[i]) return;
        const c = i % frame.cols, r = (i - c) / frame.cols;
        const q = { x: (c + 0.5) * cs - ignitionM.eastM, y: (r + 0.5) * cs - ignitionM.northM };
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < bestD) { bestD = d; best = q; }
      });
      return best;
    },
  };
}
