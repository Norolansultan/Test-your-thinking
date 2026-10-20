/**
 * The CO-zone proxy (SPEC/31 §5 D4) and the scenario data WP-1 adds before Gate A, each on both paths: the station's
 * T/RH/dew-point series (D3; today a reading at a few steps, with D3 every step) and the flame-length table (D1; today
 * absent, the bands quoted from the records; present, its values per step and segment).
 */

import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { buildScenarioPackage } from "../../tools/skills/package.js";
import type { Observation } from "../../tools/skills/fire-observations.js";
import { adaptFlameTable, FLAME_TABLE_MODULE, loadFlameTable, stationReading, stationRecords, type FlameTable, type StationRecord } from "../../tools/skills/scenario-extras.js";
import { roadNamed, zoneProxy } from "../../tools/skills/smoke-zone.js";
import { barrierLayer } from "../../tools/skills/spatial.js";
import type { EN } from "../../tools/skills/geo.js";

type Rec = Record<string, unknown>;
const cyclesOf = (pkg: ReturnType<typeof buildScenarioPackage>) => (JSON.parse(pkg.files.get("ground_truth/cycles.json")!) as { cycles: Rec[] }).cycles;
const today = buildScenarioPackage("test-version");

const obs = (id: string, source: string, text: string, xy: EN | null): Observation => ({
  id, step: 1, window: 1, source, text_fi: text, text_en: null, xy, band: null, intensityClass: null, rateMpm: null, smoulder: null,
});

describe("D4: the CO-zone proxy from the downwind/smoke rule", () => {
  const edge: EN[][] = [[[500_000, 6_700_000], [500_050, 6_700_000]]];
  const crew: EN = [500_000, 6_700_300]; // 300 m north of the burning edge
  const unit = SITE_SCENARIO.units[0]!.id; // a ground unit reports for itself

  it("grades the zone: downwind and in smoke → immediate danger (and `downwind`); downwind alone → danger; reported clear → rescue ops", () => {
    const smoke = [obs("r1", unit, `${unit}: tie autollemme on savun peitossa.`, [500_000, 6_700_350])];
    expect(zoneProxy(crew, edge, 180, smoke)).toMatchObject({ zone: "immediate_danger", downwind: true, downwindOfFront: true, smoke: ["r1"] });
    expect(zoneProxy(crew, edge, 180, [])).toMatchObject({ zone: "danger", downwind: false, downwindOfFront: true });
    expect(zoneProxy(crew, edge, 0, smoke)).toMatchObject({ zone: "danger", downwind: false, downwindOfFront: false });
    expect(zoneProxy(crew, edge, 0, [])).toMatchObject({ zone: "rescue_ops", downwind: false });
    const far = [obs("r2", unit, `${unit}: tie autollemme on savun peitossa.`, [500_000, 6_701_000])];
    expect(zoneProxy(crew, edge, 180, far).zone).toBe("danger"); // a crew's report applies within 200 m of it only
  });

  it("reads the drone's smoke column by the side it names, and its road observations by the road", () => {
    const column = [obs("c1", "DR3", "DR3 savupatsas: nousee noin 1100 m. Savu laskeutuu palon pohjoispuolelle, näkyvyys siellä alle 100 m.", null)];
    expect(zoneProxy(crew, edge, 180, column).smoke).toEqual(["c1"]);
    expect(zoneProxy([500_000, 6_699_700], edge, 180, column).smoke).toEqual([]);
    expect(roadNamed("DR2 tiehavainto: metsäautotie (Honkaharju) syttymäkohdan kaakkoispuolella, palo noin 100 m tiestä")).toBe("Honkaharju forest road");
    expect(roadNamed("DR2 tiehavainto: tie R2 metsäautotien risteyksessä")).toBe("R2");
    const r2 = barrierLayer().find((b) => b.type === "road" && b.name === "R2")!;
    const onRoad = r2.coords[0]!;
    const roadEdge: EN[][] = [[[onRoad[0], onRoad[1] - 200]]];
    const drone = (t: string) => [obs("d1", "DR2", `DR2 tiehavainto: tie R2 metsäautotien risteyksessä, palo noin 100 m tiestä — ${t} (luotettavuus hyvä).`, [0, 0])];
    expect(zoneProxy(onRoad, roadEdge, 180, drone("savua tiellä, ajettavissa varoen")).zone).toBe("immediate_danger");
    expect(zoneProxy(onRoad, roadEdge, 180, drone("tie ajettavissa, ei savua tiellä")).zone).toBe("rescue_ops");
  });
});

