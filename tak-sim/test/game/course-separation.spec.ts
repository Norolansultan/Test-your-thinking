/**
 * SPEC/34 §1, §3 and §7, SPEC/29 (ay) rule 1: the course's exercises replay none of the study's keyed moments. Every
 * exercise scenario is checked against `KEYED_MOMENTS` (study-keyed-moments.ts) with the same rules as
 * `study-separation.spec.ts` (its `touches` copied here in the minimum needed; the two are to be consolidated when that
 * test is widened to tasks and exercises), and against the course's own rules: the morning (07:00–11:00, pre-burn
 * included), away from the study's point of origin and Lahdenkylä, the 20 kV line only (never 110 kV).
 */

import { describe, expect, it } from "vitest";
import type { GameScenario, RadioMessage, ScenarioEvent, XY } from "../../app/game/contracts.js";
import { COURSE_EXERCISES } from "../../app/game/course/exercises/index.js";
import { GAME_SCENARIOS } from "../../app/game/scenarios/index.js";
import { weatherAt } from "../../app/game/weather/weather.js";
import { clock, clockOf, KEYED_MOMENTS, LAHDENKYLA_CENTRE, LINE_SWITCHING, ORIGIN, type KeyedMoment } from "./study-keyed-moments.js";

const dist = (a: XY, b: XY): number => Math.hypot(a.x - b.x, a.y - b.y);
const inSector = (deg: number, [lo, hi]: readonly [number, number]): boolean => deg >= lo && deg <= hi;
const NO_MESSAGE: RadioMessage = { atS: 0, from: "", room: "command", textFi: "", textEn: "", priority: "routine" };

/** The ways `s` touches moment `k` (copied from study-separation.spec.ts). */
function touches(s: GameScenario, k: KeyedMoment): string[] {
  const out: string[] = [];
  const startMin = s.startClockMin;
  const endMin = clockOf(s, s.endAtS);
  const overlaps = startMin <= k.toMin && endMin >= k.fromMin;
  const inWindow = (min: number): boolean => min >= k.fromMin && min <= k.toMin;
  const messages: { m: RadioMessage; e: ScenarioEvent }[] = s.events.flatMap((e) => (e.message ? [{ m: e.message, e }] : []));
  if (k.place) {
    const { at: p, radiusM, leadMin } = k.place;
    const lit = (min: number): boolean => min >= k.fromMin - leadMin && min <= k.toMin;
    const firstMin = startMin - (s.preBurnS ?? 0) / 60;
    for (const ig of s.ignitions) if (lit(firstMin) && dist(ig, p) <= radiusM) out.push(`starting fire at (${ig.x}, ${ig.y}) lit ${clock(firstMin)}`);
    for (const e of s.events) {
      const min = clockOf(s, e.atS);
      if (e.kind === "ignite" && e.at && lit(min) && dist(e.at, p) <= radiusM) out.push(`ignition at (${e.at.x}, ${e.at.y}) ${clock(min)}`);
    }
    for (const { m, e } of messages) {
      const min = clockOf(s, e.atS);
      if (m.at && inWindow(min) && dist(m.at, p) <= radiusM) out.push(`message placed at (${m.at.x}, ${m.at.y}) ${clock(min)}`);
    }
  }
  if (k.lineSwitch) {
    for (const e of s.events) if (e.kind === "power_line_dead" && inWindow(clockOf(s, e.atS))) out.push(`line switched ${clock(clockOf(s, e.atS))}`);
    for (const { m, e } of messages) if (inWindow(clockOf(s, e.atS)) && LINE_SWITCHING.test(`${m.textFi} ${m.textEn}`)) out.push(`switching words ${clock(clockOf(s, e.atS))}`);
    if (overlaps && LINE_SWITCHING.test(`${s.briefingFi} ${s.briefingEn}`)) out.push("switching words in the briefing");
  }
  if (k.recall) {
    for (const e of s.events) {
      if (e.kind !== "units_recalled") continue;
      const min = clockOf(s, e.atS);
      if (inWindow(min)) out.push(`recall ${clock(min)}`);
      for (const id of e.unitIds ?? []) if (k.recall.anyTime.includes(id)) out.push(`${id} recalled ${clock(min)}`);
    }
  }
  if (k.wind && overlaps) {
    for (let min = Math.max(k.fromMin, startMin); min <= Math.min(k.toMin, endMin); min++) {
      const w = weatherAt(s.weather, (min - startMin) * 60);
      if (inSector(w.windFromDeg, k.wind.fromDeg) && w.windMs >= k.wind.minMs) { out.push(`wind at ${clock(min)}`); break; }
    }
  }
  if (k.text) {
    for (const { m, e } of messages) {
      if (!k.text.anyTime && !inWindow(clockOf(s, e.atS))) continue;
      if (k.text.says(m.textFi, m) || k.text.says(m.textEn, m)) out.push(`message ${clock(clockOf(s, e.atS))}: ${m.textEn}`);
    }
    if (k.text.anyTime && (k.text.says(s.briefingFi, NO_MESSAGE) || k.text.says(s.briefingEn, NO_MESSAGE))) out.push("the briefing");
  }
  for (const c of k.clocks ?? []) {
    const [h, mm] = c.split(":");
    const named = new RegExp(`(?<![\\d.:])${h}[.:]${mm}(?![\\d])${mm === "00" ? `|klo ${h}(?![.:]?\\d)` : ""}`);
    for (const t of [s.briefingFi, s.briefingEn, ...messages.flatMap(({ m }) => [m.textFi, m.textEn])]) if (named.test(t)) out.push(`names ${c}`);
  }
  return out;
}

