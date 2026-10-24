/**
 * Automatic assignment for the shared study link (revision (af), 9 Oct 2026; `app/session/auto-assign.ts`):
 *
 *   POST /api/assign   body {sessionId, language, stratum}   200 {code} · 400 · 413 · 410 {error} none left / cap
 *                                                              reached · 429 {error} rate limit
 *
 * Mounted by `server.ts` only when the production server's config says so (`AUTO_ASSIGN=1`, set by
 * `scripts/host-study.ps1` and the Dockerfile); otherwise the route answers 404 like any unknown one.
 * The Vite dev server never has it, so a researcher running the app locally never consumes a code.
 *
 * Order: the NEXT unused code of the committed allocation table (`content/assignment/allocation.json`),
 * in table order within the stratum: the language the participant chose and, in a stratified table
 * (version 2, SPEC/30 §2 revision (bf), 24 Oct 2026), the link's `stratum` (`fire_rescue.lead`, …; required
 * there: a request without one, or with an unknown one, is refused with 400), so codes go out exactly as the
 * permuted blocks lay them down and the blocked randomisation stays as balanced as it is by link.
 *
 * The cell filter (`ASSIGN_CELLS`, e.g. `reasoning_intent`) is a PILOT setting: it walks the same
 * sequence and skips rows of other cells, so the pilot draws the filtered cell's codes in sequence order.
 * It deliberately breaks the blocked balance between cells (the skipped cells receive nobody), which is
 * fine for a pilot and must be off for the study. Skipped codes are not consumed: they stay unissued
 * (and usable as manual `?koodi=` links). The admin page shows the filter in force.
 *
 * Persistence: `issued-codes.json` in SESSION_LOG_DIR, written to a temporary file and renamed (atomic),
 * before the code is answered; on start the file is read back, so a restart never reissues a code. A
 * file written for another table (`tableSha256`) stops the server rather than mix two sequences. A code
 * already seen in an uploaded session's header (a manual `?koodi=` link) is skipped too.
 *
 * Abuse guard: a session id already holding a code gets the same code again (a retry, not a new draw);
 * at most `ratePerHour` new codes per client address per hour (429); at most `maxIssued` codes in all
 * (default: the table's length; 410). The client address is the proxy's `cf-connecting-ip`
 * or first `x-forwarded-for` entry when present (the server sits behind a tunnel or the
 * platform's proxy), else the socket's address.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { IncomingHttpHeaders } from "node:http";
import { inStratum, type AssignmentLanguage, type AssignmentRow, type AssignmentTable } from "../../app/session/assignment.js";
import { parseStratumId, STRATA, stratumId } from "../../app/telemetry/record-kinds-pilot2.js";
import type { Cell } from "../../app/scenario/types.js";
import { isValidSessionId } from "../../app/telemetry/session-log-protocol.js";

export const ASSIGN_PATH = "/api/assign";
export const ISSUED_CODES_FILE = "issued-codes.json";
export const ASSIGN_MAX_BODY_BYTES = 1024;
export const DEFAULT_ASSIGN_RATE_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

export interface IssuedCode {
  readonly code: string;
  readonly language: AssignmentLanguage;
  /** Revision (bf): the code's stratum id (`stratumId`); absent for a version-1 table. */
  readonly stratum?: string;
  readonly block: number;
  readonly cell: Cell;
  readonly sessionId: string;
  readonly issuedAtIso: string;
}

/** The persisted file. */
export interface IssuedCodesFile {
  readonly version: 1;
  readonly tableSha256: string;
  readonly issued: readonly IssuedCode[];
}

export interface AutoAssignConfig {
  /** Null: every cell (the study). A list: only those cells (a pilot). */
  readonly cells: readonly Cell[] | null;
  /** Null: the table's length. */
  readonly maxIssued: number | null;
  readonly ratePerHour: number;
}

export interface AutoAssignOptions extends AutoAssignConfig {
  readonly table: AssignmentTable;
  /** SESSION_LOG_DIR. */
  readonly dir: string;
  /** Participant codes already in uploaded session headers (manual links); skipped. */
  readonly usedCodes?: () => Promise<Iterable<string>>;
  readonly now?: () => Date;
}

export interface AssignResponse {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Record<string, string>;
}

/** What the admin page shows. */
export interface AssignmentOverview {
  readonly cells: readonly Cell[] | null;
  readonly maxIssued: number;
  readonly ratePerHour: number;
  readonly issued: readonly IssuedCode[];
  /** Unissued codes the filter admits, per language. */
  readonly remaining: Readonly<Record<AssignmentLanguage, number>>;
  /** Revision (bf): the same per language × stratum (`en.fire_rescue.lead`), in table order; empty for a version-1 table. */
  readonly remainingByStratum: Readonly<Record<string, number>>;
}

/** A row's stratum id, or null for a version-1 table's row (no strata). */
function rowStratumId(row: AssignmentRow): string | null {
  return row.profession !== undefined && row.leads !== undefined ? stratumId({ profession: row.profession, leads: row.leads }) : null;
}

export class AutoAssignError extends Error {}

/** The client's address for the rate limit. */
export function clientAddress(headers: IncomingHttpHeaders, socketAddress: string | undefined): string {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(",")[0]?.trim();
  return one(headers["cf-connecting-ip"]) || one(headers["x-forwarded-for"]) || socketAddress || "unknown";
}

