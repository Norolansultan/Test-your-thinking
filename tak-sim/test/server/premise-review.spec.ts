/**
 * SPEC/32 §3 (20 Oct 2026): `POST /api/thinker/premise-review`, the plan review's premise lookup — the guide cell only, a
 * phase-B view, the premise-evidence table read at the view's records clock (as the Open Thinker's check reads it), the
 * fixed template's lines, the table's hash; no model call; one log line. Mounted on the local Thinker server and the
 * production server.
 */

import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { GoogleGenAI } from "@google/genai";
import { PREMISE_REVIEW_ENDPOINT, validatePremiseReviewRequest, type PremiseReviewResponse } from "../../app/session/thinker-protocol.js";
import { loadSystemPrompt } from "../../server/thinker/config.js";
import type { ThinkerDeps } from "../../server/thinker/handler.js";
import { createThinkerServer } from "../../server/thinker/http.js";
import { loadPremiseEvidence } from "../../server/thinker/premise-check.js";
import { handlePremiseReviewRequest } from "../../server/thinker/premise-review.js";
import { createAppServer } from "../../server/production/server.js";
import { scenario } from "../engine/thinker-fixtures.js";

const evidence = loadPremiseEvidence();
const startOf = (view: number) => scenario.cycles.find((c) => c.index === view)!.startsAtVirtual;
const REQ = { sessionId: "review-1", cell: "reasoning_intent", language: "en" } as const;
const req = (view: number, extra: Record<string, unknown> = {}) => ({ ...REQ, view, virtualTimeS: startOf(view), ...extra });

/** A model client that fails the test if it is touched: the lookup makes no model call. */
function untouchableClient() {
  const generateContent = vi.fn(() => { throw new Error("the premise review must not call the model"); });
  return { client: { models: { generateContent } } as unknown as GoogleGenAI, generateContent };
}

function depsWith(logs: Record<string, unknown>[]): ThinkerDeps & { generateContent: ReturnType<typeof vi.fn> } {
  const { client, generateContent } = untouchableClient();
  return {
    scenario, vector: null, client, prompt: loadSystemPrompt("fi"), generateContent,
    appendLog: async (_id, line) => void logs.push(line), nowMs: () => 0, nowIso: () => "2026-10-20T00:00:00.000Z",
  };
}

describe("the premise review lookup (SPEC/32 §3)", () => {
  it("V9 after 17:01: P1 contradicted with the table's deciding record and its line; P2 not; the table's hash; no model call", async () => {
    const logs: Record<string, unknown>[] = [];
    const deps = depsWith(logs);
    const r = await handlePremiseReviewRequest(deps, req(9));
    expect(r.status).toBe(200);
    const body = r.body as PremiseReviewResponse;
    expect(body.statuses).toEqual([
      { premiseId: "P1", status: "contradicted", atomIds: ["atom.demo.12.0"] },
      { premiseId: "P2", status: "not_contradicted", atomIds: [] },
    ]);
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]).toMatch(/^P1 .* — no longer holds: SPOT 17\.01\.$/);
    expect(body.tableSha256).toBe(evidence.sha256);
    expect(deps.generateContent).not.toHaveBeenCalled();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ tool: "premise_review", sessionId: "review-1", cell: "reasoning_intent", view: 9, modelCalled: false, premiseEvidenceSha256: evidence.sha256 });
    expect(logs[0]!.premiseRecordsClockS as number).toBeGreaterThanOrEqual(13_260); // 17:01
  });

  it("V8: neither premise contradicted — the one 'no newest record contradicts' line, in the session language", async () => {
    const deps = depsWith([]);
    const en = await handlePremiseReviewRequest(deps, req(8));
    expect(en.body).toEqual({
      lines: ["Directive premises: no newest record contradicts P1 or P2."],
      statuses: [{ premiseId: "P1", status: "not_contradicted", atomIds: [] }, { premiseId: "P2", status: "not_contradicted", atomIds: [] }],
      tableSha256: evidence.sha256,
    });
    const fi = await handlePremiseReviewRequest(deps, req(8, { language: "fi" }));
    expect((fi.body as PremiseReviewResponse).lines).toEqual(["Linjauksen lähtöoletukset: mikään uusin tieto ei kumoa oletuksia P1 ja P2."]);
    expect(deps.generateContent).not.toHaveBeenCalled();
  });

  it.each([
    ["the Haku cell", { cell: "radio" }],
    ["the reasoning_once cell", { cell: "reasoning_once" }],
    ["a missing cell", { cell: undefined }],
  ])("refuses %s (HTTP 400), logging nothing", async (_label, extra) => {
    const logs: Record<string, unknown>[] = [];
    const r = await handlePremiseReviewRequest(depsWith(logs), req(9, extra));
    expect(r).toEqual({ status: 400, body: { error: "the premise review is for the reasoning_intent cell only" } });
    expect(logs).toEqual([]);
  });

  it.each([
    ["a phase-A view", { view: 7, virtualTimeS: startOf(7) }],
    ["the practice view", { view: 0, virtualTimeS: 0 }],
    ["a view past V14", { view: 15 }],
    ["a time outside the view", { virtualTimeS: startOf(9) + 99_999 }],
    ["a path in the session id", { sessionId: "../x" }],
    ["an unknown language", { language: "sv" }],
  ])("refuses %s", async (_label, extra) => {
    expect((await handlePremiseReviewRequest(depsWith([]), req(9, extra))).status).toBe(400);
  });

  it("validates the request's shape on its own (the browser's and the server's one contract)", () => {
    expect(validatePremiseReviewRequest(req(9))).toEqual({ ok: true, request: req(9) });
    expect(validatePremiseReviewRequest({ ...req(9), participantCode: "P-1" })).toMatchObject({ ok: true, request: { participantCode: "P-1" } });
    expect(validatePremiseReviewRequest("x").ok).toBe(false);
  });
});

describe("the route is mounted on the local Thinker server and the production server", () => {
  let thinker: Server;
  let prod: Server;
  const prodCalls: unknown[] = [];
  const urlOf = (s: Server) => `http://127.0.0.1:${(s.address() as AddressInfo).port}${PREMISE_REVIEW_ENDPOINT}`;
  beforeAll(async () => {
    thinker = createThinkerServer(depsWith([]));
    prod = createAppServer({ premiseReview: async (body) => { prodCalls.push(body); return { status: 200, body: { ok: true } }; } });
    await Promise.all([thinker, prod].map((s) => new Promise<void>((resolve) => s.listen(0, "127.0.0.1", resolve))));
  });
  afterAll(() => Promise.all([thinker, prod].map((s) => new Promise<void>((resolve) => s.close(() => resolve())))));

  const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it("the local Thinker server answers the lookup and refuses another cell", async () => {
    const ok = await post(urlOf(thinker), req(9));
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as PremiseReviewResponse).statuses[0]).toMatchObject({ premiseId: "P1", status: "contradicted" });
    expect((await post(urlOf(thinker), req(9, { cell: "radio" }))).status).toBe(400);
  });

  it("the production server routes it to its handler (404 when not configured)", async () => {
    const res = await post(urlOf(prod), req(9));
    expect(res.status).toBe(200);
    expect(prodCalls).toEqual([req(9)]);
    const bare = createAppServer({});
    await new Promise<void>((resolve) => bare.listen(0, "127.0.0.1", resolve));
    try { expect((await post(urlOf(bare), req(9))).status).toBe(404); } finally { await new Promise<void>((resolve) => bare.close(() => resolve())); }
  });
});
