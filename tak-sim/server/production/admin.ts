/**
 * The researcher's data download (docs/DEPLOYMENT.md §6), mounted by `server.ts` only when
 * `ADMIN_TOKEN` is set; without it every route below answers 404 as if it did not exist.
 *
 *   GET /admin?token=…                               a plain page: the sessions and download links (no script)
 *   GET /api/admin/sessions                          the listing as JSON (`admin-data.ts` `SessionRow`)
 *   GET /api/admin/assignments                       the shared link's issued codes with their cell and session
 *                                                    status, and the cell filter in force (`auto-assign.ts`);
 *                                                    404 when AUTO_ASSIGN is off
 *   GET /api/admin/sessions/<id>/log                 the session file: the finished upload, else the latest
 *                                                    checkpoint (`x-session-file: complete | partial`)
 *   GET /api/admin/sessions/<id>/thinker             the Thinker proxy's log of that session
 *   GET /api/admin/sessions/<id>/archive.tar         that session's files as one tar
 *   GET /api/admin/export.tar                        everything: index.json, sessions/…, thinker/…
 *
 * The token comes as `Authorization: Bearer <token>` (curl, scripts) or `?token=<token>` (the page's
 * links, so a browser can download with a click). It is compared in constant time over SHA-256
 * digests, so neither its content nor its length leaks through timing. The token is checked before
 * any route is matched (a wrong token learns nothing about which sessions exist). Session ids are
 * matched raw against the upload's own pattern (no decoding, no dots or separators): a path never
 * leaves the two log directories. Everything shown on the page is HTML-escaped: the headers inside
 * the files were written by browsers through an unauthenticated upload.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isValidSessionId } from "../../app/telemetry/session-log-protocol.js";
import type { AssignmentOverview, IssuedCode } from "./auto-assign.js";
import { exportEntries, listSessions, sessionFiles, tarStream, type AdminDirs, type SessionRow } from "./admin-data.js";

export const ADMIN_PAGE = "/admin";
export const ADMIN_API = "/api/admin";

/** The shortest ADMIN_TOKEN `config.ts` accepts (host-study.ps1 generates 43 characters). */
export const MIN_ADMIN_TOKEN_LENGTH = 24;

export interface AdminOptions {
  readonly token: string;
  readonly dirs: AdminDirs;
  /** The server's wall clock for the archive's file name (injected in tests). */
  readonly now?: () => Date;
  /** The shared link's issued codes (`AutoAssigner.overview`); absent when AUTO_ASSIGN is off. */
  readonly assignments?: () => AssignmentOverview;
}

export interface AdminResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: string | Buffer | AsyncIterable<Buffer>;
}

export function isAdminPath(path: string): boolean {
  return path === ADMIN_PAGE || path === ADMIN_API || path.startsWith(`${ADMIN_API}/`);
}

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

/** Constant-time: both sides hashed to 32 bytes first, so unequal lengths take the same path. */
export function tokenMatches(given: string | null | undefined, expected: string): boolean {
  if (typeof given !== "string" || given.length === 0 || expected.length === 0) return false;
  return timingSafeEqual(digest(given), digest(expected));
}

function tokenOf(query: URLSearchParams, authorization: string | undefined): string | null {
  const bearer = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? "");
  return bearer ? bearer[1]! : query.get("token");
}

const NO_STORE = { "cache-control": "no-store" } as const;

