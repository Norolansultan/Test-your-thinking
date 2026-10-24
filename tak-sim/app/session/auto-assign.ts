/**
 * The shared study link (revision (af), 9 Oct 2026): `https://<host>/?tuotanto&osite=<stratum>`, the same for every
 * participant of a stratum (SPEC/30 §2 revision (bf), 24 Oct 2026: the recruitment screener's profession × leads others, e.g.
 * `osite=fire_rescue.lead`). When the participant presses start on the start page (outside the run loop, SPEC/05
 * I3), the browser asks the hosted study server once for the next unused code of the allocation table in the
 * chosen language and the link's stratum (`POST /api/assign`, `server/production/auto-assign.ts`), then runs as a
 * session assigned by that code (`assignmentSource: "server"` and the row's `stratum` in the header).
 *
 * The code and the session id are kept in this browser's localStorage under {@link STORED_ASSIGNMENT_KEY}
 * (per origin: a new tunnel address starts afresh). The session id is stored BEFORE the request, so a
 * retry after a lost response repeats the same session id and the server, which answers a known session
 * id with its own code, never issues a second code to the same browser. Reopening the link in the same
 * browser resumes: an unfinished session through the usual resume offer (`ResumeGate`), otherwise the
 * stored code again, never a new draw.
 *
 * No server, no session: when `/api/assign` is absent (the Vite dev server, `npm run serve` without
 * `AUTO_ASSIGN=1`, offline) or refuses (no codes left), the start page says the link is not active —
 * never a random or demonstration cell in the study.
 */

import type { AssignmentLanguage, AssignmentTable } from "./assignment.js";
import { assignmentOf, inStratum } from "./assignment.js";
import { stratumId, type Stratum } from "../telemetry/record-kinds-pilot2.js";
import { ALLOCATION_TABLE } from "./preview.js";
import { isValidSessionId } from "../telemetry/session-log-protocol.js";

export const ASSIGN_ENDPOINT = "/api/assign";
export const STORED_ASSIGNMENT_KEY = "study-auto-assignment";

/**
 * The request body (`server/production/auto-assign.ts` validates it). `stratum` (SPEC/30 §2 revision (bf), 24 Oct 2026): the link's
 * `?osite=` (`stratumId`), the stratum the next code is drawn from; a stratified table refuses a request without one.
 */
export interface AssignRequest {
  readonly sessionId: string;
  readonly language: AssignmentLanguage;
  readonly stratum?: string;
}

/** What this browser keeps: the session id always, the code once the server has issued it. */
export interface StoredAssignment {
  readonly sessionId: string;
  readonly code?: string;
}

/** Why there is no assignment: `inactive` — no assign route (404, offline, not JSON); `refused` — the server answered but gave no code (none left, rate limit). */
export type AssignOutcome =
  | { readonly ok: true; readonly code: string; readonly sessionId: string }
  | { readonly ok: false; readonly reason: "inactive" | "refused" };

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AssignDeps {
  readonly fetch: (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ readonly ok: boolean; readonly status: number; json(): Promise<unknown> }>;
  readonly storage: StorageLike | null;
  /** A fresh session id (`annotations.ts` `newSessionId`). */
  readonly newSessionId: () => string;
  readonly table?: AssignmentTable;
}

export function readStoredAssignment(storage: StorageLike | null): StoredAssignment | null {
  try {
    const raw = storage?.getItem(STORED_ASSIGNMENT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { sessionId?: unknown; code?: unknown };
    if (!isValidSessionId(v.sessionId)) return null;
    return typeof v.code === "string" ? { sessionId: v.sessionId, code: v.code } : { sessionId: v.sessionId };
  } catch {
    return null;
  }
}

function store(storage: StorageLike | null, value: StoredAssignment): void {
  try { storage?.setItem(STORED_ASSIGNMENT_KEY, JSON.stringify(value)); } catch { /* storage unavailable: the launcher refuses a study session anyway */ }
}

/** The stored code, when it is one of the table's (a stale or edited entry is ignored). */
export function storedCode(storage: StorageLike | null, table: AssignmentTable = ALLOCATION_TABLE): StoredAssignment & { readonly code: string } | null {
  const s = readStoredAssignment(storage);
  return s?.code !== undefined && assignmentOf(table, s.code) ? { sessionId: s.sessionId, code: s.code } : null;
}

/**
 * The participant's code: the one this browser already holds, or one requested from the server (once).
 * `language` is the start page's choice and `stratum` the link's (`?osite=`, revision (bf)); the server issues from that language ×
 * stratum's sequence, and a code of another language or stratum is not accepted.
 */
export async function obtainAssignment(language: AssignmentLanguage, deps: AssignDeps, stratum?: Stratum): Promise<AssignOutcome> {
  const table = deps.table ?? ALLOCATION_TABLE;
  const held = storedCode(deps.storage, table);
  if (held) return { ok: true, code: held.code, sessionId: held.sessionId };
  const sessionId = readStoredAssignment(deps.storage)?.sessionId ?? deps.newSessionId();
  store(deps.storage, { sessionId });
  let res;
  try {
    const body: AssignRequest = { sessionId, language, ...(stratum ? { stratum: stratumId(stratum) } : {}) };
    // determinism-lint-allow: the one assign request, on the start page when the participant presses start, before the session and its run loop exist (SPEC/05 I3).
    res = await deps.fetch(ASSIGN_ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    return { ok: false, reason: "inactive" };
  }
  if (res.status === 404 || res.status === 405) return { ok: false, reason: "inactive" };
  let data: unknown;
  try { data = await res.json(); } catch { return { ok: false, reason: "inactive" }; }
  const code = res.ok && typeof (data as { code?: unknown } | null)?.code === "string" ? (data as { code: string }).code : null;
  if (code === null) return { ok: false, reason: res.ok ? "inactive" : "refused" };
  const row = assignmentOf(table, code);
  if (!row || row.language !== language || (stratum && !inStratum(row, language, stratum))) return { ok: false, reason: "inactive" };
  store(deps.storage, { sessionId, code: row.code });
  return { ok: true, code: row.code, sessionId };
}

/** The browser's dependencies. Called by the start page only, when the participant presses start. */
export function browserAssignDeps(newSessionId: () => string): AssignDeps {
  let storage: StorageLike | null = null;
  try { storage = window.localStorage; } catch { /* blocked */ }
  return {
    // determinism-lint-allow: one request on the start page, before the session and its run loop exist (SPEC/05 I3).
    fetch: (url, init) => fetch(url, init),
    storage,
    newSessionId,
  };
}
