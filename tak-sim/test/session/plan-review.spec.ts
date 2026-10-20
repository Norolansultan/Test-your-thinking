/**
 * The plan review at commitment (SPEC/32 §3; `plan-review.ts`, `SessionOrchestrator.endView` / `keepPlan` / `revisePlan`):
 * phase B only (V8–V14), both groups, once per view, at the moment the plan would become final — the minimum reached with a
 * plan recorded (`minimum_reached`) or a plan recorded after it (`plan_after_minimum`); the view's clock stands still while
 * it is open; keep ends the view as before; revise reopens the allocation by the revision path and the revision ends the view
 * with no second review, the cap moved to leave 45 s; the cap reached while it is open closes it (`time_cap`); a SPAM item or
 * a forced ready prompt holds it; the guide group's premise lines come from the server's lookup (mocked by the server's own
 * handler), the Haku group makes no request, and a failed lookup shows the neutral review with `premiseError`. A session
 * interrupted during the review replays the view from its start.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cell } from "../../app/scenario/types.js";
import type { SessionOptions } from "../../app/session/orchestrator.js";
import type { PremiseReviewRequest, PremiseReviewResponse } from "../../app/session/thinker-protocol.js";
import { cycleScheduleOf } from "../../app/scenario/views.js";
import { InMemoryLogSink, type LogRecord } from "../../app/telemetry/log.js";
import type { PlanReviewClosedDetail, PlanReviewShownDetail, ViewEndedDetail } from "../../app/telemetry/record-kinds.js";
import { planSessionResume } from "../../app/telemetry/resume.js";
import { handlePremiseReviewRequest } from "../../server/thinker/premise-review.js";
import { completeView as completeFast, newSession } from "./session-run.js";
import { atView, HeldSink, indexOfKind, ofKind, scenario, settle, type Running } from "./spec30-helpers.js";
import { keepReview, PLAN } from "./view-flow.js";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => vi.useRealTimers());

const CLOCK: SessionOptions = { realClockMs: () => Date.now() };
const REVISED = { mainEffort: "L3", posture: "barrier_line", secondary: null, drones: null } as const;

/** The server's own handler as the transport (no network, no model). */
function serverLookup() {
  return vi.fn(async (request: PremiseReviewRequest): Promise<PremiseReviewResponse> => {
    const r = await handlePremiseReviewRequest({ scenario, appendLog: async () => undefined, nowMs: () => 0, nowIso: () => "2026-10-20T00:00:00.000Z" }, request);
    if (r.status !== 200) throw new Error(r.body.error);
    return r.body;
  });
}

const shownOf = (records: readonly LogRecord[], cycle: number) => ofKind(records, "plan_review_shown", cycle).map((r) => r.detail as PlanReviewShownDetail);
const closedOf = (records: readonly LogRecord[], cycle: number) => ofKind(records, "plan_review_closed", cycle).map((r) => r.detail as PlanReviewClosedDetail);
const endedOf = (records: readonly LogRecord[], cycle: number) => ofKind(records, "view_ended", cycle).map((r) => r.detail as ViewEndedDetail);

/** V9 (phase B, no SPAM item, no freeze inside the view) at its start. */
const atV9 = (cell: Cell = "radio", options: SessionOptions = {}) => atView(9, cell, { ...CLOCK, ...options });

/** Submits the plan `seconds` into the view (from its start). */
async function planAt({ o }: Running, seconds: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(seconds * 1000);
  await o.submitAllocation(PLAN);
}

