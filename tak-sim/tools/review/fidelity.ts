/**
 * `npm run review:fidelity -- …` — the guardrail fidelity report (SPEC/14 revision (bf), SPEC/09 revision (bf), 24 Oct 2026); the pure
 * core is `fidelity-lib.ts`.
 *
 *   --logs <session.jsonl …> [--server-logs <thinker-log.jsonl …>] [--out <answers.csv>] [--report <fidelity.md>] [--include-practice]
 *       Reads the session log files (`fire-sim-session-jsonl/1`, `parseSessionFile`) and, when given, the Thinker server's per-session
 *       logs (`<THINKER_LOG_DIR>/<sessionId>.jsonl`, joined on session and question id), screens every Haku and Thinker answer against
 *       the frozen guardrails over the built scenario's records, and prints the per-group summary (the manipulation check). `--out`
 *       writes the per-answer table, `--report` the summary as Markdown. The output carries the participants' questions' ids, not
 *       their text; it is for the researcher, not the coders.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import type { AuditAtom } from "../../app/telemetry/haku-certainty-audit.js";
import { parseSessionFile } from "../skills/responses.js";
import { fidelityRows, rowsCsv, serverIndex, summaryMarkdown, type FidelityRow, type ServerLine } from "./fidelity-lib.js";

function argsAfter(argv: readonly string[], flag: string): string[] {
  const i = argv.indexOf(flag);
  if (i < 0) return [];
  const out: string[] = [];
  for (let j = i + 1; j < argv.length && !argv[j]!.startsWith("--"); j++) out.push(argv[j]!);
  return out;
}

/** The server log lines of the given files (one JSON object per line; blank and unreadable lines skipped). */
export function readServerLines(texts: readonly string[]): ServerLine[] {
  return texts.flatMap((text) => text.split("\n").flatMap((line) => {
    if (!line.trim()) return [];
    try {
      const o = JSON.parse(line) as Partial<ServerLine>;
      return typeof o.sessionId === "string" ? [o as ServerLine] : [];
    } catch { return []; }
  }));
}

/** Every session's rows over the scenario's records (`atoms`: the built scenario's by default). */
export function fidelityOf(sessionTexts: readonly string[], serverTexts: readonly string[] = [], opts: { readonly includePractice?: boolean; readonly atoms?: readonly AuditAtom[] } = {}): FidelityRow[] {
  const atoms = new Map((opts.atoms ?? (buildDemoScenario().atoms as unknown as readonly AuditAtom[])).map((a) => [a.id, a]));
  const server = serverIndex(readServerLines(serverTexts));
  return sessionTexts.flatMap((text) => fidelityRows(parseSessionFile(text), atoms, server, opts));
}

export function main(argv: readonly string[]): void {
  const logs = argsAfter(argv, "--logs");
  if (logs.length === 0) {
    process.stderr.write("usage: --logs <session.jsonl …> [--server-logs <thinker-log.jsonl …>] [--out <answers.csv>] [--report <fidelity.md>] [--include-practice]\n");
    process.exitCode = 2;
    return;
  }
  const read = (p: string) => readFileSync(resolve(p), "utf8");
  const rows = fidelityOf(logs.map(read), argsAfter(argv, "--server-logs").map(read), { includePractice: argv.includes("--include-practice") });
  const out = argsAfter(argv, "--out")[0], report = argsAfter(argv, "--report")[0];
  const md = summaryMarkdown(rows);
  if (out) writeFileSync(resolve(out), rowsCsv(rows));
  if (report) writeFileSync(resolve(report), md);
  process.stdout.write(md);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main(process.argv.slice(2));
