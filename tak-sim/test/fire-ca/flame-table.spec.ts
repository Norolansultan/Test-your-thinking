/**
 * SPEC/31 §3.11 and §5 (D1, D3): the provisional flame-length table (`tools/fire-ca/flame-table.ts`), the records that follow it
 * from the hinge, the flame/rate consistency check (`tools/validate/fire-physics-checker.ts`) and the station's temperature,
 * humidity and dew point at every step (`tools/fire-ca/station-weather.ts`).
 */
import { describe, expect, it } from "vitest";
import { CYCLE_STORY } from "../../app/scenario/demo-story.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import {
  bandFitsRate, bandOf, byramFlameM, classOfFlame, CROWN_ABOVE_MPM, flameAt, flameTable, FUEL_LOAD_KG_M2, KALAJOKI_PAIRS, PHASE_B_FIRST_STEP,
} from "../../tools/fire-ca/flame-table.js";
import { dewPointC, STATION_TH, stationReading } from "../../tools/fire-ca/station-weather.js";
import { flameRateFindings, scenarioFlameRecords, statedBands, statedRates } from "../../tools/validate/fire-physics-checker.js";

const rows = flameTable(SITE_SCENARIO.steps);
const story = (step: number, k: number) => CYCLE_STORY[step as keyof typeof CYCLE_STORY]!.bubbles[k]!.text;

describe("Byram's relation and the Kalajoki pairs", () => {
  it("gives 2.6 m at 3.5 m/min on coniferous fuel (Kalajoki's 3–4 m/min pair) and errs short at 6 m/min (3.4 m, Kalajoki 4–4.4 m)", () => {
    expect(byramFlameM(3.5, FUEL_LOAD_KG_M2.forest)).toBeCloseTo(2.6, 1);
    const [low, high] = KALAJOKI_PAIRS;
    expect(byramFlameM((low!.rateMpm[0] + low!.rateMpm[1]) / 2, FUEL_LOAD_KG_M2.forest)).toBeCloseTo(low!.flameM[0], 1);
    const at6 = byramFlameM((high!.rateMpm[0] + high!.rateMpm[1]) / 2, FUEL_LOAD_KG_M2.forest);
    expect(at6).toBeGreaterThan(3.2);
    expect(at6).toBeLessThan(high!.flameM[0]);
    expect(byramFlameM(0, FUEL_LOAD_KG_M2.forest)).toBe(0);
  });

  it("bands a length at its lower edge and reads the generator's intensity class from it", () => {
    expect([0.29, 0.3, 1, 2.97, 4.4, 5.2].map((l) => bandOf(l).fi)).toEqual(["liekit alle 0,3 m", "liekit 0,3–1 m", "liekit 1–2 m", "liekit 2–3 m", "liekit 4–5 m", "liekit yli 5 m"]);
    expect([0.2, 0.5, 1.5, 3, 7].map((l) => classOfFlame(l, false))).toEqual([1, 2, 3, 4, 4]);
    expect(classOfFlame(3, true)).toBe(5);
  });
});

describe("the table per step and segment", () => {
  it("covers steps 1–20 from the CA's achieved head rate; the records follow it from the hinge (step 11, V8)", () => {
    expect(rows.map((r) => r.step)).toEqual(Array.from({ length: 20 }, (_, k) => k + 1));
    expect(PHASE_B_FIRST_STEP).toBe(11);
    for (const r of rows) expect(r.recordsFollow, `step ${r.step}`).toBe(r.step >= PHASE_B_FIRST_STEP);
    for (const r of rows) expect(r.headRosMpm).toBe(SITE_SCENARIO.steps.find((s) => s.index === r.step)!.headRos.achievedMpm);
  });

  it("flags the crown run by its rate and gives it no number", () => {
    const crown = rows.filter((r) => r.crown).map((r) => r.step);
    expect(crown).toEqual(rows.filter((r) => r.headRosMpm > CROWN_ABOVE_MPM).map((r) => r.step));
    expect(crown).toEqual([5, 6]);
    for (const r of rows.filter((x) => x.crown)) expect([r.headM, r.head.fi]).toEqual([null, "liekit puiden latvojen yli"]);
  });

  it("phase B's head, flank and rear bands (the hand-off's table)", () => {
    const b = rows.filter((r) => r.recordsFollow).map((r) => [r.step, r.headRosMpm, r.head.fi, r.flank.fi, r.rear.fi]);
    expect(b).toEqual([
      [11, 0, "liekit alle 0,3 m", "liekit alle 0,3 m", "liekit alle 0,3 m"],
      [12, 4.5, "liekit 2–3 m", "liekit 1–2 m", "liekit 1–2 m"],
      [13, 7.9, "liekit 3–4 m", "liekit 2–3 m", "liekit 1–2 m"],
      [14, 4.5, "liekit 2–3 m", "liekit 1–2 m", "liekit 1–2 m"],
      [15, 5.3, "liekit 3–4 m", "liekit 2–3 m", "liekit 1–2 m"],
      [16, 7.1, "liekit 3–4 m", "liekit 2–3 m", "liekit 1–2 m"],
      [17, 10.1, "liekit 4–5 m", "liekit 2–3 m", "liekit 1–2 m"],
      [18, 9.8, "liekit 4–5 m", "liekit 2–3 m", "liekit 1–2 m"],
      [19, 10.6, "liekit 4–5 m", "liekit 2–3 m", "liekit 1–2 m"],
      [20, 8, "liekit 3–4 m", "liekit 2–3 m", "liekit 1–2 m"],
    ]);
    for (const r of rows.filter((x) => !x.crown && x.headM !== null && x.headM > 0)) {
      expect(r.flankM).toBeCloseTo(r.headM! * 0.65, 1);
      expect(r.rearM).toBeCloseTo(r.headM! * 0.35, 1);
    }
  });
});

