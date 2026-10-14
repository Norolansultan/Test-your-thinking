/**
 * Game mode, live fire model: the rate-of-spread equations, the 16-cell neighbourhood and the
 * integer hash. Pure functions; spread.ts holds the state.
 *
 *   ROS(θ) = R0(fuel) · φ_w(U, θ) · φ_s(slope) · φ_M(moisture) · φ_c               [m/min]
 *   φ_w    = (1 + A·U^B) · (1 − e) / (1 − e·cos θ)       θ from the wind's heading
 *   e      = √(1 − 1/LB(U)²)                            ellipse eccentricity
 *   φ_s    = exp(0.069·s) upslope, exp(0.0345·s) downslope (s in degrees, floor 0.3)
 *   φ_M    = g(M)/g(M_REF),  g(M) = exp(−0.1386·M)·(1 − (M/M_X)²)
 *   φ_c    = the fuel's crown factor when a head fire in it would crown (Byram I ≥ threshold), else 1
 *
 * φ_w is the polar equation of an ellipse seen from its rear focus (the ignition point): head
 * R0(1 + A·U^B), back = head/(LB + √(LB² − 1))² (Anderson 1983; Alexander 1985), and a point fire
 * grows into that ellipse when every ray spreads at its own rate (Huygens), as the minimum-travel-
 * time front of spread.ts does on the 16-neighbourhood. U is the effective wind (mean plus a quarter
 * of the gust excess). All coefficients are PROVISIONAL.
 */

import type { GameWorld, Weather } from "../contracts.js";
import { fineFuelMoisture } from "../weather/weather.js";
import { FUEL_PROPS, HEAT_KJ_KG } from "./fuels.js";

// ---------------------------------------------------------------------------------------------
// Coefficients (PROVISIONAL)
// ---------------------------------------------------------------------------------------------

/** Head wind factor 1 + A·U^B: ×3.2 at 5 m/s, ×4 at 6, ×6.4 at 9, ×11.5 at 14 (Rothermel-like U^1.5). PROVISIONAL */
export const WIND_A = 0.2;
export const WIND_B = 1.5;
/** Share of the gust excess over the mean that drives the fire (the study's truth ran on the gust, SPEC/24 §5). PROVISIONAL */
export const GUST_WEIGHT = 0.25;
/** Length-to-breadth cap (Alexander 1985 tops out near 8 for forest fuels). PROVISIONAL */
export const LB_MAX = 8;
/** Slope exponent per degree upslope (Butler et al. 2007 / Sharples: ROS doubles per ~10°). PROVISIONAL */
export const SLOPE_UP = 0.069;
/** Downslope fires slow, half as strongly (PROVISIONAL), never below 0.3 of the flat rate. */
export const SLOPE_DOWN = 0.0345;
export const SLOPE_DOWN_FLOOR = 0.3;
/** Reference fine-fuel moisture of the base rates, % (≈ 20 °C, 40 % RH). PROVISIONAL */
export const M_REF_PCT = 8;
/** Moisture of extinction for dead fine fuel, % (Rothermel fuel models 25–40 %). PROVISIONAL */
export const M_EXT_PCT = 30;
/** Moisture added by fully soaked ground (wetness 1), percentage points. PROVISIONAL */
export const WET_MOISTURE_PCT = 40;
/** Below this a front is considered stopped, m/min. */
export const MIN_ROS_M_MIN = 0.05;

// ---------------------------------------------------------------------------------------------
// Factors
// ---------------------------------------------------------------------------------------------

/** Effective wind for spread, m/s. */
export function effectiveWindMs(w: Pick<Weather, "windMs" | "gustMs">): number {
  return Math.max(0, w.windMs) + GUST_WEIGHT * Math.max(0, w.gustMs - w.windMs);
}

/** Head-fire wind multiplier. */
export function headWindFactor(uMs: number): number {
  return 1 + WIND_A * Math.pow(Math.max(0, uMs), WIND_B);
}

/**
 * Length-to-breadth ratio of a wind-driven fire: 1 + 0.025·U² up to 6 m/s, then 0.1 + 0.3·U
 * (C¹ at 6 m/s), capped at 8 — 1.4 / 2.8 / 4.3 at 4 / 9 / 14 m/s, the offline CA's calibration
 * targets 1.3 / 2.8 / 4.3 (SPEC/24 §4.2). PROVISIONAL
 */
export function lengthToBreadth(uMs: number): number {
  const u = Math.max(0, uMs);
  return Math.min(LB_MAX, u <= 6 ? 1 + 0.025 * u * u : 0.1 + 0.3 * u);
}

/** Eccentricity of the spread ellipse for a length-to-breadth ratio. */
export function eccentricity(lb: number): number {
  return lb <= 1 ? 0 : Math.sqrt(1 - 1 / (lb * lb));
}

/** Directional multiplier (focal polar form) for spread `offHeadRad` off the wind's heading. */
export function ellipseFactor(e: number, offHeadRad: number): number {
  return (1 - e) / (1 - e * Math.cos(offHeadRad));
}

