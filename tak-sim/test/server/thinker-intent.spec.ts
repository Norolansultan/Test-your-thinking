/**
 * The strategy-guided Thinker (phase B round 2, D1/D2) is WITHDRAWN (Haku / Open Thinker redesign,
 * researcher, 8 Oct 2026): `/api/thinker` answers every cell and view with the standard prompt, no
 * directive and no fifth field. What stays: the request's cell is validated (and is required); the
 * strategy-guided prompt, its schema and `linjaus` parsing are kept frozen so old logs can be read;
 * the prompts are checked against the manifest at start. The model client is a fake.
 */
import type { GoogleGenAI } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import { DIRECTIVE_FI } from "../../app/scenario/demo-scenario.js";
import { tr } from "../../app/i18n/text.js";
import { templateThinkerAnswer, validateThinkerRequest, type ThinkerResponse } from "../../app/session/thinker-protocol.js";
import { ANSWER_SCHEMA, ANSWER_SCHEMA_INTENT, loadSystemPrompt } from "../../server/thinker/config.js";
import { loadCheckedPrompts } from "../../server/thinker/deps.js";
import { handleThinkerRequest, type ThinkerDeps } from "../../server/thinker/handler.js";
import { parseAnswer } from "../../server/thinker/model.js";
import manifest from "../../content/thinker/manifest.json" with { type: "json" };
import { scenario } from "../engine/thinker-fixtures.js";

const DIRECTIVE_EN = tr("en", DIRECTIVE_FI);
const QUESTION = "onko Lahdenkylä uhattuna?";
const startOf = (view: number) => scenario.cycles.find((c) => c.index === view)!.startsAtVirtual;
const body = (cell: "reasoning_once" | "reasoning_intent", view: number, language: "fi" | "en" = "fi") => ({
  sessionId: "intent-test", condition: "substitutive", view, virtualTimeS: startOf(view), question: QUESTION, cell, language,
});

const FOUR = { vastaus: "Lahdenkylää ei ole raportoitu uhatuksi.", perusteet: "EK14 klo 17.05", varmuus: "todennäköinen", muuttaisi: "Uusi havainto." };
const LINJAUS = { tila: "sopii", perustelu: "EK14 klo 17.05 raportoi linjan tien varassa." };

function fakeClient() {
  const create = vi.fn(async (_params: unknown) => ({ candidates: [{ finishReason: "STOP" }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 }, text: JSON.stringify({ ...FOUR, linjaus: LINJAUS }) }));
  return { client: { models: { generateContent: create } } as unknown as GoogleGenAI, create };
}

function depsWith(client: GoogleGenAI | null, logs: Record<string, unknown>[] = []): ThinkerDeps {
  return {
    scenario, vector: null, client,
    prompt: loadSystemPrompt("fi"), promptEn: loadSystemPrompt("en"),
    promptIntent: loadSystemPrompt("fi", "intent"), promptIntentEn: loadSystemPrompt("en", "intent"),
    appendLog: async (_id, line) => void logs.push(line), nowMs: () => 0, nowIso: () => "2026-10-04T00:00:00.000Z",
  };
}

describe("the request's cell", () => {
  const base = { sessionId: "s1", condition: "substitutive", view: 9, virtualTimeS: 1, question: "q" };

  it("is required and must be a cell of the request's condition", () => {
    expect(validateThinkerRequest({ ...base, cell: "reasoning_once" }).ok).toBe(true);
    expect(validateThinkerRequest({ ...base, cell: "reasoning_intent" }).ok).toBe(true);
    for (const cell of [undefined, "radio", "intent", 1, null]) expect(validateThinkerRequest({ ...base, cell }).ok).toBe(false);
  });

  it("is kept in the validated request, alongside the language", () => {
    const v = validateThinkerRequest({ ...base, cell: "reasoning_intent", language: "en" });
    expect(v.ok && v.request).toMatchObject({ cell: "reasoning_intent", language: "en" });
  });

  it("a request without one is refused by the handler (never given a default treatment)", async () => {
    const result = await handleThinkerRequest(depsWith(null), { ...body("reasoning_intent", 9), cell: undefined } as never);
    expect(result).toMatchObject({ status: 400, body: { error: "invalid cell" } });
  });
});

