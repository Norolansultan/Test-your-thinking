/**
 * The demo bridge's failures (`tools/demo-bridge/sample-client.ts`): each `sample` rejection `{code}` becomes the proxy's
 * existing failure response — Haku's template answer, the Open Thinker's "unavailable" (empty text) — flagged `fallback` with
 * the reason the handler already uses, and never retried by the bridge (the handler's one identical retry is for 429 / 503 only;
 * the Open Thinker's one re-ask of an unparsable reply is the handler's own).
 */

import { describe, expect, it } from "vitest";
import type { OpenThinkerResponse, ThinkerResponse } from "../../app/session/thinker-protocol.js";
import { createBridgeServer } from "../../tools/demo-bridge/serve.js";
import { formatInstruction, modelTierOf, sampleInputOf } from "../../tools/demo-bridge/sample-client.js";
import type { ThinkerModelParams } from "../../server/thinker/model-client.js";
import { data, fakePage, fakeSample, HAKU, OPEN, OPTIONS_ANSWER, post, runtime } from "./fixtures.js";

const reject = (code: string, text?: string) => () => { throw { code, message: `fake ${code}`, ...(text !== undefined ? { text } : {}) }; };

describe("a sample rejection is the proxy's failure response", () => {
  it.each([
    ["refused", "refusal"],
    ["rate_limited", "rate_limited"],
    ["not_granted", "auth_error"],
    ["sampling_disabled", "auth_error"],
    ["session_expired", "auth_error"],
    ["cancelled", "timeout"],
    ["prompt_too_large", "api_error"],
    ["invalid_request", "api_error"],
    ["upstream_error", "api_error"],
    ["some_future_code", "api_error"],
    ["invalid_json", "invalid_output"],
    ["empty_completion", "invalid_output"],
  ])("Haku: %s → the template answer, fallbackReason %s, one call", async (code, reason) => {
    const { sample, calls } = fakeSample(reject(code, code === "invalid_json" ? "not json" : undefined));
    const res = await fakePage(runtime(sample)).fetch("/api/thinker", post(HAKU));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ThinkerResponse;
    expect(body).toMatchObject({ fallback: true, fallbackReason: reason });
    expect(body.answer.vastaus.length).toBeGreaterThan(0); // the deterministic template over the same records
    if (code === "refused") expect(body.refusalCategory).toBe("safety");
    expect(calls).toHaveLength(1);
  });

  it.each([
    ["refused", "refusal", 1],
    ["rate_limited", "rate_limited", 1],
    ["not_granted", "auth_error", 1],
    ["upstream_error", "api_error", 1],
    // The handler asks once more for an unparsable reply (its own rule, THINKER_OPEN_PARSE_RETRIES); the second is the failure.
    ["invalid_json", "invalid_output", 2],
  ])("the Open Thinker: %s → \"unavailable\" (empty answer), fallbackReason %s, %i call(s)", async (code, reason, n) => {
    const { sample, calls } = fakeSample(reject(code));
    const res = await fakePage(runtime(sample)).fetch("/api/thinker-open", post(OPEN));
    const body = (await res.json()) as OpenThinkerResponse;
    expect(body).toMatchObject({ fallback: true, fallbackReason: reason, answer: "", structured: null });
    expect(calls).toHaveLength(n);
  });

  it("a handler that throws is the proxy's 500", async () => {
    const { sample } = fakeSample(() => ({}));
    const broken = createBridgeServer(sample, { ...data, prompts: { ...data.prompts, promptOpenOnce: undefined as never } });
    const result = await broken.serve("open_thinker", { ...OPEN, cell: "reasoning_once" });
    expect(result).toEqual({ status: 500, body: { error: "internal error" } });
  });

  it("an aborted request rejects with an AbortError, as the native fetch does", async () => {
    const { sample } = fakeSample(() => new Promise(() => undefined));
    const controller = new AbortController();
    const pending = fakePage(runtime(sample)).fetch("/api/thinker", { ...post(HAKU), signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("the call's input and settings", () => {
  const params = (over: Partial<NonNullable<ThinkerModelParams["config"]>>, contents: ThinkerModelParams["contents"] = [{ role: "user", parts: [{ text: "Q" }] }]): ThinkerModelParams =>
    ({ model: "m", contents, config: { systemInstruction: "SYSTEM", ...over } });

  it("one string: the system instruction, the content, then the schema as an output-format instruction", () => {
    const input = sampleInputOf(params({ responseSchema: { type: "object" } }));
    expect(input).toBe(`SYSTEM\n\n---\n\nQ\n\n---\n\n${formatInstruction({ type: "object" })}`);
  });

  it("history: a leading instructions turn, the turns (model → assistant), the question with a format reminder", () => {
    const input = sampleInputOf(params({ responseSchema: { type: "object" } }, [
      { role: "user", parts: [{ text: "a" }] }, { role: "model", parts: [{ text: "b" }] }, { role: "user", parts: [{ text: "Q" }] },
    ]));
    expect(Array.isArray(input) && input.map((t) => t.role)).toEqual(["user", "user", "assistant", "user"]);
    expect((input as { content: string }[])[0]!.content).toBe(`SYSTEM\n\n---\n\n${formatInstruction({ type: "object" })}`);
    expect((input as { content: string }[])[3]!.content).toMatch(/^Q\n\n---\n\nReply with only the JSON object/);
  });

  it("the tier: quick where the proxy asks for no thinking (both chats today), else default", () => {
    expect(modelTierOf(params({ thinkingConfig: { thinkingBudget: 0 } }))).toBe("quick");
    expect(modelTierOf(params({ thinkingConfig: { thinkingBudget: 512 } }))).toBe("default");
    expect(modelTierOf(params({}))).toBe("default");
  });

  it("inputs stay far below the runtime's 256 KiB: Haku's and the Open Thinker's with a full history", async () => {
    const sizes: number[] = [];
    const size = (input: unknown) => new TextEncoder().encode(typeof input === "string" ? input : (input as { content: string }[]).map((t) => t.content).join("")).length;
    const haku = fakeSample((input) => { sizes.push(size(input)); return { vastaus: "v", perusteet: "p", varmuus: "todennäköinen", muuttaisi: "m" }; });
    await fakePage(runtime(haku.sample)).fetch("/api/thinker", post(HAKU));
    const open = fakeSample((input) => { sizes.push(size(input)); return OPTIONS_ANSWER; });
    const history = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? { role: "user", text: "k".repeat(500) } : { role: "model", text: "v".repeat(4000) }));
    await fakePage(runtime(open.sample)).fetch("/api/thinker-open", post({ ...OPEN, history }));
    expect(sizes).toHaveLength(2);
    expect(sizes[0]).toBeLessThan(16 * 1024);
    expect(sizes[1]).toBeLessThan(64 * 1024);
  });
});