describe.each(COURSE_EXERCISES.map((t) => [t.id, t.scenario] as const))("exercise %s replays none of the study's keyed moments", (_id, s) => {
  it.each(KEYED_MOMENTS.map((k) => [k.id, k] as const))("%s", (_k, k) => {
    expect(touches(s, k)).toEqual([]);
  });

  it("runs in the morning, 07:00–11:00, pre-burn and scripted fires included", () => {
    const first = s.startClockMin - (s.preBurnS ?? 0) / 60;
    expect(first).toBeGreaterThanOrEqual(7 * 60);
    expect(clockOf(s, s.endAtS)).toBeLessThanOrEqual(11 * 60);
    for (const e of s.events) expect(clockOf(s, e.atS)).toBeLessThanOrEqual(11 * 60);
  });

  it("stays away from the study's point of origin and Lahdenkylä", () => {
    const places = [...s.ignitions, ...s.events.flatMap((e) => (e.at ? [e.at] : [])), ...s.events.flatMap((e) => (e.message?.at ? [e.message.at] : []))];
    expect(places.length).toBeGreaterThan(0);
    for (const p of places) {
      expect(dist(p, ORIGIN), `(${p.x}, ${p.y}) from the origin`).toBeGreaterThan(1000);
      expect(dist(p, LAHDENKYLA_CENTRE), `(${p.x}, ${p.y}) from Lahdenkylä`).toBeGreaterThan(2000);
    }
  });

  it("names the 20 kV line only, never 110 kV, and no study unit is recalled", () => {
    const texts = [s.briefingFi, s.briefingEn, ...s.events.flatMap((e) => (e.message ? [e.message.textFi, e.message.textEn] : []))].join(" ");
    expect(texts).not.toMatch(/110 ?kV/);
    expect(s.events.some((e) => e.kind === "units_recalled")).toBe(false);
  });

  it("is never offered in free play", () => {
    expect(GAME_SCENARIOS.some((g) => g.id === s.id)).toBe(false);
  });
});

describe("the copied rule set still catches what it was written against", () => {
  it("a switch-off in the F7 window and a north-westerly over the evening are caught", () => {
    const base = COURSE_EXERCISES.find((t) => t.id === "course-safety")!.scenario;
    const late: GameScenario = { ...base, startClockMin: 15 * 60, endAtS: 3600 };
    expect(touches(late, KEYED_MOMENTS.find((k) => k.id === "f7_line")!).length).toBeGreaterThan(0);
    const evening: GameScenario = { ...base, startClockMin: 18 * 60, endAtS: 3600, weather: [{ atS: 0, windFromDeg: 315, windMs: 8, gustMs: 12, tempC: 20, rh: 30 }] };
    expect(touches(evening, KEYED_MOMENTS.find((k) => k.id === "evening_northwesterly")!).length).toBeGreaterThan(0);
  });
});