describe("when the review opens (SPEC/32 §3)", () => {
  it("at the minimum with a plan recorded (minimum_reached), once; the clock stands still while it is open; keep ends the view at 120 s (minimum_length)", async () => {
    const r = await atV9();
    const { o, snap } = r;
    await planAt(r, 30);
    expect(snap().step).toBe("awaiting_view_end");
    await vi.advanceTimersByTimeAsync(90_000); // the minimum, 120 s
    expect(snap()).toMatchObject({ currentCycle: 9, step: "plan_review", toolsLocked: true, waitingOnSession: false, consultPrompt: null, planReview: { cycle: 9, trigger: "minimum_reached", premiseLines: null, citedRecords: [], openedAtomId: null } });
    expect(snap().recordedPlan).toEqual(PLAN);
    let records = await o.logRecords();
    expect(shownOf(records, 9)).toEqual([{ cycle: 9, atViewSeconds: 120, trigger: "minimum_reached", premiseLines: null, premiseStatuses: null, tableSha256: null }]);
    expect(endedOf(records, 9)).toEqual([]);

    // The clock stands still: a minute later nothing has moved, the cap (150 s) has not come.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(snap()).toMatchObject({ step: "plan_review", secondsLeft: null });
    await expect(o.askAiChat("where?")).rejects.toThrow(/Haku and Thinker work only inside a view/);
    await expect(o.submitAllocation(PLAN)).rejects.toThrow(/submitAllocation in step plan_review/);

    await o.keepPlan();
    expect(snap()).toMatchObject({ currentCycle: 9, step: "plan_confidence", planReview: null });
    records = await o.logRecords();
    expect(closedOf(records, 9)).toEqual([{ cycle: 9, choice: "keep", dwellMs: 60_000 }]);
    expect(endedOf(records, 9)).toEqual([{ cycle: 9, viewSeconds: 120, endedBy: "minimum_length" }]);
    const order = ["allocation_submitted", "plan_review_shown", "plan_review_closed", "view_ended", "plan_confidence_presented"].map((k) => records.findIndex((x, i) => i > indexOfKind(records, "cycle_start", 9) && x.kind === k));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    await expect(o.keepPlan()).rejects.toThrow(/keepPlan in step plan_confidence/);
  });

  it("a plan recorded after the minimum (plan_after_minimum): keep ends the view at that moment (participant_confirm)", async () => {
    const r = await atV9();
    await planAt(r, 130);
    expect(r.snap().planReview).toMatchObject({ trigger: "plan_after_minimum" });
    await vi.advanceTimersByTimeAsync(30_000); // past the cap's moment on the real clock: the view's clock stands still
    await r.o.keepPlan();
    const records = await r.o.logRecords();
    expect(shownOf(records, 9)[0]).toMatchObject({ atViewSeconds: 130, trigger: "plan_after_minimum" });
    expect(endedOf(records, 9)).toEqual([{ cycle: 9, viewSeconds: 130, endedBy: "participant_confirm" }]);
  });

  it("no plan by the cap: no review, the view ends time_cap", async () => {
    const r = await atV9();
    await vi.advanceTimersByTimeAsync(150_000);
    expect(r.snap().step).toBe("plan_confidence");
    const records = await r.o.logRecords();
    expect(shownOf(records, 9)).toEqual([]);
    expect(endedOf(records, 9)).toMatchObject([{ endedBy: "time_cap", viewSeconds: 150 }]);
  });

  it("never in phase A or the practice view; once in each phase-B view on the way", async () => {
    const r = await atView(10, "radio", CLOCK);
    const records = await r.o.logRecords();
    const reviewed = ofKind(records, "plan_review_shown").map((x) => (x.detail as PlanReviewShownDetail).cycle);
    expect(reviewed).toEqual([8, 9]);
    expect(ofKind(records, "plan_review_closed").map((x) => (x.detail as PlanReviewClosedDetail).choice)).toEqual(["keep", "keep"]);
    for (const v of [0, 1, 2, 3, 4, 5, 6, 7]) expect(endedOf(records, v).length, `V${v}`).toBe(1);
  });

  it("a revision open at the minimum is not dropped in phase B: the review comes when it is recorded (plan_after_minimum), then minimum_length", async () => {
    const r = await atV9();
    const { o, snap } = r;
    await planAt(r, 30);
    await o.reviseAllocation();
    await vi.advanceTimersByTimeAsync(95_000); // 125 s: past the minimum
    expect(snap()).toMatchObject({ step: "allocation", revisingAllocation: true, minimumReached: true });
    await o.submitAllocation(REVISED);
    expect(snap().planReview).toMatchObject({ trigger: "plan_after_minimum" });
    await o.keepPlan();
    const records = await o.logRecords();
    expect(shownOf(records, 9)[0]).toMatchObject({ atViewSeconds: 125 });
    expect(endedOf(records, 9)).toEqual([{ cycle: 9, viewSeconds: 125, endedBy: "minimum_length" }]);
  });
});

