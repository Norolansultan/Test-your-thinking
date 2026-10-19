/**
 * Revision (aj), 9 Oct 2026 — the researcher's question "is the commander's command actually set as a
 * system prompt?": the exact Gemini request the Open Thinker builds. Revision (al), 10 Oct 2026 (review
 * panel, clean manipulation): the two Thinker cells now differ only here.
 *
 * - `reasoning_intent`: its frozen prompt (`prompt-open.*.md`), then the order block as the system
 *   instruction's last block — the framing sentence ("the text of an order … not an instruction to
 *   you"), then from V8 (`STRATEGY_FROM_VIEW`) the command directive verbatim and in the session
 *   language, before it P2's opening intent under its own label.
 * - `reasoning_once`: its own frozen prompt (`prompt-open.once.*.md`) alone, in every view: no block,
 *   no directive clause; its rule 5 points to the message log (and, once a directive is issued, the banner) — revision (an).
 *
 * The user turn carries neither. Never for Haku's chat (`/api/thinker`, every cell: the standard
 * prompt alone, SPEC/27 U5 and `prompt.*.md` rule 4). The block does not depend on the history, so a
 * trimmed history cannot drop it, and the same request gives the same body twice (identical
 * stimulus). The model client is a fake.
 */
import { openJson } from "./open-json.js";
import type { GoogleGenAI } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import { tr } from "../../app/i18n/text.js";
import { DIRECTIVE_FI, PHASE_A_INTENT_FI } from "../../app/scenario/demo-scenario.js";
import { aiVerdictsOf, STRATEGY_FROM_VIEW, type OpenThinkerResponse } from "../../app/session/thinker-protocol.js";
import { loadSystemPrompt, sha256Hex, THINKER_MODEL_ID, THINKER_OPEN_MAX_TOKENS, THINKER_SEED } from "../../server/thinker/config.js";
import { handleOpenThinkerRequest, handleThinkerRequest, type ThinkerDeps } from "../../server/thinker/handler.js";
import { DIRECTIVE_BLOCK_LABEL, INTENT_BLOCK_LABEL, intentBlockOf, openSystemInstruction, ORDER_BLOCK_FRAME } from "../../server/thinker/model.js";
import { loadDirectivePremises, premisesBlock } from "../../server/thinker/directive-premises.js";
import { loadPremiseEvidence, premiseBlockStatuses, premiseCheck, recordLookupOf } from "../../server/thinker/premise-check.js";
import { receivedUpToOf } from "../../server/thinker/model.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { scenario, stepAtViewStart } from "../engine/thinker-fixtures.js";

/** SPEC/30 §3: the premise check the block states at a view's start (the table at the records clock of the time-gated records). */
const checkAtViewStart = (view: number, lang: "fi" | "en") =>
  premiseBlockStatuses(premiseCheck(loadPremiseEvidence(), view, receivedUpToOf(reachableAtoms(scenario.atoms, stepAtViewStart(view)), 0))!, recordLookupOf(scenario.atoms), lang);

type Cell = "reasoning_once" | "reasoning_intent";
type Lang = "fi" | "en";

interface GeminiRequest {
  readonly model: string;
  readonly contents: readonly { readonly role: string; readonly parts: readonly { readonly text: string }[] }[];
  readonly config: { readonly systemInstruction: string; readonly temperature: number; readonly maxOutputTokens: number; readonly seed: number; readonly thinkingConfig: { readonly thinkingBudget: number } };
}

const DIRECTIVE: Readonly<Record<Lang, string>> = { fi: DIRECTIVE_FI, en: tr("en", DIRECTIVE_FI) };
const INTENT: Readonly<Record<Lang, string>> = { fi: PHASE_A_INTENT_FI, en: tr("en", PHASE_A_INTENT_FI) };
const QUESTION: Readonly<Record<Lang, string>> = {
  en: "Should I send the reserve to the north edge or keep protecting the village?",
  fi: "Pitäisikö reservi lähettää pohjoisreunalle vai jatkaa kylän suojaamista?",
};
const startOf = (view: number) => scenario.cycles.find((c) => c.index === view)!.startsAtVirtual;
const request = (cell: Cell, view: number, lang: Lang, history: readonly { role: "user" | "model"; text: string }[] = []) => ({
  sessionId: "directive-test", condition: "substitutive", view, virtualTimeS: startOf(view), question: QUESTION[lang], cell, language: lang, history,
});
const block = (lang: Lang, label: string, text: string) => `\n\n---\n\n${ORDER_BLOCK_FRAME[lang]}\n${label}:\n"${text}"\n`;