/** Slope multiplier for a slope angle in degrees (positive = upslope in the direction of spread). */
export function slopeFactor(slopeDeg: number): number {
  return slopeDeg >= 0 ? Math.exp(SLOPE_UP * slopeDeg) : Math.max(SLOPE_DOWN_FLOOR, Math.exp(SLOPE_DOWN * slopeDeg));
}

/** Slope multiplier between two elevations `distM` apart. */
export function slopeFactorBetween(z0: number, z1: number, distM: number): number {
  const dz = z1 - z0;
  if (dz === 0 || !Number.isFinite(dz)) return 1;
  return slopeFactor((Math.atan(dz / distM) * 180) / Math.PI);
}

function g(mPct: number): number {
  const r = mPct / M_EXT_PCT;
  return r >= 1 ? 0 : Math.exp(-0.1386 * mPct) * (1 - r * r);
}
const G_REF = g(M_REF_PCT);

/**
 * Moisture multiplier for fine-fuel moisture `mPct`, 1 at the reference 8 % (the ISI moisture
 * function of the Canadian FWI, exp(−0.1386·m), with a moisture of extinction). PROVISIONAL
 */
export function moistureFactor(mPct: number): number {
  return g(mPct) / G_REF;
}

/** Wetness (applied water) as added fuel moisture, percentage points. */
export function wetMoisturePct(wetness: number): number {
  return WET_MOISTURE_PCT * Math.max(0, wetness);
}

/** Half-life of applied water, s: ~30 min at 6 % fine-fuel moisture, ~65 min at 20 %. PROVISIONAL */
export function dryingHalfLifeS(fineMoisturePct: number): number {
  return (15 + 2.5 * fineMoisturePct) * 60;
}

// ---------------------------------------------------------------------------------------------
// The 16-neighbourhood: 8 neighbours plus the 8 knight moves (no diamond/square artefacts).
// ---------------------------------------------------------------------------------------------

export interface Neighbour {
  /** Offset east (columns) and north (rows; row index decreases northward). */
  readonly dc: number;
  readonly dr: number;
  /** Distance in cells. */
  readonly dist: number;
  /** Bearing, radians clockwise from north. */
  readonly bearing: number;
  readonly kind: "orth" | "diag" | "knight";
  /** Cells the straight path passes (diagonal corners / knight intermediates), as [dc, dr]. */
  readonly via: readonly (readonly [number, number])[];
}

const OFFSETS: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [1, 1], [2, 1], [1, 0], [2, -1], [1, -1], [1, -2],
  [0, -1], [-1, -2], [-1, -1], [-2, -1], [-1, 0], [-2, 1], [-1, 1], [-1, 2],
];

export const NEIGHBOURS: readonly Neighbour[] = OFFSETS.map(([dc, dr]) => {
  const adc = Math.abs(dc);
  const adr = Math.abs(dr);
  const sc = Math.sign(dc);
  const sr = Math.sign(dr);
  const kind = adc + adr === 1 ? "orth" : adc === 1 && adr === 1 ? "diag" : "knight";
  const via: (readonly [number, number])[] =
    kind === "orth" ? [] :
    kind === "diag" ? [[dc, 0], [0, dr]] :
    adr === 2 ? [[0, sr], [dc, sr]] : [[sc, 0], [sc, dr]];
  let bearing = Math.atan2(dc, dr);
  if (bearing < 0) bearing += 2 * Math.PI;
  return { dc, dr, dist: Math.hypot(dc, dr), bearing, kind, via };
});

export const N_NEIGHBOURS = NEIGHBOURS.length;

// ---------------------------------------------------------------------------------------------
// Per-step weather: everything that does not depend on the cell.
// ---------------------------------------------------------------------------------------------

export interface StepWeather {
  readonly weather: Weather;
  readonly uMs: number;
  readonly headingRad: number;
  readonly lb: number;
  readonly e: number;
  readonly headFactor: number;
  /** Fine-fuel moisture, %. */
  readonly mFine: number;
  /** φ_M of dry ground under this weather. */
  readonly moistDry: number;
  /** φ_w per neighbour direction. */
  readonly windK: Float64Array;
  readonly windKMax: number;
  /**
   * Per fuel code: 1 when the fuel is in the crown-fire regime under this weather — the surface
   * intensity of a head fire in it reaches the crown threshold. The whole spread ellipse then runs at
   * the crown rate (as the FBP System derives flank and back from the crowning head), so the shape
   * keeps its length-to-breadth ratio; only the head's cells crown and throw embers (spread.ts).
   */
  readonly crownRegime: Uint8Array;
  /** R0 · φ_w · φ_M(dry) · crown factor per (fuel code · 16 + direction), m/min. */
  readonly rosFD: Float64Array;
  readonly halfLifeS: number;
}

/** Byram surface intensity, kW/m, of a fire spreading at `rosMMin` in `fuelCode`. */
export function surfaceIntensity(fuelCode: number, rosMMin: number): number {
  const p = FUEL_PROPS[fuelCode];
  return p ? (HEAT_KJ_KG * p.surfaceLoadKgM2 * rosMMin) / 60 : 0;
}

