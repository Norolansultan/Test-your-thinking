/**
 * SPEC/36 §3: `npm run results:reports` (`tools/results/reports.ts`) on synthetic session logs and contacts — one self-contained,
 * print-friendly HTML report per contact in the contact's language, the mailing list, the background groups and bands (a group
 * under the minimum gets no band), the expert comparison once a reference is given, the skipped contacts, and the purge; and the
 * reports never contain an item, a key (the freeze banks' leak scan), an exact score, an address or another participant's id.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { asSeq } from "../../app/engine/primitives.js";
import type { LogHeader, LogRecord } from "../../app/telemetry/log.js";
import { exportSessionFile } from "../../app/telemetry/session-file.js";
import { TIP_TEXT } from "../../app/telemetry/profile-tips.js";
import { backgroundGroup, isCompletedStudySession, MIN_COMPARISON_GROUP, percentileBand } from "../../tools/results/comparison.js";
import { csvField, main, MAILING_LIST, reportFileName } from "../../tools/results/reports.js";
import { REPORT_TEXT } from "../../tools/results/report-texts.js";
import { escapeHtml } from "../../tools/results/report-html.js";
import { freezeLog, header } from "../profile/fixtures.js";
import { FREEZES, leaks } from "../profile/leak-scan.js";

let root: string, logs: string, contacts: string, out: string;

interface Spec {
  readonly id: string;
  readonly audience?: "expert" | "public";
  readonly background: Readonly<Record<string, string>>;
  readonly every: number; // every `every`-th answer is wrong
  readonly study?: boolean;
  readonly completed?: boolean;
  readonly cell?: "radio" | "reasoning_once";
  readonly questions?: readonly string[];
}

/** A session file: the profile fixtures' freeze log over the real banks, the background answers, the end. */
function sessionFile(s: Spec): string {
  const cell = s.cell ?? "radio";
  const h: LogHeader = { ...header(cell), sessionId: s.id, participantCode: s.id, audience: s.audience ?? "expert", scope: "full", probeLevelsShown: !(s.study ?? true) };
  const body = freezeLog(FREEZES, (i) => i % s.every !== 0, () => 75, cell).slice(1);
  const extra: { kind: string; detail: unknown }[] = [
    ...(s.questions ?? []).map((text, k) => ({ kind: "ai_chat_query_submitted", detail: { queryId: `q${k}`, text, view: 14, virtualTimeS: 0, phase: "exploration", tool: "haku" } })),
    { kind: "questionnaire_submitted", detail: { questionnaireId: "post", answers: Object.entries(s.background).map(([itemId, value]) => ({ itemId, value })), dwellMs: 1 } },
    { kind: "results_optin", detail: { optedIn: true } },
    ...((s.completed ?? true) ? [{ kind: "session_completed", detail: {} }] : []),
  ];
  const records: LogRecord[] = [{ seq: asSeq(0), tVirtual: 0 as never, tWallOffsetMs: 0, kind: "session_started", detail: h },
    ...[...body, ...extra].map((r, i) => ({ ...(r as LogRecord), seq: asSeq(i + 1), tVirtual: 0 as never, tWallOffsetMs: (i + 1) * 1000 }))];
  return exportSessionFile(h, records, s.completed ?? true);
}

const FIRE = Array.from({ length: 12 }, (_, k): Spec => ({ id: `fire-sess-${String(k).padStart(2, "0")}`, background: { "role.rank": k % 2 ? "crew" : "platoon_commander" }, every: k + 2 }));
const MILITARY = Array.from({ length: 3 }, (_, k): Spec => ({ id: `mil-sess-${k}000`, audience: "public", background: { "public.responder": "professional" }, every: k + 3 }));
const SESSIONS: readonly Spec[] = [
  ...FIRE.map((s, k) => (k === 0 ? { ...s, questions: ["Where is EK12?", "How many crews are at the road?", "Missä EK11 on?"] } : s)),
  ...MILITARY,
  { id: "demo-sess-0001", background: { "role.rank": "crew" }, every: 2, study: false },
  { id: "open-sess-0001", background: { "role.rank": "crew" }, every: 2, completed: false },
  { id: "other-sess-001", audience: "public", background: { "public.responder": "some" }, every: 4 },
];
const A = { sessionId: FIRE[0]!.id, email: "anna.a@example.org", lang: "en" };
const B = { sessionId: MILITARY[0]!.id, email: "=bert+b@example.fi", lang: "fi" };

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "results-reports-"));
  logs = join(root, "sessions"); contacts = join(root, "contacts"); out = join(root, "out");
  await mkdir(logs); await mkdir(contacts);
  for (const s of SESSIONS) await writeFile(join(logs, `${s.id}.jsonl`), sessionFile(s));
  await writeFile(join(logs, `${FIRE[1]!.id}.partial.jsonl`), "not a finished file\n");
  const line = (o: unknown) => `${JSON.stringify({ ...(o as object), receivedAtIso: "2026-11-01T10:00:00.000Z" })}\n`;
  await writeFile(join(contacts, "contacts.jsonl"), [
    line({ ...A, email: "typo@example.org" }), line(B), line({ sessionId: "no-such-session", email: "c@example.org", lang: "en" }),
    "{broken\n", line({ sessionId: "open-sess-0001", email: "d@example.org", lang: "en" }), line(A), // A's corrected address: the last line wins
  ].join(""));
});
afterAll(async () => { await rm(root, { recursive: true, force: true }); });

