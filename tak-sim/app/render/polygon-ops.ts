/**
 * Polygon difference and union for the map's projection bands (SPEC/12 revision (ah), 9 Oct 2026). Pure geometry in
 * lon/lat (planar is exact enough at the scale of one incident): Greiner–Hormann clipping of simple rings, with the
 * clip ring nudged by a few millimetres so that the traced outlines' shared vertices and collinear edges (fire and
 * isochrones are traced on the same grid) never meet exactly — the degenerate case Greiner–Hormann cannot handle.
 *
 * The bands used to cut the current fire out only when the fire ring's FIRST vertex lay inside the isochrone, and a
 * smoothed isochrone cuts into the fire edge, so in most views the first band was painted over the burned ground.
 */

import type { LatLon } from "../engine/primitives.js";

type Pt = readonly [number, number];
type Ring = readonly Pt[];

/** A region: one outer ring and the holes inside it; rings are open (no repeated closing vertex), outer CCW, holes CW. */
export interface Region { readonly outer: Ring; readonly holes: readonly Ring[] }

/**
 * The k-th clip ring's nudge, ≈ 0.2–0.6 mm: far below a pixel, far above rounding (~1e-13°). It differs from one
 * clip ring to the next — with one fixed nudge, two traced rings that share vertices (the burnt area and the burning
 * zone do) met exactly again after both were nudged, and the union lost part of the area.
 */
const nudge = (k: number): Pt => [3.1e-9 * (1 + ((k * 0.6180339887) % 1)), 1.7e-9 * (1 + ((k * 0.4142135624) % 1))];
const shifted = (r: Ring, k: number): Pt[] => { const [dx, dy] = nudge(k); return r.map((p): Pt => [p[0] + dx, p[1] + dy]); };

function signedArea2(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j]![0] - r[i]![0]) * (r[j]![1] + r[i]![1]);
  return a; // > 0: counter-clockwise (x east, y north)
}

/** Open ring, consecutive duplicates removed, counter-clockwise. */
function normalise(r: Ring): Pt[] {
  const out: Pt[] = [];
  for (const p of r) { const q = out[out.length - 1]; if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p); }
  while (out.length > 1 && out[0]![0] === out[out.length - 1]![0] && out[0]![1] === out[out.length - 1]![1]) out.pop();
  return signedArea2(out) < 0 ? out.reverse() : out;
}