export function prepareWeather(w: Weather): StepWeather {
  const fields = [w.windFromDeg, w.windMs, w.gustMs, w.tempC, w.rh];
  if (!fields.every(Number.isFinite)) throw new RangeError(`fire weather must be finite numbers: ${JSON.stringify(w)}`);
  const uMs = effectiveWindMs(w);
  const headingRad = (((w.windFromDeg + 180) % 360) * Math.PI) / 180;
  const lb = lengthToBreadth(uMs);
  const e = eccentricity(lb);
  const headFactor = headWindFactor(uMs);
  const mFine = fineFuelMoisture(w);
  const moistDry = moistureFactor(mFine);
  const windK = new Float64Array(N_NEIGHBOURS);
  let windKMax = 0;
  for (let k = 0; k < N_NEIGHBOURS; k++) {
    windK[k] = headFactor * ellipseFactor(e, NEIGHBOURS[k]!.bearing - headingRad);
    windKMax = Math.max(windKMax, windK[k]!);
  }
  const rosFD = new Float64Array(FUEL_PROPS.length * N_NEIGHBOURS);
  const crownRegime = new Uint8Array(FUEL_PROPS.length);
  for (let f = 0; f < FUEL_PROPS.length; f++) {
    const p = FUEL_PROPS[f]!;
    const head = p.baseRosMMin * moistDry * headFactor;
    const crown = surfaceIntensity(f, head) >= p.crownThresholdKWm;
    crownRegime[f] = crown ? 1 : 0;
    const r0 = p.baseRosMMin * moistDry * (crown ? p.crownRosFactor : 1);
    for (let k = 0; k < N_NEIGHBOURS; k++) rosFD[f * N_NEIGHBOURS + k] = r0 * windK[k]!;
  }
  return { weather: w, uMs, headingRad, lb, e, headFactor, mFine, moistDry, windK, windKMax, crownRegime, rosFD, halfLifeS: dryingHalfLifeS(mFine) };
}

/** φ_M of a cell with `wetness` relative to dry ground under the same weather (1 when dry). */
export function wetFactor(sw: StepWeather, wetness: number): number {
  if (wetness <= 0) return 1;
  if (sw.moistDry <= 0) return 0;
  return moistureFactor(sw.mFine + wetMoisturePct(wetness)) / sw.moistDry;
}

// ---------------------------------------------------------------------------------------------
// Deterministic integer hash (murmur3 mixing; Math.imul only — no Math.random, no BigInt).
// ---------------------------------------------------------------------------------------------

function mix(h: number, v: number): number {
  let k = Math.imul(v | 0, 0xcc9e2d51);
  k = (k << 15) | (k >>> 17);
  k = Math.imul(k, 0x1b873593);
  h ^= k;
  h = (h << 13) | (h >>> 19);
  return (Math.imul(h, 5) + 0xe6546b64) | 0;
}

/** 32-bit hash of (seed, a, b, c), unsigned. */
export function hash32(seed: number, a: number, b: number, c: number): number {
  let h = mix(seed | 0, a);
  h = mix(h, b);
  h = mix(h, c);
  h ^= 16;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Uniform in [0, 1) from the hash. */
export function hash01(seed: number, a: number, b: number, c: number): number {
  return hash32(seed, a, b, c) / 4294967296;
}

/** Approximately standard normal (Irwin–Hall of four 16-bit uniforms; bounded at ±3.46). */
export function hashNormal(seed: number, a: number, b: number, c: number): number {
  const h1 = hash32(seed, a, b, c);
  const h2 = hash32(seed ^ 0x5bd1e995, a, b, c);
  const s = (h1 & 0xffff) + (h1 >>> 16) + (h2 & 0xffff) + (h2 >>> 16);
  return (s / 65536 - 2) * Math.sqrt(3);
}

/**
 * Rate of spread, m/min, of a front entering `cell` from `fromCell` (any distance apart) under `sw`,
 * on the cell's fuel and wetness, with the exact bearing (not the 16 directions) and the slope
 * between the two cells. 0 for fuel that does not burn.
 */
export function rateBetween(world: Pick<GameWorld, "grid" | "fuel" | "elevation">, fromCell: number, cell: number, sw: StepWeather, wetness: number): number {
  const fuel = world.fuel[cell]!;
  const props = FUEL_PROPS[fuel];
  if (!props || !props.burnable) return 0;
  const { cols, cellM } = world.grid;
  const dx = (cell % cols) - (fromCell % cols);
  const dy = Math.floor(fromCell / cols) - Math.floor(cell / cols); // north positive
  const distM = Math.hypot(dx, dy) * cellM;
  const bearing = distM > 0 ? Math.atan2(dx, dy) : sw.headingRad;
  const crown = sw.crownRegime[fuel] === 1 ? props.crownRosFactor : 1;
  let r = props.baseRosMMin * sw.moistDry * crown * sw.headFactor * ellipseFactor(sw.e, bearing - sw.headingRad);
  r *= wetFactor(sw, wetness);
  if (distM > 0) {
    const z0 = world.elevation[fromCell]!;
    const z1 = world.elevation[cell]!;
    if (z0 > -1000 && z1 > -1000) r *= slopeFactorBetween(z0, z1, distM);
  }
  return r;
}
