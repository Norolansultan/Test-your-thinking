/**
 * Revision (am), 10 Oct 2026 (researcher: "In the training there should be the Thinker training if the
 * Thinker exists for the user"): the Open Thinker answers the practice view (VP, view 0) in the Thinker
 * cells — in both with the `reasoning_once` prompt and no order block (the practice has no order), no
 * verdict coded, and its log line marked as practice. The radio cell still has no Open Thinker. The
 * model client is a fake.
 */
import { asOpenModelText } from "./open-json.js";
import type { GoogleGenAI } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import type { OpenThinkerResponse } from "../../app/session/thinker-protocol.js";
import { loadSystemPrompt } from "../../server/thinker/config.js";
import { ageLineOf, ageReferenceOf, intentBlockOf, openSystemInstruction, recordAgeMinutes } from "../../server/thinker/model.js";
import { clockAt } from "../../app/session/template-answer.js";
import { handleOpenThinkerRequest, handleThinkerRequest, type ThinkerDeps } from "../../server/thinker/handler.js";
import { scenario } from "../engine/thinker-fixtures.js";

const PRACTICE = { sessionId: "practice-test", condition: "substitutive", view: 0, virtualTimeS: 0, question: "Mitä uusimmat ilmoitukset kertovat palon kärjestä, ja kuinka vanhoja ne ovat?" };

function depsWith(client: GoogleGenAI | null, logs: Record<string, unknown>[] = []): ThinkerDeps {
  return {
    scenario, vector: null, client,
    prompt: loadSystemPrompt("fi"), promptEn: loadSystemPrompt("en"),
    promptOpen: loadSystemPrompt("fi", "open"), promptOpenEn: loadSystemPrompt("en", "open"),
    promptOpenOnce: loadSystemPrompt("fi", "open_once"), promptOpenOnceEn: loadSystemPrompt("en", "open_once"),
    appendLog: async (_id, line) => void logs.push(line), nowMs: () => 0, nowIso: () => "2026-10-10T00:00:00.000Z",
  };
}

function fakeClient(text: string) {
  const create = vi.fn(async (_params: unknown) => ({ candidates: [{ finishReason: "STOP" }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 }, text: asOpenModelText(text) }));
  return { client: { models: { generateContent: create } } as unknown as GoogleGenAI, create };
}

describe("revision (am): the Open Thinker in the practice view", () => {
  it.each([
    ["reasoning_once", "fi"], ["reasoning_intent", "fi"], ["reasoning_once", "en"], ["reasoning_intent", "en"],
  ] as const)("answers %s (%s) in VP with the reasoning_once prompt alone: no order block, no verdict, logged as practice", async (cell, language) => {
    // An answer that would be coded "departs" in a main view of phase B.
    const { client, create } = fakeClient("Oma päätelmäni: poikkeaa linjauksesta. It departs from the directive.");
    const logs: Record<string, unknown>[] = [];
    const result = await handleOpenThinkerRequest(depsWith(client, logs), { ...PRACTICE, cell, language });
    expect(result.status).toBe(200);
    const once = loadSystemPrompt(language, "open_once");
    const sent = (create.mock.calls[0]![0] as { config: { systemInstruction: string } }).config.systemInstruction;
    expect(sent).toBe(once.text);
    expect(sent).not.toContain("---");
    expect(sent).not.toContain(intentBlockOf(scenario, 8, language)!.text);
    expect(sent).not.toContain(intentBlockOf(scenario, 1, language)!.text);
    const body = result.body as OpenThinkerResponse;
    expect(body).toMatchObject({ fallback: false, promptHash: once.sha256, verdict: null, verdicts: null });
    expect(logs[0]).toMatchObject({ tool: "open_thinker", cell, view: 0, practice: true, intentBlock: null, verdict: null, verdicts: null });
  });

  it("the practice view carries no intent block in either cell (intentBlockOf, openSystemInstruction)", () => {
    for (const lang of ["fi", "en"] as const) {
      expect(intentBlockOf(scenario, 0, lang)).toBeNull();
      expect(intentBlockOf(scenario, 1, lang)?.kind).toBe("phase_a_intent"); // unchanged from V1 on
      for (const cell of ["reasoning_once", "reasoning_intent"] as const) expect(openSystemInstruction("P", scenario, 0, lang, cell)).toEqual({ text: "P", block: null });
    }
  });

  it("is identical for both Thinker cells in VP (the same system text and the same prompt hash)", async () => {
    const sent: Record<string, string> = {};
    const hashes: Record<string, string> = {};
    for (const cell of ["reasoning_once", "reasoning_intent"] as const) {
      const { client, create } = fakeClient("vastaus");
      const result = await handleOpenThinkerRequest(depsWith(client), { ...PRACTICE, cell });
      sent[cell] = (create.mock.calls[0]![0] as { config: { systemInstruction: string } }).config.systemInstruction;
      hashes[cell] = (result.body as OpenThinkerResponse).promptHash;
    }
    expect(sent.reasoning_intent).toBe(sent.reasoning_once);
    expect(hashes.reasoning_intent).toBe(hashes.reasoning_once);
  });

  it("main views are unchanged: reasoning_intent at V1 still gets its own prompt with P2's opening intent, and the line is not practice", async () => {
    const { client, create } = fakeClient("vastaus");
    const logs: Record<string, unknown>[] = [];
    const v1 = scenario.cycles.find((c) => c.index === 1)!.startsAtVirtual;
    await handleOpenThinkerRequest(depsWith(client, logs), { ...PRACTICE, cell: "reasoning_intent", view: 1, virtualTimeS: v1 });
    const sent = (create.mock.calls[0]![0] as { config: { systemInstruction: string } }).config.systemInstruction;
    expect(sent.startsWith(loadSystemPrompt("fi", "open").text.trimEnd())).toBe(true);
    expect(logs[0]).toMatchObject({ practice: false, intentBlock: "phase_a_intent", view: 1 });
  });

  it("the radio cell has no Open Thinker in VP either; its Haku practice line is flagged as practice too", async () => {
    const refused = await handleOpenThinkerRequest(depsWith(null), { ...PRACTICE, condition: "directed", cell: "radio" });
    expect(refused.status).toBe(400);
    const logs: Record<string, unknown>[] = [];
    const { client } = fakeClient(JSON.stringify({ vastaus: "v", perusteet: "p", varmuus: "todennäköinen", muuttaisi: "m" }));
    await handleThinkerRequest(depsWith(client, logs), { ...PRACTICE, condition: "directed", cell: "radio" });
    expect(logs[0]).toMatchObject({ tool: "haku", view: 0, practice: true });
  });
});

