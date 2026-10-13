/**
 * Revision (al), 10 Oct 2026 (review panel; researcher approved): what the server adds around the Open
 * Thinker without changing the stimulus — the history's record tags rewritten, provenance hashes, the
 * directive-quote screen, the citation post-check, per-option verdicts, the client's query id on both
 * endpoints, the place-name line of the plan context, and one identical retry on 429 / 503 with a
 * fixed seed. The model client is a fake.
 */
import { asOpenModelText } from "./open-json.js";
import type { GoogleGenAI } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import { tr } from "../../app/i18n/text.js";
import { DIRECTIVE_FI } from "../../app/scenario/demo-scenario.js";
import { aiVerdictOf, aiVerdictsOf, validateThinkerRequest, type OpenThinkerResponse, type ThinkerResponse } from "../../app/session/thinker-protocol.js";
import { loadSystemPrompt, sha256Hex, THINKER_SEED } from "../../server/thinker/config.js";
import { citationIssuesOf, directiveQuoted, historyTurnForModel, provenanceHashes } from "../../server/thinker/answer-checks.js";
import { handleOpenThinkerRequest, handleThinkerRequest, type ThinkerDeps } from "../../server/thinker/handler.js";
import { callOpenThinkerModel, gazetteerLine, isRetryable, openPlanContext } from "../../server/thinker/model.js";
import { scenario } from "../engine/thinker-fixtures.js";

const startOf = (view: number) => scenario.cycles.find((c) => c.index === view)!.startsAtVirtual;
const OPEN = { sessionId: "al-test", condition: "substitutive", view: 11, virtualTimeS: startOf(11), question: "mitä vaihtoehtoja on?", cell: "reasoning_intent", queryId: "ai_open.3" };
const OK = { candidates: [{ finishReason: "STOP" }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } };

function depsWith(client: GoogleGenAI | null, logs: Record<string, unknown>[] = []): ThinkerDeps {
  return {
    scenario, vector: null, client,
    prompt: loadSystemPrompt("fi"), promptEn: loadSystemPrompt("en"),
    promptOpen: loadSystemPrompt("fi", "open"), promptOpenEn: loadSystemPrompt("en", "open"),
    promptOpenOnce: loadSystemPrompt("fi", "open_once"), promptOpenOnceEn: loadSystemPrompt("en", "open_once"),
    appendLog: async (_id, line) => void logs.push(line), nowMs: () => 0, nowIso: () => "2026-10-10T00:00:00.000Z",
  };
}
function fake(...results: (string | Error)[]) {
  const create = vi.fn();
  for (const r of results) {
    if (r instanceof Error) create.mockRejectedValueOnce(r);
    else create.mockResolvedValueOnce({ ...OK, text: asOpenModelText(r) });
  }
  return { client: { models: { generateContent: create } } as unknown as GoogleGenAI, create };
}
const httpError = (status: number) => Object.assign(new Error(`got status: ${status}`), { status });

describe("history: record tags rewritten, provenance hashed", () => {
  it("a model turn's [T#] brackets become '(earlier answer…)' keeping their other content; the participant's turns are untouched", () => {
    expect(historyTurnForModel({ role: "model", text: "SF2 is 250 m out [T3, 15:31]; EK12 reports embers (T4). Both [T2 and T5]." }, "en").text)
      .toBe("SF2 is 250 m out (earlier answer, 15:31); EK12 reports embers (earlier answer). Both (earlier answer).");
    expect(historyTurnForModel({ role: "model", text: "Lähteet eroavat [T2, 15.40]." }, "fi").text).toBe("Lähteet eroavat (aiempi vastaus, 15.40).");
    expect(historyTurnForModel({ role: "model", text: "No tags (L3, 15:40)." }, "en").text).toBe("No tags (L3, 15:40).");
    expect(historyTurnForModel({ role: "user", text: "what does [T3] say?" }, "en").text).toBe("what does [T3] say?");
  });

  it("the model receives the rewritten history; the log carries the sha256 of each turn as sent by the browser and of the full user content", async () => {
    const { client, create } = fake("ok");
    const logs: Record<string, unknown>[] = [];
    const history = [{ role: "user", text: "missä SF2 on?" }, { role: "model", text: "SF2 on 250 m koilliseen [T3, 15.31]." }];
    await handleOpenThinkerRequest(depsWith(client, logs), { ...OPEN, history });
    const sent = create.mock.calls[0]![0] as { contents: { role: string; parts: { text: string }[] }[] };
    expect(sent.contents[1]!.parts[0]!.text).toBe("SF2 on 250 m koilliseen (aiempi vastaus, 15.31).");
    expect(sent.contents[0]!.parts[0]!.text).toBe("missä SF2 on?");
    expect(logs[0]).toMatchObject({
      historyTurns: 2,
      historyHashes: history.map((h) => sha256Hex(`${h.role}\n${h.text}`)),
      userContentHash: sha256Hex(sent.contents.at(-1)!.parts[0]!.text),
    });
    expect(provenanceHashes(undefined, "u")).toEqual({ historyHashes: [], userContentHash: sha256Hex("u") });
  });
});

