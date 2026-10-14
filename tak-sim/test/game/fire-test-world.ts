/**
 * Synthetic and real worlds for the live fire model's tests (test/game/fire*.spec.ts). The real
 * grids are parsed here from content/site/*.asc, independently of the game's world loader.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CELL, FUEL, type Weather } from "../../app/game/contracts.js";
import type { FireWorld, LiveFireSim } from "../../app/game/fire/spread.js";

export const CELL_M = 25;

export interface TestWorld extends FireWorld {
  readonly fuel: Uint8Array;
  readonly elevation: Float32Array;
}

export function uniformWorld(cols: number, rows: number, fuel: number = FUEL.pine_heath): TestWorld {
  return {
    grid: { cols, rows, cellM: CELL_M, originTm35: { east: 0, north: 0 } },
    fuel: new Uint8Array(cols * rows).fill(fuel),
    elevation: new Float32Array(cols * rows),
  };
}

/** Index of (col, row), row 0 = north. */
export function idx(w: FireWorld, col: number, row: number): number {
  return row * w.grid.cols + col;
}

/** Sets a rectangle of cells (inclusive) to a fuel. */
export function fillRect(w: TestWorld, c0: number, r0: number, c1: number, r1: number, fuel: number): void {
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) w.fuel[idx(w, c, r)] = fuel;
}

/** Local metres of a cell's centre (x east, y north from the SW corner). */
export function centreOf(w: FireWorld, cell: number): { x: number; y: number } {
  const { cols, rows, cellM } = w.grid;
  const c = cell % cols;
  const r = Math.floor(cell / cols);
  return { x: (c + 0.5) * cellM, y: (rows - r - 0.5) * cellM };
}

export function wx(windFromDeg: number, windMs: number, rh = 30, tempC = 20, gustMs = windMs): Weather {
  return { windFromDeg, windMs, gustMs, tempC, rh };
}

export function run(sim: LiveFireSim, steps: number, w: Weather, dtS = 10): { spots: number; rekindled: number } {
  let spots = 0;
  let rekindled = 0;
  for (let s = 0; s < steps; s++) {
    const rep = sim.step(dtS, w);
    spots += rep.spotFires.length;
    rekindled += rep.rekindled.length;
  }
  return { spots, rekindled };
}

export function isReached(s: number): boolean {
  return s === CELL.burning || s === CELL.smouldering || s === CELL.burnedOut || s === CELL.extinguished;
}

/** Extent of the burned footprint along the wind's heading and across it, metres (cell-centre extents + 1 cell). */
export function extents(sim: LiveFireSim, w: FireWorld, headingDeg: number): { length: number; breadth: number; ahead: number; cells: number } {
  const { cols, cellM } = w.grid;
  const h = (headingDeg * Math.PI) / 180;
  const ux = Math.sin(h);
  const uy = Math.cos(h);
  let amin = Infinity, amax = -Infinity, pmin = Infinity, pmax = -Infinity, cells = 0;
  for (let i = 0; i < sim.state.length; i++) {
    if (!isReached(sim.state[i]!)) continue;
    cells++;
    const x = i % cols;
    const y = -Math.floor(i / cols);
    const a = x * ux + y * uy;
    const p = -x * uy + y * ux;
    amin = Math.min(amin, a); amax = Math.max(amax, a);
    pmin = Math.min(pmin, p); pmax = Math.max(pmax, p);
  }
  return { length: (amax - amin + 1) * cellM, breadth: (pmax - pmin + 1) * cellM, ahead: amax * cellM, cells };
}

function parseAsc(path: string): { cols: number; rows: number; values: Float64Array } {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const header = new Map<string, number>();
  let li = 0;
  for (; li < lines.length; li++) {
    const m = /^\s*([A-Za-z_]+)\s+(-?[\d.eE+-]+)\s*$/.exec(lines[li]!);
    if (!m) break;
    header.set(m[1]!.toLowerCase(), Number(m[2]));
  }
  const cols = header.get("ncols")!;
  const rows = header.get("nrows")!;
  const values = new Float64Array(cols * rows);
  let r = 0; // file order: north row first = the game's row 0
  for (; li < lines.length && r < rows; li++) {
    const parts = lines[li]!.trim().split(/\s+/);
    if (parts.length !== cols) continue;
    for (let c = 0; c < cols; c++) values[r * cols + c] = Number(parts[c]);
    r++;
  }
  if (r !== rows) throw new Error(`${path}: ${r} rows, expected ${rows}`);
  return { cols, rows, values };
}

/** content/site's truth fuel and elevation grids as a fire world (400 × 400 cells of 25 m). */
export function loadSiteWorld(): TestWorld {
  const dir = fileURLToPath(new URL("../../content/site/", import.meta.url));
  const fuel = parseAsc(dir + "fuel_truth.asc");
  const elev = parseAsc(dir + "elevation.asc");
  return {
    grid: { cols: fuel.cols, rows: fuel.rows, cellM: CELL_M, originTm35: { east: 514_000, north: 6_741_000 } },
    fuel: Uint8Array.from(fuel.values),
    elevation: Float32Array.from(elev.values),
  };
}
