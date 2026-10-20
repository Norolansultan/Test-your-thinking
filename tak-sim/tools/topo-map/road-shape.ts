/**
 * Road geometry that reads as built over real ground (SPEC/33 §2.3 "Roads", §9 landscape grammar): a designed road is a smooth
 * spline through its contract points (centripetal Catmull–Rom, so it never overshoots into a loop), and any road that the grid
 * router left ruler-straight for more than ~600 m is given a gentle bend to the side where the ground is easier. A straight run
 * across a mire (a causeway) stays straight. Deterministic: the bend's side comes from the terrain cost, then a fixed hash.
 */

import { chaikin, hash2, resample, type P } from "./geom.js";

/** A centripetal Catmull–Rom spline through `pts` (every point kept exactly), resampled every `stepM`. `before` / `after` set the
 * tangent at the ends (a point the road comes from / goes on to); by default the end segments are mirrored. */
export function spline(pts: readonly P[], stepM = 20, before?: P, after?: P): P[] {
  if (pts.length < 2) return [...pts];
  const n = pts.length;
  const mirror = (a: P, b: P): P => ({ x: 2 * a.x - b.x, y: 2 * a.y - b.y });
  const ext = [before ?? mirror(pts[0]!, pts[1]!), ...pts, after ?? mirror(pts[n - 1]!, pts[n - 2]!)];
  const out: P[] = [pts[0]!];
  for (let k = 1; k + 2 < ext.length; k++) {
    const p0 = ext[k - 1]!, p1 = ext[k]!, p2 = ext[k + 1]!, p3 = ext[k + 2]!;
    const kn = (a: P, b: P) => Math.max(1e-6, Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y)));
    const t0 = 0;
    const t1 = t0 + kn(p0, p1);
    const t2 = t1 + kn(p1, p2);
    const t3 = t2 + kn(p2, p3);
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(2, Math.ceil(len / 5));
    for (let s = 1; s <= steps; s++) {
      const t = t1 + ((t2 - t1) * s) / steps;
      const lerp = (a: P, b: P, ta: number, tb: number): P => ({ x: ((tb - t) * a.x + (t - ta) * b.x) / (tb - ta), y: ((tb - t) * a.y + (t - ta) * b.y) / (tb - ta) });
      const a1 = lerp(p0, p1, t0, t1), a2 = lerp(p1, p2, t1, t2), a3 = lerp(p2, p3, t2, t3);
      const b1 = lerp(a1, a2, t0, t2), b2 = lerp(a2, a3, t1, t3);
      out.push(s === steps ? p2 : lerp(b1, b2, t1, t2));
    }
  }
  return resampleKeeping(out, stepM, pts);
}

/** Resamples `line` every `stepM` but keeps the points of `keep` that lie on it (the contract points stay exact). */
function resampleKeeping(line: readonly P[], stepM: number, keep: readonly P[]): P[] {
  const isKeep = (p: P) => keep.some((q) => q.x === p.x && q.y === p.y);
  const out: P[] = [];
  let piece: P[] = [line[0]!];
  for (let k = 1; k < line.length; k++) {
    piece.push(line[k]!);
    if (isKeep(line[k]!) || k === line.length - 1) {
      const r = resample(piece, stepM);
      out.push(...(out.length ? r.slice(1) : r));
      piece = [line[k]!];
    }
  }
  return out;
}

/** True when `wet(p)` holds at `p` or within `clearM` of it (8 directions): a bent road keeps that far off the water. */
export function nearWet(p: P, wet: (q: P) => boolean, clearM = 20): boolean {
  if (wet(p)) return true;
  for (let k = 0; k < 8; k++) if (wet({ x: p.x + clearM * Math.cos((k * Math.PI) / 4), y: p.y + clearM * Math.sin((k * Math.PI) / 4) })) return true;
  return false;
}

/** The maximal runs [i, j] of `line` that stay within `tolM` of their chord, longer than `minM`. */
export function straightRuns(line: readonly P[], tolM: number, minM: number): [number, number][] {
  const runs: [number, number][] = [];
  let i = 0;
  while (i + 1 < line.length) {
    let j = i + 1;
    while (j + 1 < line.length) {
      const a = line[i]!, b = line[j + 1]!;
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      let ok = L > 0;
      for (let k = i + 1; ok && k <= j; k++) {
        const q = line[k]!;
        if (Math.abs((b.x - a.x) * (a.y - q.y) - (a.x - q.x) * (b.y - a.y)) / L > tolM) ok = false;
      }
      if (!ok) break;
      j++;
    }
    const L = Math.hypot(line[j]!.x - line[i]!.x, line[j]!.y - line[i]!.y);
    if (L > minM) { runs.push([i, j]); i = j; } else i++;
  }
  return runs;
}

export interface BendOptions {
  /** Runs longer than this (m) are bent. */
  readonly maxStraightM?: number;
  /** Ground the bend avoids (higher is worse), per point. */
  readonly cost: (p: P) => number;
  /** A run mostly on this ground (a causeway over a mire) stays straight. */
  readonly causeway?: (p: P) => boolean;
  /** The bent line must pass this test, or the next (smaller, other-side) candidate is tried; the original is kept at the end. */
  readonly accept: (line: readonly P[]) => boolean;
  readonly salt: number;
}

/**
 * Gives every straight run of `line` longer than `maxStraightM` a gentle bend: a sideways offset in half-waves (one per ~450 m,
 * 4 % of the run, 14–36 m, each half-wave its own height), zero at the run's ends, on the side with the lower ground cost. Returns
 * a new line, every 20 m; the parts outside the runs are unchanged.
 */
export function bendStraights(line: readonly P[], opt: BendOptions): P[] {
  const maxM = opt.maxStraightM ?? 450;
  let pts = resample(line, 20);
  const runs = straightRuns(pts, 3, maxM);
  if (runs.length === 0) return [...line];
  // Back to front, so earlier indices stay valid.
  for (let r = runs.length - 1; r >= 0; r--) {
    const [i, j] = runs[r]!;
    const a = pts[i]!, b = pts[j]!;
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const run = pts.slice(i, j + 1);
    if (opt.causeway && run.filter(opt.causeway).length > run.length * 0.5) continue;
    const nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
    const waves = Math.max(1, Math.round(L / 450));
    const amp = Math.min(36, Math.max(14, L * 0.04));
    const shape = (p: P, side: number, A: number) => {
      const t = (waves * Math.max(0, Math.min(L, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / L))) / L;
      // Each half-wave its own height (0.65–1.15 ×), so a long run does not become a regular sine.
      const f = 0.65 + 0.5 * hash2(Math.min(waves - 1, Math.floor(t)), Math.round(a.x + a.y), opt.salt + 1);
      const off = side * A * f * Math.sin(Math.PI * t);
      return { x: p.x + nx * off, y: p.y + ny * off };
    };
    const costOf = (side: number) => run.reduce((t, p) => t + opt.cost(shape(p, side, amp)), 0);
    const pref = costOf(1) < costOf(-1) - 1e-9 ? 1 : costOf(-1) < costOf(1) - 1e-9 ? -1 : hash2(Math.round(a.x), Math.round(a.y), opt.salt) < 0.5 ? 1 : -1;
    for (const [side, A] of [[pref, amp], [-pref, amp], [pref, amp * 0.6], [-pref, amp * 0.6], [pref, amp * 0.35]] as const) {
      const bent = chaikin(run.map((p) => shape(p, side, A)), 1);
      const cand = [...pts.slice(0, i), ...resample(bent, 20), ...pts.slice(j + 1)];
      if (opt.accept(cand)) { pts = cand; break; }
    }
  }
  return pts;
}
