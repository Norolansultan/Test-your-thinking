/**
 * SPEC/30 §3 (19 Oct 2026), the handler: in the guide's cell (`reasoning_intent`) with the directive in force (V8 on), an options
 * answer carries the premise check's fixed-template line; the statuses are the table's and overwrite whatever the model wrote; a
 * justified departure stands only when the table shows a contradicted premise (never forced upward); lookups, safety answers, phase
 * A, the practice view, `reasoning_once` and Haku carry no premise line. The model is asked for no premises (schema) and is told the
 * check after the directive. The Gemini client is a fake.
 */
import type { GoogleGenAI } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import { OPEN_ANSWER_MAX_WORDS, wordCount, type OpenStructuredView } from "../../app/session/open-answer.js";
import type { OpenThinkerResponse } from "../../app/session/thinker-protocol.js";
import { loadSystemPrompt } from "../../server/thinker/config.js";
import { loadDirectivePremises } from "../../server/thinker/directive-premises.js";
import { handleOpenThinkerRequest, handleThinkerRequest, type ThinkerDeps } from "../../server/thinker/handler.js";
import { OPEN_ANSWER_SCHEMA, OPEN_ANSWER_SCHEMA_GUIDE } from "../../server/thinker/open-answer.js";
import { loadPremiseEvidence } from "../../server/thinker/premise-check.js";
import { scenario } from "../engine/thinker-fixtures.js";
import { openJson, twoOptions } from "./open-json.js";

const evidence = loadPremiseEvidence();
const startOf = (view: number) => scenario.cycles.find((c) => c.index === view)!.startsAtVirtual;
const REQ = { sessionId: "premise", condition: "substitutive", question: "What are my options for the main effort now?", cell: "reasoning_intent", language: "en" };
const req = (view: number, extra: Record<string, unknown> = {}) => ({ ...REQ, view, virtualTimeS: view === 0 ? 0 : startOf(view), ...extra });

const LINE_NONE = { en: "Directive premises: no newest record contradicts P1 or P2.", fi: "Linjauksen lähtöoletukset: mikään uusin tieto ei kumoa oletuksia P1 ja P2." };
// SPEC/31 §3.4 (coa F3/F4, RC; panel to confirm): at V14 only P1 (re-worded, DRAFT) is contradicted; P2 stands (R2 ahead of the head is held).
const LINE_V14 = {
  en: ["P1 No new fire or rekindle without a line ahead of it has started since the directive — no longer holds: SPOT 19.23."],
  fi: ["P1 Linjauksen jälkeen ei ole syttynyt uutta paloa tai uudelleensyttymää, jonka edessä ei ole linjaa — ei enää päde: SPOT klo 19.23."],
};

function fakeClient(...texts: string[]) {
  const create = vi.fn();
  for (const text of texts) create.mockResolvedValueOnce({ candidates: [{ finishReason: "STOP" }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 }, text });
  return { client: { models: { generateContent: create } } as unknown as GoogleGenAI, create };
}

function depsWith(client: GoogleGenAI, logs: Record<string, unknown>[]): ThinkerDeps {
  return {
    scenario, vector: null, client,
    prompt: loadSystemPrompt("fi"), promptEn: loadSystemPrompt("en"),
    promptOpen: loadSystemPrompt("fi", "open"), promptOpenEn: loadSystemPrompt("en", "open"),
    promptOpenOnce: loadSystemPrompt("fi", "open_once"), promptOpenOnceEn: loadSystemPrompt("en", "open_once"),
    appendLog: async (_id, line) => void logs.push(line), nowMs: () => 0, nowIso: () => "2026-10-19T00:00:00.000Z",
  };
}

async function ask(view: number, modelJson: string, extra: Record<string, unknown> = {}) {
  const { client, create } = fakeClient(modelJson);
  const logs: Record<string, unknown>[] = [];
  const r = await handleOpenThinkerRequest(depsWith(client, logs), req(view, extra));
  expect(r.status).toBe(200);
  const sent = create.mock.calls[0]![0] as { config: { systemInstruction: string; responseSchema: unknown } };
  return { body: r.body as OpenThinkerResponse, log: logs[0]!, system: sent.config.systemInstruction, schema: sent.config.responseSchema };
}

/** The model also "rates" the premises (an old habit, or a schema it was not given): the table overwrites it. */
const modelPremises = [{ id: "P1", premise: "", status: "supported" as const, tags: ["T1"] }, { id: "P2", premise: "", status: "supported" as const, tags: ["T1"] }];

