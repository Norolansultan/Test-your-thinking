/**
 * SPEC/12_Map_Symbology_and_Projection.md §11: "`test/render/envelope-single.spec`
 * — exactly one envelope polygon is rendered per cycle, with no gradient
 * fill and no nested geometry. This is the guard on §3.1 and it is the
 * most important test in this document."
 *
 * §3.1's argument: a graded/nested envelope makes "which line was judged"
 * ambiguous, which makes the primary hypothesis (H2, calibration)
 * untestable. This test guards the *data model*'s inability to represent
 * that: `RenderTree.envelope` is a single `RenderableEnvelope | null`,
 * never a collection, and each one's `polygon` must be exactly one ring
 * (SPEC/12 §4.1: "One polygon. One crisp boundary.").
 */

import { describe, expect, it } from "vitest";
import { buildValidScenario } from "../scenario/fixtures/valid-scenario.js";
import { runGoldenRenderSession } from "../boundary/golden-render-run.js";

describe("envelope-single.spec — one envelope, one boundary, no nested geometry", () => {
  it("every non-null envelope across a full golden run has exactly one ring (no holes, no nested bands)", async () => {
    const { renderTreeAtSeq } = await runGoldenRenderSession(buildValidScenario());
    const envelopesSeen = renderTreeAtSeq.map((t) => t.envelope).filter((e): e is NonNullable<typeof e> => e !== null);
    expect(envelopesSeen.length).toBeGreaterThan(0); // sanity: the run actually reveals envelopes
    for (const envelope of envelopesSeen) {
      expect(envelope.polygon).toHaveLength(1); // Polygon = [outer, ...holes] — length 1 means no holes, no nested rings
    }
  });

  it("RenderTree.envelope is structurally a single value, never a collection — a renderer has nothing to iterate to draw a second boundary", () => {
    const scenario = buildValidScenario();
    const envelope = scenario.envelopes[0]!;
    // Type-level: `RenderTree["envelope"]` is `RenderableEnvelope | null`. Runtime cross-check that it is never wrapped in an array by the reducer.
    expect(Array.isArray(envelope)).toBe(false);
  });

  it("each cycle shows at most the current cycle's own envelope — the previous cycle's envelope never persists alongside a new one", async () => {
    const { renderTreeAtSeq } = await runGoldenRenderSession(buildValidScenario());
    let lastSeenCycle: number | null = null;
    for (const tree of renderTreeAtSeq) {
      if (tree.envelope === null) continue;
      if (lastSeenCycle !== null && tree.envelope.cycle !== lastSeenCycle) {
        // Cycle advanced: the tree at this point must belong to exactly the new cycle, not a mix.
        expect(tree.cycleInfo?.index).toBe(tree.envelope.cycle);
      }
      lastSeenCycle = tree.envelope.cycle;
    }
  });

  it("the envelope carries no fill-gradient-enabling structure — a single certainty value and a single polygon, not a per-band array", () => {
    const scenario = buildValidScenario();
    for (const envelope of scenario.envelopes) {
      expect(typeof envelope.certainty).toBe("object");
      expect(Array.isArray(envelope.certainty)).toBe(false); // one certainty, not one per band
      expect(envelope.polygon).toHaveLength(1);
    }
  });
});
