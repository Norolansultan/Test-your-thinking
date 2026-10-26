/**
 * Resume in the training incident (SPEC/15 (bp) §bp.4; SPEC/07 (bp): the log alone restores it), over the fixture: at every stage —
 * the intro; an item whose answer is logged (its feedback again, the answer standing) or not (its question; a card with a fresh
 * window; the memory exposure in full); a section card not shown again once one of its items is logged; the cap what is left after
 * the active time logged, none left → the rest missing and S5; S5 not left → S5 again; completed → not shown again. The Haku turns
 * return from `training_haku_*`; `session_resumed.resumedAt` is `training_incident`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryLogSink, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import { shellResumeStep } from "../../app/session/shell-resume.js";
import { keptTrainingOf } from "../../app/session/training/resume.js";
import type { TrainingCompletedDetail, TrainingHakuAskedDetail, TrainingStartedDetail } from "../../app/telemetry/record-kinds-training.js";
import { TRAINING_FIXTURE } from "./training-fixture.js";
import { driveTo, kinds, newTrainingSession, ofKind, passTraining, trainingMove } from "./training-run.js";
import type { SessionOrchestrator, SessionSnapshot } from "../../app/session/orchestrator.js";

vi.mock("../../app/session/training/spec-data.js", async () => ({ TRAINING: (await import("./training-fixture.js")).TRAINING_FIXTURE }));
vi.mock("../../app/session/training/corpus.js", async () => {
  const f = await import("./training-fixture.js");
  return { TRAINING_VIEW: { startsAtVirtual: -12_000, steps: 1 }, TRAINING_STEP: -9, TRAINING_NOW_S: -10_920, TRAINING_ATOMS: f.TRAINING_ATOMS_FIXTURE, trainingLogRows: f.trainingLogRowsFixture };
});
vi.mock("../../app/i18n/training-texts.js", async () => ({ TRAINING_TEXT: (await import("./training-fixture.js")).TRAINING_TEXT_FIXTURE }));

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => vi.useRealTimers());

const spec = TRAINING_FIXTURE;
const ITEM_IDS = spec.items.map((it) => it.id);

/** A first session interrupted where `until` says; its sink and records. */
async function interrupted(until: (s: SessionSnapshot) => boolean, extra?: (o: SessionOrchestrator, snap: () => SessionSnapshot) => Promise<void>) {
  const sink = new InMemoryLogSink();
  const first = newTrainingSession({ sink });
  await first.o.start();
  await driveTo(first.o, first.snap);
  await passTraining(first.o, first.snap, spec, until);
  if (extra) await extra(first.o, first.snap);
  vi.clearAllTimers();
  return { sink, records: await sink.readAll() };
}

async function resume(sink: InMemoryLogSink, records: readonly LogRecord[]) {
  const ctx = newTrainingSession({ sink, resume: { header: records[0]!.detail as LogHeader, records, interruptedForMs: 5_000 } });
  await ctx.o.start();
  return ctx;
}

