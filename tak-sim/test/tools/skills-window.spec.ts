/**
 * The Gate-A fields of the wildfire-skills export (SPEC/31 §5 and §7 WP-4): every fire field of a cycle describes the
 * step's own 20 minutes (D2), segments are measured on the active front, spot fires are dated to the step that threw
 * them, smouldering includes "voivat kyteä", and the units carry crew sizes (D5), shift hours (D7), the wildland unit's
 * equipment class (D11) and the aircraft's LACES exemption. Written as properties of the scenario, not its values, so
 * they hold when the scenario's content changes.
 */

import { describe, expect, it } from "vitest";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { UNIT_ROSTER } from "../../app/render/ui/unit-roster.js";
import { SCENARIO_18_FORCING } from "../../tools/fire-ca/scenario-18.js";
import { buildScenarioPackage } from "../../tools/skills/package.js";
import { observationsOfStep, windowOf } from "../../tools/skills/fire-observations.js";
import { personsOf, unitTypeOf } from "../../tools/skills/units.js";
import { placeOnFront, stepByIndex, type FrontGeometry } from "../../tools/skills/window.js";
import type { EN } from "../../tools/skills/geo.js";

const pkg = buildScenarioPackage("test-version");
type Rec = Record<string, unknown>;
const cycles = (JSON.parse(pkg.files.get("ground_truth/cycles.json")!) as { cycles: Rec[] }).cycles;
const allObs = SITE_SCENARIO.steps.flatMap((s) => observationsOfStep(s.index, pkg.scenario.atoms));
const obsById = new Map(allObs.map((o) => [o.id, o]));
const ground = new Set(SITE_SCENARIO.units.map((u) => u.id));

describe("D2: one window per cycle", () => {
  it("names the step a measurement describes: the interval it names, else its own step", () => {
    expect(windowOf("DR1 mittaus: kärjen etenemä 140 m klo 14.20–14.40 (kahden kuvan vertailu)", 5)).toBe(4);
    expect(windowOf("DR1 lämpökuva, kärki klo 12.05: reuna etenee koilliseen", -3)).toBe(-3);
    expect(windowOf("EK12, Kuusimäki: reuna painuu itään, liekit 1–2 m", 5)).toBe(5);
  });

  it("pairs the rate with the head's fire type and flame band from records of the same 20 minutes", () => {
    let paired = 0;
    for (const c of cycles) {
      for (const id of c.fl_head_sources as string[]) {
        const o = obsById.get(id)!;
        expect(o, id).toBeDefined();
        expect(o.window, `cycle ${c.cycle}: ${id} describes step ${o.window}`).toBe(c.step);
        paired++;
      }
    }
    expect(paired).toBeGreaterThan(10);
  });

  it("takes the head's bearing over the window from the next step's observed head; null at rate 0 and without a later observation", () => {
    for (const c of cycles) {
      const next = stepByIndex((c.step as number) + 1);
      const moving = (c.ros_head_m_min as number) > 0 && next !== undefined && next.observedHead.rateMpm > 0;
      expect(c.head_bearing_deg, `cycle ${c.cycle}`).toBe(moving ? next!.observedHead.bearingDeg : null);
      if (c.ros_head_m_min === 0) expect(c.fire_type, `cycle ${c.cycle} is held`).toBeNull();
    }
    expect(cycles.find((c) => c.cycle === 20)!.head_bearing_deg).toBeNull();
    expect(cycles.find((c) => c.cycle === 0)!.head_bearing_deg).toBeNull();
  });

  it("dates a spot fire already on a step's report to the step that threw it", () => {
    for (const c of cycles) {
      const step = c.step as number;
      const spots = (id: string, timing: "own" | "before_report") => (SCENARIO_18_FORCING.find((f) => f.id === id)?.events ?? [])
        .filter((e) => e.kind === "ignite" && !e.rekindle && e.anchor === "head" && ((e.timing ?? "during_cycle") === "before_report") === (timing === "before_report"))
        .map((e) => (e as { distanceM: number }).distanceM);
      const expected = [...spots(String(step), "own"), ...spots(String(step + 1), "before_report")];
      expect(c.spotting_m, `cycle ${c.cycle}`).toBe(expected.length ? Math.max(...expected) : null);
    }
  });

  it("lists suspected smouldering ('voivat vielä kyteä') with the window's records, designed events included", () => {
    const suspected = cycles.flatMap((c) => (c.smouldering_spots as string[]).filter((x) => x.includes("(suspected)")).map((x) => [c.step, x] as const));
    expect(suspected.length).toBeGreaterThan(0);
    for (const [step, line] of suspected) {
      const id = line.split(" ")[1]!.replace(/:$/, "");
      expect(obsById.get(id)?.smoulder, line).toBe("suspected");
      expect(obsById.get(id)?.window).toBe(step);
    }
  });
});

