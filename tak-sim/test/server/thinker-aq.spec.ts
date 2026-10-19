/**
 * SPEC/14 revision (aq), 11 Oct 2026: the Open Thinker's structured output — schema validation, the
 * deterministic limits (item counts, field lengths, the 150-word total), the rendering to text in both
 * languages, verdicts read from fields, the citation check over tags, the parse-failure retry, and the
 * routing of lookup / safety / options (a lookup ends in exactly one question and has no options).
 * SPEC/30 §3 (19 Oct 2026): the premise statuses are the premise-evidence table's, no longer the model's; the tests that assumed
 * model-rated premises now check that the table's statuses overwrite them (more in `premise-check.spec.ts`, `premise-handler.spec.ts`).
 */
import type { GoogleGenAI } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import { OPEN_ANSWER_MAX_WORDS, renderOpenAnswer, verdictsOfOptions, wordCount, type OpenStructuredAnswer } from "../../app/session/open-answer.js";
import { citationIssuesOfStructured, imperativeWordsIn } from "../../server/thinker/answer-checks.js";
import { readFileSync } from "node:fs";
import { loadSystemPrompt, normaliseNewlines, repoPath, sha256Hex } from "../../server/thinker/config.js";
import { checkDirectivePremises, loadDirectivePremises, premisesBlock, PREMISES_BLOCK_LABEL } from "../../server/thinker/directive-premises.js";
import { handleOpenThinkerRequest, type ThinkerDeps } from "../../server/thinker/handler.js";
import { callOpenThinkerModel, DIRECTIVE_BLOCK_LABEL, receivedUpToOf } from "../../server/thinker/model.js";
import { cutChars, limitOpenAnswer, OPEN_ANSWER_SCHEMA, OPEN_LIMITS, parseOpenAnswer } from "../../server/thinker/open-answer.js";
import { loadPremiseEvidence, premiseBlockStatuses, premiseCheck, premiseCheckShown, recordLookupOf } from "../../server/thinker/premise-check.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { scenario, stepAtViewStart } from "../engine/thinker-fixtures.js";
import { openJson, twoOptions } from "./open-json.js";

const TIMES = ["15.40", "15.45", "16.00"];
// SPEC/30 §3 (19 Oct 2026): with a directive in force, the premise statuses come from the premise-evidence table at the records clock of
// the view's start (V11: nothing contradicted; V14: P1 and P2 contradicted), never from the model.
const evidence = loadPremiseEvidence();
const recordsClockAt = (view: number) => receivedUpToOf(reachableAtoms(scenario.atoms, stepAtViewStart(view)), 0);
const itemsAt = (view: number) => premiseCheck(evidence, view, recordsClockAt(view))!;
const checkAt = (view: number, lang: "fi" | "en") => premiseCheckShown(evidence, itemsAt(view), loadDirectivePremises(), recordLookupOf(scenario.atoms), lang);
const ctx = (directiveInForce: boolean, view = 11, lang: "fi" | "en" = "en") => ({
  directiveInForce, taggedCount: 3, tagTimes: TIMES, premises: directiveInForce ? loadDirectivePremises() : undefined, premiseCheck: directiveInForce ? checkAt(view, lang) : undefined,
});
const parsed = (json: string): OpenStructuredAnswer => parseOpenAnswer(json)!;
const startOf = (view: number) => scenario.cycles.find((c) => c.index === view)!.startsAtVirtual;

function deps(client: GoogleGenAI | null, logs: Record<string, unknown>[] = []): ThinkerDeps {
  return {
    scenario, vector: null, client,
    prompt: loadSystemPrompt("fi"), promptEn: loadSystemPrompt("en"),
    promptOpen: loadSystemPrompt("fi", "open"), promptOpenEn: loadSystemPrompt("en", "open"),
    promptOpenOnce: loadSystemPrompt("fi", "open_once"), promptOpenOnceEn: loadSystemPrompt("en", "open_once"),
    appendLog: async (_id, line) => void logs.push(line), nowMs: () => 0, nowIso: () => "2026-10-11T00:00:00.000Z",
  };
}
function fake(...texts: string[]) {
  const create = vi.fn();
  for (const text of texts) create.mockResolvedValueOnce({ candidates: [{ finishReason: "STOP" }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 }, text });
  return { client: { models: { generateContent: create } } as unknown as GoogleGenAI, create };
}
const REQ = { sessionId: "aq", condition: "substitutive", view: 11, virtualTimeS: startOf(11), question: "What are my options?", cell: "reasoning_intent", language: "en" };

