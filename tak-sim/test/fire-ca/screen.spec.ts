/**
 * SPEC/23 §3 — the spread-capacity screen: a site must let the fire spread widely enough.
 */

import { describe, expect, it } from "vitest";
import { passesSpreadScreen, spreadCapacity } from "../../tools/fire-ca/screen.js";
import { buildTemplateSite, FUEL_CLASSES } from "../../tools/fire-ca/template-site.js";
import type { SiteModel } from "../../tools/fire-ca/run.js";

const WATER = FUEL_CLASSES.findIndex((c) => c.id === "water");

/** The template with everything more than `radiusM` from the ignition turned to water. */
function island(radiusM: number): SiteModel {
  const site = buildTemplateSite(50, 8000);
  const fuel = site.truthFuel.fuel.slice();
  const { cols, cellSizeM } = site.frame;
  for (let i = 0; i < fuel.length; i++) {
    const c = i % cols;
    const x = (c + 0.5) * cellSizeM - site.ignitionM.eastM;
    const y = ((i - c) / cols + 0.5) * cellSizeM - site.ignitionM.northM;
    if (Math.hypot(x, y) > radiusM) fuel[i] = WATER;
  }
  return { ...site, truthFuel: { ...site.truthFuel, fuel } };
}

describe("spreadCapacity", () => {
  it("the template site passes: a large connected burnable patch in every spread direction", () => {
    const c = spreadCapacity(buildTemplateSite(50, 8000));
    expect(c.connectedHa).toBeGreaterThan(1000);
    expect(passesSpreadScreen(c)).toBe(true);
  });

  it("a site where fuel stops 1 km from the ignition fails", () => {
    const c = spreadCapacity(island(1000));
    expect(c.connectedHa).toBeLessThan(400);
    expect(passesSpreadScreen(c)).toBe(false);
  });

  it("reports burnable share by radius, falling to zero beyond the fuel edge", () => {
    const c = spreadCapacity(island(1000), [500, 3000]);
    expect(c.burnableShare[0]!.share).toBeGreaterThan(0.8);
    expect(c.burnableShare[1]!.share).toBeLessThan(0.2);
  });
});
