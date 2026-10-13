/**
 * The chats in the browser (SPEC/14 revision (q) steps 4–6; SPEC/07 revision (q); Haku / Open
 * Thinker redesign, 8 Oct 2026): Haku's chat works for both groups and in the practice view (D1);
 * the Open Thinker is the AI condition's, main views only; an answer is never shown before the 2.5 s
 * floor; a proxy failure, client timeout or reply of the wrong shape shows the template over locally
 * computed retrieval, flagged as fallback (F1); every log record names its chat (`tool`, D3).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { THINKER_MODEL_ID } from "../../server/thinker/config.js";
import { aiVerdictOf, type OpenThinkerResponse, type ThinkerResponse } from "../../app/session/thinker-protocol.js";
import { SessionQueries } from "../../app/session/queries.js";
import {
  httpOpenThinkerTransport, httpThinkerTransport, ThinkerBadResponseError, ThinkerTimeoutError, type OpenThinkerTransport, type ThinkerTransport,
} from "../../app/session/thinker-transport.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { allocateAndConfirm, runOutView } from "./view-flow.js";

const scenario = buildDemoScenario();

const LIVE: ThinkerResponse = {
  answer: { vastaus: "Lohko L3 on raportoitu hallinnassa.", perusteet: "KY21 klo 16.20", varmuus: "todennäköinen", muuttaisi: "Uusi savuhavainto." },
  retrieved: [{ id: "rekindle.in_hand.ky21", score: 0.9 }],
  modelId: THINKER_MODEL_ID, promptHash: "a".repeat(64), latencyMs: 3100, fallback: false, fallbackReason: null, retrievalMode: "hybrid", promptVariant: "standard",
};

const OPEN_LIVE: OpenThinkerResponse = { ...LIVE, answer: "Suosittelen tarkistamaan L3:n tilanteen." };

async function sessionAtV1(condition: "directed" | "substitutive", transport: ThinkerTransport, openTransport?: OpenThinkerTransport, language: "fi" | "en" = "fi") {
  const o = new SessionOrchestrator(scenario, condition, { language, thinker: { transport, ...(openTransport ? { openTransport } : {}) } });
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  const snap = () => box.snap!;
  await o.start();
  await runOutView(o, snap);
  await allocateAndConfirm(o, snap);
  await o.completeTraining();
  expect(snap().currentCycle).toBe(1);
  return { o, snap };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the Haku group (D1, 8 Oct 2026)", () => {
  it("asks Haku's chat through the proxy with its radio cell, logged as tool haku; has no Open Thinker", async () => {
    const transport = vi.fn<ThinkerTransport>().mockResolvedValue(LIVE);
    const { o, snap } = await sessionAtV1("directed", transport);
    expect(snap().aiAvailable).toBe(false);
    const pending = o.askAiChat("onko suo hallinnassa?");
    await vi.advanceTimersByTimeAsync(2_500);
    expect((await pending).answerFi).toBe(LIVE.answer.vastaus);
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({ cell: "radio", condition: "directed", view: 1 }));
    await expect(o.askOpenThinker("mitä tehdä?")).rejects.toThrow(/not available/);
    const records = await o.logRecords();
    expect(records.filter((r) => r.kind === "ai_chat_query_submitted").map((r) => (r.detail as { tool: string }).tool)).toEqual(["haku"]);
    expect(records.find((r) => r.kind === "ai_chat_answer_received")!.detail).toMatchObject({ tool: "haku", promptVariant: "standard" });
  });

  it.each(["directed", "substitutive"] as const)("asks Haku's chat in the practice view too (%s)", async (condition) => {
    const transport = vi.fn<ThinkerTransport>().mockResolvedValue(LIVE);
    const o = new SessionOrchestrator(scenario, condition, { thinker: { transport } });
    await o.start();
    const pending = o.askAiChat("missä kärki on?");
    await vi.advanceTimersByTimeAsync(2_500);
    await pending;
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({ view: 0, cell: condition === "directed" ? "radio" : "reasoning_once" }));
    // Revision (am): the Open Thinker is the AI group's in VP too (the Thinker practice); the Haku group still has none.
    if (condition === "directed") await expect(o.askOpenThinker("mitä tehdä?")).rejects.toThrow(/not available/);
  });
});

describe("Haku's free text (the AI group's field; final review, 6 Oct 2026)", () => {
  it("is logged as query_submitted with what it showed before the results are returned, and counts as Haku exposure", async () => {
    const transport = vi.fn<ThinkerTransport>().mockResolvedValue(LIVE);
    const { o } = await sessionAtV1("substitutive", transport);
    const before = (await o.logRecords()).length;
    const first = await o.searchAtoms("EK11");
    const records = await o.logRecords();
    expect(records.length).toBe(before + 1);
    expect(records.at(-1)).toMatchObject({
      kind: "query_submitted",
      detail: { queryId: "text.1", text: "EK11", charCount: 4, reformulationChainIndex: 0, view: 1, language: "fi", resultAtomIds: first.map((a) => a.id), phase: "exploration" },
    });
    expect(first.length).toBeGreaterThan(0);
    await o.searchAtoms("EK12");
    expect((await o.logRecords()).at(-1)!.detail).toMatchObject({ queryId: "text.2", reformulationChainIndex: 1 });
    const { freezeItemExposure } = await import("../../app/telemetry/freeze-measures.js");
    const freezeAt = (await o.logRecords()).length;
    const atom = first[0]!.id;
    const fake = [...(await o.logRecords()),
      { seq: freezeAt, tVirtual: 0, tWallOffsetMs: 10_000_000, kind: "freeze_started", detail: { cycle: 1, atViewSeconds: 50, decisionCommittedBeforeFreeze: false, decisionStep: "exploration" } },
      { seq: freezeAt + 1, tVirtual: 0, tWallOffsetMs: 10_000_100, kind: "freeze_submitted", detail: { cycle: 1, responses: [{ itemId: "x", optionId: "a", confidence: 50 }] } },
    ] as never;
    const exposure = freezeItemExposure(fake, [{ cycle: 1, items: [{ id: "x", level: "L1", keyAtomIds: [atom] }] }] as never);
    expect(exposure[0]!.keyAtoms[0]).toMatchObject({ atomId: atom, reached: true });
    expect(exposure[0]!.keyAtoms[0]!.routes).toContain("haku");
  });
});

describe("the AI group", () => {
  it("sends the question, view and virtual time — never records — and holds the answer to the 2.5 s floor", async () => {
    const transport = vi.fn<ThinkerTransport>().mockResolvedValue(LIVE);
    const { o, snap } = await sessionAtV1("substitutive", transport);
    let done = false;
    const pending = o.askAiChat("onko suo hallinnassa?").then(() => (done = true));
    await vi.advanceTimersByTimeAsync(2_499);
    expect(done).toBe(false);
    expect(snap().aiChatHistory).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(snap().aiChatHistory.at(-1)!.answer.answerFi).toBe(LIVE.answer.vastaus);

    expect(transport).toHaveBeenCalledWith({ sessionId: "preview-session", queryId: "ai.1", condition: "substitutive", view: 1, virtualTimeS: 0, question: "onko suo hallinnassa?", cell: "reasoning_once", language: "fi" });
    const records = await o.logRecords();
    expect(records.find((r) => r.kind === "ai_chat_query_submitted")!.detail).toEqual({ queryId: "ai.1", text: "onko suo hallinnassa?", view: 1, virtualTimeS: 0, phase: "exploration", tool: "haku" });
    expect(records.find((r) => r.kind === "ai_chat_answer_received")!.detail).toMatchObject({
      queryId: "ai.1", retrieved: [{ id: "rekindle.in_hand.ky21", fusedScore: 0.9 }], modelId: THINKER_MODEL_ID, promptHash: LIVE.promptHash, answer: LIVE.answer,
      latencyMs: 3100, fallback: false, fallbackReason: null, retrievalMode: "hybrid", promptVariant: "standard",
    });
  });

  it("shows a slower answer when it arrives", async () => {
    const transport: ThinkerTransport = () => new Promise((resolve) => setTimeout(() => resolve(LIVE), 6_000));
    const { o } = await sessionAtV1("substitutive", transport);
    let done = false;
    const pending = o.askAiChat("EK11").then(() => (done = true));
    await vi.advanceTimersByTimeAsync(5_999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
  });

  it.each([
    ["network_error", new TypeError("Failed to fetch"), null],
    ["client_timeout", new ThinkerTimeoutError(25_000), 25_000],
  ])("falls back to the local template on %s, logged as fallback", async (reason, error, latencyMs) => {
    const { o, snap } = await sessionAtV1("substitutive", vi.fn<ThinkerTransport>().mockRejectedValue(error));
    const pending = o.askAiChat("EK11");
    await vi.advanceTimersByTimeAsync(2_500);
    const answer = await pending;
    expect(answer.answerFi.length).toBeGreaterThan(0);
    expect(snap().aiChatHistory).toHaveLength(1);
    const detail = (await o.logRecords()).find((r) => r.kind === "ai_chat_answer_received")!.detail as Record<string, unknown>;
    expect(detail).toMatchObject({ fallback: true, fallbackReason: reason, retrievalMode: "lexical_only", latencyMs, modelId: THINKER_MODEL_ID });
    const retrieved = detail.retrieved as { id: string }[];
    expect(retrieved.length).toBeGreaterThan(0);
    for (const r of retrieved) expect(scenario.atoms.find((a) => a.id === r.id)!.cycle).toBeLessThanOrEqual(1); // the V1 gate
  });

  describe("a proxy answer of the wrong shape (systems review F4, 7 Oct 2026)", () => {
    afterEach(() => vi.unstubAllGlobals());
    const answering = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));

    it.each([
      ["no answer", { ...LIVE, answer: undefined }],
      ["a field that is not a string", { ...LIVE, answer: { ...LIVE.answer, vastaus: 42 } }],
      ["a malformed linjaus", { ...LIVE, answer: { ...LIVE.answer, linjaus: "sopii" } }],
      ["retrieved not an array", { ...LIVE, retrieved: { id: "x" } }],
      ["a retrieved entry without its score", { ...LIVE, retrieved: [{ id: "x" }] }],
      ["not an object", ["vastaus"]],
    ])("is refused by the transport: %s", async (_, body) => {
      vi.stubGlobal("fetch", answering(body));
      await expect(httpThinkerTransport("/api/thinker", 1_000)(null as never)).rejects.toThrow(ThinkerBadResponseError);
    });

    it("passes a well-formed answer through", async () => {
      vi.stubGlobal("fetch", answering(LIVE));
      await expect(httpThinkerTransport("/api/thinker", 1_000)(null as never)).resolves.toEqual(LIVE);
    });

    it("falls back to the local template as a network error, logged", async () => {
      const { o } = await sessionAtV1("substitutive", httpThinkerTransport("/api/thinker", 25_000));
      vi.stubGlobal("fetch", answering({ ...LIVE, answer: { vastaus: null } }));
      const pending = o.askAiChat("EK11");
      await vi.advanceTimersByTimeAsync(2_500);
      expect((await pending).answerFi.length).toBeGreaterThan(0);
      const detail = (await o.logRecords()).find((r) => r.kind === "ai_chat_answer_received")!.detail;
      expect(detail).toMatchObject({ fallback: true, fallbackReason: "network_error", retrievalMode: "lexical_only" });
    });
  });

  it("refuses a question over 500 characters without calling the proxy", async () => {
    const transport = vi.fn<ThinkerTransport>().mockResolvedValue(LIVE);
    const { o } = await sessionAtV1("substitutive", transport);
    await expect(o.askAiChat("a".repeat(501))).rejects.toThrow(RangeError);
    expect(transport).not.toHaveBeenCalled();
  });
});

describe("the Open Thinker (8 Oct 2026)", () => {
  const ask = async (o: SessionOrchestrator, q: string) => { const p = o.askOpenThinker(q); await vi.advanceTimersByTimeAsync(2_500); return p; };

  it("sends the history — whole turns, the participant's first, at most 10, a model turn cut to 4000 — and logs tool open_thinker", async () => {
    const long = { ...OPEN_LIVE, answer: "x".repeat(5000) };
    const openTransport = vi.fn<OpenThinkerTransport>().mockResolvedValue(long);
    const { o } = await sessionAtV1("substitutive", vi.fn<ThinkerTransport>(), openTransport);
    for (let i = 0; i < 7; i++) await ask(o, `kysymys ${i}`);
    const history = openTransport.mock.calls.at(-1)![0].history!;
    expect(history).toHaveLength(10);
    expect(history.map((h) => h.role)).toEqual(["user", "model", "user", "model", "user", "model", "user", "model", "user", "model"]);
    expect(history[0]).toEqual({ role: "user", text: "kysymys 1" });
    expect(history[1]!.text).toHaveLength(4000);
    expect(openTransport.mock.calls[0]![0]).toMatchObject({ condition: "substitutive", cell: "reasoning_once", history: [] });
    const records = await o.logRecords();
    expect(records.filter((r) => r.kind === "ai_chat_query_submitted").map((r) => (r.detail as { tool: string }).tool)).toEqual(Array(7).fill("open_thinker"));
    expect(records.find((r) => r.kind === "ai_chat_answer_received")!.detail).toMatchObject({ tool: "open_thinker", fallback: false, answer: { vastaus: long.answer } });
  });

  describe("F1: a failure or a reply of the wrong shape shows the local template in the session language", () => {
    afterEach(() => vi.unstubAllGlobals());
    const answering = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));

    it.each([
      ["an answer that is not a string", { ...OPEN_LIVE, answer: { vastaus: "x" } }],
      ["retrieved not an array", { ...OPEN_LIVE, retrieved: null }],
      ["a retrieved entry without its score", { ...OPEN_LIVE, retrieved: [{ id: "x" }] }],
      ["not an object", "vastaus"],
    ])("the transport refuses %s", async (_, body) => {
      vi.stubGlobal("fetch", answering(body));
      await expect(httpOpenThinkerTransport("/api/thinker-open", 1_000)(null as never)).rejects.toThrow(ThinkerBadResponseError);
    });

    it.each([
      ["fi", "a bad shape", (): OpenThinkerTransport => async () => ({ ...OPEN_LIVE, answer: 42 }) as never, "network_error"],
      ["en", "a network failure", (): OpenThinkerTransport => async () => { throw new TypeError("Failed to fetch"); }, "network_error"],
      ["fi", "a timeout", (): OpenThinkerTransport => async () => { throw new ThinkerTimeoutError(25_000); }, "client_timeout"],
    ] as const)("%s session, %s: no record excerpt — the unavailable state, flagged as fallback with its reason", async (lang, _label, make, reason) => {
      const { o, snap } = await sessionAtV1("substitutive", vi.fn<ThinkerTransport>(), make(), lang);
      const answer = await ask(o, "EK11");
      expect(answer).toBe(""); // commander M1: never a retrieved-record excerpt as an answer
      expect(snap().openThinkerHistory.at(-1)).toEqual({ query: "EK11", answer: "", unavailable: true });
      expect(UI_TEXT[lang].thinkerUnavailable).toMatch(lang === "fi" ? /ei ole nyt käytettävissä/ : /unavailable/);
      const detail = (await o.logRecords()).find((r) => r.kind === "ai_chat_answer_received")!.detail;
      expect(detail).toMatchObject({ tool: "open_thinker", fallback: true, fallbackReason: reason, retrievalMode: "lexical_only", retrievalLanguage: lang });
    });
  });
});

describe("final fix pass (8 Oct 2026)", () => {
  const ask = async (o: SessionOrchestrator, q: string) => { const p = o.askOpenThinker(q); await vi.advanceTimersByTimeAsync(2_500); return p; };
  it("an unavailable Open Thinker turn is left out of the history sent with the next question", async () => {
    const calls: number[] = [];
    let n = 0;
    const open: OpenThinkerTransport = async (req) => {
      calls.push(req.history?.length ?? 0);
      if (n++ === 0) throw new TypeError("Failed to fetch");
      return OPEN_LIVE;
    };
    const { o, snap } = await sessionAtV1("substitutive", vi.fn<ThinkerTransport>(), open);
    await ask(o, "EK11");
    await ask(o, "EK12");
    expect(calls).toEqual([0, 0]); // the failed turn is not part of the conversation
    expect(snap().openThinkerHistory.map((t) => t.unavailable)).toEqual([true, false]);
  });

  it("logs the tab the participant selects (haku | open_thinker | none) with the view and phase", async () => {
    const { o } = await sessionAtV1("substitutive", vi.fn<ThinkerTransport>());
    for (const tool of ["haku", "open_thinker", "none"] as const) await o.logTabSelected(tool);
    const tabs = (await o.logRecords()).filter((r) => r.kind === "tab_selected").map((r) => r.detail);
    expect(tabs).toEqual([
      { tool: "haku", view: 1, phase: "exploration" },
      { tool: "open_thinker", view: 1, phase: "exploration" },
      { tool: "none", view: 1, phase: "exploration" },
    ]);
  });

  it("the reading time after an answer is carried by the snapshot until the next wait", async () => {
    const transport = vi.fn<ThinkerTransport>().mockResolvedValue(LIVE);
    const { o, snap } = await sessionAtV1("directed", transport);
    expect(snap().readingGraceMs).toBe(0);
    const pending = o.askAiChat("onko suo hallinnassa?");
    await vi.advanceTimersByTimeAsync(2_500);
    await pending;
    expect(snap().readingGraceMs).toBeGreaterThanOrEqual(15_000);
    expect(snap().readingGraceMs).toBeLessThanOrEqual(60_000);
  });
});

describe("D6 (8 Oct 2026): the fit verdict of an Open Thinker answer", () => {
  it.each([
    ["en", "This is in line with the directive: a defensive posture. My inference: it holds.", "in_line"],
    ["en", "This departs from the directive, though [T9, 17:19] could justify it; report it up the chain.", "departs"],
    ["en", "A burnout is not one of the plan options; the directive does not cover it, so the call stays with you.", "not_covered"],
    ["en", "That is not in line with the directive as written.", "departs"],
    ["en", "Option 2 aligns with the directive: lines on the road. Option 1 departs from it.", "in_line"], // (aj): "aligns with" (the live wording) counts, the earliest phrase decides
    ["en", "The directive does not explicitly cover a burnout; the call is yours. A defensive posture would be in line with it.", "not_covered"],
    ["en", "Two options: hold the road or attack. Trade-offs follow.", null],
    ["fi", "Tämä on linjassa linjauksen kanssa: puolustava toimintatapa.", "in_line"],
    ["fi", "Tämä poikkeaa linjauksesta, mutta [T9, 17.19] voisi perustella sen.", "departs"],
    ["fi", "Tämä ei ole linjassa linjauksen kanssa.", "departs"],
    ["fi", "Vastapoltto ei ole suunnitelman vaihtoehto; linjaus ei koske sitä.", "not_covered"],
    ["fi", "Kaksi vaihtoehtoa: pidä tie tai hyökkää.", null],
  ] as const)("(%s) %s -> %s", (lang, text, verdict) => {
    expect(aiVerdictOf(text, lang)).toBe(verdict);
  });

  it("gives no verdict on a withdrawal or evacuation question, whatever the answer says (the hard stop)", () => {
    expect(aiVerdictOf("Keeping VPK there departs from the directive.", "en", "Should we withdraw the crews and evacuate Lahdenkyla?")).toBeNull();
    expect(aiVerdictOf("Tämä poikkeaa linjauksesta.", "fi", "Pitäisikö evakuoida Lahdenkylä?")).toBeNull();
    expect(aiVerdictOf("This departs from the directive.", "en", "I plan a direct attack; is that in line?")).toBe("departs");
  });

  it("is logged on ai_chat_answer_received as aiVerdict (null when the answer states none); a fallback logs none", async () => {
    const open = vi.fn<OpenThinkerTransport>()
      .mockResolvedValueOnce({ ...OPEN_LIVE, answer: "Tämä poikkeaa linjauksesta.", verdict: "departs" })
      .mockResolvedValueOnce({ ...OPEN_LIVE, answer: "Kaksi vaihtoehtoa.", verdict: null })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { o } = await sessionAtV1("substitutive", vi.fn<ThinkerTransport>(), open);
    for (const q of ["a", "b", "c"]) { const p = o.askOpenThinker(q); await vi.advanceTimersByTimeAsync(2_500); await p; }
    const details = (await o.logRecords()).filter((r) => r.kind === "ai_chat_answer_received").map((r) => r.detail as { aiVerdict?: string | null });
    expect(details.map((d) => d.aiVerdict)).toEqual(["departs", null, undefined]);
  });

  it("revision (al): logs the per-option verdicts as aiVerdicts (line and verdict) and sends its query id to the proxy", async () => {
    const open = vi.fn<OpenThinkerTransport>()
      .mockResolvedValueOnce({ ...OPEN_LIVE, answer: "x\nTämä poikkeaa linjauksesta.", verdict: "departs", verdicts: [{ line: 1, verdict: "departs", text: "Tämä poikkeaa linjauksesta." }] })
      .mockResolvedValueOnce({ ...OPEN_LIVE, answer: "Kaksi vaihtoehtoa.", verdict: null, verdicts: null })
      .mockResolvedValueOnce({ ...OPEN_LIVE, answer: "Vanha välityspalvelin." });
    const { o } = await sessionAtV1("substitutive", vi.fn<ThinkerTransport>(), open);
    for (const q of ["a", "b", "c"]) { const p = o.askOpenThinker(q); await vi.advanceTimersByTimeAsync(2_500); await p; }
    const details = (await o.logRecords()).filter((r) => r.kind === "ai_chat_answer_received").map((r) => r.detail as { queryId: string; aiVerdicts?: unknown });
    expect(details.map((d) => d.aiVerdicts)).toEqual([[{ line: 1, verdict: "departs" }], null, undefined]);
    expect(open.mock.calls.map((c) => c[0].queryId)).toEqual(details.map((d) => d.queryId));
  });
});

describe("the Open Thinker's conversation is cleared once, at the hinge view (8 Oct 2026)", () => {
  it("keeps phase A's turns through V7 and clears them when V8 starts, never again", () => {
    const q = new SessionQueries({} as never);
    const turn = { query: "q", answer: "a", unavailable: false };
    q.openThinkerHistory.push(turn, turn);
    q.startView(7);
    expect(q.openThinkerHistory).toHaveLength(2);
    q.startView(8);
    expect(q.openThinkerHistory).toHaveLength(0);
    q.openThinkerHistory.push(turn);
    q.startView(9);
    expect(q.openThinkerHistory).toHaveLength(1);
  });
});

describe("revision (aq): the structured Open Thinker answer in the session", () => {
  const structured = { kind: "lookup", facts: [{ text: "W1 is 1.4 km away.", tags: ["T1"] }], premises: [], options: [], inference: null, questionsForYou: ["Does that change the relay?"], tagTimes: { T1: "12.12" } } as const;
  const ask = async (o: SessionOrchestrator, q: string) => { const p = o.askOpenThinker(q); await vi.advanceTimersByTimeAsync(2_500); return p; };

  it("keeps the structured answer on the turn (the card draws it), sends only the text back as history, and logs the text", async () => {
    const text = "W1 is 1.4 km away. [T1, 12.12]\nQuestions for you:\n- Does that change the relay?";
    const open = vi.fn<OpenThinkerTransport>().mockResolvedValue({ ...OPEN_LIVE, answer: text, structured: structured as never });
    const { o, snap } = await sessionAtV1("substitutive", vi.fn<ThinkerTransport>(), open);
    expect(await ask(o, "Where is water?")).toBe(text);
    expect(snap().openThinkerHistory.at(-1)).toMatchObject({ query: "Where is water?", answer: text, unavailable: false, structured: { kind: "lookup" } });
    await ask(o, "And EK11?");
    expect(open.mock.calls.at(-1)![0].history).toEqual([{ role: "user", text: "Where is water?" }, { role: "model", text }]);
    const detail = (await o.logRecords()).find((r) => r.kind === "ai_chat_answer_received")!.detail as { answer: { vastaus: string } };
    expect(detail.answer.vastaus).toBe(text);
  });

  it("a turn without a structured answer (an older proxy, a failure) has none", async () => {
    const { o, snap } = await sessionAtV1("substitutive", vi.fn<ThinkerTransport>(), vi.fn<OpenThinkerTransport>().mockResolvedValue(OPEN_LIVE));
    await ask(o, "EK11");
    expect(snap().openThinkerHistory.at(-1)).not.toHaveProperty("structured");
  });
});