describe("directiveQuoted: a deterministic string-overlap screen", () => {
  const texts = [DIRECTIVE_FI, tr("en", DIRECTIVE_FI)];
  it("is true for a question sharing five consecutive words with the directive in either language, false otherwise", () => {
    expect(directiveQuoted("P2 sanoi: \"linjat teiden ja vesistöjen varaan\" — sopiiko suora hyökkäys?", texts)).toBe(true);
    expect(directiveQuoted(`Does a burnout fit "${tr("en", DIRECTIVE_FI).split(" ").slice(3, 10).join(" ")}"?`, texts)).toBe(true);
    expect(directiveQuoted("Sopiiko suunnitelmani linjaukseen?", texts)).toBe(false);
    expect(directiveQuoted("What did P2 order about the roads?", texts)).toBe(false);
  });

  it("is logged for both cells", async () => {
    for (const cell of ["reasoning_once", "reasoning_intent"] as const) {
      const logs: Record<string, unknown>[] = [];
      await handleOpenThinkerRequest(depsWith(fake("ok").client, logs), { ...OPEN, cell, question: "Linjaus sanoo: linjat teiden ja vesistöjen varaan. Mitä vaihtoehtoja on?" });
      expect(logs[0]).toMatchObject({ cell, directiveQuoted: true });
    }
  });
});

