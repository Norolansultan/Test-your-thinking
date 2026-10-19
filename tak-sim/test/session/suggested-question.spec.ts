/**
 * The guide's suggested-question chip (SPEC/30 §4): offered only in the guide group (`reasoning_intent`), only from V8
 * (the directive in force); never in the Haku group, in `reasoning_once`, before V8 or in the practice view. It submits
 * exactly its question, in the session language, through the Thinker's normal path (the proxy request, the answer
 * record), and `ai_chat_query_submitted` carries `viaChip: true`; a typed question carries no such field.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SUGGESTED_QUESTION, suggestedQuestionOffered } from "../../app/session/consult-notice.js";
import type { OpenThinkerResponse } from "../../app/session/thinker-protocol.js";
import type { OpenThinkerTransport } from "../../app/session/thinker-transport.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { atView, ofKind, startSession } from "./spec30-helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const OPEN: OpenThinkerResponse = {
  answer: "Two records changed since your plan.", retrieved: [], modelId: "test-model", promptHash: "b".repeat(64), latencyMs: 2_900,
  fallback: false, fallbackReason: null, retrievalMode: "hybrid", promptVariant: "standard",
};

describe("the suggested question (SPEC/30 §4)", () => {
  it("the rule: the guide group only, from the view after the hinge view", () => {
    expect(suggestedQuestionOffered("reasoning_intent", 8, 7)).toBe(true);
    expect(suggestedQuestionOffered("reasoning_intent", 14, 7)).toBe(true);
    expect(suggestedQuestionOffered("reasoning_intent", 7, 7)).toBe(false);
    expect(suggestedQuestionOffered("reasoning_once", 8, 7)).toBe(false);
    expect(suggestedQuestionOffered("radio", 8, 7)).toBe(false);
    expect(SUGGESTED_QUESTION.en).toBe("What has changed that matters for my plan?");
    expect(SUGGESTED_QUESTION.fi).toBe("Mikä on muuttunut niin, että sillä on merkitystä suunnitelmalleni?");
    // The chip's label is the question itself, in each language.
    expect(UI_TEXT.en.consult.chip).toBe(SUGGESTED_QUESTION.en);
    expect(UI_TEXT.fi.consult.chip).toBe(SUGGESTED_QUESTION.fi);
  });

  it("in the guide group from V8: submits exactly its question through the Thinker, logged viaChip; a typed question is not", async () => {
    const openTransport = vi.fn<OpenThinkerTransport>().mockResolvedValue(OPEN);
    const { o, snap } = await atView(8, "reasoning_intent", { language: "en", thinker: { openTransport } });
    expect(snap().suggestedQuestion).toBe(true);
    const asked = o.askSuggestedQuestion();
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(asked).resolves.toBe(OPEN.answer);
    expect(openTransport).toHaveBeenCalledTimes(1);
    expect(openTransport.mock.calls[0]![0]).toMatchObject({ question: "What has changed that matters for my plan?", cell: "reasoning_intent", view: 8 });
    const typed = o.askOpenThinker("Where is the head?");
    await vi.advanceTimersByTimeAsync(3_000);
    await typed;
    const records = await o.logRecords();
    const queries = ofKind(records, "ai_chat_query_submitted").filter((r) => (r.detail as { view: number }).view === 8).map((r) => r.detail as Record<string, unknown>);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toMatchObject({ text: "What has changed that matters for my plan?", tool: "open_thinker", viaChip: true, view: 8 });
    expect(queries[1]).toMatchObject({ text: "Where is the head?", tool: "open_thinker" });
    expect(queries[1]).not.toHaveProperty("viaChip");
    // The normal path: its answer is logged and shown like any other.
    expect(ofKind(records, "ai_chat_answer_received").filter((r) => (r.detail as { view: number }).view === 8)).toHaveLength(2);
    expect(snap().openThinkerHistory.map((t) => t.query)).toEqual(["What has changed that matters for my plan?", "Where is the head?"]);
  });

  it("a Finnish session submits the Finnish question", async () => {
    const openTransport = vi.fn<OpenThinkerTransport>().mockResolvedValue(OPEN);
    const { o } = await atView(9, "reasoning_intent", { language: "fi", thinker: { openTransport } });
    const asked = o.askSuggestedQuestion();
    await vi.advanceTimersByTimeAsync(3_000);
    await asked;
    expect(openTransport.mock.calls[0]![0]).toMatchObject({ question: SUGGESTED_QUESTION.fi, language: "fi" });
    expect(ofKind(await o.logRecords(), "ai_chat_query_submitted").at(-1)!.detail).toMatchObject({ text: SUGGESTED_QUESTION.fi, viaChip: true });
  });

  it("not before V8, not in reasoning_once, not in the Haku group, not in the practice view: not offered, and refused", async () => {
    const vp = await startSession("reasoning_intent");
    expect(vp.snap().suggestedQuestion).toBe(false);
    await expect(vp.o.askSuggestedQuestion()).rejects.toThrow(/the chip is the guide group's/);
    const v7 = await atView(7, "reasoning_intent");
    expect(v7.snap().suggestedQuestion).toBe(false);
    await expect(v7.o.askSuggestedQuestion()).rejects.toThrow(/the chip is the guide group's/);
    for (const cell of ["reasoning_once", "radio"] as const) {
      const v8 = await atView(8, cell);
      expect(v8.snap().suggestedQuestion, cell).toBe(false);
      await expect(v8.o.askSuggestedQuestion(), cell).rejects.toThrow(/the chip is the guide group's/);
      expect(ofKind(await v8.o.logRecords(), "ai_chat_query_submitted").some((r) => (r.detail as { viaChip?: boolean }).viaChip)).toBe(false);
    }
  });

  it("is refused where the Thinker is (a step without the tools: the plan-confidence item after the view's end)", async () => {
    const { o, snap } = await atView(9, "reasoning_intent"); // V9: no SPAM item to force at the end
    await vi.advanceTimersByTimeAsync(130_000);
    await o.submitAllocation({ mainEffort: "L2", posture: "direct_attack", secondary: null, drones: null });
    expect(snap()).toMatchObject({ step: "plan_confidence", toolsLocked: true });
    await expect(o.askSuggestedQuestion()).rejects.toThrow(/Haku and Thinker work only inside a view/);
  });
});
