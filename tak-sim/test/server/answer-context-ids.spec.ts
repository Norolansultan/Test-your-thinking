/**
 * SPEC/31 §3.6, parity P-2 (format 0.11.0): the proxy's answer carries the ids of what reached the model without a search (the Open
 * Thinker's digest; both chats' recent matches), and the browser logs them on `ai_chat_answer_received`, so exposure is computed from
 * the browser log alone. End to end: the real handler as the browser's transport (a fake model client), then the exposure fold.
 * An older proxy (no ids) logs none; a malformed id list is a bad shape (the local fallback).
 */

import type { GoogleGenAI } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import { stepAtVirtualTime } from "../../app/retrieval/time-gate.js";
import type { Cell } from "../../app/scenario/types.js";
import { sessionHeader } from "../../app/session/header.js";
import { conditionOfCell } from "../../app/session/preview.js";
import { SessionQueries } from "../../app/session/queries.js";
import type { OpenThinkerResponse, ThinkerResponse } from "../../app/session/thinker-protocol.js";
import type { OpenThinkerTransport, ThinkerTransport } from "../../app/session/thinker-transport.js";
import { atomExposure } from "../../app/telemetry/freeze-measures.js";
import { InMemoryLogSink, SessionLog } from "../../app/telemetry/log.js";
import type { AiChatAnswerReceivedDetail } from "../../app/telemetry/record-kinds.js";
import { loadSystemPrompt } from "../../server/thinker/config.js";
import { handleOpenThinkerRequest, handleThinkerRequest, type ThinkerDeps } from "../../server/thinker/handler.js";
import { scenario } from "../engine/thinker-fixtures.js";

const QUESTION = "Mitä SPOT ja yksiköt raportoivat syttymäkohdan savusta ja reunasta?";

function deps(text: string): ThinkerDeps {
  const client = { models: { generateContent: async () => ({ candidates: [{ finishReason: "STOP" }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 }, text }) } } as unknown as GoogleGenAI;
  return {
    scenario, vector: null, client,
    prompt: loadSystemPrompt("fi"), promptEn: loadSystemPrompt("en"),
    promptOpen: loadSystemPrompt("fi", "open"), promptOpenEn: loadSystemPrompt("en", "open"),
    promptOpenOnce: loadSystemPrompt("fi", "open_once"), promptOpenOnceEn: loadSystemPrompt("en", "open_once"),
    appendLog: async () => {}, nowMs: () => 0, nowIso: () => "2026-10-19T00:00:00.000Z",
  };
}

const FOUR = JSON.stringify({ vastaus: "v", perusteet: "p", varmuus: "m", muuttaisi: "u" });
const OPEN_JSON = JSON.stringify({ kind: "lookup", facts: [{ text: "ok", tags: [] }], unforeseen: null, premises: [], options: [], inference: null, questionsForYou: ["x?"] });

/** The browser's queries at a view's start, with the real handler behind both transports. */
function browserAt(view: number, cell: Cell, transports: { transport?: ThinkerTransport; openTransport?: OpenThinkerTransport } = {}) {
  const spec = scenario.cycles.find((c) => c.index === view)!;
  const log = new SessionLog(sessionHeader(scenario, conditionOfCell(cell), "p", "fi", null, true, cell), new InMemoryLogSink());
  const transport: ThinkerTransport = transports.transport ?? (async (req) => (await handleThinkerRequest(deps(FOUR), req)).body as ThinkerResponse);
  const openTransport: OpenThinkerTransport = transports.openTransport ?? (async (req) => (await handleOpenThinkerRequest(deps(OPEN_JSON), req)).body as OpenThinkerResponse);
  const q = new SessionQueries({
    scenario, log, now: () => asVirtualTime(spec.startsAtVirtual), view: () => view, currentStep: () => stepAtVirtualTime(spec, spec.startsAtVirtual)!,
    viewEndVirtual: () => spec.startsAtVirtual, phaseTag: () => "exploration", aiAvailable: () => cell !== "radio", language: () => "fi", cell: () => cell,
  }, { transport, openTransport, wait: async () => {} });
  return { q, log };
}

const answers = async (log: SessionLog) => (await log.readAll()).filter((r) => r.kind === "ai_chat_answer_received");

describe("the answer's context ids in the browser log (format 0.11.0)", () => {
  it("logs the Open Thinker's digest and recent ids as the proxy returned them, and the exposure fold reads them as routes", async () => {
    const { q, log } = browserAt(9, "reasoning_intent");
    await q.askOpenThinker(QUESTION);
    const [rec] = await answers(log);
    const d = rec!.detail as AiChatAnswerReceivedDetail;
    const direct = (await handleOpenThinkerRequest(deps(OPEN_JSON), { sessionId: "x", condition: "substitutive", cell: "reasoning_intent", view: 9, virtualTimeS: scenario.cycles.find((c) => c.index === 9)!.startsAtVirtual, question: QUESTION, language: "fi" })).body as OpenThinkerResponse;
    expect(d.digestAtomIds).toEqual(direct.digestAtomIds);
    expect(d.recentAtomIds).toEqual(direct.recentAtomIds);
    expect(d.digestAtomIds!.length).toBeGreaterThan(0);
    const exposure = atomExposure(await log.readAll(), [d.digestAtomIds![0]!, d.recentAtomIds![0]!], Number.MAX_SAFE_INTEGER);
    expect(exposure.map((e) => e.routes)).toEqual([["digest"], ["recent"]]);
  });

  it("logs Haku's chat with an empty digest and its recent matches, in the Haku group too", async () => {
    const { q, log } = browserAt(9, "radio");
    await q.askAiChat(QUESTION);
    const d = (await answers(log))[0]!.detail as AiChatAnswerReceivedDetail;
    expect(d).toMatchObject({ tool: "haku", digestAtomIds: [] });
    expect(d.recentAtomIds!.length).toBeGreaterThan(0);
  });

  it("logs no ids from an older proxy, and falls back locally on a malformed id list", async () => {
    const older = vi.fn<ThinkerTransport>(async (req) => {
      const { digestAtomIds: _d, recentAtomIds: _r, ...rest } = (await handleThinkerRequest(deps(FOUR), req)).body as ThinkerResponse;
      return rest;
    });
    const a = browserAt(9, "radio", { transport: older });
    await a.q.askAiChat(QUESTION);
    const old = (await answers(a.log))[0]!.detail as AiChatAnswerReceivedDetail;
    expect(old).not.toHaveProperty("digestAtomIds");
    expect(old).not.toHaveProperty("recentAtomIds");
    expect(old.fallback).toBe(false);
    const bad = browserAt(9, "radio", { transport: async (req) => ({ ...((await handleThinkerRequest(deps(FOUR), req)).body as ThinkerResponse), recentAtomIds: "atom.x" as never }) });
    await bad.q.askAiChat(QUESTION);
    const fell = (await answers(bad.log))[0]!.detail as AiChatAnswerReceivedDetail;
    expect(fell).toMatchObject({ fallback: true, fallbackReason: "network_error" });
    expect(fell).not.toHaveProperty("recentAtomIds");
  });
});