describe("revise at the review", () => {
  it("reopens the allocation by the revision path (prefilled plan, the clock running again); the revision ends the view, no second review; fewer than 45 s left moves the cap", async () => {
    const r = await atV9();
    const { o, snap } = r;
    await planAt(r, 130); // 20 s before the cap
    await vi.advanceTimersByTimeAsync(5_000);
    await o.revisePlan();
    expect(snap()).toMatchObject({ step: "allocation", revisingAllocation: true, recordedPlan: PLAN, planReview: null, toolsLocked: false });
    let records = await o.logRecords();
    expect(closedOf(records, 9)).toEqual([{ cycle: 9, choice: "revise", dwellMs: 5_000, capExtendedToSeconds: 175 }]);
    expect(ofKind(records, "allocation_revision_opened", 9).map((x) => x.detail)).toEqual([{ cycle: 9, atViewSeconds: 130 }]);
    expect(indexOfKind(records, "plan_review_closed", 9)).toBeLessThan(indexOfKind(records, "allocation_revision_opened", 9));

    await vi.advanceTimersByTimeAsync(30_000); // 160 s: past the old cap, before the new one
    expect(snap()).toMatchObject({ currentCycle: 9, step: "allocation" });
    await o.submitAllocation(REVISED);
    expect(snap().step).toBe("plan_confidence"); // ended at once: no second review
    records = await o.logRecords();
    expect(shownOf(records, 9)).toHaveLength(1);
    expect(ofKind(records, "allocation_revised", 9).map((x) => x.detail)).toEqual([{ cycle: 9, revision: 1, plan: REVISED }]);
    expect(endedOf(records, 9)).toEqual([{ cycle: 9, viewSeconds: 160, endedBy: "minimum_length" }]);
  });

  it("the moved cap ends a revision not recorded in time (time_cap at the new cap); its countdown restarts", async () => {
    const r = await atV9();
    const { o, snap } = r;
    await planAt(r, 140);
    await o.revisePlan();
    expect(closedOf(await o.logRecords(), 9)[0]).toMatchObject({ capExtendedToSeconds: 185 });
    expect(snap().secondsLeft).toBeNull(); // 45 s left: no countdown yet
    await vi.advanceTimersByTimeAsync(30_000); // 170 s: the new cap's last 15 s
    expect(snap().secondsLeft).toBe(15);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(snap().step).toBe("plan_confidence");
    const records = await o.logRecords();
    expect(endedOf(records, 9)).toEqual([{ cycle: 9, viewSeconds: 185, endedBy: "time_cap", stepAtEnd: "allocation" }]);
    expect(ofKind(records, "allocation_revised", 9)).toEqual([]); // the recorded plan stands
  });

  it("45 s or more left: the cap stays (no capExtendedToSeconds)", async () => {
    const r = await atView(9, "radio", { ...CLOCK, previewOverride: { minViewSeconds: 5 } }); // the minimum at 5 s, the cap still 150 s
    await vi.advanceTimersByTimeAsync(1_000);
    await r.o.submitAllocation(PLAN);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(r.snap().planReview).toMatchObject({ trigger: "minimum_reached" });
    await r.o.revisePlan();
    expect(closedOf(await r.o.logRecords(), 9)).toEqual([{ cycle: 9, choice: "revise", dwellMs: 0 }]);
    await vi.advanceTimersByTimeAsync(144_000); // 149 s
    expect(r.snap().step).toBe("allocation");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(endedOf(await r.o.logRecords(), 9)).toMatchObject([{ viewSeconds: 150, endedBy: "time_cap" }]);
  });
});

