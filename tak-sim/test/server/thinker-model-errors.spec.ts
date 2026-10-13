/**
 * The model call's error classification and its timeout (`server/thinker/model.ts`): the SDK's
 * status first, word-boundary matching after; the timer is cleared after every call and a timeout
 * aborts the request. The Google GenAI client is mocked: no network, no key.
 */

import type { GoogleGenAI } from "@google/genai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { THINKER_MODEL_TIMEOUT_MS } from "../../app/session/thinker-protocol.js";
import { callThinkerModel, errorOutcome } from "../../server/thinker/model.js";

/** An error shaped like the SDK's `ApiError`: a numeric HTTP `status`. */
function apiError(status: number, message: string): Error {
  return Object.assign(new Error(message), { name: "ApiError", status });
}

function mockClient(generateContent: ReturnType<typeof vi.fn>): GoogleGenAI {
  return { models: { generateContent } } as unknown as GoogleGenAI;
}

const LIVE = { vastaus: "a", perusteet: "b", varmuus: "c", muuttaisi: "d" };
const OK_RESPONSE = { candidates: [{ finishReason: "STOP" }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 }, text: JSON.stringify(LIVE) };

afterEach(() => vi.useRealTimers());

describe("errorOutcome", () => {
  it.each([
    ["rate_limited", apiError(429, "got status: 429 Too Many Requests")],
    ["auth_error", apiError(401, "got status: 401 Unauthorized")],
    ["auth_error", apiError(403, "got status: 403 Forbidden")],
    // "generateContent" contains "rate" and the message names an author: the status decides.
    ["api_error", apiError(500, "got status: 500 Internal Server Error calling models/gemini:generateContent (author note)")],
    ["api_error", apiError(503, "got status: 503 Service Unavailable")],
    ["timeout", apiError(504, "got status: 504 Gateway Timeout")],
  ])("the SDK's numeric status: %s", (reason, error) => {
    expect(errorOutcome(error)).toMatchObject({ ok: false, reason });
  });

  it.each([
    ["rate_limited", new Error('{"error":{"status":"RESOURCE_EXHAUSTED"}}')],
    ["auth_error", new Error('{"error":{"status":"UNAUTHENTICATED"}}')],
    ["auth_error", new Error('{"error":{"status":"PERMISSION_DENIED"}}')],
    ["timeout", new Error('{"error":{"status":"DEADLINE_EXCEEDED"}}')],
  ])("the Google status name: %s", (reason, error) => {
    expect(errorOutcome(error)).toMatchObject({ ok: false, reason });
  });

  it.each([
    ["fetch failed", new TypeError("fetch failed")],
    ["ECONNREFUSED", Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:443"), { code: "ECONNREFUSED" })],
    ["ENOTFOUND in the cause", Object.assign(new Error("request failed"), { cause: { code: "ENOTFOUND" } })],
    ["ETIMEDOUT", new Error("connect ETIMEDOUT")],
  ])("a connection failure (%s) is connection_error", (_label, error) => {
    expect(errorOutcome(error)).toMatchObject({ ok: false, reason: "connection_error" });
  });

  it.each([
    ["api_error", new Error("generateContent failed")],
    ["api_error", new Error("the authoritative record is missing")],
    ["api_error", new Error("moderate failure")],
    ["rate_limited", new Error("quota exceeded")],
    ["auth_error", new Error("API key not valid. Please pass a valid API key.")],
    ["timeout", new Error("timeout: Request exceeded limit")],
    ["api_error", "a thrown string"],
  ])("whole words only: %s", (reason, error) => {
    expect(errorOutcome(error)).toMatchObject({ ok: false, reason, detail: expect.any(String) });
  });
});

describe("the timeout", () => {
  it("is cleared when the call settles", async () => {
    vi.useFakeTimers();
    const ok = await callThinkerModel(mockClient(vi.fn().mockResolvedValue(OK_RESPONSE)), "system", "question");
    expect(ok).toMatchObject({ ok: true, answer: LIVE });
    expect(vi.getTimerCount()).toBe(0);

    const failed = await callThinkerModel(mockClient(vi.fn().mockRejectedValue(apiError(500, "boom"))), "system", "question");
    expect(failed).toMatchObject({ ok: false, reason: "api_error" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts the request and reports timeout", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const generateContent = vi.fn((params: { config: { abortSignal: AbortSignal } }) => {
      signal = params.config.abortSignal;
      return new Promise((_, reject) => signal!.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    });
    const pending = callThinkerModel(mockClient(generateContent), "system", "question");
    await vi.advanceTimersByTimeAsync(THINKER_MODEL_TIMEOUT_MS);
    expect(await pending).toMatchObject({ ok: false, reason: "timeout" });
    expect(signal!.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