describe("the premise line in a guide's options answer (directive in force)", () => {
  it("V14: P1 flagged in the fixed template, P2 not (SPEC/31 §3.4); the model's own ratings are overwritten; logged with the table's version, hash and atom ids", async () => {
    const { body, log } = await ask(14, openJson({ kind: "options", options: twoOptions("departure_justifiable", "fits"), premises: modelPremises }));
    const structured = body.structured as OpenStructuredView;
    for (const line of LINE_V14.en) expect(body.answer).toContain(line);
    expect(body.answer).not.toContain("Premises:");
    expect(body.answer).not.toContain("P2 Roads");
    expect(body.answer.indexOf(LINE_V14.en[0]!)).toBeLessThan(body.answer.indexOf("Options:"));
    expect(structured.premiseCheck).toMatchObject({ tableVersion: evidence.version, flagShown: true, lines: LINE_V14.en });
    expect(structured.premises.map((p) => [p.id, p.status, p.tags.length])).toEqual([["P1", "contradicted", 0], ["P2", "not_addressed", 0]]);
    expect(structured.premises.map((p) => p.premise)).toEqual(loadDirectivePremises().premises.map((p) => p.en));
    expect(log).toMatchObject({
      premiseEvidenceVersion: evidence.version, premiseEvidenceSha256: evidence.sha256, premiseFlagShown: true,
      premiseStatuses: [{ id: "P1", status: "contradicted", atomIds: ["atom.demo.19.2"] }, { id: "P2", status: "not_contradicted", atomIds: [] }],
      trimmed: expect.arrayContaining(["premises_from_model_ignored"]),
    });
    expect(log).not.toHaveProperty("aiPremises");
    // A contradicted premise: the justified departure stands; the other verdict is untouched.
    expect(log["verdictFields"]).toEqual(["departure_justifiable", "fits"]);
  });

  it("Finnish V14: the authored Finnish text and 'klo'", async () => {
    const { body } = await ask(14, openJson({ kind: "options", options: twoOptions("departs", "fits") }), { language: "fi", question: "Mitkä ovat vaihtoehtoni painopisteelle?" });
    for (const line of LINE_V14.fi) expect(body.answer).toContain(line);
  });

  it.each([8, 11, 12, 13])("V%i: the line that nothing is contradicted, no flag; a justified departure is downgraded to departs, logged", async (view) => {
    const { body, log } = await ask(view, openJson({ kind: "options", options: twoOptions("departure_justifiable", "fits"), premises: [{ id: "P1", premise: "", status: "contradicted", tags: ["T1"] }] }));
    expect(body.answer).toContain(LINE_NONE.en);
    expect((body.structured as OpenStructuredView).premiseCheck).toMatchObject({ flagShown: false, lines: [LINE_NONE.en] });
    expect((body.structured as OpenStructuredView).premises.map((p) => p.status)).toEqual(["not_addressed", "not_addressed"]);
    expect(log).toMatchObject({ premiseFlagShown: false, premiseStatuses: [{ id: "P1", status: "not_contradicted", atomIds: [] }, { id: "P2", status: "not_contradicted", atomIds: [] }] });
    expect(log["verdictFields"]).toEqual(["departs", "fits"]);
    expect(log["trimmed"]).toEqual(expect.arrayContaining(["justified_without_contradicted_premise"]));
  });

  it("V9 and V10: P1 flagged with its deciding records; never forces a verdict upward", async () => {
    const v9 = await ask(9, openJson({ kind: "options", options: twoOptions("departs", "fits") }));
    expect(v9.body.answer).toContain("P1 No new fire or rekindle without a line ahead of it has started since the directive — no longer holds: SPOT 17.01.");
    expect(v9.body.answer).not.toContain("P2 Roads");
    expect(v9.log["verdictFields"]).toEqual(["departs", "fits"]);
    expect(v9.log["premiseFlagShown"]).toBe(true);
    const v10 = await ask(10, openJson({ kind: "options", options: twoOptions("departure_justifiable", "not_covered") }));
    expect(v10.body.answer).toContain("— no longer holds: SPOT 17.01, DR2 17.25, DR3 17.35.");
    expect(v10.log["premiseStatuses"]).toEqual([{ id: "P1", status: "contradicted", atomIds: ["atom.demo.12.0", "evt.c13.010", "evt.c13.034"] }, { id: "P2", status: "not_contradicted", atomIds: [] }]);
    expect(v10.log["verdictFields"]).toEqual(["departure_justifiable", "not_covered"]);
  });

  it("the premise line is never dropped or cut by the 150-word budget", async () => {
    const long = "Gains a sound containment line along the barrier but risks letting the fire advance until it meets the line.";
    const opts = ["A", "B", "C"].map((o) => ({ option: `Option ${o} name with six words`, tradeoffs: long, verdict: "departure_justifiable" as const, tags: ["T1"] }));
    const { body, log } = await ask(10, openJson({ kind: "options", options: opts, facts: [{ text: long, tags: ["T1"] }], inference: long.slice(0, 100), questionsForYou: ["Does that change the posture you would take?", "Is the road still open?"] }));
    expect(wordCount(body.answer)).toBeLessThanOrEqual(OPEN_ANSWER_MAX_WORDS);
    expect(body.answer).toContain("P1 No new fire or rekindle without a line ahead of it has started since the directive — no longer holds: SPOT 17.01, DR2 17.25, DR3 17.35.");
    expect(log["trimmed"]).toEqual(expect.arrayContaining(["words"]));
  });

  it("the model is told the check after the directive, and is asked for no premises and no unforeseen scan", async () => {
    const v14 = await ask(14, openJson({ kind: "options", options: twoOptions() }));
    expect(v14.system).toContain("P1: No new fire or rekindle without a line ahead of it has started since the directive. — contradicted by the newest records: SPOT 19.23");
    expect(v14.system).toContain("P2: Roads or water ahead of each fire still give a line that can be held. — not contradicted by the newest records");
    expect(v14.schema).toEqual(OPEN_ANSWER_SCHEMA_GUIDE);
    expect(Object.keys(OPEN_ANSWER_SCHEMA_GUIDE.properties)).not.toContain("premises");
    expect(Object.keys(OPEN_ANSWER_SCHEMA_GUIDE.properties)).not.toContain("unforeseen");
    const v11 = await ask(11, openJson({ kind: "options", options: twoOptions() }));
    expect(v11.system).toContain("P2: Roads or water ahead of each fire still give a line that can be held. — not contradicted by the newest records");
    expect(v11.system).not.toContain("contradicted by the newest records:");
    // Phase A of the guide's cell: the same schema, no premises block.
    const v5 = await ask(5, openJson({ kind: "options", options: twoOptions() }));
    expect(v5.schema).toEqual(OPEN_ANSWER_SCHEMA_GUIDE);
    expect(v5.system).not.toContain("P1:");
  });
});

