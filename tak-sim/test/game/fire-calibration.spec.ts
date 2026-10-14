/**
 * Game mode, live fire model on the real site (content/site truth fuel and elevation), and the
 * performance budget. Timing uses performance.now() here only: tests are outside the determinism
 * lint's scope (app/, tools/), and the model itself never reads a clock.
 */

import { describe, expect, it } from "vitest";
import { CELL, FUEL } from "../../app/game/contracts.js";
import { forecastPerimeter } from "../../app/game/fire/forecast.js";
import { createFireSim } from "../../app/game/fire/spread.js";
import { idx, loadSiteWorld, run, uniformWorld, wx } from "./fire-test-world.js";

describe("calibration on the real site", () => {
  const world = loadSiteWorld();

  it("loads the 400 × 400 grids; the ignition point (local 5000, 5000) is pine heath", () => {
    expect(world.fuel.length).toBe(160_000);
    const ign = idx(world, 200, 399 - 200);
    expect(world.fuel[ign]).toBe(FUEL.pine_heath);
    expect(world.elevation[ign]).toBeGreaterThan(50);
  });

  it("an uncontrolled fire from (5000, 5000) in SW 5 m/s, 30 % RH burns tens of hectares in 2 h", () => {
    const ign = idx(world, 200, 399 - 200);
    const areas: number[] = [];
    for (const seed of [1, 20080101]) {
      const sim = createFireSim(world, seed);
      expect(sim.ignite(ign)).toBe(true);
      run(sim, 6 * 120, wx(225, 5, 30, 20, 7));
      areas.push(sim.burnedHa);
    }
    // Report (the study's authored fire, with suppression and a crown run, was ~58 ha at 3 h 20 min
    // and ~130–170 ha at 8 h; SPEC/24 §11–§12).
    console.log(`[fire-calibration] real site, 2 h uncontrolled, SW 5 m/s (gust 7), 30 % RH: ${areas.map((a) => a.toFixed(1)).join(" / ")} ha`);
    for (const a of areas) {
      expect(a).toBeGreaterThan(8);
      expect(a).toBeLessThan(80);
    }
  });
});

describe("performance", () => {
  /** A 400 × 400 world with a ~2 000-cell front: a square ring two cells thick. */
  function ringFire() {
    const w = uniformWorld(400, 400);
    const sim = createFireSim(w, 7);
    for (let k = 0; k < 250; k++) {
      for (const [c, r] of [[75 + k, 75], [75 + k, 76], [75 + k, 324], [75 + k, 323], [75, 75 + k], [76, 75 + k], [324, 75 + k], [323, 75 + k]] as const) {
        sim.ignite(idx(w, c, r));
      }
    }
    return sim;
  }

  it("a 10 s step on 160 000 cells with a ~2 000-cell front takes < 10 ms", () => {
    const weather = wx(225, 6, 30, 22, 9);
    run(ringFire(), 40, weather); // warm the JIT on another fire
    const sim = ringFire();
    const front = sim.stateCounts()[CELL.burning]!;
    expect(front).toBeGreaterThanOrEqual(1900);
    const n = 20;
    const t0 = performance.now();
    run(sim, n, weather);
    const perStep = (performance.now() - t0) / n;
    const after = sim.stateCounts()[CELL.burning]!;
    console.log(`[fire-performance] front ${front}→${after} burning cells: ${perStep.toFixed(2)} ms per 10 s step`);
    expect(after).toBeLessThan(3500);
    expect(perStep).toBeLessThan(10);
  });

  it("a 20-minute forecast on a ~2 000-cell front takes < 50 ms", () => {
    const sim = ringFire();
    const weather = wx(225, 6, 30, 22, 9);
    forecastPerimeter(sim, weather, 1200); // warm the JIT
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      forecastPerimeter(sim, weather, 1200);
      times.push(performance.now() - t0);
    }
    const median = times.sort((a, b) => a - b)[2]!;
    console.log(`[fire-performance] 20 min forecast from ${sim.stateCounts()[CELL.burning]} burning cells: ${median.toFixed(1)} ms (median of 5)`);
    expect(median).toBeLessThan(50);
  });
});