function json(status: number, body: unknown): AdminResponse {
  return { status, headers: { ...NO_STORE, "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(body) };
}

function attachment(name: string, type: string, body: AdminResponse["body"], extra: Record<string, string> = {}): AdminResponse {
  return { status: 200, headers: { ...NO_STORE, "content-type": type, "content-disposition": `attachment; filename="${name}"`, ...extra }, body };
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const SESSION_ROUTE = new RegExp(`^${ADMIN_API}/sessions/([^/]+)/(log|thinker|archive\\.tar)$`);

/** Handles one request to an admin path (`isAdminPath`). `url` is the path with its query string. */
export async function handleAdminRequest(options: AdminOptions, method: string, url: string, authorization: string | undefined): Promise<AdminResponse> {
  const [path = "", queryText = ""] = url.split("?", 2);
  const query = new URLSearchParams(queryText);
  if (!tokenMatches(tokenOf(query, authorization), options.token)) {
    return path === ADMIN_PAGE
      ? { status: 401, headers: { ...NO_STORE, "content-type": "text/plain; charset=utf-8" }, body: "Open this page with ?token=<ADMIN_TOKEN> (printed by the server's start script).\n" }
      : json(401, { error: "admin token required" });
  }
  if (method !== "GET") return json(405, { error: "method not allowed" });
  const stamp = (options.now ?? (() => new Date()))().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");

  if (path === ADMIN_PAGE) return { status: 200, headers: { ...NO_STORE, "content-type": "text/html; charset=utf-8", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" }, body: await adminPageOf(options, tokenOf(query, undefined)) };
  if (path === `${ADMIN_API}/assignments`) {
    if (!options.assignments) return json(404, { error: "automatic assignment is off" });
    return json(200, issuedWithStatus(options.assignments(), await listSessions(options.dirs)));
  }
  if (path === `${ADMIN_API}/sessions`) return json(200, { sessions: await listSessions(options.dirs) });
  if (path === `${ADMIN_API}/export.tar`) return attachment(`fire-sim-sessions-${stamp}.tar`, "application/x-tar", tarStream(exportEntries(options.dirs)));

  const m = SESSION_ROUTE.exec(path);
  if (!m) return json(404, { error: "not found" });
  const [, id = "", what] = m;
  if (!isValidSessionId(id)) return json(400, { error: "invalid session id" });
  const files = (await sessionFiles(options.dirs, id)) ?? [];
  if (what === "archive.tar") {
    if (files.length === 0) return json(404, { error: "no files for this session" });
    return attachment(`session-${id}.tar`, "application/x-tar", tarStream(files.map((f) => ({ name: f.archivePath, data: () => readFile(f.path).catch(() => null), mtimeSeconds: f.mtimeSeconds }))));
  }
  if (what === "thinker") {
    const f = files.find((x) => x.archivePath.startsWith("thinker/"));
    return f ? attachment(`thinker-${id}.jsonl`, "application/x-ndjson; charset=utf-8", await readFile(f.path)) : json(404, { error: "no Thinker log for this session" });
  }
  // The finished file supersedes the checkpoint; a checkpoint-only session gives its partial file, named so.
  const complete = files.find((x) => x.archivePath === `sessions/${id}.jsonl`);
  const partial = files.find((x) => x.archivePath === `sessions/${id}.partial.jsonl`);
  const chosen = complete ?? partial;
  if (!chosen) return json(404, { error: "no session file for this session" });
  return attachment(complete ? `session-${id}.jsonl` : `session-${id}.partial.jsonl`, "application/x-ndjson; charset=utf-8", await readFile(chosen.path),
    { "x-session-file": complete ? "complete" : "partial" });
}

/** An issued code with the status of its session on the server: by session id, else by the code in a session header; `not_started` when neither has uploaded anything. */
export type IssuedRow = IssuedCode & { readonly status: SessionRow["status"] | "not_started"; readonly loggedSessionId: string | null };

export function issuedWithStatus(overview: AssignmentOverview, sessions: readonly SessionRow[]): Omit<AssignmentOverview, "issued"> & { readonly issued: readonly IssuedRow[] } {
  const rank = { complete: 4, partial: 3, uploading: 2, thinker_only: 1 } as const;
  const issued = overview.issued.map((i) => {
    const mine = sessions.filter((s) => s.sessionId === i.sessionId || s.participantCode === i.code);
    const best = mine.reduce<SessionRow | null>((b, s) => (b === null || rank[s.status] > rank[b.status] ? s : b), null);
    return { ...i, status: best?.status ?? ("not_started" as const), loggedSessionId: best?.sessionId ?? null };
  });
  return { ...overview, issued };
}

async function adminPageOf(options: AdminOptions, token: string | null): Promise<string> {
  const sessions = await listSessions(options.dirs);
  return adminPage(sessions, token, options.assignments ? issuedWithStatus(options.assignments(), sessions) : null);
}

function issuedSection(o: ReturnType<typeof issuedWithStatus>): string {
  const cell = (v: string | number | null) => `<td>${v === null ? "—" : escapeHtml(String(v))}</td>`;
  const filter = o.cells
    ? `<p class="pilot"><b>Cell filter in force (pilot setting): ${escapeHtml(o.cells.join(", "))}.</b> Only codes of ${o.cells.length === 1 ? "this cell" : "these cells"} are issued, in sequence order; the blocked balance between cells does not hold. Unset ASSIGN_CELLS for the study.</p>`
    : `<p>No cell filter: codes are issued in the allocation sequence's order (the blocked randomisation).</p>`;
  const rows = o.issued.map((r) => `<tr class="${r.status}">${cell(r.code)}${cell(r.cell)}${cell(r.language)}${cell(r.block)}${cell(r.issuedAtIso)}${cell(r.status)}<td><code>${escapeHtml(r.sessionId)}</code></td></tr>`).join("\n");
  return `<h2>Shared study link: issued codes</h2>
${filter}
<p>${o.issued.length} issued (cap ${o.maxIssued}; at most ${o.ratePerHour} new per address per hour). Codes left: en ${o.remaining.en}, fi ${o.remaining.fi}. <b>not_started</b>: issued, nothing uploaded yet.</p>
<table><thead><tr><th>Code</th><th>Cell</th><th>Language</th><th>Block</th><th>Issued</th><th>Status</th><th>Session id</th></tr></thead>
<tbody>
${rows}
</tbody></table>
`;
}

function adminPage(rows: readonly SessionRow[], token: string | null, issued: ReturnType<typeof issuedWithStatus> | null = null): string {
  const t = encodeURIComponent(token ?? "");
  const link = (href: string, label: string) => `<a href="${escapeHtml(`${href}?token=${t}`)}">${escapeHtml(label)}</a>`;
  const cell = (v: string | number | null) => `<td>${v === null ? "—" : escapeHtml(String(v))}</td>`;
  const body = rows.map((r) => {
    const base = `${ADMIN_API}/sessions/${r.sessionId}`;
    const links = [
      r.status === "complete" || r.status === "partial" ? link(`${base}/log`, r.status === "complete" ? "session" : "partial session") : "",
      r.thinkerLogBytes !== null ? link(`${base}/thinker`, "Thinker log") : "",
      link(`${base}/archive.tar`, "all (.tar)"),
    ].filter((s) => s !== "").join(" · ");
    return `<tr class="${r.status}">${cell(r.participantCode)}${cell(r.cell)}${cell(r.status)}${cell(r.records)}${cell(r.lastCheckpoint)}${cell(r.lastWriteIso)}<td><code>${escapeHtml(r.sessionId)}</code></td><td>${links}</td></tr>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Study data</title>
<style>body{font:14px system-ui,sans-serif;margin:24px;color:#1d2125;background:#fff}table{border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:6px 10px;text-align:left;vertical-align:top}
tr.partial td{background:#fff7e0}tr.uploading td,tr.thinker_only td{color:#666}code{font-size:12px}p.pilot{background:#fff0f0;border-left:4px solid #c0392b;padding:6px 10px}</style></head><body>
<h1>Study data</h1>
<p>${link(`${ADMIN_API}/export.tar`, "Download everything (.tar)")} · ${link(`${ADMIN_API}/sessions`, "listing (JSON)")} — ${rows.length} session(s). Times are the server's (UTC).</p>
<p><b>complete</b>: the upload finished (the file ends with its manifest). <b>partial</b>: only checkpoints arrived (abandoned, or still running); the file has no manifest and ends at the last checkpoint. <b>uploading</b>: chunks without completion. <b>thinker_only</b>: a Thinker log and no session data.</p>
<table><thead><tr><th>Code</th><th>Cell</th><th>Status</th><th>Records</th><th>Last checkpoint</th><th>Last write</th><th>Session id</th><th>Download</th></tr></thead>
<tbody>
${body}
</tbody></table>
${issued ? issuedSection(issued) : ""}<p>Keep this address private: the token in it opens every participant's data.</p>
</body></html>
`;
}
