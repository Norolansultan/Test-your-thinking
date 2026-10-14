/**
 * Game mode, live fire model: barriers, water, fire breaks, smouldering and rekindles, and the
 * forecast tool.
 */

import { describe, expect, it } from "vitest";
import { CELL, FUEL } from "../../app/game/contracts.js";
import { forecastPerimeter, forecastStepS } from "../../app/game/fire/forecast.js";
import { createFireSim, type LiveFireSim } from "../../app/game/fire/spread.js";
import { centreOf, fillRect, idx, isReached, run, uniformWorld, wx, type TestWorld } from "./fire-test-world.js";

/** True when any cell in rows [r0, r1] was reached by the fire. */
function reachedInRows(sim: LiveFireSim, w: TestWorld, r0: number, r1: number): boolean {
  for (let r = r0; r <= r1; r++) for (let c = 0; c < w.grid.cols; c++) if (isReached(sim.state[idx(w, c, r)]!)) return true;
  return false;
}

function reachedInCols(sim: LiveFireSim, w: TestWorld, c0: number, c1: number): boolean {
  for (let r = 0; r < w.grid.rows; r++) for (let c = c0; c <= c1; c++) if (isReached(sim.state[idx(w, c, r)]!)) return true;
  return false;
}

describe("barriers", () => {
  it("a 2-cell gravel road stops a flank fire at 3 m/s", () => {
    const w = uniformWorld(80, 50);
    fillRect(w, 0, 20, 79, 21, FUEL.road_gravel); // the road, 4 cells north of the ignition
    const sim = createFireSim(w, 7);
    sim.ignite(idx(w, 20, 25));
    run(sim, 6 * 180, wx(270, 3, 30, 22));
    expect(reachedInRows(sim, w, 22, 22)).toBe(true); // the flank reached the road
    expect(reachedInRows(sim, w, 0, 19)).toBe(false); // and did not cross
    expect(sim.state[idx(w, 20, 20)]).toBe(CELL.noFuel);
  });

  it("a 6-cell lake stops everything, even a crowning, spotting head", () => {
    const w = uniformWorld(120, 60, FUEL.spruce_mature);
    fillRect(w, 50, 0, 55, 59, FUEL.water);
    const sim = createFireSim(w, 11);
    sim.ignite(idx(w, 10, 30));
    const { spots } = run(sim, 6 * 90, wx(270, 14, 20, 26));
    expect(spots).toBeGreaterThan(0); // the head did spot
    expect(reachedInCols(sim, w, 49, 49)).toBe(true); // it reached the shore
    expect(reachedInCols(sim, w, 56, 119)).toBe(false); // nothing on the far side
  });

  it("a brook stops a calm surface fire; knight moves never jump a one-cell line", () => {
    const w = uniformWorld(60, 60);
    fillRect(w, 0, 25, 59, 25, FUEL.brook);
    const sim = createFireSim(w, 3);
    sim.ignite(idx(w, 30, 29));
    run(sim, 6 * 240, wx(0, 0, 40, 18));
    expect(reachedInRows(sim, w, 26, 26)).toBe(true);
    expect(reachedInRows(sim, w, 0, 24)).toBe(false);
  });

  it("a strong head fire leaks embers across a brook now and then", () => {
    const w = uniformWorld(140, 120);
    fillRect(w, 40, 0, 40, 119, FUEL.brook);
    let crossed = 0;
    for (const seed of [1, 2, 3, 4]) {
      const sim = createFireSim(w, seed);
      for (let r = 20; r < 100; r++) sim.ignite(idx(w, 30, r)); // a long line fire running at the brook
      run(sim, 6 * 60, wx(270, 9, 25, 26));
      if (reachedInCols(sim, w, 41, 139)) crossed++;
    }
    expect(crossed).toBeGreaterThan(0);
  });
});

