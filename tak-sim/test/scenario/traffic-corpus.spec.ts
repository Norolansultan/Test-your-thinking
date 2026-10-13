/**
 * SPEC/18 revision (n): the incident's traffic corpus. Guards its shape (flat, queryable log
 * records), the water drone's timing, the heavy start, and that the corpus is the same for every
 * participant (built once, seeded, frozen in site-scenario.json). SPEC/26 §6: every event keeps its
 * step and real time, carries its view, and a merged view's first-step pushed items are recorded,
 * not pushed.
 */

import { describe, expect, it } from "vitest";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { LOAD_BEARING_T4_IDS } from "../../app/scenario/types.js";
import { viewOfStep } from "../../app/scenario/views.js";

const FIELDS = ["id", "cycle", "session_view", "sim_time_s", "timestamp", "actor", "actor_type", "addressee", "location", "place", "lat", "lon", "event_type", "task", "content", "tier", "channel", "nav", "lang"];

describe("traffic corpus (SPEC/18 revision (n))", () => {
  it("is a flat log: every event has exactly the schema's fields, all scalars, and a unique id", () => {
    const ids = new Set<string>();
    for (const e of SITE_SCENARIO.traffic) {
      expect(Object.keys(e).sort()).toEqual([...FIELDS].sort());
      for (const v of Object.values(e)) expect(v === null || ["string", "number"].includes(typeof v)).toBe(true);
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
      expect(e.timestamp).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      expect(e.sim_time_s).toBeGreaterThanOrEqual((e.cycle - 1) * 1200);
      expect(e.sim_time_s).toBeLessThan(e.cycle * 1200);
    }
  });

  // 692 before SPEC/26 §5's rekindle moves; 696 with them. The revision of 1 Oct 2026 (drone
  // products, water supply, lateral traffic, requests) grows it; the exact count follows the CA
  // run, so it is held to a band (the whole log, with authored items, stays within 900–1300).
  it("keeps every event with its real timestamp, each in the view of its step (SPEC/26 §6)", () => {
    expect(SITE_SCENARIO.traffic.length).toBeGreaterThanOrEqual(780);
    expect(SITE_SCENARIO.traffic.length).toBeLessThanOrEqual(1200);
    for (const e of SITE_SCENARIO.traffic) expect(e.session_view).toBe(viewOfStep(e.cycle)?.index ?? null);
  });

  it("records, not pushes, a merged view's first-step items; the second step's stay pushed", () => {
    for (const e of SITE_SCENARIO.traffic) {
      const v = viewOfStep(e.cycle)!;
      if (v.steps.length === 2 && v.steps[0] === e.cycle) expect(e.tier, e.id).not.toBe("T1_pushed");
    }
    const pushedInSecondSteps = SITE_SCENARIO.traffic.filter((e) => { const v = viewOfStep(e.cycle)!; return v.steps.length === 2 && v.steps[1] === e.cycle && e.tier === "T1_pushed"; });
    expect(pushedInSecondSteps.length).toBeGreaterThan(0);
    // The load-bearing items are authored T4 atoms, never part of the generated corpus, so none can be demoted.
    for (const id of LOAD_BEARING_T4_IDS) expect(SITE_SCENARIO.traffic.some((e) => e.id === id)).toBe(false);
  });

  it("brings the water drone only with the reinforcements (step 11 on)", () => {
    const vd = SITE_SCENARIO.traffic.filter((e) => e.actor === "VD1");
    expect(vd.length).toBeGreaterThan(0);
    expect(Math.min(...vd.map((e) => e.cycle))).toBe(11);
    for (const c of SITE_SCENARIO.steps) expect(c.aircraft.some((a) => a.platformId === "VD1")).toBe(c.index >= 11 && c.index <= 19);
  });

  it("is heaviest at the start: the first crew's size-up comes in the first minutes of step 1", () => {
    const early = SITE_SCENARIO.traffic.filter((e) => e.cycle === 1 && e.tier === "T1_pushed");
    expect(early.filter((e) => e.event_type === "size_up").length).toBeGreaterThanOrEqual(5);
    expect(Math.min(...early.map((e) => e.sim_time_s))).toBeLessThan(60);
  });

  it("puts every event into the scenario as an atom with the same id and tier, and builds identically every time", () => {
    const a = buildDemoScenario(), b = buildDemoScenario();
    const byId = new Map(a.atoms.map((x) => [x.id, x]));
    for (const e of SITE_SCENARIO.traffic) expect(byId.get(e.id)?.tier).toBe(e.tier);
    expect(JSON.stringify(a.atoms)).toBe(JSON.stringify(b.atoms));
  });
});
