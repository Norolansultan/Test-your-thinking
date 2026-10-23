/**
 * `npm run results:reports` — the personal results after the study (SPEC/36), for the researcher, AFTER data collection has closed.
 * Sends nothing: it writes the reports and a mailing list; the researcher sends them from their own email.
 *
 *   npm run results:reports -- --logs <dir> --contacts <dir> --out <dir> [--expert-reference <json>]
 *   npm run results:reports -- --purge --contacts <dir> --out <dir> --confirm-sent [--include-unsent]
 *
 * Reports: for each contact (`<contacts>/*.jsonl`, the server's `contacts.jsonl`; the last line per session wins), the session's
 * finished log `<logs>/<sessionId>.jsonl`, its commander profile, 2–4 development tips, and percentile bands against every completed
 * study session in `<logs>` of the same background group and against the expert median when `--expert-reference` gives it
 * (`ExpertReference` JSON: calibrationGapPoints, checkingShare, hakuSearches, guideQuestions, reviewChangeShare; null = unknown).
 * Written: `<out>/results-<sessionId>.html` (fi or en by the contact's lang) and `<out>/mailing-list.csv` (email, report_file, lang).
 * A contact without a finished log, or with a malformed line, gets no report; the summary says how many (by session id, never an
 * address). The output directory holds addresses (the CSV): keep it with the contacts, not with the research data.
 *
 * Purge (after sending): deletes the contact files. It refuses unless `--confirm-sent` is given, and, when the contact files hold an
 * address that is not in `<out>/mailing-list.csv` (one that came later, or got no report), unless `--include-unsent` is given too.
 * The mailing list itself is deleted with them. The research data (`<logs>`) are never touched.
 */

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isValidEmail } from "../../app/session/results-contact.js";
import { isValidSessionId } from "../../app/telemetry/session-log-protocol.js";
import { EXPERT_REFERENCE, type ExpertReference } from "../../app/telemetry/profile.js";
import { parseSessionFile } from "../skills/responses.js";
import { buildPool, personalResult, type ParsedSession } from "./comparison.js";
import { reportHtml } from "./report-html.js";

export const MAILING_LIST = "mailing-list.csv";

export interface Contact {
  readonly sessionId: string;
  readonly email: string;
  readonly lang: "fi" | "en";
}

export interface ReportsSummary {
  readonly written: number;
  readonly skipped: readonly { readonly sessionId: string; readonly reason: string }[];
  readonly malformedLines: number;
}

/** Every contact in the directory's `.jsonl` files; the last line per session wins. Malformed lines are counted, not shown. */
export async function readContacts(dir: string): Promise<{ readonly contacts: readonly Contact[]; readonly malformed: number }> {
  const names = (await readdir(dir)).filter((n) => n.endsWith(".jsonl")).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const bySession = new Map<string, Contact>();
  let malformed = 0;
  for (const name of names) {
    for (const line of (await readFile(join(dir, name), "utf8")).split("\n")) {
      if (line.trim() === "") continue;
      try {
        const o = JSON.parse(line) as Partial<Contact>;
        if (!isValidSessionId(o.sessionId) || !isValidEmail(o.email) || (o.lang !== "fi" && o.lang !== "en")) { malformed += 1; continue; }
        bySession.set(o.sessionId, { sessionId: o.sessionId, email: o.email, lang: o.lang });
      } catch { malformed += 1; }
    }
  }
  return { contacts: [...bySession.values()].sort((a, b) => (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0)), malformed };
}

