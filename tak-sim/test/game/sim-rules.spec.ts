/**
 * Game mode: the win, loss and grade rules (balance review, 14 Oct 2026) — an early win only once
 * nothing burns or smoulders for 15 minutes and no scripted ignition is still to come, `contain`
 * decided at its deadline without ending the game, `limit_area` lost only 20 % beyond its limit, the
 * grade caps (an unmet objective → C, a lost game or a player who never fought the fire → D), the
 * still-burning penalty, the pre-burn with the first report as the player's picture, mop-up, and a
 * scripted rekindle on ground that already burned.
 */

import { describe, expect, it } from "vitest";
import { CELL, FIRST_REPORT_M, type Objective } from "../../app/game/contracts.js";
import { UNKNOWN } from "../../app/game/sim/fog.js";
import { createGame } from "../../app/game/sim/game.js";
import { REKINDLE_SEARCH_M } from "../../app/game/sim/events.js";
import { AREA_LOSS_MARGIN, failedForGood, gradeFor, objectiveWhy, OUT_CONFIRM_S, pointsFor, S_POINTS, STILL_BURNING_PENALTY, updateObjectives, type ObjectiveStatus } from "../../app/game/sim/score.js";
import { UNIT_SPECS } from "../../app/game/sim/unit-specs.js";
import { cellCentre, cellOf, fakeDeps, lightBlock, makeWorld, scenario } from "./fakes.js";

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const EK11 = [{ id: "EK11", kind: "engine", arriveAtS: 0 }] as const;
const SAFE: readonly Objective[] = [{ kind: "no_casualties" }];

describe("winning early", () => {
  it("waits until nothing has burned or smouldered for 15 minutes", () => {
    const deps = fakeDeps({ burnOutS: 300, smoulderS: 1800 }, (f, w) => { lightBlock(f, w, 640, 880, 720, 940); });
    const g = createGame(scenario({ units: EK11, objectives: SAFE }), makeWorld(), 1, deps);
    g.tick(1200);
    // the flames went out at 300 s, but the ground still smoulders
    expect(g.state.score.containedAtS).toBe(300);
    expect(g.state.phase).toBe("running");
    g.tick(2900 - 1200);
    expect(g.state.phase).toBe("running"); // out since 2100 s: not yet 15 minutes
    g.tick(300);
    expect(g.state.phase).toBe("won");
    expect(g.state.tS).toBe(2100 + OUT_CONFIRM_S);
    // nobody fought this fire: it went out by itself, and the grade says so
    expect(g.state.score.points).toBeGreaterThanOrEqual(S_POINTS);
    expect(g.state.score.grade).toBe("D");
  });

  it("is earned by mopping up: a crew on the edge drowns the smouldering ground once the flames are out", () => {
    let block: number[] = [];
    const deps = fakeDeps({ burnOutS: 60, smoulderS: 7200, mopUpL: 100 }, (f, w) => { block = lightBlock(f, w, 640, 880, 720, 940); });
    const g = createGame(scenario({ units: EK11, objectives: SAFE }), makeWorld(), 1, deps);
    const fire = deps.fires[0]!;
    g.issue("EK11", { type: "attack", target: { x: 680, y: 910 } });
    g.tick(120);
    expect(block.every((c) => fire.state[c] === CELL.smouldering)).toBe(true);
    g.tick(3600);
    expect(block.every((c) => fire.state[c] === CELL.extinguished)).toBe(true);
    expect(g.state.phase).toBe("won");
    expect(g.state.tS).toBeLessThan(7200);
    expect(g.state.score.grade).toBe("S");
  });

  it("does not come while a scripted ignition is still to come; a new fire resets the containment time", () => {
    const deps = fakeDeps({ burnOutS: 60 }, (f, w) => { lightBlock(f, w, 640, 880, 720, 940); });
    const later = { atS: 3000, kind: "ignite" as const, at: { x: 300, y: 300 } };
    const g = createGame(scenario({ units: EK11, objectives: SAFE, events: [later] }), makeWorld(), 1, deps);
    g.tick(2950);
    expect(g.state.score.containedAtS).toBe(60);
    expect(g.state.phase).toBe("running");
    g.tick(60);
    expect(g.state.score.containedAtS).toBeNull();
    g.tick(3600);
    expect(g.state.phase).toBe("won");
    expect(g.state.score.containedAtS).toBeGreaterThan(3000);
    expect(g.state.tS).toBeGreaterThanOrEqual(3000 + OUT_CONFIRM_S);
  });
});

