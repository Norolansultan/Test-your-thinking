/**
 * The contact store for personal results after the study (SPEC/36, 23 Oct 2026; protocol in `app/session/results-contact.ts`):
 *
 *   POST /api/results-contact   body {sessionId, email, lang}   200 {status:"stored"} · 400 {error} · 413 · 429 {error} rate limit
 *
 * Mounted by `server.ts` when the production config has a contact directory (`RESULTS_CONTACT_DIR`, default `logs/results-contacts`
 * under the app, outside SESSION_LOG_DIR; `off` = the route answers 404 and the participant's step says it could not save).
 *
 * Storage: `<dir>/contacts.jsonl`, one JSON line per contact `{sessionId, email, lang, receivedAtIso}`, appended (a participant who
 * sends again gets a second line; the report generator takes the last line per session). The directory is created with mode 0700
 * and the file 0600. It is NOT under the session-log directory, so the researcher's data download (`/admin`, `sessions:export`)
 * never contains an address, and the research data never contain one either (the log has `results_optin {optedIn}` only).
 *
 * Never logged: the body, the address and the session id are not printed; a failed write answers 500 through the server's
 * generic handler, whose message names no address.
 *
 * Abuse guard: at most `ratePerHour` contacts per client address per hour (429), as `/api/assign`; the body limit is 1 KB.
 */

import { appendFile, chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { checkResultsContactRequest, type ResultsContactRequest } from "../../app/session/results-contact.js";

export const RESULTS_CONTACT_FILE = "contacts.jsonl";
export const DEFAULT_RESULTS_CONTACT_RATE_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

/** One stored line. */
export interface StoredContact extends ResultsContactRequest {
  readonly receivedAtIso: string;
}

export interface ResultsContactOptions {
  readonly dir: string;
  readonly ratePerHour?: number;
  readonly now?: () => Date;
}

export interface ResultsContactResponse {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Record<string, string>;
}

export class ResultsContactStore {
  private readonly recent = new Map<string, number[]>();
  private queue: Promise<unknown> = Promise.resolve();
  readonly file: string;

  constructor(private readonly options: ResultsContactOptions) {
    this.file = join(options.dir, RESULTS_CONTACT_FILE);
  }

  /** One request: serialised, so two appends never interleave. */
  submit(body: unknown, client: string): Promise<ResultsContactResponse> {
    const run = this.queue.then(() => this.submitNow(body, client));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async submitNow(body: unknown, client: string): Promise<ResultsContactResponse> {
    const checked = checkResultsContactRequest(body);
    if (!checked.ok) return { status: 400, body: { error: checked.error } };
    const nowMs = (this.options.now ?? (() => new Date()))().getTime();
    const limit = this.options.ratePerHour ?? DEFAULT_RESULTS_CONTACT_RATE_PER_HOUR;
    const times = (this.recent.get(client) ?? []).filter((t) => nowMs - t < HOUR_MS);
    if (times.length >= limit) {
      this.recent.set(client, times);
      const retry = Math.ceil((times[0]! + HOUR_MS - nowMs) / 1000);
      return { status: 429, body: { error: "too many requests from this address; try later" }, headers: { "retry-after": String(Math.max(1, retry)) } };
    }
    const line: StoredContact = { ...checked.request, receivedAtIso: new Date(nowMs).toISOString() };
    await mkdir(this.options.dir, { recursive: true, mode: 0o700 });
    await appendFile(this.file, `${JSON.stringify(line)}\n`, { encoding: "utf8", mode: 0o600 });
    await chmod(this.file, 0o600); // a file created by hand (or before) is narrowed too
    times.push(nowMs);
    this.recent.set(client, times);
    return { status: 200, body: { status: "stored" } };
  }
}
