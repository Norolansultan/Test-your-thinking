/**
 * I5 at the screen (final review, 6 Oct 2026): every participant step whose record the session writes
 * moves the screen on only once that record is durable — SPAM's "ready" and option, "Change
 * allocation", the hinge check's question and answer — and the freeze is shown once `freeze_started`
 * is durable. A sink holds its writes until released; the snapshot must not move while it does.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { InMemoryLogSink, type LogRecord, type LogSink } from "../../app/telemetry/log.js";
import { allocateAndConfirm, runOutView } from "./view-flow.js";
import { withPracticeFreeze } from "./practice-freeze-fixture.js";

/** Revision (bp): the built VP has no freeze; the freeze here is the fixture's, in VP at the retired moment. */
const scenario = withPracticeFreeze(buildDemoScenario());

/** A sink whose writes wait while it is held (a slow IndexedDB commit). */
class HeldSink implements LogSink {
  private readonly inner = new InMemoryLogSink();
  private held = false;
  private waiting: (() => void)[] = [];
  hold(): void { this.held = true; }
  get pending(): number { return this.waiting.length; }
  release(): void { this.held = false; const w = this.waiting; this.waiting = []; for (const f of w) f(); }
  async append(record: LogRecord): Promise<void> {
    if (this.held) await new Promise<void>((resolve) => this.waiting.push(resolve));
    await this.inner.append(record);
  }
  readAll() { return this.inner.readAll(); }
}

function start() {
  const sink = new HeldSink();
  const o = new SessionOrchestrator(scenario, "directed", { sink, realClockMs: () => Date.now() });
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  return { o, sink, snap: () => box.snap! };
}

/** Lets every pending microtask and zero-delay timer run. */
const settle = () => vi.advanceTimersByTimeAsync(0);

async function completeView(o: SessionOrchestrator, snap: () => SessionSnapshot): Promise<void> {
  await runOutView(o, snap);
  await allocateAndConfirm(o, snap);
  if (snap().step === "training") await o.completeTraining();
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the screen moves on only once the record is durable (I5)", () => {
  it("the freeze shows once freeze_started is durable; SPAM's question once spam_ready is, its confidence once spam_answered is", async () => {
    const { o, sink, snap } = start();
    await o.start();
    const freezeAt = scenario.practice.cycle.freezeAtSeconds!;
    await vi.advanceTimersByTimeAsync(freezeAt * 1000 - 500);
    expect(snap().step).not.toBe("freeze");
    sink.hold();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(snap().step).not.toBe("freeze");
    sink.release();
    await settle();
    expect(snap().step).toBe("freeze");
    expect((await o.logRecords()).at(-1)!.kind).toBe("freeze_started");
    await o.submitFreeze([]);

    // The ready prompt shows once spam_prompt_shown is durable (fix pass 2, 7 Oct 2026).
    sink.hold();
    let promptHeld = false;
    for (let s = 0; s < 300 && snap().spam === null; s++) {
      await vi.advanceTimersByTimeAsync(1_000);
      if (sink.pending === 0) continue;
      expect(snap().spam).toBeNull(); // a write is pending: nothing new on screen yet
      sink.release();
      await settle();
      promptHeld ||= snap().spam !== null;
      if (snap().spam === null) sink.hold();
    }
    expect(promptHeld).toBe(true);
    expect((await o.logRecords()).at(-1)!.kind).toBe("spam_prompt_shown");
    expect(snap().spam!.phase).toBe("ready");
    sink.hold();
    const ready = o.spamReady();
    await settle();
    expect(snap().spam!.phase).toBe("ready");
    sink.release();
    await ready;
    expect(snap().spam!.phase).toBe("item");

    const optionId = (snap().spam as { options: readonly { id: string }[] }).options[0]!.id;
    sink.hold();
    const answered = o.answerSpam(optionId);
    await settle();
    expect(snap().spam!.phase).toBe("item");
    sink.release();
    await answered;
    expect(snap().spam!.phase).toBe("confidence");
    await o.submitSpamConfidence(50);
  });

  it("'Change allocation' opens the plan again once allocation_revision_opened is durable", async () => {
    const { o, sink, snap } = start();
    await o.start();
    await completeView(o, snap); // VP, then the training
    expect(snap().currentCycle).toBe(1);
    while (snap().step !== "allocation") await vi.advanceTimersByTimeAsync(1_000);
    await allocateAndConfirm(o, snap);
    expect(snap().step).toBe("awaiting_view_end");
    sink.hold();
    const revising = o.reviseAllocation();
    await settle();
    expect(snap()).toMatchObject({ step: "awaiting_view_end", revisingAllocation: false });
    expect(() => o.reviseAllocation()).toThrow(/reviseAllocation/); // a second click while it is written
    sink.release();
    await revising;
    expect(snap()).toMatchObject({ step: "allocation", revisingAllocation: true });
    expect((await o.logRecords()).at(-1)!.kind).toBe("allocation_revision_opened");
  });

  it("a revision being opened when the view's minimum passes does not reopen the plan: the view ends", async () => {
    const { o, sink, snap } = start();
    await o.start();
    await completeView(o, snap);
    while (snap().step !== "allocation") await vi.advanceTimersByTimeAsync(1_000);
    await allocateAndConfirm(o, snap);
    while (snap().secondsLeft === null || snap().secondsLeft! > 1) await vi.advanceTimersByTimeAsync(1_000);
    sink.hold();
    const revising = o.reviseAllocation();
    await vi.advanceTimersByTimeAsync(2_000);
    sink.release();
    await revising;
    await settle();
    expect(snap()).toMatchObject({ currentCycle: 1, step: "plan_confidence", revisingAllocation: false }); // SPEC/30 §5.4: ended; the plan's confidence
    await o.submitPlanConfidence(50);
    expect(snap()).toMatchObject({ currentCycle: 2, step: "exploration", revisingAllocation: false });
  });

  it("the hinge check's question shows once hinge_check_presented is durable, Continue once the answer is", async () => {
    const { o, sink, snap } = start();
    await o.start();
    while (snap().step !== "hinge_pause") await completeView(o, snap);
    expect(snap().hingeCheck!.phase).toBe("directive");
    sink.hold();
    const shown = o.showHingeCheck();
    await settle();
    expect(snap().hingeCheck!.phase).toBe("directive");
    sink.release();
    await shown;
    expect(snap().hingeCheck!.phase).toBe("item");
    sink.hold();
    const answered = o.answerHingeCheck(snap().hingeCheck!.options[0]!.id);
    await settle();
    expect(snap().hingeCheck!.phase).toBe("item");
    sink.release();
    await answered;
    expect(snap().hingeCheck!.phase).toBe("answered");
  }, 60_000);
});