describe("a scripted ignition on ground that already burned", () => {
  it("flares up at the nearest unburned fuel (the old edge)", () => {
    let block: number[] = [];
    const deps = fakeDeps({ burnOutS: 60 }, (f, w) => { block = lightBlock(f, w, 640, 880, 720, 940); });
    const world = makeWorld();
    const at = { x: 687.5, y: 912.5 };
    const g = createGame(scenario({ units: EK11, objectives: SAFE, events: [{ atS: 600, kind: "ignite", at }] }), world, 1, deps);
    const fire = deps.fires[0]!;
    g.tick(620);
    const own = cellOf(world.grid, at)!;
    expect(block).toContain(own);
    expect(fire.state[own]).toBe(CELL.burnedOut);
    const lit = [...fire.state.keys()].filter((c) => fire.state[c] === CELL.burning);
    expect(lit.length).toBe(1);
    const d = dist(cellCentre(world.grid, lit[0]!), at);
    expect(d).toBeLessThanOrEqual(REKINDLE_SEARCH_M);
    // no unburned cell lies nearer the scripted point
    for (let c = 0; c < fire.state.length; c++) {
      if (fire.state[c] === CELL.unburned) expect(dist(cellCentre(world.grid, c), at)).toBeGreaterThanOrEqual(d);
    }
  });
});

describe("contain and limit_area", () => {
  it("contain is decided at its deadline and does not end the game; still burning at the end costs points and caps the grade", () => {
    const deps = fakeDeps({}, (f, w) => { lightBlock(f, w, 640, 880, 720, 940); });
    const g = createGame(scenario({ units: EK11, objectives: [{ kind: "contain", byS: 600 }, { kind: "no_casualties" }], endAtS: 1800 }), makeWorld(), 1, deps);
    g.tick(700);
    expect(g.state.score.objectives[0]!.met).toBe(false);
    expect(g.state.phase).toBe("running");
    g.tick(1200);
    expect(g.state.phase).toBe("ended");
    const s = g.state.score;
    expect(s.points).toBe(pointsFor({ burnedHa: s.burnedHa, lostAssetValue: 0, casualties: 0, settlementsLost: 0, containedAtS: null, containedNow: false, endAtS: 1800, objectivesMet: 1, burningAtEnd: true }));
    expect(s.points).toBe(1000 - Math.round(2 * s.burnedHa) + 50 - STILL_BURNING_PENALTY);
    expect(["C", "D", "F"]).toContain(s.grade);
  });

  it("contain is met when no flames are left at the deadline, even while the ground smoulders", () => {
    const deps = fakeDeps({ burnOutS: 60, smoulderS: 7200 }, (f, w) => { lightBlock(f, w, 640, 880, 720, 940); });
    const g = createGame(scenario({ units: EK11, objectives: [{ kind: "contain", byS: 600 }], endAtS: 1800 }), makeWorld(), 1, deps);
    g.tick(610);
    expect(g.state.score.objectives[0]!.met).toBe(true);
    expect(g.state.phase).toBe("running");
    g.tick(1200);
    expect(g.state.phase).toBe("won");
  });

  it("limit_area over its limit is unmet but plays on; beyond the 20 % margin the game is lost", () => {
    // 18 cells = 1.125 ha against a 1 ha limit: unmet, the game goes on
    const over = fakeDeps({}, (f, w) => { lightBlock(f, w, 630, 880, 690, 1030); });
    const g1 = createGame(scenario({ units: EK11, objectives: [{ kind: "limit_area", maxHa: 1 }] }), makeWorld(), 1, over);
    g1.tick(600);
    expect(g1.state.score.burnedHa).toBeGreaterThan(1);
    expect(g1.state.score.burnedHa).toBeLessThanOrEqual(1 + AREA_LOSS_MARGIN);
    expect(g1.state.score.objectives[0]!.met).toBe(false);
    expect(g1.state.phase).toBe("running");
    expect(["C", "D", "F"]).toContain(g1.state.score.grade);
    // 20 cells = 1.25 ha: more than 1.2 ha, lost
    const far = fakeDeps({}, (f, w) => { lightBlock(f, w, 630, 880, 715, 1005); });
    const g2 = createGame(scenario({ units: EK11, objectives: [{ kind: "limit_area", maxHa: 1 }] }), makeWorld(), 1, far);
    g2.tick(20);
    expect(g2.state.score.burnedHa).toBeGreaterThan(1 + AREA_LOSS_MARGIN);
    expect(g2.state.phase).toBe("lost");
    expect(g2.state.radio.some((m) => m.textEn.includes("burned area over 1 ha"))).toBe(true);
  });

  it("decides the objectives by rule", () => {
    const list: ObjectiveStatus[] = [{ objective: { kind: "limit_area", maxHa: 10 }, met: null }, { objective: { kind: "contain", byS: 600 }, met: null }];
    const facts = { tS: 700, burnedHa: 11, casualties: 0, settlementsLost: [] as string[], containedNow: false };
    updateObjectives(list, facts, false);
    expect(list.map((o) => o.met)).toEqual([false, false]);
    expect(failedForGood(list, facts)).toBeUndefined();
    expect(failedForGood(list, { burnedHa: 10 * (1 + AREA_LOSS_MARGIN) })).toBeUndefined();
    expect(failedForGood(list, { burnedHa: 12.01 })?.objective.kind).toBe("limit_area");
    expect(objectiveWhy({ kind: "limit_area", maxHa: 150 }, () => ({ fi: "", en: "" })).en).toBe("burned area over 180 ha");
  });
});

