/**
 * Game mode: movement — road vehicles on the road graph with the crew walking the last stretch,
 * aircraft straight, arrivals at entry nodes, plausible ETAs.
 */

import { describe, expect, it } from "vitest";
import { createGame } from "../../app/game/sim/game.js";
import { UNIT_SPECS } from "../../app/game/sim/unit-specs.js";
import { fakeDeps, makeWorld, ROAD_Y, scenario } from "./fakes.js";

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (g: ReturnType<typeof createGame>, id: string) => g.state.units.find((u) => u.id === id)!;

describe("movement", () => {
  it("drives an engine along the road with an ETA from the road speed, then stands idle", () => {
    const g = createGame(scenario({ units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }] }), makeWorld(), 1, fakeDeps());
    expect(unit(g, "EK11").pos).toEqual({ x: 100, y: ROAD_Y });
    expect(g.issue("EK11", { type: "move", to: { x: 1400, y: ROAD_Y } }).ok).toBe(true);
    g.tick(10);
    const eta = unit(g, "EK11").etaS!;
    const expected = 1300 / (UNIT_SPECS.engine.roadKmh.gravel / 3.6);
    expect(unit(g, "EK11").status).toBe("moving");
    expect(eta).toBeGreaterThan(expected * 0.9);
    expect(eta).toBeLessThan(expected * 1.1 + 10);
    g.tick(Math.ceil(eta / 10) * 10);
    const u = unit(g, "EK11");
    expect(dist(u.pos, { x: 1400, y: ROAD_Y })).toBeLessThan(1);
    expect(u.status).toBe("idle");
    expect(u.order).toBeNull();
    expect(u.etaS).toBeNull();
  });

  it("walks the crew off the road at foot speed (a plausible ETA for an off-road target)", () => {
    const g = createGame(scenario({ units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }] }), makeWorld(), 1, fakeDeps());
    g.issue("EK11", { type: "move", to: { x: 1400, y: 1000 } });
    g.tick(10);
    const eta = unit(g, "EK11").etaS!;
    const walk = 250 / (UNIT_SPECS.engine.offRoadKmh / 3.6);
    const drive = 1300 / (UNIT_SPECS.engine.roadKmh.gravel / 3.6);
    expect(eta).toBeGreaterThan(walk + drive - 20);
    expect(eta).toBeLessThan(walk + drive + 30);
    g.tick(Math.ceil(eta / 10) * 10 + 10);
    expect(dist(unit(g, "EK11").pos, { x: 1400, y: 1000 })).toBeLessThan(1);
  });

  it("flies aircraft straight at cruise speed", () => {
    const g = createGame(scenario({ units: [{ id: "DR1", kind: "drone_thermal", arriveAtS: 0 }] }), makeWorld(), 1, fakeDeps());
    const target = { x: 1100, y: 1250 };
    g.issue("DR1", { type: "move", to: target });
    const d = dist({ x: 100, y: ROAD_Y }, target);
    const t = d / (UNIT_SPECS.drone_thermal.airKmh / 3.6);
    g.tick(Math.floor(t / 10) * 10 - 10);
    expect(dist(unit(g, "DR1").pos, target)).toBeGreaterThan(0);
    g.tick(30);
    expect(dist(unit(g, "DR1").pos, target)).toBeLessThan(1);
    expect(unit(g, "DR1").energyPct).toBeLessThan(100);
  });

  it("brings reinforcements in at their entry node at their arrival time, with a radio call", () => {
    const world = makeWorld();
    const g = createGame(scenario({ units: [{ id: "EK15", kind: "engine", arriveAtS: 300, entryNode: 1 }] }), world, 1, fakeDeps());
    expect(unit(g, "EK15").status).toBe("en_route");
    expect(unit(g, "EK15").etaS).toBe(300);
    expect(unit(g, "EK15").pos).toEqual(world.roads.nodes[15]);
    g.tick(290);
    expect(unit(g, "EK15").status).toBe("en_route");
    g.tick(20);
    expect(unit(g, "EK15").status).toBe("idle");
    expect(unit(g, "EK15").etaS).toBeNull();
    const call = g.state.radio.find((m) => m.from === "EK15");
    expect(call?.textFi).toBe("EK15: saapunut alueelle, valmiina tehtävään.");
    expect(call?.textEn).toContain("on scene");
  });

  it("starts a pre-assigned order on arrival", () => {
    const g = createGame(scenario({ units: [{ id: "EK15", kind: "engine", arriveAtS: 60 }] }), makeWorld(), 1, fakeDeps());
    g.issue("EK15", { type: "move", to: { x: 500, y: ROAD_Y } });
    g.tick(200);
    expect(dist(unit(g, "EK15").pos, { x: 500, y: ROAD_Y })).toBeLessThan(1);
  });
});
