/**
 * SPEC/30 §5.5: the source-memory measures (`source-memory-measures.ts`) on synthetic logs — the answer, whether an AI answer (either
 * tool) stated the fact before the post-session block, whether its record reached the participant (shown, not merely retrieved), who
 * came first, and the misattribution flag.
 */

import { describe, expect, it } from "vitest";
import { SOURCE_MEMORY_FACTS, sourceItemId } from "../../app/scenario/source-memory.js";
import { aiAnswerText, sourceMemoryMeasures, sourceMemorySummary, type SourceMemoryRow } from "../../app/telemetry/source-memory-measures.js";
import type { LogRecord } from "../../app/telemetry/log.js";

const RATE = SOURCE_MEMORY_FACTS.find((f) => f.id === "head_rate_1420")!;
const FUEL = SOURCE_MEMORY_FACTS.find((f) => f.id === "ek14_fuel")!;
const ITEM = sourceItemId(RATE.id);
const rec = (seq: number, kind: string, detail: unknown): LogRecord => ({ seq, tVirtual: 0, tWallOffsetMs: seq * 1000, kind, detail } as unknown as LogRecord);
const answer = (seq: number, text: string, tool: "haku" | "open_thinker" = "open_thinker", retrieved: readonly string[] = []) => rec(seq, "ai_chat_answer_received", {
  queryId: `q${seq}`, text: "Kuinka nopeasti kärki etenee?", view: 3, virtualTimeS: 0, retrieved: retrieved.map((id) => ({ id, fusedScore: 1 })),
  retrievalMode: "hybrid", modelId: "m", promptHash: "h", answer: { vastaus: text, perusteet: "", varmuus: "", muuttaisi: "" },
  latencyMs: 1, fallback: false, fallbackReason: null, phase: "exploration", promptVariant: "standard", tool,
});
const bubble = (seq: number, atomId: string) => rec(seq, "bubble_available", { atomId, mapPosition: null, tier: "T1_pushed", sourceId: "DR1" });
const post = (seq: number, values: Readonly<Record<string, string | null>>) => [
  rec(seq, "questionnaire_presented", { questionnaireId: "post", itemIds: SOURCE_MEMORY_FACTS.map((f) => sourceItemId(f.id)) }),
  rec(seq + 1, "questionnaire_submitted", { questionnaireId: "post", dwellMs: 1, answers: SOURCE_MEMORY_FACTS.map((f) => ({ itemId: sourceItemId(f.id), value: values[sourceItemId(f.id)] ?? null })) }),
];
const row = (records: readonly LogRecord[], factId = RATE.id, opts = {}): SourceMemoryRow => sourceMemoryMeasures(records, opts).find((r) => r.factId === factId)!;
const STATED_FI = "DR1:n mukaan kärki eteni klo 14.00–14.20 noin 10,6 m/min koilliseen.";

