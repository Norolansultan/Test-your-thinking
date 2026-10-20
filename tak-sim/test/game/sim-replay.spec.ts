/**
 * Game mode: determinism and replay — the same scenario, seed and command log give the same game,
 * whatever the tick sizes were (contracts: "the same scenario, seed and command log replay the same game").
 */

import { describe, expect, it } from "vitest";
import type { Game, GameScenario, WeatherKey } from "../../app/game/contracts.js";
import { createGame, replay } from "../../app/game/sim/game.js";
import { fakeDeps, lightBlock, makeWorld, scenario } from "./fakes.js";

const WEATHER: readonly WeatherKey[] = [
  { atS: 0, windFromDeg: 200, windMs: 4, gustMs: 7, tempC: 25, rh: 30 },
  { atS: 1800, windFromDeg: 250, windMs: 6, gustMs: 12, tempC: 24, rh: 28 },
];

const SCENARIO: GameScenario = scenario({
  units: [
    { id: "EK11", kind: "engine", arriveAtS: 0 },
    { id: "VPK", kind: "volunteer", arriveAtS: 0 },
    { id: "EK13", kind: "tanker", arriveAtS: 0 },
    { id: "EK14", kind: "forest_unit", arriveAtS: 300, entryNode: 1 },
    { id: "DR1", kind: "drone_thermal", arriveAtS: 0 },
    { id: "HELI1", kind: "helicopter", arriveAtS: 600, entryNode: 1 },
    { id: "VD1", kind: "drone_water", arriveAtS: 0 },
  ],
  weather: WEATHER,
  powerLineLiveAtStart: true,
  ignitions: [{ x: 500, y: 1000 }],
  events: [
    { atS: 0, kind: "radio", message: { atS: 0, from: "P3", room: "command", priority: "important", textFi: "P3: aloitetaan", textEn: "P3: begin" } },
    { atS: 900, kind: "ignite", at: { x: 1100, y: 1200 } },
    { atS: 1200, kind: "power_line_dead" },
    { atS: 1500, kind: "weather_warning" },
    { atS: 2400, kind: "units_recalled", unitIds: ["VPK"] },
  ],
  objectives: [{ kind: "protect_settlement", settlementId: "Testikylä" }, { kind: "no_casualties" }],
  endAtS: 3 * 3600,
});

const deps = () => fakeDeps({ growEvery: 4, burnOutS: 600, intensity: 1800 }, (f, w) => { lightBlock(f, w, 450, 950, 600, 1050); });

function ok(r: ReturnType<Game["issue"]>): void {
  expect(r).toEqual({ ok: true });
}

/** One scripted session: uneven ticks, orders in between. */
function play(): Game {
  const g = createGame(SCENARIO, makeWorld(), 42, deps());
  ok(g.issue("DR1", { type: "recon", centre: { x: 600, y: 1050 } }));
  g.tick(15);
  ok(g.issue("EK11", { type: "attack", target: { x: 520, y: 980 } }));
  g.tick(7);
  g.tick(33);
  ok(g.issue("EK13", { type: "shuttle", waterPointId: "W1", toUnitId: "EK11" }));
  ok(g.issue("VPK", { type: "hose_line", to: { x: 700, y: 1100 } }));
  g.tick(123.5);
  ok(g.issue("EK14", { type: "fire_break", from: { x: 700, y: 1200 }, to: { x: 900, y: 1200 } }));
  ok(g.issue("VD1", { type: "drop", target: { x: 560, y: 1040 } }));
  g.tick(600);
  ok(g.issue("HELI1", { type: "drop", target: { x: 600, y: 1100 } }));
  ok(g.issue("EK11", { type: "protect", assetOrSettlementId: "kyla" }));
  for (let i = 0; i < 40; i++) g.tick(31);
  ok(g.issue("VPK", { type: "refill", waterPointId: "W1" }));
  g.tick(900);
  ok(g.issue("DR1", { type: "move", to: { x: 100, y: 750 } }));
  g.tick(1205);
  return g;
}

function snap(g: Game) {
  const s = g.state;
  return {
    tS: s.tS, clock: s.clockLabel, phase: s.phase, weather: s.weather, units: s.units, powerLineLive: s.powerLineLive,
    radio: s.radio, score: s.score,
    known: Array.from(s.known), knownAtS: Array.from(s.knownAtS),
    fire: { tS: s.fire.tS, state: Array.from(s.fire.state), intensity: Array.from(s.fire.intensity), wetness: Array.from(s.fire.wetness), ignitedAtS: Array.from(s.fire.ignitedAtS) },
    commands: g.commands,
  };
}

describe("determinism and replay", () => {
  it("plays the same session to the same state twice", () => {
    const a = play();
    const b = play();
    expect(a.state.tS).toBeGreaterThan(3000);
    expect(snap(b)).toEqual(snap(a));
  });

  it("reproduces the state from the command log alone", () => {
    const a = play();
    expect(a.commands.length).toBe(10);
    const r = replay(SCENARIO, makeWorld(), 42, deps(), a.commands, a.state.tS);
    expect(snap(r)).toEqual(snap(a));
  });

  it("replays a prefix of the log to an earlier moment", () => {
    const a = createGame(SCENARIO, makeWorld(), 42, deps());
    a.issue("EK11", { type: "attack", target: { x: 520, y: 980 } });
    a.tick(250);
    a.issue("DR1", { type: "recon", centre: { x: 600, y: 1050 } });
    a.tick(250);
    const mid = snap(a);
    const r = replay(SCENARIO, makeWorld(), 42, deps(), a.commands, 500);
    expect(snap(r)).toEqual(mid);
    a.tick(500);
    const later = replay(SCENARIO, makeWorld(), 42, deps(), a.commands, 1000);
    expect(snap(later)).toEqual(snap(a));
  });

  it("exercises the session (water used, units recalled, radio in both languages)", () => {
    const a = play();
    const s = a.state;
    expect(s.powerLineLive).toBe(false);
    expect(s.units.find((u) => u.id === "VPK")!.status).toBe("out_of_action");
    expect(s.radio.some((m) => m.from === "SÄÄ" && m.textFi.includes("varoitus"))).toBe(true);
    expect(s.radio.some((m) => m.from === "P3" && m.textFi.includes("20 kV"))).toBe(true);
    expect(s.units.find((u) => u.id === "EK13")!.waterL).toBeLessThan(14000);
    expect(a.scenario.objectives[0]).toEqual({ kind: "protect_settlement", settlementId: "kyla" });
  });
});
