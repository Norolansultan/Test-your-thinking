/**
 * The consult notification in the running session (SPEC/30 §4; `consult-notice.ts`): at 60 s on every main view's clock,
 * never the practice view; its tool by the group (Haku for `radio`, the Thinker for both Thinker cells); shown once
 * `consult_prompt_shown` is durable (I5); opened or dismissed by the participant, or dismissed by the view's end; held
 * by an open SPAM item or a freeze and shown when that closes, at the actual moment; out of sight while a visible probe
 * locks the tools; once per run of a view, and again in a view replayed after a resume. R6 (25 Oct 2026, SPEC/30 §4 (bi)): 70 s in a
 * merged view (after its step boundary), and only when reports came in after the participant's last recorded plan.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cycleScheduleOf } from "../../app/scenario/views.js";
import { planSessionResume } from "../../app/telemetry/resume.js";
import { InMemoryLogSink } from "../../app/telemetry/log.js";
import { newSession } from "./session-run.js";
import { allocateAndConfirm, PLAN, runOutView } from "./view-flow.js";
import { atView, HeldSink, indexOfKind, ofKind, scenario, settle, startSession } from "./spec30-helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the consult notification (SPEC/30 §4)", () => {
  it("shows at 60 s on V1's clock, once consult_prompt_shown is durable (I5), with the Haku group's tool", async () => {
    const sink = new HeldSink();
    const { o, snap } = await atView(1, "radio", { sink });
    await vi.advanceTimersByTimeAsync(59_999);
    expect(snap().consultPrompt).toBeNull();
    sink.hold();
    await vi.advanceTimersByTimeAsync(1);
    expect(snap().consultPrompt).toBeNull(); // due, its record not yet durable
    sink.release();
    await settle();
    expect(snap().consultPrompt).toEqual({ tool: "haku" });
    expect(ofKind(await o.logRecords(), "consult_prompt_shown").map((r) => r.detail)).toEqual([{ cycle: 1, atViewSeconds: 60, tool: "haku" }]);
  });

  it("never in the practice view; in every main view of a whole session exactly once", async () => {
    const r = await startSession("radio");
    await vi.advanceTimersByTimeAsync(61_000);
    expect(r.snap().consultPrompt).toBeNull();
    const records = await (await atView(14, "radio")).o.logRecords();
    expect(ofKind(records, "consult_prompt_shown").map((x) => (x.detail as { cycle: number }).cycle)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    for (let v = 1; v <= 13; v++) {
      // Left open, each was dismissed by its view's end, after `view_ended`.
      expect(ofKind(records, "consult_prompt_dismissed", v).map((x) => x.detail), `V${v}`).toEqual([{ cycle: v, tool: "haku", cause: "view_end" }]);
      expect(indexOfKind(records, "view_ended", v)).toBeLessThan(indexOfKind(records, "consult_prompt_dismissed", v));
    }
  });

  it.each([["reasoning_intent", "thinker"], ["reasoning_once", "thinker"], ["radio", "haku"]] as const)("%s: its button opens %s — consult_prompt_opened, then the notice goes", async (cell, tool) => {
    const { o, snap } = await atView(2, cell);
    await vi.advanceTimersByTimeAsync(70_000); // R6 (25 Oct 2026): V2 is a merged view, so the notice comes at 70 s, after its boundary
    expect(snap().consultPrompt).toEqual({ tool });
    await expect(o.openConsultPrompt()).resolves.toBe(tool);
    expect(snap().consultPrompt).toBeNull();
    await expect(o.openConsultPrompt()).rejects.toThrow(/consult notification/);
    await expect(o.dismissConsultPrompt()).rejects.toThrow(/consult notification/);
    await runOutView(o, snap);
    await allocateAndConfirm(o, snap);
    const records = await o.logRecords();
    expect(ofKind(records, "consult_prompt_opened").map((x) => x.detail)).toEqual([{ cycle: 2, tool }]);
    expect(ofKind(records, "consult_prompt_dismissed", 2)).toEqual([]); // opened: the view's end does not dismiss it again
    expect(indexOfKind(records, "consult_prompt_shown", 2)).toBeLessThan(indexOfKind(records, "consult_prompt_opened", 2));
  });

  it("opened or closed, the notice leaves the screen only once its record is durable (I5); a second press meanwhile is refused", async () => {
    const sink = new HeldSink();
    const { o, snap } = await atView(1, "radio", { sink });
    await vi.advanceTimersByTimeAsync(60_000);
    sink.hold();
    const opened = o.openConsultPrompt();
    await settle();
    expect(snap().consultPrompt).toEqual({ tool: "haku" });
    await expect(o.openConsultPrompt()).rejects.toThrow(/closing/);
    await expect(o.dismissConsultPrompt()).rejects.toThrow(/closing/);
    sink.release();
    await expect(opened).resolves.toBe("haku");
    expect(snap().consultPrompt).toBeNull();
    expect(ofKind(await o.logRecords(), "consult_prompt_opened")).toHaveLength(1);
    expect(ofKind(await o.logRecords(), "consult_prompt_dismissed")).toHaveLength(0);
  });

  it("its close button: consult_prompt_dismissed (participant), and nothing more at the view's end", async () => {
    const { o, snap } = await atView(1);
    await vi.advanceTimersByTimeAsync(60_000);
    await o.dismissConsultPrompt();
    expect(snap().consultPrompt).toBeNull();
    await runOutView(o, snap);
    await allocateAndConfirm(o, snap);
    expect(ofKind(await o.logRecords(), "consult_prompt_dismissed").map((x) => x.detail)).toEqual([{ cycle: 1, tool: "haku", cause: "participant" }]);
  });

  it("still open at the view's end: dismissed by it (view_end), and gone from the plan-confidence screen", async () => {
    const { o, snap } = await atView(1, "reasoning_intent");
    await vi.advanceTimersByTimeAsync(130_000);
    expect(snap().consultPrompt).toEqual({ tool: "thinker" });
    await o.submitAllocation(PLAN);
    expect(snap()).toMatchObject({ step: "plan_confidence", consultPrompt: null });
    const records = await o.logRecords();
    expect(ofKind(records, "consult_prompt_dismissed").map((x) => x.detail)).toEqual([{ cycle: 1, tool: "thinker", cause: "view_end" }]);
  });

  it("an open SPAM item at 60 s holds it: shown when the item closes, at that moment; the ready prompt alone does not", async () => {
    const { o, snap } = await atView(3);
    await vi.advanceTimersByTimeAsync(50_000); // the ready prompt at 25 s
    await o.spamReady();
    await vi.advanceTimersByTimeAsync(15_000); // 65 s: the notice fell due under the item
    expect(snap().consultPrompt).toBeNull();
    expect(ofKind(await o.logRecords(), "consult_prompt_shown", 3)).toEqual([]);
    await o.answerSpam("a");
    await vi.advanceTimersByTimeAsync(5_000);
    await o.submitSpamConfidence(50); // 70 s: V3's second item follows (SPEC/30 §5.2), still holding the notice
    await settle();
    expect(snap()).toMatchObject({ consultPrompt: null, spam: { phase: "item", probeId: "probe.s.cycle_3.b" } });
    await vi.advanceTimersByTimeAsync(5_000);
    await o.answerSpam("b");
    await o.submitSpamConfidence(50); // the probe closes at 75 s
    await settle();
    expect(snap().consultPrompt).toEqual({ tool: "haku" });
    const records = await o.logRecords();
    expect(ofKind(records, "consult_prompt_shown", 3).map((x) => x.detail)).toEqual([{ cycle: 3, atViewSeconds: 75, tool: "haku" }]);
    expect(indexOfKind(records, "spam_closed", 3)).toBeLessThan(indexOfKind(records, "consult_prompt_shown", 3));

    const other = await atView(6); // V6: the ready prompt left up over 70 s (a merged view's moment, R6) does not hold it
    await vi.advanceTimersByTimeAsync(70_000);
    expect(other.snap()).toMatchObject({ spam: { phase: "ready" }, consultPrompt: { tool: "haku" } });
  });

  it("a freeze at that moment holds it (the view's clock stands still): shown when the freeze closes, at 60 s", async () => {
    const at60 = { ...scenario, cycles: scenario.cycles.map((c) => (c.index === 5 ? { ...c, freezeAtSeconds: 60 } : c)) };
    const { o, snap } = await atView(5, "radio", {}, at60);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(snap()).toMatchObject({ step: "freeze", consultPrompt: null });
    await vi.advanceTimersByTimeAsync(30_000); // the freeze takes real time; the view's clock does not run
    expect(ofKind(await o.logRecords(), "consult_prompt_shown", 5)).toEqual([]);
    await o.submitFreeze([]);
    await settle();
    expect(snap().consultPrompt).toEqual({ tool: "haku" });
    const records = await o.logRecords();
    expect(ofKind(records, "consult_prompt_shown", 5).map((x) => x.detail)).toEqual([{ cycle: 5, atViewSeconds: 60, tool: "haku" }]);
    expect(indexOfKind(records, "freeze_submitted", 5)).toBeLessThan(indexOfKind(records, "consult_prompt_shown", 5));
  });

  it("`31` F23: a freeze due less than 15 s after it defers it past the freeze (shown when the freeze closes); one due 15 s or later does not", async () => {
    const withFreezeAt = (s: number) => ({ ...scenario, cycles: scenario.cycles.map((c) => (c.index === 5 ? { ...c, freezeAtSeconds: s } : c)) });
    const held = await atView(5, "radio", {}, withFreezeAt(74));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(held.snap().step).not.toBe("freeze");
    expect(held.snap().consultPrompt).toBeNull(); // due at 60 s, deferred: no notice right before the freeze
    expect(ofKind(await held.o.logRecords(), "consult_prompt_shown", 5)).toEqual([]);
    await vi.advanceTimersByTimeAsync(14_000);
    expect(held.snap()).toMatchObject({ step: "freeze", consultPrompt: null });
    await held.o.submitFreeze([]);
    await settle();
    expect(held.snap().consultPrompt).toEqual({ tool: "haku" });
    let records = await held.o.logRecords();
    expect(ofKind(records, "consult_prompt_shown", 5).map((x) => x.detail)).toEqual([{ cycle: 5, atViewSeconds: 74, tool: "haku" }]);
    expect(indexOfKind(records, "freeze_submitted", 5)).toBeLessThan(indexOfKind(records, "consult_prompt_shown", 5));

    const notHeld = await atView(5, "radio", {}, withFreezeAt(75));
    await vi.advanceTimersByTimeAsync(60_000);
    await settle();
    expect(notHeld.snap().step).not.toBe("freeze");
    expect(notHeld.snap().consultPrompt).toEqual({ tool: "haku" });
    records = await notHeld.o.logRecords();
    expect(ofKind(records, "consult_prompt_shown", 5).map((x) => x.detail)).toEqual([{ cycle: 5, atViewSeconds: 60, tool: "haku" }]);
  });

  it("is out of sight while a visible probe locks the tools (V13's U at 100 s), and back after it", async () => {
    const { o, snap } = await atView(13, "radio", { visibleProbes: true });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(snap().consultPrompt).toEqual({ tool: "haku" });
    await vi.advanceTimersByTimeAsync(40_000);
    expect(snap()).toMatchObject({ step: "probe", toolsLocked: true, consultPrompt: null });
    await o.submitProbeArea(false, []);
    expect(snap().consultPrompt).toEqual({ tool: "haku" });
  });

  it("is scaled by a preview (at half the scaled 120 s minimum)", async () => {
    const { o, snap } = await atView(1, "radio", { previewOverride: { minViewSeconds: 12 } });
    await vi.advanceTimersByTimeAsync(6_000);
    expect(snap().consultPrompt).toEqual({ tool: "haku" });
    expect(ofKind(await o.logRecords(), "consult_prompt_shown").map((x) => x.detail)).toEqual([{ cycle: 1, atViewSeconds: 6, tool: "haku" }]);
  });

  it("once per run of a view: a view replayed after a resume shows it again, once, and the first run's stays in the log", async () => {
    vi.setSystemTime(0);
    const sink = new InMemoryLogSink();
    const first = newSession({ sink }); // the 5 s preview minimum: the notice at 2.5 s
    await first.o.start();
    await runOutView(first.o, first.snap);
    await allocateAndConfirm(first.o, first.snap);
    await first.o.completeTraining();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(first.snap().consultPrompt).toEqual({ tool: "haku" });
    vi.clearAllTimers(); // the tab is closed with the notice on screen
    const records = await sink.readAll();
    expect(planSessionResume(records, cycleScheduleOf(scenario)).target).toEqual({ kind: "view", view: 1 });

    const second = newSession({ sink, resume: { header: records[0]!.detail as never, records, interruptedForMs: 10_000 } });
    await second.o.start();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(second.snap().consultPrompt).toEqual({ tool: "haku" });
    await vi.advanceTimersByTimeAsync(3_000);
    await allocateAndConfirm(second.o, second.snap);
    const all = await sink.readAll();
    const resumedAt = all.findIndex((r) => r.kind === "session_resumed");
    const shown = ofKind(all, "consult_prompt_shown", 1).map((r) => all.indexOf(r));
    expect(shown).toHaveLength(2);
    expect(shown.filter((i) => i < resumedAt)).toHaveLength(1);
    expect(shown.filter((i) => i > resumedAt)).toHaveLength(1);
    expect(ofKind(all.slice(resumedAt), "consult_prompt_dismissed", 1).map((r) => r.detail)).toEqual([{ cycle: 1, tool: "haku", cause: "view_end" }]);
  });
});

describe("R6 (SPEC/30 §4 (bi), 25 Oct 2026): after a merged view's boundary, and only when reports came in after the last plan", () => {
  const consultRecords = async (o: { logRecords(): Promise<readonly { kind: string; detail: unknown }[]> }, cycle: number) =>
    (await o.logRecords()).filter((r) => r.kind.startsWith("consult_prompt_") && (r.detail as { cycle: number }).cycle === cycle);
  /** Records the plan at the decision panel's opening (20 s), as a participant who confirms early does. */
  const planAt20 = async (r: { o: { submitAllocation(p: typeof PLAN): Promise<void> } }) => {
    await vi.advanceTimersByTimeAsync(20_000);
    await r.o.submitAllocation(PLAN);
  };

  it("a merged view: at 70 s, 5 s after the step boundary and its burst, not at 60 s", async () => {
    const { o, snap } = await atView(4);
    await vi.advanceTimersByTimeAsync(69_999);
    expect(snap().consultPrompt).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(snap().consultPrompt).toEqual({ tool: "haku" });
    const records = await o.logRecords();
    expect(ofKind(records, "consult_prompt_shown", 4).map((r) => r.detail)).toEqual([{ cycle: 4, atViewSeconds: 70, tool: "haku" }]);
    expect(indexOfKind(records, "step_boundary_reached", 4)).toBeLessThan(indexOfKind(records, "consult_prompt_shown", 4));
  });

  it.each(["radio", "reasoning_intent"] as const)("%s, a single-step view: a plan recorded before 60 s leaves nothing new, so no notice and no record", async (cell) => {
    const r = await atView(3, cell);
    await planAt20(r);
    await vi.advanceTimersByTimeAsync(45_000); // past 60 s
    expect(r.snap().consultPrompt).toBeNull();
    expect(await consultRecords(r.o, 3)).toEqual([]);
    await runOutView(r.o, r.snap);
    expect(await consultRecords(r.o, 3)).toEqual([]); // nothing at the view's end either: it never showed
  });

  it.each(["radio", "reasoning_intent"] as const)("%s, a merged view: a plan recorded before the boundary is followed by its reports, so the notice shows at 70 s", async (cell) => {
    const r = await atView(2, cell);
    await planAt20(r);
    await vi.advanceTimersByTimeAsync(50_000); // to 70 s
    await settle();
    expect(r.snap().consultPrompt).toEqual({ tool: cell === "radio" ? "haku" : "thinker" });
    expect(ofKind(await r.o.logRecords(), "consult_prompt_shown", 2).map((x) => (x.detail as { atViewSeconds: number }).atViewSeconds)).toEqual([70]);
  });

  it("a merged view: a revision recorded after the boundary leaves nothing new at 70 s", async () => {
    const r = await atView(2);
    await planAt20(r);
    await vi.advanceTimersByTimeAsync(46_000); // 66 s: the boundary's reports are in
    await r.o.reviseAllocation();
    await r.o.submitAllocation(PLAN); // the revision, recorded after them
    await vi.advanceTimersByTimeAsync(5_000);
    expect(r.snap().consultPrompt).toBeNull();
    expect(await consultRecords(r.o, 2)).toEqual([]);
  });

  it("no plan in this view yet: the view's own reports came after the previous view's plan, so it shows (60 s)", async () => {
    const { o, snap } = await atView(8); // a single-step view without a freeze; the previous plan was V7's
    await vi.advanceTimersByTimeAsync(60_000);
    await settle();
    expect(snap().consultPrompt).toEqual({ tool: "haku" });
    expect(ofKind(await o.logRecords(), "consult_prompt_shown", 8).map((r) => r.detail)).toEqual([{ cycle: 8, atViewSeconds: 60, tool: "haku" }]);
  });
});
