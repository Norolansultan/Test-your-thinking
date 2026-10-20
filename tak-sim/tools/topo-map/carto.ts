/**
 * Cartographic generalisation for the basemap (SPEC/33 §2.3 "Cartography", §9), on build.ts's 10 m grid. None of this changes the
 * terrain the fire model reads; it decides how the map draws it.
 *
 *   contourSurface  the surface the contours are traced on: the DEM, except that beside a stream in flat ground the carved channel
 *                   is closed over (a brook in a mire is not incised; its 1 m trench must not draw two parallel contours along it,
 *                   which reads as a canal). Where the valley is real (the ground within ~150 m rises 4 m or more) the carved
 *                   channel stays, so the contours cross it in a V.
 *   smoothRing      a closed ring with its raster stair-steps rounded off (Chaikin corner cutting, then Douglas–Peucker).
 *   stampLines      a mask of the cells within `radiusM` of a set of lines (spot heights keep off roads, ditches and streams).
 */

import { simplify, type P } from "./geom.js";

/** Running max (sign 1) or min (sign −1) over ±r cells, separably along rows then columns (a square structuring element). */
function squareFilter(src: Float32Array, n: number, r: number, sign: 1 | -1): Float32Array {
  const tmp = new Float32Array(n * n);
  const out = new Float32Array(n * n);
  const pick = sign > 0 ? Math.max : Math.min;
  for (let row = 0; row < n; row++) {
    for (let c = 0; c < n; c++) {
      let v = src[row * n + c]!;
      for (let k = Math.max(0, c - r); k <= Math.min(n - 1, c + r); k++) v = pick(v, src[row * n + k]!);
      tmp[row * n + c] = v;
    }
  }
  for (let c = 0; c < n; c++) {
    for (let row = 0; row < n; row++) {
      let v = tmp[row * n + c]!;
      for (let k = Math.max(0, row - r); k <= Math.min(n - 1, row + r); k++) v = pick(v, tmp[k * n + c]!);
      out[row * n + c] = v;
    }
  }
  return out;
}

/** Marks every cell (centres `cellX(c)`, `cellY(r)`, `cellM` apart) within `radiusM` of any of `lines`, with the distance (m). */
export function stampLines(lines: readonly (readonly P[])[], n: number, cellM: number, originM: number, radiusM: number): Float32Array {
  const d = new Float32Array(n * n).fill(Infinity);
  const rc = Math.ceil(radiusM / cellM);
  for (const line of lines) {
    for (let k = 0; k + 1 < line.length; k++) {
      const a = line[k]!;
      const b = line[k + 1]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(len / (cellM / 2)));
      for (let s = 0; s <= steps; s++) {
        const x = a.x + ((b.x - a.x) * s) / steps;
        const y = a.y + ((b.y - a.y) * s) / steps;
        const c0 = Math.floor((x - originM) / cellM);
        const r0 = Math.floor((y - originM) / cellM);
        for (let r = Math.max(0, r0 - rc); r <= Math.min(n - 1, r0 + rc); r++) {
          for (let c = Math.max(0, c0 - rc); c <= Math.min(n - 1, c0 + rc); c++) {
            const dd = Math.hypot(originM + (c + 0.5) * cellM - x, originM + (r + 0.5) * cellM - y);
            if (dd <= radiusM && dd < d[r * n + c]!) d[r * n + c] = dd;
          }
        }
      }
    }
  }
  return d;
}

/**
 * The surface to trace contours on (see the header): `elev` with each stream's carved trench closed over where the ground around it
 * is flat. `streamDist` is the distance (m) to the nearest stream per cell (stampLines), `water` marks lake and river cells.
 */
export function contourSurface(elev: Float32Array, water: Uint8Array, n: number, cellM: number, streamDist: Float32Array): Float32Array {
  const R = Math.round(60 / cellM); // closes trenches up to ~120 m wide (a brook's carve reaches 45 m either side)
  const closed = squareFilter(squareFilter(elev, n, R, 1), n, R, -1);
  // Local relief of the closed ground within ~150 m: a real valley has sides, flat mire land has none.
  const RR = Math.round(150 / cellM);
  const hi = squareFilter(closed, n, RR, 1);
  const lo = squareFilter(closed, n, RR, -1);
  const out = Float32Array.from(elev);
  for (let i = 0; i < n * n; i++) {
    const d = streamDist[i]!;
    if (d > 70 || water[i]) continue;
    const flat = Math.max(0, Math.min(1, (5 - (hi[i]! - lo[i]!)) / 2)); // 1 below 3 m of relief, 0 from 5 m
    const near = d <= 50 ? 1 : (70 - d) / 20;
    const w = flat * near;
    if (w > 0) out[i] = elev[i]! + w * (closed[i]! - elev[i]!);
  }
  return out;
}

/** A closed ring resampled every `step` (its own units). */
function resampleClosed(ring: readonly P[], step: number): P[] {
  const out: P[] = [];
  let carry = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let t = carry;
    while (t < len) { out.push({ x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len }); t += step; }
    carry = t - len;
  }
  return out;
}

/**
 * A closed ring (first point not repeated, map pixels) with its raster stair-steps rounded off: resampled every 1.5 px, Taubin
 * λ|μ smoothing over ±5 points (removes the 10–20 m staircase without shrinking the area), Chaikin corner cutting, then
 * Douglas–Peucker at `tol` px. Moves the edge by well under one 10 m cell.
 */
export function smoothRing(ring: readonly [number, number][], passes = 2, tol = 0.35): [number, number][] {
  if (ring.length < 4) return [...ring];
  let pts = resampleClosed(ring.map(([x, y]) => ({ x, y })), 1.5);
  const n = pts.length;
  if (n >= 24) {
    const R = 5;
    const step = (src: P[], f: number) => src.map((p, i) => {
      let sx = 0, sy = 0;
      for (let k = -R; k <= R; k++) { if (k === 0) continue; const q = src[(i + k + n) % n]!; sx += q.x; sy += q.y; }
      return { x: p.x + f * (sx / (2 * R) - p.x), y: p.y + f * (sy / (2 * R) - p.y) };
    });
    for (let k = 0; k < 8; k++) pts = step(step(pts, 0.5), -0.53);
  }
  for (let k = 0; k < passes; k++) {
    const nxt: P[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      nxt.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y }, { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    pts = nxt;
  }
  const thin = simplify([...pts, pts[0]!], tol).slice(0, -1);
  return thin.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
}
