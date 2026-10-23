/**
 * Personal results after the study (SPEC/36, 23 Oct 2026): the contact address's way from the browser to the study server, shared by
 * the step's screen (`ResultsOptInScreen.tsx`) and the server (`server/production/results-contact.ts`).
 *
 *   POST /api/results-contact   body {sessionId, email, lang}   200 {status:"stored"} · 400 {error} · 413 · 429 {error} rate limit
 *                                                               · 404 no contact store on this server (the demonstration's dev server)
 *
 * The address NEVER enters the session log: the log records only `results_optin {optedIn}` (the orchestrator is told the outcome,
 * never the address). The server keeps it in its own directory, apart from the research data, and the researcher deletes it after
 * sending the reports (`npm run results:reports -- --purge`).
 *
 * The one request happens on the step after the post-session questionnaire, when the participant presses Send: the views are over
 * (the engine waits in DEBRIEF_HANDOFF), so no run-loop timing can depend on it (SPEC/05 I3).
 */

import { isValidSessionId } from "../telemetry/session-log-protocol.js";

export const RESULTS_CONTACT_ENDPOINT = "/api/results-contact";
/** The request body's limit on the server (an address is at most {@link MAX_EMAIL_LENGTH} characters). */
export const RESULTS_CONTACT_MAX_BODY_BYTES = 1024;
/** RFC 5321's path limit. */
export const MAX_EMAIL_LENGTH = 254;

export type ResultsLang = "fi" | "en";

export interface ResultsContactRequest {
  readonly sessionId: string;
  readonly email: string;
  readonly lang: ResultsLang;
}

/**
 * A plausible address: one `@`, a local part of 1–64 characters without spaces, quotes, angle brackets or commas, and a domain of
 * dot-separated labels with a final label of at least two letters. Shape only; deliverability is the researcher's mail program's.
 */
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

export function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_EMAIL_LENGTH) return false;
  if (!EMAIL.test(value)) return false;
  const local = value.slice(0, value.indexOf("@"));
  return !local.startsWith(".") && !local.endsWith(".") && !local.includes("..");
}

/** The address as stored: surrounding spaces removed (what the participant sees is what is checked). */
export function normaliseEmail(raw: string): string {
  return raw.trim();
}

/** The request body checked; the reason when it is not acceptable (the server answers 400 with it). */
export function checkResultsContactRequest(body: unknown): { readonly ok: true; readonly request: ResultsContactRequest } | { readonly ok: false; readonly error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, error: "body must be an object" };
  const b = body as Partial<Record<keyof ResultsContactRequest, unknown>>;
  if (!isValidSessionId(b.sessionId)) return { ok: false, error: "sessionId required" };
  if (typeof b.email !== "string" || !isValidEmail(normaliseEmail(b.email))) return { ok: false, error: "email is not an address" };
  if (b.lang !== "fi" && b.lang !== "en") return { ok: false, error: "lang must be fi or en" };
  return { ok: true, request: { sessionId: b.sessionId, email: normaliseEmail(b.email), lang: b.lang } };
}

export type FetchLike = (url: string, init: { readonly method: string; readonly headers: Record<string, string>; readonly body: string; readonly signal?: AbortSignal }) => Promise<{ readonly status: number }>;

/** `stored`: the server has the address. `unavailable`: no server, no route, a network error or a refusal: the step says so. */
export type SendOutcome = "stored" | "invalid" | "unavailable";

/** Sends the address once (the screen offers "try again"). Never throws; never logs the address. */
export async function sendResultsContact(request: ResultsContactRequest, fetchFn: FetchLike, timeoutMs = 10_000): Promise<SendOutcome> {
  if (!isValidSessionId(request.sessionId) || !isValidEmail(request.email)) return "invalid";
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchFn(RESULTS_CONTACT_ENDPOINT, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request), ...(controller ? { signal: controller.signal } : {}),
    });
    if (res.status === 200) return "stored";
    return res.status === 400 ? "invalid" : "unavailable";
  } catch {
    return "unavailable";
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/** The browser's fetch, for the step's screen. */
export function browserResultsFetch(): FetchLike {
  // determinism-lint-allow: the one contact request, on the step after the post-session questionnaire, when the participant presses Send; the views are over (SPEC/05 I3, SPEC/36).
  return (url, init) => fetch(url, init);
}