describe("segments on the active front", () => {
  const g: FrontGeometry = {
    head: { endXy: [500_000, 6_701_000], startXy: [500_000, 6_700_800], bearingDeg: 0, axisDeg: 0, observedRateMpm: 10, observerId: "X", basis: "test" },
    active: { id: "US9", rings: [[[499_900, 6_700_000], [500_100, 6_700_000], [500_100, 6_701_000], [499_900, 6_701_000], [499_900, 6_700_000]]], origin: [500_000, 6_700_000] },
    parts: [],
    reportStep: 1,
  };
  const old = { id: "main", rings: [[[502_000, 6_700_000], [502_200, 6_700_000], [502_200, 6_700_200], [502_000, 6_700_200], [502_000, 6_700_000]]] as EN[][], origin: [502_100, 6_700_100] as EN };
  const geo: FrontGeometry = { ...g, parts: [g.active, old] };

  it("measures head, flanks and rear from the active front's origin and leaves other fire parts off it", () => {
    expect(placeOnFront([500_000, 6_701_500], geo)).toEqual({ segment: "head", front: "US9" });
    expect(placeOnFront([500_000, 6_699_800], geo)).toEqual({ segment: "rear", front: "US9" });
    expect(placeOnFront([500_200, 6_700_400], geo)).toEqual({ segment: "right_flank", front: "US9" });
    expect(placeOnFront([499_800, 6_700_400], geo)).toEqual({ segment: "left_flank", front: "US9" });
    expect(placeOnFront([502_100, 6_700_250], geo)).toEqual({ segment: null, front: "main" });
  });

  it("puts every flank and rear placement on the cycle's active front, and phase B on a rekindle front", () => {
    for (const c of cycles) {
      const active = (c.active_front as { id: string }).id;
      for (const p of c.placements as Rec[]) if (p.segment_id !== null && p.segment_id !== "head") expect(p.front, `cycle ${c.cycle} ${p.unit_id}`).toBe(active);
    }
    expect(cycles.some((c) => (c.active_front as { id: string }).id !== "main")).toBe(true);
    for (const c of cycles.filter((x) => (x.active_front as { id: string }).id !== "main")) {
      expect((c.barriers as Rec[]).some((b) => b.adjacent_segment === "rear"), `cycle ${c.cycle}: the old black anchors the rekindle's rear`).toBe(true);
    }
  });
});

describe("units: D5 crew sizes, D7 shift hours, D11 the wildland unit, aircraft exempt from LACES", () => {
  it("counts the roster's crew", () => {
    for (const id in UNIT_ROSTER) {
      const m = UNIT_ROSTER[id]!.crew?.match(/^(\d+)(?:\+(\d+))?/);
      expect(personsOf(id).persons, id).toBe(m ? Number(m[1]) + Number(m[2] ?? 0) : null);
    }
    for (const c of cycles) for (const u of c.units as Rec[]) if (UNIT_ROSTER[u.id as string]?.crew) expect(u.persons, `${u.id}`).not.toBeNull();
  });

  it("takes shift hours from the crew's own latest statement at or before the step, as stated", () => {
    let stated = 0;
    for (const c of cycles) for (const u of c.units as Rec[]) {
      if (u.hours_on_shift === null) continue;
      const rec = SITE_SCENARIO.traffic.find((t) => t.id === u.hours_on_shift_source)!;
      expect(rec.actor).toBe(u.id);
      expect(rec.cycle).toBeLessThanOrEqual(c.step as number);
      expect(rec.content).toContain(`kentällä ${String(u.hours_on_shift).replace(".", ",")}`);
      const later = SITE_SCENARIO.traffic.find((t) => t.actor === u.id && t.cycle <= (c.step as number) && t.sim_time_s > rec.sim_time_s && /[Mm]iehistö ollut kentällä/.test(t.content));
      expect(later, `${u.id} at cycle ${c.cycle}`).toBeUndefined();
      stated++;
    }
    expect(stated).toBeGreaterThan(100);
  });

  it("types the wildland unit as an equipment-class hose team, never unknown", () => {
    expect(unitTypeOf("Maastopaloyksikkö (maastoajoneuvo + perävaunu)")).toBe("hose_team");
    for (const c of cycles) for (const u of c.units as Rec[]) if (/^Maastopaloyksikkö/.test(u.type_fi as string)) expect(u.type).toBe("hose_team");
  });

  it("exempts aircraft from the LACES fields and gives every ground crew the CO-zone proxy", () => {
    for (const c of cycles) for (const p of c.placements as Rec[]) {
      if (ground.has(p.unit_id as string)) {
        expect([p.escape_route, p.safety_zone, p.comms, p.co_ppm, p.laces_exempt]).toEqual([null, null, null, null, undefined]);
        expect(["immediate_danger", "danger", "rescue_ops"]).toContain(p.zone);
        expect(p.zone_basis as string).toMatch(/^PROXY, no CO reading/);
        expect(p.downwind).toBe(p.zone === "immediate_danger");
      } else {
        expect(p.laces_exempt, `${p.unit_id}`).toBe(true);
        for (const k of ["escape_route", "safety_zone", "comms"]) expect(typeof p[k], `${p.unit_id} ${k}`).toBe("string");
        expect([p.zone, p.downwind]).toEqual([null, null]);
      }
    }
  });
});
