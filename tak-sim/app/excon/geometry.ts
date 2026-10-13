/**
 * EXCON (SPEC/28 §8) — pure geometry for the white cell's "continuous realistic change": interpolating
 * positions and morphing fire outlines between two world-state steps. Lon/lat, equirectangular (exact
 * enough at the scale of one incident, as `app/render/polygon-ops.ts` assumes). Everything here is a pure
 * function of its arguments, so the same playback position always draws the same picture (I1 style; this
 * module is under the determinism lint).
 *
 * RESEARCHER-ONLY: nothing outside `app/excon/` may import this directory (test/excon/isolation.spec.ts).
 */

import type { LatLon, Polygon } from "../engine/primitives.js";

const M_PER_DEG = 111_320;

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Hermite smoothstep of `x` between `e0` and `e1` (0 before, 1 after). */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function lerpLatLon(a: LatLon, b: LatLon, t: number): LatLon {
  return { lat: lerp(a.lat, b.lat, t), lon: lerp(a.lon, b.lon, t) };
}

/** Ground distance in metres (equirectangular at the mean latitude). */
export function distanceM(a: LatLon, b: LatLon): number {
  const k = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot((b.lat - a.lat) * M_PER_DEG, (b.lon - a.lon) * M_PER_DEG * k);
}

/** `p` moved by `dx` metres east and `dy` metres north. */
export function offsetM(p: LatLon, dx: number, dy: number): LatLon {
  return { lat: p.lat + dy / M_PER_DEG, lon: p.lon + dx / (M_PER_DEG * Math.cos((p.lat * Math.PI) / 180)) };
}

/** The ring without a repeated closing vertex. */
export function openRing(ring: readonly LatLon[]): LatLon[] {
  const n = ring.length;
  if (n > 1 && ring[0]!.lat === ring[n - 1]!.lat && ring[0]!.lon === ring[n - 1]!.lon) return ring.slice(0, n - 1);
  return [...ring];
}

/** The ring with its first vertex repeated at the end (GeoJSON closure). */
export function closeRing(ring: readonly LatLon[]): LatLon[] {
  if (ring.length === 0) return [];
  const first = ring[0]!, last = ring[ring.length - 1]!;
  return first.lat === last.lat && first.lon === last.lon ? [...ring] : [...ring, first];
}

export function polylineLengthM(pts: readonly LatLon[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += distanceM(pts[i - 1]!, pts[i]!);
  return len;
}

/** The point `fraction` (0–1) of the way along a polyline by arc length. */
export function pointAlong(pts: readonly LatLon[], fraction: number): LatLon {
  if (pts.length === 0) throw new RangeError("pointAlong: empty polyline");
  if (pts.length === 1) return pts[0]!;
  const total = polylineLengthM(pts);
  if (total === 0) return pts[0]!;
  let target = clamp01(fraction) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = distanceM(pts[i - 1]!, pts[i]!);
    if (target <= seg || i === pts.length - 1) return lerpLatLon(pts[i - 1]!, pts[i]!, seg === 0 ? 0 : Math.min(1, target / seg));
    target -= seg;
  }
  return pts[pts.length - 1]!;
}

/** The arc-length fraction (0–1) of the point of a polyline nearest to `p`. */
export function nearestArcFraction(pts: readonly LatLon[], p: LatLon): number {
  const total = polylineLengthM(pts);
  if (pts.length < 2 || total === 0) return 0;
  const k = Math.cos((p.lat * Math.PI) / 180);
  const xy = (q: LatLon): readonly [number, number] => [q.lon * M_PER_DEG * k, q.lat * M_PER_DEG];
  const [px, py] = xy(p);
  let best = Infinity, bestAt = 0, run = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = xy(pts[i - 1]!), [bx, by] = xy(pts[i]!);
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : clamp01(((px - ax) * dx + (py - ay) * dy) / len2);
    const d = Math.hypot(ax + t * dx - px, ay + t * dy - py);
    const seg = Math.sqrt(len2);
    if (d < best) { best = d; bestAt = run + t * seg; }
    run += seg;
  }
  return bestAt / total;
}

