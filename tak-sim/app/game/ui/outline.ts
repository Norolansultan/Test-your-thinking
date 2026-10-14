/**
 * Game mode screen: the outline of a set of grid cells (the forecast's footprint) as closed rings along the cells'
 * edges, in local metres. Pure, deterministic (cells are visited in index order), tested.
 */

import type { GameGrid, XY } from "../contracts.js";

/**
 * Closed rings around the cells where `inSet(cell)` holds. Each ring is a list of corner points, first point repeated
 * last; collinear corners are dropped. Rings run clockwise on a north-up map around a filled region.
 */
export function cellOutline(grid: Pick<GameGrid, "cols" | "rows" | "cellM">, inSet: (cell: number) => boolean): XY[][] {
  const { cols, rows, cellM } = grid;
  const vcols = cols + 1;
  const has = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols && inSet(r * cols + c);
  // Directed boundary edges, keyed by their start corner (a corner may start two edges where cells touch diagonally).
  const out = new Map<number, number[]>();
  const add = (a: number, b: number) => {
    const list = out.get(a);
    if (list) list.push(b);
    else out.set(a, [b]);
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!inSet(r * cols + c)) continue;
      const nw = r * vcols + c, ne = nw + 1, sw = nw + vcols, se = sw + 1;
      if (!has(r - 1, c)) add(nw, ne);
      if (!has(r, c + 1)) add(ne, se);
      if (!has(r + 1, c)) add(se, sw);
      if (!has(r, c - 1)) add(sw, nw);
    }
  }
  const starts = [...out.keys()].sort((a, b) => a - b);
  const rings: XY[][] = [];
  const corner = (v: number): XY => ({ x: (v % vcols) * cellM, y: (rows - Math.floor(v / vcols)) * cellM });
  for (const s of starts) {
    while ((out.get(s)?.length ?? 0) > 0) {
      const ring: number[] = [s];
      let v = s;
      for (let guard = 0; guard < 4 * (rows + 1) * vcols; guard++) {
        const list = out.get(v);
        const next = list?.shift();
        if (next === undefined) break;
        ring.push(next);
        v = next;
        if (v === s) break;
      }
      if (ring.length >= 4 && ring[ring.length - 1] === s) rings.push(simplify(ring.map(corner)));
    }
  }
  return rings;
}

/** Drops corners that lie on a straight run (keeps the ring closed). */
function simplify(ring: XY[]): XY[] {
  if (ring.length <= 4) return ring;
  const pts = ring.slice(0, -1);
  const keep: XY[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n]!, b = pts[i]!, c = pts[(i + 1) % n]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross !== 0) keep.push(b);
  }
  if (keep.length < 3) return ring;
  keep.push(keep[0]!);
  return keep;
}

/** The ring point furthest north (then west): where the outline's label goes. */
export function labelPoint(rings: readonly (readonly XY[])[]): XY | null {
  let best: XY | null = null;
  for (const ring of rings) for (const p of ring) if (best === null || p.y > best.y || (p.y === best.y && p.x < best.x)) best = p;
  return best;
}
