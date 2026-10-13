import { describe, expect, it } from "vitest";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { crewSafetyFindings, SAFETY_LINES } from "../../tools/validate/crew-safety.js";

describe("crew safety (review fixes (ah), 9 Oct 2026): no crew or vehicle near, in or cut off by the fire without a radio safety line", () => {
  it("every finding on the frozen bundle is explained by the unit's own record in that step", () => {
    const unexplained = crewSafetyFindings().filter((f) => !f.explainedBy);
    expect(unexplained.map((f) => `step ${f.step} ${f.unit} ${f.kind} ${f.what}`)).toEqual([]);
  });

  it("every safety line it names exists (no stale exemption)", () => {
    const used = new Set(crewSafetyFindings().map((f) => `${f.step}:${f.unit}`));
    for (const key of Object.keys(SAFETY_LINES)) expect(used.has(key), key).toBe(true);
  });

  it("flags a crew put inside the burning zone with no safety line", () => {
    const step = SITE_SCENARIO.steps.find((s) => s.index === 13)!;
    const ring = step.fire.burning_zone[0]![0]!;
    const inside = { lat: ring.reduce((a, p) => a + p.lat, 0) / ring.length, lon: ring.reduce((a, p) => a + p.lon, 0) / ring.length };
    const broken = { ...SITE_SCENARIO, steps: SITE_SCENARIO.steps.map((s) => (s.index === 13 ? { ...s, units: { ...s.units, TEST1: inside }, unitWork: { ...s.unitWork } } : s)) };
    const f = crewSafetyFindings(broken).filter((x) => x.unit === "TEST1");
    expect(f.length).toBeGreaterThan(0);
    expect(f.every((x) => x.explainedBy === null)).toBe(true);
  });
});
