/**
 * Game mode, live fire model: ember flights (spotting) and the brook's ember leak.
 *
 * Randomness is a deterministic integer hash of (seed, source cell, step index, salt) — the same
 * scenario, seed and command log give the same spot fires (contracts.ts header; SPEC/00 §3 I1).
 * All coefficients PROVISIONAL.
 */

import { FUEL, type GameGrid } from "../contracts.js";
import { NB_DC, NB_DR } from "./cells.js";
import { FUEL_PROPS } from "./fuels.js";
import { hash01, hashNormal, wetMoisturePct, type StepWeather } from "./ros.js";

/** Embers per minute from a crowning cell at 10 m/s (scaled by wind 0.3–1.5×). PROVISIONAL */
export const CROWN_EMBERS_PER_MIN = 0.03;
/** Surface intensity from which a head fire throws short-range embers, kW/m (≈ flame lengths > 2.5 m). PROVISIONAL */
export const SURFACE_SPOT_MIN_KWM = 1500;
/** Embers per minute from such a surface cell at 3 000 kW/m (scaled 0–2×). PROVISIONAL */
export const SURFACE_EMBERS_PER_MIN = 0.01;
/** Median ember distance per m/s of wind: crown fires 15 m (150 m at 10 m/s), surface 2.5 m. PROVISIONAL */
export const CROWN_SPOT_M_PER_MS = 15;
export const SURFACE_SPOT_M_PER_MS = 2.5;
/** Log-normal spread of the distance (σ of ln d): 10 m/s crown spots 56–400 m (5–95 %), rarely ~700 m. PROVISIONAL */
export const SPOT_SIGMA = 0.6;
export const CROWN_SPOT_MAX_M = 800;
export const SURFACE_SPOT_MAX_M = 150;
/** Embers scatter ± this much about the wind's heading, degrees. PROVISIONAL */
export const SPOT_SCATTER_DEG = 20;
/** Game rule: an ember never crosses more than this many contiguous water cells (a lake stops everything). */
export const MAX_WATER_JUMP_CELLS = 2;
/** Fine-fuel moisture above which embers do not take, % (ignition probability falls linearly from 4 %). PROVISIONAL */
export const SPOT_MOISTURE_LIMIT_PCT = 20;
/** Ember leak across a brook per minute from a cell burning at 1 000 kW/m beside it (SPEC/24 §12's 3 % leak, per minute here). PROVISIONAL */
export const BROOK_LEAK_PER_MIN = 0.003;

export const SALT = { launch: 1, distance: 2, direction: 3, ignite: 4, brook: 5, brookIgnite: 6, rekindle: 7 } as const;

/** What the ember model needs to read from the sim. */
export interface EmberContext {
  readonly grid: GameGrid;
  readonly fuel: Uint8Array;
  readonly state: Uint8Array;
  readonly wetness: Float32Array;
  readonly seed: number;
  readonly unburned: number;
}

/** Probability that an ember landing in `cell` starts a fire. */
export function emberIgnitionProbability(ctx: EmberContext, cell: number, sw: StepWeather): number {
  const props = FUEL_PROPS[ctx.fuel[cell]!];
  if (!props || !props.burnable) return 0;
  const wet = ctx.wetness[cell]!;
  const m = sw.mFine + wetMoisturePct(wet);
  const dryness = Math.min(1, Math.max(0, (SPOT_MOISTURE_LIMIT_PCT - m) / (SPOT_MOISTURE_LIMIT_PCT - 4)));
  return props.emberReceptivity * dryness;
}

