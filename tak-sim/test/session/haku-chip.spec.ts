/**
 * The Haku group's suggested-question chip (SPEC/30 §4 revision (bf), 24 Oct 2026): the counterpart of the guide's chip, so that both
 * groups get one content-free prompt in their own tool under the same conditions and timing. Offered only in the Haku group (`radio`),
 * only from V8 (the views the guide's chip is offered in); never in the guide group's Haku tab, in `reasoning_once`, before V8 or in
 * the practice view. It submits exactly its question, in the session language, through Haku's normal path (the proxy request, the
 * answer record, the history), and `ai_chat_query_submitted` carries `tool: "haku"` and `viaChip: true`; a typed question does not.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HAKU_SUGGESTED_QUESTION, hakuChipOffered, suggestedQuestionOffered } from "../../app/session/consult-notice.js";
import type { ThinkerResponse } from "../../app/session/thinker-protocol.js";
import type { ThinkerTransport } from "../../app/session/thinker-transport.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { HINGE_AFTER_VIEW, MAIN_VIEW_COUNT } from "../../app/scenario/views.js";
import { atView, ofKind, startSession } from "./spec30-helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const HAKU: ThinkerResponse = {
  answer: { vastaus: "Two new reports.", perusteet: "EK11 at 16.45", varmuus: "probable", muuttaisi: "A new report." },
  retrieved: [], modelId: "test-model", promptHash: "a".repeat(64), latencyMs: 2_600, fallback: false, fallbackReason: null,
  retrievalMode: "hybrid", promptVariant: "standard",
};

describe("the Haku chip (SPEC/30 §4 revision (bf))", () => {
  it("the rule: the Haku group only, in exactly the views the guide's chip is offered in", () => {
    for (let view = 0; view <= MAIN_VIEW_COUNT; view++) {
      expect(hakuChipOffered("radio", view, HINGE_AFTER_VIEW), `V${view}`).toBe(suggestedQuestionOffered("reasoning_intent", view, HINGE_AFTER_VIEW));
      expect(hakuChipOffered("reasoning_intent", view, HINGE_AFTER_VIEW)).toBe(false);
      expect(hakuChipOffered("reasoning_once", view, HINGE_AFTER_VIEW)).toBe(false);
    }
    expect(hakuChipOffered("radio", 8, 7)).toBe(true);
    expect(hakuChipOffered("radio", 7, 7)).toBe(false);
  });

  it("is content-free, and its label is the question itself", () => {
    expect(HAKU_SUGGESTED_QUESTION.en).toBe("What is new in this period's records?");
    expect(HAKU_SUGGESTED_QUESTION.fi).toBe("Mitä uutta tällä jaksolla on kirjattu?");
    expect(UI_TEXT.en.consult.hakuChip).toBe(HAKU_SUGGESTED_QUESTION.en);
    expect(UI_TEXT.fi.consult.hakuChip).toBe(HAKU_SUGGESTED_QUESTION.fi);
    // No topic, unit, sector, record or plan word: nothing the guide's chip has that a search prompt should not.
    for (const q of Object.values(HAKU_SUGGESTED_QUESTION)) expect(q).not.toMatch(/plan|suunnitel|L\d|EK\d|fire|palo|head|front|rintam|road|tie\b/i);
  });

  it("in the Haku group from V8: submits exactly its question through Haku, logged viaChip with tool haku; a typed question is not", async () => {
    const transport = vi.fn<ThinkerTransport>().mockResolvedValue(HAKU);
    const { o, snap } = await atView(8, "radio", { language: "en", thinker: { transport } });
    expect(snap().hakuChip).toBe(true);
    expect(snap().suggestedQuestion).toBe(false); // one chip per group
    const asked = o.askHakuChip();
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(asked).resolves.toMatchObject({ answerFi: "Two new reports.", certaintyFi: "probable" });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0]![0]).toMatchObject({ question: HAKU_SUGGESTED_QUESTION.en, cell: "radio", view: 8, language: "en" });
    const typed = o.askAiChat("Where is the head?");
    await vi.advanceTimersByTimeAsync(3_000);
    await typed;
    const records = await o.logRecords();
    const queries = ofKind(records, "ai_chat_query_submitted").filter((r) => (r.detail as { view: number }).view === 8).map((r) => r.detail as Record<string, unknown>);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toMatchObject({ text: HAKU_SUGGESTED_QUESTION.en, tool: "haku", viaChip: true, view: 8 });
    expect(queries[1]).toMatchObject({ text: "Where is the head?", tool: "haku" });
    expect(queries[1]).not.toHaveProperty("viaChip");
    // The normal path: its answer is logged and shown like any other Haku answer.
    expect(ofKind(records, "ai_chat_answer_received").filter((r) => (r.detail as { view: number; tool: string }).view === 8 && (r.detail as { tool: string }).tool === "haku")).toHaveLength(2);
    expect(snap().aiChatHistory.map((t) => t.query).slice(-2)).toEqual([HAKU_SUGGESTED_QUESTION.en, "Where is the head?"]);
  });

  it("a Finnish session submits the Finnish question", async () => {
    const transport = vi.fn<ThinkerTransport>().mockResolvedValue(HAKU);
    const { o } = await atView(12, "radio", { language: "fi", thinker: { transport } });
    const asked = o.askHakuChip();
    await vi.advanceTimersByTimeAsync(3_000);
    await asked;
    expect(transport.mock.calls[0]![0]).toMatchObject({ question: HAKU_SUGGESTED_QUESTION.fi, language: "fi" });
    expect(ofKind(await o.logRecords(), "ai_chat_query_submitted").at(-1)!.detail).toMatchObject({ text: HAKU_SUGGESTED_QUESTION.fi, tool: "haku", viaChip: true });
  });

  it("not before V8, not in the guide group or reasoning_once, not in the practice view: not offered, and refused", async () => {
    const vp = await startSession("radio");
    expect(vp.snap().hakuChip).toBe(false);
    await expect(vp.o.askHakuChip()).rejects.toThrow(/the Haku chip is the Haku group's/);
    const v7 = await atView(7, "radio");
    expect(v7.snap().hakuChip).toBe(false);
    await expect(v7.o.askHakuChip()).rejects.toThrow(/the Haku chip is the Haku group's/);
    for (const cell of ["reasoning_intent", "reasoning_once"] as const) {
      const v8 = await atView(8, cell);
      expect(v8.snap().hakuChip, cell).toBe(false);
      await expect(v8.o.askHakuChip(), cell).rejects.toThrow(/the Haku chip is the Haku group's/);
      expect(ofKind(await v8.o.logRecords(), "ai_chat_query_submitted").some((r) => (r.detail as { tool?: string; viaChip?: boolean }).tool === "haku" && (r.detail as { viaChip?: boolean }).viaChip)).toBe(false);
    }
  });
});
