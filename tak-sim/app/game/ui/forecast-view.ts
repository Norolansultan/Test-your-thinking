/**
 * Game mode screen: the forecast overlay — the fire model's expected footprint 20 and 40 minutes ahead under the
 * scenario's weather keys (`fire/forecast.ts`, a copy of the live fire run forward without random events), outlined.
 * Recomputed at most every `FORECAST_EVERY_S` game seconds.
 */

import type { GameGrid, GameState, WeatherKey, XY } from "../contracts.js";
import { forecastPerimeter } from "../fire/forecast.js";
import { cellOutline } from "./outline.js";

export const FORECAST_HORIZONS_MIN = [20, 40] as const;
export const FORECAST_EVERY_S = 30;

export interface ForecastView {
  readonly atS: number;
  readonly horizons: readonly { readonly min: number; readonly rings: readonly (readonly XY[])[] }[];
}

/** Whether a forecast made at `lastAtS` (null: none yet) is due again at `nowS`. */
export function forecastDue(lastAtS: number | null, nowS: number): boolean {
  return lastAtS === null || nowS - lastAtS >= FORECAST_EVERY_S || nowS < lastAtS;
}

export function computeForecast(state: GameState, weather: readonly WeatherKey[], grid: GameGrid): ForecastView {
  const horizons = FORECAST_HORIZONS_MIN.map((min) => {
    const f = forecastPerimeter(state.fire, weather, min * 60);
    const mask = new Uint8Array(f.state.length);
    for (const c of f.footprint) mask[c] = 1;
    return { min, rings: cellOutline(grid, (c) => mask[c] === 1) };
  });
  return { atS: state.tS, horizons };
}
