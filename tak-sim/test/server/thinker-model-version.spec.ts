/**
 * SPEC/30 §10 (19 Oct 2026): the model-version guard. With `THINKER_EXPECTED_MODEL_VERSION` set, an answer from another build, or
 * one that names none, is a model error — Haku answers with its template, the Open Thinker with "unavailable" — and the server log
 * says `modelVersionMismatch: {expected, got}`. Independently, per session, an answer whose build differs from the session's first
 * answer's is logged `modelVersionChanged: true`. The Gemini client is a fake that names the build it answers with.
 */
import type { GoogleGenAI } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import type { OpenThinkerResponse, ThinkerResponse } from "../../app/session/thinker-protocol.js";
import { EXPECTED_MODEL_VERSION_ENV, expectedModelVersionOf, loadSystemPrompt } from "../../server/thinker/config.js";
import { handleOpenThinkerRequest, handleThinkerRequest, type ThinkerDeps } from "../../server/thinker/handler.js";
import { guardModelVersion } from "../../server/thinker/model-version.js";
import { scenario } from "../engine/thinker-fixtures.js";
import { openJson, twoOptions } from "./open-json.js";

const PINNED = "gemini-3.5-flash";
const OTHER = "gemini-3.6-flash";
const HAKU_JSON = JSON.stringify({ vastaus: "Live answer.", perusteet: "p", varmuus: "m", muuttaisi: "u" });
const OPEN_JSON = openJson({ kind: "options", options: twoOptions("departs", "fits") });
const startOf = (view: number) => scenario.cycles.find((c) => c.index === view)!.startsAtVirtual;
const req = (sessionId: string, cell = "reasoning_intent") => ({ sessionId, condition: "substitutive", view: 11, virtualTimeS: startOf(11), question: "What are my options?", cell, language: "en" });

/** A fake model that answers each call with the next build in `builds` (undefined: the response names none). */
function fakeModel(builds: readonly (string | undefined)[], text: (call: number) => string) {
  let call = 0;
  const create = vi.fn(async () => {
    const build = builds[Math.min(call, builds.length - 1)];
    const body = text(call);
    call += 1;
    return { candidates: [{ finishReason: "STOP" }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 5 }, text: body, ...(build !== undefined ? { modelVersion: build } : {}) };
  });
  return { client: { models: { generateContent: create } } as unknown as GoogleGenAI, create };
}

function depsWith(client: GoogleGenAI, logs: Record<string, unknown>[], extra: Partial<ThinkerDeps> = {}): ThinkerDeps {
  return {
    scenario, vector: null, client,
    prompt: loadSystemPrompt("fi"), promptEn: loadSystemPrompt("en"),
    promptOpen: loadSystemPrompt("fi", "open"), promptOpenEn: loadSystemPrompt("en", "open"),
    promptOpenOnce: loadSystemPrompt("fi", "open_once"), promptOpenOnceEn: loadSystemPrompt("en", "open_once"),
    appendLog: async (_id, line) => void logs.push(line), nowMs: () => 0, nowIso: () => "2026-10-19T00:00:00.000Z",
    ...extra,
  };
}

describe("THINKER_EXPECTED_MODEL_VERSION (config.ts)", () => {
  it("reads the pin from the environment, trimmed; unset or empty is no pin", () => {
    expect(EXPECTED_MODEL_VERSION_ENV).toBe("THINKER_EXPECTED_MODEL_VERSION");
    expect(expectedModelVersionOf({})).toBeNull();
    expect(expectedModelVersionOf({ THINKER_EXPECTED_MODEL_VERSION: "  " })).toBeNull();
    expect(expectedModelVersionOf({ THINKER_EXPECTED_MODEL_VERSION: ` ${PINNED}\n` })).toBe(PINNED);
  });
});

