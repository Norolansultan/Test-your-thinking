/**
 * The built map's layers in site metres (x east, y north of IGN), read from `content/site/build/topo-features.json` for the
 * hydro, road and realism checks (SPEC/33 §5). The checks measure what was written, not what the generator meant to write.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface P { readonly x: number; readonly y: number }
export type Ring = readonly P[];

export interface BuiltLayers {
  readonly water: readonly Ring[];
  readonly islands: readonly Ring[];
  readonly mires: { readonly open: readonly Ring[]; readonly pine: readonly Ring[]; readonly drained: readonly Ring[]; readonly islands: readonly Ring[] };
  readonly fields: readonly Ring[];
  readonly parcels: readonly Ring[];
  readonly river: readonly (readonly P[])[];
  readonly brooks: readonly (readonly P[])[];
  readonly ditches: readonly { readonly kind: string; readonly line: readonly P[] }[];
  readonly roads: readonly { readonly cls: string; readonly id?: string; readonly line: readonly P[] }[];
  readonly bridges: readonly P[];
  readonly culverts: readonly P[];
  readonly contours: readonly { readonly index: boolean; readonly aux: boolean; readonly pts: readonly P[] }[];
}

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const TOPO_FEATURES = "content/site/build/topo-features.json";

type Px = [number, number];
interface Raw {
  size: number; metresPerPixel: number;
  water: Px[][]; islands: Px[][]; openBogs: Px[][]; pineBogs: Px[][]; drainedBogs: Px[][]; mireIslands?: Px[][]; fields: Px[][]; field_parcels?: Px[][];
  river: Px[][]; brooks: Px[][]; ditches: Px[][]; ditchKinds?: string[]; roads: { cls: string; id?: string; pts: Px[] }[];
  bridges: Px[]; culverts?: Px[]; contours: { index: boolean; aux?: boolean; pts: Px[] }[];
}

export function loadLayers(path = TOPO_FEATURES): BuiltLayers {
  const t = JSON.parse(readFileSync(ROOT + path, "utf8")) as Raw;
  const half = (t.size * t.metresPerPixel) / 2;
  const p = ([px, py]: Px): P => ({ x: px * t.metresPerPixel - half, y: half - py * t.metresPerPixel });
  const ln = (l: Px[]) => l.map(p);
  return {
    water: t.water.map(ln), islands: t.islands.map(ln),
    mires: { open: t.openBogs.map(ln), pine: t.pineBogs.map(ln), drained: t.drainedBogs.map(ln), islands: (t.mireIslands ?? []).map(ln) },
    fields: t.fields.map(ln), parcels: (t.field_parcels ?? []).map(ln),
    river: t.river.map(ln), brooks: t.brooks.map(ln),
    ditches: t.ditches.map((l, k) => ({ kind: t.ditchKinds?.[k] ?? "ditch", line: ln(l) })),
    roads: t.roads.map((r) => ({ cls: r.cls, ...(r.id ? { id: r.id } : {}), line: ln(r.pts) })),
    bridges: t.bridges.map(p), culverts: (t.culverts ?? []).map(p),
    contours: t.contours.map((c) => ({ index: c.index, aux: c.aux === true, pts: ln(c.pts) })),
  };
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
export const lineLength = (l: readonly P[]) => l.reduce((s, q, k) => (k ? s + dist(q, l[k - 1]!) : 0), 0);

export function ringArea(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j]!.x + r[i]!.x) * (r[j]!.y - r[i]!.y);
  return Math.abs(a / 2);
}
export const ringPerimeter = (r: Ring) => lineLength([...r, r[0]!]);

export function inRing(p: P, r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i]!;
    const b = r[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function segDist(p: P, a: P, b: P): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function distToLine(p: P, l: readonly P[]): number {
  let best = Infinity;
  for (let k = 0; k + 1 < l.length; k++) best = Math.min(best, segDist(p, l[k]!, l[k + 1]!));
  return l.length === 1 ? dist(p, l[0]!) : best;
}

export function segHit(a: P, b: P, c: P, d: P): P | null {
  const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (den === 0) return null;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) } : null;
}

/** Convex hull (Andrew's monotone chain). */
export function hull(pts: readonly P[]): P[] {
  const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  if (s.length < 3) return s;
  const cross = (o: P, a: P, b: P) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: P[] = [];
  for (const p of s) { while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop(); lower.push(p); }
  const upper: P[] = [];
  for (let i = s.length - 1; i >= 0; i--) { const p = s[i]!; while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop(); upper.push(p); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Area of the minimum-area bounding rectangle (rotating the hull's edges). */
export function minRectArea(pts: readonly P[]): number {
  const h = hull(pts);
  if (h.length < 3) return 0;
  let best = Infinity;
  for (let i = 0; i < h.length; i++) {
    const a = h[i]!;
    const b = h[(i + 1) % h.length]!;
    const len = dist(a, b);
    if (len === 0) continue;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of h) {
      const u = (p.x - a.x) * ux + (p.y - a.y) * uy;
      const v = -(p.x - a.x) * uy + (p.y - a.y) * ux;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    best = Math.min(best, (u1 - u0) * (v1 - v0));
  }
  return best;
}

/** Shape indices of a polygon: isoperimetric compactness 4πA/P², convexity A/hull, rectangularity A/min-rectangle. */
export function shape(r: Ring): { area: number; compactness: number; convexity: number; rectangularity: number } {
  const area = ringArea(r);
  const per = ringPerimeter(r);
  const hullArea = ringArea(hull(r));
  const rect = minRectArea(r);
  return { area, compactness: (4 * Math.PI * area) / (per * per), convexity: hullArea > 0 ? area / hullArea : 0, rectangularity: rect > 0 ? area / rect : 0 };
}

/** Bucket index of segments of many polylines, for crossing tests. */
export class SegmentIndex {
  private readonly cells = new Map<string, [P, P, number][]>();
  constructor(lines: readonly (readonly P[])[], private readonly size = 200) {
    lines.forEach((l, id) => {
      for (let k = 0; k + 1 < l.length; k++) {
        const a = l[k]!;
        const b = l[k + 1]!;
        for (let bx = Math.floor(Math.min(a.x, b.x) / size); bx <= Math.floor(Math.max(a.x, b.x) / size); bx++) {
          for (let by = Math.floor(Math.min(a.y, b.y) / size); by <= Math.floor(Math.max(a.y, b.y) / size); by++) {
            const key = `${bx},${by}`;
            (this.cells.get(key) ?? this.cells.set(key, []).get(key)!).push([a, b, id]);
          }
        }
      }
    });
  }
  /** Every crossing of segment ab with an indexed line: the point and the line id. */
  crossings(a: P, b: P): { p: P; id: number }[] {
    const out: { p: P; id: number }[] = [];
    const seen = new Set<string>();
    for (let bx = Math.floor(Math.min(a.x, b.x) / this.size); bx <= Math.floor(Math.max(a.x, b.x) / this.size); bx++) {
      for (let by = Math.floor(Math.min(a.y, b.y) / this.size); by <= Math.floor(Math.max(a.y, b.y) / this.size); by++) {
        for (const [c, d, id] of this.cells.get(`${bx},${by}`) ?? []) {
          const h = segHit(a, b, c, d);
          if (!h) continue;
          const key = `${Math.round(h.x)},${Math.round(h.y)}`;
          if (!seen.has(key)) { seen.add(key); out.push({ p: h, id }); }
        }
      }
    }
    return out;
  }
}

/** Polygons indexed by bounding box, for point-in-polygon tests. */
export class RingIndex {
  private readonly boxes: { r: Ring; x0: number; x1: number; y0: number; y1: number }[];
  constructor(rings: readonly Ring[]) {
    this.boxes = rings.map((r) => ({ r, x0: Math.min(...r.map((p) => p.x)), x1: Math.max(...r.map((p) => p.x)), y0: Math.min(...r.map((p) => p.y)), y1: Math.max(...r.map((p) => p.y)) }));
  }
  contains(p: P): boolean {
    return this.boxes.some((b) => p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1 && inRing(p, b.r));
  }
}

export interface CheckResult { readonly name: string; readonly violations: readonly string[]; readonly report: ReadonlyArray<readonly [string, string]> }
