/**
 * Plane geometry for the map-reading pretest's build (`map-pretest.ts`), in the basemap's pixels (4 m each, y down). Pure and
 * deterministic: no clock, no randomness, every choice ordered by an explicit comparator.
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

/** Degrees from `deg` to the nearest of N, E, S, W. */
export const fromCardinal = (deg: number): number => Math.min(...[0, 90, 180, 270, 360].map((c) => Math.abs(deg - c)));

/** Orders points west to east, then north to south: the tie-break of every choice. */
export const byPosition = (a: Px, b: Px): number => (a.x - b.x) || (a.y - b.y);

export const round1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * The elevation grid of `topo-features.json` (`elevationGrid`: `size` × `size` cells over the whole basemap, row 0 at the SOUTH edge,
 * checked against the contour lines by `checkGridOrientation`), bilinear between cell centres.
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