describe("the cap and the SPAM item around the review", () => {
  it("the cap reached while the review is open closes it (time_cap); the recorded plan stands; the view ends time_cap", async () => {
    const sink = new HeldSink();
    const r = await atV9("radio", { sink });
    await vi.advanceTimersByTimeAsync(149_000);
    sink.hold(); // the plan's record is slow to commit: the cap comes meanwhile
    const submitted = r.o.submitAllocation(PLAN);
    await settle();
    await vi.advanceTimersByTimeAsync(2_000);
    sink.release();
    await submitted;
    expect(r.snap().step).toBe("plan_confidence");
    const records = await r.o.logRecords();
    expect(shownOf(records, 9)).toMatchObject([{ trigger: "plan_after_minimum" }]);
    expect(closedOf(records, 9)).toEqual([{ cycle: 9, choice: "time_cap", dwellMs: 0 }]);
    expect(endedOf(records, 9)).toMatchObject([{ endedBy: "time_cap", stepAtEnd: "plan_review" }]);
    expect(ofKind(records, "allocation_submitted").at(-1)!.detail).toMatchObject({ plan: PLAN });
    expect(indexOfKind(records, "plan_review_closed", 9)).toBeLessThan(indexOfKind(records, "view_ended", 9));
  });

  it("a SPAM item open at the minimum holds the review; it opens when the item closes", async () => {
    const r = await atView(8, "radio", CLOCK); // V8's SPAM prompt at 25 s
    const { o, snap } = r;
    await planAt(r, 21);
    await vi.advanceTimersByTimeAsync(79_000); // 100 s: the ready prompt waits (it does not expire)
    await o.spamReady();
    await vi.advanceTimersByTimeAsync(25_000); // 125 s: the minimum passed under the open item
    expect(snap()).toMatchObject({ step: "awaiting_view_end", minimumReached: true, planReview: null });
    expect(shownOf(await o.logRecords(), 8)).toEqual([]);
    const item = snap().spam!;
    if (item.phase !== "item") throw new Error(`SPAM item expected, got ${item.phase}`);
    await o.answerSpam(item.options[0]!.id);
    await o.submitSpamConfidence(50);
    expect(snap()).toMatchObject({ step: "plan_review", planReview: { trigger: "minimum_reached" } });
    expect(shownOf(await o.logRecords(), 8)[0]).toMatchObject({ atViewSeconds: 125 });
    await o.keepPlan();
    expect(endedOf(await o.logRecords(), 8)).toEqual([{ cycle: 8, viewSeconds: 125, endedBy: "minimum_length" }]);
  });

  it("a ready prompt still up at the minimum is forced first; the review follows the forced item, at the same view moment", async () => {
    const r = await atView(8, "radio", CLOCK);
    const { o, snap } = r;
    await planAt(r, 21);
    await vi.advanceTimersByTimeAsync(99_000); // 120 s
    expect(snap().spam).toMatchObject({ phase: "item", forced: true });
    expect(snap().planReview).toBeNull();
    const item = snap().spam!;
    if (item.phase !== "item") throw new Error("forced item expected");
    await o.answerSpam(item.options[0]!.id);
    await o.submitSpamConfidence(50);
    expect(snap()).toMatchObject({ step: "plan_review", planReview: { trigger: "minimum_reached" } });
    await vi.advanceTimersByTimeAsync(3_000);
    await o.keepPlan();
    const records = await o.logRecords();
    expect(shownOf(records, 8)[0]).toMatchObject({ atViewSeconds: 120 });
    expect(indexOfKind(records, "spam_closed", 8)).toBeLessThan(indexOfKind(records, "plan_review_shown", 8));
    expect(endedOf(records, 8)).toEqual([{ cycle: 8, viewSeconds: 120, endedBy: "minimum_length" }]);
  });
});