/** True when the straight flight from (x0, y0) to (x1, y1) crosses more than the allowed run of water. */
export function crossesWideWater(ctx: EmberContext, x0: number, y0: number, x1: number, y1: number): boolean {
  const { cols, rows, cellM } = ctx.grid;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(len / (cellM / 3)));
  let last = -1;
  let run = 0;
  for (let s = 0; s <= n; s++) {
    const x = x0 + ((x1 - x0) * s) / n;
    const y = y0 + ((y1 - y0) * s) / n;
    const c = Math.floor(x / cellM);
    const r = rows - 1 - Math.floor(y / cellM);
    if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
    const cell = r * cols + c;
    if (cell === last) continue;
    last = cell;
    if (ctx.fuel[cell] === FUEL.water) {
      run++;
      if (run > MAX_WATER_JUMP_CELLS) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

/**
 * One ember from `src` (a crowning cell, or a strong surface head): returns the cell it lights, or
 * −1. Distance log-normal about a wind-scaled median, direction the wind's heading ± scatter.
 */
export function emberFlight(ctx: EmberContext, src: number, crown: boolean, sw: StepWeather, stepIndex: number): number {
  const { cols, rows, cellM } = ctx.grid;
  const u = sw.uMs;
  const median = crown ? Math.max(40, CROWN_SPOT_M_PER_MS * u) : Math.max(10, SURFACE_SPOT_M_PER_MS * u);
  const z = hashNormal(ctx.seed, src, stepIndex, SALT.distance);
  const dist = Math.min(crown ? CROWN_SPOT_MAX_M : SURFACE_SPOT_MAX_M, median * Math.exp(SPOT_SIGMA * z));
  const jitter = (hash01(ctx.seed, src, stepIndex, SALT.direction) - 0.5) * 2 * (SPOT_SCATTER_DEG * Math.PI) / 180;
  const bearing = sw.headingRad + jitter;
  const c0 = src % cols;
  const r0 = (src - c0) / cols;
  const x0 = (c0 + 0.5) * cellM;
  const y0 = (rows - r0 - 0.5) * cellM;
  const x1 = x0 + dist * Math.sin(bearing);
  const y1 = y0 + dist * Math.cos(bearing);
  const c1 = Math.floor(x1 / cellM);
  const r1 = rows - 1 - Math.floor(y1 / cellM);
  if (c1 < 0 || r1 < 0 || c1 >= cols || r1 >= rows) return -1;
  const cell = r1 * cols + c1;
  if (cell === src || ctx.state[cell] !== ctx.unburned) return -1;
  if (crossesWideWater(ctx, x0, y0, x1, y1)) return -1;
  return hash01(ctx.seed, src, stepIndex, SALT.ignite) < emberIgnitionProbability(ctx, cell, sw) ? cell : -1;
}

/**
 * The brook's leak: an ember from `src` across the brook cell in 8-direction (dc, dr), landing on
 * the first non-brook cell within 4 cells. Returns the cell it lights, or −1.
 */
export function brookLeak(ctx: EmberContext, src: number, dc: number, dr: number, sw: StepWeather, stepIndex: number): number {
  const { cols, rows } = ctx.grid;
  const c0 = src % cols;
  const r0 = (src - c0) / cols;
  for (let j = 1; j <= 4; j++) {
    const c = c0 + dc * j;
    const r = r0 - dr * j;
    if (c < 0 || r < 0 || c >= cols || r >= rows) return -1;
    const cell = r * cols + c;
    if (ctx.fuel[cell] === FUEL.brook) continue;
    if (ctx.state[cell] !== ctx.unburned) return -1;
    return hash01(ctx.seed, src, stepIndex, SALT.brookIgnite) < emberIgnitionProbability(ctx, cell, sw) ? cell : -1;
  }
  return -1;
}

/**
 * A burning cell's embers this step. A crowning cell launches at CROWN_EMBERS_PER_MIN (wind-scaled),
 * a strong surface head at SURFACE_EMBERS_PER_MIN; a cell beside a brook leaks across it toward the
 * most downwind brook side. Pushes (cell, fromCell) pairs for the spot fires that take.
 */
export function launchEmbers(
  ctx: EmberContext, brooks: number, src: number, crown: boolean, surfaceKWm: number, intensityKWm: number,
  sw: StepWeather, dtS: number, stepIndex: number, out: number[],
): void {
  let rate = 0;
  if (crown) rate = CROWN_EMBERS_PER_MIN * Math.min(1.5, Math.max(0.3, sw.uMs / 10));
  else if (surfaceKWm >= SURFACE_SPOT_MIN_KWM) rate = SURFACE_EMBERS_PER_MIN * Math.min(2, surfaceKWm / 3000);
  if (rate > 0 && hash01(ctx.seed, src, stepIndex, SALT.launch) < (rate * dtS) / 60) {
    const cell = emberFlight(ctx, src, crown, sw, stepIndex);
    if (cell >= 0) out.push(cell, src);
  }
  if (brooks === 0 || intensityKWm <= 0) return;
  let best = -1;
  for (let j = 0; j < 8; j++) if ((brooks & (1 << j)) !== 0 && (best < 0 || sw.windK[2 * j]! > sw.windK[2 * best]!)) best = j;
  if (best < 0 || sw.windK[2 * best]! < 0.25 * sw.windKMax) return;
  const p = (BROOK_LEAK_PER_MIN * Math.min(2, intensityKWm / 1000) * dtS) / 60;
  if (hash01(ctx.seed, src, stepIndex, SALT.brook) < p) {
    const cell = brookLeak(ctx, src, NB_DC[2 * best]!, NB_DR[2 * best]!, sw, stepIndex);
    if (cell >= 0) out.push(cell, src);
  }
}
