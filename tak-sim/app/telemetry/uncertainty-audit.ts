/**
 * The Thinker's own calibration (SPEC/32 §5, 20 Oct 2026): the pure core of `tools/review/thinker-uncertainty-audit.ts`. Analysis only,
 * never called at runtime and never stored (SPEC/07 §1).
 *
 * - **The answers** are every Thinker answer that reached the screen with text (`shownAnswers`: `ai_chat_answer_received` with `tool`
 *   other than `haku`, not a fallback — a fallback shows "unavailable"), the practice view (VP) left out unless asked for.
 * - **Hedging** is a lexicon match, case-insensitive, at the start of a word with any ending (Finnish inflects: "epävarmaa", "arviolta",
 *   "todennäköisesti"; English "estimated", "maybe" from "may"); a two-word entry matches with any whitespace between its words. The
 *   lexicon is SPEC/32's: fi epävarma, ehkä, todennäköisesti, mahdollisesti, ei varmaa, arvio, saattaa, voi olla; en uncertain,
 *   likely, possibly, may, might, probably, unclear, estimate. Both languages are applied to every answer (an answer may quote a
 *   record in the other language). A word that merely contains a term ("unlikely", "tilannearvio") does not match: the lexicon is
 *   applied as given, and its misses are the coders' to note. `statedCertainty` is `hedged` with any match, else `unhedged`.
 * - **The blind sheet** has one row per answer: a blind id (a hash of the salt and the query id, as `chat-coding.ts`), the view, the
 *   text with the tools' names redacted (`redactToolNames`), `statedCertainty`, and empty `correct` and `coder` columns, ordered by
 *   blind id, not by the log. The coders judge each answer's correctness against the scenario's records.
 * - **AUROC** of stated certainty (unhedged = 1, hedged = 0) against correctness: the probability that a correct answer scores higher
 *   than an incorrect one, ties counted half (the Mann–Whitney form). With a binary score it equals (TPR + TNR) / 2. Rows whose
 *   `correct` is blank or unreadable are left out; null without both a correct and an incorrect answer.
 */

import { redactToolNames } from "./chat-coding.js";
import { shownAnswers } from "./ai-stated-key.js";
import type { LogRecord } from "./log.js";
import type { AiChatAnswerReceivedDetail } from "./record-kinds.js";
import { sha256Hex } from "./sha256.js";
import { PRACTICE_VIEW_INDEX } from "../scenario/views.js";

export const HEDGE_LEXICON: { readonly fi: readonly string[]; readonly en: readonly string[] } = {
  fi: ["epävarma", "ehkä", "todennäköisesti", "mahdollisesti", "ei varmaa", "arvio", "saattaa", "voi olla"],
  en: ["uncertain", "likely", "possibly", "may", "might", "probably", "unclear", "estimate"],
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const HEDGE_RES: readonly { readonly term: string; readonly re: RegExp }[] = [...HEDGE_LEXICON.fi, ...HEDGE_LEXICON.en].map((term) => ({
  term, re: new RegExp(`(?<![\\p{L}\\p{N}])${term.split(/\s+/).map(escapeRe).join("\\s+")}`, "iu"),
}));

export type StatedCertainty = "hedged" | "unhedged";

/** The lexicon terms found in a text, in lexicon order (fi, then en). */
export function hedgeTerms(text: string): string[] {
  return HEDGE_RES.filter((h) => h.re.test(text)).map((h) => h.term);
}

export function statedCertainty(text: string): StatedCertainty {
  return hedgeTerms(text).length > 0 ? "hedged" : "unhedged";
}

export interface ThinkerAnswerRow {
  readonly blindId: string;
  readonly queryId: string;
  readonly view: number;
  readonly text: string;
  readonly statedCertainty: StatedCertainty;
  readonly hedgeTerms: readonly string[];
}

/** Every Thinker answer shown, in log order; `salt` (the session id) makes the blind ids unique across sessions. */
export function thinkerAnswers(records: readonly LogRecord[], salt: string, opts: { readonly includePractice?: boolean } = {}): ThinkerAnswerRow[] {
  const querySeq = new Map<number, string>();
  for (const r of records) if (r.kind === "ai_chat_answer_received") querySeq.set(r.seq as number, (r.detail as AiChatAnswerReceivedDetail).queryId);
  return shownAnswers(records)
    .filter((a) => a.tool === "thinker" && (opts.includePractice === true || a.view !== PRACTICE_VIEW_INDEX))
    .map((a) => {
      const queryId = querySeq.get(a.seq)!;
      const terms = hedgeTerms(a.text);
      return {
        blindId: `T${sha256Hex(`${salt}|${queryId}`).slice(0, 12)}`, queryId, view: a.view, text: a.text,
        statedCertainty: terms.length > 0 ? "hedged" : "unhedged", hedgeTerms: terms,
      };
    });
}

export const SHEET_COLUMNS = ["answer_id", "view", "text", "stated_certainty", "correct", "coder"] as const;

const csvCell = (v: string | number): string => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The blind coding sheet as CSV (a header line, then one row per answer ordered by blind id; `correct` and `coder` left empty). */
export function blindSheetCsv(rows: readonly ThinkerAnswerRow[]): string {
  const sorted = [...rows].sort((a, b) => (a.blindId < b.blindId ? -1 : a.blindId > b.blindId ? 1 : 0));
  const lines = [SHEET_COLUMNS.join(",")];
  for (const r of sorted) lines.push([r.blindId, r.view, redactToolNames(r.text), r.statedCertainty, "", ""].map(csvCell).join(","));
  return `${lines.join("\n")}\n`;
}

/** A minimal RFC 4180 reader: quoted fields may hold commas, doubled quotes and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

export interface CodedRow {
  readonly answerId: string;
  readonly statedCertainty: StatedCertainty;
  readonly correct: boolean;
  readonly coder: string;
}

const CORRECT_TRUE = ["1", "true", "yes", "kyllä", "correct", "oikein"];
const CORRECT_FALSE = ["0", "false", "no", "ei", "incorrect", "väärin"];

/** The coded sheet's rows that carry a readable `correct` (1/0, true/false, yes/no, kyllä/ei, correct/incorrect, oikein/väärin). */
export function parseCodedSheet(csv: string): CodedRow[] {
  const [header, ...body] = parseCsv(csv);
  if (!header) return [];
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const id = col("answer_id"), certainty = col("stated_certainty"), correct = col("correct"), coder = col("coder");
  if (id < 0 || certainty < 0 || correct < 0) throw new Error("coded sheet: needs the columns answer_id, stated_certainty and correct");
  return body.flatMap((r) => {
    const c = (r[correct] ?? "").trim().toLowerCase();
    const sc = (r[certainty] ?? "").trim();
    const value = CORRECT_TRUE.includes(c) ? true : CORRECT_FALSE.includes(c) ? false : null;
    if (value === null || (sc !== "hedged" && sc !== "unhedged")) return [];
    return [{ answerId: r[id] ?? "", statedCertainty: sc, correct: value, coder: coder < 0 ? "" : (r[coder] ?? "").trim() }];
  });
}

/** AUROC of stated certainty (unhedged = 1) against correctness; null without both a correct and an incorrect answer. */
export function certaintyAuroc(rows: readonly { readonly statedCertainty: StatedCertainty; readonly correct: boolean }[]): number | null {
  const score = (r: { readonly statedCertainty: StatedCertainty }) => (r.statedCertainty === "unhedged" ? 1 : 0);
  const pos = rows.filter((r) => r.correct).map(score), neg = rows.filter((r) => !r.correct).map(score);
  if (pos.length === 0 || neg.length === 0) return null;
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}
