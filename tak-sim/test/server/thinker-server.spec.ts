/**
 * The Thinker proxy's boundary (SPEC/14 revision (q), SPEC/05 revision (q)): request validation —
 * Haku's chat for every cell and view (8 Oct 2026), a question of at most 500 characters, a virtual
 * time inside the view — and the HTTP layer: localhost-only CORS, body limits, and a fallback answer without a key.
 */

import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateThinkerRequest } from "../../app/session/thinker-protocol.js";
import { loadSystemPrompt, THINKER_MODEL_ID } from "../../server/thinker/config.js";
import { handleThinkerRequest, type ThinkerDeps } from "../../server/thinker/handler.js";
import { createThinkerServer, isAllowedOrigin } from "../../server/thinker/http.js";
import { frozenEmbedder, scenario, vectorIndex } from "../engine/thinker-fixtures.js";

const V7_START = scenario.cycles.find((c) => c.index === 7)!.startsAtVirtual;
const VALID = { sessionId: "P-001_a", condition: "substitutive", view: 7, virtualTimeS: V7_START, question: "onko lohko 3 hallinnassa?", cell: "reasoning_once" }; // an authored question (frozen vector); was "onko suo hallinnassa?" before 2 Oct 2026
const logs: Record<string, unknown>[] = [];
const deps: ThinkerDeps = {
  scenario, vector: { embedder: frozenEmbedder, index: vectorIndex }, prompt: loadSystemPrompt(), client: null,
  appendLog: async (_id, line) => void logs.push(line), nowMs: () => 0, nowIso: () => "2026-09-26T00:00:00.000Z",
};

describe("request validation", () => {
  it("accepts a valid AI-condition request", () => {
    expect(validateThinkerRequest(VALID)).toEqual({ ok: true, request: VALID });
  });

  // Haku / Open Thinker redesign (8 Oct 2026): Haku's chat is everyone's, in every view.
  it("accepts Haku's chat from the radio cell and in the practice view (D1)", () => {
    expect(validateThinkerRequest({ ...VALID, condition: "directed", cell: "radio" }).ok).toBe(true);
    expect(validateThinkerRequest({ ...VALID, view: 0 }).ok).toBe(true);
  });

  it.each([
    ["a cell of the other condition", { ...VALID, condition: "directed" }],
    ["the radio cell in the AI condition", { ...VALID, cell: "radio" }],
    ["a missing condition", { ...VALID, condition: undefined }],
    ["a question over 500 characters", { ...VALID, question: "a".repeat(501) }],
    ["an empty question", { ...VALID, question: "   " }],
    ["a view before the practice view", { ...VALID, view: -1 }],
    ["a view past V14", { ...VALID, view: 15 }],
    ["a fractional view", { ...VALID, view: 1.5 }],
    ["a non-numeric time", { ...VALID, virtualTimeS: "12000" }],
    ["an infinite time", { ...VALID, virtualTimeS: Infinity }],
    ["a path in the session id", { ...VALID, sessionId: "../../etc/passwd" }],
    ["a history (Haku's chat takes none, F2)", { ...VALID, history: [] }],
    ["not an object", "hello"],
  ])("rejects %s", (_label, body) => {
    expect(validateThinkerRequest(body).ok).toBe(false);
  });

  it("accepts exactly 500 characters", () => {
    expect(validateThinkerRequest({ ...VALID, question: "a".repeat(500) }).ok).toBe(true);
  });

  it("rejects a virtual time outside the view (the server recomputes the gate)", async () => {
    const result = await handleThinkerRequest(deps, { ...VALID, virtualTimeS: V7_START + 99_999 });
    expect(result.status).toBe(400);
  });
});

describe("the HTTP layer", () => {
  let server: Server;
  let url: string;
  beforeAll(async () => {
    server = createThinkerServer(deps);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/thinker`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const post = (body: string, headers: Record<string, string> = {}) =>
    fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body });

  it("answers a sample request without a key: the template, flagged as fallback", async () => {
    const res = await post(JSON.stringify(VALID), { origin: "http://localhost:5173" });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    const body = await res.json();
    expect(body).toMatchObject({ fallback: true, fallbackReason: "no_api_key", modelId: THINKER_MODEL_ID, retrievalMode: "hybrid" });
    expect(body.retrieved).toHaveLength(8);
    expect(Object.keys(body.answer).sort()).toEqual(["muuttaisi", "perusteet", "varmuus", "vastaus"]);
    expect(logs.at(-1)).toMatchObject({ sessionId: "P-001_a", fallbackReason: "no_api_key" });
  });

  it("restricts CORS to localhost", async () => {
    expect(isAllowedOrigin("http://localhost:5173")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:4173")).toBe(true);
    expect(isAllowedOrigin("https://localhost.evil.example")).toBe(false);
    expect(isAllowedOrigin("http://example.org")).toBe(false);
    expect((await post(JSON.stringify(VALID), { origin: "http://example.org" })).status).toBe(403);
    const preflight = await fetch(url, { method: "OPTIONS", headers: { origin: "http://localhost:5173" } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("rejects bad JSON, invalid requests, oversize bodies, other methods and paths", async () => {
    expect((await post("{not json")).status).toBe(400);
    expect((await post(JSON.stringify({ ...VALID, condition: "directed" }))).status).toBe(400);
    expect((await post(JSON.stringify({ ...VALID, question: "x".repeat(20_000) }))).status).toBe(413);
    expect((await fetch(url)).status).toBe(405);
    expect((await fetch(url.replace("/api/thinker", "/api/other"), { method: "POST", body: "{}" })).status).toBe(404);
  });
});
