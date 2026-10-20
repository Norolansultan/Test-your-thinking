/**
 * Revision (ah), 9 Oct 2026: the Haku / Open Thinker review fixes at the proxy. C1: the Open Thinker's
 * output cap holds a 150-word Finnish answer, and a cut-off answer keeps its complete sentences. C2:
 * every chat request carries the current step's best matches besides the frozen retrieval, and an
 * absence is never "certain". H1: the practice view's clock is the view's own. H2: no directive
 * before the hinge — the phase-A block is the commander's own intent and no verdict is coded. H3/M1/M4/
 * M5/H5: the prompts' wording. The model client is a fake.
 */
import { asOpenModelText, openJson, twoOptions } from "./open-json.js";
import type { GoogleGenAI } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import { STRATEGY_FROM_VIEW, type OpenThinkerResponse } from "../../app/session/thinker-protocol.js";
import { clockAtVirtual } from "../../app/render/projection-validity.js";
import { hybridRetrieve } from "../../app/retrieval/hybrid.js";
import { reachableAtoms, stepAtVirtualTime } from "../../app/retrieval/time-gate.js";
import { loadSystemPrompt, THINKER_OPEN_MAX_TOKENS } from "../../server/thinker/config.js";
import { callOpenThinkerModel, completeSentences, INTENT_BLOCK_LABEL, openPlanContext, openSystemInstruction, RECENT_MATCH_SIZE, recentMatches } from "../../server/thinker/model.js";
import { handleOpenThinkerRequest, handleThinkerRequest, type ThinkerDeps } from "../../server/thinker/handler.js";
import { scenario } from "../engine/thinker-fixtures.js";

const specOf = (view: number) => (view === 0 ? scenario.practice.cycle : scenario.cycles.find((c) => c.index === view)!);
const BASE = { sessionId: "ah-test", condition: "substitutive", cell: "reasoning_once" };
const FOUR = JSON.stringify({ vastaus: "v", perusteet: "p", varmuus: "epävarma", muuttaisi: "m" });

function depsWith(client: GoogleGenAI | null, logs: Record<string, unknown>[] = []): ThinkerDeps {
  return {
    scenario, vector: null, client,
    prompt: loadSystemPrompt("fi"), promptEn: loadSystemPrompt("en"),
    promptOpen: loadSystemPrompt("fi", "open"), promptOpenEn: loadSystemPrompt("en", "open"),
    promptOpenOnce: loadSystemPrompt("fi", "open_once"), promptOpenOnceEn: loadSystemPrompt("en", "open_once"),
    appendLog: async (_id, line) => void logs.push(line), nowMs: () => 0, nowIso: () => "2026-10-09T00:00:00.000Z",
  };
}

function fakeClient(text: string, finishReason = "STOP") {
  const create = vi.fn(async (_params: unknown) => ({ candidates: [{ finishReason }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 }, text: asOpenModelText(text) }));
  return { client: { models: { generateContent: create } } as unknown as GoogleGenAI, create };
}
const userTextOf = (create: ReturnType<typeof fakeClient>["create"]) =>
  (create.mock.calls[0]![0] as { contents: { parts: { text: string }[] }[] }).contents.at(-1)!.parts[0]!.text;

describe("C1: the Open Thinker's answer length", () => {
  it("the cap holds 150 Finnish words with citations (about 3 tokens a word) and both prompts ask for at most 150 words", () => {
    expect(THINKER_OPEN_MAX_TOKENS).toBeGreaterThanOrEqual(150 * 3 + 300);
    for (const kind of ["open", "open_once"] as const) {
      // Revision (aq): the limit is enforced by the proxy (`open-answer.ts`); the prompt tells the model it exists.
      expect(loadSystemPrompt("fi", kind).text).toMatch(/rajaa vastauksen noin 150 sanaan/);
      expect(loadSystemPrompt("en", kind).text).toMatch(/limits the answer to about 150 words/);
    }
  });

  it("(aq) a MAX_TOKENS cut is not parsed: it is asked for once more, then it is a fallback (no free text)", async () => {
    const cut = fakeClient('{"kind":"options","facts":[{"text":"Lähteet eroavat', "MAX_TOKENS");
    expect(await callOpenThinkerModel(cut.client, "s", "u")).toMatchObject({ ok: false, reason: "truncated", attempts: 2 });
    expect(cut.create).toHaveBeenCalledTimes(2);
    const logs: Record<string, unknown>[] = [];
    const r = await handleOpenThinkerRequest(depsWith(fakeClient("{ not json").client, logs), { ...BASE, view: 9, virtualTimeS: specOf(9).startsAtVirtual, question: "mitä vaihtoehtoja on?" });
    expect(r.body).toMatchObject({ fallback: true, fallbackReason: "invalid_output", answer: "", structured: null });
  });

  it("completeSentences: a decimal or a clock never ends a sentence", () => {
    expect(completeSentences("Etenee 8.8 m/min klo 15.40 ja")).toBeNull();
    expect(completeSentences("Yksi. Kaksi klo 15.40 ja")).toBe("Yksi.");
    expect(completeSentences("All done.")).toBe("All done.");
    expect(completeSentences("Is it? Yes! And then")).toBe("Is it? Yes!");
  });
});