describe("the guide group's premise lines (the server's lookup, no model)", () => {
  it("are requested when the review opens, shown with the cited record, which opens in the message log (plan_review_record_opened)", async () => {
    const lookup = serverLookup();
    const r = await atV9("reasoning_intent", { thinker: { premiseReview: lookup } });
    const { o, snap } = r;
    lookup.mockClear();
    await planAt(r, 130);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup.mock.calls[0]![0]).toEqual({ sessionId: o.logHeader.sessionId, cell: "reasoning_intent", view: 9, virtualTimeS: 13_200, language: "fi" });
    const review = snap().planReview!;
    expect(review.premiseLines).toHaveLength(1);
    expect(review.premiseLines![0]).toMatch(/^P1 .* — ei enää päde: SPOT klo 17\.01\.$/);
    expect(review.citedRecords.map((c) => [c.atomId, c.premiseId, c.from, c.clockLabel])).toEqual([["atom.demo.12.0", "P1", "SPOT", "17:01"]]);
    const shown = shownOf(await o.logRecords(), 9)[0]!;
    expect(shown).toMatchObject({ premiseLines: review.premiseLines, premiseStatuses: [{ premiseId: "P1", status: "contradicted", atomIds: ["atom.demo.12.0"] }, { premiseId: "P2", status: "not_contradicted", atomIds: [] }] });
    expect(shown.tableSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(shown.premiseError).toBeUndefined();

    await expect(o.openReviewRecord("evt.c13.010")).rejects.toThrow(RangeError); // not cited here
    await o.openReviewRecord("atom.demo.12.0");
    expect(snap().planReview!.openedAtomId).toBe("atom.demo.12.0");
    expect(ofKind(await o.logRecords(), "plan_review_record_opened", 9).map((x) => x.detail)).toEqual([{ cycle: 9, atomId: "atom.demo.12.0" }]);
    await o.keepPlan();
    expect(endedOf(await o.logRecords(), 9)).toMatchObject([{ endedBy: "participant_confirm", viewSeconds: 130 }]);
  });

  it("the clock stands still while the lookup is pending; the review shows once it has answered", async () => {
    let answer: ((v: PremiseReviewResponse) => void) | null = null;
    const real = serverLookup();
    const lookup = vi.fn(async (req: PremiseReviewRequest) => { const body = await real(req); return new Promise<PremiseReviewResponse>((resolve) => { answer = () => resolve(body); }); });
    const r = await atV9("reasoning_intent", { thinker: { premiseReview: async (req) => (req.view === 9 ? lookup(req) : real(req)) } });
    await vi.advanceTimersByTimeAsync(140_000);
    const submitted = r.o.submitAllocation(PLAN); // resolves once the review is shown (its record durable)
    await settle();
    expect(r.snap()).toMatchObject({ step: "plan_review", planReview: null, waitingOnSession: true });
    await vi.advanceTimersByTimeAsync(3_000);
    answer!({} as PremiseReviewResponse);
    await submitted;
    expect(r.snap()).toMatchObject({ step: "plan_review", waitingOnSession: false, planReview: { trigger: "plan_after_minimum" } });
    expect(shownOf(await r.o.logRecords(), 9)[0]).toMatchObject({ atViewSeconds: 140 });
  });

  it("the Haku group makes no request (and sees the neutral review)", async () => {
    const lookup = serverLookup();
    const r = await atV9("radio", { thinker: { premiseReview: lookup } });
    await planAt(r, 130);
    expect(r.snap().planReview).toMatchObject({ premiseLines: null, citedRecords: [] });
    expect(lookup).not.toHaveBeenCalled(); // not in V8 either
    await expect(r.o.openReviewRecord("atom.demo.12.0")).rejects.toThrow(RangeError);
  });

  it.each([
    ["a network failure", () => Promise.reject(new TypeError("network down")), /^network_error/],
    ["no answer within 4 s", () => new Promise<never>(() => undefined), /^client_timeout$/],
    ["an answer of the wrong shape", () => Promise.resolve({ lines: "x" } as never), /^invalid_response/],
  ])("%s: the neutral review, premiseError set", async (_label, transport, error) => {
    const real = serverLookup(); // V8's review on the way answers; V9's fails
    const r = await atV9("reasoning_intent", { thinker: { premiseReview: (req) => (req.view === 9 ? transport() : real(req)) } });
    await vi.advanceTimersByTimeAsync(130_000);
    const submitted = r.o.submitAllocation(PLAN);
    for (let i = 0; i < 20 && r.snap().planReview === null; i++) await vi.advanceTimersByTimeAsync(500);
    await submitted;
    expect(r.snap().planReview).toMatchObject({ premiseLines: null, citedRecords: [] });
    const shown = shownOf(await r.o.logRecords(), 9)[0]!;
    expect(shown).toMatchObject({ premiseLines: null, premiseStatuses: null, tableSha256: null });
    expect(shown.premiseError).toMatch(error);
    await r.o.keepPlan();
  });
});

