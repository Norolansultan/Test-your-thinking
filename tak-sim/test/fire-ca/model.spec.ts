/**
 * SPEC/24 §2–§3 — the Alexandridis (2008) automaton and its additions.
 */

import { describe, expect, it } from "vitest";
import {
  ALEXANDRIDIS_2008,
  BOREAL_PROVISIONAL,
  BURNED,
  BURNING,
  FireAutomaton,
  Mulberry32,
  NO_FUEL,
  UNBURNED,
  windFactor,
  type FuelClass,
  type FuelGrid,
} from "../../tools/fire-ca/model.js";

const PINE: FuelClass = { id: "pine", labelFi: "Mänty", burnable: true, pVeg: 0.4, pDen: 0 };
const WATER: FuelClass = { id: "water", labelFi: "Vesi", burnable: false, pVeg: 0, pDen: 0 };

function grid(n: number, fuel?: (c: number, r: number) => number): FuelGrid {
  const f = new Uint8Array(n * n);
  if (fuel) for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) f[r * n + c] = fuel(c, r);
  return { cols: n, rows: n, cellSizeM: 25, fuel: f, classes: [PINE, WATER], elevationM: null };
}

function run(seed: number, steps: number, n = 61) {
  const ca = new FireAutomaton(grid(n), BOREAL_PROVISIONAL);
  ca.ignite([30 * n + 30]);
  const rng = new Mulberry32(seed);
  for (let s = 0; s < steps; s++) ca.step({ fromDeg: 180, speedMs: 6 }, rng);
  return ca;
}

describe("windFactor", () => {
  it("is exp(c1·V) straight downwind and smaller at every other angle", () => {
    const wind = { fromDeg: 225, speedMs: 7 };
    const down = windFactor(wind, 45, ALEXANDRIDIS_2008);
    expect(down).toBeCloseTo(Math.exp(ALEXANDRIDIS_2008.c1 * 7), 12);
    for (const b of [0, 90, 135, 180, 225, 270, 315]) expect(windFactor(wind, b, ALEXANDRIDIS_2008)).toBeLessThan(down);
  });

  it("is symmetric about the wind heading", () => {
    const wind = { fromDeg: 200, speedMs: 9 };
    expect(windFactor(wind, 20 + 40, ALEXANDRIDIS_2008)).toBeCloseTo(windFactor(wind, 20 - 40, ALEXANDRIDIS_2008), 12);
  });

  it("is exactly 1 in calm air", () => {
    expect(windFactor({ fromDeg: 0, speedMs: 0 }, 123, ALEXANDRIDIS_2008)).toBe(1);
  });
});

