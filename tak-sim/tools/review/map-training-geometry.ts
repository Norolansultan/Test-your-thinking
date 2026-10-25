/**
 * Plane geometry for the map training's build (`map-training.ts`; the map-reading pretest's before 25 Oct 2026), in the basemap's
 * pixels (4 m each, y down). Pure and deterministic: no clock, no randomness, every choice ordered by an explicit comparator.
 */

export interface Px { readonly x: number; readonly y: number }
export type Ring = readonly (readonly [number, number])[];

export const toPx = (p: readonly [number, number]): Px => ({ x: p[0], y: p[1] });
export const dist = (a: Px, b: Px): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Ray-casting point-in-polygon (the ring may be open or closed). */
export function inside(p: Px, ring: Ring): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[i]!, [bx, by] = ring[j]!;
    if ((ay > p.y) !== (by > p.y) && p.x < ((bx - ax) * (p.y - ay)) / (by - ay) + ax) hit = !hit;
  }
  return hit;
}

function segDist(p: Px, a: readonly [number, number], b: readonly [number, number]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / len));
  return Math.hypot(p.x - a[0] - t * dx, p.y - a[1] - t * dy);
}

/** Distance from `p` to a polyline. */
export function lineDist(p: Px, line: Ring): number {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) best = Math.min(best, segDist(p, line[i]!, line[i + 1]!));
  return line.length === 1 ? dist(p, toPx(line[0]!)) : best;
}

/** The point of a polyline nearest `p` (the foot of the perpendicular on its nearest segment). */
export function nearestOnLine(p: Px, line: Ring): Px {
  let best = { d: Infinity, q: toPx(line[0]!) };
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!, b = line[i + 1]!;
    const dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / len));
    const q = { x: a[0] + t * dx, y: a[1] + t * dy };
    const d = dist(p, q);
    if (d < best.d) best = { d, q };
  }
  return best.q;
}

/** Distance from `p` to a polygon: 0 inside, else to its boundary. */
export function polygonDist(p: Px, ring: Ring): number {
  return inside(p, ring) ? 0 : lineDist(p, [...ring, ring[0]!]);
}

/** A polygon's vertex centroid. */
export function centroid(ring: Ring): Px {
  return { x: ring.reduce((s, p) => s + p[0], 0) / ring.length, y: ring.reduce((s, p) => s + p[1], 0) / ring.length };
}

/** True bearing from `a` to `b` on the map (north up, y down), degrees 0–360. */
export function bearing(a: Px, b: Px): number {
  return ((Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI + 360) % 360;
}

/** The point `metresPx` from `p` towards the bearing `deg` (north up, y down). */
export function offset(p: Px, deg: number, px: number): Px {
  const r = (deg * Math.PI) / 180;
  return { x: p.x + px * Math.sin(r), y: p.y - px * Math.cos(r) };
}

/** Orders points west to east, then north to south: the tie-break of every choice. */
export const byPosition = (a: Px, b: Px): number => (a.x - b.x) || (a.y - b.y);

export const round1 = (v: number): number => Math.round(v * 10) / 10;

/** Whether the segments p1–p2 and q1–q2 cross (proper or touching). */
function segmentsCross(p1: Px, p2: Px, q1: readonly [number, number], q2: readonly [number, number]): boolean {
  const o = (a: Px, b: Px, c: Px) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  const a = toPx(q1), b = toPx(q2);
  return o(p1, p2, a) !== o(p1, p2, b) && o(a, b, p1) !== o(a, b, p2);
}

/** How many times the segment p–q crosses a polyline. */
export function crossings(p: Px, q: Px, line: Ring): number {
  let n = 0;
  for (let i = 0; i + 1 < line.length; i++) if (segmentsCross(p, q, line[i]!, line[i + 1]!)) n += 1;
  return n;
}

/** Contour lines as segments with their level, for `crossedLevels` (built once). */
export interface LevelSegment { readonly ax: number; readonly ay: number; readonly bx: number; readonly by: number; readonly level: number }
export function levelSegments(contours: readonly { readonly level: number; readonly pts: Ring }[]): LevelSegment[] {
  const out: LevelSegment[] = [];
  for (const c of contours) for (let i = 0; i + 1 < c.pts.length; i++) out.push({ ax: c.pts[i]![0], ay: c.pts[i]![1], bx: c.pts[i + 1]![0], by: c.pts[i + 1]![1], level: c.level });
  return out;
}

/** The contour levels the segment a–b crosses, in order from a. */
export function crossedLevels(a: Px, b: Px, segs: readonly LevelSegment[]): number[] {
  const hits: { t: number; level: number }[] = [];
  const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x), minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
  for (const s of segs) {
    if (Math.max(s.ax, s.bx) < minX || Math.min(s.ax, s.bx) > maxX || Math.max(s.ay, s.by) < minY || Math.min(s.ay, s.by) > maxY) continue;
    const d = (b.x - a.x) * (s.by - s.ay) - (b.y - a.y) * (s.bx - s.ax);
    if (d === 0) continue;
    const t = ((s.ax - a.x) * (s.by - s.ay) - (s.ay - a.y) * (s.bx - s.ax)) / d;
    const u = ((s.ax - a.x) * (b.y - a.y) - (s.ay - a.y) * (b.x - a.x)) / d;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) hits.push({ t, level: s.level });
  }
  return hits.sort((x, y) => (x.t - y.t) || (x.level - y.level)).map((h) => h.level);
}

