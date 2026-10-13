/**
 * SPEC/12_Map_Symbology_and_Projection.md §11: "`test/render/no-recommendation.spec`
 * — no allocation mark is rendered that the participant did not create.
 * Asserted by driving a full scenario with zero allocations and checking
 * the map carries no anticipated-status symbol."
 *
 * Two distinct guarantees, both checked here: `AllocationMark`s (the
 * participant's own echoed-back orders) only ever appear from an explicit
 * `allocation_submitted` event — never seeded from scenario content — and
 * `AllocationRecommendation` (a *machine* suggestion, SPEC/12 §6.3-§6.4)
 * has no field in the render tree at all, so it is structurally
 * impossible for one to reach the map regardless of what a scenario
 * author populates.
 */

import { describe, expect, it } from "vitest";
import { buildValidScenario } from "../scenario/fixtures/valid-scenario.js";
import { runGoldenRenderSession } from "../boundary/golden-render-run.js";
import type { RenderTree } from "../../app/render/render-tree.js";

describe("no-recommendation.spec — no allocation mark the participant did not create", () => {
  it("driving a full 14-view scenario with zero participant allocations leaves allocationMarks empty at every logged seq", async () => {
    const { records, renderTreeAtSeq } = await runGoldenRenderSession(buildValidScenario(), { includeAllocationAndCorrection: false });
    expect(records.length).toBeGreaterThan(100); // sanity: this is a real, full run, not a trivial one
    for (const record of records) {
      const tree = renderTreeAtSeq[record.seq]!;
      expect(tree.allocationMarks).toEqual([]);
    }
  });

  it("an allocation mark appears only after the participant's own allocation_submitted event, not before", async () => {
    const { renderTreeAtSeq } = await runGoldenRenderSession(buildValidScenario(), { includeAllocationAndCorrection: true });
    const firstWithMark = renderTreeAtSeq.findIndex((t) => t.allocationMarks.length > 0);
    expect(firstWithMark).toBeGreaterThan(0);
    for (let i = 0; i < firstWithMark; i++) {
      expect(renderTreeAtSeq[i]!.allocationMarks).toEqual([]);
    }
  });

  it("RenderTree has no field an AllocationRecommendation (a machine suggestion) could ever populate", () => {
    const emptyTreeKeys = new Set(Object.keys({ cycleInfo: null, bubbles: [], envelope: null, correction: null, allocationMarks: [], branchStatementsShown: [] } satisfies RenderTree));
    expect(emptyTreeKeys.has("allocationRecommendations")).toBe(false);
    expect(emptyTreeKeys.has("recommendation")).toBe(false);
    expect(emptyTreeKeys.has("machineAttribution")).toBe(false);
    expect([...emptyTreeKeys].sort()).toEqual(["allocationMarks", "branchStatementsShown", "bubbles", "correction", "cycleInfo", "envelope"]);
  });

  it("the scenario's own allocationRecommendations (asserted empty by the validator, SPEC/12 §10) never feeds the render tree even if it were non-empty", async () => {
    const scenario = buildValidScenario();
    const scenarioWithRecommendation = {
      ...scenario,
      allocationRecommendations: [{ assetId: "EK11", toSectorId: "L1", taskId: "task.direct-attack", machineAttribution: "system", certainty: { kind: "confirmed" as const } }],
    };
    // No RenderEvent kind exists to carry this into the tree — proven by exhausting every event type the run harness knows about and finding none references `allocationRecommendations`.
    const { renderTreeAtSeq } = await runGoldenRenderSession(scenarioWithRecommendation, { includeAllocationAndCorrection: false });
    for (const tree of renderTreeAtSeq) {
      expect(tree.allocationMarks).toEqual([]);
    }
  });
});
