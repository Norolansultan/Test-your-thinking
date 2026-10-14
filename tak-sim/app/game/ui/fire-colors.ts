/**
 * Game mode screen: the colours of the fire layer and the fuel overlay, as pure functions (tested).
 *
 * The fire layer is drawn from the PLAYER'S PICTURE (`GameState.known`, fog of war), aged by `knownAtS`: flaming cells
 * flicker orange to yellow (crowning ones brighter), smouldering ones glow a dull red, burned-out ground is charcoal,
 * ground put out with water blue-grey; never-observed and unburned cells are transparent. Knowledge goes stale: from
 * `FRESH_S` on, a cell's colour loses saturation and opacity until `STALE_S`, and a stale flaming cell stops flickering
 * (nobody has seen it burn lately).
 */

import { CELL, FUEL } from "../contracts.js";

/** `known` value of a never-observed cell (contract). */
export const NEVER_SEEN = 255;
/** Knowledge younger than this is fresh, s. */
export const FRESH_S = 60;
/** At this age knowledge is fully stale, s. */
export const STALE_S = 1200;

export type Rgba = readonly [r: number, g: number, b: number, a: number];

/** 0 when fresh, rising to 1 when stale. */
export function staleness(ageS: number): number {
  if (!(ageS > FRESH_S)) return 0;
  return Math.min(1, (ageS - FRESH_S) / (STALE_S - FRESH_S));
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

/**
 * Writes the RGBA of one cell into `out` at `o` (an ImageData buffer). `flicker` is 0..1 noise for this cell and frame;
 * `crown` marks a cell seen crowning now.
 */
export function writeCellRgba(out: Uint8ClampedArray | number[], o: number, state: number, ageS: number, flicker: number, crown: boolean): void {
  let r = 0, g = 0, b = 0, a = 0;
  switch (state) {
    case CELL.burning: {
      const s = staleness(ageS);
      const f = flicker * (1 - s); // stale fire does not flicker
      if (crown && s === 0) { r = 255; g = 200 + 55 * f; b = 90 + 110 * f; a = 250; }
      else { r = 255; g = 95 + 120 * f; b = 10 + 40 * f; a = 225 + 25 * f; }
      break;
    }
    case CELL.smouldering: r = 150 + 30 * flicker * (1 - staleness(ageS)); g = 38; b = 22; a = 205; break;
    case CELL.burnedOut: r = 42; g = 38; b = 36; a = 190; break;
    case CELL.extinguished: r = 112; g = 134; b = 156; a = 200; break;
    default: out[o] = 0; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 0; return; // unburned, no fuel, never seen
  }
  const s = staleness(ageS);
  if (s > 0) {
    // Desaturate toward the cell's own grey and fade.
    const grey = 0.3 * r + 0.59 * g + 0.11 * b;
    const k = 0.75 * s;
    r = r + (grey - r) * k; g = g + (grey - g) * k; b = b + (grey - b) * k;
    a = a * (1 - 0.55 * s);
  }
  out[o] = clamp255(r); out[o + 1] = clamp255(g); out[o + 2] = clamp255(b); out[o + 3] = clamp255(a);
}

/** One cell's colour (tests and the legend). */
export function cellRgba(state: number, ageS: number, flicker = 0.5, crown = false): Rgba {
  const out = [0, 0, 0, 0];
  writeCellRgba(out, 0, state, ageS, flicker, crown);
  return [out[0]!, out[1]!, out[2]!, out[3]!];
}

/** The fire layer's colour for a never-observed cell is transparent; any other `known` value is a `CellState`. */
export function knownRgba(known: number, ageS: number, flicker = 0.5, crown = false): Rgba {
  return known === NEVER_SEEN ? [0, 0, 0, 0] : cellRgba(known, ageS, flicker, crown);
}

/**
 * Cheap smooth flicker noise in 0..1 for cell `i` at real time `ms`: a hashed value per cell and 90 ms slot, blended
 * linearly into the next slot. Integer hashing only (no `Math.random`).
 */
export function flickerNoise(i: number, ms: number): number {
  const t = ms / 90;
  const k = Math.floor(t);
  const f = t - k;
  return hash01(i, k) * (1 - f) + hash01(i, k + 1) * f;
}

function hash01(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** The fuel overlay: one colour per fuel code (legend order = code order). */
export const FUEL_COLORS: Readonly<Record<number, Rgba>> = {
  [FUEL.water]: [40, 110, 200, 170],
  [FUEL.road_gravel]: [190, 170, 140, 200],
  [FUEL.field]: [226, 214, 96, 150],
  [FUEL.pine_heath]: [150, 196, 92, 140],
  [FUEL.spruce_mature]: [22, 92, 52, 165],
  [FUEL.spruce_thinned]: [64, 138, 84, 150],
  [FUEL.birch_aspen]: [196, 232, 150, 150],
  [FUEL.drained_peat]: [150, 112, 70, 155],
  [FUEL.cleared_corridor]: [222, 160, 210, 150],
  [FUEL.built]: [140, 140, 150, 190],
  [FUEL.open_bog]: [176, 150, 98, 140],
  [FUEL.road_forest]: [214, 186, 150, 190],
  [FUEL.brook]: [80, 170, 230, 190],
};

/** The legend's fuel codes, in code order. */
export const FUEL_LEGEND: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** CSS colour of a fuel class (the legend swatch, opaque). */
export function fuelCss(code: number): string {
  const c = FUEL_COLORS[code] ?? [0, 0, 0, 0];
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** CSS colour of a cell state in the legend (fresh, mid flicker). */
export function stateCss(state: number): string {
  const c = cellRgba(state, 0, 0.5);
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
