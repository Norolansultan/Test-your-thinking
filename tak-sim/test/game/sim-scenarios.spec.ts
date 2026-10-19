/**
 * Game mode: the three scenarios as data — times in order, units unique, objectives valid, both
 * languages present — and their settlement names resolved against a world (by name, else the
 * settlement nearest the fire). Each plays on a world it was not written for without failing.
 */

import { describe, expect, it } from "vitest";
import type { GameWorld } from "../../app/game/contracts.js";
import { EVENING_WIND, GAME_SCENARIOS, gameScenario, SUMMER_AFTERNOON, TRAINING } from "../../app/game/scenarios/index.js";
import { at, PLACES } from "../../app/game/scenarios/places.js";
import { createGame } from "../../app/game/sim/game.js";
import { findSettlement, resolveScenario } from "../../app/game/sim/resolve.js";
import { UNIT_SPECS } from "../../app/game/sim/unit-specs.js";
import { fakeDeps, makeWorld } from "./fakes.js";

const MAP_M = 400 * 25; // the real fuel grid: 400 × 400 cells of 25 m

describe.each(GAME_SCENARIOS.map((s) => [s.id, s] as const))("scenario %s", (_id, s) => {
  it("has titles and briefings in both languages", () => {
    for (const t of [s.titleFi, s.titleEn, s.briefingFi, s.briefingEn]) expect(t.trim().length).toBeGreaterThan(0);
    expect(s.briefingFi).not.toBe(s.briefingEn);
    expect(s.startClockMin).toBeGreaterThanOrEqual(0);
    expect(s.startClockMin).toBeLessThan(1440);
    expect(s.endAtS).toBeGreaterThan(0);
  });

  it("has weather keys from the start, strictly in time order, covering the game", () => {
    expect(s.weather[0]!.atS).toBe(0);
    for (let i = 1; i < s.weather.length; i++) expect(s.weather[i]!.atS).toBeGreaterThan(s.weather[i - 1]!.atS);
    expect(s.weather.at(-1)!.atS).toBeGreaterThanOrEqual(s.endAtS);
    for (const w of s.weather) {
      expect(w.windFromDeg).toBeGreaterThanOrEqual(0);
      expect(w.windFromDeg).toBeLessThan(360);
      expect(w.gustMs).toBeGreaterThanOrEqual(w.windMs);
      expect(w.rh).toBeGreaterThan(0);
      expect(w.rh).toBeLessThanOrEqual(100);
    }
  });

  it("has events in time order inside the game, with well-formed messages", () => {
    for (let i = 1; i < s.events.length; i++) expect(s.events[i]!.atS).toBeGreaterThanOrEqual(s.events[i - 1]!.atS);
    const ids = new Set(s.units.map((u) => u.id));
    for (const e of s.events) {
      expect(e.atS).toBeGreaterThanOrEqual(0);
      expect(e.atS).toBeLessThan(s.endAtS);
      if (e.kind === "ignite") expect(e.at).toBeDefined();
      if (e.kind === "radio") expect(e.message).toBeDefined();
      if (e.kind === "units_recalled") {
        expect(e.unitIds!.length).toBeGreaterThan(0);
        for (const id of e.unitIds!) {
          expect(ids.has(id)).toBe(true);
          expect(s.units.find((u) => u.id === id)!.arriveAtS).toBeLessThan(e.atS);
        }
      }
      if (e.message !== undefined) {
        expect(e.message.atS).toBe(e.atS);
        expect(e.message.textFi.trim().length).toBeGreaterThan(0);
        expect(e.message.textEn.trim().length).toBeGreaterThan(0);
      }
      if (e.at !== undefined) {
        expect(e.at.x).toBeGreaterThanOrEqual(0);
        expect(e.at.x).toBeLessThanOrEqual(MAP_M);
      }
    }
  });

  it("has unique units of known kinds arriving inside the game", () => {
    const ids = s.units.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const u of s.units) {
      expect(UNIT_SPECS[u.kind]).toBeDefined();
      expect(u.arriveAtS).toBeGreaterThanOrEqual(0);
      expect(u.arriveAtS).toBeLessThan(s.endAtS);
    }
    // Someone is on scene at the start: a crew and eyes (a drone or a second crew).
    expect(s.units.filter((u) => u.arriveAtS === 0).length).toBeGreaterThanOrEqual(2);
    expect(s.units.some((u) => u.arriveAtS === 0 && !UNIT_SPECS[u.kind].air)).toBe(true);
  });

  it("has ignitions on the real map and valid objectives", () => {
    expect(s.ignitions.length).toBeGreaterThan(0);
    for (const p of s.ignitions) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(MAP_M);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(MAP_M);
    }
    expect(s.objectives.length).toBeGreaterThan(0);
    expect(s.objectives.some((o) => o.kind === "no_casualties")).toBe(true);
    for (const o of s.objectives) {
      if (o.kind === "contain") {
        expect(o.byS).toBeGreaterThan(0);
        expect(o.byS).toBeLessThanOrEqual(s.endAtS);
      }
      if (o.kind === "limit_area") expect(o.maxHa).toBeGreaterThan(0);
      if (o.kind === "protect_settlement") expect(o.settlementId.length).toBeGreaterThan(0);
    }
  });

  it("plays its first hour on a world it was not written for", () => {
    const g = createGame(s, makeWorld(), 7, fakeDeps({ growEvery: 6 }));
    expect(g.state.phase).toBe("briefing");
    g.tick(3600);
    expect(["running", "won", "ended"]).toContain(g.state.phase);
    expect(g.state.units.length).toBe(s.units.length);
    for (const o of g.scenario.objectives) if (o.kind === "protect_settlement") expect(o.settlementId).toBe("kyla");
  });
});