describe("citation post-check", () => {
  const atoms = scenario.atoms.slice(0, 3);
  const at = (i: number) => {
    const s = atoms[i]!.provenance.observedAt;
    const total = 13 * 60 + 20 + Math.floor(s / 60);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  it("flags a tag beyond the last one and a time that is not the tagged record's", () => {
    expect(citationIssuesOf(`Fine [T1, ${at(0)}] and [T2].`, atoms)).toEqual([]);
    expect(citationIssuesOf("See [T9, 15:40].", atoms)).toEqual([{ kind: "unknown_tag", tag: "T9" }]);
    const wrong = at(1) === "23:59" ? "23:58" : "23:59";
    expect(citationIssuesOf(`See [T2, ${wrong}].`, atoms)).toEqual([{ kind: "time_mismatch", tag: "T2", cited: wrong.replace(":", "."), actual: at(1).replace(":", ".") }]);
  });

  it("is logged with every answered Open Thinker request (null for a fallback)", async () => {
    const logs: Record<string, unknown>[] = [];
    await handleOpenThinkerRequest(depsWith(fake("Katso [T99, 15.40].").client, logs), OPEN);
    expect(logs[0]!.citationIssues).toEqual([{ kind: "unknown_tag", tag: "T99" }]);
    await handleOpenThinkerRequest(depsWith(null, logs), OPEN);
    expect(logs[1]!.citationIssues).toBeNull();
  });
});

describe("per-option verdicts (logging only)", () => {
  it("codes each option line by its last verdict phrase; the old earliest-phrase value is kept beside it", () => {
    const answer = [
      "The newest records show a new fire in L3 [T4, 17:10].",
      "1. Direct attack on L3: gains time on the new fire; departs from the method (no direct attack), if [T4] holds.",
      "2. Hold line on R2: in line with the directive's method; keeps the aim of protecting the village.",
      "3. Burnout from the road: the directive does not cover it.",
    ].join("\n");
    expect(aiVerdictsOf(answer, "en")).toEqual([
      { line: 1, verdict: "departs", text: expect.stringMatching(/^1\. Direct attack/) },
      { line: 2, verdict: "in_line", text: expect.stringMatching(/^2\. Hold line/) },
      { line: 3, verdict: "not_covered", text: expect.stringMatching(/^3\. Burnout/) },
    ]);
    expect(aiVerdictOf(answer, "en")).toBe("departs");
    expect(aiVerdictsOf("Tämä poikkeaa linjauksesta.\nTämä on linjassa.", "fi")!.map((v) => v.verdict)).toEqual(["departs", "in_line"]);
    expect(aiVerdictsOf("Option 1 departs.", "en", "Should we evacuate Bay Village?")).toBeNull();
    expect(aiVerdictsOf("Two options, no verdict.", "en")).toEqual([]);
  });
});

describe("the client's query id reaches the server log", () => {
  it("is validated and logged by both endpoints", async () => {
    expect(validateThinkerRequest({ ...OPEN, queryId: "bad id!" }, "open_thinker")).toEqual({ ok: false, error: "invalid queryId" });
    expect(validateThinkerRequest({ ...OPEN }, "open_thinker")).toMatchObject({ ok: true, request: { queryId: "ai_open.3" } });
    const logs: Record<string, unknown>[] = [];
    await handleOpenThinkerRequest(depsWith(fake("ok").client, logs), OPEN);
    await handleThinkerRequest(depsWith(fake(JSON.stringify({ vastaus: "v", perusteet: "p", varmuus: "m", muuttaisi: "u" })).client, logs), { ...OPEN, queryId: "ai.4" });
    const { queryId: _drop, ...withoutId } = OPEN;
    await handleOpenThinkerRequest(depsWith(null, logs), withoutId);
    expect(logs.map((l) => l.queryId)).toEqual(["ai_open.3", "ai.4", null]);
  });
});

describe("the place-name line (gazetteer)", () => {
  it("maps each named place fi = en, from the one authoritative table, identically in every cell and view", () => {
    expect(gazetteerLine("en")).toMatch(/^Place names \(Finnish = English; the records and your answer use the English names\): Lahdenkylä = Bay Village; Mökkiranta = Lakeside Cottages; /);
    expect(gazetteerLine("fi")).toMatch(/^Paikannimet \(suomi = englanti; tietueet ja vastauksesi käyttävät suomenkielisiä nimiä\): .*Honkaharju = Pine Ridge$/);
    for (const view of [1, 9, 14]) for (const lang of ["fi", "en"] as const) expect(openPlanContext(scenario, view, startOf(view), lang).split("\n").at(-1)).toBe(gazetteerLine(lang));
  });
});

describe("robustness: a fixed seed and one identical retry on 429 / 503", () => {
  it("retries a 503 once with the identical request and answers", async () => {
    const { client, create } = fake(httpError(503), "ok");
    const outcome = await callOpenThinkerModel(client, "s", "u");
    expect(outcome).toMatchObject({ ok: true, answer: { kind: "lookup" }, attempts: 2 });
    expect(create).toHaveBeenCalledTimes(2);
    const [a, b] = create.mock.calls.map((c) => c[0] as { config: { seed: number } });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a!.config.seed).toBe(THINKER_SEED);
  });

  it("gives up after one retry (rate_limited), and does not retry other errors", async () => {
    const twice = fake(httpError(429), httpError(429));
    expect(await callOpenThinkerModel(twice.client, "s", "u")).toMatchObject({ ok: false, reason: "rate_limited", attempts: 2 });
    const once = fake(httpError(500));
    expect(await callOpenThinkerModel(once.client, "s", "u")).toMatchObject({ ok: false, reason: "api_error", attempts: 1 });
    expect(once.create).toHaveBeenCalledTimes(1);
    expect(isRetryable(new Error("RESOURCE_EXHAUSTED: quota"))).toBe(true);
    expect(isRetryable(httpError(401))).toBe(false);
  });

  it("Haku retries too, and both log the attempts", async () => {
    const logs: Record<string, unknown>[] = [];
    const four = JSON.stringify({ vastaus: "v", perusteet: "p", varmuus: "m", muuttaisi: "u" });
    const r = await handleThinkerRequest(depsWith(fake(httpError(503), four).client, logs), OPEN);
    expect((r.body as ThinkerResponse).fallback).toBe(false);
    await handleOpenThinkerRequest(depsWith(fake("ok").client, logs), OPEN);
    expect(logs.map((l) => l.attempts)).toEqual([2, 1]);
    expect(((await handleOpenThinkerRequest(depsWith(fake("ok").client), OPEN)).body as OpenThinkerResponse).fallback).toBe(false);
  });
});
