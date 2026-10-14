/**
 * Game mode: the radio log stays readable (throttling), the traffic reads like the fire ground, and the
 * score, objectives and grade follow their formula.
 */

import { describe, expect, it } from "vitest";
import type { WeatherKey } from "../../app/game/contracts.js";
import { createGame } from "../../app/game/sim/game.js";
import { RadioLog, ROUTINE_GAP_S, type Say } from "../../app/game/sim/radio.js";
import { CONTAIN_BONUS, gradeFor, pointsFor, updateObjectives, type ObjectiveStatus } from "../../app/game/sim/score.js";
import { fakeDeps, lightBlock, makeWorld, scenario } from "./fakes.js";

const m = (from: string, key: string, priority: Say["priority"], force = false): Say => ({
  from, room: "ground", key, priority, text: { fi: `${from}: ${key}`, en: `${from}: ${key}` }, ...(force ? { force } : {}),
});

describe("radio throttling", () => {
  it("lets a unit's routine traffic through once per five minutes", () => {
    const r = new RadioLog();
    expect(r.say(0, m("EK11", "sitrep", "routine"))).toBe(true);
    expect(r.say(60, m("EK11", "sitrep", "routine"))).toBe(false);
    expect(r.say(120, m("EK11", "other", "routine"))).toBe(false);
    expect(r.say(120, m("EK12", "sitrep", "routine"))).toBe(true);
    expect(r.say(ROUTINE_GAP_S, m("EK11", "sitrep", "routine"))).toBe(true);
    expect(r.messages.map((x) => [x.atS, x.from])).toEqual([[0, "EK11"], [120, "EK12"], [300, "EK11"]]);
  });

  it("does not repeat an important message within five minutes, but lets a different one through", () => {
    const r = new RadioLog();
    expect(r.say(0, m("EK11", "tank_empty", "important"))).toBe(true);
    expect(r.say(30, m("EK11", "tank_empty", "important"))).toBe(false);
    expect(r.say(30, m("EK11", "too_hot", "important"))).toBe(true);
    expect(r.say(40, m("EK11", "sitrep", "routine"))).toBe(false);
    expect(r.say(300, m("EK11", "tank_empty", "important"))).toBe(true);
  });

  it("lets urgent calls cut through (repeated at most once a minute) and never throttles forced traffic", () => {
    const r = new RadioLog();
    r.say(0, m("EK11", "sitrep", "routine"));
    expect(r.say(10, m("EK11", "heat", "urgent"))).toBe(true);
    expect(r.say(20, m("EK11", "heat", "urgent"))).toBe(false);
    expect(r.say(70, m("EK11", "heat", "urgent"))).toBe(true);
    expect(r.say(71, m("P3", "x", "routine", true))).toBe(true);
    expect(r.say(72, m("P3", "x", "routine", true))).toBe(true);
    expect(r.messages[1]!.priority).toBe("urgent");
  });

  it("keeps each unit to about one routine message per five game minutes in play, in both languages", () => {
    const deps = fakeDeps({ growEvery: 6, burnOutS: 900 }, (f, w) => { lightBlock(f, w, 500, 900, 900, 1100); });
    const units = [
      { id: "EK11", kind: "engine", arriveAtS: 0 }, { id: "EK12", kind: "engine", arriveAtS: 0 }, { id: "VPK", kind: "volunteer", arriveAtS: 0 },
      { id: "DR1", kind: "drone_thermal", arriveAtS: 0 }, { id: "EK14", kind: "forest_unit", arriveAtS: 0 },
    ] as const;
    const g = createGame(scenario({ units }), makeWorld(), 3, deps);
    g.issue("EK11", { type: "attack", target: { x: 600, y: 900 } });
    g.issue("EK12", { type: "attack", target: { x: 800, y: 900 } });
    g.issue("VPK", { type: "attack", target: { x: 500, y: 1000 } });
    g.issue("DR1", { type: "recon", centre: { x: 700, y: 1000 } });
    g.issue("EK14", { type: "fire_break", from: { x: 400, y: 1250 }, to: { x: 1000, y: 1250 } });
    g.tick(3600);
    const radio = g.state.radio;
    for (const id of ["EK11", "EK12", "VPK", "DR1", "EK14"]) {
      const routine = radio.filter((x) => x.from === id && x.priority === "routine");
      for (let i = 1; i < routine.length; i++) expect(routine[i]!.atS - routine[i - 1]!.atS).toBeGreaterThanOrEqual(ROUTINE_GAP_S);
    }
    const wx = radio.filter((x) => x.from === "SÄÄ").map((x) => x.atS);
    expect(wx.slice(0, 3)).toEqual([0, 1200, 2400]);
    for (let i = 1; i < wx.length; i++) expect(wx[i]! - wx[i - 1]!).toBe(1200);
    expect(radio.length).toBeLessThan(90);
    for (const x of radio) {
      expect(x.textFi.length).toBeGreaterThan(0);
      expect(x.textEn.length).toBeGreaterThan(0);
    }
    const sitrep = radio.find((x) => x.from !== "SÄÄ" && /etenee .* noin \d+(,\d)? m\/min, liekit \d+(,\d)? m\./.test(x.textFi));
    expect(sitrep).toBeDefined();
    expect(sitrep!.textEn).toMatch(/at about \d+(\.\d)? m\/min, flames \d+(\.\d)? m\./);
    expect(radio.some((x) => x.from === "DR1" && x.textFi.includes("lämpökamera"))).toBe(true);
  });
});

