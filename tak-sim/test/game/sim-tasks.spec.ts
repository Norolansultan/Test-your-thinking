/**
 * Game mode: what units do with their orders — direct attack until the tank is empty and back after a
 * refill, the shuttle that keeps an engine supplied, crews that refuse a too-hot edge, a hose line
 * that holds, a fire break cut at saw speed, and the helicopter's scoop-and-drop cycle.
 */

import { describe, expect, it } from "vitest";
import { CELL, type WeatherKey } from "../../app/game/contracts.js";
import { createGame } from "../../app/game/sim/game.js";
import { UNIT_SPECS } from "../../app/game/sim/unit-specs.js";
import { cellOf, cellsAlongLine, fakeDeps, lightBlock, makeWorld, scenario, type FakeFire } from "./fakes.js";

const unit = (g: ReturnType<typeof createGame>, id: string) => g.state.units.find((u) => u.id === id)!;
const SOUTHERLY: readonly WeatherKey[] = [{ atS: 0, windFromDeg: 180, windMs: 4, gustMs: 6, tempC: 22, rh: 35 }];

function burningIn(fire: FakeFire, cells: readonly number[]): number {
  return cells.filter((c) => fire.state[c] === CELL.burning).length;
}

describe("attack", () => {
  it("puts out a small edge with the tank's water", () => {
    let block: number[] = [];
    const deps = fakeDeps({}, (f, w) => { block = lightBlock(f, w, 640, 880, 720, 940); });
    const g = createGame(scenario({ units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }] }), makeWorld(), 1, deps);
    const fire = deps.fires[0]!;
    expect(block.length).toBe(9);
    g.issue("EK11", { type: "attack", target: { x: 680, y: 900 } });
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      g.tick(10);
      seen.add(unit(g, "EK11").status);
    }
    expect(seen.has("moving")).toBe(true);
    expect(seen.has("working")).toBe(true);
    expect(unit(g, "EK11").waterL).toBeLessThan(3000);
    g.tick(1800);
    expect(burningIn(fire, block)).toBe(0);
    expect(block.every((c) => fire.state[c] === CELL.extinguished)).toBe(true);
    expect(g.state.score.containedAtS).not.toBeNull();
  });

  it("runs the tank empty, radios it, refills at the water point and comes back to finish", () => {
    let block: number[] = [];
    const deps = fakeDeps({}, (f, w) => { block = lightBlock(f, w, 640, 880, 790, 990); });
    const g = createGame(scenario({ units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }] }), makeWorld(), 1, deps);
    const fire = deps.fires[0]!;
    expect(block.length * 200).toBeGreaterThan(UNIT_SPECS.engine.waterL);
    g.issue("EK11", { type: "attack", target: { x: 700, y: 900 } });
    const seen = new Set<string>();
    let refilled = false;
    for (let i = 0; i < 400 && burningIn(fire, block) > 0; i++) {
      g.tick(10);
      const u = unit(g, "EK11");
      seen.add(u.status);
      if (seen.has("refilling") && u.waterL >= UNIT_SPECS.engine.waterL - 1) refilled = true;
    }
    expect(seen.has("returning")).toBe(true);
    expect(seen.has("refilling")).toBe(true);
    expect(refilled).toBe(true);
    expect(burningIn(fire, block)).toBe(0);
    expect(unit(g, "EK11").order?.type).toBe("attack");
    const empty = g.state.radio.find((m) => m.from === "EK11" && m.textFi.includes("vesi loppu"));
    expect(empty?.textEn).toContain("tank empty");
    expect(empty?.textFi).toContain("Testilampi");
  });

  it("waits for the shuttle instead of leaving the line when a tanker supplies it", () => {
    let block: number[] = [];
    const deps = fakeDeps({}, (f, w) => { block = lightBlock(f, w, 640, 880, 790, 990); });
    const g = createGame(scenario({ units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }, { id: "EK13", kind: "tanker", arriveAtS: 0 }] }), makeWorld(), 1, deps);
    const fire = deps.fires[0]!;
    g.issue("EK11", { type: "attack", target: { x: 700, y: 900 } });
    g.issue("EK13", { type: "shuttle", waterPointId: "W1", toUnitId: "EK11" });
    const statuses = new Set<string>();
    for (let i = 0; i < 400 && burningIn(fire, block) > 0; i++) {
      g.tick(10);
      statuses.add(unit(g, "EK11").status);
    }
    expect(burningIn(fire, block)).toBe(0);
    expect(statuses.has("refilling")).toBe(false);
    expect(unit(g, "EK13").waterL).toBeLessThan(UNIT_SPECS.tanker.waterL);
  });

  it("refuses an edge hotter than the crew's limit and says so", () => {
    let block: number[] = [];
    const deps = fakeDeps({ intensity: 6000 }, (f, w) => { block = lightBlock(f, w, 640, 880, 720, 940); });
    const g = createGame(scenario({ units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }] }), makeWorld(), 1, deps);
    g.issue("EK11", { type: "attack", target: { x: 680, y: 900 } });
    g.tick(900);
    const fire = deps.fires[0]!;
    expect(burningIn(fire, block)).toBe(block.length);
    expect(fire.totalLitres).toBe(0);
    const hot = g.state.radio.find((m) => m.from === "EK11" && m.textFi.includes("liian kuuma"));
    expect(hot?.textEn).toContain("too hot for direct attack");
    expect(unit(g, "EK11").harm).toBe(0);
  });

  it("does not spray water within 15 m of the live line even when the edge is there", () => {
    let block: number[] = [];
    const deps = fakeDeps({}, (f, w) => { block = lightBlock(f, w, 990, 880, 1010, 920); });
    const g = createGame(scenario({ units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }], powerLineLiveAtStart: true }), makeWorld(), 1, deps);
    expect(g.issue("EK11", { type: "attack", target: { x: 1045, y: 900 } }).ok).toBe(true);
    g.tick(900);
    expect(deps.fires[0]!.totalLitres).toBe(0);
    expect(burningIn(deps.fires[0]!, block)).toBe(block.length);
  });
});