async function generate(extra: readonly string[] = []): Promise<number> {
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  try { return await main(["--logs", logs, "--contacts", contacts, "--out", out, ...extra]); } finally { log.mockRestore(); }
}

describe("results:reports (SPEC/36 §3)", () => {
  it("writes one report per contact with a finished session, and the mailing list (CSV-safe); skips the rest", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await main(["--logs", logs, "--contacts", contacts, "--out", out])).toBe(0);
    const printed = log.mock.calls.flat().join("\n");
    log.mockRestore();
    expect(printed).toContain("2 report(s)");
    expect(printed).toContain("no report for session no-such-session: no finished session log");
    expect(printed).toContain("no report for session open-sess-0001: session not completed");
    expect(printed).toContain("1 malformed contact line(s)");
    expect(printed).not.toMatch(/@/); // the summary names sessions, never an address
    expect((await readdir(out)).sort()).toEqual([MAILING_LIST, reportFileName(A.sessionId), reportFileName(B.sessionId)].sort());
    const csv = await readFile(join(out, MAILING_LIST), "utf8");
    expect(csv).toBe(`email,report_file,lang\n${A.email},${reportFileName(A.sessionId)},en\n'${B.email},${reportFileName(B.sessionId)},fi\n`);
    expect(csvField('a"b,c')).toBe('"a""b,c"');
  });

  it("runs as the npm script does (`tsx tools/results/reports.ts`), and refuses missing arguments with the usage", async () => {
    const out2 = join(root, "out-cli");
    const run = (args: readonly string[]) => spawnSync(process.execPath, ["--import", "tsx", "tools/results/reports.ts", ...args], { encoding: "utf8", timeout: 60_000 });
    const ok = run(["--logs", logs, "--contacts", contacts, "--out", out2]);
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toContain("2 report(s)");
    expect(existsSync(join(out2, MAILING_LIST))).toBe(true);
    expect(existsSync(join(out2, reportFileName(A.sessionId)))).toBe(true);
    const bad = run(["--logs", logs]);
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain("usage: results:reports");
  }, 60_000);

  it("the report: in the contact's language, self-contained and print-friendly, the profile, the comparison, 2–4 tips, the notes", async () => {
    const html = await readFile(join(out, reportFileName(A.sessionId)), "utf8");
    const t = REPORT_TEXT.en;
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="en">');
    for (const s of [t.title, t.profileHeading, t.comparisonHeading, t.tipsHeading, t.groupLine(t.group.fire), t.privacy, t.expertPending]) expect(html).toContain(escapeHtml(s));
    expect(html).toContain("@media print");
    expect(html).not.toMatch(/<script|<link|\bsrc=|\bhref=|https?:\/\//i);
    // The band against the fire group (12 sessions ≥ the minimum): one of the calibration band texts.
    expect(Object.values(t.band.calibration).some((b) => html.includes(b))).toBe(true);
    expect(Object.values(t.band.checking).some((b) => html.includes(b))).toBe(true);
    const tips = html.match(/<li>/g) ?? [];
    expect(tips.length).toBeGreaterThanOrEqual(2);
    expect(tips.length).toBeLessThanOrEqual(4);
    expect(html).toContain(TIP_TEXT.en.ai_facts_only.title); // three fact questions, none open
    expect(html).toContain(t.reliability(0, 0).slice(0, 40));
  });

  it("a group under the minimum gets no band (the military group here has 3); the Finnish report", async () => {
    const html = await readFile(join(out, reportFileName(B.sessionId)), "utf8");
    expect(html).toContain('<html lang="fi">');
    expect(html).toContain(REPORT_TEXT.fi.tooFew);
    expect(html).toContain(REPORT_TEXT.fi.groupLine(REPORT_TEXT.fi.group.military));
    for (const band of Object.values(REPORT_TEXT.fi.band.calibration)) expect(html).not.toContain(band);
  });

  it("never: an item, a key, an exact score, an address, another participant's session id", async () => {
    for (const name of [reportFileName(A.sessionId), reportFileName(B.sessionId)]) {
      const html = await readFile(join(out, name), "utf8");
      const text = html.replace(/<style>[\s\S]*?<\/style>/, "");
      expect(leaks(text), name).toEqual([]);
      expect(text).not.toMatch(/\d+ ?%/);
      expect(text).not.toContain("@");
      for (const s of SESSIONS) expect(text).not.toContain(s.id);
    }
  });

  it("with an expert reference, the expert comparison replaces the pending line", async () => {
    const ref = join(root, "expert.json");
    await writeFile(ref, JSON.stringify({ calibrationGapPoints: 4, checkingShare: 0.9, hakuSearches: 12, guideQuestions: null, reviewChangeShare: null }));
    expect(await generate(["--expert-reference", ref])).toBe(0);
    const html = await readFile(join(out, reportFileName(A.sessionId)), "utf8");
    expect(html).not.toContain(REPORT_TEXT.en.expertPending);
    expect(Object.values(REPORT_TEXT.en.expert.calibration).some((s) => html.includes(escapeHtml(s)))).toBe(true);
    expect(html).toContain(escapeHtml(REPORT_TEXT.en.expert.checking.below)); // 0.9 checked by the experts; far fewer here
    await writeFile(ref, JSON.stringify({ calibrationGapPoints: "x" }));
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await generate(["--expert-reference", ref])).toBe(1);
    err.mockRestore();
  });

  it("purge: refused without --confirm-sent and while an address is not in the mailing list; then deletes the contacts and the list, never the logs", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const purge = (...flags: string[]) => main(["--purge", "--contacts", contacts, "--out", out, ...flags]);
    expect(await purge()).toBe(1);
    expect(await purge("--confirm-sent")).toBe(1); // c@ and d@ got no report
    expect(err.mock.calls.flat().join("\n")).toMatch(/2 contact\(s\) are not in mailing-list\.csv/);
    expect(existsSync(join(contacts, "contacts.jsonl"))).toBe(true);
    err.mockRestore();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await purge("--confirm-sent", "--include-unsent")).toBe(0);
    log.mockRestore();
    expect(await readdir(contacts)).toEqual([]);
    expect(existsSync(join(out, MAILING_LIST))).toBe(false);
    expect((await readdir(logs)).length).toBe(SESSIONS.length + 1);
  });
});

