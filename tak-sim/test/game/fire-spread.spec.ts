/**
 * Game mode, live fire model (app/game/fire): fuels, determinism, shape and rate calibration.
 */

import { describe, expect, it } from "vitest";
import { CELL, FUEL } from "../../app/game/contracts.js";
import { FUEL_CODES, FUEL_PROPS, fuelProps } from "../../app/game/fire/fuels.js";
import { NEIGHBOURS, hash32, lengthToBreadth } from "../../app/game/fire/ros.js";
import { createFireSim } from "../../app/game/fire/spread.js";
import { extents, idx, run, uniformWorld, wx } from "./fire-test-world.js";

describe("fuels", () => {
  it("has a row for every legend code, in code order", () => {
    expect(FUEL_PROPS.length).toBe(13);
    for (const code of FUEL_CODES) expect(FUEL_PROPS[code]!.code).toBe(code);
  });

  it("roads, water, built ground and brooks do not burn; the rest do, with positive rates", () => {
    const noFuel: number[] = [FUEL.water, FUEL.road_gravel, FUEL.road_forest, FUEL.built, FUEL.brook];
    for (const code of FUEL_CODES) {
      const p = fuelProps(code);
      expect(p.burnable).toBe(!noFuel.includes(code));
      if (p.burnable) {
        expect(p.baseRosMMin).toBeGreaterThan(0);
        expect(p.residenceS).toBeGreaterThan(0);
      }
    }
    expect(fuelProps(FUEL.brook).barrier).toBe("brook");
    expect(fuelProps(99).burnable).toBe(false);
  });

  it("peat smoulders longest and rekindles most; spruce crowns before pine", () => {
    const peat = fuelProps(FUEL.drained_peat);
    for (const code of FUEL_CODES) {
      if (code === FUEL.drained_peat) continue;
      expect(peat.smoulderS).toBeGreaterThan(fuelProps(code).smoulderS);
      expect(peat.rekindlePerMin).toBeGreaterThan(fuelProps(code).rekindlePerMin);
    }
    expect(fuelProps(FUEL.spruce_mature).crownThresholdKWm).toBeLessThan(fuelProps(FUEL.pine_heath).crownThresholdKWm);
    expect(Number.isFinite(fuelProps(FUEL.birch_aspen).crownThresholdKWm)).toBe(false);
  });
});

describe("hash and neighbourhood", () => {
  it("hash32 is a pure 32-bit function", () => {
    expect(hash32(1, 2, 3, 4)).toBe(hash32(1, 2, 3, 4));
    expect(hash32(1, 2, 3, 4)).not.toBe(hash32(2, 2, 3, 4));
    expect(hash32(1, 2, 3, 4)).toBeGreaterThanOrEqual(0);
    expect(hash32(1, 2, 3, 4)).toBeLessThan(2 ** 32);
  });

  it("uses 16 neighbours: 4 orthogonal, 4 diagonal, 8 knight moves", () => {
    expect(NEIGHBOURS.length).toBe(16);
    expect(NEIGHBOURS.filter((n) => n.kind === "knight").length).toBe(8);
    expect(NEIGHBOURS.filter((n) => n.kind === "diag").length).toBe(4);
  });
});

/** A spotting fire: crowning mature spruce in a strong dry wind. */
function spottingRun(seed: number) {
  const w = uniformWorld(140, 80, FUEL.spruce_mature);
  const sim = createFireSim(w, seed);
  sim.ignite(idx(w, 15, 40));
  const reports: string[] = [];
  const weather = wx(270, 10, 25, 25);
  for (let s = 0; s < 240; s++) reports.push(JSON.stringify(sim.step(10, weather)));
  return { sim, reports };
}

describe("determinism", () => {
  it("same seed and steps give identical arrays and reports", () => {
    const a = spottingRun(42);
    const b = spottingRun(42);
    expect(b.reports).toEqual(a.reports);
    expect(Buffer.from(b.sim.state).equals(Buffer.from(a.sim.state))).toBe(true);
    expect(Buffer.from(b.sim.intensity.buffer).equals(Buffer.from(a.sim.intensity.buffer))).toBe(true);
    expect(Buffer.from(b.sim.wetness.buffer).equals(Buffer.from(a.sim.wetness.buffer))).toBe(true);
    expect(Buffer.from(b.sim.ignitedAtS.buffer).equals(Buffer.from(a.sim.ignitedAtS.buffer))).toBe(true);
    expect(b.sim.tS).toBe(a.sim.tS);
  });

  it("a different seed changes the spotting", () => {
    const a = spottingRun(42);
    const b = spottingRun(43);
    const spotsA = a.reports.flatMap((r) => (JSON.parse(r) as { spotFires: unknown[] }).spotFires);
    const spotsB = b.reports.flatMap((r) => (JSON.parse(r) as { spotFires: unknown[] }).spotFires);
    expect(spotsA.length).toBeGreaterThan(0);
    expect(spotsB.length).toBeGreaterThan(0);
    expect(JSON.stringify(spotsB)).not.toBe(JSON.stringify(spotsA));
  });

  it("without random events the seed does not matter", () => {
    const w = uniformWorld(80, 60, FUEL.spruce_mature);
    const runOnce = (seed: number) => {
      const sim = createFireSim(w, seed, { randomEvents: false });
      sim.ignite(idx(w, 10, 30));
      run(sim, 120, wx(270, 10, 25, 25));
      return Array.from(sim.state);
    };
    expect(runOnce(1)).toEqual(runOnce(2));
  });
});

