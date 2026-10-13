/**
 * The frozen incident on the generated site (`app/scenario/site-scenario.json`, SPEC/24 §9) and
 * the demo scenario built on it. Guards the design decisions in SPEC/18 §8.3 and SPEC/12 §9
 * against a regenerated bundle silently changing them. Since SPEC/26 the bundle carries world-state
 * STEPS (W2 for practice, and 1–20) and the session's VIEWS (VP and V1–V14); `test/scenario/views.spec.ts` checks
 * the view table itself.
 */

import { describe, expect, it } from "vitest";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { UNIT_PLAN } from "../../tools/fire-ca/deployment.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { validateScenario } from "../../app/scenario/validator.js";
import { CANONICAL_FLAG_SEQUENCE } from "../../app/scenario/types.js";
import siteMeta from "../../app/scenario/site-meta.json" with { type: "json" };

const inside = (p: { lat: number; lon: number }, e: { south: number; north: number; west: number; east: number }) =>
  p.lat >= e.south && p.lat <= e.north && p.lon >= e.west && p.lon <= e.east;
const step = (n: number) => SITE_SCENARIO.steps.find((s) => s.index === n)!;
const mainViews = SITE_SCENARIO.views.filter((v) => !v.practice);

describe("site-scenario.json", () => {
  it("covers the practice step W2 and steps 1–20, and views VP and V1–V14", () => {
    expect(SITE_SCENARIO.steps.map((c) => c.index)).toEqual([-3, ...Array.from({ length: 20 }, (_, i) => i + 1)]);
    expect(SITE_SCENARIO.steps[0]!.id).toBe("W2");
    expect(SITE_SCENARIO.views.map((v) => v.id)).toEqual(["VP", ...Array.from({ length: 14 }, (_, i) => `V${i + 1}`)]);
  });

  it("derives every main view's flag from its own envelope, matching SPEC/26 §3 exactly", () => {
    expect(mainViews.map((v) => v.expectedFlag)).toEqual([...CANONICAL_FLAG_SEQUENCE]);
    expect(mainViews.map((v) => v.derivedFlag)).toEqual([...CANONICAL_FLAG_SEQUENCE]);
    expect(SITE_SCENARIO.flagMatches).toBe(14);
    expect(SITE_SCENARIO.views[0]!.expectedFlag).toBeNull(); // the practice view is not checked
  });

  it("projects a merged view to the end of its second step, with isochrones at ½ and 1 of the horizon (the next situation, 2 Oct 2026)", () => {
    for (const v of SITE_SCENARIO.views) {
      const h = v.steps.length * 20;
      expect(v.horizonMinutes).toBe(h);
      expect(v.isochrones.map((i) => i.minutes)).toEqual([h / 2, h]);
      expect(v.isochrones[1]!.polygon).toEqual(v.envelope);
      expect(v.projectionBands.map((b) => `${b.fromMinutes}-${b.toMinutes}`)).toEqual([`0-${h / 2}`, `${h / 2}-${h}`]);
    }
    const v2 = SITE_SCENARIO.views.find((v) => v.id === "V2")!;
    expect([v2.clock, v2.horizonClock]).toEqual(["13:40", "14:20"]);
    expect(v2.truthAtEnd).toEqual(step(3).truthAtEnd); // truth at the end of the LAST step
  });

  it("assumes the mean of its steps' authored envelope rates in a merged view", () => {
    for (const v of SITE_SCENARIO.views) {
      const rates = v.steps.map((n) => step(n).headRos.envelopeMpm);
      expect(v.envelopeRosMpm).toBeCloseTo(rates.reduce((a, b) => a + b, 0) / rates.length, 9);
    }
  });

  it("is placed on the generated basemap, at its ignition point", () => {
    expect(SITE_SCENARIO.ignition.lat).toBeCloseTo(siteMeta.ignitionWgs84.lat, 4);
    expect(SITE_SCENARIO.ignition.lon).toBeCloseTo(siteMeta.ignitionWgs84.lon, 4);
  });

  it("keeps the fire, every unit and every aircraft inside the scenario extent", () => {
    for (const c of SITE_SCENARIO.steps) {
      for (const ring of [c.reported, c.truthAtEnd, ...c.reportedDetached, ...c.truthDetached]) {
        for (const p of ring[0]!) expect(inside(p, SITE_SCENARIO.extent)).toBe(true);
      }
      for (const p of Object.values(c.units)) expect(inside(p, SITE_SCENARIO.extent)).toBe(true);
      for (const a of c.aircraft) expect(inside(a.position, SITE_SCENARIO.extent)).toBe(true);
    }
    for (const v of SITE_SCENARIO.views) {
      for (const ring of [v.envelope, ...v.envelopeDetached]) for (const p of ring[0]!) expect(inside(p, SITE_SCENARIO.extent)).toBe(true);
    }
  });

  it("puts SPEC/18 §8.2's W2 units on the practice map: EK11 at the head by R1, VPK on L4, DR1 up; a small fire", () => {
    expect(Object.keys(step(-3).units).sort()).toEqual(["EK11", "VPK"]);
    expect(step(-3).aircraft.map((a) => a.platformId)).toEqual(["DR1"]);
    expect(step(-3).areaHa).toBeLessThan(2);
  });

  it("grounds DR1 and DR3 in step 8 and has no drone up in step 9 (SPEC/18 §8.2, SPEC/12 §9)", () => {
    const drones = (i: number) => step(i).aircraft.filter((a) => a.kind === "drone").map((a) => a.platformId);
    expect(drones(8)).toEqual(["DR2"]);
    expect(drones(9)).toEqual([]);
  });

  it("the step-12 omission (V9) is hidden when reported and present at the horizon", () => {
    const v9 = SITE_SCENARIO.views.find((v) => v.id === "V9")!;
    expect(v9.steps).toEqual([12]);
    expect(step(12).reportedDetached).toEqual([]);
    expect(v9.truthDetached.length).toBeGreaterThan(0);
    expect(step(13).reportedDetached.length).toBeGreaterThan(0); // reported from step 13
  });

  it("moves no unit more than 450 m between steps unless it says why on the radio (SPEC/18 revision (l))", () => {
    const k = 111_320;
    const kx = k * Math.cos((SITE_SCENARIO.ignition.lat * Math.PI) / 180);
    const dist = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => Math.hypot((a.lat - b.lat) * k, (a.lon - b.lon) * kx);
    const unexplained: string[] = [];
    for (let i = 2; i <= 20; i++) {
      const before = step(i - 1).units;
      const now = step(i);
      for (const [id, p] of Object.entries(now.units)) {
        const q = before[id];
        if (!q || dist(p, q) <= 450) continue;
        // The water shuttle (fix pass 2, 7 Oct 2026) drives between the water points and the lines; its runs are logged by the water supply.
        if (UNIT_PLAN[id]?.shuttle) { expect(SITE_SCENARIO.traffic.some((e) => e.cycle >= now.index - 1 && e.cycle <= now.index && e.actor === "VESIHUOLTO" && e.content.includes(id)), `${id} step ${now.index}`).toBe(true); continue; }
        // A move radioed in a stale step (deployment.ts `stale`: the map kept the old place, A3) shows on the next step's map.
        const stale = !!UNIT_PLAN[id]?.stale?.includes(now.index - 1);
        const said = SITE_SCENARIO.radio.some((r) => (r.cycle === now.index || (stale && r.cycle === now.index - 1)) && r.kind === "move" && r.from === id);
        if (!said) unexplained.push(`${id} step ${now.index}: ${Math.round(dist(p, q))} m`);
      }
    }
    expect(unexplained).toEqual([]);
  });

  it("reports on the radio where the fire crossed a road or brook, where one stopped it, and where a crew held it", () => {
    const kinds = new Set(SITE_SCENARIO.radio.map((r) => r.kind));
    expect([...kinds].sort()).toEqual(["crossing", "hold", "move", "stopped"]);
    for (const r of SITE_SCENARIO.radio.filter((x) => x.kind === "crossing")) expect(r.text).toMatch(/yli/);
  });

  it("places each radio message in its step's view, the second step's in the second half", () => {
    for (const r of SITE_SCENARIO.radio) {
      const v = SITE_SCENARIO.views.find((x) => x.index === r.view)!;
      expect(v.steps).toContain(r.cycle);
      const firstHalf = r.cycle === v.steps[0];
      expect(r.atOffsetS >= 1200).toBe(!firstHalf);
      expect(r.atOffsetS).toBeLessThan(v.steps.length * 1200);
    }
  });

  it("carries SPEC/18 §6's wind: backing through south at step 9, north-westerly from step 16", () => {
    expect(step(1).wind.fromDeg).toBe(230);
    // Review fixes (ah), 9 Oct 2026: the backing comes at 15:40 (SSE 165) and reaches SE 140 at 16:00 (was S–SE 160), so the fire follows the meter.
    expect(step(8).wind.fromDeg).toBe(165);
    expect(step(9).wind.fromDeg).toBe(140);
    expect(step(12).wind.fromDeg).toBe(285); // the front has passed: west-north-west from 17:00 (was SW 240)
    for (let i = 16; i <= 20; i++) expect(step(i).wind.fromDeg).toBeGreaterThanOrEqual(310);
  });
});