describe("the comparison rules", () => {
  it("background groups from the header and the post-session questionnaire", () => {
    const g = (audience: "expert" | "public", answers: Record<string, string>) => backgroundGroup({
      header: { ...header("radio"), audience },
      records: [{ seq: asSeq(0), tVirtual: 0 as never, tWallOffsetMs: 0, kind: "questionnaire_submitted", detail: { questionnaireId: "post", answers: Object.entries(answers).map(([itemId, value]) => ({ itemId, value })), dwellMs: 0 } }],
    });
    expect(g("expert", { "role.rank": "duty_chief" })).toBe("fire");
    expect(g("expert", {})).toBe("fire");
    expect(g("expert", { "role.rank": "other" })).toBe("other");
    expect(g("public", { "public.responder": "professional" })).toBe("military");
    expect(g("public", { "public.responder": "some" })).toBe("other");
  });

  it("only completed study sessions enter a pool", () => {
    const base = { header: { ...header("radio"), probeLevelsShown: false }, records: [{ seq: asSeq(0), tVirtual: 0 as never, tWallOffsetMs: 0, kind: "session_completed", detail: {} }] };
    expect(isCompletedStudySession(base)).toBe(true);
    expect(isCompletedStudySession({ ...base, header: { ...base.header, probeLevelsShown: true } })).toBe(false);
    expect(isCompletedStudySession({ ...base, header: { ...base.header, viewSkipAllowed: true } })).toBe(false);
    expect(isCompletedStudySession({ ...base, records: [] })).toBe(false);
  });

  it("mid-rank percentile bands: quarters, ties split, nothing under the minimum group", () => {
    const pool = Array.from({ length: 20 }, (_, i) => i);
    expect(percentileBand(0, pool)).toBe("low");
    expect(percentileBand(10, pool)).toBe("middle");
    expect(percentileBand(19, pool)).toBe("high");
    expect(percentileBand(5, Array.from({ length: 12 }, () => 5))).toBe("middle");
    expect(percentileBand(1, pool.slice(0, MIN_COMPARISON_GROUP - 1))).toBeNull();
  });
});
