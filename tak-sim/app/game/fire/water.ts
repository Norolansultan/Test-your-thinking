/**
 * Game mode, live fire model: water. Applied water is held per cell as `wetness` (1 = soaked,
 * SOAK_L_PER_M2 litres per m²); it adds fuel moisture (ros.ts `wetMoisturePct`) and dries back with
 * a weather-dependent half-life (ros.ts `dryingHalfLifeS`). All values PROVISIONAL.
 */

/** Water to put out the flames of a burning cell: (2 + I/100) litres per metre of front (I in kW/m). */
export const EXT_L_PER_M_BASE = 2;
export const EXT_L_PER_M_PER_KWM = 0.01;
/** Litres per m² that soak the ground (wetness 1): 0.8 mm. */
export const SOAK_L_PER_M2 = 0.8;

/** Litres to put out the flames of a `cellM` cell burning at `intensityKWm` (one cell-width of front). */
export function waterNeedL(cellM: number, intensityKWm: number): number {
  return cellM * (EXT_L_PER_M_BASE + EXT_L_PER_M_PER_KWM * Math.max(0, intensityKWm));
}

/**
 * What the water held in a burning cell does: `out` when it covers the flames and the ground fire
 * (or the fuel does not smoulder), `smoulder` when it covers only the flames, else `knockback`.
 */
export function waterOutcome(heldL: number, needL: number, smoulders: boolean, mopUpL: number): "out" | "smoulder" | "knockback" {
  if (heldL < needL) return "knockback";
  return smoulders && heldL < needL + mopUpL ? "smoulder" : "out";
}
