/**
 * SPEC/29 §2.3 and revision (ay) rule 1 (`31` P-12): no game scenario has an event at the study's keyed times or
 * places. Every scenario in `GAME_SCENARIOS`, and every decision task's situation in `DECISION_TASKS` (SPEC/34 §4), is
 * checked against `KEYED_MOMENTS` (study-keyed-moments.ts, the one list) by `separation-check.ts`: ignitions and placed
 * messages, the 20 kV line's switching, unit recalls, the evening wind, the words of the messages and briefings, and
 * the keyed clock times. Each moment is also shown to catch the timeline it was written against (the replays P-12
 * found), so the check cannot pass by being blind.
 */

import { describe, expect, it } from "vitest";
import type { GameScenario, WeatherKey, XY } from "../../app/game/contracts.js";
import { GAME_SCENARIOS } from "../../app/game/scenarios/index.js";
import { at, PLACES, radio, wx } from "../../app/game/scenarios/places.js";
import { DECISION_TASKS } from "../../app/game/tasks/index.js";
import { getWorld } from "../../app/game/world/load.js";
import { designedEventAtoms } from "../../app/scenario/designed-events.js";
import { DESIGNED_EVENT_IDS } from "../../app/scenario/types.js";
import { separationTouches, touches } from "./separation-check.js";
import { clock, clockOf, KEYED_MOMENTS, LAHDENKYLA_CENTRE, ORIGIN, stepStartMin, STUDY_END_MIN } from "./study-keyed-moments.js";

const dist = (a: XY, b: XY): number => Math.hypot(a.x - b.x, a.y - b.y);

describe("the keyed moments (one list)", () => {
  it("are anchored on the study: its step clock, F7's two records, its point of origin and Lahdenkylä on the shared map", () => {
    expect(clock(stepStartMin(1))).toBe("13:20");
    expect(clock(stepStartMin(12))).toBe("17:00"); // V9's rekindle step
    expect(clock(STUDY_END_MIN)).toBe("20:00");
    const f7 = KEYED_MOMENTS.find((k) => k.id === "f7_line")!;
    for (const id of [DESIGNED_EVENT_IDS.gridRecord, DESIGNED_EVENT_IDS.planted]) {
      const atom = designedEventAtoms().find((a) => a.id === id)!;
      const min = stepStartMin(1) + Number(atom.provenance.observedAt) / 60;
      expect(min).toBeGreaterThanOrEqual(f7.fromMin);
      expect(min).toBeLessThanOrEqual(f7.toMin);
      expect(f7.clocks).toContain(clock(min)); // 15:06 and 15:46
    }
    expect(ORIGIN).toEqual(PLACES.IGN);
    const village = getWorld().settlements.find((x) => x.id === "lahdenkyla")!;
    expect(dist(village.centre, LAHDENKYLA_CENTRE)).toBeLessThan(5);
    expect(new Set(KEYED_MOMENTS.map((k) => k.id)).size).toBe(KEYED_MOMENTS.length);
  });
});

describe.each(GAME_SCENARIOS.map((s) => [s.id, s] as const))("scenario %s replays none of the study's keyed moments (SPEC/29 (ay))", (_id, s) => {
  it.each(KEYED_MOMENTS.map((k) => [k.id, k] as const))("%s", (_k, k) => {
    expect(touches(s, k)).toEqual([]);
  });
});

describe.each(DECISION_TASKS.map((t) => [t.id, t] as const))("decision task %s replays none of the study's keyed moments (SPEC/34 §4)", (_id, t) => {
  it("touches no keyed moment", () => {
    expect(separationTouches(t.scenario)).toEqual([]);
  });

  it("lies before the study's incident (lit about 11:20) and at least 2 km from its point of origin and Lahdenkylä", () => {
    expect(clockOf(t.scenario, t.scenario.endAtS)).toBeLessThan(11 * 60 + 20);
    const fires = [...t.scenario.ignitions, ...t.scenario.events.flatMap((e) => (e.kind === "ignite" && e.at ? [e.at] : []))];
    expect(fires.length).toBeGreaterThan(0);
    for (const p of fires) {
      expect(dist(p, ORIGIN)).toBeGreaterThan(2000);
      expect(dist(p, LAHDENKYLA_CENTRE)).toBeGreaterThan(2000);
    }
  });
});