describe("parseOpenAnswer: validation", () => {
  it("accepts a lookup with a fact and one question, an options answer with two options, a safety answer with a fact", () => {
    expect(parsed(openJson()).kind).toBe("lookup");
    expect(parsed(openJson({ kind: "options", options: twoOptions() })).options).toHaveLength(2);
    expect(parsed(openJson({ kind: "safety", questionsForYou: ["Is the road open?"] })).kind).toBe("safety");
  });

  it.each([
    ["not JSON", "{ nope"],
    ["an unknown kind", openJson({ kind: "chat" as never })],
    ["a lookup without a fact", openJson({ kind: "lookup", facts: [] })],
    ["a lookup without its question", openJson({ kind: "lookup", questionsForYou: [] })],
    ["a lookup whose question is an imperative", openJson({ kind: "lookup", questionsForYou: ["You should move the relay."] })],
    ["an options answer with one option", openJson({ kind: "options", options: twoOptions().slice(0, 1) })],
    ["an unknown verdict", openJson({ kind: "options", options: twoOptions("violates" as never, null) })],
    ["a fact without text", JSON.stringify({ kind: "lookup", facts: [{ text: "", tags: [] }], questionsForYou: ["Q?"] })],
  ])("rejects %s", (_label, json) => {
    expect(parseOpenAnswer(json)).toBeNull();
  });

  it("normalises tags and folds an inline [T#, time] bracket into the item's tags", () => {
    const a = parsed(openJson({ facts: [{ text: "Water at W2 [T2, 15:40].", tags: ["t1", "[T3]", "x"] }] }));
    expect(a.facts[0]).toEqual({ text: "Water at W2.", tags: ["T1", "T3", "T2"] });
  });
});