describe("water and fire breaks", () => {
  it("water puts out a small fire", () => {
    const w = uniformWorld(40, 40);
    const sim = createFireSim(w, 5);
    for (let r = 19; r <= 21; r++) for (let c = 19; c <= 21; c++) sim.ignite(idx(w, c, r));
    run(sim, 6, wx(0, 0, 40, 20));
    expect(sim.stateCounts()[CELL.burning]).toBeGreaterThan(0);
    const changed = forEachBurning(sim, (cell) => sim.applyWater(centreOf(w, cell), 30, 3000));
    expect(changed).toBeGreaterThan(0);
    expect(sim.stateCounts()[CELL.burning]).toBe(0);
    expect(sim.stateCounts()[CELL.extinguished]).toBeGreaterThan(0);
    const burnedWhenDoused = sim.burnedHa;
    expect(burnedWhenDoused).toBeGreaterThan(0);
    run(sim, 6 * 60, wx(270, 5, 30, 22));
    expect(sim.stateCounts()[CELL.burning]).toBe(0);
    // The ground it burned before it was put out still counts (burnedHa includes extinguished cells); it does not grow.
    expect(sim.burnedHa).toBe(burnedWhenDoused);
  });

  it("too little water only knocks a fire back and wets the ground, which dries in tens of minutes", () => {
    const w = uniformWorld(40, 40);
    const sim = createFireSim(w, 5);
    const cell = idx(w, 20, 20);
    sim.ignite(cell);
    sim.step(10, wx(270, 6, 25, 26));
    const before = sim.intensity[cell]!;
    const changed = sim.applyWater(centreOf(w, cell), 5, 20);
    expect(changed).toEqual([]);
    expect(sim.state[cell]).toBe(CELL.burning);
    expect(sim.intensity[cell]).toBeLessThan(before);
    // Wet an unburned patch and watch it dry (hot, dry afternoon: half-life 20–40 min).
    const patch = idx(w, 5, 5);
    sim.applyWater(centreOf(w, patch), 5, 400);
    const w0 = sim.wetness[patch]!;
    expect(w0).toBeGreaterThan(0.5);
    run(sim, 6 * 30, wx(270, 6, 25, 26));
    const ratio = sim.wetness[patch]! / w0;
    expect(ratio).toBeGreaterThan(0.35);
    expect(ratio).toBeLessThan(0.65);
  });

  it("a one-cell fire break holds a low-intensity flank", () => {
    const w = uniformWorld(80, 50);
    const sim = createFireSim(w, 9);
    const line: number[] = [];
    for (let c = 0; c < 80; c++) line.push(idx(w, c, 21));
    sim.cutFireBreak(line);
    expect(sim.state[idx(w, 10, 21)]).toBe(CELL.noFuel);
    sim.ignite(idx(w, 20, 25));
    run(sim, 6 * 180, wx(270, 3, 30, 22));
    expect(reachedInRows(sim, w, 22, 22)).toBe(true);
    expect(reachedInRows(sim, w, 0, 20)).toBe(false);
  });

  it("a fire break does not take burning cells", () => {
    const w = uniformWorld(20, 20);
    const sim = createFireSim(w, 1);
    const cell = idx(w, 10, 10);
    sim.ignite(cell);
    sim.cutFireBreak([cell, idx(w, 11, 10)]);
    expect(sim.state[cell]).toBe(CELL.burning);
    expect(sim.state[idx(w, 11, 10)]).toBe(CELL.noFuel);
  });
});

