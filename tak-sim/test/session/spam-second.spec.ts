/**
 * The second SPAM item (SPEC/30 §5.2; `spam-delivery.ts`), with an injected fixture item for V3 (the real V3 and V6 items
 * arrive from the content package, `SPAM_SECOND_ITEMS`): it follows the first item and its confidence under the same
 * "ready" — no second prompt, no second `spam_ready` — with its own id (`probe.s.cycle_3.b`), its own 60 s answer
 * window and its own `spam_answered` and `recall_confidence_submitted`; `spam_closed` comes once, after it, with the first
 * item's id. The decision panel stays held and the tools usable throughout; a view end waits for it; forced at the
 * view's end both items are forced; a resume into the forced delivery runs it again from its first item.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { secondSpamProbes } from "../../app/scenario/demo-scenario.js";
import { SPAM_ANSWER_TIMEOUT_MS, SPAM_OFFSET_MS } from "../../app/scenario/demo-probes.js";
import { cycleScheduleOf, SECOND_SPAM_SUFFIX, secondSpamProbeId } from "../../app/scenario/views.js";
import { SPAM_SECOND_ITEMS } from "../../app/scenario/demo-probes.js";
import type { ScenarioContract } from "../../app/scenario/types.js";
import { planSessionResume } from "../../app/telemetry/resume.js";
import { InMemoryLogSink, type LogRecord } from "../../app/telemetry/log.js";
import { PLAN } from "./view-flow.js";
import { atView, completeView, ofKind, scenario, settle, startSession } from "./spec30-helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const A = "probe.s.cycle_3";
const B = secondSpamProbeId(A);
/**
 * The demo scenario with the authored second items taken out (`SPAM_SECOND_ITEMS` holds the real V3 and V6 items since the
 * content package filled them) and a fixture second item in V3 put in, built by the scenario's own builder: the mechanics
 * are tested against a known item, independent of the content. The real items run at the end (`the authored items`).
 */
const firstItemsOnly: ScenarioContract = {
  ...scenario,
  probeSchedule: { probes: scenario.probeSchedule.probes.filter((p) => !p.id.endsWith(SECOND_SPAM_SUFFIX)) },
  invariants: scenario.invariants.filter((i) => !i.name.endsWith(SECOND_SPAM_SUFFIX)),
};
const second = secondSpamProbes(
  { 3: { prompt: "Mihin suuntaan palon kärki etenee nyt?", options: ["Koilliseen", "Itään", "Etelään", "Länteen"], correct: "a", saLevel: 2, contentKind: "situation" } },
  firstItemsOnly.probeSchedule.probes,
);
const withSecond: ScenarioContract = { ...firstItemsOnly, probeSchedule: { probes: [...firstItemsOnly.probeSchedule.probes, ...second.probes] }, invariants: [...firstItemsOnly.invariants, ...second.invariants] };
const spamKinds = new Set(["spam_prompt_shown", "spam_ready", "spam_answered", "recall_confidence_submitted", "spam_closed", "spam_collapsed", "spam_expanded"]);
const ofDelivery = (records: readonly LogRecord[], kind: string) => records.filter((r) => r.kind === kind && (r.detail as { probeId: string }).probeId.startsWith(A)).map((r) => r.detail);
const spamTrail = (records: readonly LogRecord[]) => records.filter((r) => spamKinds.has(r.kind) && (r.detail as { cycle?: number; probeId: string }).probeId.startsWith(A)).map((r) => [r.kind, (r.detail as { probeId: string }).probeId]);