describe("shape and rate", () => {
  it("a no-wind fire on flat uniform fuel grows round (area within ±25 % of the circle)", () => {
    const w = uniformWorld(100, 100);
    const sim = createFireSim(w, 1);
    sim.ignite(idx(w, 50, 50));
    const weather = wx(0, 0, 40, 20);
    const minutes = 150;
    run(sim, minutes * 6, weather);
    const ros = sim.rateOfSpread(idx(w, 50, 50), idx(w, 51, 50), weather); // m/min, isotropic in calm
    const radius = ros * minutes;
    const area = sim.burnedHa * 10_000;
    const ratio = area / (Math.PI * radius * radius);
    expect(ratio).toBeGreaterThan(0.75);
    expect(ratio).toBeLessThan(1.25);
    // No diamond or square: the extent along the axes and along the diagonals agree within 15 %.
    const axis = extents(sim, w, 0).length;
    const diag = extents(sim, w, 45).length;
    expect(Math.abs(axis / diag - 1)).toBeLessThan(0.15);
  });

  // Length-to-breadth on uniform pine heath, as the offline CA was calibrated (SPEC/24 §4.2).
  for (const [u, target, minutes] of [[4, 1.3, 120], [9, 2.8, 60], [14, 4.3, 50]] as const) {
    for (const from of [270, 225]) {
      it(`length-to-breadth ≈ ${target} at ${u} m/s (wind from ${from}°), within ±30 %`, () => {
        const w = uniformWorld(200, 140);
        const sim = createFireSim(w, 1, { randomEvents: false });
        sim.ignite(from === 270 ? idx(w, 25, 70) : idx(w, 25, 115));
        run(sim, minutes * 6, wx(from, u, 30, 20));
        const e = extents(sim, w, (from + 180) % 360);
        const lb = e.length / e.breadth;
        expect(lb).toBeGreaterThan(target * 0.7);
        expect(lb).toBeLessThan(target * 1.3);
      });
    }
  }

  it("the model's own length-to-breadth law hits 1.4 / 2.8 / 4.3", () => {
    expect(lengthToBreadth(4)).toBeCloseTo(1.4, 2);
    expect(lengthToBreadth(9)).toBeCloseTo(2.8, 2);
    expect(lengthToBreadth(14)).toBeCloseTo(4.3, 2);
    expect(lengthToBreadth(0)).toBe(1);
  });

  it("head rate on pine heath at 6 m/s and 30 % RH is 3–15 m/min, and rateOfSpread agrees", () => {
    const w = uniformWorld(160, 60);
    const sim = createFireSim(w, 1, { randomEvents: false });
    sim.ignite(idx(w, 10, 30));
    const weather = wx(270, 6, 30, 20);
    run(sim, 20 * 6, weather);
    const a = extents(sim, w, 90).ahead;
    run(sim, 60 * 6, weather);
    const b = extents(sim, w, 90).ahead;
    const measured = (b - a) / 60;
    expect(measured).toBeGreaterThan(3);
    expect(measured).toBeLessThan(15);
    const api = sim.rateOfSpread(idx(w, 10, 30), idx(w, 11, 30), weather);
    expect(Math.abs(measured / api - 1)).toBeLessThan(0.15);
    // Back fire far slower than the head.
    expect(sim.rateOfSpread(idx(w, 11, 30), idx(w, 10, 30), weather)).toBeLessThan(api / 5);
  });

  it("rejects non-finite weather before touching the fire", () => {
    const w = uniformWorld(20, 20);
    const sim = createFireSim(w, 1);
    sim.ignite(idx(w, 10, 10));
    expect(() => sim.step(10, { ...wx(270, 5), windMs: Number.NaN })).toThrow(RangeError);
    expect(sim.tS).toBe(0);
  });

  it("burns upslope faster than downslope", () => {
    const w = uniformWorld(40, 40);
    for (let r = 0; r < 40; r++) for (let c = 0; c < 40; c++) w.elevation[idx(w, c, r)] = c * 5; // 11° up to the east
    const sim = createFireSim(w, 1);
    const calm = wx(0, 0, 30, 20);
    expect(sim.rateOfSpread(idx(w, 20, 20), idx(w, 21, 20), calm)).toBeGreaterThan(1.8 * sim.rateOfSpread(idx(w, 21, 20), idx(w, 20, 20), calm));
  });

  it("drier air spreads faster; a burning cell has Byram intensity and burns out after flaming", () => {
    const w = uniformWorld(40, 40);
    const sim = createFireSim(w, 1);
    const from = idx(w, 20, 20);
    const to = idx(w, 21, 20);
    expect(sim.rateOfSpread(from, to, wx(270, 5, 20, 25))).toBeGreaterThan(sim.rateOfSpread(from, to, wx(270, 5, 60, 15)));
    expect(sim.ignite(from)).toBe(true);
    expect(sim.ignite(from)).toBe(false);
    sim.step(10, wx(270, 5, 30, 20));
    expect(sim.state[from]).toBe(CELL.burning);
    expect(sim.intensity[from]).toBeGreaterThan(100);
    expect(sim.ignitedAtS[from]).toBe(0);
    expect(sim.ignitedAtS[to]).toBe(-1);
    run(sim, 6 * 30, wx(270, 5, 30, 20));
    // Half an hour on, the head has run on and burns hottest; the origin drives only slow flank and backing fire.
    expect(sim.ignitedAtS[to]).toBeGreaterThan(0);
    let hottest = 0;
    for (let i = 0; i < sim.intensity.length; i++) if (sim.intensity[i]! > sim.intensity[hottest]!) hottest = i;
    expect(hottest % 40).toBeGreaterThan(23);
    expect(sim.intensity[hottest]).toBeGreaterThan(3 * sim.intensity[from]!);
    run(sim, 6 * 150, wx(270, 5, 30, 20));
    expect([CELL.smouldering, CELL.burnedOut]).toContain(sim.state[from]);
    expect(sim.intensity[from]).toBe(0);
  });
});