describe("demo scenario on the site bundle", () => {
  const scenario = buildDemoScenario();

  it("validates", () => {
    expect(validateScenario(scenario).failures).toEqual([]);
  });

  it("has fourteen main views over steps 1–20 and a practice view at W2 (SPEC/26 §3, amended 1 Oct 2026)", () => {
    expect(scenario.cycles.map((c) => c.steps)).toEqual(mainViews.map((v) => v.steps.length));
    expect(scenario.practice.cycle.startsAtVirtual).toBe(-4800);
    expect(scenario.practice.cycle.clockLabel).toBe("12:00");
    expect(scenario.hinge.afterCycle).toBe(7);
  });

  it("shows wind as direction and mean only, observed at the view start", () => {
    for (const c of scenario.cycles) {
      expect(Object.keys(c.wind).sort()).toEqual(["fromDeg", "meanMs", "observedAt", "sourceFi"]);
      expect(c.wind.observedAt).toBe(c.startsAtVirtual);
    }
  });

  it("follows SPEC/12 §9's rate marks: two disagreeing north-flank marks in V13 (step 18)", () => {
    const north = scenario.cycles.find((c) => c.index === 13)!.rateMarks.filter((m) => m.flank === "north");
    expect(north.map((m) => m.provenance.sourceId).sort()).toEqual(["EK14", "SPOT"]);
    expect(north[0]!.rateMetresPerMinute).not.toBe(north[1]!.rateMetresPerMinute);
  });

  it("pushes every pushed radio message to the log in its view, and records the rest", () => {
    for (const r of SITE_SCENARIO.radio) {
      const view = scenario.cycles.find((c) => c.index === r.view)!;
      const texts = view.pushedAtomIds.map((id) => scenario.atoms.find((a) => a.id === id)!.record).map((rec) => (rec.kind === "situation_log" ? rec.text : ""));
      if (r.pushed) expect(texts).toContain(r.text);
      else expect(texts).not.toContain(r.text);
    }
  });

  it("marks exactly one correct option on every choice freeze item (a map_point item has none)", () => {
    for (const f of scenario.freezes) for (const item of f.items) expect(item.options.filter((o) => o.correct)).toHaveLength(item.kind === "map_point" ? 0 : 1);
  });
});