describe("score", () => {
  it("adds and subtracts by the formula", () => {
    const base = { burnedHa: 0, lostAssetValue: 0, casualties: 0, settlementsLost: 0, containedAtS: null, containedNow: false, endAtS: 28800, objectivesMet: 0 };
    expect(pointsFor(base)).toBe(1000);
    expect(pointsFor({ ...base, burnedHa: 50 })).toBe(900);
    expect(pointsFor({ ...base, burnedHa: 10, lostAssetValue: 120, casualties: 1, settlementsLost: 1 })).toBe(1000 - 20 - 120 - 300 - 200);
    expect(pointsFor({ ...base, containedAtS: 14400, containedNow: true })).toBe(1000 + CONTAIN_BONUS / 2);
    expect(pointsFor({ ...base, containedAtS: 14400, containedNow: false })).toBe(1000);
    expect(pointsFor({ ...base, objectivesMet: 3 })).toBe(1150);
    expect(pointsFor({ ...base, burnedHa: 900 })).toBe(0);
  });

  it("grades S to F, with S only for a clean sweep and a lost game at best D", () => {
    const g = { allObjectivesMet: true, casualties: 0, assetsLost: 0, phase: "won" as const };
    expect(gradeFor({ ...g, points: 1200 })).toBe("S");
    expect(gradeFor({ ...g, points: 1200, assetsLost: 1 })).toBe("A");
    expect(gradeFor({ ...g, points: 1200, allObjectivesMet: false })).toBe("A");
    expect(gradeFor({ ...g, points: 960 })).toBe("A");
    expect(gradeFor({ ...g, points: 800 })).toBe("B");
    expect(gradeFor({ ...g, points: 650 })).toBe("C");
    expect(gradeFor({ ...g, points: 400 })).toBe("D");
    expect(gradeFor({ ...g, points: 399 })).toBe("F");
    expect(gradeFor({ ...g, points: 1000, phase: "lost" })).toBe("D");
    expect(gradeFor({ ...g, points: 100, phase: "lost" })).toBe("F");
  });

  it("decides objectives when they fail for good, and the rest at the end", () => {
    const list: ObjectiveStatus[] = [
      { objective: { kind: "protect_settlement", settlementId: "kyla" }, met: null },
      { objective: { kind: "contain", byS: 3600 }, met: null },
      { objective: { kind: "limit_area", maxHa: 10 }, met: null },
      { objective: { kind: "no_casualties" }, met: null },
    ];
    const facts = { tS: 600, burnedHa: 5, casualties: 0, settlementsLost: [] as string[], containedNow: false };
    updateObjectives(list, facts, false);
    expect(list.map((o) => o.met)).toEqual([null, null, null, null]);
    updateObjectives(list, { ...facts, tS: 3600, burnedHa: 12 }, false);
    expect(list.map((o) => o.met)).toEqual([null, false, false, null]);
    updateObjectives(list, { ...facts, tS: 7200, burnedHa: 12 }, true);
    expect(list.map((o) => o.met)).toEqual([true, false, false, true]);
  });

  it("wins a game when the fire is contained with every objective met, and grades it", () => {
    const deps = fakeDeps({}, (f, w) => { lightBlock(f, w, 640, 880, 720, 940); });
    const objectives = [{ kind: "contain", byS: 7200 }, { kind: "no_casualties" }, { kind: "limit_area", maxHa: 5 }] as const;
    const g = createGame(scenario({ units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }], objectives, endAtS: 7200 }), makeWorld(), 1, deps);
    expect(g.state.phase).toBe("briefing");
    g.issue("EK11", { type: "attack", target: { x: 680, y: 900 } });
    g.tick(10);
    expect(g.state.phase).toBe("running");
    g.tick(3600);
    const s = g.state.score;
    expect(g.state.phase).toBe("won");
    expect(s.containedAtS).not.toBeNull();
    expect(s.objectives.every((o) => o.met === true)).toBe(true);
    expect(s.burnedHa).toBeCloseTo((9 * 625) / 10000, 2);
    expect(s.points).toBe(pointsFor({ burnedHa: s.burnedHa, lostAssetValue: 0, casualties: 0, settlementsLost: 0, containedAtS: s.containedAtS, containedNow: true, endAtS: 7200, objectivesMet: 3 }));
    expect(s.grade).toBe("S");
    const t = g.state.tS;
    g.tick(600);
    expect(g.state.tS).toBe(t);
    expect(g.state.radio.some((x) => x.from === "P3" && x.textEn.includes("objectives are met"))).toBe(true);
  });

  it("ends the game at the end time with unmet objectives", () => {
    const weather: readonly WeatherKey[] = [{ atS: 0, windFromDeg: 180, windMs: 3, gustMs: 5, tempC: 20, rh: 40 }];
    const deps = fakeDeps({ growEvery: 3 }, (f, w) => { lightBlock(f, w, 600, 200, 700, 260); });
    const g = createGame(scenario({ units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }], weather, objectives: [{ kind: "contain", byS: 1200 }], endAtS: 1200 }), makeWorld(), 1, deps);
    g.tick(1300);
    expect(g.state.phase).toBe("ended");
    expect(g.state.tS).toBe(1200);
    expect(g.state.clockLabel).toBe("12:20");
    expect(g.state.score.objectives[0]!.met).toBe(false);
  });
});