describe("C2: the current step's best matches", () => {
  const view = 5;
  const step = stepAtVirtualTime(specOf(view), specOf(view).startsAtVirtual)!;
  const gated = reachableAtoms(scenario.atoms, step);
  const question = "Montako pistepaloa on ja missä?";

  it("adds up to RECENT_MATCH_SIZE records of the current step, none already retrieved; the frozen retrieval is unchanged", () => {
    const retrieved = hybridRetrieve(question, gated, null, undefined, "fi");
    const recent = recentMatches(question, gated, step, retrieved, null, "fi");
    expect(recent.length).toBeGreaterThan(0);
    expect(recent.length).toBeLessThanOrEqual(RECENT_MATCH_SIZE);
    for (const a of recent) {
      expect(a.cycle).toBe(step);
      expect(retrieved.map((r) => r.atom.id)).not.toContain(a.id);
    }
    // At V5 the spot fires DR1 confirmed reach the model (the review's V5 answer said "none, certain"); since SPEC/33 stage 7 (the rebuilt
    // map) the crown run throws two, PP1 and PP2 (was PP1–PP3). Revision (aj):
    // EK11's 15:20 move names PP1 and PP2 as well and takes a recent-match slot, so each spot fire is checked by name, not by record id.
    const seen = [...retrieved.map((r) => r.atom), ...recent];
    for (const pp of ["PP1", "PP2"]) expect(seen.some((a) => JSON.stringify(a).includes(pp)), pp).toBe(true);
  });

  it("both chats send them under their own heading, tagged after the retrieved records, and log them as `recent`", async () => {
    for (const handle of [handleThinkerRequest, handleOpenThinkerRequest]) {
      const { client, create } = fakeClient(handle === handleThinkerRequest ? FOUR : "Vastaus.");
      const logs: Record<string, unknown>[] = [];
      await handle(depsWith(client, logs), { ...BASE, view, virtualTimeS: specOf(view).startsAtVirtual, question });
      const text = userTextOf(create);
      const block = /Uusimmat kysymystä koskevat tietueet \(vastaanotettu kuluvalla jaksolla\):\n((?:\[T\d+\][^\n]*\n?)+)/.exec(text);
      expect(block, handle.name).not.toBeNull();
      const recentIds = logs[0]!.recent as string[];
      expect(recentIds.length).toBe(block![1]!.trim().split("\n").length);
      expect(block![1]!.startsWith(`[T${(logs[0]!.retrieved as unknown[]).length + 1}] `)).toBe(true);
    }
  });

  it.each(["fi", "en"] as const)("the %s Search prompt never rates an absence certain, and disagreeing sources are never certain", (lang) => {
    const text = loadSystemPrompt(lang).text;
    if (lang === "en") {
      expect(text).toMatch(/the records contain no X .* is never "certain"/);
      expect(text).toMatch(/never say they agree and never call such an answer "certain"/);
    } else {
      expect(text).toMatch(/ei ole koskaan "varma"/);
      expect(text).toMatch(/älä koskaan sano niiden olevan samaa mieltä/);
    }
  });
});

describe("H1: the practice view's clock", () => {
  it("Haku is told the practice view's own time, whatever clock the browser sends (it sends 0)", async () => {
    const { client, create } = fakeClient(FOUR);
    const logs: Record<string, unknown>[] = [];
    await handleThinkerRequest(depsWith(client, logs), { ...BASE, condition: "directed", cell: "radio", view: 0, virtualTimeS: 0, question: "Missä palon kärki on nyt?" });
    const now = clockAtVirtual(scenario.practice.cycle.startsAtVirtual);
    expect(userTextOf(create).split("\n")[0]).toMatch(new RegExp(`^Nyt: klo ${now.replace(".", "\\.")} /`));
    expect(now).not.toBe(clockAtVirtual(0));
    expect(logs[0]).toMatchObject({ virtualTimeS: 0, clockVirtualS: scenario.practice.cycle.startsAtVirtual });
  });
});