function depsWith(logs: Record<string, unknown>[] = []): ThinkerDeps & { readonly create: ReturnType<typeof vi.fn> } {
  const create = vi.fn(async (_params: unknown) => ({ candidates: [{ finishReason: "STOP" }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 }, text: openJson() }));
  return {
    scenario, vector: null, client: { models: { generateContent: create } } as unknown as GoogleGenAI, create,
    prompt: loadSystemPrompt("fi"), promptEn: loadSystemPrompt("en"),
    promptOpen: loadSystemPrompt("fi", "open"), promptOpenEn: loadSystemPrompt("en", "open"),
    promptOpenOnce: loadSystemPrompt("fi", "open_once"), promptOpenOnceEn: loadSystemPrompt("en", "open_once"),
    appendLog: async (_id, line) => void logs.push(line), nowMs: () => 0, nowIso: () => "2026-10-10T00:00:00.000Z",
  };
}

/** The body of the one Gemini request an Open Thinker question makes. */
async function openRequest(cell: Cell, view: number, lang: Lang, history?: readonly { role: "user" | "model"; text: string }[], logs: Record<string, unknown>[] = []): Promise<GeminiRequest> {
  const deps = depsWith(logs);
  const result = await handleOpenThinkerRequest(deps, request(cell, view, lang, history));
  expect(result.status).toBe(200);
  expect(deps.create).toHaveBeenCalledTimes(1);
  return deps.create.mock.calls[0]![0] as GeminiRequest;
}

const PHASE_B_VIEWS = [STRATEGY_FROM_VIEW, 11, 14];
const PHASE_A_VIEWS = [1, 5, STRATEGY_FROM_VIEW - 1];
const LANGS = ["fi", "en"] as const;

describe("reasoning_intent: the system instruction ends with the order block (revisions (aj), (al))", () => {
  const cases = PHASE_B_VIEWS.flatMap((view) => LANGS.map((lang) => [view, lang] as const));

  it.each(cases)("at V%i (%s): the frozen prompt + the framing sentence + the directive, verbatim and in the session language", async (view, lang) => {
    const logs: Record<string, unknown>[] = [];
    const body = await openRequest("reasoning_intent", view, lang, [], logs);
    const prompt = loadSystemPrompt(lang, "open");
    const other: Lang = lang === "fi" ? "en" : "fi";
    expect(body.model).toBe(THINKER_MODEL_ID);
    expect(body.config).toMatchObject({ temperature: 0, maxOutputTokens: THINKER_OPEN_MAX_TOKENS, seed: THINKER_SEED, thinkingConfig: { thinkingBudget: 0 } });
    // Revision (ar): the authored premises follow the quoted directive (a blank line between); SPEC/30 §3: each with the table's premise check.
    expect(body.config.systemInstruction).toBe(`${prompt.text.trimEnd()}${block(lang, DIRECTIVE_BLOCK_LABEL[lang], DIRECTIVE[lang])}
${premisesBlock(loadDirectivePremises(), lang, checkAtViewStart(view, lang))}`);
    expect(body.config.systemInstruction).not.toContain(DIRECTIVE[other]);
    expect(body.config.systemInstruction).not.toContain(INTENT_BLOCK_LABEL[lang]);
    // The user turn carries the plan context and the question, not the directive: it is data in the system instruction, not a record.
    const user = body.contents.at(-1)!.parts[0]!.text;
    expect(user).toContain(QUESTION[lang]);
    expect(user).not.toContain(DIRECTIVE[lang]);
    expect(user).not.toContain(DIRECTIVE_BLOCK_LABEL[lang]);
    // The frozen prompt's hash is the response's; the log also carries the hash of the system text actually sent.
    expect(logs[0]).toMatchObject({ tool: "open_thinker", cell: "reasoning_intent", view, promptHash: prompt.sha256, systemPromptHash: sha256Hex(body.config.systemInstruction), intentBlock: "directive" });
    expect(logs[0]!.systemPromptHash).not.toBe(prompt.sha256);
  });

  it.each(PHASE_A_VIEWS)("at V%i (phase A) it carries P2's opening intent under its own label, never the directive, and codes no verdict", async (view) => {
    for (const lang of LANGS) {
      const logs: Record<string, unknown>[] = [];
      const body = await openRequest("reasoning_intent", view, lang, [], logs);
      expect(body.config.systemInstruction).toBe(`${loadSystemPrompt(lang, "open").text.trimEnd()}${block(lang, INTENT_BLOCK_LABEL[lang], INTENT[lang])}`);
      expect(body.config.systemInstruction).not.toContain(DIRECTIVE.fi);
      expect(body.config.systemInstruction).not.toContain(DIRECTIVE.en);
      expect(body.contents.at(-1)!.parts[0]!.text).not.toContain(INTENT[lang]);
      expect(logs[0]).toMatchObject({ intentBlock: "phase_a_intent" });
      expect((await handleOpenThinkerRequest(depsWith(), request("reasoning_intent", view, lang))).body as OpenThinkerResponse).toMatchObject({ verdict: null, verdicts: null });
    }
  });

  it("does not depend on the history (a trimmed history cannot drop it)", async () => {
    const history = Array.from({ length: 10 }, (_, i) => ({ role: (i % 2 === 0 ? "user" : "model") as "user" | "model", text: i % 2 === 0 ? "earlier question" : "earlier answer" }));
    const without = await openRequest("reasoning_intent", 11, "en");
    const withHistory = await openRequest("reasoning_intent", 11, "en", history);
    expect(withHistory.config.systemInstruction).toBe(without.config.systemInstruction);
    expect(withHistory.contents).toHaveLength(11);
    expect(withHistory.contents.at(-1)!.parts[0]!.text).toBe(without.contents.at(-1)!.parts[0]!.text);
  });
});

