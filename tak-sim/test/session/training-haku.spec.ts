/**
 * The training's Haku (SPEC/14 (bp) §bp.1–§bp.2, SPEC/07 (bp)), over the fixture: the session's Haku pane's own call (`askAiChat`) is
 * routed to the training in S3; the request is the session's `ThinkerTransport` request with `corpus: "training"`, `view` 0 and the
 * training's "now"; a model answer, a bridge answer, and the local template over the training's records (a failure, or an answer that
 * retrieved a session record or not lexically); `training_haku_asked` durable before the answer, `training_haku_answered` with it;
 * never `ai_chat_*`; Haku closed outside S3.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRAINING_FIXTURE } from "./training-fixture.js";
import { driveTo, kinds, newTrainingSession, ofKind, passTraining } from "./training-run.js";
import { DEMO_BRIDGE_MODEL_ID, THINKER_LATENCY_FLOOR_MS, type ThinkerRequest, type ThinkerResponse } from "../../app/session/thinker-protocol.js";
import type { TrainingHakuAnsweredDetail, TrainingHakuAskedDetail } from "../../app/telemetry/record-kinds-training.js";

vi.mock("../../app/session/training/spec-data.js", async () => ({ TRAINING: (await import("./training-fixture.js")).TRAINING_FIXTURE }));
vi.mock("../../app/session/training/corpus.js", async () => {
  const f = await import("./training-fixture.js");
  return { TRAINING_VIEW: { startsAtVirtual: -12_000, steps: 1 }, TRAINING_STEP: -9, TRAINING_NOW_S: -10_920, TRAINING_ATOMS: f.TRAINING_ATOMS_FIXTURE, trainingLogRows: f.trainingLogRowsFixture };
});
vi.mock("../../app/i18n/training-texts.js", async () => ({ TRAINING_TEXT: (await import("./training-fixture.js")).TRAINING_TEXT_FIXTURE }));

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => vi.useRealTimers());

const spec = TRAINING_FIXTURE;
const card = spec.items.find((it) => it.mode === "card")!;

const answer = (over: Partial<ThinkerResponse> = {}): ThinkerResponse => ({
  answer: { vastaus: "1,1 ha", perusteet: "DR8 klo 10.05", varmuus: "korkea", muuttaisi: "uusi kuvaus" },
  retrieved: [{ id: "trn.r01", score: 2 }], modelId: "model-x", promptHash: "a".repeat(64), latencyMs: 3_100, fallback: false, fallbackReason: null,
  retrievalMode: "lexical_only", retrievalLanguage: "fi", promptVariant: "standard", ...over,
});

async function atCard(transport: (r: ThinkerRequest) => Promise<ThinkerResponse>, wait = vi.fn(async () => undefined)) {
  const ctx = newTrainingSession({ cell: "reasoning_intent", thinker: { transport: vi.fn(transport), wait } });
  await ctx.o.start();
  await driveTo(ctx.o, ctx.snap);
  await passTraining(ctx.o, ctx.snap, spec, (s) => s.training?.itemId === card.id && s.training.phase === "question");
  return { ...ctx, wait };
}

describe("the training's Haku (SPEC/14 (bp))", () => {
  it("closed outside S3: the Haku pane's question is refused there, and the Thinker everywhere", async () => {
    const ctx = newTrainingSession();
    await ctx.o.start();
    await driveTo(ctx.o, ctx.snap);
    await passTraining(ctx.o, ctx.snap, spec, (s) => s.training?.phase === "question");
    await expect(ctx.o.askAiChat("mitä?")).rejects.toThrow(/S3 only/);
    await expect(ctx.o.askTrainingHaku("mitä?")).rejects.toThrow(/S3 only/);
    await expect(ctx.o.askOpenThinker("mitä?")).rejects.toThrow(/only inside a view/);
    expect(ctx.snap().openThinkerHistory).toEqual([]);
  });

  it("asks over the training's corpus: corpus training, view 0, the training's now; logs asked, then answered (model); no ai_chat_*", async () => {
    const seen: ThinkerRequest[] = [];
    const { o, snap, wait } = await atCard(async (r) => { seen.push(r); return answer(); });
    await vi.advanceTimersByTimeAsync(5_000);
    const shown = await o.askAiChat("Mitä DR8 ilmoitti klo 10.05?");
    expect(shown).toEqual({ answerFi: "1,1 ha", basisFi: "DR8 klo 10.05", certaintyFi: "korkea", wouldChangeIfFi: "uusi kuvaus" });
    expect(wait).toHaveBeenCalledWith(THINKER_LATENCY_FLOOR_MS);
    expect(seen[0]).toMatchObject({ corpus: "training", view: 0, virtualTimeS: -10_920, question: "Mitä DR8 ilmoitti klo 10.05?", language: "fi", cell: "reasoning_intent", condition: "substitutive", queryId: "trn.1" });
    expect(snap().aiChatHistory).toEqual([{ query: "Mitä DR8 ilmoitti klo 10.05?", answer: shown }]);
    const records = await o.logRecords();
    expect(kinds(records).filter((k) => k.startsWith("ai_chat_") || k === "tab_selected" || k.startsWith("query_"))).toEqual([]);
    const asked = ofKind<TrainingHakuAskedDetail>(records, "training_haku_asked");
    expect(asked).toEqual([{ queryId: "trn.1", itemId: card.id, text: "Mitä DR8 ilmoitti klo 10.05?", charCount: 28, atItemMs: 5_000 }]);
    const answered = ofKind<TrainingHakuAnsweredDetail>(records, "training_haku_answered");
    expect(answered[0]).toMatchObject({ queryId: "trn.1", itemId: card.id, retrieved: [{ id: "trn.r01", fusedScore: 2 }], retrievalMode: "lexical_only", answerSource: "model", modelId: "model-x", fallback: false, latencyMs: 3_100 });
    expect(kinds(records).indexOf("training_haku_asked")).toBeLessThan(kinds(records).indexOf("training_haku_answered"));
  });

  it("a demonstration bridge's answer is `bridge`", async () => {
    const { o } = await atCard(async () => answer({ modelId: DEMO_BRIDGE_MODEL_ID }));
    await o.askTrainingHaku("Onko tie R6 ajettavissa?");
    expect(ofKind<TrainingHakuAnsweredDetail>(await o.logRecords(), "training_haku_answered")[0]!.answerSource).toBe("bridge");
  });

  for (const [what, transport, reason] of [
    ["a network failure", async () => { throw new Error("offline"); }, "network_error"],
    ["an answer that retrieved a session record", async () => answer({ retrieved: [{ id: "atom.demo.1", score: 1 }] }), "invalid_output"],
    ["an answer retrieved with vectors", async () => answer({ retrievalMode: "hybrid" }), "invalid_output"],
    ["an answer of the wrong shape", async () => ({ nope: true }) as unknown as ThinkerResponse, "network_error"],
  ] as const) {
    it(`${what}: the local template over the training's records (lexical), answerSource template`, async () => {
      const { o, snap } = await atCard(transport);
      await o.askAiChat("Kuinka suuri EK51:n miehistö on?");
      const d = ofKind<TrainingHakuAnsweredDetail>(await o.logRecords(), "training_haku_answered")[0]!;
      expect(d).toMatchObject({ answerSource: "template", fallback: true, fallbackReason: reason, modelId: null, promptHash: null, retrievalMode: "lexical_only" });
      expect(d.retrieved.every((r) => r.id.startsWith("trn."))).toBe(true);
      expect(snap().aiChatHistory).toHaveLength(1);
    });
  }

  it("Haku stays open in the card's feedback (its questions keep the item's id) and closes with S3", async () => {
    const { o, snap } = await atCard(async () => answer());
    await o.answerSpam(card.options[0]!.id);
    await o.submitSpamConfidence(50);
    expect(snap().training).toMatchObject({ phase: "feedback", tools: { haku: true } });
    await o.askAiChat("Mitä DR8 ilmoitti klo 10.05?");
    expect(ofKind<TrainingHakuAskedDetail>(await o.logRecords(), "training_haku_asked")[0]!.itemId).toBe(card.id);
    const answerRecord = ofKind<{ hakuBefore: number }>(await o.logRecords(), "training_answer").at(-1)!;
    expect(answerRecord.hakuBefore).toBe(0); // asked after the answer: not counted
    await passTraining(o, snap, spec, (s) => s.training?.sectionId === "s4");
    await expect(o.askAiChat("mitä?")).rejects.toThrow(/S3 only/);
    expect(snap().aiChatHistory).toEqual([]);
  });
});