describe("limitOpenAnswer: the premise check's consistency and whole-item trimming (tuning)", () => {
  const prem = (status: "supported" | "contradicted" | "not_addressed", tags: string[], id = "P2") => ({ id, premise: "", status, tags });

  it("a justified departure without a contradicted premise in the table is a plain departure, logged, whatever the model rated", () => {
    const raw = parsed(openJson({ kind: "options", options: twoOptions("departure_justifiable", "fits"), premises: [prem("contradicted", ["T1"])] }));
    const out = limitOpenAnswer(raw, ctx(true, 11), "en");
    expect(out.answer.options.map((o) => o.verdict)).toEqual(["departs", "fits"]);
    expect(out.trimmed).toContain("justified_without_contradicted_premise");
  });

  it("with a premise contradicted in the table the model's justified departure stands; a contradicted premise alone forces no verdict", () => {
    const raw = parsed(openJson({ kind: "options", options: twoOptions("departure_justifiable", "fits"), premises: [prem("supported", ["T1"])] }));
    expect(limitOpenAnswer(raw, ctx(true, 14), "en").answer.options.map((o) => o.verdict)).toEqual(["departure_justifiable", "fits"]);
    const plain = parsed(openJson({ kind: "options", options: twoOptions("departs", "fits") }));
    expect(limitOpenAnswer(plain, ctx(true, 14), "en").answer.options.map((o) => o.verdict)).toEqual(["departs", "fits"]);
  });

  it("the model's premise ratings are overwritten by the table's statuses, logged (SPEC/30 \u00a73)", () => {
    const raw = parsed(openJson({ kind: "options", options: twoOptions("fits", "fits"), premises: [prem("supported", ["T1"], "P1"), prem("contradicted", ["T2"], "P2")] }));
    const v11 = limitOpenAnswer(raw, ctx(true, 11), "en");
    expect(v11.answer.premises.map((p) => [p.id, p.status, p.tags])).toEqual([["P1", "not_addressed", []], ["P2", "not_addressed", []]]);
    expect(v11.trimmed).toContain("premises_from_model_ignored");
    const v14 = limitOpenAnswer(raw, ctx(true, 14), "en");
    expect(v14.answer.premises.map((p) => p.status)).toEqual(["contradicted", "contradicted"]);
    expect(v14.answer.premiseCheck).toEqual(checkAt(14, "en"));
  });

  it("the model's unforeseen scan is not used: dropped with the premise check (logged) and without a directive", () => {
    const json = openJson({ kind: "options", options: twoOptions("fits", "fits"), unforeseen: { text: "A new fire.", tags: ["T1"] } });
    const out = limitOpenAnswer(parsed(json), ctx(true), "en");
    expect(out.answer.unforeseen).toBeNull();
    expect(out.trimmed).toContain("unforeseen_ignored");
    expect(limitOpenAnswer(parsed(json), ctx(false), "en").answer.unforeseen).toBeNull();
  });

  it("over the word budget, optional items and options go, never an authored premise or the premise line; no sentence is cut", () => {
    const long = "Gains a sound containment line along the barrier but risks letting the fire advance until it meets the line.";
    const opts = ["A", "B", "C"].map((o) => ({ option: `Option ${o} name with six words`, tradeoffs: long, verdict: "departure_justifiable" as const, tags: ["T1"] }));
    const raw = parsed(openJson({ kind: "options", options: opts, premises: [prem("supported", ["T1"], "P1"), prem("contradicted", ["T2"], "P2")], inference: null, questionsForYou: ["Does that change the posture you would take?"] }));
    const out = limitOpenAnswer(raw, ctx(true, 14), "en");
    const text = renderOpenAnswer(out.answer, out.tagTimes, "en");
    expect(wordCount(text)).toBeLessThanOrEqual(OPEN_ANSWER_MAX_WORDS);
    expect(out.trimmed).toContain("words_item");
    expect(out.answer.premises.map((p) => p.id)).toEqual(["P1", "P2"]);
    expect(out.answer.premises.some((p) => p.status === "contradicted")).toBe(true);
    for (const line of checkAt(14, "en").lines) expect(text).toContain(line);
    expect(text).not.toContain("\u2026");
  });

  it("a field a few characters over its schema length is kept whole; a long one ends at a sentence end", () => {
    const sentence = "Gains speed at the head of the fire and keeps the road open. Risks the crews and needs water that is not there yet, so the line could fail.";
    const out = limitOpenAnswer(parsed(openJson({ kind: "options", options: [{ option: "A", tradeoffs: sentence, verdict: null, tags: [] }, { option: "B", tradeoffs: "Slower.", verdict: null, tags: [] }] })), ctx(false), "en");
    expect(out.answer.options[0]!.tradeoffs).toBe("Gains speed at the head of the fire and keeps the road open.");
    expect(cutChars("x".repeat(95), 90)).toBe("x".repeat(89) + "\u2026");
  });

  it("the schema states the lengths and puts the premise check before the options", () => {
    const keys = Object.keys(OPEN_ANSWER_SCHEMA.properties);
    expect(keys.indexOf("unforeseen")).toBeLessThan(keys.indexOf("premises"));
    expect(keys.indexOf("premises")).toBeLessThan(keys.indexOf("options"));
    expect(OPEN_ANSWER_SCHEMA.properties.options.items.properties.tradeoffs.maxLength).toBe(String(OPEN_LIMITS.tradeoffChars));
    expect(OPEN_ANSWER_SCHEMA.properties.premises.items.properties.id.enum).toEqual(["P1", "P2"]);
    expect(OPEN_ANSWER_SCHEMA.properties.premises.items.properties.status.description).toMatch(/contradicted: a newest record/);
  });
});

