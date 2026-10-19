/**
 * SPEC/30 §5.4's interaction records through the session (`SessionOrchestrator.logPanelUse`): the plan panel's
 * `decision_option_hovered` and the SPAM card's `probe_option_hovered` / `probe_answer_changed`, raw and durable, in call
 * order; logging them never moves the screen or the plan. The components' wiring: `test/render/spec30-ui.spec.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SPAM_OFFSET_MS } from "../../app/scenario/demo-probes.js";
import { atView, ofKind } from "./spec30-helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the §5.4 interaction records (SPEC/30)", () => {
  it("decision_option_hovered from the plan panel; the step and the plan unchanged", async () => {
    const { o, snap } = await atView(1);
    await vi.advanceTimersByTimeAsync(20_000);
    const before = snap();
    await o.logPanelUse({ kind: "decision_option_hovered", detail: { optionId: "main_effort:L2" } });
    await o.logPanelUse({ kind: "decision_option_hovered", detail: { optionId: "posture:direct_attack" } });
    expect(snap()).toMatchObject({ step: before.step, recordedPlan: null });
    expect(ofKind(await o.logRecords(), "decision_option_hovered").map((r) => r.detail)).toEqual([{ optionId: "main_effort:L2" }, { optionId: "posture:direct_attack" }]);
  });

  it("probe_option_hovered and probe_answer_changed from the SPAM card, the change before the session's spam_answered", async () => {
    const { o, snap } = await atView(3);
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
    await o.spamReady();
    const probeId = snap().spam!.probeId;
    await o.logPanelUse({ kind: "probe_option_hovered", detail: { probeId, optionId: "b" } });
    // As the card does: the change, then the answer, in one click (the log keeps call order).
    const changed = o.logPanelUse({ kind: "probe_answer_changed", detail: { probeId, from: null, to: "b" } });
    const answered = o.answerSpam("b");
    await Promise.all([changed, answered]);
    const records = await o.logRecords();
    expect(ofKind(records, "probe_option_hovered").map((r) => r.detail)).toEqual([{ probeId, optionId: "b" }]);
    expect(ofKind(records, "probe_answer_changed").map((r) => r.detail)).toEqual([{ probeId, from: null, to: "b" }]);
    const at = (kind: string) => records.findIndex((r) => r.kind === kind && (r.detail as { probeId?: string }).probeId === probeId);
    expect(at("probe_answer_changed")).toBeLessThan(at("spam_answered"));
    expect(snap().spam).toMatchObject({ phase: "confidence", chosen: "b" });
  });
});
