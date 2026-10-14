/**
 * Game mode: fog of war (the player sees only what units see; smoke blinds ground crews, not thermal
 * drones), buildings that burn unless protected, settlements lost, and crews hurt in high intensity.
 */

import { describe, expect, it } from "vitest";
import { CELL, type WeatherKey } from "../../app/game/contracts.js";
import { UNKNOWN } from "../../app/game/sim/fog.js";
import { createGame } from "../../app/game/sim/game.js";
import { UNIT_SPECS } from "../../app/game/sim/unit-specs.js";
import { cellCentre, cellOf, fakeDeps, lightBlock, makeWorld, scenario, VILLAGE } from "./fakes.js";

const unit = (g: ReturnType<typeof createGame>, id: string) => g.state.units.find((u) => u.id === id)!;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const SOUTHERLY: readonly WeatherKey[] = [{ atS: 0, windFromDeg: 180, windMs: 4, gustMs: 6, tempC: 22, rh: 35 }];

describe("fog of war", () => {
  it("reveals only cells within a unit's sensor radius, and the reported ignition", () => {
    const world = makeWorld();
    const far = { x: 1300, y: 1300 };
    const deps = fakeDeps({}, (f, w) => { lightBlock(f, w, 1280, 1280, 1320, 1320); });
    const g = createGame(scenario({ units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }, { id: "DR1", kind: "drone_thermal", arriveAtS: 0 }], ignitions: [{ x: 200, y: 200 }] }), world, 1, deps);
    const s = g.state;
    const ign = cellOf(world.grid, { x: 200, y: 200 })!;
    expect(s.known[ign]).toBe(CELL.burning);
    const farCell = cellOf(world.grid, far)!;
    expect(s.known[farCell]).toBe(UNKNOWN);
    expect(s.knownAtS[farCell]).toBe(-1);
    for (let c = 0; c < world.grid.cols * world.grid.rows; c++) {
      if (s.known[c] === UNKNOWN || c === ign) continue;
      expect(dist(cellCentre(world.grid, c), world.commandPost)).toBeLessThanOrEqual(UNIT_SPECS.drone_thermal.sensorM + 1);
    }
    g.issue("DR1", { type: "recon", centre: far });
    g.tick(150);
    expect(g.state.known[farCell]).toBe(CELL.burning);
    expect(g.state.knownAtS[farCell]).toBeGreaterThan(100);
    // once the drone has gone, the truth changes unseen: the picture keeps the last observation
    g.issue("DR1", { type: "move", to: world.commandPost });
    g.tick(200);
    const seenAt = g.state.knownAtS[farCell]!;
    deps.fires[0]!.state[farCell] = CELL.extinguished;
    g.tick(60);
    expect(g.state.known[farCell]).toBe(CELL.burning);
    expect(g.state.knownAtS[farCell]).toBe(seenAt);
  });

  it("lets a thermal drone see through smoke farther than a ground crew", () => {
    const world = makeWorld();
    // wind from the south-west: the plume runs north-east of the block
    const swWind: readonly WeatherKey[] = [{ atS: 0, windFromDeg: 225, windMs: 4, gustMs: 6, tempC: 22, rh: 35 }];
    const deps = fakeDeps({}, (f, w) => { lightBlock(f, w, 600, 1000, 640, 1040); });
    const spot = { x: 800, y: 1180 };
    const g = createGame(scenario({ units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }, { id: "DR1", kind: "drone_thermal", arriveAtS: 0 }], weather: swWind }), world, 1, deps);
    g.issue("EK11", { type: "move", to: spot });
    g.tick(900);
    expect(dist(unit(g, "EK11").pos, spot)).toBeLessThan(0.01);
    const probe = cellOf(world.grid, { x: 800, y: 1350 })!; // 170 m from the crew, inside its clear-air radius
    expect(g.state.known[probe]).toBe(UNKNOWN);
    g.issue("DR1", { type: "move", to: spot });
    g.tick(120);
    expect(g.state.known[probe]).not.toBe(UNKNOWN);
  });
});