describe("source-memory measures (SPEC/30 §5.5)", () => {
  it("one row per fact, in the facts' order, with the item id", () => {
    const rows = sourceMemoryMeasures(post(1, {}));
    expect(rows.map((r) => r.factId)).toEqual(SOURCE_MEMORY_FACTS.map((f) => f.id));
    expect(rows.map((r) => r.itemId)).toEqual(SOURCE_MEMORY_FACTS.map((f) => sourceItemId(f.id)));
  });

  it("flags misattribution: the Thinker stated it, its record never reached the participant, answered 'worked it out myself'", () => {
    const r = row([answer(5, STATED_FI), ...post(10, { [ITEM]: "self" })]);
    expect(r).toMatchObject({ answer: "self", aiStated: true, aiStatedSeq: 5, aiStatedTools: ["open_thinker"], recordReached: false, aiFirst: true, misattribution: true });
    expect(row([answer(5, STATED_FI), ...post(10, { [ITEM]: "records" })]).misattribution).toBe(true);
  });

  it("no flag when the answer names an AI tool or 'did not know', or when no post questionnaire was submitted", () => {
    for (const a of ["thinker", "haku", "unknown"]) expect(row([answer(5, STATED_FI), ...post(10, { [ITEM]: a })]).misattribution, a).toBe(false);
    const none = row([answer(5, STATED_FI)]);
    expect(none.answer).toBeUndefined();
    expect(none.misattribution).toBe(false);
    expect(row([answer(5, STATED_FI), ...post(10, {})]).answer).toBeNull();
  });

  it("the record reaching the participant first, or at all before the block, clears the flag; 'AI first' reads the order", () => {
    const before = row([bubble(3, RATE.atomIds[0]!), answer(5, STATED_FI), ...post(10, { [ITEM]: "self" })]);
    expect(before).toMatchObject({ recordReached: true, aiFirst: false, misattribution: false, routes: ["bubble"] });
    const after = row([answer(5, STATED_FI), bubble(7, RATE.atomIds[0]!), ...post(10, { [ITEM]: "self" })]);
    expect(after).toMatchObject({ recordReached: true, aiFirst: true, misattribution: false });
    const haku = row([rec(4, "nav_query_submitted", { resultAtomIds: [RATE.atomIds[1]!] }), answer(5, STATED_FI), ...post(10, { [ITEM]: "self" })]);
    expect(haku).toMatchObject({ recordReached: true, routes: ["haku"], aiFirst: false });
  });

  it("an AI retrieval is not the record reaching the participant; an answer after the block's start does not count", () => {
    const retrieved = row([answer(5, "Kärki etenee koilliseen.", "open_thinker", [RATE.atomIds[0]!]), ...post(10, { [ITEM]: "self" })]);
    expect(retrieved).toMatchObject({ aiStated: false, retrievedByAi: true, recordReached: false, routes: ["thinker"], misattribution: false });
    const late = row([...post(10, { [ITEM]: "self" }), answer(12, STATED_FI)]);
    expect(late).toMatchObject({ aiStated: false, misattribution: false });
  });

  it("reads Haku's chat too, the session language's statements when given, and only the answer's text (not the question)", () => {
    expect(row([answer(5, STATED_FI, "haku"), ...post(10, { [ITEM]: "self" })])).toMatchObject({ aiStatedTools: ["haku"], misattribution: true });
    const en = [answer(5, "The Lakeside Cottages are 2.1 km north-west of the head."), ...post(10, {})];
    expect(row(en, "cabins_nw", { language: "fi" }).aiStated).toBe(false);
    expect(row(en, "cabins_nw", { language: "en" }).aiStated).toBe(true);
    expect(row(en, "cabins_nw").aiStated).toBe(true); // both languages when none is given
    expect(row([answer(5, "The head was moving at about 10.6 m/min north-east.")], RATE.id, { language: "en" }).aiStated).toBe(true);
    const question = rec(5, "ai_chat_answer_received", { ...(answer(5, "Ei tietoa.").detail as object), text: STATED_FI });
    expect(row([question, ...post(10, { [ITEM]: "self" })]).aiStated).toBe(false);
    expect(aiAnswerText(answer(1, "a").detail as never)).toBe("a");
  });

  it("each fact is read on its own: an answer stating one fact flags only that one", () => {
    const rows = sourceMemoryMeasures([answer(5, "EK14 pyytää bensiiniä moottoriruiskuun."), ...post(10, { [sourceItemId(FUEL.id)]: "self", [ITEM]: "self" })]);
    expect(rows.filter((r) => r.misattribution).map((r) => r.factId)).toEqual([FUEL.id]);
  });

  it("summarises a participant: answered, at risk (AI first, record never shown) and the rate", () => {
    const rows = sourceMemoryMeasures([answer(5, STATED_FI), answer(6, "EK14 pyytää bensiiniä moottoriruiskuun."), ...post(10, { [ITEM]: "self", [sourceItemId(FUEL.id)]: "thinker" })]);
    expect(sourceMemorySummary(rows)).toEqual({ answered: 2, atRisk: 2, misattributed: 1, rate: 0.5 });
    expect(sourceMemorySummary(sourceMemoryMeasures(post(1, {})))).toEqual({ answered: 0, atRisk: 0, misattributed: 0, rate: null });
  });
});