describe("the records that follow it", () => {
  it("SPOT's 17.10 pass (the flare-up at ~3 m/min) and its 19.30 pass (US3, ~1.75 m/min) state the table's bands", () => {
    expect(story(12, 1)).toContain(flameAt(3, "forest").band.fi);
    expect(flameAt(3, "forest").band.fi).toBe("liekit 2–3 m");
    expect(story(19, 3)).toContain(flameAt(1.75, "forest").band.fi);
    expect(flameAt(1.75, "forest").band.fi).toBe("liekit 1–2 m");
    expect(story(12, 1)).not.toMatch(/alle metrin/);
    expect(story(19, 3)).not.toMatch(/alle metrin/);
  });

  it("no phase-B record states a flame band its own spread rate cannot give (the validator's check)", () => {
    const records = scenarioFlameRecords();
    expect(records.filter((r) => r.step >= PHASE_B_FIRST_STEP && statedRates(r.text).length > 0 && statedBands(r.text).length > 0).length).toBeGreaterThan(10);
    expect(flameRateFindings(records)).toEqual([]);
  });

  it("the check catches the audit's case (flames under a metre at 10 m/min) and passes a creeping edge and a crown run", () => {
    const at = (text: string) => flameRateFindings([{ id: "x", step: 15, text }]);
    expect(at("reuna etenee noin 10 m/min, liekit 0,3–1 m").map((f) => f.band)).toEqual(["liekit 0,3–1 m"]);
    expect(at("SPOT: reuna etenee arviolta 3 m minuutissa, liekit alle metrin")).toHaveLength(1);
    expect(at("hehkuvaa kariketta, liikkuu noin 1 m/min, liekit alle 0,3 m")).toEqual([]);
    expect(at("kärki etenee 38 m/min, liekit puiden latvojen yli")).toEqual([]);
    expect(at("reuna etenee noin 10 m/min, liekit 4–5 m")).toEqual([]);
    expect(flameRateFindings([{ id: "x", step: 10, text: "reuna etenee noin 10 m/min, liekit 0,3–1 m" }])).toEqual([]); // phase A: not checked
    expect(bandFitsRate({ lo: 4, hi: 5 }, 10)).toBe(true);
  });
});

describe("the station's temperature, humidity and dew point (D3)", () => {
  const stationLine = (step: number) => SITE_SCENARIO.traffic.find((e) => e.cycle === step && e.actor === "SAA" && /lämpötila/.test(e.content));

  it("every step's first station record states them, with the dew point by Magnus", () => {
    for (let n = 1; n <= 20; n++) {
      const r = stationReading(n)!;
      const line = stationLine(n);
      expect(line, `step ${n}`).toBeDefined();
      expect(line!.content).toContain(`lämpötila ${r.tempC} °C, ilmankosteus ${r.rhPct} %, kastepiste ${r.dewC.toFixed(1).replace(".", ",").replace("-", "−")} °C`);
    }
    expect(dewPointC(28, 27)).toBeCloseTo(7.3, 1);
    expect(dewPointC(20, 26)).toBeCloseTo(-0.2, 0);
  });

  it("keeps the station's own readings at 16.20, 18.00 and 19.20 and dries the evening with no recovery", () => {
    expect([STATION_TH[10], STATION_TH[15], STATION_TH[19]]).toEqual([[25, 38], [22, 28], [20, 26]]);
    for (let n = 12; n <= 20; n++) expect(STATION_TH[n]![1], `step ${n}`).toBeLessThanOrEqual(STATION_TH[n - 1]![1]);
    for (let n = 11; n <= 21; n++) expect(STATION_TH[n]![0], `step ${n}`).toBeLessThanOrEqual(STATION_TH[n - 1]![0]);
  });
});