export class AutoAssigner {
  private issued: IssuedCode[];
  private readonly recent = new Map<string, number[]>();
  private queue: Promise<unknown> = Promise.resolve();
  private readonly file: string;
  private readonly maxIssued: number;

  private constructor(private readonly options: AutoAssignOptions, issued: IssuedCode[]) {
    this.issued = issued;
    this.file = join(options.dir, ISSUED_CODES_FILE);
    this.maxIssued = options.maxIssued ?? options.table.rows.length;
  }

  /** Reads the issued codes back (none on a first start). Throws on a file of another table or a damaged one. */
  static async open(options: AutoAssignOptions): Promise<AutoAssigner> {
    const file = join(options.dir, ISSUED_CODES_FILE);
    let text: string | null = null;
    try { text = await readFile(file, "utf8"); } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    if (text === null) return new AutoAssigner(options, []);
    let parsed: IssuedCodesFile;
    try { parsed = JSON.parse(text) as IssuedCodesFile; } catch { throw new AutoAssignError(`${file} is not valid JSON; fix or move it (it records which codes were issued)`); }
    if (parsed.tableSha256 !== options.table.rowsSha256) throw new AutoAssignError(`${file} was written for another allocation table (${parsed.tableSha256}); move it before using this table`);
    if (!Array.isArray(parsed.issued)) throw new AutoAssignError(`${file} has no issued list`);
    return new AutoAssigner(options, [...parsed.issued]);
  }

  overview(): AssignmentOverview {
    const issued = new Set(this.issued.map((i) => i.code));
    const remaining = { fi: 0, en: 0 };
    const remainingByStratum: Record<string, number> = {};
    for (const r of this.options.table.rows) {
      const s = rowStratumId(r);
      const key = s === null ? null : `${r.language}.${s}`;
      if (key !== null && remainingByStratum[key] === undefined) remainingByStratum[key] = 0;
      if (!this.admits(r) || issued.has(r.code)) continue;
      remaining[r.language]++;
      if (key !== null) remainingByStratum[key]!++;
    }
    return { cells: this.options.cells, maxIssued: this.maxIssued, ratePerHour: this.options.ratePerHour, issued: [...this.issued], remaining, remainingByStratum };
  }

  private admits(row: AssignmentRow): boolean {
    return this.options.cells === null || this.options.cells.includes(row.cell);
  }

  /** One request: serialised, so two concurrent starts never draw the same code. */
  assign(body: unknown, client: string): Promise<AssignResponse> {
    const run = this.queue.then(() => this.assignNow(body, client));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async assignNow(body: unknown, client: string): Promise<AssignResponse> {
    const req = body as { sessionId?: unknown; language?: unknown; stratum?: unknown } | null;
    if (typeof req !== "object" || req === null || !isValidSessionId(req.sessionId)) return { status: 400, body: { error: "sessionId required" } };
    if (req.language !== "fi" && req.language !== "en") return { status: 400, body: { error: "language must be fi or en" } };
    const sessionId = req.sessionId;
    const language: AssignmentLanguage = req.language;
    // Revision (bf): a stratified table issues within the link's stratum only; a request without one (or with an unknown one) is refused.
    const stratified = this.options.table.rows.some((r) => rowStratumId(r) !== null);
    const stratum = typeof req.stratum === "string" ? parseStratumId(req.stratum) : null;
    if (stratified && !stratum) return { status: 400, body: { error: `stratum required (one of ${STRATA.map(stratumId).join(", ")})` } };

    const known = this.issued.find((i) => i.sessionId === sessionId);
    if (known) return { status: 200, body: { code: known.code } };

    const nowMs = (this.options.now ?? (() => new Date()))().getTime();
    const times = (this.recent.get(client) ?? []).filter((t) => nowMs - t < HOUR_MS);
    if (times.length >= this.options.ratePerHour) {
      this.recent.set(client, times);
      const retry = Math.ceil((times[0]! + HOUR_MS - nowMs) / 1000);
      return { status: 429, body: { error: "too many new sessions from this address; try later" }, headers: { "retry-after": String(Math.max(1, retry)) } };
    }
    if (this.issued.length >= this.maxIssued) return { status: 410, body: { error: "no codes left (cap reached)" } };

    const taken = new Set(this.issued.map((i) => i.code));
    try { for (const c of (await this.options.usedCodes?.()) ?? []) taken.add(c); } catch { /* the listing failed: the issued file alone still prevents a reissue */ }
    const row = this.options.table.rows.find((r) => r.language === language && (!stratum || inStratum(r, language, stratum)) && this.admits(r) && !taken.has(r.code));
    if (!row) return { status: 410, body: { error: stratum ? `no codes left in ${language}.${stratumId(stratum)}` : "no codes left" } };

    const rowStratum = rowStratumId(row);
    const entry: IssuedCode = {
      code: row.code, language: row.language, ...(rowStratum !== null ? { stratum: rowStratum } : {}), block: row.block, cell: row.cell, sessionId, issuedAtIso: new Date(nowMs).toISOString(),
    };
    const next = [...this.issued, entry];
    await this.persist(next); // a failed write answers 500 and issues nothing
    this.issued = next;
    times.push(nowMs);
    this.recent.set(client, times);
    return { status: 200, body: { code: row.code } };
  }

  private async persist(issued: readonly IssuedCode[]): Promise<void> {
    const content: IssuedCodesFile = { version: 1, tableSha256: this.options.table.rowsSha256, issued };
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify(content, null, 2)}\n`);
    await rename(tmp, this.file);
  }
}