export function insidePt(p: Pt, r: Ring): boolean {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i]!, b = r[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

interface Node { readonly p: Pt; readonly x: number } // x: intersection id, or -1 for an original vertex

/** Both rings with their crossings inserted in order; `at[k]` = the position of crossing k in each. */
function weave(s: Ring, c: Ring) {
  const onS: { a: number; id: number; p: Pt }[][] = s.map(() => []);
  const onC: { a: number; id: number; p: Pt }[][] = c.map(() => []);
  let id = 0;
  for (let i = 0; i < s.length; i++) {
    const p1 = s[i]!, p2 = s[(i + 1) % s.length]!;
    const minX = Math.min(p1[0], p2[0]), maxX = Math.max(p1[0], p2[0]), minY = Math.min(p1[1], p2[1]), maxY = Math.max(p1[1], p2[1]);
    for (let j = 0; j < c.length; j++) {
      const q1 = c[j]!, q2 = c[(j + 1) % c.length]!;
      if (Math.max(q1[0], q2[0]) < minX || Math.min(q1[0], q2[0]) > maxX || Math.max(q1[1], q2[1]) < minY || Math.min(q1[1], q2[1]) > maxY) continue;
      const d = (p2[0] - p1[0]) * (q2[1] - q1[1]) - (p2[1] - p1[1]) * (q2[0] - q1[0]);
      if (d === 0) continue;
      const a = ((q1[0] - p1[0]) * (q2[1] - q1[1]) - (q1[1] - p1[1]) * (q2[0] - q1[0])) / d;
      const b = ((q1[0] - p1[0]) * (p2[1] - p1[1]) - (q1[1] - p1[1]) * (p2[0] - p1[0])) / d;
      if (a <= 0 || a >= 1 || b <= 0 || b >= 1) continue;
      const p: Pt = [p1[0] + a * (p2[0] - p1[0]), p1[1] + a * (p2[1] - p1[1])];
      onS[i]!.push({ a, id, p }); onC[j]!.push({ a: b, id, p }); id++;
    }
  }
  const seq = (r: Ring, on: { a: number; id: number; p: Pt }[][]) => {
    const out: Node[] = [];
    r.forEach((p, i) => { out.push({ p, x: -1 }); for (const q of on[i]!.sort((u, v) => u.a - v.a)) out.push({ p: q.p, x: q.id }); });
    return out;
  };
  const S = seq(s, onS), C = seq(c, onC);
  const atS = new Array<number>(id), atC = new Array<number>(id);
  S.forEach((n, k) => { if (n.x >= 0) atS[n.x] = k; });
  C.forEach((n, k) => { if (n.x >= 0) atC[n.x] = k; });
  return { S, C, atS, atC, count: id };
}

/**
 * The rings of `s − c` (difference) or `s ∪ c` (union) when the boundaries cross; null when they do not. Walks `s`
 * forward where it lies outside `c`, and `c` backward (difference) or forward (union) where it lies inside/outside `s`.
 */
function clip(s: Ring, c: Ring, op: "difference" | "union"): Pt[][] | null {
  const { S, C, atS, atC, count } = weave(s, c);
  if (count === 0) return null;
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const visited = new Array<boolean>(count).fill(false);
  const rings: Pt[][] = [];
  for (let k = 0; k < count; k++) {
    const startS = atS[k]!;
    if (visited[k] || insidePt(mid(S[startS]!.p, S[(startS + 1) % S.length]!.p), c)) continue; // start where s leaves c
    const ring: Pt[] = [];
    let onS = true, i = startS, guard = 0;
    for (;;) {
      const list = onS ? S : C;
      const dir = onS || op === "union" ? 1 : -1;
      visited[list[i]!.x] = true;
      ring.push(list[i]!.p);
      // Walk to the next crossing on this ring.
      i = (i + dir + list.length) % list.length;
      while (list[i]!.x < 0) { ring.push(list[i]!.p); i = (i + dir + list.length) % list.length; if (++guard > 4 * (S.length + C.length)) return null; }
      const x = list[i]!.x;
      if (x === k) break;
      if (visited[x]) break; // inconsistent input (self-crossing ring): stop this ring
      onS = !onS;
      i = onS ? atS[x]! : atC[x]!;
      if (++guard > 4 * (S.length + C.length)) return null;
    }
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

/** `r` minus every ring of `cut`; the cut rings must not overlap one another (merge them with `unionAll` first). */
export function subtract(r: Ring, cut: readonly Ring[]): Region[] {
  let pieces: Pt[][] = [normalise(r)];
  const holes: Pt[][] = [];
  for (const [k, raw] of cut.entries()) {
    const h = shifted(normalise(raw), k);
    if (h.length < 3) continue;
    const next: Pt[][] = [];
    for (const piece of pieces) {
      const res = clip(piece, h, "difference");
      if (res) { next.push(...res.map(normalise).filter((q) => q.length >= 3 && signedArea2(q) > 0)); continue; }
      if (insidePt(h[0]!, piece)) { next.push(piece); holes.push(h); } // wholly inside: a hole
      else if (!insidePt(piece[0]!, h)) next.push(piece); // apart; a piece wholly inside the cut is dropped
    }
    pieces = next;
  }
  return pieces.map((outer) => ({ outer, holes: holes.filter((h) => insidePt(h[0]!, outer)).map((h) => [...h].reverse()) }));
}

/** Merges overlapping rings into their outlines (holes inside a union are filled). */
export function unionAll(rings: readonly Ring[]): Pt[][] {
  let out: Pt[][] = [];
  for (const [idx, raw] of rings.entries()) {
    let cur = normalise(raw);
    if (cur.length < 3) continue;
    let merged = true;
    while (merged) {
      merged = false;
      for (let k = 0; k < out.length; k++) {
        const o = out[k]!;
        const nudged = shifted(cur, idx + 1000);
        const res = clip(o, nudged, "union");
        let u: Pt[] | null = null;
        if (res && res.length > 0) u = res.map(normalise).sort((a, b) => Math.abs(signedArea2(b)) - Math.abs(signedArea2(a)))[0]!;
        else if (!res && insidePt(cur[0]!, o)) u = o;
        else if (!res && insidePt(o[0]!, cur)) u = cur;
        if (u) { out = out.filter((_, j) => j !== k); cur = u; merged = true; break; }
      }
    }
    out.push(cur);
  }
  return out;
}

export const toPts = (r: readonly LatLon[]): Pt[] => r.map((p) => [p.lon, p.lat]);
export const toLatLon = (r: Ring): LatLon[] => r.map(([lon, lat]) => ({ lat, lon }));