describe("grade", () => {
  const g = { allObjectivesMet: true, casualties: 0, assetsLost: 0, phase: "won" as const, fought: true };

  it("caps an unmet objective at C, and a lost game or a player who never fought the fire at D", () => {
    expect(gradeFor({ ...g, points: 1300 })).toBe("S");
    expect(gradeFor({ ...g, points: 1300, phase: "ended", allObjectivesMet: false })).toBe("C");
    expect(gradeFor({ ...g, points: 1300, phase: "running", allObjectivesMet: false, anyObjectiveUnmet: true })).toBe("C");
    expect(gradeFor({ ...g, points: 500, phase: "ended", allObjectivesMet: false })).toBe("D");
    expect(gradeFor({ ...g, points: 1300, fought: false })).toBe("D");
    expect(gradeFor({ ...g, points: 300, fought: false })).toBe("F");
    expect(gradeFor({ ...g, points: 1300, phase: "lost", allObjectivesMet: false })).toBe("D");
  });

  it("gives S only for a won game with every objective, no loss and the points of an early containment", () => {
    expect(gradeFor({ ...g, points: S_POINTS })).toBe("S");
    expect(gradeFor({ ...g, points: S_POINTS - 1 })).toBe("A");
    expect(gradeFor({ ...g, points: 1300, phase: "running" })).toBe("A");
    expect(gradeFor({ ...g, points: 1300, assetsLost: 1 })).toBe("A");
    expect(gradeFor({ ...g, points: 1300, casualties: 1 })).toBe("A");
    // all three objectives met, contained at half time: 1000 + 150 + 150 − 2/ha → an S only under 50 ha
    const base = { lostAssetValue: 0, casualties: 0, settlementsLost: 0, containedAtS: 14400, containedNow: true, endAtS: 28800, objectivesMet: 3 };
    expect(pointsFor({ ...base, burnedHa: 49 })).toBeGreaterThanOrEqual(S_POINTS);
    expect(pointsFor({ ...base, burnedHa: 51 })).toBeLessThan(S_POINTS);
    expect(pointsFor({ ...base, burnedHa: 10, containedNow: false, containedAtS: null, burningAtEnd: true })).toBe(1000 - 20 + 150 - STILL_BURNING_PENALTY);
  });
});

describe("pre-burn and the first report", () => {
  it("lets the fire burn before tS 0 and shows the player only the first report round the ignition", () => {
    const ign = { x: 400, y: 400 };
    const deps = fakeDeps({ growEvery: 6, growFromS: -Infinity });
    const world = makeWorld();
    const g = createGame(scenario({ units: EK11, ignitions: [ign], preBurnS: 1200 }), world, 1, deps);
    const fire = deps.fires[0]!;
    const s = g.state;
    expect(s.tS).toBe(0);
    expect(fire.tS).toBe(0); // the fire's clock ran from −1200 s
    const ignCell = cellOf(world.grid, ign)!;
    expect(fire.ignitedAtS[ignCell]).toBe(-1200);
    const burning = [...fire.state.keys()].filter((c) => fire.state[c] === CELL.burning);
    expect(burning.length).toBeGreaterThan(10);
    expect(s.score.burnedHa).toBeGreaterThan(0.5);
    // known: within the first report, or seen by EK11 at the command post
    let unknownBurning = 0;
    for (let c = 0; c < s.known.length; c++) {
      const p = cellCentre(world.grid, c);
      if (s.known[c] !== UNKNOWN) {
        expect(dist(p, ign) <= FIRST_REPORT_M + 1 || dist(p, world.commandPost) <= UNIT_SPECS.engine.sensorM + 1).toBe(true);
        expect(s.knownAtS[c]).toBe(0);
      } else if (fire.state[c] === CELL.burning) {
        unknownBurning++;
      }
    }
    expect(s.known[ignCell]).not.toBe(UNKNOWN);
    expect(unknownBurning).toBeGreaterThan(0);
  });
});