// The timelines P-12 found (summer afternoon and evening wind before 19 Oct 2026), one replay per moment, on a quiet base.
const START = 720;
const T = (hhmm: string): number => at(START, hhmm);
const OLD_REKINDLE: XY = { x: PLACES.IGN.x + 85, y: PLACES.IGN.y - 115 };
const quietWeather: WeatherKey[] = [wx(START, "12:00", 200, 3, 5, 22, 40), wx(START, "20:00", 200, 3, 5, 20, 45)];
const BASE: GameScenario = {
  id: "base", titleFi: "x", titleEn: "x", briefingFi: "x", briefingEn: "y", startClockMin: START, endAtS: T("20:00"),
  difficulty: "normal", ignitions: [{ x: 1500, y: 9000 }], weather: quietWeather, units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }],
  events: [], objectives: [{ kind: "no_casualties" }], powerLineLiveAtStart: true,
};
const msg = (hhmm: string, fi: string, en: string, pos?: XY) => radio(T(hhmm), "P3", "command", "important", fi, en, pos);
const REPLAYS: Readonly<Record<string, Partial<GameScenario>>> = {
  origin_rekindle: {
    events: [
      { atS: T("17:00"), kind: "ignite", at: OLD_REKINDLE },
      { atS: T("17:01"), kind: "radio", message: msg("17:01", "SPOT: Uusi palo syttymäkohdan kaakkoispuolella.", "SPOT: A new fire south-east of the point of origin.", OLD_REKINDLE) },
    ],
  },
  phase_b_front: { events: [{ atS: T("17:20"), kind: "ignite", at: { x: 5640, y: 3420 } }] },
  f7_line: {
    events: [{ atS: T("15:30"), kind: "power_line_dead", message: msg("15:30", "P3: Verkkoyhtiö: 20 kV johto kytketty irti ja maadoitettu klo 15.30.", "P3: Distribution company: the 20 kV line is disconnected and earthed as of 15:30.") }],
  },
  unit_recall: {
    units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }, { id: "KY21", kind: "engine", arriveAtS: T("13:45") }, { id: "DR3", kind: "drone_vtol", arriveAtS: T("13:20") }],
    events: [{ atS: T("17:40"), kind: "units_recalled", unitIds: ["KY21", "DR3"], message: msg("17:40", "P3: Alue tarvitsee KY21:n ja DR3:n toiselle palolle klo 17.40 alkaen.", "P3: The region needs KY21 and DR3 at another fire from 17:40.") }],
  },
  refusing_households: {
    events: [{ atS: T("18:50"), kind: "radio", message: msg("18:50", "P3: Poliisi aloittaa Lahdenkylän evakuoinnin. Kaksi taloutta kieltäytyy lähtemästä.", "P3: The police are starting Bay Village's evacuation. Two households refuse to leave.", PLACES.LAHDENKYLA) }],
  },
  evening_northwesterly: {
    weather: [wx(START, "12:00", 225, 4, 7, 27, 30), wx(START, "18:00", 290, 6, 11, 22, 30), wx(START, "19:00", 315, 11, 16, 20, 25), wx(START, "20:00", 320, 5, 9, 19, 30)],
  },
  north_flank_contradiction: { events: [{ atS: T("19:00"), kind: "ignite", at: { x: 5160, y: 6200 } }] },
};

describe("each keyed moment catches the replay it was written against", () => {
  it("the quiet base touches none", () => {
    for (const k of KEYED_MOMENTS) expect(touches(BASE, k)).toEqual([]);
  });

  it.each(KEYED_MOMENTS.map((k) => [k.id, k] as const))("%s", (id, k) => {
    const replay = REPLAYS[id];
    expect(replay, `a replay for ${id}`).toBeDefined();
    expect(touches({ ...BASE, ...replay }, k).length).toBeGreaterThan(0);
  });

  it("the old evening wind's start beside the origin and in Rahkasuo, and its line message, are caught", () => {
    const old: GameScenario = {
      ...BASE, startClockMin: 960, endAtS: at(960, "20:00"),
      ignitions: [{ x: PLACES.KUIVAKANGAS.x - 10, y: PLACES.KUIVAKANGAS.y - 10 }, { x: PLACES.IGN.x + 120, y: PLACES.IGN.y - 50 }, { x: PLACES.RAHKASUO.x + 40, y: PLACES.RAHKASUO.y + 20 }],
      weather: [wx(960, "16:00", 160, 5, 9, 25, 38), wx(960, "20:00", 160, 5, 9, 19, 30)],
      events: [{ atS: 600, kind: "radio", message: radio(600, "P3", "command", "important", "P3: Verkkoyhtiö ei saa 20 kV johtoa jännitteettömäksi tänään.", "P3: The distribution company cannot de-energise the 20 kV line today.") }],
    };
    const ids = KEYED_MOMENTS.filter((k) => touches(old, k).length > 0).map((k) => k.id);
    expect(ids).toEqual(expect.arrayContaining(["origin_rekindle", "phase_b_front", "f7_line"]));
  });
});
