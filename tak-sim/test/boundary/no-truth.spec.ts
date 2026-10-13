/**
 * M3 acceptance test (SPEC/10_Build_Plan_and_Acceptance.md, M3):
 * "`test/boundary/no-truth.spec` walks the live render tree at every
 * logged `seq` of a golden run and asserts no reachable object contains
 * any `TruthAnnotation` key."
 *
 * Scope note for this milestone (see also `render-tree.ts`'s header):
 * this checks the render *tree* — the data a map component would draw
 * from — not an actual rendered DOM/canvas via MapLibre. Building that
 * needs real geographic tile data (PMTiles) through `tools/bundle/` (not
 * built — it is the only module permitted outbound network access, a
 * separate and substantial task involving real licensed data fetches)
 * and a browser/WebGL test harness this session has not set up. The tree
 * this test walks is exactly what SPEC/10 M3 describes checking, and is
 * the part of "the render boundary" I4 is actually about — a real
 * MapLibre layer reading from a truth-free tree cannot itself leak truth
 * either, so this is the load-bearing half of the guard.
 */

import { describe, expect, it } from "vitest";
import { assertNoTruthKeysPresent, TruthLeakError } from "../../app/boundary/render-boundary.js";
import { buildValidScenario } from "../scenario/fixtures/valid-scenario.js";
import { runGoldenRenderSession } from "./golden-render-run.js";

describe("no-truth.spec — walks the live render tree at every logged seq of a golden run", () => {
  it("produces a non-trivial golden run to walk (sanity: the test isn't vacuously passing over zero records)", async () => {
    const { records } = await runGoldenRenderSession(buildValidScenario());
    expect(records.length).toBeGreaterThan(100); // 5 boot transitions + 14x(cycle_start + atoms + envelope) + extras + handoff
  });

  it("no render tree snapshot at any logged seq contains a TruthAnnotation key", async () => {
    const { records, renderTreeAtSeq } = await runGoldenRenderSession(buildValidScenario());
    for (const record of records) {
      const tree = renderTreeAtSeq[record.seq];
      expect(tree).toBeDefined();
      expect(() => assertNoTruthKeysPresent(tree)).not.toThrow();
    }
  });

  it("the walk actually reaches a populated tree (bubbles, envelope, correction and allocation all appear at some point) — proving the walk isn't checking an empty tree throughout", async () => {
    const { renderTreeAtSeq } = await runGoldenRenderSession(buildValidScenario());
    const last = renderTreeAtSeq[renderTreeAtSeq.length - 1]!;
    const everHadBubbles = renderTreeAtSeq.some((t) => t.bubbles.length > 0);
    const everHadEnvelope = renderTreeAtSeq.some((t) => t.envelope !== null);
    const everHadCorrection = renderTreeAtSeq.some((t) => t.correction !== null);
    const everHadAllocation = renderTreeAtSeq.some((t) => t.allocationMarks.length > 0);
    expect(everHadBubbles).toBe(true);
    expect(everHadEnvelope).toBe(true);
    expect(everHadCorrection).toBe(true);
    expect(everHadAllocation).toBe(true);
    expect(last.cycleInfo?.index).toBe(14); // SPEC/26: the last main view is V14
  });

  it("negative control: this walk would in fact catch a leak — a render tree with truth smuggled in fails the same assertion", async () => {
    const { renderTreeAtSeq } = await runGoldenRenderSession(buildValidScenario());
    const realTree = renderTreeAtSeq[renderTreeAtSeq.length - 1]!;
    const corrupted = { ...realTree, envelope: { ...realTree.envelope, isGroundTruth: true } };
    expect(() => assertNoTruthKeysPresent(corrupted)).toThrow(TruthLeakError);
  });

  it("seq stays gapless across the whole golden run (I5), which is what makes 'every logged seq' a well-defined walk", async () => {
    const { records } = await runGoldenRenderSession(buildValidScenario());
    records.forEach((r, i) => expect(r.seq).toBe(i));
  });
});
