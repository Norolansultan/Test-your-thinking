/**
 * Game mode, the "AI forecast" tool: where the fire will be in `horizonS` seconds if the weather is
 * as given. Runs a COPY of the live fire forward without its hashed random events (no spotting,
 * brook leaks or rekindles) — the forecast is the model's deterministic expectation, and it cannot
 * know which embers will take. The live sim is never mutated.
 */

import { CELL, type FireSim, type Weather, type WeatherKey } from "../contracts.js";
import { weatherAt } from "../weather/weather.js";
import { prepareWeather } from "./ros.js";
import { LiveFireSim } from "./spread.js";

/**
 * Forecast steps are coarser than the live 10 s step (the front's overshoot carries into the next
 * cell, so rates hold) but short enough that the fastest front advances at most one cell per step.
 */
export const FORECAST_STEP_MIN_S = 10;
export const FORECAST_STEP_MAX_S = 120;

/** The adaptive forecast step for `w`: the fastest rate on the map crosses ≤ 1 cell. */
export function forecastStepS(w: Weather, cellM: number): number {
  const ros = prepareWeather(w).rosFD;
  let max = 0;
  for (let i = 0; i < ros.length; i++) max = Math.max(max, ros[i]!);
  if (max <= 0) return FORECAST_STEP_MAX_S;
  // Whole seconds, so the steps add up to the horizon exactly.
  return Math.floor(Math.min(FORECAST_STEP_MAX_S, Math.max(FORECAST_STEP_MIN_S, (cellM * 60) / max)));
}

export interface PerimeterForecast {
  /** Simulation time the forecast is for (live tS + horizon), s. */
  readonly atS: number;
  readonly horizonS: number;
  /** Per-cell `CellState` at the horizon (a copy owned by the caller). */
  readonly state: Uint8Array;
  /** Cells flaming at the horizon, ascending. */
  readonly burning: readonly number[];
  /** Cells the fire has reached by the horizon (burning, smouldering, burned out, extinguished), ascending. */
  readonly footprint: readonly number[];
  /** Footprint cells the live fire has not reached yet, ascending. */
  readonly newCells: readonly number[];
  /** As `FireStepReport.burnedHa`, at the horizon. */
  readonly burnedHa: number;
}

function reached(s: number): boolean {
  return s === CELL.burning || s === CELL.smouldering || s === CELL.burnedOut || s === CELL.extinguished;
}

/**
 * Runs a copy of `fire` for `horizonS` under `weather` (fixed, or keyframes on the sim's clock) and
 * returns the cells it would have reached. `fire` must come from `createFireSim`. `stepS` fixes the
 * step (default: adaptive, `forecastStepS`).
 */
export function forecastPerimeter(
  fire: FireSim,
  weather: Weather | readonly WeatherKey[],
  horizonS: number,
  stepS?: number,
): PerimeterForecast {
  if (!(fire instanceof LiveFireSim)) throw new TypeError("forecastPerimeter: the fire must come from createFireSim");
  if (stepS !== undefined && !(stepS > 0)) throw new RangeError("forecastPerimeter: stepS must be positive");
  const copy = fire.clone({ randomEvents: false });
  const keys = Array.isArray(weather) ? (weather as readonly WeatherKey[]) : null;
  const fixed = keys ? null : (weather as Weather);
  const horizon = Math.max(0, horizonS);
  const endS = fire.tS + horizon;
  const cellM = copy.cellSizeM;
  while (copy.tS < endS) {
    const w = fixed ?? weatherAt(keys!, copy.tS);
    const left = endS - copy.tS;
    const dt = Math.min(stepS ?? forecastStepS(w, cellM), left);
    if (dt < 1e-6) break;
    copy.step(dt, w);
  }
  const live = fire.state;
  const state = copy.state;
  const burning: number[] = [];
  const footprint: number[] = [];
  const newCells: number[] = [];
  for (let i = 0; i < state.length; i++) {
    const s = state[i]!;
    if (s < CELL.burning) continue; // noFuel, unburned
    if (s === CELL.burning) burning.push(i);
    footprint.push(i);
    if (!reached(live[i]!)) newCells.push(i);
  }
  return { atS: endS, horizonS: horizon, state, burning, footprint, newCells, burnedHa: copy.burnedHa };
}