/** Distance (m) from `p` to the nearest point of a polyline or ring. */
export function distanceToPolylineM(p: LatLon, pts: readonly LatLon[]): number {
  if (pts.length === 0) return Infinity;
  if (pts.length === 1) return distanceM(p, pts[0]!);
  const k = Math.cos((p.lat * Math.PI) / 180);
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const ax = (a.lon - p.lon) * M_PER_DEG * k, ay = (a.lat - p.lat) * M_PER_DEG;
    const bx = (b.lon - p.lon) * M_PER_DEG * k, by = (b.lat - p.lat) * M_PER_DEG;
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : clamp01(-(ax * dx + ay * dy) / len2);
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/** Twice the signed area in lon/lat (> 0 counter-clockwise). */
function signedArea2(ring: readonly LatLon[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j]!.lon - ring[i]!.lon) * (ring[j]!.lat + ring[i]!.lat);
  return a;
}

/** `n` points evenly spaced by arc length around a ring (open output, counter-clockwise). */
export function resampleRing(ring: readonly LatLon[], n: number): LatLon[] {
  const open = openRing(ring);
  if (open.length === 0) return [];
  const ccw = signedArea2(open) >= 0 ? open : [...open].reverse();
  const closed = [...ccw, ccw[0]!];
  const out: LatLon[] = [];
  for (let i = 0; i < n; i++) out.push(pointAlong(closed, i / n));
  return out;
}

/** Centroid of a ring's vertices (good enough for matching parts and growing a new one from a point). */
export function ringCentre(ring: readonly LatLon[]): LatLon {
  const open = openRing(ring);
  if (open.length === 0) return { lat: 0, lon: 0 };
  let lat = 0, lon = 0;
  for (const p of open) { lat += p.lat; lon += p.lon; }
  return { lat: lat / open.length, lon: lon / open.length };
}

/** A tiny ring about `c` — the start of a part that did not exist yet (a spot fire, a new front). */
export function seedRing(c: LatLon, n: number, radiusM = 4): LatLon[] {
  const out: LatLon[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    out.push(offsetM(c, radiusM * Math.cos(a), radiusM * Math.sin(a)));
  }
  return out;
}

/** Two rings resampled to the same count and rotated so vertex i of one matches vertex i of the other. */
export interface PreparedMorph {
  readonly from: readonly LatLon[];
  readonly to: readonly LatLon[];
}

export const MORPH_POINTS = 96;

/**
 * Pairs two rings for morphing: both resampled to `n` points, counter-clockwise, and `to` rotated by the
 * shift with the least summed squared distance (ties to the lowest shift), so the outline grows rather
 * than twists. Deterministic: a plain scan over every shift.
 */
export function prepareMorph(from: readonly LatLon[], to: readonly LatLon[], n = MORPH_POINTS): PreparedMorph {
  const a = resampleRing(from, n);
  const b = resampleRing(to, n);
  if (a.length === 0 || b.length === 0) return { from: a.length ? a : b, to: b.length ? b : a };
  const k = Math.cos((a[0]!.lat * Math.PI) / 180);
  let bestShift = 0, bestCost = Infinity;
  for (let s = 0; s < n; s++) {
    let cost = 0;
    for (let i = 0; i < n && cost < bestCost; i++) {
      const p = a[i]!, q = b[(i + s) % n]!;
      const dy = q.lat - p.lat, dx = (q.lon - p.lon) * k;
      cost += dx * dx + dy * dy;
    }
    if (cost < bestCost) { bestCost = cost; bestShift = s; }
  }
  return { from: a, to: a.map((_, i) => b[(i + bestShift) % n]!) };
}

/** The morphed ring at `t` (0 = from, 1 = to), closed for GeoJSON. */
export function morphAt(m: PreparedMorph, t: number): LatLon[] {
  const tt = clamp01(t);
  return closeRing(m.from.map((p, i) => lerpLatLon(p, m.to[i]!, tt)));
}

/** A polygon moved rigidly by the displacement from `a` to `b` (a sensor footprint following its platform). */
export function translatePolygon(poly: Polygon, a: LatLon, b: LatLon): LatLon[][] {
  const dLat = b.lat - a.lat, dLon = b.lon - a.lon;
  return poly.map((ring) => ring.map((p) => ({ lat: p.lat + dLat, lon: p.lon + dLon })));
}
