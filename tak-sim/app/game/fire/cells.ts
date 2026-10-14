/**
 * Game mode, live fire model: grid geometry — the 16-neighbourhood as index offsets for a grid
 * width, circles of cells, brook adjacency. Row 0 is the north edge, index `row * cols + col`;
 * local metres x east, y north from the south-west corner (contracts.ts).
 */

import { FUEL, type GameGrid, type XY } from "../contracts.js";
import { NEIGHBOURS, N_NEIGHBOURS, slopeFactorBetween } from "./ros.js";

export const K = N_NEIGHBOURS;
/** Per neighbour: column offset (east), row offset (north) and kind (0 orthogonal, 1 diagonal, 2 knight). */
export const NB_DC = Int8Array.from(NEIGHBOURS, (n) => n.dc);
export const NB_DR = Int8Array.from(NEIGHBOURS, (n) => n.dr);
export const NB_KIND = Uint8Array.from(NEIGHBOURS, (n) => (n.kind === "orth" ? 0 : n.kind === "diag" ? 1 : 2));

/** The neighbourhood for one grid: index deltas, the cells the straight path passes, distances in metres. */
export interface NeighbourIndex {
  readonly delta: Int32Array;
  readonly via1: Int32Array;
  readonly via2: Int32Array;
  readonly distM: Float64Array;
}

export function neighbourIndex(grid: GameGrid): NeighbourIndex {
  const delta = new Int32Array(K);
  const via1 = new Int32Array(K);
  const via2 = new Int32Array(K);
  const distM = new Float64Array(K);
  for (let k = 0; k < K; k++) {
    const nb = NEIGHBOURS[k]!;
    delta[k] = nb.dc - nb.dr * grid.cols;
    const v1 = nb.via[0];
    const v2 = nb.via[1];
    via1[k] = v1 ? v1[0] - v1[1] * grid.cols : 0;
    via2[k] = v2 ? v2[0] - v2[1] * grid.cols : 0;
    distM[k] = nb.dist * grid.cellM;
  }
  return { delta, via1, via2, distM };
}

/** True when neighbour k of cell (c, r) lies on the grid. */
export function onGrid(grid: GameGrid, c: number, r: number, k: number): boolean {
  const nc = c + NB_DC[k]!;
  const nr = r - NB_DR[k]!;
  return nc >= 0 && nr >= 0 && nc < grid.cols && nr < grid.rows;
}

/** Per cell, bit j set when the 8-direction neighbour 2j is a brook (static: fuel only). */
export function brookMask(grid: GameGrid, fuel: Uint8Array): Uint8Array {
  const { cols, rows } = grid;
  const mask = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let m = 0;
      for (let j = 0; j < 8; j++) {
        const nc = c + NB_DC[2 * j]!;
        const nr = r - NB_DR[2 * j]!;
        if (nc >= 0 && nr >= 0 && nc < cols && nr < rows && fuel[nr * cols + nc] === FUEL.brook) m |= 1 << j;
      }
      mask[r * cols + c] = m;
    }
  }
  return mask;
}

/** Cells whose centre lies within `radiusM` of `centre`; the containing cell when none does. */
export function cellsInCircle(grid: GameGrid, centre: XY, radiusM: number): number[] {
  const { cols, rows, cellM } = grid;
  const out: number[] = [];
  const rad = Math.max(0, radiusM);
  const c0 = Math.max(0, Math.floor((centre.x - rad) / cellM));
  const c1 = Math.min(cols - 1, Math.floor((centre.x + rad) / cellM));
  const s0 = Math.max(0, Math.floor((centre.y - rad) / cellM));
  const s1 = Math.min(rows - 1, Math.floor((centre.y + rad) / cellM));
  for (let s = s1; s >= s0; s--) {
    for (let c = c0; c <= c1; c++) {
      const dx = (c + 0.5) * cellM - centre.x;
      const dy = (s + 0.5) * cellM - centre.y;
      if (dx * dx + dy * dy <= rad * rad) out.push((rows - 1 - s) * cols + c);
    }
  }
  if (out.length === 0) {
    const c = Math.floor(centre.x / cellM);
    const s = Math.floor(centre.y / cellM);
    if (c >= 0 && s >= 0 && c < cols && s < rows) out.push((rows - 1 - s) * cols + c);
  }
  return out;
}

/** True when one of cell i's 8 neighbours is in state `s`. */
export function has8Neighbour(grid: GameGrid, nb: NeighbourIndex, state: Uint8Array, i: number, s: number): boolean {
  const c = i % grid.cols;
  const r = (i - c) / grid.cols;
  for (let k = 0; k < K; k += 2) if (onGrid(grid, c, r, k) && state[i + nb.delta[k]!] === s) return true;
  return false;
}

/** Slope factor between two elevations that ignores missing ones (nodata, NaN). */
export function safeSlope(z0: number, z1: number, distM: number): number {
  if (!(z0 > -1000 && z1 > -1000)) return 1;
  return slopeFactorBetween(z0, z1, distM);
}
