/**
 * SPEC/09 revision (bf): the awareness index (`awareness-measures.ts`) on synthetic logs — the perceived items read from the post-session
 * questionnaire, the logged plan influence (a view counts when an answer of the group's tool came before the view's final plan and the
 * final plan differs from the plan in force before it), and the gaps.
 */

import { describe, expect, it } from "vitest";
import { awarenessIndex, loggedPlanInfluenceViews, perceivedInfluence } from "../../app/telemetry/awareness-measures.js";
import type { LogRecord } from "../../app/telemetry/log.js";

let seq = 0;
const rec = (kind: string, detail: unknown): LogRecord => ({ seq: seq++, tVirtual: 0, tWallOffsetMs: 0, kind, detail } as unknown as LogRecord);
const view = (cycle: number) => rec("cycle_start", { cycle, phase: cycle <= 7 ? "A" : "B", clockLabel: "13.20" });
const plan = (mainEffort: string, posture = "direct_attack") => rec("allocation_submitted", { plan: { mainEffort, posture, secondary: null, drones: null }, rationaleAsked: false, rationaleFi: null });
const revise = (cycle: number, mainEffort: string) => rec("allocation_revised", { cycle, revision: 1, plan: { mainEffort, posture: "direct_attack", secondary: null, drones: null } });
const answer = (cycle: number, tool: "haku" | "open_thinker", fallback = false) => rec("ai_chat_answer_received", {
  queryId: `q${seq}`, text: "q", view: cycle, virtualTimeS: 0, retrieved: [], retrievalMode: "hybrid", modelId: "m", promptHash: "h",
  answer: { vastaus: fallback ? "" : "Two records changed.", perusteet: "", varmuus: "", muuttaisi: "" }, latencyMs: 1, fallback, fallbackReason: null,
  phase: "exploration", promptVariant: "standard", tool,
});
const post = (answers: Readonly<Record<string, number | null>>) => rec("questionnaire_submitted", {
  questionnaireId: "post", dwellMs: 1, answers: Object.entries(answers).map(([itemId, value]) => ({ itemId, value })),
});

describe("the awareness index (SPEC/09 (bf))", () => {
  it("reads the group's own pair of items and the self-estimate", () => {
    seq = 0;
    expect(perceivedInfluence([post({ "accuracy.perceived": 70, "influence.plan_views.haku": 3, "influence.answers.haku": 20 })]))
      .toEqual({ tool: "haku", planViews: 3, answers: 20, accuracyPerceived: 70 });
    expect(perceivedInfluence([post({ "accuracy.perceived": null, "influence.plan_views.thinker": null, "influence.answers.thinker": 50 })]))
      .toEqual({ tool: "thinker", planViews: null, answers: 50, accuracyPerceived: null });
    expect(perceivedInfluence([])).toEqual({ tool: null, planViews: null, answers: null, accuracyPerceived: null });
  });

  it("counts a view when an answer of the tool preceded a final plan that differs from the plan in force before it", () => {
    seq = 0;
    const records = [
      view(1), answer(1, "haku"), plan("L1"), // V1: no plan in force before the answer: not counted
      view(2), answer(2, "haku"), plan("L2"), // V2: L1 in force (V1's), final L2: counted
      view(3), plan("L2"), answer(3, "haku"), revise(3, "L3"), // V3: L2 in force (the view's own), revised to L3 after it: counted
      view(4), answer(4, "haku"), plan("L3"), // V4: L3 in force, final L3: not counted
      view(5), plan("L1"), answer(5, "open_thinker"), // V5: another tool's answer only: not counted for Haku
      view(6), answer(6, "haku"), plan("L4"), answer(6, "haku"), // V6: the answer before the final plan counts (L1 → L4)
    ];
    expect(loggedPlanInfluenceViews(records, "haku")).toEqual([2, 3, 6]);
    expect(loggedPlanInfluenceViews(records, "thinker")).toEqual([]); // V5's final plan came before the Thinker's answer
  });

  it("a Thinker answer shown as 'unavailable' is no answer; the plan review's premise lines are the Thinker's", () => {
    seq = 0;
    const records = [
      view(8), plan("L1"),
      view(9), answer(9, "open_thinker", true), plan("L2"),
      view(10), rec("plan_review_shown", { cycle: 10, premiseLines: ["P1 … no longer holds: SPOT 17.01."] }), plan("L3"),
    ];
    expect(loggedPlanInfluenceViews(records, "thinker")).toEqual([10]);
  });

  it("the gaps: perceived minus logged, on each item's scale; null where a side is missing", () => {
    seq = 0;
    const records = [view(1), plan("L1"), view(2), answer(2, "haku"), plan("L2"), post({ "accuracy.perceived": 80, "influence.plan_views.haku": 4, "influence.answers.haku": 30 })];
    expect(awarenessIndex(records, { statedShare: 0.1, accuracy: 0.55 })).toMatchObject({
      tool: "haku", loggedPlanViews: 1, planViewsGap: 3, answersGap: expect.closeTo(0.2, 10), selfEstimateGap: expect.closeTo(0.25, 10),
    });
    expect(awarenessIndex(records)).toMatchObject({ answersGap: null, selfEstimateGap: null, planViewsGap: 3 });
    expect(awarenessIndex([view(1), plan("L1")])).toMatchObject({ tool: null, loggedPlanViews: null, planViewsGap: null });
  });
});
