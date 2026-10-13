/**
 * The hinge screen after the check (SPEC/27 §4.1; reconciled 5 Oct 2026): the directive is hidden while
 * the check is answered and shown again afterwards. D1 (8 Oct 2026): the per-cell sentence about the
 * linjaus line is gone; instead the directive is a radio message from P2 at V8's opening and a
 * persistent line (`directiveInForce`) from V8 on, identical in every cell, its display logged once.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import type { Cell } from "../../app/scenario/types.js";
import { DUTY_OFFICER_ID, SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { conditionOfCell } from "../../app/session/preview.js";
import { allocateAndConfirm, runOutView } from "./view-flow.js";

const scenario = buildDemoScenario();

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function toHinge(cell: Cell) {
  const o = new SessionOrchestrator(scenario, conditionOfCell(cell), { cell, previewOverride: { minViewSeconds: 5 }, thinker: { transport: vi.fn() } });
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  const snap = () => box.snap!;
  await o.start();
  while (snap().step !== "hinge_pause") {
    await runOutView(o, snap);
    await allocateAndConfirm(o, snap);
    if (snap().step === "training") await o.completeTraining();
  }
  return { o, snap };
}

describe("the hinge screen and the directive (D1)", () => {
  it.each(["reasoning_intent", "reasoning_once", "radio"] as const)("%s: hidden while answering, shown again after; then a radio message and a persistent line, logged once", async (cell) => {
    const { o, snap } = await toHinge(cell);
    expect(snap().hingeDirective).not.toBeNull();
    expect(snap().directiveInForce).toBeNull(); // before the hinge is left
    await o.showHingeCheck();
    expect(snap().hingeDirective).toBeNull();
    await o.answerHingeCheck("a");
    expect(snap().hingeDirective).toBe(scenario.hinge.intentStatement); // shown again, not marked
    await o.dismissHinge();
    expect(snap().hingeDirective).toBeNull();
    expect(snap().directiveInForce).toBe(scenario.hinge.intentStatement);
    expect(snap().radioLog.some((e) => e.from === DUTY_OFFICER_ID && e.text === scenario.hinge.intentStatement)).toBe(true);

    const records = await o.logRecords();
    expect(records.filter((r) => r.kind === "hinge_cell_note_shown")).toHaveLength(0);
    const shown = records.filter((r) => r.kind === "directive_shown");
    expect(shown.map((r) => (r.detail as { view: number; messageId: string }).messageId)).toEqual([scenario.hinge.guidanceMessageId]);
    const at = (k: string) => records.findIndex((r) => r.kind === k);
    expect(at("hinge_pause_end")).toBeLessThan(at("directive_shown"));
  });
});
