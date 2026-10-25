/**
 * The play-test's Haku questions as retrieval cases (SPEC/14 revision D10, 24 Oct 2026), as pure
 * functions: `docs/audits/2026-10-23-playtest/haku.csv` holds 56 natural questions from two LLM
 * play-testers (Finnish and English), each with the record that came back and, where one exists, the
 * record that should have. A case is a question with an identifiable right record: the top record of
 * a "hit", else the `should_have_returned` ids ("a / b": either counts). Gaps without a record ("—")
 * are not cases. The question is gated at the step its screen clock falls in (the play harness's
 * gate, `reachableAtoms`), in the run's language. Used by `eval-playtest.ts` and the D10 tests.
 *
 * The cases are the development set for D10 (its parameters were chosen on them); the neutral
 * evaluation and the authored questions are the checks.
 */

import { readFileSync } from "node:fs";
import { THINKER_RETRIEVAL_CONFIG, type HybridConfig, type RetrievalLang } from "../../app/retrieval/hybrid.js";
import { repoPath } from "../../server/thinker/config.js";

export const PLAYTEST_HAKU_FILE = "docs/audits/2026-10-23-playtest/haku.csv";
/**
 * The replay's Haku questions (analysis §10, 24 Oct 2026), in `haku.csv`'s layout: the HELD-OUT set. Nothing was chosen on it;
 * SPEC/14 revision (bi) (B5, 25 Oct 2026) reports it beside the development set.
 */
export const PLAYTEST_REPLAY_HAKU_FILE = "docs/audits/2026-10-23-playtest/haku-replay.csv";

/** One play-test question with the record(s) that should come first. */
export interface PlaytestCase {
  /** "K23" (commander-fi, question 23) or "L15" (business-en, question 15). */
  readonly id: string;
  readonly lang: RetrievalLang;
  /** The screen clock when it was asked ("17.20"). */
  readonly clock: string;
  /** The gate: the step the clock falls in (13:20 starts step 1; 12:00 is the practice view's step −3). */
  readonly step: number;
  readonly question: string;
  readonly judgement: string;
  /** Any of these first is right. */
  readonly targets: readonly string[];
}

/** RFC 4180 CSV (quoted fields, doubled quotes), as the audit writes it. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endField = () => {
    row.push(field);
    field = "";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted && c === '"' && text[i + 1] === '"') {
      field += '"';
      i++;
    } else if (c === '"') quoted = !quoted;
    else if (quoted || (c !== "," && c !== "\n" && c !== "\r")) field += c;
    else if (c === ",") endField();
    else if (c === "\n") {
      endField();
      rows.push(row);
      row = [];
    }
  }
  if (field !== "" || row.length > 0) {
    endField();
    rows.push(row);
  }
  return rows;
}

/** The step a screen clock ("17.20" or "12:00") falls in: virtual 0 is 13:20, a step is 20 minutes (`app/scenario/views.ts`). */
export function stepOfClock(clock: string): number {
  const [h, m] = clock.split(/[.:]/).map(Number) as [number, number];
  return Math.floor(((h * 60 + m - (13 * 60 + 20)) * 60) / 1200) + 1;
}

/** The cases of the CSV text. */
export function playtestCases(csv: string): PlaytestCase[] {
  const [head, ...rows] = parseCsv(csv);
  const col = (r: readonly string[], k: string) => r[head!.indexOf(k)] ?? "";
  const out: PlaytestCase[] = [];
  for (const r of rows) {
    if (r.length < head!.length) continue;
    const judgement = col(r, "judgement");
    const targets = judgement === "hit" ? [col(r, "top_record")] : col(r, "should_have_returned").split("/").map((x) => x.trim()).filter((x) => x !== "" && x !== "—");
    if (targets.length === 0) continue;
    const run = col(r, "run");
    out.push({
      id: `${run.startsWith("commander") ? "K" : "L"}${col(r, "n")}`,
      lang: run.endsWith("-en") ? "en" : "fi",
      clock: col(r, "clock"),
      step: stepOfClock(col(r, "clock")),
      question: col(r, "question"),
      judgement,
      targets,
    });
  }
  return out;
}

export function loadPlaytestCases(file: string = PLAYTEST_HAKU_FILE): PlaytestCase[] {
  return playtestCases(readFileSync(repoPath(file), "utf8"));
}

/** The declared configuration with D10 taken out (the retrieval before 24 Oct 2026): the "before" of the evaluation. */
export function withoutD10(config: HybridConfig = THINKER_RETRIEVAL_CONFIG): HybridConfig {
  const { latest: _latest, ...boost } = config.recencyBoost ?? { source: 0, sector: 0 };
  return { ...config, recencyBoost: config.recencyBoost ? boost : null, clockMatch: null };
}

/** The 1-based rank of the first target in a ranked id list; 0 when none is ranked. */
export function bestRank(rankedIds: readonly string[], targets: readonly string[]): number {
  const i = rankedIds.findIndex((id) => targets.includes(id));
  return i + 1;
}

/** Top-1, top-3, top-k counts and MRR@k over ranks (0 = absent). */
export function rankSummary(ranks: readonly number[], k: number): { readonly n: number; readonly top1: number; readonly top3: number; readonly topK: number; readonly mrrAtK: number } {
  const hit = (r: number, n: number) => r > 0 && r <= n;
  const mrr = ranks.reduce((s, r) => s + (hit(r, k) ? 1 / r : 0), 0) / (ranks.length || 1);
  return { n: ranks.length, top1: ranks.filter((r) => hit(r, 1)).length, top3: ranks.filter((r) => hit(r, 3)).length, topK: ranks.filter((r) => hit(r, k)).length, mrrAtK: Math.round(mrr * 1e4) / 1e4 };
}
