/**
 * SPEC/14 revision (q), `fallback.spec`: whenever the model cannot answer — no API key, an API error,
 * a timeout, a refusal, a truncated or malformed answer — the proxy returns the deterministic
 * template over the SAME retrieved records, with `fallback: true` and the reason, and logs it. The
 * Anthropic client is mocked: no network, no key. Also checks the request the proxy sends.
 */

import type { GoogleGenAI } from "@google/genai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toRenderable } from "../../app/boundary/render-boundary.js";
import { templateThinkerAnswer, type ThinkerResponse } from "../../app/session/thinker-protocol.js";
import { loadSystemPrompt, THINKER_MODEL_ID } from "../../server/thinker/config.js";
import { handleThinkerRequest, type ThinkerDeps } from "../../server/thinker/handler.js";
import { AUTHORED_QUESTIONS } from "../../tools/thinker/authored-questions.js";
import { frozenEmbedder, retrieveAt, scenario, vectorIndex } from "./thinker-fixtures.js";

const QUESTION = AUTHORED_QUESTIONS.broadBog[0];
const V7_START = scenario.cycles.find((c) => c.index === 7)!.startsAtVirtual;
const BODY = { sessionId: "test-session", condition: "substitutive", view: 7, virtualTimeS: V7_START, question: QUESTION, cell: "reasoning_once" };
const SAME_RECORDS_TEMPLATE = templateThinkerAnswer(retrieveAt(7, QUESTION).map((r) => toRenderable(r.atom)));

function depsWith(client: GoogleGenAI | null, logs: Record<string, unknown>[]): ThinkerDeps {
  return {
    scenario, vector: { embedder: frozenEmbedder, index: vectorIndex }, prompt: loadSystemPrompt(), client,
    appendLog: async (_sessionId, line) => void logs.push(line),
    nowMs: () => 0, nowIso: () => "2026-09-26T00:00:00.000Z",
  };
}

function mockClient(create: ReturnType<typeof vi.fn>): GoogleGenAI {
  return { models: { generateContent: create } } as unknown as GoogleGenAI;
}

function message(overrides: Record<string, unknown>): any {
  return {
    candidates: [{ finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
    text: "",
    ...overrides,
  };
}

async function ask(client: GoogleGenAI | null) {
  const logs: Record<string, unknown>[] = [];
  const result = await handleThinkerRequest(depsWith(client, logs), BODY);
  expect(result.status).toBe(200);
  return { response: result.body as ThinkerResponse, logs };
}

function expectTemplateFallback(response: ThinkerResponse, logs: Record<string, unknown>[], reason: string) {
  expect(response).toMatchObject({ fallback: true, fallbackReason: reason, answer: SAME_RECORDS_TEMPLATE, retrievalMode: "hybrid" });
  expect(response.retrieved.map((r) => r.id)).toEqual(retrieveAt(7, QUESTION).map((r) => r.atom.id));
  expect(logs).toHaveLength(1);
  expect(logs[0]).toMatchObject({ fallback: true, fallbackReason: reason, question: QUESTION, sessionId: "test-session", step: 10 });
}

afterEach(() => vi.unstubAllEnvs());

describe("fallback to the template over the same records", () => {
  it("without an API key", async () => {
    const { response, logs } = await ask(null);
    expectTemplateFallback(response, logs, "no_api_key");
  });

  it.each([
    ["rate_limited", () => new Error("429 Too Many Requests")],
    ["auth_error", () => new Error("401 Unauthorized")],
    ["timeout", () => new Error("timeout: Request exceeded limit")],
    ["api_error", () => new Error("500 Internal Server Error")],
  ])("on an API error: %s", async (reason, makeError) => {
    const { response, logs } = await ask(mockClient(vi.fn().mockRejectedValue(makeError())));
    expectTemplateFallback(response, logs, reason);
    expect(logs[0]!.errorDetail).toEqual(expect.any(String));
  });

  it("on a refusal (safety)", async () => {
    const refusal = message({ candidates: [{ finishReason: "SAFETY" }] });
    const { response, logs } = await ask(mockClient(vi.fn().mockResolvedValue(refusal)));
    expectTemplateFallback(response, logs, "refusal");
    expect(response.refusalCategory).toBe("safety");
    expect(logs[0]!.refusalCategory).toBe("safety");
  });

  it("on truncation (max_tokens)", async () => {
    const truncated = message({ candidates: [{ finishReason: "MAX_TOKENS" }], text: '{"vastaus": "kesken' });
    const { response, logs } = await ask(mockClient(vi.fn().mockResolvedValue(truncated)));
    expectTemplateFallback(response, logs, "truncated");
  });

  it("on output that is not the four-part JSON", async () => {
    const bad = message({ text: '{"vastaus": "x"}' });
    const { response, logs } = await ask(mockClient(vi.fn().mockResolvedValue(bad)));
    expectTemplateFallback(response, logs, "invalid_output");
  });
});

describe("a live answer", () => {
  const live = { vastaus: "Lohko L3 on raportoitu hallinnassa.", perusteet: "KY21 klo 16.20", varmuus: "todennäköinen", muuttaisi: "Uusi savuhavainto." };

  it("reads text, and sends the pinned model, prompt and records (temperature 0)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-not-a-real-key");
    const create = vi.fn().mockResolvedValue(message({ text: JSON.stringify(live) }));
    const { response, logs } = await ask(mockClient(create));
    expect(response).toMatchObject({ answer: live, fallback: false, fallbackReason: null, modelId: THINKER_MODEL_ID, promptHash: loadSystemPrompt().sha256 });
    expect(logs[0]).toMatchObject({ answer: live, fallback: false, usage: { input_tokens: 1, output_tokens: 1 } });

    const params = create.mock.calls[0]![0];
    expect(params).toMatchObject({
      model: THINKER_MODEL_ID,
      config: {
        systemInstruction: loadSystemPrompt().text,
        maxOutputTokens: 2000,
        responseMimeType: "application/json",
        temperature: 0,
      }
    });
    
    // Check missing fields (e.g., top_k should not be here by default)
    expect(params.config).not.toHaveProperty("topK");

    const content = params.contents[0].parts[0].text as string;
    expect(content).toContain(`Kysymys: ${QUESTION}`);
    expect(content).toContain("[T8]");
    expect(content).not.toMatch(/rekindle\.|f7\.|atom\.|evt\./); // neutral tags, not corpus ids

    expect(JSON.stringify(logs) + JSON.stringify(response)).not.toContain("test-not-a-real-key");
  });
});