describe("the strategy-guided variant is withdrawn (8 Oct 2026)", () => {
  const cases: ["reasoning_once" | "reasoning_intent", number, "fi" | "en"][] = [];
  for (const cell of ["reasoning_once", "reasoning_intent"] as const) for (const view of [1, 7, 8, 10, 14]) for (const lang of ["fi", "en"] as const) cases.push([cell, view, lang]);

  it.each(cases)("%s at V%i (%s): the standard prompt, no directive, no linjaus", async (cell, view, lang) => {
    const { client, create } = fakeClient();
    const logs: Record<string, unknown>[] = [];
    const result = await handleThinkerRequest(depsWith(client, logs), body(cell, view, lang));
    expect(result.status).toBe(200);
    const response = result.body as ThinkerResponse;
    const params = create.mock.calls[0]![0] as { config: { systemInstruction: string; responseSchema: unknown } };
    expect(params.config.systemInstruction).toBe(loadSystemPrompt(lang).text);
    expect(params.config.systemInstruction).not.toContain(DIRECTIVE_FI);
    expect(params.config.systemInstruction).not.toContain(DIRECTIVE_EN);
    expect(params.config.responseSchema).toBe(ANSWER_SCHEMA);
    expect(response).toMatchObject({ promptVariant: "standard", promptHash: loadSystemPrompt(lang).sha256, fallback: false });
    expect(response.answer).toEqual(FOUR); // a model's linjaus is ignored
    expect(logs[0]).not.toHaveProperty("linjausTila");
  });
});

describe("the fifth field, kept frozen for old logs", () => {
  it("parses the three model statuses", () => {
    for (const tila of ["sopii", "ei_sovi", "ei_liity"]) {
      expect(parseAnswer(JSON.stringify({ ...FOUR, linjaus: { tila, perustelu: "x" } }), "intent")?.linjaus).toEqual({ tila, perustelu: "x" });
    }
    // The standard variant ignores it: its answer stays four-part.
    expect(parseAnswer(JSON.stringify({ ...FOUR, linjaus: LINJAUS }), "standard")).toEqual(FOUR);
  });

  it.each([
    ["the fallback's own status", { tila: "ei_arvioitu", perustelu: "x" }],
    ["an unknown status", { tila: "ehkä", perustelu: "x" }],
    ["an empty reason", { tila: "sopii", perustelu: "  " }],
    ["no reason", { tila: "ei_sovi" }],
    ["not an object", "sopii"],
    ["missing", undefined],
  ])("the kept parser rejects %s (old logs' variant)", (_label, linjaus) => {
    expect(parseAnswer(JSON.stringify({ ...FOUR, linjaus }), "intent")).toBeNull();
  });

  it("templateThinkerAnswer still adds ei_arvioitu for the intent variant (old logs), never for the standard one", () => {
    expect(templateThinkerAnswer([], "fi", "intent").linjaus).toEqual({ tila: "ei_arvioitu", perustelu: "—" });
    expect(templateThinkerAnswer([], "fi")).not.toHaveProperty("linjaus");
  });

  it("the schema asks for it only in the strategy-guided variant, with the three statuses", () => {
    expect(ANSWER_SCHEMA.properties).not.toHaveProperty("linjaus");
    expect(ANSWER_SCHEMA_INTENT.required).toEqual(["vastaus", "perusteet", "varmuus", "muuttaisi", "linjaus"]);
    expect(ANSWER_SCHEMA_INTENT.properties.linjaus.properties.tila.enum).toEqual(["sopii", "ei_sovi", "ei_liity"]);
    expect(ANSWER_SCHEMA_INTENT.additionalProperties).toBe(false);
  });
});

describe("the prompts are checked against the manifest at start", () => {
  it("all four load against the committed manifest", () => {
    const p = loadCheckedPrompts(manifest);
    expect(p.promptIntent?.sha256).toBe(manifest.promptIntent.sha256);
    expect(p.promptIntentEn?.sha256).toBe(manifest.promptIntentEn.sha256);
  });

  it.each(["prompt", "promptEn", "promptIntent", "promptIntentEn"] as const)("a wrong or missing %s hash refuses to start", (key) => {
    expect(() => loadCheckedPrompts({ ...manifest, [key]: { sha256: "0".repeat(64) } })).toThrow(/differs from the manifest/);
    const { [key]: _drop, ...rest } = manifest;
    if (key !== "prompt") expect(() => loadCheckedPrompts(rest as never)).toThrow(/\(none\)/);
  });
});