/**
 * The elevation grid of `topo-features.json` (`elevationGrid`: `size` × `size` cells over the whole basemap, row 0 at the SOUTH edge,
 * checked against the contour lines by `contourError`), bilinear between cell centres.
 */
export class ElevationGrid {
  private readonly cellPx: number;
  constructor(private readonly size: number, private readonly values: readonly number[], imagePx: number) {
    if (values.length !== size * size) throw new Error(`elevation grid: ${values.length} values for ${size} × ${size}`);
    this.cellPx = imagePx / size;
  }

  at(p: Px): number {
    const n = this.size;
    const fx = p.x / this.cellPx - 0.5, fy = n - 1 - (p.y / this.cellPx - 0.5);
    const i = Math.max(0, Math.min(n - 2, Math.floor(fx))), j = Math.max(0, Math.min(n - 2, Math.floor(fy)));
    const tx = fx - i, ty = fy - j, v = (a: number, b: number) => this.values[b * n + a]!;
    return v(i, j) * (1 - tx) * (1 - ty) + v(i + 1, j) * tx * (1 - ty) + v(i, j + 1) * (1 - tx) * ty + v(i + 1, j + 1) * tx * ty;
  }

  /** The slope at `p` (rise over run, metres per metre) by central differences over one cell. */
  slope(p: Px, metresPerPx: number): number {
    const h = this.cellPx;
    const gx = (this.at({ x: p.x + h, y: p.y }) - this.at({ x: p.x - h, y: p.y })) / (2 * h * metresPerPx);
    const gy = (this.at({ x: p.x, y: p.y + h }) - this.at({ x: p.x, y: p.y - h })) / (2 * h * metresPerPx);
    return Math.hypot(gx, gy);
  }
}

/** The median absolute difference between contour levels and the grid at their vertices (m): small only if the orientation is right. */
export function contourError(grid: ElevationGrid, contours: readonly { readonly level: number; readonly pts: Ring }[], near: (p: Px) => boolean): number {
  const errs: number[] = [];
  for (const c of contours) for (const p of c.pts) if (near(toPx(p))) errs.push(Math.abs(grid.at(toPx(p)) - c.level));
  if (errs.length < 20) throw new Error(`elevation check: only ${errs.length} contour vertices near the extract`);
  errs.sort((a, b) => a - b);
  return errs[Math.floor(errs.length / 2)]!;
}

/**
 * A road graph: the vertices of the given polylines (each already clipped to the area a participant sees), consecutive vertices joined
 * by their length, and a polyline's end that lies within `snapPx` of another polyline joined to that polyline's nearest vertex (the
 * basemap draws a junction as one road ending on another). Shortest paths by Dijkstra (an array scan: a few hundred nodes).
 */
export class RoadGraph {
  readonly nodes: Px[] = [];
  private readonly edges: { to: number; w: number }[][] = [];
  private readonly pieces: { readonly id: string; readonly first: number; readonly last: number }[] = [];

  constructor(lines: readonly { readonly id: string; readonly pts: readonly Px[] }[], snapPx = 4) {
    for (const l of lines) {
      if (l.pts.length < 2) continue;
      const first = this.nodes.length;
      l.pts.forEach((p, i) => { this.nodes.push(p); this.edges.push([]); if (i > 0) this.link(first + i - 1, first + i); });
      this.pieces.push({ id: l.id, first, last: this.nodes.length - 1 });
    }
    for (const a of this.pieces) for (const end of [a.first, a.last]) {
      for (const b of this.pieces) {
        if (b === a) continue;
        let best = -1, bestD = Infinity;
        for (let k = b.first; k <= b.last; k++) { const d = dist(this.nodes[end]!, this.nodes[k]!); if (d < bestD) { bestD = d; best = k; } }
        const onLine = lineDist(this.nodes[end]!, this.nodes.slice(b.first, b.last + 1).map((p) => [p.x, p.y] as const));
        if (onLine <= snapPx && best >= 0) this.link(end, best);
      }
    }
  }

  private link(a: number, b: number): void {
    const w = dist(this.nodes[a]!, this.nodes[b]!);
    this.edges[a]!.push({ to: b, w });
    this.edges[b]!.push({ to: a, w });
  }

  /** The node nearest `p`. */
  nearest(p: Px): number {
    let best = 0, bestD = Infinity;
    this.nodes.forEach((q, i) => { const d = dist(p, q); if (d < bestD) { bestD = d; best = i; } });
    return best;
  }

  /** Shortest road distance (px) and path (node points) from node `from` to every node. */
  shortest(from: number): { readonly distPx: readonly number[]; readonly path: (to: number) => Px[] } {
    const n = this.nodes.length, d = new Array<number>(n).fill(Infinity), prev = new Array<number>(n).fill(-1), done = new Array<boolean>(n).fill(false);
    d[from] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && d[i]! < Infinity && (u < 0 || d[i]! < d[u]!)) u = i;
      if (u < 0) break;
      done[u] = true;
      for (const e of this.edges[u]!) if (d[u]! + e.w < d[e.to]!) { d[e.to] = d[u]! + e.w; prev[e.to] = u; }
    }
    return {
      distPx: d,
      path: (to: number) => { const out: Px[] = []; for (let k = to; k >= 0; k = prev[k]!) out.unshift(this.nodes[k]!); return out; },
    };
  }
}
