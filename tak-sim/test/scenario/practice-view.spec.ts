/**
 * The practice view at W2 (researcher decision 1 Oct 2026): a small fire, a thorough starting
 * picture the participant can try the message log and Haku on, identical for everyone, and no cue
 * to any designed event.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { navigate, navigationNow, NAV_CATEGORIES } from "../../app/retrieval/navigation.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { PRACTICE_STEP, PRACTICE_VIEW_INDEX } from "../../app/scenario/views.js";

const scenario = buildDemoScenario();
const practice = SITE_SCENARIO.traffic.filter((e) => e.session_view === PRACTICE_VIEW_INDEX);

describe("the practice view's starting picture (W2, 12:00–12:20)", () => {
  it("is a small fire: under 2 ha on the map", () => {
    expect(SITE_SCENARIO.steps.find((s) => s.index === PRACTICE_STEP)!.areaHa).toBeLessThan(2);
  });

  it("pushes 10–15 messages and records a few more lines, all inside the step", () => {
    const pushed = practice.filter((e) => e.tier === "T1_pushed");
    expect(pushed.length).toBeGreaterThanOrEqual(10);
    expect(pushed.length).toBeLessThanOrEqual(15);
    expect(practice.length - pushed.length).toBeGreaterThanOrEqual(5);
    for (const e of practice) expect(e.timestamp >= "12:00:00" && e.timestamp < "12:20:00", e.id).toBe(true);
  });

  it("gives every Haku category (MITÄ) at least one result in the practice view", () => {
    const corpus = reachableAtoms(scenario.atoms, PRACTICE_STEP);
    for (const c of NAV_CATEGORIES) {
      expect(navigate({ category: c.id, sourceId: null, window: "whole_incident" }, corpus, navigationNow(PRACTICE_STEP)).length, c.id).toBeGreaterThan(0);
    }
  });

  it("names no designed event: not the bog, the power line, smouldering or the rekindle", () => {
    for (const e of practice) expect(e.content, e.id).not.toMatch(/Rahkasuo|suo\b|turve|kyt|voimajoh|110 ?kV|jännit|linja jännit|Kuusimä/i);
  });

  it("stays searchable later, as incident history", () => {
    const later = reachableAtoms(scenario.atoms, 7).map((a) => a.id);
    for (const e of practice) expect(later, e.id).toContain(e.id);
  });
});
