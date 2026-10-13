/**
 * Site screening — SPEC/23 §3–§5. The one hard requirement on a site's ground is that the fire
 * can spread widely enough: enough continuous burnable forest around the ignition in the
 * directions the scenario drives it (north-east in phase A, north-west in cycle 9, south-east in
 * phase B). This measures that directly from the site's fuel grid, before and alongside a full
 * CA run.
 */

import { components } from "./geometry.js";
import type { SiteModel } from "./run.js";

export interface SpreadCapacity {
  /** Share of cells within the radius that carry fuel, per radius (m). */
  readonly burnableShare: readonly { readonly radiusM: number; readonly share: number }[];
  /** Area (ha) of the connected burnable patch containing the ignition, within `maxRadiusM`. */
  readonly connectedHa: number;
  /** Burnable share in each scenario direction sector, 0.5–4 km from the ignition. */
  readonly bySector: readonly { readonly label: string; readonly fromDeg: number; readonly toDeg: number; readonly share: number }[];
}

/** SPEC/18 §7's spread directions: head NE (phase A), north flank NW (cycle 9), SE front (phase B). */
export const SPREAD_SECTORS = [
  { label: "NE (phase A head)", fromDeg: 15, toDeg: 75 },
  { label: "NW (cycle 9)", fromDeg: 285, toDeg: 345 },
  { label: "SE (phase B)", fromDeg: 105, toDeg: 165 },
] as const;

export function spreadCapacity(site: SiteModel, radii: readonly number[] = [1000, 2000, 3000], maxRadiusM = 4000): SpreadCapacity {
  const { frame, truthFuel } = site;
  const { cols, rows, cellSizeM } = frame;
  const burnable = (i: number) => truthFuel.classes[truthFuel.fuel[i]!]!.burnable;
  const polar = (i: number) => {
    const c = i % cols;
    const x = (c + 0.5) * cellSizeM - site.ignitionM.eastM;
    const y = ((i - c) / cols + 0.5) * cellSizeM - site.ignitionM.northM;
    let b = (Math.atan2(x, y) * 180) / Math.PI;
    if (b < 0) b += 360;
    return { d: Math.hypot(x, y), b };
  };

  const burnableShare = radii.map((radiusM) => {
    let n = 0;
    let fuel = 0;
    for (let i = 0; i < cols * rows; i++) if (polar(i).d <= radiusM) { n++; if (burnable(i)) fuel++; }
    return { radiusM, share: n > 0 ? fuel / n : 0 };
  });

  const mask = new Uint8Array(cols * rows);
  for (let i = 0; i < mask.length; i++) mask[i] = burnable(i) && polar(i).d <= maxRadiusM ? 1 : 0;
  const ignCell = Math.floor(site.ignitionM.northM / cellSizeM) * cols + Math.floor(site.ignitionM.eastM / cellSizeM);
  const patch = components(frame, mask).find((comp) => comp.includes(ignCell)) ?? [];
  const connectedHa = (patch.length * cellSizeM * cellSizeM) / 10_000;

  const bySector = SPREAD_SECTORS.map((s) => {
    let n = 0;
    let fuel = 0;
    for (let i = 0; i < cols * rows; i++) {
      const p = polar(i);
      if (p.d < 500 || p.d > 4000 || p.b < s.fromDeg || p.b > s.toDeg) continue;
      n++;
      if (burnable(i)) fuel++;
    }
    return { ...s, share: n > 0 ? fuel / n : 0 };
  });

  return { burnableShare, connectedHa, bySector };
}

/**
 * Proposed acceptance thresholds (SPEC/23 §3 H6). A site passes when the burnable patch around the
 * ignition is several times the authored burned area and each spread direction is mostly fuel.
 */
export const SPREAD_THRESHOLDS = { minConnectedHa: 1000, minSectorShare: 0.75 } as const;

export function passesSpreadScreen(c: SpreadCapacity): boolean {
  return c.connectedHa >= SPREAD_THRESHOLDS.minConnectedHa && c.bySector.every((s) => s.share >= SPREAD_THRESHOLDS.minSectorShare);
}