describe("smouldering and rekindles", () => {
  it("peat smoulders after flaming, then flares up again in dry wind", () => {
    const w = uniformWorld(40, 40, FUEL.drained_peat);
    const sim = createFireSim(w, 13);
    for (let r = 18; r <= 22; r++) for (let c = 18; c <= 22; c++) sim.ignite(idx(w, c, r));
    // Fog and calm: the flames die in the block, the peat keeps smouldering.
    run(sim, 6 * 30, wx(0, 0, 100, 10));
    const counts = sim.stateCounts();
    expect(counts[CELL.burning]).toBe(0);
    expect(counts[CELL.smouldering]).toBe(25);
    expect(sim.burnedHa).toBeCloseTo((25 * 625) / 10_000, 6);
    // Humid but windy: no rekindle (RH ≥ 35 %).
    expect(run(sim, 6 * 30, wx(225, 8, 50, 15)).rekindled).toBe(0);
    // Dry and windy: the edge flares up and the fire runs again.
    const { rekindled } = run(sim, 6 * 60, wx(225, 8, 25, 25, 10));
    expect(rekindled).toBeGreaterThan(0);
    expect(sim.burnedHa).toBeGreaterThan((25 * 625) / 10_000);
  });

  it("enough water drowns a smouldering peat cell; a little does not", () => {
    const w = uniformWorld(20, 20, FUEL.drained_peat);
    const sim = createFireSim(w, 1);
    const cell = idx(w, 10, 10);
    sim.ignite(cell);
    run(sim, 6 * 10, wx(0, 0, 100, 10));
    expect(sim.state[cell]).toBe(CELL.smouldering);
    expect(sim.applyWater(centreOf(w, cell), 5, 100)).toEqual([]);
    expect(sim.applyWater(centreOf(w, cell), 5, 800)).toEqual([cell]);
    expect(sim.state[cell]).toBe(CELL.extinguished);
  });
});

describe("forecast", () => {
  function liveFire() {
    const w = uniformWorld(120, 80);
    fillRect(w, 0, 0, 119, 79, FUEL.pine_heath);
    fillRect(w, 70, 30, 75, 50, FUEL.water);
    const sim = createFireSim(w, 21);
    sim.ignite(idx(w, 20, 40));
    run(sim, 6 * 40, wx(250, 7, 30, 24));
    sim.applyWater(centreOf(w, idx(w, 30, 40)), 40, 2000);
    return { w, sim };
  }

  it("does not touch the live fire, and is deterministic", () => {
    const { sim } = liveFire();
    const snap = {
      state: sim.state.slice(), intensity: sim.intensity.slice(), wetness: sim.wetness.slice(), ignitedAtS: sim.ignitedAtS.slice(),
      tS: sim.tS, counts: sim.stateCounts(),
    };
    const weather = wx(250, 7, 30, 24);
    const a = forecastPerimeter(sim, weather, 20 * 60);
    const b = forecastPerimeter(sim, weather, 20 * 60);
    expect(sim.state).toEqual(snap.state);
    expect(sim.intensity).toEqual(snap.intensity);
    expect(sim.wetness).toEqual(snap.wetness);
    expect(sim.ignitedAtS).toEqual(snap.ignitedAtS);
    expect(sim.tS).toBe(snap.tS);
    expect(sim.stateCounts()).toEqual(snap.counts);
    expect(b.footprint).toEqual(a.footprint);
    expect(a.atS).toBe(sim.tS + 1200);
    expect(a.newCells.length).toBeGreaterThan(0);
    expect(a.burnedHa).toBeGreaterThan(sim.burnedHa);
    for (const c of a.newCells) expect(isReached(sim.state[c]!)).toBe(false);
  });

  it("matches the live fire run without random events, and accepts weather keys", () => {
    const { sim } = liveFire();
    const weather = wx(250, 7, 30, 24);
    const fc = forecastPerimeter(sim, weather, 20 * 60);
    const twin = sim.clone({ randomEvents: false });
    run(twin, 120, weather);
    expect(Math.abs(fc.burnedHa / twin.burnedHa - 1)).toBeLessThan(0.1);
    const keyed = forecastPerimeter(sim, [{ atS: 0, ...weather }, { atS: 1e6, ...weather }], 20 * 60);
    expect(keyed.footprint).toEqual(fc.footprint);
    expect(forecastStepS(weather, 25)).toBeGreaterThanOrEqual(10);
    expect(forecastStepS(weather, 25)).toBeLessThanOrEqual(120);
  });
});

/** Waters each burning cell (snapshot), returns how many cells changed state. */
function forEachBurning(sim: LiveFireSim, f: (cell: number) => readonly number[]): number {
  const cells: number[] = [];
  for (let i = 0; i < sim.state.length; i++) if (sim.state[i] === CELL.burning) cells.push(i);
  let changed = 0;
  for (const c of cells) changed += f(c).length;
  return changed;
}
