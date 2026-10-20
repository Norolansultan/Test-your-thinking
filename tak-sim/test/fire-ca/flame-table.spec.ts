/**
 * SPEC/31 §3.11 and §5 (D1, D3): the provisional flame-length table (`tools/fire-ca/flame-table.ts`), the records that follow it
 * at every step 1–20 (phase B since WP-1, phase A since 20 Oct 2026), the flame/rate consistency check and the decay rule's authored
 * transitions (`tools/validate/fire-physics-checker.ts`) and the station's temperature, humidity and dew point at every step
 * (`tools/fire-ca/station-weather.ts`).
 */
import { describe, expect, it } from "vitest";
import { CYCLE_STORY } from "../../app/scenario/demo-story.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import {
  bandFitsRate, bandOf, byramFlameM, classOfFlame, CROWN_ABOVE_MPM, flameAt, flameTable, FUEL_LOAD_KG_M2, KALAJOKI_PAIRS, PHASE_B_FIRST_STEP,
  recordFlameAt, RECORDS_FOLLOW_FROM_STEP,
} from "../../tools/fire-ca/flame-table.js";
import { dewPointC, STATION_TH, stationReading } from "../../tools/fire-ca/station-weather.js";
import {
  AUTHORED_TRANSITIONS, decayVerdicts, flameRateFindings, scenarioFlameRecords, statedBands, statedRates,
} from "../../tools/validate/fire-physics-checker.js";

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
  it("covers steps 1–20 from the CA's achieved head rate; the records follow it at every step (phase A since 20 Oct 2026)", () => {
    expect(rows.map((r) => r.step)).toEqual(Array.from({ length: 20 }, (_, k) => k + 1));
    expect(PHASE_B_FIRST_STEP).toBe(11);
    expect(RECORDS_FOLLOW_FROM_STEP).toBe(1);
    for (const r of rows) expect(r.recordsFollow, `step ${r.step}`).toBe(true);
    for (const r of rows) expect(r.headRosMpm).toBe(SITE_SCENARIO.steps.find((s) => s.index === r.step)!.headRos.achievedMpm);
  });

  it("flags the crown run by its rate and gives it no number", () => {
    const crown = rows.filter((r) => r.crown).map((r) => r.step);
    expect(crown).toEqual(rows.filter((r) => r.headRosMpm > CROWN_ABOVE_MPM).map((r) => r.step));
    expect(crown).toEqual([5, 6]);
    for (const r of rows.filter((x) => x.crown)) expect([r.headM, r.head.fi]).toEqual([null, "liekit puiden latvojen yli"]);
  });

  it("phase B's head, flank and rear bands (the hand-off's table)", () => {
    const b = rows.filter((r) => r.step >= PHASE_B_FIRST_STEP).map((r) => [r.step, r.headRosMpm, r.head.fi, r.flank.fi, r.rear.fi]);
    expect(b).toEqual([
      [11, 0, "liekit alle 0,3 m", "liekit alle 0,3 m", "liekit alle 0,3 m"],
      // SPEC/33 stage 7 (20 Oct 2026): the CA re-run on the rebuilt map (was 4.5 / 7.9 / 4.5 / 5.3 / 7.1 / 10.1 / 9.8 / 10.6 / 8 at steps 12–20).
      [12, 6.3, "liekit 3–4 m", "liekit 2–3 m", "liekit 1–2 m"],
      [13, 7.6, "liekit 3–4 m", "liekit 2–3 m", "liekit 1–2 m"],
      [14, 4, "liekit 2–3 m", "liekit 1–2 m", "liekit 0,3–1 m"],
      [15, 4.5, "liekit 2–3 m", "liekit 1–2 m", "liekit 1–2 m"],
      [16, 7.1, "liekit 3–4 m", "liekit 2–3 m", "liekit 1–2 m"],
      [17, 11.5, "liekit 4–5 m", "liekit 2–3 m", "liekit 1–2 m"],
      [18, 9.8, "liekit 4–5 m", "liekit 2–3 m", "liekit 1–2 m"],
      [19, 9.8, "liekit 4–5 m", "liekit 2–3 m", "liekit 1–2 m"],
      [20, 8.8, "liekit 4–5 m", "liekit 2–3 m", "liekit 1–2 m"],
    ]);
    for (const r of rows.filter((x) => !x.crown && x.headM !== null && x.headM > 0)) {
      expect(r.flankM).toBeCloseTo(r.headM! * 0.65, 1);
      expect(r.rearM).toBeCloseTo(r.headM! * 0.35, 1);
    }
  });

  it("phase A's head, flank and rear bands (the crown run at steps 5–6 above the treetops, its flanks per the table)", () => {
    const a = rows.filter((r) => r.step < PHASE_B_FIRST_STEP).map((r) => [r.step, r.headRosMpm, r.head.fi, r.flank.fi, r.rear.fi]);
    expect(a).toEqual([
      [1, 7.1, "liekit 3–4 m", "liekit 2–3 m", "liekit 1–2 m"],
      [2, 7.1, "liekit 3–4 m", "liekit 2–3 m", "liekit 1–2 m"],
      // SPEC/33 stage 7 (20 Oct 2026): the CA re-run on the rebuilt map (was 10.6 / 7.1 / 14.1 / 38 / 5.3 / 9.8 at steps 3–8).
      [3, 10.8, "liekit 4–5 m", "liekit 2–3 m", "liekit 1–2 m"],
      [4, 7.1, "liekit 3–4 m", "liekit 2–3 m", "liekit 1–2 m"],
      [5, 14.1, "liekit puiden latvojen yli", "liekit 3–4 m", "liekit 1–2 m"],
      [6, 38.1, "liekit puiden latvojen yli", "liekit yli 5 m", "liekit 2–3 m"],
      [7, 8.8, "liekit 4–5 m", "liekit 2–3 m", "liekit 1–2 m"],
      [8, 5.6, "liekit 3–4 m", "liekit 2–3 m", "liekit 1–2 m"],
      [9, 5.3, "liekit 3–4 m", "liekit 2–3 m", "liekit 1–2 m"],
      [10, 3.5, "liekit 2–3 m", "liekit 1–2 m", "liekit 0,3–1 m"],
    ]);
  });

  it("a record's flame: the crown band and class 5 over the crown rate, else Byram's band and its class", () => {
    expect(recordFlameAt(51.3, "forest")).toEqual({ band: expect.objectContaining({ fi: "liekit puiden latvojen yli", crown: true }), cls: 5 });
    expect(recordFlameAt(12, "forest").band.fi).toBe("liekit 4–5 m");
    expect(recordFlameAt(7.1, "forest")).toEqual({ band: expect.objectContaining({ fi: "liekit 3–4 m" }), cls: 4 });
    expect(recordFlameAt(1.8, "forest")).toEqual({ band: expect.objectContaining({ fi: "liekit 1–2 m" }), cls: 3 });
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

  it("no record of steps 1–20 states a flame its own spread rate cannot give (the validator's check), in either phase", () => {
    const records = scenarioFlameRecords();
    const checked = (from: number, to: number) => records.filter((r) => r.step >= from && r.step <= to && statedRates(r.text).length > 0 && statedBands(r.text).length > 0).length;
    expect(checked(PHASE_B_FIRST_STEP, 20)).toBeGreaterThan(10);
    expect(checked(RECORDS_FOLLOW_FROM_STEP, PHASE_B_FIRST_STEP - 1)).toBeGreaterThan(10);
    expect(flameRateFindings(records)).toEqual([]);
  });

  it("phase A follows the table: DR1's head records, the crown run's head record (step 6, recorded at 15.25) and the head's sides under direct attack", () => {
    const traffic = (step: number, re: RegExp) => SITE_SCENARIO.traffic.find((e) => e.cycle === step && re.test(e.content))!.content;
    const radio = (step: number, re: RegExp) => SITE_SCENARIO.radio.find((r) => r.cycle === step && re.test(r.text))!.text;
    // SPEC/33 stage 7 (20 Oct 2026, the CA on the rebuilt map): 10,8 and 49,0 m/min (were 10,6 and 51,3); the 15.25 thermal record is evt.c07.009 (was .010).
    // SPEC/33 gate R (R1): found by content (the road-graph shuttle re-seeds the step draws: DR1 14.25 draws its other wording, the same 10,8 m/min and 4–5 m).
    expect(traffic(4, /^DR1 lämpökuva, kärki klo 14\.25: /)).toMatch(/10,8 m\/min.*liekit 4–5 m/); // was 3/5, 1–2 m
    expect(traffic(7, /^DR1 mittaus: kärjen etenemä/)).toMatch(/49,0 m\/min \(sisältää pistepalojen hypyt\)\. Intensiteettiluokka 5\/5, liekit puiden latvojen yli\./); // was 4/5, 2–4 m
    expect(traffic(7, /^DR1 lämpökuva, kärki klo 15\.25: /)).toContain("yhtenäinen reuna noin 30 m/min), liekit puiden latvojen yli, maks.");
    expect(radio(1, /^EK11: kärjen molemmat laidat suorassa sammutuksessa/)).toContain(`EK12 oikea laita, ${rows[0]!.flank.fi}.`);
    expect(radio(2, /^EK11: hyökkäämme kärjen vasenta laitaa suoraan/)).toContain(`letkulla, ${rows[1]!.flank.fi}.`);
    // The trigger point is a precursor again: the sides pass three metres only as the head crowns (step 5), not from 13.20 on.
    expect(rows.filter((r) => r.step <= 4).every((r) => r.flankM! < 3)).toBe(true);
    expect(rows[4]!.flankM!).toBeGreaterThan(3);
    expect(radio(5, /^EK11: kärki kiihtyy kuusikkoon/)).toContain("liekit ylittävät kolme metriä");
    for (const r of scenarioFlameRecords()) expect(r.text, r.id).not.toMatch(/liekit (?:alle metrin|matalat)/);
  });

  it("radio TE-08: no record calls the thermal image 'kylläinen' (DR3 at 15.06 says 'saturoitunut')", () => {
    for (const r of scenarioFlameRecords()) expect(r.text, r.id).not.toMatch(/kylläi/);
    expect(SITE_SCENARIO.traffic.find((e) => e.id === "evt.c06.017")!.content).toContain("lämpökameran kuva saturoitunut latvapalon kohdalla, reunaa ei erota");
  });

  it("the check catches the audit's case (flames under a metre at 10 m/min) and passes a creeping edge and a crown run", () => {
    const at = (text: string) => flameRateFindings([{ id: "x", step: 15, text }]);
    expect(at("reuna etenee noin 10 m/min, liekit 0,3–1 m").map((f) => f.band)).toEqual(["liekit 0,3–1 m"]);
    expect(at("SPOT: reuna etenee arviolta 3 m minuutissa, liekit alle metrin")).toHaveLength(1);
    expect(at("hehkuvaa kariketta, liikkuu noin 1 m/min, liekit alle 0,3 m")).toEqual([]);
    expect(at("kärki etenee 38 m/min, liekit puiden latvojen yli")).toEqual([]);
    expect(at("reuna etenee noin 10 m/min, liekit 4–5 m")).toEqual([]);
    // Phase A is checked too since 20 Oct 2026 (the audit's DR1 "1–2 m" at 7.1 m/min); the practice step (W2, −3) is outside the table.
    expect(flameRateFindings([{ id: "x", step: 2, text: "reuna etenee noin 7,1 m/min, liekit 1–2 m" }]).map((f) => f.kind)).toEqual(["band_rate"]);
    expect(flameRateFindings([{ id: "x", step: -3, text: "reuna etenee noin 4 m/min, liekit 0,3–1 m" }])).toEqual([]);
    // A crown run's rate with a surface band (the step-6 head record's old "liekit 2–4 m" at 51.3 m/min), and the crown band at a surface rate.
    expect(at("51,3 m/min (sisältää pistepalojen hypyt). Intensiteettiluokka 4/5, liekit 2–4 m.").map((f) => [f.kind, f.band])).toEqual([["surface_band_crown_rate", "liekit 2–4 m"]]);
    expect(at("reuna etenee noin 8 m/min, liekit puiden latvojen yli").map((f) => f.kind)).toEqual(["crown_band_surface_rate"]);
    expect(at("kärki 14,1 m/min, liekit puiden latvojen yli; sivusta 3 m/min, liekit 2–3 m")).toEqual([]);
    expect(bandFitsRate({ lo: 4, hi: 5 }, 10)).toBe(true);
  });
});