describe("limitOpenAnswer: deterministic limits", () => {
  it("routes by kind: a lookup keeps at most two facts and exactly one question, and has no options, premises or verdicts", () => {
    const raw: OpenStructuredAnswer = { ...parsed(openJson()), facts: [1, 2, 3].map((i) => ({ text: `Fact ${i}.`, tags: ["T1"] })), questionsForYou: ["One?", "Two?"], options: twoOptions("fits", "fits") as never };
    const out = limitOpenAnswer(raw, ctx(true), "en");
    expect(out.answer.facts).toHaveLength(2);
    expect(out.answer.questionsForYou).toEqual(["One?"]);
    expect(out.answer.options).toEqual([]);
    expect(out.trimmed).toEqual(expect.arrayContaining(["kind_lookup", "count_facts", "count_questions"]));
  });

  it("drops premises and verdicts when no directive is in force (phase A, reasoning_once, the practice view)", () => {
    const raw = parsed(openJson({ kind: "options", options: twoOptions("departs", "fits"), premises: [{ id: "P2", premise: "", status: "contradicted", tags: ["T1"] }] }));
    const out = limitOpenAnswer(raw, ctx(false), "en");
    expect(out.answer.premises).toEqual([]);
    expect(out.answer.options.map((o) => o.verdict)).toEqual([null, null]);
    expect(out.trimmed).toContain("no_directive");
    expect(verdictsOfOptions(out.answer)).toBeNull();
    expect(limitOpenAnswer(raw, ctx(true), "en").answer.options.map((o) => o.verdict)).toEqual(["departs", "fits"]);
  });

  it("caps items and characters, drops tags that name no record, and reports what it changed", () => {
    const long = "word ".repeat(80).trim();
    const raw = parsed(openJson({ kind: "options", options: [...twoOptions(), ...twoOptions()].map((o) => ({ ...o, tradeoffs: long, tags: ["T1", "T9"] })) }));
    const out = limitOpenAnswer(raw, ctx(false), "en");
    expect(out.answer.options).toHaveLength(3);
    expect(out.answer.options.every((o) => o.tradeoffs.length <= 150 && o.tags.join() === "T1")).toBe(true);
    expect(out.trimmed).toEqual(expect.arrayContaining(["count_options", "chars_options"]));
  });

  it("keeps the rendered text within 150 words however much the model writes (the 117-219-word overshoot)", () => {
    const sentence = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon";
    const raw: OpenStructuredAnswer = {
      kind: "options",
      facts: [1, 2, 3].map(() => ({ text: sentence.slice(0, 190), tags: ["T1"] })),
      premises: [1, 2, 3].map((i) => ({ id: `P${i}`, premise: sentence.slice(0, 100), status: "supported" as const, tags: ["T2"] })),
      options: [1, 2, 3].map((i) => ({ option: `Option number ${i}`, tradeoffs: sentence.slice(0, 140), verdict: "fits" as const, tags: ["T1", "T2"] })),
      inference: sentence, questionsForYou: [sentence.slice(0, 110), sentence.slice(0, 110), sentence.slice(0, 110)],
    };
    for (const lang of ["en", "fi"] as const) for (const view of [11, 14]) {
      const out = limitOpenAnswer(raw, ctx(true, view, lang), lang);
      expect(wordCount(renderOpenAnswer(out.answer, out.tagTimes, lang)), `${lang} V${view}`).toBeLessThanOrEqual(OPEN_ANSWER_MAX_WORDS);
      expect(out.trimmed).toContain("words");
    }
  });

  it("leaves a short answer untouched", () => {
    const raw = parsed(openJson({ kind: "options", options: twoOptions() }));
    expect(limitOpenAnswer(raw, ctx(false), "en").trimmed).toEqual([]);
  });
});