describe("FireAutomaton", () => {
  it("is deterministic: the same seed gives bit-identical cell states", () => {
    expect(Array.from(run(42, 15).state)).toEqual(Array.from(run(42, 15).state));
  });

  it("different seeds give different fires", () => {
    expect(Array.from(run(1, 15).state)).not.toEqual(Array.from(run(2, 15).state));
  });

  it("a burning cell burns out after one step", () => {
    const ca = new FireAutomaton(grid(11), BOREAL_PROVISIONAL);
    ca.ignite([5 * 11 + 5]);
    ca.step({ fromDeg: 0, speedMs: 0 }, new Mulberry32(1));
    expect(ca.state[5 * 11 + 5]).toBe(BURNED);
  });

  it("never burns cells without fuel", () => {
    const n = 41;
    const ca = new FireAutomaton(grid(n, (c) => (c === 25 ? 1 : 0)), ALEXANDRIDIS_2008); // a water column at c = 25
    ca.ignite([20 * n + 20]);
    const rng = new Mulberry32(7);
    for (let s = 0; s < 40; s++) ca.step({ fromDeg: 270, speedMs: 10 }, rng);
    for (let r = 0; r < n; r++) expect(ca.state[r * n + 25]).toBe(NO_FUEL);
  });

  it("spreads further downwind than upwind", () => {
    const n = 61;
    const ca = run(3, 20, n);
    let north = 0;
    let south = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const s = ca.state[r * n + c];
      if (s === BURNED || s === BURNING) { north = Math.max(north, r - 30); south = Math.max(south, 30 - r); }
    }
    expect(north).toBeGreaterThan(south + 5); // wind from the south drives the head north
  });

  it("the provisional boreal calibration gives an elongated fire (length:breadth > 2 at 9 m/s)", () => {
    const n = 121;
    let len = 0;
    let wid = 0;
    for (const seed of [1, 2, 3]) {
      const ca = new FireAutomaton(grid(n), BOREAL_PROVISIONAL);
      ca.ignite([60 * n + 60]);
      const rng = new Mulberry32(seed);
      for (let s = 0; s < 40; s++) ca.step({ fromDeg: 180, speedMs: 9 }, rng);
      let minR = n, maxR = 0, minC = n, maxC = 0;
      ca.footprint().forEach((v, i) => {
        if (!v) return;
        const c = i % n;
        const r = (i - c) / n;
        minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      });
      len += maxR - minR;
      wid += maxC - minC;
    }
    expect(len / wid).toBeGreaterThan(2);
  });

  it("perimeter persistence relights only burned cells next to unburned fuel", () => {
    const n = 21;
    const ca = new FireAutomaton(grid(n), BOREAL_PROVISIONAL);
    const block: number[] = [];
    for (let r = 8; r <= 12; r++) for (let c = 8; c <= 12; c++) block.push(r * n + c);
    ca.ignite(block);
    ca.extinguish(block);
    ca.reactivatePerimeter();
    expect(ca.state[10 * n + 10]).toBe(BURNED); // interior stays out
    expect(ca.state[8 * n + 8]).toBe(BURNING); // edge relit
    expect(ca.state[0]).toBe(UNBURNED);
  });

  it("a secured sector cannot be relit", () => {
    const n = 21;
    const ca = new FireAutomaton(grid(n), BOREAL_PROVISIONAL);
    ca.ignite([10 * n + 10]);
    ca.secureSector(() => true);
    ca.reactivatePerimeter();
    expect(ca.burningCount()).toBe(0);
  });
});

describe("linear barriers (SPEC/24 §12)", () => {
  const ROAD: FuelClass = { id: "road_gravel", labelFi: "Soratie", burnable: true, pVeg: -0.7, pDen: -0.4, barrier: { minWindMs: 9, headArcDeg: 45, leak: 0.01 } };
  /** A 61×61 pine grid with an E–W road along row 40, fire lit at row 20, wind from the south. */
  function beyondRoad(speedMs: number, seed: number): number {
    const n = 61;
    const f = new Uint8Array(n * n);
    for (let c = 0; c < n; c++) f[40 * n + c] = 2;
    const ca = new FireAutomaton({ cols: n, rows: n, cellSizeM: 25, fuel: f, classes: [PINE, WATER, ROAD], elevationM: null }, BOREAL_PROVISIONAL);
    ca.ignite([20 * n + 30]);
    const rng = new Mulberry32(seed);
    for (let s = 0; s < 60; s++) {
      if (ca.burningCount() === 0) ca.reactivatePerimeter();
      ca.step({ fromDeg: 180, speedMs }, rng);
    }
    let burned = 0;
    for (let r = 41; r < n; r++) for (let c = 0; c < n; c++) if (ca.state[r * n + c] === BURNED || ca.state[r * n + c] === BURNING) burned++;
    return burned;
  }

  it("stops a fire in light wind (below the road's threshold)", () => {
    const crossed = [1, 2, 3, 4, 5].filter((seed) => beyondRoad(5, seed) > 20).length;
    expect(crossed).toBeLessThanOrEqual(1);
  });

  it("lets a wind-driven head cross it at the gust threshold", () => {
    const crossed = [1, 2, 3, 4, 5].filter((seed) => beyondRoad(10, seed) > 20).length;
    expect(crossed).toBeGreaterThanOrEqual(4);
  });
});