describe("the pin: another build is a model error", () => {
  it("the Open Thinker: an answer from another build is 'unavailable', logged modelVersionMismatch", async () => {
    const logs: Record<string, unknown>[] = [];
    const { client } = fakeModel([OTHER], () => OPEN_JSON);
    const r = await handleOpenThinkerRequest(depsWith(client, logs, { expectedModelVersion: PINNED }), req("pin-open"));
    expect(r.body as OpenThinkerResponse).toMatchObject({ fallback: true, fallbackReason: "api_error", answer: "", structured: null, verdicts: null });
    expect(logs[0]).toMatchObject({ modelVersion: OTHER, modelVersionMismatch: { expected: PINNED, got: OTHER }, errorDetail: expect.stringMatching(/model version mismatch/), premiseFlagShown: false });
    expect(logs[0]).not.toHaveProperty("usage");
    expect(logs[0]).toHaveProperty("refusedUsage");
  });

  it("Haku: an answer from another build is the template answer (the ordinary fallback), logged modelVersionMismatch", async () => {
    const logs: Record<string, unknown>[] = [];
    const { client } = fakeModel([OTHER], () => HAKU_JSON);
    const r = await handleThinkerRequest(depsWith(client, logs, { expectedModelVersion: PINNED }), { ...req("pin-haku", "radio"), condition: "directed" });
    const body = r.body as ThinkerResponse;
    expect(body).toMatchObject({ fallback: true, fallbackReason: "api_error" });
    expect(body.answer.vastaus).not.toBe("Live answer.");
    expect(logs[0]).toMatchObject({ modelVersionMismatch: { expected: PINNED, got: OTHER } });
  });

  it("an answer that names no build is refused too (got: null)", async () => {
    const logs: Record<string, unknown>[] = [];
    const { client } = fakeModel([undefined], () => OPEN_JSON);
    const r = await handleOpenThinkerRequest(depsWith(client, logs, { expectedModelVersion: PINNED }), req("pin-none"));
    expect(r.body).toMatchObject({ fallback: true, answer: "" });
    expect(logs[0]).toMatchObject({ modelVersion: null, modelVersionMismatch: { expected: PINNED, got: null } });
  });

  it("the pinned build answers as usual; without a pin any build answers and nothing is refused", async () => {
    for (const [pin, build] of [[PINNED, PINNED], [null, OTHER], [undefined, undefined]] as const) {
      const logs: Record<string, unknown>[] = [];
      const { client } = fakeModel([build], () => OPEN_JSON);
      const r = await handleOpenThinkerRequest(depsWith(client, logs, pin === undefined ? {} : { expectedModelVersion: pin }), req(`ok-${String(pin)}`));
      expect(r.body as OpenThinkerResponse, `pin ${String(pin)}`).toMatchObject({ fallback: false, fallbackReason: null });
      expect((r.body as OpenThinkerResponse).answer).toContain("Options:");
      expect(logs[0]).not.toHaveProperty("modelVersionMismatch");
      expect(logs[0]).toMatchObject({ modelVersion: build ?? null });
    }
  });

  it("a model failure passes the guard unchanged (no build to check)", () => {
    const failed = { ok: false as const, reason: "timeout" as const, attempts: 1 };
    expect(guardModelVersion({ expectedModelVersion: PINNED }, "s", failed)).toEqual({ outcome: failed, log: {} });
  });
});

describe("the monitor: modelVersionChanged per session", () => {
  it("logs a change from the session's first build, on either chat, and only in that session", async () => {
    const logs: Record<string, unknown>[] = [];
    const sessionModelVersions = new Map<string, string>();
    const { client } = fakeModel([PINNED, PINNED, OTHER, OTHER], (call) => (call === 1 ? HAKU_JSON : OPEN_JSON));
    const deps = depsWith(client, logs, { sessionModelVersions });
    await handleOpenThinkerRequest(deps, req("monitor-a"));
    await handleThinkerRequest(deps, req("monitor-a"));
    await handleOpenThinkerRequest(deps, req("monitor-a"));
    await handleOpenThinkerRequest(deps, req("monitor-b"));
    expect(logs.map((l) => l["modelVersionChanged"] ?? false)).toEqual([false, false, true, false]);
    expect(logs[2]).toMatchObject({ modelVersion: OTHER, firstModelVersion: PINNED, fallback: false });
    expect(sessionModelVersions.get("monitor-a")).toBe(PINNED);
    expect(sessionModelVersions.get("monitor-b")).toBe(OTHER);
  });

  it("is independent of the pin: a changed build that is refused is still logged as changed", async () => {
    const logs: Record<string, unknown>[] = [];
    const { client } = fakeModel([PINNED, OTHER], () => OPEN_JSON);
    const deps = depsWith(client, logs, { expectedModelVersion: PINNED });
    await handleOpenThinkerRequest(deps, req("monitor-pin"));
    await handleOpenThinkerRequest(deps, req("monitor-pin"));
    expect(logs[0]).not.toHaveProperty("modelVersionChanged");
    expect(logs[1]).toMatchObject({ modelVersionChanged: true, firstModelVersion: PINNED, modelVersionMismatch: { expected: PINNED, got: OTHER }, fallback: true });
  });

  it("keeps the first builds per deps object when the deps carry no map", () => {
    const ok = (build: string) => ({ ok: true as const, usage: { input_tokens: 1, output_tokens: 1, modelVersion: build } });
    const a = {};
    const b = {};
    expect(guardModelVersion(a, "s", ok(PINNED)).log).toEqual({ modelVersion: PINNED });
    expect(guardModelVersion(a, "s", ok(OTHER)).log).toEqual({ modelVersion: OTHER, modelVersionChanged: true, firstModelVersion: PINNED });
    expect(guardModelVersion(b, "s", ok(OTHER)).log).toEqual({ modelVersion: OTHER });
  });
});