describe("renderOpenAnswer: one deterministic text, fi and en", () => {
  const answer: OpenStructuredAnswer = {
    kind: "options",
    facts: [{ text: "SF2 reports embers.", tags: ["T1"] }],
    premises: [{ id: "P2", premise: "Wind stays westerly", status: "contradicted", tags: ["T2", "T3"] }],
    options: [{ option: "Direct attack", tradeoffs: "Fast, close to the head.", verdict: "departure_justifiable", tags: ["T1"] }, { option: "Hold the road", tradeoffs: "Slower.", verdict: "fits", tags: [] }],
    inference: "Embers may cross the road.", questionsForYou: ["Is the road clear?"],
  };
  const times = { T1: "15.40", T2: "15.45", T3: "16.00" };

  it("renders English headings, the status and verdict phrases, and the citation with the record's own time", () => {
    expect(renderOpenAnswer(answer, times, "en")).toBe([
      "SF2 reports embers. [T1, 15.40]",
      "Premises:",
      "- Wind stays westerly (contradicted) [T2, T3, 15.45, 16.00]",
      "Options:",
      "1. Direct attack: Fast, close to the head.; departs from the directive; a departure can be justified [T1, 15.40]",
      "2. Hold the road: Slower.; in line with the directive",
      "My inference: Embers may cross the road.",
      "Questions for you:",
      "- Is the road clear?",
    ].join("\n"));
  });

  it("renders Finnish headings and phrases; same input, same text", () => {
    const fi = renderOpenAnswer(answer, times, "fi");
    expect(fi).toContain("Lähtöoletukset:");
    expect(fi).toContain("Vaihtoehdot:");
    expect(fi).toContain("ristiriidassa");
    expect(fi).toContain("poikkeaa linjauksesta; poikkeama voi olla perusteltu");
    expect(fi).toContain("Oma päätelmäni:");
    expect(fi).toContain("Kysymyksiä sinulle:");
    expect(renderOpenAnswer(answer, times, "fi")).toBe(fi);
  });

  it("SPEC/30 §3: with the server's premise check the fixed-template lines replace the premises rows (no heading, no status words)", () => {
    const check = { tableVersion: 1, items: [{ id: "P2", status: "contradicted" as const, atomIds: ["atom.radio.19.2"] }], lines: ["P2 Roads hold — no longer holds: EK16 19.22."], flagShown: true };
    const text = renderOpenAnswer({ ...answer, premiseCheck: check }, times, "en");
    expect(text.split("\n").slice(0, 3)).toEqual(["SF2 reports embers. [T1, 15.40]", "P2 Roads hold — no longer holds: EK16 19.22.", "Options:"]);
    expect(text).not.toContain("Premises:");
    expect(text).not.toContain("Wind stays westerly");
  });

  it("a lookup is its facts and its one question, without section headings for options or premises", () => {
    const lookup = limitOpenAnswer(parsed(openJson({ facts: [{ text: "W2 is 1.2 km from the front.", tags: ["T2"] }], questionsForYou: ["Does that change where you would put the relay?"] })), ctx(true), "en");
    expect(renderOpenAnswer(lookup.answer, lookup.tagTimes, "en")).toBe(
      "W2 is 1.2 km from the front. [T2, 15.45]\nQuestions for you:\n- Does that change where you would put the relay?");
  });
});

describe("verdicts and citations come from the fields", () => {
  it("verdictsOfOptions reads the fields: 'protecting settlements' in a text is no verdict; a justified departure is departs; a lookup codes none", () => {
    const a = parsed(openJson({ kind: "options", options: [{ option: "Protect the settlements", tradeoffs: "Departing crews are few.", verdict: "fits", tags: [] }, { option: "Burnout", tradeoffs: "x", verdict: "not_covered", tags: [] }, { option: "Third", tradeoffs: "y", verdict: "departure_justifiable", tags: [] }] }));
    expect(verdictsOfOptions(a)).toEqual([
      { line: 0, verdict: "in_line", text: "Protect the settlements" }, { line: 1, verdict: "not_covered", text: "Burnout" }, { line: 2, verdict: "departs", text: "Third" },
    ]);
    expect(verdictsOfOptions(parsed(openJson()))).toBeNull();
  });

  it("citationIssuesOfStructured flags tags beyond the last record (and T0) and counts uncited items", () => {
    const a = parsed(openJson({ kind: "options", facts: [{ text: "f", tags: ["T1", "T9"] }], options: twoOptions(null, null, []) }));
    const r = citationIssuesOfStructured(a, 3);
    expect(r.issues).toEqual([{ kind: "unknown_tag", tag: "T9" }]);
    expect(r.uncited).toBe(2);
    expect(citationIssuesOfStructured(parsed(openJson({ facts: [{ text: "f", tags: ["T0"] }] })), 3).issues).toEqual([{ kind: "unknown_tag", tag: "T0" }]);
  });

  it("imperativeWordsIn screens the forbidden words in both languages", () => {
    expect(imperativeWordsIn("You must go immediately.", "en")).toEqual(["must", "immediately"]);
    expect(imperativeWordsIn("Sinun pitäisi lähteä heti.", "fi")).toEqual(["pitäisi", "heti"]);
  });
});