describe("the scenarios", () => {
  it("are one easy, one normal and one hard, found by id", () => {
    expect(GAME_SCENARIOS.map((s) => s.difficulty)).toEqual(["easy", "normal", "hard"]);
    expect(gameScenario("summer-afternoon")).toBe(SUMMER_AFTERNOON);
    expect(gameScenario("nope")).toBeUndefined();
    expect(new Set(GAME_SCENARIOS.map((s) => s.id)).size).toBe(3);
  });

  it("Summer afternoon: noon start at the origin, the line live all game, two units recalled at 16:15, an easterly at Mökkiranta, contain by 20:00", () => {
    const s = SUMMER_AFTERNOON;
    expect(s.startClockMin).toBe(720);
    expect(s.ignitions).toEqual([{ x: 5000, y: 5000 }]);
    // Burning since about 11:20 (called in at 11:32); EK11 first, VPK and EK12 minutes later (SPEC/18 §8.2 W1–W4).
    expect(s.preBurnS).toBeGreaterThanOrEqual(30 * 60);
    expect(s.preBurnS).toBeLessThanOrEqual(45 * 60);
    const arrive = (id: string) => s.units.find((u) => u.id === id)!.arriveAtS;
    expect(arrive("EK11")).toBe(0);
    expect(arrive("VPK")).toBeGreaterThan(0);
    expect(arrive("EK12")).toBeGreaterThan(arrive("VPK"));
    expect(arrive("EK12")).toBeLessThanOrEqual(30 * 60);
    // Two separate fires to find and catch after the first (SPEC/29 (ay): the game's own, not the study's): the ridge
    // (14:00, unreported) and the ridge's old edge flaring up as the wind backs (17:35, a vague call only).
    expect(s.events.filter((e) => e.kind === "ignite").map((e) => [e.atS, e.at])).toEqual([[at(720, "14:00"), PLACES.KUIVAKANGAS], [at(720, "17:35"), PLACES.KUIVAKANGAS]]);
    expect(s.endAtS).toBe(at(720, "20:00"));
    // The line is live from the start to the end; nothing switches it (SPEC/29 (ay) rule 1).
    expect(s.powerLineLiveAtStart).toBe(true);
    expect(s.events.some((e) => e.kind === "power_line_dead")).toBe(false);
    const recall = s.events.find((e) => e.kind === "units_recalled")!;
    expect(recall.atS).toBe(at(720, "16:15"));
    expect(recall.unitIds).toEqual(["EK12", "DR2"]);
    expect(s.units.slice(0, 4).map((u) => u.id)).toEqual(["EK11", "VPK", "EK12", "DR1"]);
    for (const id of ["EK13", "EK14", "KY21", "DR2", "DR3", "HELI1", "VD1", "UGV1", "EK15", "EK16", "KY23"]) expect(s.units.some((u) => u.id === id && u.arriveAtS > 0)).toBe(true);
    expect(s.objectives).toContainEqual({ kind: "contain", byS: at(720, "20:00") });
    expect(s.objectives).toContainEqual({ kind: "protect_settlement", settlementId: "Mökkiranta" });
    // The south-westerly until mid-afternoon, then an easterly that peaks at 10 m/s around 18:20–18:35.
    expect(s.weather.find((w) => w.atS === at(720, "15:00"))!.windFromDeg).toBe(225);
    const evening = s.weather.filter((w) => w.atS >= at(720, "18:00"));
    for (const w of evening) expect(w.windFromDeg).toBeGreaterThanOrEqual(80);
    for (const w of evening) expect(w.windFromDeg).toBeLessThanOrEqual(110);
    expect(Math.max(...s.weather.map((w) => w.windMs))).toBe(10);
  });

  it("Evening wind: 16:00 start, three lightning fires and a late one in the north, an easterly at Mökkiranta, fewer units", () => {
    const s = EVENING_WIND;
    expect(s.startClockMin).toBe(960);
    expect(s.ignitions.length).toBe(3);
    for (const p of [...s.ignitions, ...s.events.flatMap((e) => (e.kind === "ignite" && e.at ? [e.at] : []))]) expect(p.y).toBeGreaterThanOrEqual(6900); // north of Korpioja
    expect(s.events.filter((e) => e.kind === "ignite").length).toBe(1);
    for (const w of s.weather) expect(w.windFromDeg).toBeLessThanOrEqual(110); // north-east to east all evening
    expect(Math.max(...s.weather.map((w) => w.windMs))).toBe(10);
    expect(s.objectives).toContainEqual({ kind: "protect_settlement", settlementId: "Mökkiranta" });
    expect(s.units.length).toBeLessThan(SUMMER_AFTERNOON.units.length);
    expect(s.events.some((e) => e.kind === "power_line_dead")).toBe(false);
  });

  it("Training: small, light wind, everyone early, 90 minutes", () => {
    const s = TRAINING;
    expect(s.endAtS).toBe(90 * 60);
    expect(s.ignitions.length).toBe(1);
    expect(Math.max(...s.weather.map((w) => w.windMs))).toBeLessThanOrEqual(5); // a light to gentle breeze
    expect(s.preBurnS).toBeGreaterThan(0); // a small fire already burning when the game starts
    expect(s.units.every((u) => u.arriveAtS <= 600)).toBe(true);
  });

  it("resolve settlement names by name, English name or id, else to the one nearest the fire", () => {
    const base = makeWorld();
    const world: GameWorld = {
      ...base,
      settlements: [
        { id: "mokkiranta", nameFi: "Mökkiranta", nameEn: "Lakeside Cottages", centre: PLACES.MOKKIRANTA, assetIds: [] },
        { id: "village_e", nameFi: "Lahdenkylä", nameEn: "Bay Village", centre: PLACES.LAHDENKYLA, assetIds: [] },
      ],
    };
    expect(findSettlement(world, "Lahdenkylä")?.id).toBe("village_e");
    expect(findSettlement(world, "lahdenkyla")?.id).toBe("village_e");
    expect(findSettlement(world, "Bay Village")?.id).toBe("village_e");
    expect(findSettlement(world, "mokkiranta")?.id).toBe("mokkiranta");
    expect(findSettlement(world, "Atlantis")).toBeUndefined();
    expect(resolveScenario(SUMMER_AFTERNOON, world).objectives).toContainEqual({ kind: "protect_settlement", settlementId: "mokkiranta" });
    const elsewhere: GameWorld = { ...world, settlements: [world.settlements[1]!] };
    expect(resolveScenario(SUMMER_AFTERNOON, elsewhere).objectives).toContainEqual({ kind: "protect_settlement", settlementId: "village_e" });
    const none: GameWorld = { ...world, settlements: [] };
    expect(resolveScenario(SUMMER_AFTERNOON, none).objectives.some((o) => o.kind === "protect_settlement")).toBe(false);
  });
});