describe("resume during the review", () => {
  it("replays the view from its start (no cycle_end); the review comes again at its end", async () => {
    const sink = new InMemoryLogSink();
    const first = newSession({ sink });
    await first.o.start();
    while (first.snap().currentCycle !== 8) await completeFast(first.o, first.snap);
    await vi.advanceTimersByTimeAsync(1_000); // the decision panel (0.83 s under the 5 s preview)
    await first.o.submitAllocation(PLAN);
    for (let i = 0; i < 10 && first.snap().step !== "plan_review"; i++) {
      await vi.advanceTimersByTimeAsync(1_000);
      const spam = first.snap().spam;
      if (spam?.phase === "ready") await first.o.spamReady();
      else if (spam?.phase === "item") { await first.o.answerSpam(spam.options[0]!.id); await first.o.submitSpamConfidence(50); }
    }
    expect(first.snap()).toMatchObject({ currentCycle: 8, step: "plan_review" });
    vi.clearAllTimers(); // the tab is closed during the review
    const records = await sink.readAll();
    expect(planSessionResume(records, cycleScheduleOf(scenario)).target).toEqual({ kind: "view", view: 8 });

    vi.setSystemTime(2_000_000);
    const second = newSession({ sink, resume: { header: records[0]!.detail as never, records, interruptedForMs: 30_000 } });
    await second.o.start();
    expect(second.snap()).toMatchObject({ currentCycle: 8, step: "exploration", planReview: null });
    await completeFast(second.o, second.snap);
    expect(second.snap().currentCycle).toBe(9);
    const all = await sink.readAll();
    expect(shownOf(all, 8)).toHaveLength(2);
    expect(closedOf(all, 8).map((c) => c.choice)).toEqual(["keep"]);
    expect(await keepReview(second.o)).toBe(false);
  });

  it("resumed into a forced SPAM item (phase B): the review follows it with the plan recorded; a revision there has its cap", async () => {
    const sink = new InMemoryLogSink();
    const first = newSession({ sink });
    await first.o.start();
    while (first.snap().currentCycle !== 8) await completeFast(first.o, first.snap);
    await vi.advanceTimersByTimeAsync(900); // the decision panel at 0.83 s, V8's SPAM prompt at 1.04 s (the 5 s preview)
    await first.o.submitAllocation(PLAN);
    await vi.advanceTimersByTimeAsync(4_100); // the minimum: the ready prompt left up is forced
    expect(first.snap().spam).toMatchObject({ phase: "item", forced: true });
    vi.clearAllTimers(); // the tab is closed in the forced item
    const records = await sink.readAll();
    expect(planSessionResume(records, cycleScheduleOf(scenario)).target).toMatchObject({ kind: "spam_forced", view: 8, viewEndedBy: "minimum_length" });

    vi.setSystemTime(2_000_000);
    const second = newSession({ sink, resume: { header: records[0]!.detail as never, records, interruptedForMs: 30_000 } });
    await second.o.start();
    const item = second.snap().spam!;
    if (item.phase !== "item") throw new Error("the forced item expected");
    await second.o.answerSpam(item.options[0]!.id);
    await second.o.submitSpamConfidence(50);
    expect(second.snap()).toMatchObject({ currentCycle: 8, step: "plan_review", recordedPlan: PLAN, planReview: { trigger: "minimum_reached" } });
    await second.o.revisePlan();
    expect(second.snap()).toMatchObject({ step: "allocation", revisingAllocation: true });
    await vi.advanceTimersByTimeAsync(145_000); // the cap, 150 s, set again for the revision
    const all = await sink.readAll();
    expect(closedOf(all, 8)).toEqual([{ cycle: 8, choice: "revise", dwellMs: 0 }]);
    expect(endedOf(all, 8)).toMatchObject([{ endedBy: "time_cap", viewSeconds: 150 }]);
  });
});