describe("buildings and settlements", () => {
  function villageFire(protect: boolean) {
    const deps = fakeDeps({ growEvery: 18, spreadCos: 0.6, burnOutS: 400 }, (f, w) => { lightBlock(f, w, 1000, 60, 1400, 110); });
    const g = createGame(scenario({ units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }], weather: SOUTHERLY }), makeWorld(), 1, deps);
    if (protect) expect(g.issue("EK11", { type: "protect", assetOrSettlementId: "kyla" }).ok).toBe(true);
    g.tick(3000);
    return g;
  }

  it("burns unprotected houses, radios it as urgent and loses the settlement past half", () => {
    const g = villageFire(false);
    const s = g.state.score;
    expect(s.assetsLost).toBeGreaterThanOrEqual(3);
    expect(s.settlementsLost).toEqual(["kyla"]);
    const urgent = g.state.radio.filter((m) => m.priority === "urgent");
    expect(urgent.some((m) => m.textFi.includes("rakennus syttynyt") && m.textFi.includes("Testikylä"))).toBe(true);
    expect(urgent.some((m) => m.textEn.includes("Test Village is lost"))).toBe(true);
    expect(s.points).toBeLessThan(1000 - 3 * 50 - 200 + 1);
  });

  it("keeps protected houses standing against a moderate front", () => {
    const g = villageFire(true);
    expect(g.state.score.assetsLost).toBe(0);
    expect(g.state.score.settlementsLost).toEqual([]);
    const u = unit(g, "EK11");
    expect(u.status).not.toBe("out_of_action");
    expect(u.harm).toBeLessThan(0.4);
    expect(u.waterL).toBeLessThan(3000);
    expect(dist(u.pos, VILLAGE)).toBeLessThan(400);
  });

  it("ends the game as lost when a protected-settlement objective fails", () => {
    const deps = fakeDeps({ growEvery: 2, spreadCos: 0.6 }, (f, w) => { lightBlock(f, w, 1000, 60, 1400, 110); });
    const g = createGame(scenario({ units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }], weather: SOUTHERLY, objectives: [{ kind: "protect_settlement", settlementId: "Testikylä" }] }), makeWorld(), 1, deps);
    expect(g.scenario.objectives).toEqual([{ kind: "protect_settlement", settlementId: "kyla" }]);
    g.tick(900);
    expect(g.state.phase).toBe("lost");
    expect(g.state.score.objectives[0]!.met).toBe(false);
    expect(["D", "F"]).toContain(g.state.score.grade);
  });
});

describe("crew safety", () => {
  it("hurts a crew kept in high intensity: urgent warning, MAYDAY, casualty, game lost", () => {
    const at = { x: 612.5, y: 1012.5 };
    const deps = fakeDeps({ intensity: 9000 });
    const world = makeWorld();
    const g = createGame(scenario({ units: [{ id: "EK12", kind: "engine", arriveAtS: 0 }, { id: "EK11", kind: "engine", arriveAtS: 0 }], objectives: [{ kind: "no_casualties" }] }), world, 1, deps);
    g.issue("EK12", { type: "move", to: at });
    g.tick(900);
    expect(dist(unit(g, "EK12").pos, at)).toBeLessThan(1);
    g.issue("EK12", { type: "hold" });
    lightBlock(deps.fires[0]!, world, 560, 960, 660, 1060);
    let maxHarm = 0;
    for (let i = 0; i < 60 && g.state.phase === "running"; i++) {
      g.tick(10);
      maxHarm = Math.max(maxHarm, unit(g, "EK12").harm);
    }
    const u = unit(g, "EK12");
    expect(u.harm).toBe(1);
    expect(u.status).toBe("out_of_action");
    expect(g.state.score.casualties).toBe(1);
    expect(g.state.radio.some((m) => m.priority === "urgent" && m.from === "EK12" && m.textFi.includes("miehistö vaarassa"))).toBe(true);
    expect(g.state.radio.some((m) => m.priority === "urgent" && m.textFi.startsWith("MAYDAY MAYDAY MAYDAY, EK12"))).toBe(true);
    expect(g.state.phase).toBe("lost");
    expect(g.issue("EK12", { type: "move", to: world.commandPost }).ok).toBe(false);
  });

  it("pulls a crew on a task back from heat above its limit", () => {
    const at = { x: 612.5, y: 1012.5 };
    const deps = fakeDeps({ intensity: 9000 });
    const world = makeWorld();
    const g = createGame(scenario({ units: [{ id: "EK12", kind: "engine", arriveAtS: 0 }] }), world, 1, deps);
    g.issue("EK12", { type: "move", to: at });
    g.tick(900);
    g.issue("EK12", { type: "attack", target: at });
    lightBlock(deps.fires[0]!, world, 560, 960, 660, 1060);
    g.tick(600);
    const u = unit(g, "EK12");
    expect(u.harm).toBeLessThan(1);
    expect(u.status).not.toBe("out_of_action");
    expect(dist(u.pos, at)).toBeGreaterThan(100);
    expect(g.state.radio.some((m) => m.from === "EK12" && m.textFi.includes("vetäydymme"))).toBe(true);
  });
});