describe("D3: the station's T/RH/dew point, read from its records", () => {
  it("today: every step has the station's reading (D3, WP-1), each with its record; never interpolated", () => {
    const cycles = cyclesOf(today);
    const withRh = cycles.filter((c) => c.rh_pct !== null);
    expect(withRh.length).toBe(cycles.length);
    for (const c of withRh) {
      const rec = stationRecords().find((r) => r.id === c.rh_source)!;
      expect(rec.cycle).toBe(c.step);
      expect(rec.content).toContain(`ilmankosteus ${c.rh_pct} %`);
    }
  });

  it("with a reading every step (D3), every cycle gets RH, T and dew point from the records", () => {
    const station: StationRecord[] = SITE_SCENARIO.steps.map((s, i) => ({
      id: `test.saa.${s.index}`, cycle: s.index, actor: "SAA", content: `Sääasema johtopaikalla: tuuli lännestä 5,0 m/s, lämpötila ${20 + (i % 3)} °C, ilmankosteus ${30 + i} %, kastepiste ${i % 2 === 0 ? "2,5" : "−1"} °C.`,
    }));
    expect(stationReading(SITE_SCENARIO.steps[1]!.index, station)).toEqual({ rhPct: 31, tempC: 21, dewPointC: -1, sourceId: `test.saa.${SITE_SCENARIO.steps[1]!.index}` });
    const cycles = cyclesOf(buildScenarioPackage("test-version", today.scenario, { station }));
    cycles.forEach((c, i) => {
      expect([c.rh_pct, c.temp_c, c.dew_point_c, c.rh_source], `cycle ${c.cycle}`).toEqual([30 + i, 20 + (i % 3), i % 2 === 0 ? 2.5 : -1, `test.saa.${c.step}`]);
    });
  });
});

