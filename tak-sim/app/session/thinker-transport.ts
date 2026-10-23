/**
 * The browser's only network call during a run: Thinker's request to the study's own proxy
 * (SPEC/00 revision (q), the I3 exception — "Thinker's requests to the study's own proxy are
 * allowed while RUNNING. No other outbound request is allowed"). Injected into `SessionQueries`,
 * so the Haku group's session, and every test, can run without it.
 */

import { STUDY_PARAM } from "./preview.js";
import {
  DEMO_BRIDGE_MODEL_ID, THINKER_CLIENT_TIMEOUT_MS, THINKER_ENDPOINT, THINKER_OPEN_ENDPOINT, type OpenThinkerResponse, type ThinkerRequest, type ThinkerResponse,
} from "./thinker-protocol.js";

export type ThinkerTransport = (request: ThinkerRequest) => Promise<ThinkerResponse>;
export type OpenThinkerTransport = (request: ThinkerRequest) => Promise<OpenThinkerResponse>;

/** Thrown for a proxy that did not answer in time; any other failure is a network error. */
export class ThinkerTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Thinker proxy did not answer within ${timeoutMs} ms`);
    this.name = "ThinkerTimeoutError";
  }
}

/**
 * Thrown for a proxy answer that is not a Thinker response (systems review F4, 7 Oct 2026): the
 * caller treats it like any other network failure (`network_error`, the local fallback, logged).
 */
export class ThinkerBadResponseError extends Error {
  constructor(problem: string) {
    super(`Thinker proxy answer has the wrong shape: ${problem}`);
    this.name = "ThinkerBadResponseError";
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** SPEC/31 §3.6 (format 0.11.0): `digestAtomIds` and `recentAtomIds` are optional (an older proxy has neither), else arrays of ids. */
function assertContextIds(body: Record<string, unknown>): void {
  for (const field of ["digestAtomIds", "recentAtomIds"] as const) {
    const v = body[field];
    if (v !== undefined && !(Array.isArray(v) && v.every((x) => typeof x === "string"))) throw new ThinkerBadResponseError(`${field} is not an array of ids`);
  }
}

/** Checks what the screen and the log read from a proxy answer: the answer's fields are strings, `retrieved` is an array of {id, score}. */
export function assertThinkerResponseShape(body: unknown): asserts body is ThinkerResponse {
  if (!isRecord(body)) throw new ThinkerBadResponseError("not an object");
  const { answer, retrieved } = body;
  if (!isRecord(answer)) throw new ThinkerBadResponseError("no answer object");
  for (const field of ["vastaus", "perusteet", "varmuus", "muuttaisi"] as const) {
    if (typeof answer[field] !== "string") throw new ThinkerBadResponseError(`answer.${field} is not a string`);
  }
  if (answer.linjaus !== undefined && (!isRecord(answer.linjaus) || typeof answer.linjaus.tila !== "string" || typeof answer.linjaus.perustelu !== "string")) {
    throw new ThinkerBadResponseError("answer.linjaus is not {tila, perustelu}");
  }
  if (!Array.isArray(retrieved)) throw new ThinkerBadResponseError("retrieved is not an array");
  if (!retrieved.every((r) => isRecord(r) && typeof r.id === "string" && typeof r.score === "number")) throw new ThinkerBadResponseError("retrieved holds an entry that is not {id, score}");
  assertContextIds(body);
}

/** The Open Thinker's reply (F1): `answer` is a string and `retrieved` an array of {id, score}. */
export function assertOpenThinkerResponseShape(body: unknown): asserts body is OpenThinkerResponse {
  if (!isRecord(body)) throw new ThinkerBadResponseError("not an object");
  if (typeof body.answer !== "string") throw new ThinkerBadResponseError("answer is not a string");
  // Revision (aq): the structured answer is optional; when present it must at least be an object with a kind and the arrays the browser draws.
  const { structured } = body;
  if (structured !== undefined && structured !== null) {
    if (!isRecord(structured) || typeof structured.kind !== "string" || !Array.isArray(structured.facts) || !Array.isArray(structured.premises) || !Array.isArray(structured.options)
      || !Array.isArray(structured.questionsForYou) || !isRecord(structured.tagTimes)) throw new ThinkerBadResponseError("structured is not a structured answer");
  }
  const { retrieved } = body;
  if (!Array.isArray(retrieved)) throw new ThinkerBadResponseError("retrieved is not an array");
  if (!retrieved.every((r) => isRecord(r) && typeof r.id === "string" && typeof r.score === "number")) throw new ThinkerBadResponseError("retrieved holds an entry that is not {id, score}");
  assertContextIds(body);
}

/** The page's query string, or "" outside a browser. */
const pageSearch = (): string => (typeof location === "undefined" ? "" : location.search);

/**
 * The published demonstration's page-side bridge (`tools/demo-bridge/`) answers with {@link DEMO_BRIDGE_MODEL_ID}: accepted outside
 * the study only. In the study (`?tuotanto`) such a reply is refused like one of the wrong shape (the local fallback), so it can
 * never become study data. The real proxy never sends that id, so the study's behaviour is unchanged.
 */
export function assertNotDemoBridgeInStudy(body: { readonly modelId?: unknown }, search: string = pageSearch()): void {
  if (body.modelId === DEMO_BRIDGE_MODEL_ID && new URLSearchParams(search).has(STUDY_PARAM)) throw new ThinkerBadResponseError("the demonstration bridge answered in the study");
}

export function httpThinkerTransport(endpoint = THINKER_ENDPOINT, timeoutMs = THINKER_CLIENT_TIMEOUT_MS): ThinkerTransport {
  return async (request) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // determinism-lint-allow: SPEC/00 revision (q) I3 exception — Haku's chat call to the study's proxy (every cell, 8 Oct 2026)
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Thinker proxy answered HTTP ${res.status}`);
      const body: unknown = await res.json();
      assertThinkerResponseShape(body);
      assertNotDemoBridgeInStudy(body);
      return body;
    } catch (e) {
      if (controller.signal.aborted) throw new ThinkerTimeoutError(timeoutMs);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };
}

export function httpOpenThinkerTransport(endpoint = THINKER_OPEN_ENDPOINT, timeoutMs = THINKER_CLIENT_TIMEOUT_MS): OpenThinkerTransport {
  return async (request) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // determinism-lint-allow: SPEC/00 revision (q) I3 exception — the Open Thinker's proxy call, AI condition only
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Open Thinker proxy answered HTTP ${res.status}`);
      const body: unknown = await res.json();
      assertOpenThinkerResponseShape(body);
      assertNotDemoBridgeInStudy(body);
      return body;
    } catch (e) {
      if (controller.signal.aborted) throw new ThinkerTimeoutError(timeoutMs);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };
}