describe("the second SPAM item (SPEC/30 §5.2)", () => {
  it("follows the first under the same 'ready': its own id and records, one spam_closed (the first's id) after it", async () => {
    const { o, snap } = await atView(3, "radio", {}, withSecond);
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
    expect(snap().spam).toEqual({ phase: "ready", probeId: A, collapsed: false });
    await o.spamReady();
    expect(snap().spam).toMatchObject({ phase: "item", probeId: A, itemIndex: 1, itemCount: 2, forced: false });
    await o.answerSpam("b");
    await o.submitSpamConfidence(75);
    // The second item at once: its question, its options, the panel still held, the tools at hand.
    expect(snap().spam).toMatchObject({ phase: "item", probeId: B, itemIndex: 2, itemCount: 2, forced: false, chosen: null, promptFi: "Mihin suuntaan palon kärki etenee nyt?" });
    const shown = snap().spam;
    expect(shown?.phase === "item" ? shown.options.map((x) => x.fi) : null).toEqual(["Koilliseen", "Itään", "Etelään", "Länteen"]);
    expect(snap()).toMatchObject({ decisionHeld: true, toolsLocked: false });
    await expect(o.searchAtoms("EK11")).resolves.toBeDefined();
    await expect(o.submitAllocation(PLAN)).rejects.toThrow(/SPAM item is open/);
    await expect(o.answerSpam("z")).rejects.toThrow(RangeError);
    await o.answerSpam("a");
    expect(snap().spam).toMatchObject({ phase: "confidence", probeId: B, chosen: "a" });
    await o.submitSpamConfidence(50);
    expect(snap()).toMatchObject({ spam: null, decisionHeld: false });
    const records = await o.logRecords();
    expect(spamTrail(records)).toEqual([
      ["spam_prompt_shown", A], ["spam_ready", A], ["spam_answered", A], ["recall_confidence_submitted", A],
      ["spam_answered", B], ["recall_confidence_submitted", B], ["spam_closed", A],
    ]);
    expect(ofDelivery(records, "spam_answered")).toEqual([{ probeId: A, response: "b", timedOut: false }, { probeId: B, response: "a", timedOut: false }]);
    expect(ofDelivery(records, "recall_confidence_submitted")).toEqual([{ probeId: A, value: 75 }, { probeId: B, value: 50 }]);
    expect(ofDelivery(records, "spam_closed")).toEqual([{ probeId: A, cycle: 3 }]);
    expect(JSON.stringify(snap())).not.toMatch(/"(correct|expected|invariantName)"/); // I4: no key on the screen side
  });

  it("has its own 60 s answer window, from its own display; no answer is logged null, then the probe closes", async () => {
    const { o, snap } = await atView(3, "radio", {}, withSecond);
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
    await o.spamReady(); // 25 s
    await vi.advanceTimersByTimeAsync(20_000);
    await o.answerSpam("a");
    await o.submitSpamConfidence(50); // 45 s: the second item shows
    await vi.advanceTimersByTimeAsync(SPAM_ANSWER_TIMEOUT_MS - 1); // past the first item's window (85 s)
    expect(snap().spam).toMatchObject({ phase: "item", probeId: B });
    await vi.advanceTimersByTimeAsync(1);
    expect(snap().spam).toBeNull();
    const records = await o.logRecords();
    expect(ofDelivery(records, "spam_answered")).toEqual([{ probeId: A, response: "a", timedOut: false }, { probeId: B, response: null, timedOut: true }]);
    expect(spamTrail(records).at(-1)).toEqual(["spam_closed", A]);
  });

  it("the card's countdown (24 Oct 2026, display only) reads each item's own window: none at the prompt, 60 s at the display, down to 0", async () => {
    const { o, snap } = await atView(3, "radio", { realClockMs: () => Date.now() }, withSecond);
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
    expect(o.spamSecondsLeft()).toBeNull(); // the ready prompt has no window
    await o.spamReady();
    expect(o.spamSecondsLeft()).toBe(SPAM_ANSWER_TIMEOUT_MS / 1000);
    await vi.advanceTimersByTimeAsync(20_500);
    expect(o.spamSecondsLeft()).toBe(40); // whole seconds, rounded up
    await o.answerSpam("a");
    expect(o.spamSecondsLeft()).toBe(40); // the confidence shares the item's window
    await o.submitSpamConfidence(50);
    expect(snap().spam).toMatchObject({ phase: "item", probeId: B });
    expect(o.spamSecondsLeft()).toBe(SPAM_ANSWER_TIMEOUT_MS / 1000); // the second item's own window
    await vi.advanceTimersByTimeAsync(SPAM_ANSWER_TIMEOUT_MS - 500);
    expect(o.spamSecondsLeft()).toBe(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(snap().spam).toBeNull();
    expect(o.spamSecondsLeft()).toBeNull();
    // Display only: the delivery's records are exactly those it had before the countdown.
    expect(spamTrail(await o.logRecords())).toEqual([
      ["spam_prompt_shown", A], ["spam_ready", A], ["spam_answered", A], ["recall_confidence_submitted", A], ["spam_answered", B], ["spam_closed", A],
    ]);
  });

  it("the first item's window running out leads to the second (its own window), as its confidence does", async () => {
    const { o, snap } = await atView(3, "radio", {}, withSecond);
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
    await o.spamReady();
    await vi.advanceTimersByTimeAsync(SPAM_ANSWER_TIMEOUT_MS);
    expect(snap().spam).toMatchObject({ phase: "item", probeId: B, itemIndex: 2 });
    await o.answerSpam("c");
    await vi.advanceTimersByTimeAsync(SPAM_ANSWER_TIMEOUT_MS); // its confidence never given: missing, nothing logged for it
    expect(snap().spam).toBeNull();
    expect(spamTrail(await o.logRecords())).toEqual([
      ["spam_prompt_shown", A], ["spam_ready", A], ["spam_answered", A], ["spam_answered", B], ["spam_closed", A],
    ]);
  });

  it("a view end that falls due under the second item waits for it, then the plan's confidence", async () => {
    const { o, snap } = await atView(3, "radio", {}, withSecond);
    await vi.advanceTimersByTimeAsync(30_000);
    await o.submitAllocation(PLAN); // the period confirmed during the ready prompt
    await vi.advanceTimersByTimeAsync(60_000);
    await o.spamReady(); // 90 s
    await o.answerSpam("a");
    await o.submitSpamConfidence(50);
    await vi.advanceTimersByTimeAsync(35_000); // 125 s: the minimum (120 s) passed under the second item
    expect(snap()).toMatchObject({ currentCycle: 3, minimumReached: true, step: "awaiting_view_end", spam: { phase: "item", probeId: B } });
    expect(ofKind(await o.logRecords(), "view_ended", 3)).toEqual([]);
    await o.answerSpam("d");
    await o.submitSpamConfidence(25);
    expect(snap()).toMatchObject({ currentCycle: 3, step: "plan_confidence" });
    const records = await o.logRecords();
    expect(records.findIndex((r) => r.kind === "spam_closed")).toBeLessThan(records.findIndex((r) => r.kind === "view_ended" && (r.detail as { cycle: number }).cycle === 3));
    expect(ofKind(records, "view_ended", 3)[0]!.detail).toMatchObject({ endedBy: "minimum_length", viewSeconds: 125 });
  });

  it("forced at the view's end: both items forced (modal), the clock paused; the view ends with its held end after the second", async () => {
    const { o, snap } = await atView(3, "radio", {}, withSecond);
    await vi.advanceTimersByTimeAsync(125_000); // the ready prompt left up past the minimum
    await o.submitAllocation(PLAN);
    expect(snap().spam).toMatchObject({ phase: "item", probeId: A, forced: true, itemIndex: 1 });
    await o.answerSpam("a");
    await o.submitSpamConfidence(50);
    expect(snap().spam).toMatchObject({ phase: "item", probeId: B, forced: true, itemIndex: 2 });
    const left = snap().secondsLeft;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(snap()).toMatchObject({ currentCycle: 3, secondsLeft: left, spam: { probeId: B, forced: true } }); // the clock stands still
    const asked = o.askAiChat("mitä tapahtui?"); // the tools at hand (its answer after the latency floor)
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(asked).resolves.toBeDefined();
    expect(snap().secondsLeft).toBe(left);
    await o.answerSpam("b");
    await o.submitSpamConfidence(100);
    expect(snap()).toMatchObject({ currentCycle: 3, step: "plan_confidence", spam: null });
    const records = await o.logRecords();
    const forced = ofDelivery(records, "spam_ready");
    expect(forced).toEqual([{ probeId: A, timedOut: false, forced: true, atViewSeconds: 125, viewEndedBy: "participant_confirm" }]);
    expect(ofKind(records, "view_ended", 3)[0]!.detail).toEqual({ cycle: 3, viewSeconds: 125, endedBy: "participant_confirm" });
    await o.submitPlanConfidence(50);
    expect(snap().currentCycle).toBe(4);
  });

  it("an interruption in the forced second item resumes into the forced delivery (from its first item); the view ends after it", async () => {
    vi.setSystemTime(0);
    const sink = new InMemoryLogSink();
    const fast = { previewOverride: { minViewSeconds: 12 }, sink, realClockMs: () => Date.now() };
    const first = await startSession("radio", fast, withSecond);
    while (first.snap().currentCycle !== 3) await completeView(first);
    while (!first.snap().minimumReached) await vi.advanceTimersByTimeAsync(500);
    await first.o.submitAllocation(PLAN); // the ready prompt still up: forced
    await first.o.answerSpam("a");
    await first.o.submitSpamConfidence(50);
    expect(first.snap().spam).toMatchObject({ probeId: B, forced: true });
    vi.clearAllTimers(); // the tab is closed in the second item
    const records = await sink.readAll();
    const plan = planSessionResume(records, cycleScheduleOf(withSecond));
    expect(plan.target).toMatchObject({ kind: "spam_forced", view: 3, probeId: A, planRecorded: true });

    vi.setSystemTime(1_000_000);
    const second = await startSession("radio", { ...fast, resume: { header: records[0]!.detail as never, records, interruptedForMs: 20_000 } }, withSecond);
    expect(second.snap()).toMatchObject({ currentCycle: 3, spam: { phase: "item", probeId: A, forced: true, itemIndex: 1, itemCount: 2 } });
    await second.o.answerSpam("a");
    await second.o.submitSpamConfidence(50);
    expect(second.snap().spam).toMatchObject({ probeId: B, forced: true, itemIndex: 2 });
    await second.o.answerSpam("c");
    await second.o.submitSpamConfidence(75);
    await settle();
    expect(second.snap()).toMatchObject({ currentCycle: 3, step: "plan_confidence" });
    await second.o.submitPlanConfidence(50);
    expect(second.snap().currentCycle).toBe(4);
    const all = await sink.readAll();
    const resumed = all.slice(records.length);
    expect(resumed.map((r) => r.kind).slice(0, 4)).toEqual(["fault", "fault_resolved", "session_resumed", "spam_ready"]);
    expect(resumed[3]!.detail).toMatchObject({ probeId: A, forced: true, resumed: true });
    expect(ofDelivery(all, "spam_closed")).toEqual([{ probeId: A, cycle: 3 }]);
    expect(planSessionResume(all, cycleScheduleOf(withSecond)).target).toEqual({ kind: "view", view: 4 });
  });

  it("the authored items (content package): V3 and V6 run both items in the demo scenario, the second with the authored prompt", async () => {
    for (const view of [3, 6]) {
      const first = `probe.s.cycle_${view}`;
      const { o, snap } = await atView(view);
      await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
      await o.spamReady();
      expect(snap().spam).toMatchObject({ phase: "item", probeId: first, itemIndex: 1, itemCount: 2 });
      await o.answerSpam("a");
      await o.submitSpamConfidence(50);
      expect(snap().spam).toMatchObject({ phase: "item", probeId: secondSpamProbeId(first), itemIndex: 2, itemCount: 2, promptFi: SPAM_SECOND_ITEMS[view]!.prompt });
      expect(JSON.stringify(snap().spam)).not.toMatch(/"(correct|expected|invariantName)"/); // I4
      await o.answerSpam("b");
      await o.submitSpamConfidence(75);
      expect(snap().spam).toBeNull();
      const records = await o.logRecords();
      const mine = records.filter((r) => spamKinds.has(r.kind) && (r.detail as { probeId: string }).probeId.startsWith(first)).map((r) => [r.kind, (r.detail as { probeId: string }).probeId]);
      expect(mine).toEqual([
        ["spam_prompt_shown", first], ["spam_ready", first], ["spam_answered", first], ["recall_confidence_submitted", first],
        ["spam_answered", secondSpamProbeId(first)], ["recall_confidence_submitted", secondSpamProbeId(first)], ["spam_closed", first],
      ]);
      expect(scenario.invariants.some((i) => i.name === `spam.cycle_${view}.b`)).toBe(true); // its key, TRUTH, off the screen
    }
  });

  it("a view with no second item (V8, the practice view) closes after its one item, as before", async () => {
    const { o, snap } = await atView(8, "radio", {}, withSecond);
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
    await o.spamReady();
    expect(snap().spam).toMatchObject({ probeId: "probe.s.cycle_8", itemIndex: 1, itemCount: 1 });
    await o.answerSpam("a");
    await o.submitSpamConfidence(50);
    expect(snap().spam).toBeNull();
    expect(ofKind(await o.logRecords(), "spam_closed").at(-1)!.detail).toEqual({ probeId: "probe.s.cycle_8", cycle: 8 });
    expect(withSecond.probeSchedule.probes.some((p) => p.id === secondSpamProbeId("probe.s.practice"))).toBe(false);
  });
});
