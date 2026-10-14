/**
 * Plane geometry for the game-world build (`tools/game/build-world.ts`), local metres. `Math.sqrt` throughout
 * (exactly rounded), so the build is byte-identical run to run.
 */

export interface Pt { readonly x: number; readonly y: number }
export interface Box { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }

export const dist = (a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/** Rounds to 0.1 (metres in the output file). */
export const r1 = (v: number): number => Math.round(v * 10) / 10;

export const inBox = (p: Pt, b: Box): boolean => p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;

/** The point on segment a–b nearest `p`: its parameter t ∈ [0, 1], the point and the distance. */
export function project(p: Pt, a: Pt, b: Pt): { t: number; q: Pt; d: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const q = { x: a.x + t * dx, y: a.y + t * dy };
  return { t, q, d: dist(p, q) };
}

/** The point on a polyline nearest `p` (first of equals). */
export function nearestOnLine(p: Pt, line: readonly Pt[]): { q: Pt; d: number } {
  let best = { q: line[0]!, d: dist(p, line[0]!) };
  for (let k = 0; k + 1 < line.length; k++) {
    const pr = project(p, line[k]!, line[k + 1]!);
    if (pr.d < best.d) best = { q: pr.q, d: pr.d };
  }
  return best;
}

/** Even–odd point-in-polygon (the ring need not repeat its first point). */
export function inRing(p: Pt, ring: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** The point on a closed ring's boundary nearest `p`. */
export function nearestOnRing(p: Pt, ring: readonly Pt[]): { q: Pt; d: number } {
  return nearestOnLine(p, [...ring, ring[0]!]);
}

/** Distance from `p` to a water body's outline: 0 inside it. */
export function distToArea(p: Pt, ring: readonly Pt[]): number {
  return inRing(p, ring) ? 0 : nearestOnRing(p, ring).d;
}

/** Approximate pole of inaccessibility: the interior point farthest from the outline (grid search, then refined). */
export function poleOf(ring: readonly Pt[]): Pt {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of ring) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  let best: Pt = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  let bestD = inRing(best, ring) ? nearestOnRing(best, ring).d : -1;
  let step = Math.max(x1 - x0, y1 - y0) / 40;
  let cx = best.x;
  let cy = best.y;
  let half = Math.max(x1 - x0, y1 - y0) / 2;
  for (let pass = 0; pass < 4; pass++) {
    for (let y = cy - half; y <= cy + half; y += step) {
      for (let x = cx - half; x <= cx + half; x += step) {
        const p = { x, y };
        if (!inRing(p, ring)) continue;
        const d = nearestOnRing(p, ring).d;
        if (d > bestD) { bestD = d; best = p; }
      }
    }
    cx = best.x;
    cy = best.y;
    half = step * 2;
    step /= 4;
  }
  return best;
}

/** Douglas–Peucker simplification (keeps both ends). */
export function simplify<T extends Pt>(pts: readonly T[], tol: number): T[] {
  if (pts.length <= 2) return [...pts];
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length > 0) {
    const [i, j] = stack.pop()!;
    let worst = -1;
    let worstD = tol;
    for (let k = i + 1; k < j; k++) {
      const d = project(pts[k]!, pts[i]!, pts[j]!).d;
      if (d > worstD) { worstD = d; worst = k; }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([i, worst], [worst, j]);
    }
  }
  return pts.filter((_, k) => keep[k] === 1);
}

/** Clips segment a–b to a box (Liang–Barsky): the parameters [t0, t1] inside it, or null. */
export function clipSegment(a: Pt, b: Pt, box: Box): [number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const edges: readonly (readonly [number, number])[] = [[-dx, a.x - box.x0], [dx, box.x1 - a.x], [-dy, a.y - box.y0], [dy, box.y1 - a.y]];
  for (const [p, q] of edges) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return [t0, t1];
}

export const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/**
 * A polyline's runs inside a box. Each run says whether its first / last point is the polyline's own end (true) or
 * a cut at the box edge (false).
 */
export function clipLine(line: readonly Pt[], box: Box): { pts: Pt[]; ownStart: boolean; ownEnd: boolean }[] {
  const runs: { pts: Pt[]; ownStart: boolean; ownEnd: boolean }[] = [];
  let cur: Pt[] | null = null;
  let curOwnStart = false;
  for (let k = 0; k + 1 < line.length; k++) {
    const a = line[k]!;
    const b = line[k + 1]!;
    const c = clipSegment(a, b, box);
    if (!c) { if (cur) { runs.push({ pts: cur, ownStart: curOwnStart, ownEnd: false }); cur = null; } continue; }
    const [t0, t1] = c;
    if (!cur) { cur = [t0 === 0 ? a : lerp(a, b, t0)]; curOwnStart = t0 === 0 && k === 0; }
    else if (t0 > 0) { runs.push({ pts: cur, ownStart: curOwnStart, ownEnd: false }); cur = [lerp(a, b, t0)]; curOwnStart = false; }
    cur.push(t1 === 1 ? b : lerp(a, b, t1));
    if (t1 < 1) { runs.push({ pts: cur, ownStart: curOwnStart, ownEnd: false }); cur = null; }
  }
  if (cur) runs.push({ pts: cur, ownStart: curOwnStart, ownEnd: true });
  return runs.filter((r) => r.pts.length >= 2 && dist(r.pts[0]!, r.pts[r.pts.length - 1]!) > 0);
}

/** Proper intersection of segments a–b and c–d: parameters along each, or null (parallel or apart). */
export function intersect(a: Pt, b: Pt, c: Pt, d: Pt): { t: number; u: number } | null {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  if (den === 0) return null;
  const qx = c.x - a.x, qy = c.y - a.y;
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u };
}

/** A URL-safe id from a Finnish name: "Mökkiranta" → "mokkiranta", "Lampi 3" → "lampi-3". */
export function slug(name: string): string {
  return name.toLowerCase().replace(/[äå]/g, "a").replace(/ö/g, "o").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
