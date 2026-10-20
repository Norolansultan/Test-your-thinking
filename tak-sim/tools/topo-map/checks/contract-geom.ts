/**
 * Plane geometry for the geometry contract (SPEC/33 §3), in site metres: x east, y north of IGN.
 * Pure functions, no imports from the terrain, so the checker can run on any built map.
 */

export interface P { readonly x: number; readonly y: number }

/** A contract feature's geometry. A sector is the wedge of bearings [fromDeg, toDeg) seen from IGN. */
export type Geom =
  | { readonly kind: "point"; readonly p: P }
  | { readonly kind: "line"; readonly pts: readonly P[] }
  | { readonly kind: "polygon"; readonly rings: readonly (readonly P[])[] }
  | { readonly kind: "sector"; readonly fromDeg: number; readonly toDeg: number };

export const dist = (a: P, b: P): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Compass bearing (0 = north, clockwise) from `a` to `b`, in [0, 360). */
export function bearing(a: P, b: P): number {
  return ((Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI + 360) % 360;
}

/** Signed smallest difference a − b between two bearings, in (−180, 180]. */
export const angleDiff = (a: number, b: number): number => {
  const d = ((((a - b) % 360) + 540) % 360) - 180;
  return d === -180 ? 180 : d;
};

/** The point of segment ab nearest p. */
export function closestOnSegment(p: P, a: P, b: P): P {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** The point of a polyline nearest p. */
export function closestOnLine(p: P, line: readonly P[]): P {
  if (line.length === 1) return line[0]!;
  let best = line[0]!;
  let bd = Infinity;
  for (let i = 1; i < line.length; i++) {
    const q = closestOnSegment(p, line[i - 1]!, line[i]!);
    const d = dist(p, q);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}

export const distToLine = (p: P, line: readonly P[]): number => dist(p, closestOnLine(p, line));

export function inRing(p: P, ring: readonly P[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Inside a polygon given as rings (even-odd: holes and islands handled alike). */
export const inRings = (p: P, rings: readonly (readonly P[])[]): boolean => rings.reduce((acc, r) => (inRing(p, r) ? !acc : acc), false);

/** Intersection point of segments ab and cd, or null. */
export function segmentHit(a: P, b: P, c: P, d: P): P | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (den === 0) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + t * r.x, y: a.y + t * r.y } : null;
}

/** Every point where two polylines cross (bounding boxes first, so long lines stay cheap). */
export function lineCrossings(l1: readonly P[], l2: readonly P[]): P[] {
  const out: P[] = [];
  for (let i = 1; i < l1.length; i++) {
    const a = l1[i - 1]!;
    const b = l1[i]!;
    const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x), minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
    for (let j = 1; j < l2.length; j++) {
      const c = l2[j - 1]!;
      const d = l2[j]!;
      if (Math.max(c.x, d.x) < minX || Math.min(c.x, d.x) > maxX || Math.max(c.y, d.y) < minY || Math.min(c.y, d.y) > maxY) continue;
      const h = segmentHit(a, b, c, d);
      if (h && !out.some((q) => dist(q, h) < 1)) out.push(h);
    }
  }
  return out;
}

/** The geometry's points that represent it for distances: a point, a line's vertices, a polygon's ring vertices. */
function vertices(g: Geom): readonly P[] {
  switch (g.kind) {
    case "point": return [g.p];
    case "line": return g.pts;
    case "polygon": return g.rings.flat();
    case "sector": return [{ x: 0, y: 0 }];
  }
}

/** Distance from a point to a geometry: 0 inside a polygon or sector. */
export function pointToGeom(p: P, g: Geom): number {
  switch (g.kind) {
    case "point": return dist(p, g.p);
    case "line": return distToLine(p, g.pts);
    case "polygon": return inRings(p, g.rings) ? 0 : Math.min(...g.rings.map((r) => distToLine(p, [...r, r[0]!])));
    case "sector": return sectorOfBearing(bearing({ x: 0, y: 0 }, p), [g]) === 0 ? 0 : Infinity;
  }
}

/** Shortest distance between two geometries (vertex-to-geometry both ways; 0 when lines cross). */
export function geomDistance(a: Geom, b: Geom): number {
  if (a.kind === "line" && b.kind === "line" && lineCrossings(a.pts, b.pts).length > 0) return 0;
  let best = Infinity;
  for (const p of vertices(a)) best = Math.min(best, pointToGeom(p, b));
  for (const p of vertices(b)) best = Math.min(best, pointToGeom(p, a));
  return best;
}

/** The point of `g` nearest p (a polygon's nearest boundary point, or p itself inside it). */
export function nearestPointOf(p: P, g: Geom): P {
  switch (g.kind) {
    case "point": return g.p;
    case "line": return closestOnLine(p, g.pts);
    case "polygon": {
      if (inRings(p, g.rings)) return p;
      let best = g.rings[0]![0]!;
      for (const r of g.rings) { const q = closestOnLine(p, [...r, r[0]!]); if (dist(p, q) < dist(p, best)) best = q; }
      return best;
    }
    case "sector": return p;
  }
}

/** Index of the sector (a list of bearing wedges) a bearing falls in, or −1. Wedges may wrap through north. */
export function sectorOfBearing(b: number, sectors: readonly { readonly fromDeg: number; readonly toDeg: number }[]): number {
  return sectors.findIndex((s) => (s.fromDeg <= s.toDeg ? b >= s.fromDeg && b < s.toDeg : b >= s.fromDeg || b < s.toDeg));
}

/** Polyline length (m). */
export const lineLength = (line: readonly P[]): number => line.reduce((acc, p, i) => (i === 0 ? 0 : acc + dist(line[i - 1]!, p)), 0);

/** Points every `stepM` along a polyline, the vertices kept. */
export function densify(line: readonly P[], stepM: number): P[] {
  const out: P[] = [];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const k = Math.max(1, Math.ceil(dist(a, b) / stepM));
    for (let j = 0; j < k; j++) out.push({ x: a.x + ((b.x - a.x) * j) / k, y: a.y + ((b.y - a.y) * j) / k });
  }
  if (line.length > 0) out.push(line[line.length - 1]!);
  return out;
}

// ---------------------------------------------------------------------------
// Road network: shortest driving distance over polylines that touch
// ---------------------------------------------------------------------------

export interface RoadGraph { readonly nodes: readonly P[]; readonly adj: readonly (readonly [number, number][])[] }

/**
 * A graph of the given road lines, densified every `stepM`; two lines join wherever their points come within `joinM`
 * (junctions are drawn as touching ends or crossing vertices, not shared ids). `cut` points (e.g. a load-limited bridge)
 * remove every node within `cutM` of them.
 */
export function roadGraph(lines: readonly (readonly P[])[], stepM = 20, joinM = 15, cut: readonly P[] = [], cutM = 30): RoadGraph {
  const nodes: P[] = [];
  const adj: [number, number][][] = [];
  const grid = new Map<string, number[]>();
  const key = (x: number, y: number) => `${Math.floor(x / 50)},${Math.floor(y / 50)}`;
  const blocked = (p: P) => cut.some((c) => dist(c, p) < cutM);
  const lineOf: number[] = [];
  lines.forEach((line, li) => {
    let prev = -1;
    for (const p of densify(line, stepM)) {
      if (blocked(p)) { prev = -1; continue; }
      const id = nodes.length;
      nodes.push(p); adj.push([]); lineOf.push(li);
      (grid.get(key(p.x, p.y)) ?? grid.set(key(p.x, p.y), []).get(key(p.x, p.y))!).push(id);
      if (prev >= 0) { const d = dist(nodes[prev]!, p); adj[prev]!.push([id, d]); adj[id]!.push([prev, d]); }
      prev = id;
    }
  });
  for (let id = 0; id < nodes.length; id++) {
    const p = nodes[id]!;
    for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) {
      for (const o of grid.get(key(p.x + gx * 50, p.y + gy * 50)) ?? []) {
        if (o <= id || lineOf[o] === lineOf[id]) continue;
        const d = dist(p, nodes[o]!);
        if (d <= joinM) { adj[id]!.push([o, d]); adj[o]!.push([id, d]); }
      }
    }
  }
  return { nodes, adj };
}

