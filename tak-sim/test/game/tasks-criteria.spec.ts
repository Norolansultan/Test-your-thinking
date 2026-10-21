/**
 * Game mode, SPEC/34 §4: the decision tasks' criterion builders (`app/game/tasks/criteria.ts`) on hand-made final
 * states and traces — each says met or not with the numbers, in both languages.
 */

import { describe, expect, it } from "vitest";
import { CELL, type GameGrid, type GameState, type Order, type Unit } from "../../app/game/contracts.js";
import type { TaskTrace, TraceSample } from "../../app/game/tasks/contracts.js";
import {
  assetsIntact, containedBy, crewsClearOf, fireMapped, keptSupplied, maxBurnedHa, noCasualties, noCrewHarm, noFlamesFrom,
  nothingLeftBurning, noWaterNearLiveLine, shuttleDrawsFrom,
} from "../../app/game/tasks/criteria.js";

const GRID: GameGrid = { cols: 10, rows: 10, cellM: 25, originTm35: { east: 0, north: 0 } };
const START = 8 * 60;

function state(over: { burnedHa?: number; casualties?: number; fire?: number[]; known?: number[]; assets?: Record<string, "intact" | "burned" | "protected">; units?: Partial<Unit>[] } = {}): GameState {
  const fire = new Uint8Array(100).fill(CELL.unburned);
  for (const c of over.fire ?? []) fire[c] = CELL.burnedOut;
  const known = new Uint8Array(100).fill(255);
  for (const c of over.known ?? []) known[c] = CELL.burnedOut;
  return {
    fire: { state: fire }, known, assetStatus: over.assets ?? {},
    units: (over.units ?? []) as Unit[],
    score: { burnedHa: over.burnedHa ?? 0, casualties: over.casualties ?? 0 },
  } as unknown as GameState;
}

function sample(tS: number, units: Partial<TraceSample["units"][number]>[] = [], flamingCells = 0): TraceSample {
  return {
    tS, burnedHa: 0, flamingCells, smoulderingCells: 0, powerLineLive: true,
    units: units.map((u) => ({ id: "EK11", pos: { x: 0, y: 0 }, status: "working", waterL: 1000, harm: 0, ...u })),
  };
}

function trace(samples: TraceSample[], over: Partial<TaskTrace> = {}): TaskTrace {
  return { samples, waterNearLiveLine: [], everObserved: new Set<number>(), grid: GRID, ...over };
}