describe("hose line", () => {
  it("lays the line at laying speed and holds the fire where it meets it", () => {
    const deps = fakeDeps({ growEvery: 2, growFromS: 2400, spreadCos: 0.9 }, (f, w) => { lightBlock(f, w, 300, 280, 900, 320); });
    const world = makeWorld();
    const g = createGame(scenario({ units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }], weather: SOUTHERLY }), world, 1, deps);
    const fire = deps.fires[0]!;
    g.issue("EK11", { type: "move", to: { x: 400, y: 612.5 } });
    g.tick(400);
    expect(unit(g, "EK11").status).toBe("idle");
    g.issue("EK11", { type: "hose_line", to: { x: 800, y: 612.5 } });
    g.tick(600);
    const laidAt10 = unit(g, "EK11").hoseLine!;
    const len10 = Math.hypot(laidAt10[1]!.x - laidAt10[0]!.x, laidAt10[1]!.y - laidAt10[0]!.y);
    expect(len10).toBeGreaterThan(UNIT_SPECS.engine.hoseLayMpm * 9);
    expect(len10).toBeLessThan(UNIT_SPECS.engine.hoseLayMpm * 10 + 1);
    g.tick(900);
    const line = unit(g, "EK11").hoseLine!;
    expect(line[1]!.x).toBeCloseTo(800, 3);
    expect(g.state.radio.some((m) => m.from === "EK11" && m.textFi.includes("letkulinja valmis"))).toBe(true);
    g.tick(1200); // the fire grows from 40 min and passes the line's row
    const behind = cellOf(world.grid, { x: 600, y: 662.5 })!;
    const outside = cellOf(world.grid, { x: 862.5, y: 662.5 })!;
    expect(fire.state[outside]).toBe(CELL.burning);
    expect(fire.state[behind]).toBe(CELL.unburned);
    for (const c of cellsAlongLine(world.grid, { x: 450, y: 612.5 }, { x: 750, y: 612.5 })) expect(fire.state[c]).not.toBe(CELL.burning);
    expect(unit(g, "EK11").waterL).toBeLessThan(UNIT_SPECS.engine.waterL);
  });
});

describe("hose line feeds", () => {
  it("runs the forest unit's line from natural water: the tank is never drawn and the line is kept wet", () => {
    const deps = fakeDeps();
    const world = makeWorld();
    const g = createGame(scenario({ units: [{ id: "EK14", kind: "forest_unit", arriveAtS: 0 }] }), world, 1, deps);
    g.issue("EK14", { type: "hose_line", to: { x: 700, y: 1000 } });
    g.tick(3600);
    const u = unit(g, "EK14");
    expect(u.hoseLine![0]).toEqual(world.waterPoints[0]!.at);
    expect(u.waterL).toBe(UNIT_SPECS.forest_unit.waterL);
    expect(g.state.radio.some((m) => m.from === "EK14" && m.textFi.includes("luonnonvesipisteestä"))).toBe(true);
    const mid = cellOf(world.grid, { x: 500, y: 875 })!;
    expect(deps.fires[0]!.wetness[mid]).toBeGreaterThan(0.5);
  });

  it("lays the robot's hose dry without a feeding unit, and draws a nearby engine's tank with one", () => {
    let block: number[] = [];
    const deps = fakeDeps({}, (f, w) => { block = lightBlock(f, w, 600, 1030, 700, 1070); });
    const g = createGame(scenario({ units: [{ id: "UGV1", kind: "ugv", arriveAtS: 0 }, { id: "EK11", kind: "engine", arriveAtS: 0 }] }), makeWorld(), 1, deps);
    expect(block.length).toBe(8);
    g.issue("EK11", { type: "move", to: { x: 1400, y: 750 } });
    g.tick(200);
    g.issue("UGV1", { type: "hose_line", to: { x: 650, y: 1000 } });
    g.tick(1500);
    expect(g.state.radio.some((m) => m.from === "UGV1" && m.textEn.includes("no water in it"))).toBe(true);
    expect(deps.fires[0]!.totalLitres).toBe(0);
    const anchor = unit(g, "UGV1").hoseLine![0]!;
    g.issue("EK11", { type: "move", to: anchor });
    g.tick(900);
    expect(deps.fires[0]!.totalLitres).toBeGreaterThan(0);
    expect(unit(g, "EK11").waterL).toBeLessThan(UNIT_SPECS.engine.waterL);
  });
});