describe("reasoning_once: its own frozen prompt alone, in every view (revision (al))", () => {
  const cases = [...PHASE_A_VIEWS, ...PHASE_B_VIEWS].flatMap((view) => LANGS.map((lang) => [view, lang] as const));

  it.each(cases)("at V%i (%s): systemInstruction = prompt-open.once alone; no directive, no intent, no frame anywhere in the request", async (view, lang) => {
    const logs: Record<string, unknown>[] = [];
    const body = await openRequest("reasoning_once", view, lang, [], logs);
    const prompt = loadSystemPrompt(lang, "open_once");
    expect(body.config.systemInstruction).toBe(prompt.text);
    expect(body.config).toMatchObject({ temperature: 0, maxOutputTokens: THINKER_OPEN_MAX_TOKENS, seed: THINKER_SEED });
    const all = JSON.stringify(body);
    for (const text of [DIRECTIVE.fi, DIRECTIVE.en, INTENT.fi, INTENT.en, ORDER_BLOCK_FRAME[lang], DIRECTIVE_BLOCK_LABEL[lang], INTENT_BLOCK_LABEL[lang]]) expect(all).not.toContain(text);
    expect(logs[0]).toMatchObject({ cell: "reasoning_once", promptHash: prompt.sha256, systemPromptHash: prompt.sha256, intentBlock: null });
  });

  it("the two cells' user turns are identical; only the system instruction differs", async () => {
    for (const view of [3, 11]) {
      const once = await openRequest("reasoning_once", view, "fi");
      const intent = await openRequest("reasoning_intent", view, "fi");
      expect(once.contents).toEqual(intent.contents);
      expect(once.config.systemInstruction).not.toBe(intent.config.systemInstruction);
    }
  });

  it("its prompt says any orders are in the message log (the banner once a directive is issued), in a first-person sentence, and allows assessing a quoted order", () => {
    const en = loadSystemPrompt("en", "open_once").text;
    // Revision (an): true in every view — VP has no banner and no order yet.
    expect(en).toMatch(/5\. Orders: .*any orders from P2 are in the message log \(and, once a directive is issued, in the directive banner on the screen\)/s);
    expect(en).toContain(`"P2's orders are not given to me: any orders from P2 are in the message log (and, once a directive is issued, in the directive banner), so I cannot confirm them."`);
    expect(en).not.toMatch(/a directive in force is shown in the directive banner/);
    expect(en).toMatch(/If the commander quotes the text of an order in the question, you may relate the options to the quoted text/);
    expect(en).not.toMatch(/At the end of these instructions/);
    const fi = loadSystemPrompt("fi", "open_once").text;
    expect(fi).toMatch(/5\. Käskyt: .*P2:n mahdolliset käskyt ovat viestilokissa \(ja kun linjaus on annettu, myös ruudun linjausbannerissa\)/s);
    // Revision (an): the sentence the model says is first-person ("en voi"); a live VP answer copied the old second person ("et voi").
    expect(fi).toContain(`"P2:n käskyjä ei ole annettu minulle: mahdolliset käskyt ovat viestilokissa (ja kun linjaus on annettu, myös linjausbannerissa), joten en voi vahvistaa niitä."`);
    expect(fi).not.toMatch(/et voi vahvistaa/);
    expect(fi).not.toMatch(/voimassa oleva linjaus näkyy ruudun linjausbannerissa/);
    expect(loadSystemPrompt("fi", "open_once").text).not.toMatch(/Näiden ohjeiden lopussa/);
  });
});