describe("decision-task criteria", () => {
  it("burned area, casualties and crew harm", () => {
    expect(maxBurnedHa(5).judge(state({ burnedHa: 4.9 }), trace([])).met).toBe(true);
    const over = maxBurnedHa(4.5).judge(state({ burnedHa: 4.81 }), trace([]));
    expect(over).toEqual({ met: false, detailFi: "Paloala 4,8 ha (raja 4,5 ha).", detailEn: "Burned area 4.8 ha (limit 4.5 ha)." });
    expect(maxBurnedHa(6).labelEn).toBe("Burned area at most 6 ha");
    expect(noCasualties().judge(state({ casualties: 1 }), trace([])).met).toBe(false);
    const harm = noCrewHarm(0.03, START).judge(state(), trace([sample(600, [{ id: "VPK", harm: 0.02 }]), sample(660, [{ id: "VPK", harm: 0.2 }])]));
    expect(harm.met).toBe(false);
    expect(harm.detailEn).toBe("VPK was caught in the heat (harm 20 %) at 08:11.");
  });

  it("buildings: all of a group, or at least some", () => {
    const final = state({ assets: { a: "burned", b: "protected", c: "intact" } });
    expect(assetsIntact("all", ["a", "b", "c"], "Tila", "The farm").judge(final, trace([])).met).toBe(false);
    const two = assetsIntact("two", ["a", "b", "c"], "Tila", "The farm", 2);
    expect(two.labelEn).toBe("The farm: at least 2 of 3 saved");
    expect(two.judge(final, trace([]))).toEqual({ met: true, detailFi: "2/3 säilyi; paloi: a.", detailEn: "2 of 3 stand; burned: a." });
  });

  it("water near the live line", () => {
    expect(noWaterNearLiveLine(START).judge(state(), trace([])).met).toBe(true);
    const bad = noWaterNearLiveLine(START).judge(state(), trace([], { waterNearLiveLine: [{ tS: 1200, unitId: "HELI1" }, { tS: 1260, unitId: "HELI1" }] }));
    expect(bad.met).toBe(false);
    expect(bad.detailEn).toBe("HELI1: water near the line while it was live (first at 08:20).");
  });

  it("a unit kept working and in water, with an allowance of dry minutes", () => {
    const ss = [0, 60, 120, 180, 240].map((t, i) => sample(t, [{ status: i === 2 ? "refilling" : "working", waterL: i === 2 ? 0 : 900 }]));
    expect(keptSupplied("EK11", 0, 240, START).judge(state(), trace(ss)).met).toBe(false);
    expect(keptSupplied("EK11", 0, 240, START, 1).judge(state(), trace(ss)).met).toBe(true);
    const idle = [0, 60, 120].map((t) => sample(t, [{ status: "idle" }]));
    expect(keptSupplied("EK11", 0, 120, START).judge(state(), trace(idle)).met).toBe(false);
  });

  it("the tanker's water point, read from its order at the end", () => {
    const order = (o: Order | null) => state({ units: [{ id: "EK13", order: o }] });
    const c = shuttleDrawsFrom("EK13", "bridge", "Silta", "the bridge", "Lähin tietä pitkin.", "Nearest by road.");
    expect(c.judge(order({ type: "shuttle", waterPointId: "bridge", toUnitId: "EK11" }), trace([])).met).toBe(true);
    expect(c.judge(order({ type: "shuttle", waterPointId: "lake", toUnitId: "EK11" }), trace([])).met).toBe(false);
    expect(c.judge(order(null), trace([])).met).toBe(false);
  });

  it("a fire found and mapped: the share of its reached ground seen and on the map", () => {
    const burned = [0, 1, 2, 10, 11, 12, 20, 21, 22, 30];
    const centre = { x: 37.5, y: 212.5 }; // cell 11's centre
    const seen = burned.slice(0, 7);
    const final = state({ fire: burned, known: seen });
    const c = fireMapped("a", "Palo", "The fire", centre, 100, 0.7);
    expect(c.judge(final, trace([], { everObserved: new Set(seen) })).met).toBe(true);
    expect(c.judge(final, trace([], { everObserved: new Set(seen.slice(0, 5)) })).met).toBe(false);
    expect(c.judge(final, { samples: [], waterNearLiveLine: [], everObserved: new Set(seen) }).met).toBe(false); // no grid to judge on
  });

  it("nothing left burning, no flames from a time, contained by a time", () => {
    const final = state();
    (final.fire.state as Uint8Array)[5] = CELL.smouldering;
    expect(nothingLeftBurning(0).judge(final, trace([])).met).toBe(false);
    expect(nothingLeftBurning(1).judge(final, trace([])).met).toBe(true);
    const ss = [sample(0, [], 3), sample(60, [], 0), sample(120, [], 0), sample(180, [], 2)];
    expect(noFlamesFrom(60, START).judge(final, trace(ss)).met).toBe(false);
    expect(noFlamesFrom(60, START).judge(final, trace(ss.slice(0, 3))).met).toBe(true);
    expect(containedBy(60, START).judge(final, trace(ss)).met).toBe(true);
    expect(containedBy(0, START).judge(final, trace(ss)).met).toBe(false);
  });

  it("crews clear of the head's path when the wind turns: crewed ground units only, in the window only", () => {
    const zone = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const units = [{ id: "EK11", kind: "engine" }, { id: "DR1", kind: "drone_thermal" }];
    const c = crewsClearOf("clear", zone, 600, 900, "kärjen tiellä", "in the head's path", START, units);
    const inside = { pos: { x: 50, y: 50 } };
    expect(c.judge(state(), trace([sample(600, [{ id: "DR1", ...inside }]), sample(960, [{ id: "EK11", ...inside }])])).met).toBe(true);
    const bad = c.judge(state(), trace([sample(660, [{ id: "EK11", ...inside }])]));
    expect(bad).toEqual({ met: false, detailFi: "Kärjen tiellä: EK11 (ensimmäisen kerran klo 08:11).", detailEn: "In the head's path: EK11 (first at 08:11)." });
  });
});
