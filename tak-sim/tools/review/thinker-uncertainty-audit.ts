/**
 * `npm run review:uncertainty -- …` — the Thinker uncertainty audit (SPEC/32 §5, 20 Oct 2026); the pure core is
 * `app/telemetry/uncertainty-audit.ts`.
 *
 *   --logs <session.jsonl …> --out <sheet.csv> [--key <key.csv>] [--include-practice]
 *       Reads the session log files (`fire-sim-session-jsonl/1`, `parseSessionFile`), extracts every Thinker answer shown, marks
 *       hedging with the fi/en lexicon and writes the BLIND coding sheet (answer id, view, redacted text, stated certainty, empty
 *       `correct` and `coder`). `--key` writes the unblinding key (answer id → session id, participant, query id) for the researcher,
 *       never for the coders.
 *   --coded <sheet.csv>
 *       Reads a coded sheet and prints the AUROC of stated certainty (unhedged = 1) against correctness, with the counts.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { blindSheetCsv, certaintyAuroc, parseCodedSheet, thinkerAnswers, type ThinkerAnswerRow } from "../../app/telemetry/uncertainty-audit.js";
import { parseSessionFile } from "../skills/responses.js";

export interface AuditedSession {
  readonly sessionId: string;
  readonly participant: string;
  readonly rows: readonly ThinkerAnswerRow[];
}

/** The Thinker answers of each session file's text, the blind ids salted with its session id. */
export function auditSessions(texts: readonly string[], opts: { readonly includePractice?: boolean } = {}): AuditedSession[] {
  return texts.map((text) => {
    const { header, records } = parseSessionFile(text);
    return { sessionId: header.sessionId, participant: header.participantCode || header.sessionId, rows: thinkerAnswers(records, header.sessionId, opts) };
  });
}

/** The unblinding key as CSV, ordered by answer id. */
export function keyCsv(sessions: readonly AuditedSession[]): string {
  const rows = sessions.flatMap((s) => s.rows.map((r) => [r.blindId, s.sessionId, s.participant, r.queryId, r.hedgeTerms.join(";")]));
  rows.sort((a, b) => (a[0]! < b[0]! ? -1 : a[0]! > b[0]! ? 1 : 0));
  const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return `${["answer_id,session_id,participant,query_id,hedge_terms", ...rows.map((r) => r.map(cell).join(","))].join("\n")}\n`;
}

/** The AUROC report of a coded sheet. */
export function aurocReport(csv: string): string {
  const coded = parseCodedSheet(csv);
  const auroc = certaintyAuroc(coded);
  const count = (c: "hedged" | "unhedged", ok: boolean) => coded.filter((r) => r.statedCertainty === c && r.correct === ok).length;
  return [
    `coded answers: ${coded.length}`,
    `unhedged: ${count("unhedged", true)} correct, ${count("unhedged", false)} incorrect`,
    `hedged: ${count("hedged", true)} correct, ${count("hedged", false)} incorrect`,
    `AUROC (unhedged = 1 against correct): ${auroc === null ? "n/a (needs both correct and incorrect answers)" : auroc.toFixed(3)}`,
  ].join("\n");
}

function argsAfter(argv: readonly string[], flag: string): string[] {
  const i = argv.indexOf(flag);
  if (i < 0) return [];
  const out: string[] = [];
  for (let j = i + 1; j < argv.length && !argv[j]!.startsWith("--"); j++) out.push(argv[j]!);
  return out;
}

export function main(argv: readonly string[]): void {
  const coded = argsAfter(argv, "--coded")[0];
  if (coded) { process.stdout.write(`${aurocReport(readFileSync(resolve(coded), "utf8"))}\n`); return; }
  const logs = argsAfter(argv, "--logs"), out = argsAfter(argv, "--out")[0], key = argsAfter(argv, "--key")[0];
  if (logs.length === 0 || !out) {
    process.stderr.write("usage: --logs <session.jsonl …> --out <sheet.csv> [--key <key.csv>] [--include-practice] | --coded <sheet.csv>\n");
    process.exitCode = 2;
    return;
  }
  const sessions = auditSessions(logs.map((p) => readFileSync(resolve(p), "utf8")), { includePractice: argv.includes("--include-practice") });
  const rows = sessions.flatMap((s) => s.rows);
  writeFileSync(resolve(out), blindSheetCsv(rows));
  if (key) writeFileSync(resolve(key), keyCsv(sessions));
  const hedged = rows.filter((r) => r.statedCertainty === "hedged").length;
  process.stdout.write(`${sessions.length} sessions, ${rows.length} Thinker answers (${hedged} hedged) -> ${out}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main(process.argv.slice(2));
