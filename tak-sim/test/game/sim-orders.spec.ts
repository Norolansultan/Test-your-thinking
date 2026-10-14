/**
 * Game mode: order validation (`Game.issue`) — reasons in Finnish and English, the live 110 kV line,
 * and the command log for replay.
 */

import { describe, expect, it } from "vitest";
import { createGame } from "../../app/game/sim/game.js";
import { POWER_LINE_REASON } from "../../app/game/sim/validate.js";
import { fakeDeps, makeWorld, POWER_X, scenario } from "./fakes.js";

const UNITS = [
  { id: "EK11", kind: "engine", arriveAtS: 0 },
  { id: "EK13", kind: "tanker", arriveAtS: 0 },
  { id: "EK14", kind: "forest_unit", arriveAtS: 0 },
  { id: "DR1", kind: "drone_thermal", arriveAtS: 0 },
  { id: "HELI1", kind: "helicopter", arriveAtS: 0 },
  { id: "EK15", kind: "engine", arriveAtS: 600 },
] as const;

function game(powerLineLiveAtStart = true) {
  return createGame(scenario({ units: UNITS, powerLineLiveAtStart }), makeWorld(), 1, fakeDeps());
}

function refused(r: ReturnType<ReturnType<typeof game>["issue"]>): { fi: string; en: string } {
  expect(r.ok).toBe(false);
  if (r.ok) throw new Error("accepted");
  expect(r.reasonFi.length).toBeGreaterThan(0);
  expect(r.reasonEn.length).toBeGreaterThan(0);
  return { fi: r.reasonFi, en: r.reasonEn };
}

describe("issue: validation", () => {
  it("refuses an unknown unit", () => {
    const r = refused(game().issue("XX9", { type: "hold" }));
    expect(r.fi).toContain("XX9");
    expect(r.en).toContain("XX9");
  });

  it("refuses what the unit's kind cannot do: engines cut no fire break, drones attack nothing", () => {
    const g = game();
    const a = refused(g.issue("EK11", { type: "fire_break", from: { x: 500, y: 1000 }, to: { x: 600, y: 1000 } }));
    expect(a.fi).toContain("palokatko");
    expect(a.en).toContain("fire break");
    refused(g.issue("DR1", { type: "attack", target: { x: 500, y: 1000 } }));
    refused(g.issue("EK13", { type: "attack", target: { x: 500, y: 1000 } }));
    refused(g.issue("EK11", { type: "recon", centre: { x: 500, y: 1000 } }));
    refused(g.issue("EK11", { type: "drop", target: { x: 500, y: 1000 } }));
    refused(g.issue("HELI1", { type: "hose_line", to: { x: 500, y: 1000 } }));
    expect(g.issue("EK14", { type: "fire_break", from: { x: 500, y: 1000 }, to: { x: 600, y: 1000 } }).ok).toBe(true);
    expect(g.issue("DR1", { type: "recon", centre: { x: 500, y: 1000 } }).ok).toBe(true);
  });

  it("refuses targets off the map", () => {
    const g = game();
    const r = refused(g.issue("EK11", { type: "move", to: { x: -10, y: 500 } }));
    expect(r.en).toContain("outside the map");
    refused(g.issue("DR1", { type: "recon", centre: { x: 500, y: 99999 } }));
    refused(g.issue("EK14", { type: "fire_break", from: { x: 500, y: 1000 }, to: { x: Number.NaN, y: 1000 } }));
  });

  it("checks water points, shuttle targets, protect targets and break lengths", () => {
    const g = game();
    refused(g.issue("EK11", { type: "refill", waterPointId: "W9" }));
    expect(g.issue("EK11", { type: "refill", waterPointId: "W1" }).ok).toBe(true);
    refused(g.issue("EK13", { type: "shuttle", waterPointId: "W1", toUnitId: "EK13" }));
    refused(g.issue("EK13", { type: "shuttle", waterPointId: "W1", toUnitId: "DR1" }));
    refused(g.issue("EK13", { type: "shuttle", waterPointId: "W1", toUnitId: "NOPE" }));
    expect(g.issue("EK13", { type: "shuttle", waterPointId: "W1", toUnitId: "EK11" }).ok).toBe(true);
    refused(g.issue("EK11", { type: "protect", assetOrSettlementId: "atlantis" }));
    refused(g.issue("EK14", { type: "fire_break", from: { x: 500, y: 1000 }, to: { x: 505, y: 1000 } }));
  });

  it("resolves a settlement by its name and logs the resolved id", () => {
    const g = game();
    expect(g.issue("EK11", { type: "protect", assetOrSettlementId: "Testikylä" }).ok).toBe(true);
    expect(g.commands.at(-1)?.order).toEqual({ type: "protect", assetOrSettlementId: "kyla" });
    expect(g.issue("EK11", { type: "protect", assetOrSettlementId: "h2" }).ok).toBe(true);
  });

  it("refuses water within 30 m of the live 110 kV line, and allows it once the line is dead", () => {
    const live = game(true);
    const r = refused(live.issue("EK11", { type: "attack", target: { x: POWER_X + 20, y: 1000 } }));
    expect(r.fi).toBe(`${POWER_LINE_REASON.fi}.`);
    expect(r.en).toBe(`${POWER_LINE_REASON.en}.`);
    expect(r.fi).toContain("Voimajohto on jännitteinen — vettä ei saa käyttää 30 m sisällä");
    refused(live.issue("HELI1", { type: "drop", target: { x: POWER_X - 10, y: 400 } }));
    refused(live.issue("EK11", { type: "hose_line", to: { x: POWER_X + 200, y: 750 } }));
    expect(live.issue("EK11", { type: "attack", target: { x: POWER_X + 40, y: 1000 } }).ok).toBe(true);
    expect(live.issue("EK11", { type: "move", to: { x: POWER_X, y: 1000 } }).ok).toBe(true);
    const dead = game(false);
    expect(dead.issue("EK11", { type: "attack", target: { x: POWER_X + 20, y: 1000 } }).ok).toBe(true);
  });

  it("accepts orders for units still en route and logs every accepted command with its time", () => {
    const g = game();
    expect(g.issue("EK15", { type: "move", to: { x: 800, y: 750 } }).ok).toBe(true);
    g.tick(120);
    expect(g.issue("EK11", { type: "hold" }).ok).toBe(true);
    expect(g.issue("EK11", { type: "fire_break", from: { x: 1, y: 1 }, to: { x: 100, y: 1 } }).ok).toBe(false);
    expect(g.commands.map((c) => [c.atS, c.unitId, c.order.type])).toEqual([[0, "EK15", "move"], [120, "EK11", "hold"]]);
  });

  it("refuses everything once the game is over", () => {
    const g = createGame(scenario({ units: UNITS, endAtS: 60 }), makeWorld(), 1, fakeDeps());
    g.tick(120);
    expect(g.state.phase === "won" || g.state.phase === "ended").toBe(true);
    const r = refused(g.issue("EK11", { type: "hold" }));
    expect(r.en).toContain("over");
  });
});