describe("no premise line where SPEC/30 §3.4 gives none", () => {
  it.each([
    ["a lookup", 14, openJson({ facts: [{ text: "W2 is 1.2 km from the front.", tags: ["T1"] }] }), {}],
    ["a safety answer", 14, openJson({ kind: "safety", facts: [{ text: "Fire 400 m from the crews.", tags: ["T1"] }], questionsForYou: ["Is the escape road open?"] }), {}],
    ["phase A (V5)", 5, openJson({ kind: "options", options: twoOptions("departs", "fits") }), {}],
    ["the practice view", 0, openJson({ kind: "options", options: twoOptions("departs", "fits") }), {}],
    ["reasoning_once (V14)", 14, openJson({ kind: "options", options: twoOptions("departs", "fits"), premises: modelPremises }), { cell: "reasoning_once" }],
  ] as const)("%s", async (_label, view, json, extra) => {
    const { body, log, schema } = await ask(view, json, extra);
    expect(body.answer).not.toMatch(/no longer holds|Directive premises|Premises:/);
    expect(body.structured?.premiseCheck).toBeUndefined();
    expect(body.structured?.premises ?? []).toEqual([]);
    expect(log["premiseFlagShown"]).toBe(false);
    expect(log).not.toHaveProperty("premiseStatuses");
    if (extra && "cell" in extra || view === 0) expect(schema).toEqual(OPEN_ANSWER_SCHEMA);
    if (view < 8) expect(log).not.toHaveProperty("premiseEvidenceSha256");
  });

  it("reasoning_once keeps its schema with the premises field and its prompt unchanged", async () => {
    const { system, schema, log } = await ask(14, openJson({ kind: "options", options: twoOptions() }), { cell: "reasoning_once" });
    expect(schema).toEqual(OPEN_ANSWER_SCHEMA);
    expect(Object.keys(OPEN_ANSWER_SCHEMA.properties)).toEqual(["kind", "unforeseen", "premises", "options", "facts", "inference", "questionsForYou"]);
    expect(system).toBe(loadSystemPrompt("en", "open_once").text);
    expect(log).not.toHaveProperty("premiseEvidenceSha256");
  });

  it("Haku's chat carries no premise line and no premise fields", async () => {
    const { client } = fakeClient(JSON.stringify({ vastaus: "v", perusteet: "p", varmuus: "m", muuttaisi: "u" }));
    const logs: Record<string, unknown>[] = [];
    const r = await handleThinkerRequest(depsWith(client, logs), req(14));
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toMatch(/no longer holds|premise/i);
    expect(Object.keys(logs[0]!).filter((k) => /premise/i.test(k))).toEqual([]);
  });
});