describe("resume in the training incident (SPEC/15 (bp) §bp.4)", () => {
  it("re-enters the training with the study shell; `session_resumed.resumedAt` is training_incident; nothing logged: the intro again", async () => {
    const { sink, records } = await interrupted((s) => s.training?.phase === "intro");
    expect(shellResumeStep({ kind: "briefing" }, records, { aiLiteracyOn: true, isPublic: false, trainingOn: true })).toBe("training_incident");
    const { o, snap } = await resume(sink, records);
    expect(snap().step).toBe("training_incident");
    expect(snap().training!.phase).toBe("intro");
    expect(o.engineState).toBe("BRIEFING");
    const after = await sink.readAll();
    expect(ofKind<{ resumedAt: string }>(after, "session_resumed")[0]!.resumedAt).toBe("training_incident");
    expect(ofKind<TrainingStartedDetail>(after, "training_started").at(-1)).toMatchObject({ resumed: true, keptItemIds: [], remainingMs: 720_000 });
  });

  it("an item answered, its feedback not left: its feedback again, the answer standing; the cap charged with the active time", async () => {
    const third = spec.items[2]!;
    const { sink, records } = await interrupted((s) => s.training?.itemId === third.id && s.training.phase === "question", async (o) => {
      await vi.advanceTimersByTimeAsync(7_000);
      await o.answerTraining(third.id, { choiceId: third.options[0]!.id });
    });
    const kept = keptTrainingOf(records);
    expect([...kept.done]).toEqual(ITEM_IDS.slice(0, 2));
    const { o, snap } = await resume(sink, records);
    expect(snap().training).toMatchObject({ phase: "feedback", itemId: third.id, answer: { choiceId: third.options[0]!.id } });
    const started = ofKind<TrainingStartedDetail>(await sink.readAll(), "training_started").at(-1)!;
    expect(started).toMatchObject({ resumed: true, keptItemIds: ITEM_IDS.slice(0, 2), remainingMs: 720_000 - kept.spentMs });
    expect(kept.spentMs).toBeGreaterThanOrEqual(7_000);
    await passTraining(o, snap, spec);
    const all = await sink.readAll();
    // Each item answered once across the interruption; every feedback left once.
    expect(ofKind<{ itemId: string }>(all, "training_answer").map((d) => d.itemId)).toEqual(ITEM_IDS);
    expect(ofKind<{ itemId: string }>(all, "training_feedback_left").map((d) => d.itemId)).toEqual(ITEM_IDS);
    expect(snap().step).toBe("briefing");
  });

  it("an item not answered: its question again — a card with a fresh 60 s, its section card not shown again once an item of it is logged", async () => {
    const cards = spec.items.filter((it) => it.mode === "card");
    const { sink, records } = await interrupted((s) => s.training?.itemId === cards[1]!.id && s.training.phase === "question", async () => { await vi.advanceTimersByTimeAsync(40_000); });
    const { o, snap } = await resume(sink, records);
    expect(snap().training).toMatchObject({ phase: "question", itemId: cards[1]!.id });
    expect(o.trainingCardSecondsLeft()).toBe(60);
  });

  it("a section's first item not answered: its card again (none of its items is logged)", async () => {
    const s2 = spec.items.find((it) => it.section === "s2")!;
    const { sink, records } = await interrupted((s) => s.training?.itemId === s2.id && s.training.phase === "question");
    const { snap } = await resume(sink, records);
    expect(snap().training).toMatchObject({ phase: "section", sectionId: "s2", itemId: null });
  });

  it("the memory item not answered: (its section's card, none of its items logged, then) its exposure in full again", async () => {
    const memory = spec.items.find((it) => it.memory)!;
    const { sink, records } = await interrupted((s) => s.training?.itemId === memory.id && s.training.phase === "question");
    const { o, snap } = await resume(sink, records);
    if (snap().training!.phase === "section") await o.trainingLeaveSection();
    expect(snap().training).toMatchObject({ phase: "study", itemId: memory.id });
    expect(o.trainingStudySecondsLeft()).toBe(8);
  });

  it("no time left after the active time logged: the unanswered items are missing and S5 shows (endReason timeout)", async () => {
    const second = spec.items[1]!;
    const { sink, records } = await interrupted((s) => s.training?.itemId === second.id && s.training.phase === "question", async (o) => {
      await vi.advanceTimersByTimeAsync(7_000);
      await o.answerTraining(second.id, { choiceId: second.options[0]!.id });
    });
    // The rule, read from the log: the active time logged (here the answer's rtMs, set to the whole cap) is charged against the cap.
    const charged = records.map((r) => (r.kind === "training_answer" && (r.detail as { itemId: string }).itemId === second.id ? { ...r, detail: { ...(r.detail as object), rtMs: 720_000 } } : r));
    const replaced = new InMemoryLogSink();
    for (const r of charged) await replaced.append(r);
    const { o, snap } = await resume(replaced, charged);
    expect(ofKind<TrainingStartedDetail>(await replaced.readAll(), "training_started").at(-1)).toMatchObject({ resumed: true, remainingMs: 0 });
    expect(snap().training).toMatchObject({ phase: "demo" });
    await vi.advanceTimersByTimeAsync(10_000);
    await o.leaveTrainingDemo();
    const end = ofKind<TrainingCompletedDetail>(await replaced.readAll(), "training_completed")[0]!;
    expect(end).toMatchObject({ endReason: "timeout", answeredCount: 2, missingItemIds: ITEM_IDS.slice(2), durationMs: 720_000 });
  });

  it("S5 not left: S5 again; completed: not shown again", async () => {
    const { sink, records } = await interrupted((s) => s.training?.phase === "demo");
    const { o, snap } = await resume(sink, records);
    expect(snap().training).toMatchObject({ phase: "demo" });
    await vi.advanceTimersByTimeAsync(10_000);
    await o.leaveTrainingDemo();
    const end = ofKind<TrainingCompletedDetail>(await sink.readAll(), "training_completed")[0]!;
    expect(end).toMatchObject({ endReason: "completed", answeredCount: ITEM_IDS.length, missingItemIds: [] });
    vi.clearAllTimers();
    const done = await sink.readAll();
    expect(shellResumeStep({ kind: "briefing" }, done, { aiLiteracyOn: true, isPublic: false, trainingOn: true })).toBeNull();
    const again = await resume(sink, done);
    expect(again.snap().step).toBe("briefing"); // the intro video
    expect(kinds((await sink.readAll()).slice(done.length)).some((k) => k.startsWith("training_"))).toBe(false);
  });

  it("S3's Haku turns return from training_haku_*, and the question ids continue", async () => {
    const card = spec.items.find((it) => it.mode === "card")!;
    const { sink, records } = await interrupted((s) => s.training?.itemId === card.id && s.training.phase === "question", async (o) => {
      await o.askAiChat("ensimmäinen kysymys");
      await o.askTrainingHaku("toinen kysymys");
    });
    const { o, snap } = await resume(sink, records);
    if (snap().training!.phase === "section") await o.trainingLeaveSection(); // S3's card again: none of its items was logged
    expect(snap().training).toMatchObject({ phase: "question", itemId: card.id });
    expect(snap().aiChatHistory.map((t) => t.query)).toEqual(["ensimmäinen kysymys", "toinen kysymys"]);
    await o.askAiChat("kolmas");
    const asked = ofKind<TrainingHakuAskedDetail>(await sink.readAll(), "training_haku_asked");
    expect(asked.map((a) => a.queryId)).toEqual(["trn.1", "trn.2", "trn.3"]);
    await trainingMove(o, snap, spec); // the card answered: its hakuBefore counts all three
    const answer = ofKind<{ itemId: string; hakuBefore?: number }>(await sink.readAll(), "training_answer").at(-1)!;
    expect(answer).toMatchObject({ itemId: card.id, hakuBefore: 3 });
  });
});
