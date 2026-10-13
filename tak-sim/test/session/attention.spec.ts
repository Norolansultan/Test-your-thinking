/**
 * The attention records for SPEC/09 §6's exclusion rules (`attention.ts`): blur and focus once per
 * change, whether the window or the document's visibility reports it; idle after SPEC/07's 5 s of no
 * pointer or keyboard input; the listeners removed on unmount; and the orchestrator logging them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_THRESHOLD_MS, readingGraceMsFor, trackAttention, type AttentionKind } from "../../app/session/attention.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { allocateAndConfirm, runOutView } from "./view-flow.js";

function page() {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const logged: AttentionKind[] = [];
  const setVisibility = (state: "visible" | "hidden") => { doc.visibilityState = state; doc.dispatchEvent(new Event("visibilitychange")); };
  return { win, doc, logged, setVisibility, log: (k: AttentionKind) => logged.push(k) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("trackAttention", () => {
  it("logs one blur and one focus per change, from the window or the document's visibility", () => {
    const { win, doc, logged, setVisibility, log } = page();
    trackAttention(win, doc, log);
    win.dispatchEvent(new Event("blur"));
    setVisibility("hidden"); // the tab switched after the window blurred: the same absence
    setVisibility("visible");
    win.dispatchEvent(new Event("focus"));
    setVisibility("hidden"); // hidden without a blur first
    win.dispatchEvent(new Event("focus"));
    expect(logged).toEqual(["window_blur", "window_focus", "window_blur", "window_focus"]);
  });

  it("starts an idle period after 5 s without input and ends it at the next input", async () => {
    const { win, doc, logged, log } = page();
    trackAttention(win, doc, log);
    expect(IDLE_THRESHOLD_MS).toBe(5_000);
    await vi.advanceTimersByTimeAsync(3_000);
    win.dispatchEvent(new Event("pointermove")); // input resets the threshold
    await vi.advanceTimersByTimeAsync(4_999);
    expect(logged).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(logged).toEqual(["idle_start"]);
    await vi.advanceTimersByTimeAsync(20_000); // one record per idle period
    win.dispatchEvent(new Event("keydown"));
    expect(logged).toEqual(["idle_start", "idle_end"]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(logged).toEqual(["idle_start", "idle_end", "idle_start"]);
  });

  it("removes its listeners and its timer when detached", async () => {
    const { win, doc, logged, setVisibility, log } = page();
    const detach = trackAttention(win, doc, log);
    detach();
    win.dispatchEvent(new Event("blur"));
    setVisibility("hidden");
    await vi.advanceTimersByTimeAsync(60_000);
    win.dispatchEvent(new Event("pointerdown"));
    expect(logged).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("idle net of waits on the session (P1-8, 7 Oct 2026)", () => {
  function waitable() {
    let listener: ((waiting: boolean, readingMs?: number) => void) | null = null;
    return { onWaitingChange: (l: (waiting: boolean, readingMs?: number) => void) => { listener = l; return () => { listener = null; }; }, set: (w: boolean, readingMs?: number) => listener?.(w, readingMs), attached: () => listener !== null };
  }

  it("reading time after an answer (P1-1, 8 Oct 2026): 15 s + 1 s per 60 characters, at most 60 s", () => {
    expect(readingGraceMsFor(0)).toBe(15_000);
    expect(readingGraceMsFor(600)).toBe(25_000);
    expect(readingGraceMsFor(601)).toBe(26_000);
    expect(readingGraceMsFor(100_000)).toBe(60_000);
  });

  it("counts the reading time after an answer as not idle; the threshold applies after it", async () => {
    const { win, doc, logged, log } = page();
    const w = waitable();
    trackAttention(win, doc, log, { onWaitingChange: w.onWaitingChange });
    w.set(true);
    await vi.advanceTimersByTimeAsync(3_000);
    w.set(false, 20_000); // the answer arrived: 20 s of reading
    await vi.advanceTimersByTimeAsync(24_999);
    expect(logged).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(logged).toEqual(["idle_start"]); // 20 s reading + the 5 s threshold
  });

  it("input during the reading time does not bring the 5 s threshold forward", async () => {
    const { win, doc, logged, log } = page();
    const w = waitable();
    trackAttention(win, doc, log, { onWaitingChange: w.onWaitingChange });
    w.set(true);
    w.set(false, 20_000);
    await vi.advanceTimersByTimeAsync(10_000);
    win.dispatchEvent(new Event("pointermove"));
    await vi.advanceTimersByTimeAsync(9_999);
    expect(logged).toEqual([]); // still within the 20 s of reading
    await vi.advanceTimersByTimeAsync(5_001);
    expect(logged).toEqual(["idle_start"]);
  });

  it("counts no idle time during a wait, ends a running idle period when one starts, and restarts the threshold after it", async () => {
    const { win, doc, logged, log } = page();
    const details: unknown[] = [];
    const w = waitable();
    const detach = trackAttention(win, doc, (k, d) => { log(k); details.push(d); }, { onWaitingChange: w.onWaitingChange });
    w.set(true); // e.g. a Thinker request pending
    await vi.advanceTimersByTimeAsync(30_000);
    expect(logged).toEqual([]);
    w.set(false);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(logged).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(logged).toEqual(["idle_start"]);
    w.set(true); // a freeze opens during the idle period: it ends there
    expect(logged).toEqual(["idle_start", "idle_end"]);
    expect(details.at(-1)).toEqual({ endedBy: "wait_started" });
    win.dispatchEvent(new Event("pointermove")); // input during the wait starts no timer
    await vi.advanceTimersByTimeAsync(20_000);
    expect(logged).toEqual(["idle_start", "idle_end"]);
    detach();
    expect(w.attached()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("the snapshot says the participant waits while the freeze is open and while a Thinker request is pending", async () => {
    const scenario = buildDemoScenario();
    let fail: ((e: Error) => void) | null = null;
    const transport = () => new Promise<never>((_, reject) => { fail = reject; });
    const o = new SessionOrchestrator(scenario, "substitutive", { thinker: { transport, wait: () => Promise.resolve() } });
    let snap: SessionSnapshot | null = null;
    o.subscribe((s) => (snap = s));
    await o.start();
    expect(snap!.waitingOnSession).toBe(false);
    await vi.advanceTimersByTimeAsync(scenario.practice.cycle.freezeAtSeconds! * 1000);
    expect(snap!.step).toBe("freeze");
    expect(snap!.waitingOnSession).toBe(true); // the practice freeze
    await o.submitFreeze([]);
    expect(snap!.waitingOnSession).toBe(false);
    await runOutView(o, () => snap!);
    await allocateAndConfirm(o);
    await o.completeTraining(); // V1: Thinker is offered
    const answer = o.askAiChat("missä kärki on?");
    await vi.advanceTimersByTimeAsync(0);
    expect(snap!.waitingOnSession).toBe(true);
    fail!(new Error("offline")); // the local fallback answers
    await answer;
    expect(snap!.waitingOnSession).toBe(false);
  });

  it("logs idle_end's cause", async () => {
    const o = new SessionOrchestrator(buildDemoScenario(), "directed");
    await o.start();
    await o.logAttention("idle_start");
    await o.logAttention("idle_end", { endedBy: "wait_started" });
    expect((await o.logRecords()).filter((r) => r.kind === "idle_end").map((r) => r.detail)).toEqual([{ endedBy: "wait_started" }]);
  });
});

describe("SessionOrchestrator.logAttention", () => {
  const scenario = buildDemoScenario();

  it("logs the records with the session's real-time offset", async () => {
    const o = new SessionOrchestrator(scenario, "directed");
    await o.start();
    await vi.advanceTimersByTimeAsync(2_000);
    await o.logAttention("window_blur");
    await o.logAttention("window_focus");
    await o.logAttention("idle_start");
    await o.logAttention("idle_end");
    const records = (await o.logRecords()).filter((r) => ["window_blur", "window_focus", "idle_start", "idle_end"].includes(r.kind));
    expect(records.map((r) => [r.kind, r.detail])).toEqual([["window_blur", {}], ["window_focus", {}], ["idle_start", {}], ["idle_end", {}]]);
    expect(records[0]!.tWallOffsetMs).toBe(2_000);
  });

  it("logs nothing before the consent decision", async () => {
    const o = new SessionOrchestrator(scenario, "directed", { studyShell: true });
    await o.start();
    await o.logAttention("window_blur");
    expect((await o.logRecords()).some((r) => r.kind === "window_blur")).toBe(false);
  });
});