describe("fire break", () => {
  it("cuts the cells along the line at saw speed and reports when done", () => {
    const deps = fakeDeps();
    const world = makeWorld();
    const g = createGame(scenario({ units: [{ id: "EK14", kind: "forest_unit", arriveAtS: 0 }] }), world, 1, deps);
    const fire = deps.fires[0]!;
    const from = { x: 500, y: 1000 };
    const to = { x: 600, y: 1000 };
    const cells = cellsAlongLine(world.grid, from, to);
    g.issue("EK14", { type: "fire_break", from, to });
    g.tick(300);
    expect(unit(g, "EK14").status).toBe("working");
    g.tick(1200);
    const cut = cells.filter((c) => fire.state[c] === CELL.noFuel).length;
    expect(cut).toBeGreaterThan(0);
    expect(cut).toBeLessThan(cells.length);
    g.tick(1800);
    expect(cells.every((c) => fire.state[c] === CELL.noFuel)).toBe(true);
    expect(unit(g, "EK14").order).toBeNull();
    expect(g.state.radio.some((m) => m.from === "EK14" && m.textFi.includes("palokatko valmis") && m.textEn.includes("fire break finished"))).toBe(true);
  });
});

describe("drops", () => {
  it("cycles the helicopter between the pond and the fire, dropping a full bucket each round", () => {
    let block: number[] = [];
    const deps = fakeDeps({ intensity: 3000 }, (f, w) => { block = lightBlock(f, w, 560, 1060, 640, 1140); });
    const g = createGame(scenario({ units: [{ id: "HELI1", kind: "helicopter", arriveAtS: 0 }] }), makeWorld(), 1, deps);
    const fire = deps.fires[0]!;
    g.issue("HELI1", { type: "drop", target: { x: 600, y: 1100 } });
    const statuses = new Set<string>();
    for (let i = 0; i < 30; i++) {
      g.tick(10);
      statuses.add(unit(g, "HELI1").status);
    }
    expect(statuses.has("refilling")).toBe(true);
    expect(fire.totalLitres).toBeGreaterThanOrEqual(2 * UNIT_SPECS.helicopter.waterL);
    expect(burningIn(fire, block)).toBeLessThan(block.length);
    const drop = g.state.radio.find((m) => m.from === "HELI1");
    expect(drop?.textFi).toContain("pudotus tehty");
    expect(drop?.textEn).toContain("men clear of it");
    expect(unit(g, "HELI1").order?.type).toBe("drop");
  });

  it("holds the water drone when the gusts exceed 11 m/s", () => {
    const deps = fakeDeps({}, (f, w) => { lightBlock(f, w, 560, 1060, 640, 1140); });
    const gusty: readonly WeatherKey[] = [{ atS: 0, windFromDeg: 300, windMs: 8, gustMs: 13, tempC: 20, rh: 30 }];
    const g = createGame(scenario({ units: [{ id: "VD1", kind: "drone_water", arriveAtS: 0 }], weather: gusty }), makeWorld(), 1, deps);
    g.issue("VD1", { type: "drop", target: { x: 600, y: 1100 } });
    g.tick(600);
    expect(deps.fires[0]!.totalLitres).toBe(0);
    expect(g.state.radio.some((m) => m.from === "VD1" && m.textFi.includes("puuskat yli rajan"))).toBe(true);
  });

  it("sends a drone home for a battery swap at 15 % and resumes the orbit", () => {
    const g = createGame(scenario({ units: [{ id: "DR1", kind: "drone_thermal", arriveAtS: 0 }] }), makeWorld(), 1, fakeDeps());
    g.issue("DR1", { type: "recon", centre: { x: 800, y: 1100 } });
    const seen = new Set<string>();
    let minPct = 100;
    for (let i = 0; i < 300; i++) {
      g.tick(10);
      const u = unit(g, "DR1");
      seen.add(u.status);
      minPct = Math.min(minPct, u.energyPct);
    }
    expect(minPct).toBeLessThanOrEqual(15);
    expect(minPct).toBeGreaterThan(5);
    expect(seen.has("returning")).toBe(true);
    expect(seen.has("refilling")).toBe(true);
    expect(unit(g, "DR1").order?.type).toBe("recon");
    expect(g.state.radio.some((m) => m.from === "DR1" && m.textFi.includes("akku"))).toBe(true);
  });
});
