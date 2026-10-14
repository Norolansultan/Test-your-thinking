/**
 * Game mode (SPEC/29): the 25 m grid in local metres (`contracts.ts`).
 *
 * Local metres: x east, y north, origin at the grid's south-west corner. Cells are indexed `row * cols + col` with
 * row 0 at the NORTH edge (as in the .asc files), so a point's row is counted down from the top. A point on a cell's
 * south or west edge belongs to that cell; the grid's own north and east edges are outside it.
 *
 * Every list of cells comes back in ascending cell index (row-major from the north-west corner), never in discovery
 * order, so callers iterate them deterministically. Distances use `Math.sqrt` (exactly rounded) rather than
 * `Math.hypot` (implementation-defined precision).
 */

import type { GameGrid, GameWorld, XY } from "../contracts.js";

/** A grid, or anything that carries one (the world). */
export type GridLike = GameGrid | { readonly grid: GameGrid };

const gridOf = (g: GridLike): GameGrid => ("grid" in g ? g.grid : g);

/** Straight-line distance, metres. */
export function distance(a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Compass bearing from `a` to `b`, degrees true in [0, 360): 0 north, 90 east (grid north; ~0.3° from true here). */
export function bearingDeg(a: XY, b: XY): number {
  const deg = (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}

/** True when `xy` lies on the grid. */
export function inGrid(g: GridLike, xy: XY): boolean {
  return cellOf(g, xy) >= 0;
}

/** The cell containing `xy`, or −1 off the grid. */
export function cellOf(g: GridLike, xy: XY): number | -1 {
  const grid = gridOf(g);
  const col = Math.floor(xy.x / grid.cellM);
  const rowFromSouth = Math.floor(xy.y / grid.cellM);
  if (!(col >= 0 && col < grid.cols && rowFromSouth >= 0 && rowFromSouth < grid.rows)) return -1;
  return (grid.rows - 1 - rowFromSouth) * grid.cols + col;
}

/** A cell's row (0 = north) and column (0 = west). */
export function cellRowCol(g: GridLike, cell: number): { readonly row: number; readonly col: number } {
  const grid = gridOf(g);
  return { row: Math.floor(cell / grid.cols), col: cell % grid.cols };
}

/** The centre of a cell, local metres. */
export function cellCentre(g: GridLike, cell: number): XY {
  const grid = gridOf(g);
  const col = cell % grid.cols;
  const row = Math.floor(cell / grid.cols);
  return { x: (col + 0.5) * grid.cellM, y: (grid.rows - row - 0.5) * grid.cellM };
}

/** The (up to) eight cells around `cell`, ascending. */
export function neighbours8(g: GridLike, cell: number): number[] {
  const grid = gridOf(g);
  const row = Math.floor(cell / grid.cols);
  const col = cell % grid.cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    const r = row + dr;
    if (r < 0 || r >= grid.rows) continue;
    for (let dc = -1; dc <= 1; dc++) {
      const c = col + dc;
      if ((dr === 0 && dc === 0) || c < 0 || c >= grid.cols) continue;
      out.push(r * grid.cols + c);
    }
  }
  return out;
}

/** Row/column bounds (inclusive, clamped to the grid) of the cells an axis-aligned box can touch. */
function cellBounds(grid: GameGrid, x0: number, y0: number, x1: number, y1: number) {
  const c0 = Math.max(0, Math.floor(x0 / grid.cellM));
  const c1 = Math.min(grid.cols - 1, Math.floor(x1 / grid.cellM));
  const r0 = Math.max(0, grid.rows - 1 - Math.floor(y1 / grid.cellM));
  const r1 = Math.min(grid.rows - 1, grid.rows - 1 - Math.floor(y0 / grid.cellM));
  return { c0, c1, r0, r1 };
}

/**
 * The cells whose centres lie within `radiusM` of `centre`, plus the cell containing `centre` itself (so a radius
 * smaller than half a cell still hits the cell it is in). Ascending.
 */
export function cellsInCircle(g: GridLike, centre: XY, radiusM: number): number[] {
  const grid = gridOf(g);
  const r = Math.max(0, radiusM);
  const own = cellOf(grid, centre);
  const { c0, c1, r0, r1 } = cellBounds(grid, centre.x - r, centre.y - r, centre.x + r, centre.y + r);
  const out: number[] = [];
  const r2 = r * r;
  for (let row = r0; row <= r1; row++) {
    const cy = (grid.rows - row - 0.5) * grid.cellM;
    for (let col = c0; col <= c1; col++) {
      const cell = row * grid.cols + col;
      const dx = (col + 0.5) * grid.cellM - centre.x;
      const dy = cy - centre.y;
      if (cell === own || dx * dx + dy * dy <= r2) out.push(cell);
    }
  }
  return out;
}

/** Squared distance from `p` to the segment a–b. */
function segDist2(px: number, py: number, a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
  const ex = a.x + t * dx - px;
  const ey = a.y + t * dy - py;
  return ex * ex + ey * ey;
}

/** True when the segment a–b passes through the box [x0, x1] × [y0, y1] (Liang–Barsky). */
function segmentHitsBox(a: XY, b: XY, x0: number, y0: number, x1: number, y1: number): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    return true;
  };
  return clip(-dx, a.x - x0) && clip(dx, x1 - a.x) && clip(-dy, a.y - y0) && clip(dy, y1 - a.y);
}

/**
 * The cells a line from `a` to `b` covers at `widthM` wide: every cell the segment passes through, plus every cell
 * whose centre lies within `widthM / 2` of it (a fire break, a hose line, a road). Ascending.
 */
export function cellsAlongLine(g: GridLike, a: XY, b: XY, widthM: number): number[] {
  const grid = gridOf(g);
  const half = Math.max(0, widthM) / 2;
  const { c0, c1, r0, r1 } = cellBounds(grid, Math.min(a.x, b.x) - half, Math.min(a.y, b.y) - half, Math.max(a.x, b.x) + half, Math.max(a.y, b.y) + half);
  const out: number[] = [];
  const h2 = half * half;
  for (let row = r0; row <= r1; row++) {
    const y0 = (grid.rows - row - 1) * grid.cellM;
    for (let col = c0; col <= c1; col++) {
      const x0 = col * grid.cellM;
      const near = segDist2(x0 + grid.cellM / 2, y0 + grid.cellM / 2, a, b) <= h2;
      if (near || segmentHitsBox(a, b, x0, y0, x0 + grid.cellM, y0 + grid.cellM)) out.push(row * grid.cols + col);
    }
  }
  return out;
}

/**
 * The slope from cell `from` to cell `to`: rise over horizontal run between their centres (signed; positive uphill,
 * 0.1 = 10 %). 0 for the same cell.
 */
export function slopeBetween(world: Pick<GameWorld, "grid" | "elevation">, from: number, to: number): number {
  if (from === to) return 0;
  const run = distance(cellCentre(world.grid, from), cellCentre(world.grid, to));
  return ((world.elevation[to] ?? 0) - (world.elevation[from] ?? 0)) / run;
}