describe("the decay rule's authored transitions (fire-physics-checker.ts)", () => {
  it("prints the authored crown-run collapse at 15:20 (FT-C14) as authored, with its reason, and finds no other violation", () => {
    const v = decayVerdicts();
    expect(v.filter((x) => x.verdict === "error")).toEqual([]);
    expect(v.filter((x) => x.verdict === "authored").map((x) => [x.clock, x.fromMpm, x.toMpm])).toEqual([["15:20", 30, 8]]);
    expect(AUTHORED_TRANSITIONS.every((t) => t.reason.length > 40)).toBe(true);
  });

  it("anything else still errors: an unlisted drop, or the listed clock with other rates", () => {
    const row = (clock: string, windFromDeg: number, headRosActualMpm: number) => ({ clock, windFromDeg, headRosActualMpm });
    expect(decayVerdicts([row("16:00", 200, 20), row("16:20", 210, 5)]).map((x) => x.verdict)).toEqual(["error"]);
    expect(decayVerdicts([row("15:00", 225, 30), row("15:20", 220, 6)]).map((x) => x.verdict)).toEqual(["error"]);
    expect(decayVerdicts([row("15:00", 225, 30), row("15:20", 220, 8)]).map((x) => x.verdict)).toEqual(["authored"]);
    expect(decayVerdicts([row("16:00", 140, 20), row("16:20", 260, 5)]).map((x) => x.verdict)).toEqual(["decay"]); // the wind turned 90° or more
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
