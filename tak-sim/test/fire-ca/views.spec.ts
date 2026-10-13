/**
 * SPEC/26 §3, SPEC/24 revision (p) — views from step spans on the CA: the run keeps its steps; a
 * single-step view is the step's own projection, unchanged; a merged view reports at the start of
 * its first step, projects to the end of its second with each step's machine inputs, and is judged
 * against the truth then; authored categorical bases carry over to the view.
 */

import { describe, expect, it } from "vitest";
import type { SessionView } from "../../app/scenario/views.js";
import { DEFAULT_RUN_OPTIONS, runScenario, type CycleForcing } from "../../tools/fire-ca/run.js";
import { buildTemplateSite } from "../../tools/fire-ca/template-site.js";
import { buildViews } from "../../tools/fire-ca/views.js";

const site = buildTemplateSite(50, 6000); // coarse, for speed
const opts = { ...DEFAULT_RUN_OPTIONS, seed: 20080101n, scenarioId: "test", ensembleSize: 8 };

const steady = (id: string, ros: number, envRos = ros, extra: Partial<CycleForcing> = {}): CycleForcing => ({
  id, clock: "00:00", windFromDeg: 225, meanMs: 6, gustMs: 9, headRosActualMpm: ros, headRosEnvelopeMpm: envRos, expectedFlag: "holds", ...extra,
});
const view = (index: number, steps: number[], flag: SessionView["flag"] = null): SessionView =>
  ({ index, id: `V${index}`, steps, practice: false, phase: "A", flag });
const count = (m: Uint8Array) => m.reduce((n, v) => n + v, 0);

const forcing = [steady("1", 6), steady("2", 6), steady("3", 8, 4, { categoricalBasis: "mechanism" })];
const result = runScenario(site, forcing, opts);

describe("buildViews", () => {
  it("leaves a single-step view's envelope and isochrones exactly as the step's own", () => {
    const [v1] = buildViews(site, forcing, result, opts, [view(1, [1])]);
    const c = result.cycles[0]!;
    expect(v1!.horizonMinutes).toBe(20);
    expect(v1!.envelope).toEqual(c.envelope);
    expect(v1!.isochrones).toEqual(c.isochrones);
    expect(v1!.derived).toEqual(c.derived);
  });

  it("reports a merged view at its first step's start, projects 40 minutes, and judges it at its last step's end", () => {
    const [v] = buildViews(site, forcing, result, opts, [view(2, [2, 3])]);
    expect(v!.stepIds).toEqual(["2", "3"]);
    expect(v!.horizonMinutes).toBe(40);
    expect(v!.isochrones.map((i) => i.minutes)).toEqual([20, 40]);
    expect(v!.masks.reported).toEqual(result.cycles[1]!.masks.reported);
    expect(v!.masks.truthAtEnd).toEqual(result.cycles[2]!.masks.truthAtEnd);
    expect(v!.envelopeAssumedRosMpm).toBe(5); // mean of the authored 6 and 4
    // Forty minutes of projection reach further than the first step's own twenty.
    expect(count(v!.masks.envelope)).toBeGreaterThan(count(result.cycles[1]!.masks.envelope));
  });

  it("carries an authored categorical basis over to the view containing its step", () => {
    const [v] = buildViews(site, forcing, result, opts, [view(2, [2, 3])]);
    expect(v!.basis).toBe("mechanism");
    expect(v!.derived.flag).not.toBe("breach_quantitative"); // a mechanism change is never read as merely "further"
  });

  it("is deterministic", () => {
    const a = buildViews(site, forcing, result, opts, [view(2, [2, 3])]);
    const b = buildViews(site, forcing, result, opts, [view(2, [2, 3])]);
    expect(a[0]!.masks.envelope).toEqual(b[0]!.masks.envelope);
  });

  it("marks a view matching only when its derived flag is the expected one; the practice view always matches", () => {
    const [practice, wrong] = buildViews(site, forcing, result, opts, [{ ...view(0, [1]), practice: true, phase: null }, view(1, [1], "breach_categorical")]);
    expect(practice!.matches).toBe(true);
    expect(wrong!.matches).toBe(wrong!.derived.flag === "breach_categorical");
  });
});