describe("H2: no directive before the hinge", () => {
  // Revision (aj): the block is the system instruction's last block (`openSystemInstruction`), no longer a plan-context line.
  it("the phase-A block is P2's opening intent (revision (al); reasoning_intent only), never the directive", () => {
    for (const lang of ["fi", "en"] as const) {
      const system = openSystemInstruction(loadSystemPrompt(lang, "open").text, scenario, 1, lang, "reasoning_intent");
      expect(system.block?.kind).toBe("phase_a_intent");
      expect(system.text).toContain(INTENT_BLOCK_LABEL[lang]);
      expect(system.text).not.toMatch(lang === "en" ? /Directive in force/ : /Voimassa oleva linjaus/);
      expect(openPlanContext(scenario, 1, specOf(1).startsAtVirtual, lang)).not.toContain(INTENT_BLOCK_LABEL[lang]);
      expect(openSystemInstruction(loadSystemPrompt(lang, "open_once").text, scenario, 1, lang, "reasoning_once")).toEqual({ text: loadSystemPrompt(lang, "open_once").text, block: null });
    }
    expect(INTENT_BLOCK_LABEL.en).toMatch(/duty fire chief's \(P2\) opening intent \(V1; no higher-command directive is in force yet\)/);
    expect(INTENT_BLOCK_LABEL.en).not.toMatch(/commander's own/);
    expect(loadSystemPrompt("en", "open").text).toMatch(/Directive: only when the end of these instructions carries the higher command's directive in force/);
    expect(loadSystemPrompt("fi", "open").text).toMatch(/Linjaus: vain kun näiden ohjeiden lopussa on ylemmän johdon voimassa oleva linjaus/);
  });

  it("codes no verdict before STRATEGY_FROM_VIEW, even when the answer says 'departs'; from it, as before", async () => {
    const answer = openJson({ kind: "options", options: twoOptions("departs", "fits") });
    for (const [view, expected] of [[STRATEGY_FROM_VIEW - 1, null], [1, null], [STRATEGY_FROM_VIEW + 1, "departs"]] as const) {
      const { client } = fakeClient(answer);
      const r = await handleOpenThinkerRequest(depsWith(client), { ...BASE, cell: "reasoning_intent", view, virtualTimeS: specOf(view).startsAtVirtual, question: "What are my options?", language: "en" });
      expect((r.body as OpenThinkerResponse).verdict, `V${view}`).toBe(expected);
    }
  });
});

describe("the prompts' wording (H3, H5, M1, M5)", () => {
  it("Search calls itself Search / Haku, not Thinker", () => {
    expect(loadSystemPrompt("en").text.split("\n")[0]).toMatch(/^You are Search,/);
    expect(loadSystemPrompt("fi").text.split("\n")[0]).toMatch(/^Olet Haku,/);
    for (const lang of ["fi", "en"] as const) expect(loadSystemPrompt(lang).text).not.toMatch(/Thinker/);
  });

  it("Search's rule 4 names the duty fire chief, P2 and the words for an order", () => {
    expect(loadSystemPrompt("en").text).toMatch(/duty fire chief \(P2\).*orders, directive/s);
    expect(loadSystemPrompt("fi").text).toMatch(/päivystävä palopäällikkö \(P2\).*määräykset, linjaus/s);
  });

  it("the Open Thinker never pairs options with safer/unsafer labels, and compares nothing with the directive on withdrawal", () => {
    for (const kind of ["open", "open_once"] as const) {
      expect(loadSystemPrompt("en", kind).text).toMatch(/Never label an option, or what it gives, as safer, less safe/);
      expect(loadSystemPrompt("fi", kind).text).toMatch(/Älä koskaan nimeä vaihtoehtoa tai sen tuomaa etua turvallisemmaksi/);
      expect(loadSystemPrompt("en", kind).text).toMatch(/8\. Kind "safety": this rule overrides rules? 4.*Make no comparison at all with/s);
      expect(loadSystemPrompt("fi", kind).text).toMatch(/8\. Kind "safety": tämä sääntö ohittaa säännö(?:n|t) 4.*Älä vertaa mitään/s);
    }
    expect(loadSystemPrompt("en", "open").text).toMatch(/Make no comparison at all with the directive or the intent/);
    expect(loadSystemPrompt("fi", "open").text).toMatch(/Älä vertaa mitään linjaukseen tai toiminta-ajatukseen/);
  });
});