describe("D1: the flame-length table when the scenario has one, else the records' quoted bands", () => {
  const dir = mkdtempSync(join(tmpdir(), "skills-flame-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("reads the scenario's own table module when it exists (an integration guard for D1), else none", async () => {
    const table = await loadFlameTable();
    if (existsSync(fileURLToPath(FLAME_TABLE_MODULE))) expect(table).not.toBeNull();
    else expect(table).toBeNull();
  });

  it("WP-1's `flameTable(steps)`: the table's values where the records follow it (every step 1–20 since 20 Oct 2026; a crown run's head has no number)", async () => {
    const table = (await loadFlameTable())!;
    const head17 = table.at(17, "head")!;
    expect(head17.hiM).toBeGreaterThan(4);
    // SPEC/33 stage 7 (20 Oct 2026, the fire re-run on the rebuilt map): 4.57 m at 11.5 m/min, ~4 % over the Kalajoki surface envelope
    // (0.5–4.4 m), a REVIEW flag the fire stage retained (docs/audits/2026-10-20-map/fire/methods.md); it was inside the envelope before.
    expect(head17.hiM).toBeLessThan(4.7);
    expect(head17.fireType).toBe("surface");
    expect(table.at(17, "flank")!.hiM).toBeCloseTo(head17.hiM * 0.65, 1);
    // Phase A follows the table too (`flame-table.ts` RECORDS_FOLLOW_FROM_STEP): step 3's head at 10.6 m/min; the step-6 crown run's head
    // has no number (the export then reads the head record's class: "liekit puiden latvojen yli", 5/5).
    expect(table.at(3, "head")!.hiM).toBeCloseTo(4.4, 1);
    expect(table.at(6, "head")).toBeNull();
  });

  it("without a table: every flame value is quoted from a record of the window", () => {
    for (const c of cyclesOf(today)) {
      expect(c.fl_source).toBe("records (quoted)");
      if (c.fl_head_m !== null) expect((c.fl_head_sources as string[]).length, `cycle ${c.cycle}`).toBe(1);
      for (const s of c.segments as Rec[]) if (s.flame_length_m !== null) expect(s.flame_source).toBe("records (quoted)");
    }
  });

  it("adapts the shapes a table module may export, and refuses an unknown one", () => {
    const rows = [{ step: 13, segment: "head", loM: 3, hiM: 4, fireType: "surface" }, { step: 13, segment: "flank", lo: 1.5, hi: 2.5 }];
    const byRows = adaptFlameTable({ FLAME_TABLE: rows }, "m")!;
    expect([byRows.at(13, "head"), byRows.at(13, "flank"), byRows.at(13, "rear")]).toEqual([{ loM: 3, hiM: 4, fireType: "surface" }, { loM: 1.5, hiM: 2.5 }, null]);
    const byStep = adaptFlameTable({ flameTable: { 13: { head: [3, 4], flanks: 2, rear: { minM: 0.3, maxM: 1 } } } }, "m")!;
    expect([byStep.at(13, "head"), byStep.at(13, "flank"), byStep.at(13, "rear"), byStep.at(14, "head")]).toEqual([{ loM: 3, hiM: 4 }, { loM: 2, hiM: 2 }, { loM: 0.3, hiM: 1 }, null]);
    const byFn = adaptFlameTable({ flameLengthAt: (step: number, seg: string) => (seg === "head" ? { flameLengthM: step / 4 } : null), FLAME_TABLE_VERSION: "0.1.0" }, "m")!;
    expect([byFn.source, byFn.at(8, "head"), byFn.at(8, "rear")]).toEqual(["m 0.1.0", { loM: 2, hiM: 2 }, null]);
    expect(adaptFlameTable({ somethingElse: 1 }, "m")).toBeNull();
  });

  it("loads the module when it exists and is null when it does not; an unreadable module is an error", async () => {
    expect(await loadFlameTable(pathToFileURL(join(dir, "missing.mjs")))).toBeNull();
    const good = join(dir, "flame-table.mjs");
    writeFileSync(good, "export const FLAME_TABLE = [{ step: 13, segment: 'head', loM: 3, hiM: 4 }];\n");
    expect((await loadFlameTable(pathToFileURL(good)))!.at(13, "head")).toEqual({ loM: 3, hiM: 4 });
    const bad = join(dir, "bad.mjs");
    writeFileSync(bad, "export const nothing = 1;\n");
    await expect(loadFlameTable(pathToFileURL(bad))).rejects.toThrow(/no flame table/);
  });

  it("with a table, every cycle's flame values are the table's (head, flanks, rear), its fire type where it states one", () => {
    const table: FlameTable = {
      source: "test table",
      at: (step, segment) => ({ loM: step / 10, hiM: step / 10 + (segment === "head" ? 2 : segment === "flank" ? 1 : 0.5), ...(segment === "head" && step >= 12 ? { fireType: "surface" } : {}) }),
    };
    const cycles = cyclesOf(buildScenarioPackage("test-version", today.scenario, { flameTable: table }));
    for (const c of cycles) {
      const step = c.step as number;
      expect(c.fl_source).toBe("flame table (test table)");
      expect([c.fl_head_m, c.fl_head_band_m, c.fl_flank_m]).toEqual([step / 10 + 2, [step / 10, step / 10 + 2], step / 10 + 1]);
      const segs = new Map((c.segments as Rec[]).map((s) => [s.id, s]));
      expect([segs.get("rear")!.flame_length_m, segs.get("left_flank")!.flame_length_m, segs.get("head")!.flame_source]).toEqual([step / 10 + 0.5, step / 10 + 1, "flame table"]);
      if (step >= 12 && c.ros_head_m_min !== 0) expect(c.fire_type, `cycle ${c.cycle}`).toBe("surface");
    }
    expect(buildScenarioPackage("test-version", today.scenario, { flameTable: table }).files.get("DATA_SOURCES.md")).toContain("the flame table (test table)");
  });
});
