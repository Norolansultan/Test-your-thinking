/**
 * EXCON (SPEC/28 §8) — the CoT tab shows exactly the TAK pipeline's stream for the participant's picture:
 * the same events `npm run tak:export` compiles for each view step (by uid), and no truth in any of them.
 */

import { describe, expect, it } from "vitest";
import { assertNoTruthKeysPresent } from "../../app/boundary/render-boundary.js";
import { cotEventsForStep, cotRowsForView } from "../../app/excon/cot-hook.js";
import { buildExconWorld } from "../../app/excon/world.js";
import { compileViewCot } from "../../app/tak/compile.js";
import { sessionCotInputs } from "../../tools/tak/export.js";

const world = buildExconWorld();
const TRUTH_NAMES = ["flag", "breachGeometry", "isOmissionCycle", "actualPerimeterAtEnd", "consistentWithEnvelope", "whatWasHappening", "accuracy_label", "isGroundTruth", "isDecoy"];

describe("EXCON CoT tab", () => {
  const exported = sessionCotInputs(world.scenario);

  it("compiles the same CoT events as tak:export for every view step (one input per timeline step)", () => {
    expect(exported).toHaveLength(world.timeline.length);
    world.timeline.forEach((t, i) => {
      const mine = cotEventsForStep(world, t.viewIndex, t.stepShown).map((e) => e.uid);
      const theirs = compileViewCot(exported[i]!).map((e) => e.uid);
      expect(mine, `${t.viewId} step ${t.stepShown}`).toEqual(theirs);
    });
  });

  it("carries no truth: no truth key in any event and no truth field name in the XML", () => {
    for (const t of world.timeline) {
      const result = cotRowsForView(world, t.viewIndex, t.stepShown);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") continue;
      expect(result.rows.length).toBeGreaterThan(0);
      for (const e of cotEventsForStep(world, t.viewIndex, t.stepShown)) expect(() => assertNoTruthKeysPresent(e)).not.toThrow();
      const xml = result.rows.map((r) => r.xml).join("\n");
      for (const name of TRUTH_NAMES) expect(xml.includes(name), `${name} in ${t.viewId}`).toBe(false);
    }
  });
});
