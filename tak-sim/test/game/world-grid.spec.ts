/**
 * Game mode (SPEC/29): grid helpers (`app/game/world/grid.ts`) — local metres, row 0 north.
 */

import { describe, expect, it } from "vitest";
import type { GameGrid } from "../../app/game/contracts.js";
import { bearingDeg, cellCentre, cellOf, cellRowCol, cellsAlongLine, cellsInCircle, distance, inGrid, neighbours8, slopeBetween } from "../../app/game/world/grid.js";
import { getWorld } from "../../app/game/world/load.js";

const grid: GameGrid = { cols: 400, rows: 400, cellM: 25, originTm35: { east: 514_000, north: 6_741_000 } };
const ascending = (xs: readonly number[]) => xs.every((v, i) => i === 0 || xs[i - 1]! < v);

describe("cellOf / cellCentre", () => {
  it("counts rows from the north edge", () => {
    expect(cellOf(grid, { x: 0, y: 0 })).toBe(399 * 400); // south-west corner: last row, first column
    expect(cellOf(grid, { x: 12.5, y: 9999 })).toBe(0); // north-west corner
    expect(cellOf(grid, { x: 9999.9, y: 9999.9 })).toBe(399); // north-east
    expect(cellOf(grid, { x: 9999.9, y: 0.1 })).toBe(160_000 - 1); // south-east
    expect(cellOf(grid, { x: 5000, y: 5000 })).toBe(199 * 400 + 200);
    expect(cellRowCol(grid, 199 * 400 + 200)).toEqual({ row: 199, col: 200 });
  });

  it("is −1 off the grid (its north and east edges are outside)", () => {
    for (const p of [{ x: -0.1, y: 10 }, { x: 10, y: -0.1 }, { x: 10_000, y: 10 }, { x: 10, y: 10_000 }, { x: Number.NaN, y: 0 }]) {
      expect(cellOf(grid, p)).toBe(-1);
      expect(inGrid(grid, p)).toBe(false);
    }
  });

  it("round-trips through the cell centre, and takes the world as well as the grid", () => {
    const world = getWorld();
    for (const cell of [0, 399, 400, 12_345, 80_200, 159_999]) {
      const c = cellCentre(grid, cell);
      expect(cellOf(grid, c)).toBe(cell);
      expect(cellOf(world, c)).toBe(cell);
    }
    expect(cellCentre(grid, 0)).toEqual({ x: 12.5, y: 9987.5 });
    expect(cellCentre(world, 399 * 400)).toEqual({ x: 12.5, y: 12.5 });
  });
});

describe("neighbours8", () => {
  it("lists the eight (or fewer at the edge) in ascending order", () => {
    const mid = 200 * 400 + 200;
    const n = neighbours8(grid, mid);
    expect(n).toEqual([mid - 401, mid - 400, mid - 399, mid - 1, mid + 1, mid + 399, mid + 400, mid + 401]);
    expect(neighbours8(grid, 0)).toEqual([1, 400, 401]);
    expect(neighbours8(grid, 399)).toEqual([398, 798, 799]);
    expect(neighbours8(grid, 159_999)).toEqual([159_598, 159_599, 159_998]);
    expect(neighbours8(grid, 400)).toHaveLength(5);
  });
});

describe("cellsInCircle", () => {
  it("returns the cells whose centres are within r, ascending, always the centre's own cell", () => {
    const c = cellCentre(grid, 200 * 400 + 200);
    expect(cellsInCircle(grid, c, 0)).toEqual([200 * 400 + 200]);
    expect(cellsInCircle(grid, { x: c.x + 10, y: c.y }, 1)).toEqual([200 * 400 + 200]);
    expect(cellsInCircle(grid, c, 25)).toHaveLength(5);
    expect(cellsInCircle(grid, c, 36)).toHaveLength(9);
    const big = cellsInCircle(grid, c, 500);
    expect(ascending(big)).toBe(true);
    expect(big.length).toBeGreaterThan(Math.PI * 19 * 19);
    expect(big.length).toBeLessThan(Math.PI * 21 * 21);
    expect(cellsInCircle(grid, { x: 0, y: 0 }, 30).length).toBeLessThan(5); // clipped at the corner
    expect(cellsInCircle(grid, { x: -500, y: -500 }, 30)).toEqual([]);
  });
});

describe("cellsAlongLine", () => {
  it("covers the cells a line passes through, widened by widthM", () => {
    const row = 200;
    const y = (400 - row - 0.5) * 25; // centre line of row 200
    const thin = cellsAlongLine(grid, { x: 1000, y }, { x: 1100, y }, 0);
    expect(thin).toEqual([row * 400 + 40, row * 400 + 41, row * 400 + 42, row * 400 + 43, row * 400 + 44]);
    // 50 m wide: the rows either side (centres 25 m off the line, within the segment's span), and the cell west of
    // the start whose centre is 12.5 m from it.
    const wide = cellsAlongLine(grid, { x: 1000, y }, { x: 1100, y }, 50);
    const at = (r: number, cols: number[]) => cols.map((c) => r * 400 + c);
    expect(wide).toEqual([...at(row - 1, [40, 41, 42, 43]), ...at(row, [39, 40, 41, 42, 43, 44]), ...at(row + 1, [40, 41, 42, 43])]);
    expect(ascending(wide)).toBe(true);
    const diag = cellsAlongLine(grid, { x: 1000, y: 1000 }, { x: 1250, y: 1250 }, 0);
    expect(diag.length).toBeGreaterThanOrEqual(11);
    expect(ascending(diag)).toBe(true);
    for (const cell of diag) {
      const c = cellCentre(grid, cell);
      expect(Math.abs(c.x - c.y)).toBeLessThan(40); // along the diagonal
    }
    expect(cellsAlongLine(grid, { x: 500, y: 500 }, { x: 500, y: 500 }, 0)).toEqual([cellOf(grid, { x: 500, y: 500 })]);
  });
});

describe("distance, bearing, slope", () => {
  it("measures metres and compass bearings", () => {
    const o = { x: 100, y: 100 };
    expect(distance(o, { x: 103, y: 104 })).toBe(5);
    expect(bearingDeg(o, { x: 100, y: 200 })).toBe(0);
    expect(bearingDeg(o, { x: 200, y: 100 })).toBe(90);
    expect(bearingDeg(o, { x: 100, y: 0 })).toBe(180);
    expect(bearingDeg(o, { x: 0, y: 100 })).toBe(270);
    expect(bearingDeg(o, { x: 200, y: 200 })).toBeCloseTo(45, 10);
  });

  it("gives the rise over run between cell centres", () => {
    const world = getWorld();
    const a = 200 * 400 + 200;
    const b = a + 1;
    const expected = (world.elevation[b]! - world.elevation[a]!) / 25;
    expect(slopeBetween(world, a, b)).toBeCloseTo(expected, 10);
    expect(slopeBetween(world, b, a)).toBeCloseTo(-expected, 10);
    expect(slopeBetween(world, a, a + 401)).toBeCloseTo((world.elevation[a + 401]! - world.elevation[a]!) / (25 * Math.SQRT2), 10);
    expect(slopeBetween(world, a, a)).toBe(0);
  });
});