/** Every finished session file (`<id>.jsonl`, not a checkpoint) that parses. */
export async function readSessions(dir: string): Promise<Map<string, ParsedSession>> {
  const out = new Map<string, ParsedSession>();
  for (const name of (await readdir(dir)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const m = /^([A-Za-z0-9][A-Za-z0-9_-]{7,63})\.jsonl$/.exec(name);
    if (!m) continue;
    try {
      const s = parseSessionFile(await readFile(join(dir, name), "utf8"));
      if (s.header.sessionId === m[1]) out.set(m[1]!, s);
    } catch { /* a damaged file is no session for the reports */ }
  }
  return out;
}

const NUMBER_OR_NULL = (v: unknown): v is number | null => v === null || (typeof v === "number" && Number.isFinite(v));
const EXPERT_FIELDS = ["calibrationGapPoints", "checkingShare", "hakuSearches", "guideQuestions", "reviewChangeShare"] as const;

/** The expert reference file: every field a number or null (absent = null). */
export function parseExpertReference(text: string): ExpertReference {
  const o = JSON.parse(text) as Record<string, unknown>;
  const out: Record<string, number | null> = {};
  for (const f of EXPERT_FIELDS) {
    const v = o[f] ?? null;
    if (!NUMBER_OR_NULL(v)) throw new Error(`--expert-reference: ${f} must be a number or null`);
    out[f] = v;
  }
  return out as unknown as ExpertReference;
}

/** A CSV field: quoted when needed; a leading formula character neutralised (the list is opened in a spreadsheet). */
export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const reportFileName = (sessionId: string) => `results-${sessionId}.html`;

export async function writeReports(opts: { readonly logs: string; readonly contacts: string; readonly out: string; readonly expert?: ExpertReference }): Promise<ReportsSummary> {
  const { contacts, malformed } = await readContacts(opts.contacts);
  const sessions = await readSessions(opts.logs);
  const pool = buildPool([...sessions.values()]);
  const expert = opts.expert ?? EXPERT_REFERENCE;
  await mkdir(opts.out, { recursive: true, mode: 0o700 });
  const rows = ["email,report_file,lang"];
  const skipped: { sessionId: string; reason: string }[] = [];
  for (const contact of contacts) {
    const session = sessions.get(contact.sessionId);
    if (!session) { skipped.push({ sessionId: contact.sessionId, reason: "no finished session log" }); continue; }
    if (!session.records.some((r) => r.kind === "session_completed")) { skipped.push({ sessionId: contact.sessionId, reason: "session not completed" }); continue; }
    const file = reportFileName(contact.sessionId);
    await writeFile(join(opts.out, file), reportHtml(personalResult(session, pool, expert), contact.lang), { mode: 0o600 });
    rows.push([contact.email, file, contact.lang].map(csvField).join(","));
  }
  await writeFile(join(opts.out, MAILING_LIST), `${rows.join("\n")}\n`, { mode: 0o600 });
  return { written: rows.length - 1, skipped, malformedLines: malformed };
}

/** The addresses in a mailing list (its first column). */
async function listedEmails(out: string): Promise<Set<string>> {
  const text = await readFile(join(out, MAILING_LIST), "utf8");
  const emails = new Set<string>();
  for (const line of text.split("\n").slice(1)) {
    if (line.trim() === "") continue;
    const first = line.startsWith('"') ? line.slice(1, line.indexOf('"', 1)) : line.slice(0, line.indexOf(","));
    emails.add(first.startsWith("'") ? first.slice(1) : first);
  }
  return emails;
}

export async function purgeContacts(opts: { readonly contacts: string; readonly out: string; readonly confirmSent: boolean; readonly includeUnsent: boolean }): Promise<{ readonly deletedFiles: number; readonly contacts: number }> {
  if (!opts.confirmSent) throw new Error("--purge deletes the participants' addresses: add --confirm-sent once every report in the mailing list has been sent");
  const { contacts } = await readContacts(opts.contacts);
  const listed = await listedEmails(opts.out).catch(() => new Set<string>());
  const unsent = contacts.filter((c) => !listed.has(c.email)).length;
  if (unsent > 0 && !opts.includeUnsent) {
    throw new Error(`${unsent} contact(s) are not in ${MAILING_LIST} (they came later or got no report); run the reports again, or add --include-unsent to delete them anyway`);
  }
  const files = (await readdir(opts.contacts)).filter((n) => n.endsWith(".jsonl"));
  for (const f of files) await rm(join(opts.contacts, f), { force: true });
  await rm(join(opts.out, MAILING_LIST), { force: true });
  return { deletedFiles: files.length, contacts: contacts.length };
}

const USAGE = "usage: results:reports -- --logs <dir> --contacts <dir> --out <dir> [--expert-reference <json>]\n       results:reports -- --purge --contacts <dir> --out <dir> --confirm-sent [--include-unsent]";

export async function main(argv: readonly string[]): Promise<number> {
  const flags = new Set<string>(), values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--purge" || a === "--confirm-sent" || a === "--include-unsent") flags.add(a);
    else if (a === "--logs" || a === "--contacts" || a === "--out" || a === "--expert-reference") {
      const v = argv[++i];
      if (v === undefined) { console.error(`${a} needs a value\n${USAGE}`); return 2; }
      values.set(a, v);
    } else { console.error(`unknown argument ${a}\n${USAGE}`); return 2; }
  }
  const contacts = values.get("--contacts"), out = values.get("--out");
  if (!contacts || !out) { console.error(USAGE); return 2; }
  try {
    if (flags.has("--purge")) {
      const r = await purgeContacts({ contacts, out, confirmSent: flags.has("--confirm-sent"), includeUnsent: flags.has("--include-unsent") });
      console.log(`results:reports: purged ${r.contacts} contact(s) in ${r.deletedFiles} file(s) and the mailing list`);
      return 0;
    }
    const logs = values.get("--logs");
    if (!logs) { console.error(USAGE); return 2; }
    const ref = values.get("--expert-reference");
    const expert = ref ? parseExpertReference(await readFile(ref, "utf8")) : undefined;
    const r = await writeReports({ logs, contacts, out, ...(expert ? { expert } : {}) });
    console.log(`results:reports: ${r.written} report(s) and ${MAILING_LIST} in ${out}`);
    for (const s of r.skipped) console.log(`results:reports: no report for session ${s.sessionId}: ${s.reason}`);
    if (r.malformedLines > 0) console.log(`results:reports: ${r.malformedLines} malformed contact line(s) ignored`);
    console.log("results:reports: send each report from your own email; then run with --purge --confirm-sent to delete the addresses");
    return 0;
  } catch (e) {
    console.error(`results:reports: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = await main(process.argv.slice(2));
