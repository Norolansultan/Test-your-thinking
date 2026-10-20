/**
 * Point and line queries on the generated site's water (water.ts): distance to Kotkanjoki (exact, through a 100 m segment index, and
 * as a 20 m grid), where a line crosses it, whether a point is in water, and a channel's runs outside the lakes it flows through.
 */

import { distToPolyline, GN, HALF_M, lineField, segmentHit, type P } from "./terrain-base.js";
import { lakeAt, RIVER } from "./water.js";

/** Distance (m) from each 20 m cell to Kotkanjoki's centre line, out to 1.2 km (∞ beyond). */
export const RIVER_DIST: Float32Array = lineField(RIVER, 1200).d;
/** RIVER_DIST at a point (its cell). */
export const riverDistCell = (x: number, y: number): number =>
  RIVER_DIST[Math.max(0, Math.min(GN - 1, Math.floor((y + HALF_M) / 20))) * GN + Math.max(0, Math.min(GN - 1, Math.floor((x + HALF_M) / 20)))]!;

// River geometry index (exact distance, crossings).
const B = 100;
const BN = (2 * HALF_M) / B;
const buckets = new Map<number, number[]>();
for (let k = 0; k + 1 < RIVER.length; k++) {
  const a = RIVER[k]!;
  const b = RIVER[k + 1]!;
  for (let bx = Math.floor((Math.min(a.x, b.x) + HALF_M) / B); bx <= Math.floor((Math.max(a.x, b.x) + HALF_M) / B); bx++) {
    for (let by = Math.floor((Math.min(a.y, b.y) + HALF_M) / B); by <= Math.floor((Math.max(a.y, b.y) + HALF_M) / B); by++) {
      const key = by * BN + bx;
      const list = buckets.get(key);
      if (list) list.push(k); else buckets.set(key, [k]);
    }
  }
}
function segmentsNear(x0: number, y0: number, x1: number, y1: number): number[] {
  const out = new Set<number>();
  for (let bx = Math.floor((x0 + HALF_M) / B); bx <= Math.floor((x1 + HALF_M) / B); bx++) {
    for (let by = Math.floor((y0 + HALF_M) / B); by <= Math.floor((y1 + HALF_M) / B); by++) for (const k of buckets.get(by * BN + bx) ?? []) out.add(k);
  }
  return [...out].sort((a, b) => a - b);
}

/** Distance (m) to Kotkanjoki's centreline; Infinity beyond `maxM`. */
export function riverDist(x: number, y: number, maxM = 200): number {
  let best = Infinity;
  for (const k of segmentsNear(x - maxM, y - maxM, x + maxM, y + maxM)) best = Math.min(best, distToPolyline(x, y, [RIVER[k]!, RIVER[k + 1]!]));
  return best <= maxM ? best : Infinity;
}

/** Points where `line` crosses Kotkanjoki. */
export function riverCrossings(line: readonly P[]): P[] {
  const out: P[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    for (const k of segmentsNear(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y))) {
      const h = segmentHit(a, b, RIVER[k]!, RIVER[k + 1]!);
      if (h && !out.some((p) => Math.hypot(p.x - h.x, p.y - h.y) < 60)) out.push(h);
    }
  }
  return out;
}

export function inWater(x: number, y: number): boolean {
  return lakeAt(x, y) !== undefined || riverDist(x, y, 8) < 8;
}

/** A channel's runs outside the lakes it flows through, each starting/ending on the shore. */
export function runsOutsideLakes(line: readonly P[]): P[][] {
  const runs: P[][] = [];
  let cur: P[] = [];
  for (let k = 0; k < line.length; k++) {
    const p = line[k]!;
    if (lakeAt(p.x, p.y)) {
      if (cur.length > 0) runs.push([...cur, p]);
      cur = [];
    } else {
      if (cur.length === 0 && k > 0) cur.push(line[k - 1]!);
      cur.push(p);
    }
  }
  if (cur.length > 1) runs.push(cur);
  return runs.filter((r) => r.length > 1);
}