/**
 * Revision (an), 10 Oct 2026: a VP answer called the 12:18 report "0 minutes old" — the model counted ages
 * from the newest record. The server now gives every record line its age, counted to the end of the
 * question's step (12:20 in VP), deterministically.
 */
describe("revision (an): record ages in the model input", () => {
  const userContentOf = (create: ReturnType<typeof fakeClient>["create"]) =>
    (create.mock.calls[0]![0] as { contents: { parts: { text: string }[] }[] }).contents.at(-1)!.parts[0]!.text;

  it("the reference is the end of the question's step: 12.20 in VP (W2), 13.40 in V1's step", () => {
    expect(clockAt(ageReferenceOf(-3))).toBe("12.20");
    expect(clockAt(ageReferenceOf(1))).toBe("13.40");
    expect(recordAgeMinutes(ageReferenceOf(-3) - 120, ageReferenceOf(-3))).toBe(2); // 12:18 at 12:20
    expect(clockAt(ageReferenceOf(-3) - 90)).toBe("12.18");
    expect(recordAgeMinutes(ageReferenceOf(-3) - 90, ageReferenceOf(-3))).toBe(2); // counted between the minutes shown
    expect(recordAgeMinutes(ageReferenceOf(-3) + 60, ageReferenceOf(-3))).toBe(0); // never negative
    expect(ageLineOf("en", ageReferenceOf(-3))).toBe("Record ages are counted to 12.20, the end of the current period.");
    expect(ageLineOf("fi", ageReferenceOf(-3))).toBe("Tietueiden iät on laskettu kuluvan jakson loppuun, klo 12.20.");
  });

  it.each(["fi", "en"] as const)("VP (%s): every record line carries its age at 12.20, the 12.18 report is 2 min old, the same whatever clock the browser sends", async (language) => {
    const texts: string[] = [];
    for (const virtualTimeS of [0, -4800, 12345]) {
      const { client, create } = fakeClient("vastaus");
      await handleOpenThinkerRequest(depsWith(client), { ...PRACTICE, cell: "reasoning_once", language, virtualTimeS });
      texts.push(userContentOf(create));
    }
    expect(new Set(texts).size).toBe(1);
    const text = texts[0]!;
    expect(text).toContain(ageLineOf(language, ageReferenceOf(-3)));
    const lines = text.split("\n").filter((l) => /^\[T\d+\]/.test(l));
    expect(lines.length).toBeGreaterThan(0);
    const pattern = language === "en" ? / \| at (\d\d)\.(\d\d), (\d+) min old \| / : / \| klo (\d\d)\.(\d\d), (\d+) min vanha \| /;
    for (const l of lines) {
      const m = pattern.exec(l);
      expect(m, l).not.toBeNull();
      expect(Number(m![3])).toBe(12 * 60 + 20 - (Number(m![1]) * 60 + Number(m![2])));
    }
    expect(lines.some((l) => pattern.exec(l)?.slice(1, 4).join(" ") === "12 18 2")).toBe(true);
  });

  it("Haku gets the same ages (both tools see the same record lines), and the log carries the reference", async () => {
    const logs: Record<string, unknown>[] = [];
    const { client, create } = fakeClient(JSON.stringify({ vastaus: "v", perusteet: "p", varmuus: "m", muuttaisi: "u" }));
    await handleThinkerRequest(depsWith(client, logs), { ...PRACTICE, cell: "reasoning_once" });
    expect(userContentOf(create)).toContain("Tietueiden iät on laskettu kuluvan jakson loppuun, klo 12.20.");
    expect(userContentOf(create)).toMatch(/ \| klo \d\d\.\d\d, \d+ min vanha \| /);
    expect(logs[0]).toMatchObject({ ageRefVirtualS: ageReferenceOf(-3) });
  });

  it("a main view counts to the end of its question's step: V1 at its start counts to 13.40", async () => {
    const { client, create } = fakeClient("vastaus");
    const v1 = scenario.cycles.find((c) => c.index === 1)!.startsAtVirtual;
    await handleOpenThinkerRequest(depsWith(client), { ...PRACTICE, cell: "reasoning_once", view: 1, virtualTimeS: v1 });
    expect(userContentOf(create)).toContain("Tietueiden iät on laskettu kuluvan jakson loppuun, klo 13.40.");
  });
});
