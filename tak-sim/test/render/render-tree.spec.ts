import { describe, expect, it } from "vitest";
import { applyRenderEvent, EMPTY_RENDER_TREE, renderTreeTimeline, type RenderEvent } from "../../app/render/render-tree.js";
import { buildValidScenario } from "../scenario/fixtures/valid-scenario.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { siteStep } from "../../app/scenario/freeze-keys.js";

const scenario = buildValidScenario();
const cycle1 = scenario.cycles.find((c) => c.index === 1)!;
const cycle2 = scenario.cycles.find((c) => c.index === 2)!;
const envelope1 = scenario.envelopes.find((e) => e.cycle === 1)!;
const atom = scenario.atoms[0]!;

describe("applyRenderEvent", () => {
  it("cycle_start populates cycleInfo and resets everything else", () => {
    const tree = applyRenderEvent(EMPTY_RENDER_TREE, { kind: "cycle_start", cycle: cycle1 });
    expect(tree.cycleInfo?.index).toBe(1);
    expect(tree.bubbles).toEqual([]);
    expect(tree.envelope).toBeNull();
    expect(tree.correction).toBeNull();
    expect(tree.allocationMarks).toEqual([]);
    expect(tree.branchStatementsShown).toEqual([]);
  });

  it("bubble_delivered appends a renderable atom", () => {
    let tree = applyRenderEvent(EMPTY_RENDER_TREE, { kind: "cycle_start", cycle: cycle1 });
    tree = applyRenderEvent(tree, { kind: "bubble_delivered", atom });
    expect(tree.bubbles).toHaveLength(1);
    expect(tree.bubbles[0]!.id).toBe(atom.id);
  });

  it("envelope_revealed sets a renderable envelope", () => {
    const tree = applyRenderEvent(EMPTY_RENDER_TREE, { kind: "envelope_revealed", envelope: envelope1 });
    expect(tree.envelope?.cycle).toBe(1);
  });

  it("allocation_submitted replaces allocationMarks", () => {
    const marks = [{ assetId: "EK11", fromPosition: { lat: 60.8, lon: 27.0 }, toSectorId: "L1", taskId: "task.direct-attack", assignedAtCycle: 1 as const }];
    const tree = applyRenderEvent(EMPTY_RENDER_TREE, { kind: "allocation_submitted", marks });
    expect(tree.allocationMarks).toEqual(marks);
  });

  it("a new cycle_start clears bubbles, envelope and allocation marks from the previous cycle — nothing leaks forward", () => {
    let tree = applyRenderEvent(EMPTY_RENDER_TREE, { kind: "cycle_start", cycle: cycle1 });
    tree = applyRenderEvent(tree, { kind: "bubble_delivered", atom });
    tree = applyRenderEvent(tree, { kind: "envelope_revealed", envelope: envelope1 });
    tree = applyRenderEvent(tree, {
      kind: "allocation_submitted",
      marks: [{ assetId: "EK11", fromPosition: { lat: 60.8, lon: 27.0 }, toSectorId: "L1", taskId: "task.direct-attack", assignedAtCycle: 1 }],
    });
    expect(tree.bubbles).toHaveLength(1);

    tree = applyRenderEvent(tree, { kind: "cycle_start", cycle: cycle2 });
    expect(tree.cycleInfo?.index).toBe(2);
    expect(tree.bubbles).toEqual([]);
    expect(tree.envelope).toBeNull();
    expect(tree.allocationMarks).toEqual([]);
  });

  it("does not mutate the input tree (each call returns a new object)", () => {
    const before = EMPTY_RENDER_TREE;
    const after = applyRenderEvent(before, { kind: "cycle_start", cycle: cycle1 });
    expect(after).not.toBe(before);
    expect(before.cycleInfo).toBeNull(); // unchanged
  });
});

describe("renderTreeTimeline", () => {
  it("returns one tree snapshot per event, in order", () => {
    const events: RenderEvent[] = [
      { kind: "cycle_start", cycle: cycle1 },
      { kind: "bubble_delivered", atom },
      { kind: "envelope_revealed", envelope: envelope1 },
    ];
    const timeline = renderTreeTimeline(events);
    expect(timeline).toHaveLength(3);
    expect(timeline[0]!.cycleInfo?.index).toBe(1);
    expect(timeline[1]!.bubbles).toHaveLength(1);
    expect(timeline[2]!.envelope?.cycle).toBe(1);
  });

  it("is a pure function of the event sequence", () => {
    const events: RenderEvent[] = [{ kind: "cycle_start", cycle: cycle1 }, { kind: "bubble_delivered", atom }];
    const a = renderTreeTimeline(events);
    const b = renderTreeTimeline(events);
    expect(a).toEqual(b);
  });
});

describe("a merged view's rate marks at its step boundary (SPEC/12 §9; systems review F6, 7 Oct 2026)", () => {
  const demo = buildDemoScenario();
  const atBoundary = (index: number) => {
    const view = demo.cycles.find((c) => c.index === index)!;
    const first = applyRenderEvent(EMPTY_RENDER_TREE, { kind: "cycle_start", cycle: view });
    return { view, first: first.cycleInfo!.rateMarks, second: applyRenderEvent(first, { kind: "step_boundary", cycle: view }).cycleInfo!.rateMarks };
  };

  it("V4 (steps 5-6): the step-5 head mark until the boundary, then none — the crown run started between reports", () => {
    const { first, second } = atBoundary(4);
    expect(first.map((m) => m.id)).toEqual(["rate.head.cycle_5"]);
    expect(second).toEqual([]);
  });

  it("V6 (steps 8-9): from the boundary the mark is step 9's, credited to its observer, a band when judged by eye (fix pass 4)", () => {
    const { first, second } = atBoundary(6);
    expect(first.map((m) => m.id)).toEqual(["rate.head.cycle_8"]);
    expect(second.map((m) => m.id)).toEqual(["rate.head.cycle_9"]);
    const head = siteStep(9).observedHead;
    expect(second[0]!.provenance.sourceId).toBe(head.observerId);
    expect(second[0]!.rateBand).toEqual(head.rateBand);
  });

  it("every merged view shows its second step's marks after the boundary, none carrying the TRUTH flag", () => {
    for (const view of demo.cycles.filter((c) => c.stepBoundary)) {
      const { second } = atBoundary(view.index);
      expect(second.map((m) => m.id)).toEqual(view.stepBoundary!.rateMarks.map((m) => m.id));
      for (const m of second) expect(m).not.toHaveProperty("consistentWithEnvelope");
    }
  });
});