describe("callOpenThinkerModel: parse failure retries once, then unavailable", () => {
  it("retries identically on invalid JSON and answers when the second reply is valid", async () => {
    const { client, create } = fake("{ broken", openJson());
    const outcome = await callOpenThinkerModel(client, "s", "u");
    expect(outcome).toMatchObject({ ok: true, parseRetries: 1, attempts: 2 });
    expect(create).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(create.mock.calls[0]![0])).toBe(JSON.stringify(create.mock.calls[1]![0]));
    expect((create.mock.calls[0]![0] as { config: { responseMimeType: string; responseSchema: unknown } }).config.responseMimeType).toBe("application/json");
  });

  it("a lookup without its question is a schema failure: one retry, then invalid_output and an empty answer (no free text)", async () => {
    const bad = openJson({ kind: "lookup", questionsForYou: [] });
    const { client, create } = fake(bad, bad);
    expect(await callOpenThinkerModel(client, "s", "u")).toMatchObject({ ok: false, reason: "invalid_output" });
    expect(create).toHaveBeenCalledTimes(2);
    const logs: Record<string, unknown>[] = [];
    const again = fake(bad, bad);
    const r = await handleOpenThinkerRequest(deps(again.client, logs), REQ);
    expect(r).toMatchObject({ status: 200, body: { fallback: true, fallbackReason: "invalid_output", answer: "", structured: null } });
    expect(logs[0]).toMatchObject({ fallback: true });
  });
});

describe("handler: routing, rendering and logging", () => {
  // SPEC/30 §3: a justified departure stands only where the table has a contradicted premise, so this runs at V14 (it was V11, model-rated).
  it("an options answer in reasoning_intent at V14 is rendered, its verdicts coded from fields and the fields logged", async () => {
    const json = openJson({ kind: "options", options: twoOptions("departure_justifiable", "fits"), inference: "A guess." });
    const logs: Record<string, unknown>[] = [];
    const r = await handleOpenThinkerRequest(deps(fake(json).client, logs), { ...REQ, view: 14, virtualTimeS: startOf(14) });
    const body = r.body as { answer: string; verdicts: unknown; structured: { kind: string; tagTimes: Record<string, string> } };
    expect(body.answer).toContain("Options:");
    expect(body.answer).toMatch(/departs from the directive; a departure can be justified/);
    expect(body.verdicts).toEqual([{ line: 0, verdict: "departs", text: "Direct attack" }, { line: 1, verdict: "in_line", text: "Defensive line" }]);
    expect(body.structured.kind).toBe("options");
    expect(logs[0]).toMatchObject({ kind: "options", verdictFields: ["departure_justifiable", "fits"], citationIssues: [], words: expect.any(Number) });
    expect(typeof logs[0]!.rawJson).toBe("string");
  });

  it.each([["reasoning_once", 11], ["reasoning_intent", 0], ["reasoning_intent", 5]] as const)("%s at V%i: no verdict and no premises, whatever the model wrote", async (cell, view) => {
    const json = openJson({ kind: "options", options: twoOptions("departs", "fits"), premises: [{ id: "P1", premise: "p", status: "supported", tags: [] }] });
    const logs: Record<string, unknown>[] = [];
    const r = await handleOpenThinkerRequest(deps(fake(json).client, logs), { ...REQ, cell, view, virtualTimeS: startOf(view === 0 ? 1 : view) });
    const body = r.body as { answer: string; verdicts: unknown; verdict: unknown };
    expect(body.verdicts).toBeNull();
    expect(body.verdict).toBeNull();
    expect(body.answer).not.toContain("Premises:");
    expect(logs[0]).toMatchObject({ truncated: true, trimmed: expect.arrayContaining(["no_directive"]) });
  });

  it("a lookup is logged with its kind and rendered as the fact and one question, in both cells and the practice view", async () => {
    for (const [cell, view] of [["reasoning_once", 6], ["reasoning_intent", 11], ["reasoning_once", 0], ["reasoning_intent", 0]] as const) {
      const logs: Record<string, unknown>[] = [];
      const json = openJson({ options: twoOptions("fits", "fits") as never });
      const r = await handleOpenThinkerRequest(deps(fake(json).client, logs), { ...REQ, cell, view, virtualTimeS: startOf(view === 0 ? 1 : view), question: "Where is the nearest water?" });
      const body = r.body as { answer: string; verdicts: unknown };
      expect(logs[0], `${cell} V${view}`).toMatchObject({ kind: "lookup" });
      expect(body.answer).not.toContain("Options:");
      expect(body.answer).toContain("Questions for you:");
      expect(body.verdicts).toBeNull();
    }
  });

  it("a safety answer has facts and questions for you, and no options or verdicts", async () => {
    const json = openJson({ kind: "safety", facts: [{ text: "Fire 400 m from the crews.", tags: ["T1"] }], questionsForYou: ["Is the escape road open?"], options: twoOptions("departs", "fits") });
    const r = await handleOpenThinkerRequest(deps(fake(json).client), { ...REQ, question: "Should we withdraw?" });
    const body = r.body as { answer: string; verdicts: unknown };
    expect(body.answer).toBe("Fire 400 m from the crews. [T1, " + (r.body as { structured: { tagTimes: Record<string, string> } }).structured.tagTimes["T1"] + "]\nQuestions for you:\n- Is the escape road open?");
    expect(body.verdicts).toBeNull();
  });
});