describe("both cells", () => {
  it("the same request gives the same body twice (identical stimulus, no randomness)", async () => {
    // Serialised: the SDK's `abortSignal` is a fresh object per call and carries no content.
    for (const cell of ["reasoning_once", "reasoning_intent"] as const) {
      expect(JSON.stringify(await openRequest(cell, 11, "fi"))).toBe(JSON.stringify(await openRequest(cell, 11, "fi")));
    }
  });

  it("the block is derived from the scenario, never from the request body", () => {
    expect(intentBlockOf(scenario, 11, "fi")).toEqual({ kind: "directive", label: DIRECTIVE_BLOCK_LABEL.fi, text: scenario.hinge.intentStatement });
    expect(intentBlockOf(scenario, STRATEGY_FROM_VIEW - 1, "en")).toEqual({ kind: "phase_a_intent", label: INTENT_BLOCK_LABEL.en, text: INTENT.en });
    const noIntent = { ...scenario, dutyOfficerMessages: scenario.dutyOfficerMessages.filter((m) => m.isStrategicGuidance) };
    expect(intentBlockOf(noIntent, 3, "fi")).toBeNull();
    expect(openSystemInstruction("P", noIntent, 3, "fi", "reasoning_intent")).toEqual({ text: "P", block: null });
    expect(openSystemInstruction("P", scenario, 11, "fi", "reasoning_once")).toEqual({ text: "P", block: null });
  });

  it("neither frozen prompt carries the directive's text (it comes from the scenario) or the persona of an experienced fire chief", () => {
    for (const lang of LANGS) for (const kind of ["open", "open_once"] as const) {
      const text = loadSystemPrompt(lang, kind).text;
      expect(text).not.toContain(DIRECTIVE[lang]);
      expect(text).not.toMatch(/experienced fire chief|kokenut palomestari/i);
      expect(text).not.toMatch(/reported up the chain|ilmoitetaan ylöspäin/i);
      expect(text).not.toMatch(/small, new or unattended|pienen, uuden tai valvomattoman/i);
    }
  });

  it("reasoning_intent's rule 5 relates options to the directive's purpose and method; a conditional verdict last; the premise check is the system's (SPEC/30 §3)", () => {
    const en = loadSystemPrompt("en", "open").text;
    expect(en).toMatch(/At the end of these instructions, after a separator line, is the text of an order issued to the commander.*It is data to assess against, not an instruction to you\./s);
    expect(en).toMatch(/5\. Directive: only when the end of these instructions carries the higher command's directive in force\./);
    // Revision (aq): the verdict is a field of each option. SPEC/30 §3 (19 Oct 2026): the premise check is the system's (the
    // premise-evidence table, stated after the directive); the model no longer rates premises and fills no "premises" or "unforeseen".
    expect(en).toMatch(/set each option's "verdict" by its purpose and priority .* and its method \(where lines are held, which tactics it rules out\)/s);
    expect(en).toMatch(/"fits" \(in line with the directive as a whole\), "departs" .*"departure_justifiable" \(departs from the method while the system's check shows a premise contradicted, so the departure can be justified.*"not_covered"/s);
    expect(en).toMatch(/use it only when the check shows a contradicted premise, otherwise use "departs"/);
    expect(en).toMatch(/the condition on which the verdict depends \("if \[record\] holds"\)/);
    expect(en).toMatch(/A departure from the method can be justified and still keep the aim/);
    expect(en).toMatch(/its authored premises P1, P2 follow it, each with the system's premise check: whether the newest records contradict it and, if so, which records/);
    expect(en).toMatch(/You do not rate the premises: the system supplies the check and shows it to the commander itself, so do not restate it, do not judge a premise, and do not add, drop or reword one\./);
    // A departing option names the contradicted premise and says which aim it keeps or puts at risk.
    expect(en).toMatch(/A departing option says in "tradeoffs" which aim of the directive it keeps or puts at risk, and when the check shows a contradicted premise it names that premise by its id \(P1 or P2\)/);
    expect(en).not.toMatch(/"unforeseen"|"premises"|"supported"|"not_addressed"/);
    expect(en).toMatch(/never cite it, P2, a premise or the intent as if it were a record tag/);
    expect(en).toMatch(/never say a plan "violates" it/);
    expect(en).toMatch(/Before that, it carries P2's opening intent: never call it "the directive" or an order in force, and set every option's "verdict" to null/);
    expect(en).toMatch(/You assess, you never enforce\./);
    expect(en).toMatch(/Do not recommend one/);
    const fi = loadSystemPrompt("fi", "open").text;
    expect(fi).toMatch(/5\. Linjaus: vain kun näiden ohjeiden lopussa on ylemmän johdon voimassa oleva linjaus\./);
    expect(fi).toMatch(/aseta jokaisen vaihtoehdon "verdict" sen tarkoituksen ja etusijan/i);
    expect(fi).toMatch(/"departure_justifiable" \(poikkeaa toimintatavasta, kun järjestelmän tarkistuksen mukaan uusimmat tiedot kumoavat lähtöoletuksen/);
    expect(fi).toMatch(/luetellaan linjauksen valmiiksi laaditut lähtöoletukset P1, P2 ja kunkin kohdalla järjestelmän lähtöoletustarkistus/);
    expect(fi).toMatch(/Et arvioi lähtöoletuksia: järjestelmä tekee tarkistuksen ja näyttää sen johtajalle itse/);
    expect(fi).toMatch(/se nimeää sen tunnuksella \(P1 tai P2\)/);
    expect(fi).not.toMatch(/"unforeseen"|"premises"|"supported"|"not_addressed"/);
    expect(fi).toMatch(/älä koskaan sano linjauksesta poikkeamista sellaisenaan vaaralliseksi/);
    // The reasoning_once prompt is unchanged: it still leaves its "premises" field empty.
    expect(loadSystemPrompt("en", "open_once").text).toMatch(/Always leave "premises" empty and set every "verdict" to null\./);
  });

  it("the premise check line is not coded as a verdict (revision (ao))", () => {
    const en = "Premises: the regional premise is supported [T3, 17:10]; a departure from the method can be justified.\n1. Direct attack: departs from the method, if [T4, 17:12] holds.\n2. Defensive line: in line with the directive.";
    expect(aiVerdictsOf(en, "en")).toEqual([
      { line: 1, verdict: "departs", text: "1. Direct attack: departs from the method, if [T4, 17:12] holds." },
      { line: 2, verdict: "in_line", text: "2. Defensive line: in line with the directive." },
    ]);
    expect(aiVerdictsOf("- Premise check: departure can be justified.\n- Option: departs.", "en")!.map((v) => v.line)).toEqual([1]);
    const fi = "Lähtöoletukset: alueellinen tilanne tukee [T3, 17.10]; poikkeaminen voi olla perusteltua.\n1. Suora hyökkäys: poikkeaa toimintatavasta.";
    expect(aiVerdictsOf(fi, "fi")!.map((v) => v.line)).toEqual([1]);
  });
});

describe("Haku's chat never gets the directive (SPEC/27 U5; prompt rule 4 points to the banner)", () => {
  it.each([
    ["radio", "directed"],
    ["reasoning_once", "substitutive"],
    ["reasoning_intent", "substitutive"],
  ] as const)("%s at V11: the standard prompt alone as systemInstruction, no directive anywhere in the request", async (cell, condition) => {
    for (const lang of LANGS) {
      const deps = depsWith();
      deps.create.mockResolvedValueOnce({ candidates: [{ finishReason: "STOP" }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 }, text: JSON.stringify({ vastaus: "v", perusteet: "p", varmuus: "m", muuttaisi: "u" }) });
      const result = await handleThinkerRequest(deps, { ...request("reasoning_once", 11, lang), cell, condition, history: undefined });
      expect(result.status).toBe(200);
      const body = deps.create.mock.calls[0]![0] as GeminiRequest;
      expect(body.config.systemInstruction).toBe(loadSystemPrompt(lang).text);
      expect(JSON.stringify(body)).not.toContain(DIRECTIVE[lang]);
      expect(JSON.stringify(body)).not.toContain(DIRECTIVE_BLOCK_LABEL[lang]);
    }
  });
});
