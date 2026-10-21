/**
 * SPEC/29 §2.3 and revision (ay) rule 1 (`31` P-12), shared by the separation tests: how a game scenario touches the
 * study's keyed moments (`study-keyed-moments.ts`, the one list) — ignitions and placed messages, the 20 kV line's
 * switching, unit recalls, the evening wind, the words of the messages and briefings, and the keyed clock times.
 * `study-separation.spec.ts` runs it over free play's scenarios and the decision tasks' situations (SPEC/34 §4).
 * Test-only.
 */

import type { GameScenario, RadioMessage, ScenarioEvent, XY } from "../../app/game/contracts.js";
import { weatherAt } from "../../app/game/weather/weather.js";
import { clock, clockOf, KEYED_MOMENTS, LINE_SWITCHING, type KeyedMoment } from "./study-keyed-moments.js";

const dist = (a: XY, b: XY): number => Math.hypot(a.x - b.x, a.y - b.y);
const inSector = (deg: number, [lo, hi]: readonly [number, number]): boolean => deg >= lo && deg <= hi;

/** The ways `s` touches moment `k` (empty: none), each described for the failure message. */
export function touches(s: GameScenario, k: KeyedMoment): string[] {
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
      if (m.at && inWindow(min) && dist(m.at, p) <= radiusM) out.push(`message placed at (${m.at.x}, ${m.at.y}) ${clock(min)}: ${m.textEn}`);
    }
  }
  if (k.lineSwitch) {
    for (const e of s.events) if (e.kind === "power_line_dead" && inWindow(clockOf(s, e.atS))) out.push(`line switched ${clock(clockOf(s, e.atS))}`);
    for (const { m, e } of messages) {
      if (inWindow(clockOf(s, e.atS)) && (LINE_SWITCHING.test(m.textFi) || LINE_SWITCHING.test(m.textEn))) out.push(`switching words ${clock(clockOf(s, e.atS))}: ${m.textEn}`);
    }
    if (overlaps && (LINE_SWITCHING.test(s.briefingFi) || LINE_SWITCHING.test(s.briefingEn))) out.push("switching words in the briefing");
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
      if (inSector(w.windFromDeg, k.wind.fromDeg) && w.windMs >= k.wind.minMs) {
        out.push(`wind from ${Math.round(w.windFromDeg)}° at ${w.windMs.toFixed(1)} m/s at ${clock(min)}`);
        break;
      }
    }
  }
  if (k.text) {
    for (const { m, e } of messages) {
      if (!k.text.anyTime && !inWindow(clockOf(s, e.atS))) continue;
      if (k.text.says(m.textFi, m) || k.text.says(m.textEn, m)) out.push(`message ${clock(clockOf(s, e.atS))}: ${m.textEn}`);
    }
    if (k.text.anyTime && (k.text.says(s.briefingFi, { atS: 0, from: "", room: "command", textFi: "", textEn: "", priority: "routine" }) || k.text.says(s.briefingEn, { atS: 0, from: "", room: "command", textFi: "", textEn: "", priority: "routine" }))) out.push("the briefing");
  }
  for (const c of k.clocks ?? []) {
    const [h, mm] = c.split(":");
    const named = new RegExp(`(?<![\\d.:])${h}[.:]${mm}(?![\\d])${mm === "00" ? `|klo ${h}(?![.:]?\\d)` : ""}`);
    const texts = [s.briefingFi, s.briefingEn, ...messages.flatMap(({ m }) => [m.textFi, m.textEn])];
    for (const t of texts) if (named.test(t)) out.push(`names ${c}: "${t.slice(0, 80)}…"`);
  }
  return out;
}

/** Every keyed moment `s` touches, with how (empty: the scenario is clear of the study). */
export function separationTouches(s: GameScenario): { readonly moment: string; readonly how: readonly string[] }[] {
  return KEYED_MOMENTS.map((k) => ({ moment: k.id, how: touches(s, k) })).filter((x) => x.how.length > 0);
}
