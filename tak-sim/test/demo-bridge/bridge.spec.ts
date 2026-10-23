/**
 * The demo bridge (`tools/demo-bridge/`, DEMONSTRATION ONLY): with a fake `sample`, both chat endpoints answer through the
 * proxy's own handler in a shape the browser's own transports accept, marked as the bridge's; `OPTIONS` answers 204 so the
 * preflight sees a proxy; the plan review's premise lookup, everything else, a missing or null runtime, and the study all pass
 * through to the original fetch untouched.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_BRIDGE_MODEL_ID, PREMISE_REVIEW_ENDPOINT, type OpenThinkerResponse, type ThinkerResponse } from "../../app/session/thinker-protocol.js";
import { assertNotDemoBridgeInStudy, assertOpenThinkerResponseShape, assertThinkerResponseShape, httpOpenThinkerTransport, httpThinkerTransport, ThinkerBadResponseError } from "../../app/session/thinker-transport.js";
import { httpPremiseReviewTransport, requestPremiseReview } from "../../app/session/plan-review-transport.js";
import { proxyReachable } from "../../app/render/ui/preflight-env.js";
import { routeOf } from "../../tools/demo-bridge/install.js";
import { THINKER_MODEL_ID } from "../../server/thinker/config.js";
import { data, DATA_URL, fakePage, fakeSample, FOUR, HAKU, OPEN, OPTIONS_ANSWER, post, runtime } from "./fixtures.js";

const OPEN_PROMPT_START = data.prompts.promptOpen.text.slice(0, 40);

afterEach(() => { vi.unstubAllGlobals(); });

describe("routing", () => {
  const href = "https://demo.example/sub/index.html?x=1";
  it("serves POST to the two chat endpoints, relative or same-origin absolute, and OPTIONS on them", () => {
    expect(routeOf("/api/thinker", "POST", href)).toEqual({ kind: "serve", tool: "haku" });
    expect(routeOf("/api/thinker-open", "post", href)).toEqual({ kind: "serve", tool: "open_thinker" });
    expect(routeOf("https://demo.example/api/thinker?a=b", "POST", href)).toEqual({ kind: "serve", tool: "haku" });
    expect(routeOf("/api/thinker", "OPTIONS", href)).toEqual({ kind: "options" });
  });
  it("never the premise lookup, another origin, another path or another method", () => {
    expect(routeOf(PREMISE_REVIEW_ENDPOINT, "POST", href)).toBeNull();
    expect(routeOf(PREMISE_REVIEW_ENDPOINT, "OPTIONS", href)).toBeNull();
    expect(routeOf("https://elsewhere.example/api/thinker", "POST", href)).toBeNull();
    expect(routeOf("/api/session-log", "POST", href)).toBeNull();
    expect(routeOf("/api/thinker", "GET", href)).toBeNull();
  });
});

describe("Haku's structured chat (/api/thinker)", () => {
  it("answers through the handler with one quick sample.json call, default caching, in a shape the browser's transport accepts", async () => {
    const { sample, calls } = fakeSample(() => FOUR);
    const page = fakePage(runtime(sample));
    vi.stubGlobal("fetch", page.fetch);
    const body: ThinkerResponse = await httpThinkerTransport()(HAKU);
    expect(() => assertThinkerResponseShape(body)).not.toThrow();
    expect(body).toMatchObject({ fallback: false, fallbackReason: null, modelId: DEMO_BRIDGE_MODEL_ID, retrievalMode: "lexical_only", promptVariant: "standard" });
    expect(body.answer).toEqual(FOUR);
    expect(body.retrieved.length).toBeGreaterThan(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.verb).toBe("json");
    expect(calls[0]!.options).toEqual({ modelTier: "quick", signal: expect.any(AbortSignal) });
    const input = calls[0]!.input as string;
    expect(typeof input).toBe("string");
    expect(input).toContain("Kysymys: Missä palon pää on nyt?");
    expect(input).toContain("reply with only one JSON object");
    expect(input).toContain('"vastaus"');
    // Only the data file went to the original fetch.
    expect(page.passed).toEqual([]);
    expect(vi.mocked(page.original).mock.calls.map((c) => c[0])).toEqual([DATA_URL]);
  });

  it("answers an English session in English retrieval, lexical-only", async () => {
    const { sample } = fakeSample(() => FOUR);
    const res = await fakePage(runtime(sample)).fetch("/api/thinker", post({ ...HAKU, language: "en", question: "Where is the head now?" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ retrievalMode: "lexical_only", retrievalLanguage: "en", fallback: false });
  });

  it("refuses an invalid request as the proxy does (400) without calling sample", async () => {
    const { sample, calls } = fakeSample(() => FOUR);
    const res = await fakePage(runtime(sample)).fetch("/api/thinker", post({ ...HAKU, cell: "nope" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid cell" });
    expect(calls).toHaveLength(0);
  });

  it("refuses a body over the proxy's limit (413) and a body that is not JSON (400)", async () => {
    const { sample } = fakeSample(() => FOUR);
    const page = fakePage(runtime(sample));
    expect((await page.fetch("/api/thinker", { method: "POST", body: "x".repeat(17 * 1024) })).status).toBe(413);
    expect((await page.fetch("/api/thinker", { method: "POST", body: "{nope" })).status).toBe(400);
  });
});

describe("the Open Thinker (/api/thinker-open)", () => {
  it("answers with a structured reply the browser's transport accepts; cache off; history as turns after the instructions", async () => {
    const { sample, calls } = fakeSample(() => OPTIONS_ANSWER);
    vi.stubGlobal("fetch", fakePage(runtime(sample)).fetch);
    const history = [{ role: "user" as const, text: "Mikä on tilanne?" }, { role: "model" as const, text: "Palo etenee itään." }];
    const body: OpenThinkerResponse = await httpOpenThinkerTransport()({ ...OPEN, history });
    expect(() => assertOpenThinkerResponseShape(body)).not.toThrow();
    expect(body).toMatchObject({ fallback: false, modelId: DEMO_BRIDGE_MODEL_ID, retrievalMode: "lexical_only" });
    expect(body.answer.length).toBeGreaterThan(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.options).toMatchObject({ modelTier: "quick", cache: false });
    const turns = calls[0]!.input as { role: string; content: string }[];
    expect(turns.map((t) => t.role)).toEqual(["user", "user", "assistant", "user"]);
    expect(turns[0]!.content).toContain(OPEN_PROMPT_START);
    expect(turns[0]!.content).toContain("reply with only one JSON object");
    expect(turns.at(-1)!.content).toContain("Mitä vaihtoehtoja minulla on?");
  });

  it("the guide cell with the directive in force gets no premise line and no verdicts: the handler's path for a view the (empty) table does not cover", async () => {
    const { sample, calls } = fakeSample(() => OPTIONS_ANSWER);
    const res = await fakePage(runtime(sample)).fetch("/api/thinker-open", post(OPEN));
    const body = (await res.json()) as OpenThinkerResponse;
    expect(body.fallback).toBe(false);
    expect(body.structured?.kind).toBe("options");
    expect(body.structured?.premises).toEqual([]);
    expect(body.structured?.premiseCheck).toBeUndefined();
    expect(body.structured?.options.every((o) => o.verdict === null)).toBe(true);
    expect(body.verdicts).toBeNull();
    // Without history the input is one string. The system instruction carries the directive (the order block) but no premises block.
    const instructions = calls[0]!.input as string;
    expect(instructions).toContain("Voimassa oleva linjaus");
    expect(instructions).not.toContain("Linjauksen lähtöoletukset");
  });
});

describe("OPTIONS and the preflight", () => {
  it("answers OPTIONS /api/thinker with 204, so the preflight sees the proxy reachable", async () => {
    const { sample, calls } = fakeSample(() => FOUR);
    const page = fakePage(runtime(sample));
    expect((await page.fetch("/api/thinker", { method: "OPTIONS" })).status).toBe(204);
    vi.stubGlobal("fetch", page.fetch);
    expect(await proxyReachable()).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

describe("pass-through", () => {
  it("the plan review's premise lookup goes to the original fetch untouched: the review gets its neutral fallback", async () => {
    const { sample, calls } = fakeSample(() => FOUR);
    const page = fakePage(runtime(sample));
    vi.stubGlobal("fetch", page.fetch);
    const request = { sessionId: "demo-bridge-1", cell: "reasoning_intent" as const, view: 9, virtualTimeS: OPEN.virtualTimeS };
    const outcome = await requestPremiseReview(httpPremiseReviewTransport(), request);
    expect(outcome).toEqual({ ok: false, error: "http_404" });
    expect(page.passed).toHaveLength(1);
    expect(page.passed[0]!.input).toBe(PREMISE_REVIEW_ENDPOINT);
    expect(page.passed[0]!.init?.body).toBe(JSON.stringify(request));
    expect(calls).toHaveLength(0);
  });

  it("other requests pass through with their own arguments", async () => {
    const { sample } = fakeSample(() => FOUR);
    const page = fakePage(runtime(sample));
    const init = { method: "POST", body: "{}" };
    expect((await page.fetch("/api/session-log", init)).status).toBe(404);
    expect(page.passed).toEqual([{ input: "/api/session-log", init }]);
  });

  it.each([
    ["a null sample capability", runtime(null), ""],
    ["no runtime at all (not in a Claude viewer)", undefined, ""],
    ["the study (?tuotanto)", runtime(fakeSample(() => FOUR).sample), "?tuotanto"],
  ])("%s: nothing is served, the chat and OPTIONS requests pass through", async (_label, claude, search) => {
    const page = fakePage(claude, search);
    expect((await page.fetch("/api/thinker", post(HAKU))).status).toBe(404);
    expect((await page.fetch("/api/thinker", { method: "OPTIONS" })).status).toBe(404);
    expect(page.passed.map((p) => p.input)).toEqual(["/api/thinker", "/api/thinker"]);
    if (search) expect(claude!.use).not.toHaveBeenCalled();
  });

  it("asks the runtime once, lazily, on the first chat request", async () => {
    const claude = runtime(null);
    const page = fakePage(claude);
    expect(claude!.use).not.toHaveBeenCalled();
    await page.fetch("/other");
    expect(claude!.use).not.toHaveBeenCalled();
    await page.fetch("/api/thinker", post(HAKU));
    await page.fetch("/api/thinker-open", post(OPEN));
    expect(claude!.use).toHaveBeenCalledTimes(1);
  });
});

describe("the browser accepts the bridge's answers outside the study only", () => {
  it("refuses the bridge's id under ?tuotanto, accepts it elsewhere; the real proxy's id everywhere", () => {
    expect(() => assertNotDemoBridgeInStudy({ modelId: DEMO_BRIDGE_MODEL_ID }, "?tuotanto")).toThrow(ThinkerBadResponseError);
    expect(() => assertNotDemoBridgeInStudy({ modelId: DEMO_BRIDGE_MODEL_ID }, "?solu=m7")).not.toThrow();
    expect(() => assertNotDemoBridgeInStudy({ modelId: THINKER_MODEL_ID }, "?tuotanto")).not.toThrow();
  });
});