describe("authored directive premises (revision (ar), 11 Oct 2026)", () => {
  const authored = loadDirectivePremises();
  const optionsJson = (premises: unknown[]) => openJson({ kind: "options", options: twoOptions("departure_justifiable", "fits"), premises: premises as never });

  it("the file has exactly P1 and P2 (no crew-safety premise), each at most 16 words in both languages, and was written for this directive", () => {
    expect(authored.premises.map((p) => p.id)).toEqual(["P1", "P2"]);
    for (const p of authored.premises) for (const lang of ["fi", "en"] as const) expect(wordCount(p[lang]), `${p.id} ${lang}`).toBeLessThanOrEqual(16);
    expect(() => checkDirectivePremises(authored, authored.sha256, scenario.hinge.intentStatement)).not.toThrow();
    expect(() => checkDirectivePremises(authored, "0".repeat(64), scenario.hinge.intentStatement)).toThrow(/differs from the manifest/);
    expect(() => checkDirectivePremises(authored, authored.sha256, "another directive")).toThrow(/written for a directive/);
  });

  it("is frozen: the manifest holds the file's hash, and the directive-premises startup check passes against it", () => {
    const manifest = JSON.parse(readFileSync(repoPath("content/thinker/manifest.json"), "utf8")) as { directivePremises: { sha256: string; directiveSha256: string } };
    expect(manifest.directivePremises.sha256).toBe(authored.sha256);
    expect(manifest.directivePremises.directiveSha256).toBe(sha256Hex(normaliseNewlines(scenario.hinge.intentStatement)));
  });

  // SPEC/30 §3 (19 Oct 2026): unknown, repeated or invented premises from the model no longer matter: the premises are the authored P1, P2
  // in order with the table's statuses, whatever the model returned (logged `premises_from_model_ignored`).
  it("whatever ids or ratings the model returns, the premises are the authored P1, P2 with the table's statuses", () => {
    const raw = parsed(optionsJson([{ id: "P9", status: "supported", tags: ["T1"] }, { id: "P2", status: "supported", tags: ["T1"] }, { id: "P2", status: "contradicted", tags: ["T2"] }, { premise: "A new premise the model made up", status: "supported", tags: ["T1"] }]));
    const v11 = limitOpenAnswer(raw, ctx(true, 11), "en");
    expect(v11.answer.premises.map((p) => [p.id, p.status])).toEqual([["P1", "not_addressed"], ["P2", "not_addressed"]]);
    expect(v11.trimmed).toContain("premises_from_model_ignored");
    expect(limitOpenAnswer(raw, ctx(true, 14), "en").answer.premises.map((p) => [p.id, p.status])).toEqual([["P1", "contradicted"], ["P2", "contradicted"]]);
  });

  it("the text shown is the authored one, in the session language, never the model's", () => {
    const raw = parsed(optionsJson([{ id: "P2", premise: "Model words", status: "supported", tags: ["T1"] }]));
    for (const lang of ["en", "fi"] as const) {
      const out = limitOpenAnswer(raw, ctx(true, 14, lang), lang);
      const text = renderOpenAnswer(out.answer, out.tagTimes, lang);
      // The template drops the authored sentence's full stop: "P2 Roads or water … can be held — no longer holds: EK16 19.22."
      for (const p of authored.premises) expect(text).toContain(`${p.id} ${p[lang].replace(/\.$/, "")} — `);
      expect(out.answer.premises.map((p) => p.premise)).toEqual(authored.premises.map((p) => p[lang]));
      expect(text).not.toContain("Model words");
    }
  });

  it("a lookup, a safety answer and an answer without a directive carry no premises", () => {
    const lookup = limitOpenAnswer(parsed(openJson({ premises: [{ id: "P1", status: "supported", tags: [] }] as never })), ctx(true), "en");
    expect(lookup.answer.premises).toEqual([]);
    const none = limitOpenAnswer(parsed(optionsJson([{ id: "P1", status: "supported", tags: ["T1"] }])), ctx(false), "en");
    expect(none.answer.premises).toEqual([]);
  });

  it("the model's unforeseen scan forces nothing and is not kept (SPEC/30 §3: the table decides the premises)", () => {
    const raw = parsed(openJson({ kind: "options", options: twoOptions("fits", "fits"), unforeseen: { text: "A new fire.", tags: ["T1"] }, premises: [{ id: "P1", premise: "", status: "supported" as const, tags: ["T2"] }] }));
    const out = limitOpenAnswer(raw, ctx(true, 11), "en");
    expect(out.trimmed).toEqual(expect.arrayContaining(["unforeseen_ignored", "premises_from_model_ignored"]));
    expect(out.answer.unforeseen).toBeNull();
    expect(out.answer.premises[0]!.status).toBe("not_addressed");
    expect(out.answer.options.map((o) => o.verdict)).toEqual(["fits", "fits"]);
  });

  it("an options answer with no premises from the model still shows both authored premises with the table's statuses", () => {
    const json = openJson({ kind: "options", options: twoOptions("departs", "fits") });
    const v11 = limitOpenAnswer(parsed(json), ctx(true, 11), "en");
    expect(v11.answer.premises.map((p) => p.status)).toEqual(["not_addressed", "not_addressed"]);
    expect(v11.answer.premiseCheck?.lines).toEqual(["Directive premises: no newest record contradicts P1 or P2."]);
    expect(v11.answer.options.map((o) => o.verdict)).toEqual(["departs", "fits"]);
    expect(v11.trimmed).not.toContain("premises_from_model_ignored");
    expect(limitOpenAnswer(parsed(json), ctx(true, 14), "en").answer.premises.map((p) => p.status)).toEqual(["contradicted", "contradicted"]);
  });

  it("the premises reach the model only in reasoning_intent from V8, after the quoted directive, with the table's check; the log carries the hashes and the statuses shown", async () => {
    const send = async (cell: string, view: number, lang: "fi" | "en" = "en") => {
      const f = fake(optionsJson([{ id: "P2", status: "contradicted", tags: ["T1"] }]));
      const logs: Record<string, unknown>[] = [];
      const r = await handleOpenThinkerRequest(deps(f.client, logs), { ...REQ, cell, view, virtualTimeS: startOf(view === 0 ? 1 : view), language: lang });
      return { system: (f.create.mock.calls[0]![0] as { config: { systemInstruction: string } }).config.systemInstruction, logs, body: r.body as { answer: string; structured: { premises: { id: string }[] } | null } };
    };
    for (const lang of ["en", "fi"] as const) {
      const v = await send("reasoning_intent", 11, lang);
      expect(v.system.endsWith(premisesBlock(authored, lang, premiseBlockStatuses(itemsAt(11), recordLookupOf(scenario.atoms), lang)))).toBe(true);
      expect(v.system.indexOf(scenario.hinge.intentStatement.length > 0 ? PREMISES_BLOCK_LABEL[lang] : "")).toBeGreaterThan(v.system.indexOf(DIRECTIVE_BLOCK_LABEL[lang]));
      expect(v.logs[0]).toMatchObject({
        premisesSha256: authored.sha256, premiseEvidenceSha256: evidence.sha256, premiseEvidenceVersion: evidence.version, premiseFlagShown: false,
        premiseStatuses: [{ id: "P1", status: "not_contradicted", atomIds: [] }, { id: "P2", status: "not_contradicted", atomIds: [] }],
      });
      expect(v.logs[0]).not.toHaveProperty("aiPremises");
      expect(v.body.structured!.premises.map((p) => p.id)).toEqual(["P1", "P2"]);
    }
    for (const [cell, view] of [["reasoning_once", 11], ["reasoning_intent", 5], ["reasoning_intent", 0]] as const) {
      const v = await send(cell, view);
      expect(v.system, `${cell} V${view}`).not.toContain(PREMISES_BLOCK_LABEL.en);
      expect(v.logs[0], `${cell} V${view}`).not.toHaveProperty("premisesSha256");
      expect(v.body.structured?.premises ?? []).toEqual([]);
    }
  });
});