/** Shortest road distance (m) between the nodes nearest `a` and `b` (plus the off-road legs to them), or Infinity. */
export function roadDistance(g: RoadGraph, a: P, b: P): number {
  const nearest = (p: P) => g.nodes.reduce((best, q, i) => (dist(p, q) < dist(p, g.nodes[best]!) ? i : best), 0);
  const s = nearest(a);
  const t = nearest(b);
  const d = new Float64Array(g.nodes.length).fill(Infinity);
  const done = new Uint8Array(g.nodes.length);
  d[s] = 0;
  const heap = new MinHeap();
  heap.push(0, s);
  while (heap.size > 0) {
    const [du, u] = heap.pop();
    if (done[u]) continue;
    done[u] = 1;
    if (u === t) break;
    for (const [v, w] of g.adj[u]!) if (du + w < d[v]!) { d[v] = du + w; heap.push(d[v]!, v); }
  }
  return d[t]! + dist(a, g.nodes[s]!) + dist(b, g.nodes[t]!);
}

class MinHeap {
  private readonly k: number[] = [];
  private readonly v: number[] = [];
  get size(): number { return this.k.length; }
  push(key: number, val: number): void {
    let i = this.k.length;
    this.k.push(key); this.v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.k[p]! <= key) break;
      this.k[i] = this.k[p]!; this.v[i] = this.v[p]!;
      i = p;
    }
    this.k[i] = key; this.v[i] = val;
  }
  pop(): [number, number] {
    const top: [number, number] = [this.k[0]!, this.v[0]!];
    const lk = this.k.pop()!;
    const lv = this.v.pop()!;
    const n = this.k.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const c = l + 1 < n && this.k[l + 1]! < this.k[l]! ? l + 1 : l;
        if (this.k[c]! >= lk) break;
        this.k[i] = this.k[c]!; this.v[i] = this.v[c]!;
        i = c;
      }
      this.k[i] = lk; this.v[i] = lv;
    }
    return top;
  }
}
