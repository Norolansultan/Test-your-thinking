/**
 * Land cover and forest stands of the generated site (SPEC/33 §4 stage 4): the map's classes (water, field, open / pine / drained
 * mire, forest) and the hidden stand map the fuel grids are drawn from (SPEC/24 §4.3 classes):
 *
 *   - pine heath on the eskers' sand and on bedrock knolls; spruce on moraine slopes and fertile lowland; birch–aspen along brooks
 *     and in young stands; mixed stands drawn per stand (≈ 4–10 ha patches);
 *   - a few recent clear-cuts (open: the cleared-corridor fuel) away from the fire's ground;
 *   - the scenario's designed stands kept (SPEC/18 §5): Kuusimäki's unthinned spruce (SPR, the stale stand data shows it thinned:
 *     M3), the birch–aspen strip along Koivuoja, and pine heath at IGN.
 */

import { bearingOf, distToPolyline, fbm, hash2, type P } from "./terrain-base.js";
import { BROOKS } from "./water.js";
import { inWater, riverDist } from "./water-query.js";
import { HAND, MIRE_DRAINED, MIRE_OPEN, MIRE_PINE, mireAt, PALUDIFIED, SOIL_CLAY, SOIL_PEAT, SOIL_ROCK, SOIL_SAND, soilAt, TWI, MIRE_RULE } from "./soil.js";
import { BASE, cellOf } from "./terrain-base.js";
import { parcelAt } from "./fields.js";

export const LC_FOREST = 0;
export const LC_WATER = 1;
export const LC_FIELD = 2;
export const LC_OPEN_BOG = 3;
export const LC_DRAINED_BOG = 4;
export const LC_PINE_BOG = 5;

export function landCover(x: number, y: number, _e = 0): number {
  if (inWater(x, y)) return LC_WATER;
  if (parcelAt(x, y) >= 0) return LC_FIELD;
  const m = mireAt(x, y);
  if (m === MIRE_OPEN) return LC_OPEN_BOG;
  if (m === MIRE_PINE) return LC_PINE_BOG;
  if (m === MIRE_DRAINED) return LC_DRAINED_BOG;
  return LC_FOREST;
}

/** Cosmetic (not a fuel class): undrained mire wet enough for MML's "vaikeakulkuinen suo" (the horizontal blue lines). */
export function isWetMire(x: number, y: number): boolean {
  const m = mireAt(x, y);
  return (m === MIRE_OPEN || m === MIRE_PINE) && TWI[cellOf(x, y)]! > MIRE_RULE.twi + 1.2;
}

/** Cosmetic: MML "soistuma", paludified forest fringing the mires. */
export const isPaludified = (x: number, y: number): boolean => PALUDIFIED[cellOf(x, y)] === 1;

/** Brooks near IGN, for the brook-side birch strips (only those within 6 km matter to the fire grids). */
const NEAR_BROOKS: readonly (readonly P[])[] = BROOKS.map((b) => b.line).filter((l) => l.some((p) => Math.hypot(p.x, p.y) < 6000));

export type StandFuel = "pine_heath" | "spruce_mature" | "birch_aspen" | "cleared_corridor";
export interface Stand { readonly truth: StandFuel; readonly machine: StandFuel | "spruce_thinned" }

/** Two draws (0–1) per stand, from a domain-warped 230 m cell grid: stands of a few hectares with ragged edges. */
function standDraws(x: number, y: number): [number, number] {
  const wx = x + 90 * fbm(x / 300, y / 300, 2, 7101);
  const wy = y + 90 * fbm(x / 300, y / 300, 2, 7103);
  const cx = Math.floor(wx / 230);
  const cy = Math.floor(wy / 230);
  return [hash2(cx, cy, 7105), hash2(cx, cy, 7107)];
}

/** The forest stand (truth and the stale stand data the machine reads) at a forest point. */
export function standAt(x: number, y: number): Stand {
  const d = Math.hypot(x, y);
  const b = bearingOf(x, y);
  // The scenario's designed stands (SPEC/18 §5).
  if (d >= 1300 && d <= 2200 && b >= 25 && b <= 70) return { truth: "spruce_mature", machine: "spruce_thinned" };
  if (d >= 2250 && d <= 2450 && b >= 15 && b <= 80) return { truth: "birch_aspen", machine: "birch_aspen" };
  if (riverDist(x, y, 90) < 90 || NEAR_BROOKS.some((l) => distToPolyline(x, y, l) < 60)) return { truth: "birch_aspen", machine: "birch_aspen" };
  const i = cellOf(x, y);
  const soil = soilAt(x, y);
  const [u, v] = standDraws(x, y);
  // A few recent clear-cuts and young (deciduous-rich) stands, kept off the fire's own ground.
  if (d > 3500 && u < 0.045) return { truth: "cleared_corridor", machine: "cleared_corridor" };
  if (d > 3500 && u < 0.11) return { truth: "birch_aspen", machine: "birch_aspen" };
  let t: StandFuel;
  // IGN's own ground (SPEC/23 §4 template: dry pine heath, a mature pine/spruce mosaic): the esker plain's pine.
  if (d < 1300) return { truth: v < 0.88 ? "pine_heath" : "spruce_mature", machine: v < 0.88 ? "pine_heath" : "spruce_mature" };
  if (soil === SOIL_SAND || soil === SOIL_ROCK) t = v < 0.92 ? "pine_heath" : "spruce_mature";
  else if (soil === SOIL_PEAT || PALUDIFIED[i]) t = v < 0.6 ? "spruce_mature" : "birch_aspen";
  else if (BASE.knoll[i]! > 5 || HAND[i]! > 9) t = v < 0.65 ? "pine_heath" : v < 0.9 ? "spruce_mature" : "birch_aspen";
  else if (HAND[i]! < 4 || soil === SOIL_CLAY) t = v < 0.55 ? "spruce_mature" : v < 0.78 ? "birch_aspen" : "pine_heath";
  // Mid-slope moraine; on the esker system's dry ground near IGN pine dominates (the authored fire's fuel, SPEC/18 §5).
  else if (d < 3000) t = v < 0.6 ? "pine_heath" : v < 0.9 ? "spruce_mature" : "birch_aspen";
  else t = v < 0.42 ? "pine_heath" : v < 0.82 ? "spruce_mature" : "birch_aspen";
  return { truth: t, machine: t };
}
