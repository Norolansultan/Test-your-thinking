/**
 * The guardrail fidelity report (SPEC/14 revision (bf), SPEC/09 revision (bf), 24 Oct 2026): the pure core of `npm run review:fidelity`
 * (`tools/review/fidelity.ts`). Over session logs, for every Haku and Thinker answer, whether its wording and its citations kept the
 * frozen rules both groups' tools run under — the manipulation check that the two arms differ in the AI's role and nothing else
 * (Haku: find and summarise; the guide: connect, ask back, assess, never enforce). Deterministic: the guardrails' own screens
 * (`server/thinker/answer-checks.ts`), the scenario's records and lexicons; no model, no clock, no randomness.
 *
 * Per answer (`FidelityRow`), from the browser log (`ai_chat_answer_received`; its question's `ai_chat_query_submitted` for `viaChip`):
 * - **imperatives and recommendations** in the shown text, by the server's screen in both languages (an answer may quote a record in
 *   the other one): `imperativeSentences` (a statement with "must / should / immediately / cease", "täytyy / pitäisi / kannattaa /
 *   heti / lopeta", or any sentence that recommends; a question to the commander is none) and `recommendations` (the "I recommend /
 *   suosittelen" sentences alone). Both tools are screened alike: the Thinker's prompt forbids them (rules 4 and 6), Haku's role
 *   (find and summarise) leaves no room for them.
 * - **citations**: the clock times the answer cites (`citedTimes`: Haku's basis field, the Thinker's bracketed citations);
 *   `unmatchedCitations`, cited times that are no record's the model was given (a citation of a missing record); `futureCitations`,
 *   cited times later than every record reachable when the question was asked (a record the participant could not have had);
 *   `gateViolations`, records given to the model that were not yet reachable then (the time gate, `time-gate.ts`; must be 0);
 *   `uncited`, a shown answer that cites nothing.
 * - **length**: words of the shown text.
 * - **certainty**: Haku's stated level (`hakuCertaintyLevel`) and `certainBreach` — "certain" where Haku's rules 3 and 5 forbid it (the
 *   cited records contradict each other, or the answer says the records hold nothing on it); the Thinker's hedging (the SPEC/32 lexicon).
 * - **verdicts**: the Thinker's per-option verdicts as logged; with the server log, `downgraded` (a "departure justifiable" the
 *   server turned into "departs" because no premise was contradicted) and `imperativeRemoved` (sentences the server cut).
 * - **refusals and fallbacks**: `fallback`, `fallbackReason` (`refusal`, `client_timeout`, …) and, with the server log,
 *   `refusalCategory`. A Thinker fallback is shown as "unavailable" (`shown` false) and is not screened; Haku's fallback is the
 *   template over the records, shown and screened.
 * The summary (`summarise`) gives the same per group and tool, and per session.
 */

import { hedgeTerms } from "../../app/telemetry/uncertainty-audit.js";
import { answerGrounds, citedTimes, givenAtomIds, hakuCertaintyLevel, type AuditAtom, type StatedLevel } from "../../app/telemetry/haku-certainty-audit.js";
import type { LogHeader, LogRecord } from "../../app/telemetry/log.js";
import type { AiChatAnswerReceivedDetail, AiChatQuerySubmittedDetail } from "../../app/telemetry/record-kinds.js";
import { clockAt } from "../../app/session/template-answer.js";
import { STEP_SECONDS } from "../../app/scenario/views.js";
import { isRecommendationSentence, isImperativeSentence, sentencesOf } from "../../server/thinker/answer-checks.js";

export type FidelityTool = "haku" | "thinker";

/** What the Thinker server logged for an answer (`server/thinker/handler.ts`), joined on session and question id. */
export interface ServerLine {
  readonly sessionId: string;
  readonly queryId: string | null;
  readonly trimmed?: readonly string[];
  readonly refusalCategory?: string | null;
  readonly imperativeWords?: readonly string[];
}

export interface FidelityRow {
  readonly sessionId: string;
  readonly participant: string;
  readonly cell: string;
  readonly view: number;
  readonly tool: FidelityTool;
  readonly queryId: string;
  readonly viaChip: boolean;
  readonly shown: boolean;
  readonly fallback: boolean;
  readonly fallbackReason: string | null;
  readonly words: number;
  readonly imperativeSentences: number;
  readonly recommendations: number;
  readonly citedTimes: number;
  readonly unmatchedCitations: number;
  readonly futureCitations: number;
  readonly gateViolations: number;
  readonly uncited: boolean;
  /** Haku: its stated level; the Thinker: `hedged` / `unhedged`. */
  readonly certainty: StatedLevel | "hedged" | "unhedged";
  readonly certainBreach: "" | "conflict" | "absence";
  readonly verdicts: readonly string[];
  /** Null: no server line joined. */
  readonly downgraded: boolean | null;
  readonly imperativeRemoved: boolean | null;
  readonly refusalCategory: string | null;
}

const words = (text: string) => text.trim().split(/\s+/).filter((w) => w.length > 0).length;

/** The sentences of a text that are instructions or recommendations, in either language (a sentence counted once). */
function screen(text: string): { imperative: number; recommends: number } {
  let imperative = 0, recommends = 0;
  for (const s of sentencesOf(text)) {
    if (isRecommendationSentence(s, "en") || isRecommendationSentence(s, "fi")) recommends++;
    // The server's own test: a recommendation, or a statement (not a question) with a forbidden word.
    if (isImperativeSentence(s, "en") || isImperativeSentence(s, "fi")) imperative++;
  }
  return { imperative, recommends };
}

/** Haku's absence claims ("the records hold nothing on it"): rule 3 forbids "certain" with them. A lexicon screen. */
const ABSENCE = /(?<![\p{L}])(?:no\s+(?:record|report|mention)s?|(?:do|does)\s+not\s+(?:mention|contain|say)|contain\s+no|nothing\s+(?:in|about)|ei\s+(?:mainita|ole\s+tietoa|ilmoituksia|tietueita|kirjauksia)|ei\s+löydy|tietueissa\s+ei)/iu;

/** Minutes since 13:20 (virtual 0) of an "hh.mm" clock on the scenario's day; negative before it (the practice view's records). */
const minutesOf = (hhmm: string) => { const [h, m] = hhmm.split(".").map(Number) as [number, number]; return h * 60 + m - (13 * 60 + 20); };

export interface FidelityInput {
  readonly header: Pick<LogHeader, "sessionId" | "participantCode" | "cell">;
  readonly records: readonly LogRecord[];
}

/** The rows of one session, in log order (the practice view left out unless asked for). */
export function fidelityRows(
  session: FidelityInput, atoms: ReadonlyMap<string, AuditAtom>, server: ReadonlyMap<string, ServerLine> = new Map(), opts: { readonly includePractice?: boolean } = {},
): FidelityRow[] {
  const { header, records } = session;
  const chip = new Set(records.filter((r) => r.kind === "ai_chat_query_submitted" && (r.detail as AiChatQuerySubmittedDetail).viaChip).map((r) => (r.detail as AiChatQuerySubmittedDetail).queryId));
  const all = [...atoms.values()];
  const releaseS = (a: AuditAtom) => (a.cycle - 1) * STEP_SECONDS;
  return records.flatMap((r): FidelityRow[] => {
    if (r.kind !== "ai_chat_answer_received") return [];
    const d = r.detail as AiChatAnswerReceivedDetail;
    if (d.view === 0 && opts.includePractice !== true) return [];
    const tool: FidelityTool = d.tool === "haku" ? "haku" : "thinker";
    const shown = !(tool === "thinker" && d.fallback);
    const a = d.answer;
    const text = tool === "haku" ? [a.vastaus, a.perusteet, a.varmuus, a.muuttaisi].filter((x) => x).join("\n") : a.vastaus;
    const given = givenAtomIds(d).map((id) => atoms.get(id)).filter((x): x is AuditAtom => x !== undefined);
    const reachable = all.filter((x) => releaseS(x) <= d.virtualTimeS);
    const upTo = reachable.length === 0 ? -1 : Math.max(...reachable.map((x) => x.provenance.observedAt));
    const times = shown ? citedTimes(tool, a) : [];
    const givenTimes = new Set(given.map((x) => clockAt(x.provenance.observedAt)));
    const { imperative, recommends } = shown ? screen(text) : { imperative: 0, recommends: 0 };
    const grounds = answerGrounds(d, tool, atoms);
    const level = tool === "haku" ? hakuCertaintyLevel(a.varmuus) : hedgeTerms(text).length > 0 ? "hedged" : "unhedged";
    const breach = tool === "haku" && level === "certain" ? (grounds.conflict ? "conflict" : ABSENCE.test(`${a.vastaus}\n${a.varmuus}`) ? "absence" : "") : "";
    const line = server.get(`${header.sessionId}|${d.queryId}`);
    return [{
      sessionId: header.sessionId, participant: header.participantCode || header.sessionId, cell: header.cell, view: d.view, tool, queryId: d.queryId,
      viaChip: chip.has(d.queryId), shown, fallback: d.fallback, fallbackReason: d.fallbackReason ?? null, words: shown ? words(text) : 0,
      imperativeSentences: imperative, recommendations: recommends, citedTimes: times.length,
      unmatchedCitations: times.filter((t) => !givenTimes.has(t)).length,
      futureCitations: upTo < 0 ? 0 : times.filter((t) => minutesOf(t) * 60 > upTo).length,
      gateViolations: given.filter((x) => releaseS(x) > d.virtualTimeS).length,
      uncited: shown && times.length === 0, certainty: level, certainBreach: breach,
      verdicts: (d.aiVerdictsExact ?? d.aiVerdicts?.map((v) => v.verdict) ?? []).map(String),
      downgraded: line ? (line.trimmed ?? []).includes("justified_without_contradicted_premise") : null,
      imperativeRemoved: line ? (line.trimmed ?? []).includes("imperative_removed") : null,
      refusalCategory: line?.refusalCategory ?? null,
    }];
  });
}

/** Server log lines keyed by session and question id (the later line wins for a repeated id). */
export function serverIndex(lines: readonly ServerLine[]): Map<string, ServerLine> {
  const out = new Map<string, ServerLine>();
  for (const l of lines) if (l.queryId) out.set(`${l.sessionId}|${l.queryId}`, l);
  return out;
}

export const ROW_COLUMNS = [
  "session_id", "participant", "cell", "view", "tool", "query_id", "via_chip", "shown", "fallback", "fallback_reason", "words", "imperative_sentences",
  "recommendations", "cited_times", "unmatched_citations", "future_citations", "gate_violations", "uncited", "certainty", "certain_breach", "verdicts",
  "downgraded", "imperative_removed", "refusal_category",
] as const;

const csvCell = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join(";") : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The per-answer table as CSV, in the rows' order. */
export function rowsCsv(rows: readonly FidelityRow[]): string {
  const lines = [ROW_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push([r.sessionId, r.participant, r.cell, r.view, r.tool, r.queryId, r.viaChip, r.shown, r.fallback, r.fallbackReason, r.words, r.imperativeSentences,
      r.recommendations, r.citedTimes, r.unmatchedCitations, r.futureCitations, r.gateViolations, r.uncited, r.certainty, r.certainBreach, r.verdicts,
      r.downgraded, r.imperativeRemoved, r.refusalCategory].map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export interface GroupSummary {
  readonly cell: string;
  readonly tool: FidelityTool;
  readonly sessions: number;
  readonly answers: number;
  readonly viaChip: number;
  readonly shown: number;
  readonly fallbacks: number;
  readonly refusals: number;
  readonly medianWords: number | null;
  readonly meanWords: number | null;
  readonly withImperative: number;
  readonly withRecommendation: number;
  readonly withUnmatched: number;
  readonly withFuture: number;
  readonly gateViolations: number;
  readonly uncited: number;
  readonly certain: number;
  readonly certainBreaches: number;
  readonly hedged: number;
  readonly downgraded: number | null;
  readonly imperativeRemoved: number | null;
}

const median = (xs: readonly number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};

/** Per group (cell) and tool, in a fixed order (Haku group first, then the guide, then the demonstration cell). */
export function summarise(rows: readonly FidelityRow[]): GroupSummary[] {
  const order = ["radio", "reasoning_intent", "reasoning_once"];
  const keys = [...new Set(rows.map((r) => `${r.cell}|${r.tool}`))].sort((a, b) => {
    const [ca, ta] = a.split("|") as [string, string], [cb, tb] = b.split("|") as [string, string];
    const oa = order.indexOf(ca), ob = order.indexOf(cb);
    return (oa < 0 ? 99 : oa) - (ob < 0 ? 99 : ob) || ca.localeCompare(cb) || (ta === "haku" ? -1 : 1) - (tb === "haku" ? -1 : 1);
  });
  return keys.map((k) => {
    const [cell, tool] = k.split("|") as [string, FidelityTool];
    const rs = rows.filter((r) => r.cell === cell && r.tool === tool);
    const shown = rs.filter((r) => r.shown);
    const joined = rs.filter((r) => r.downgraded !== null);
    const count = (f: (r: FidelityRow) => boolean) => rs.filter(f).length;
    return {
      cell, tool, sessions: new Set(rs.map((r) => r.sessionId)).size, answers: rs.length, viaChip: count((r) => r.viaChip), shown: shown.length,
      fallbacks: count((r) => r.fallback), refusals: count((r) => r.fallbackReason === "refusal"),
      medianWords: median(shown.map((r) => r.words)), meanWords: shown.length ? shown.reduce((s, r) => s + r.words, 0) / shown.length : null,
      withImperative: count((r) => r.imperativeSentences > 0), withRecommendation: count((r) => r.recommendations > 0),
      withUnmatched: count((r) => r.unmatchedCitations > 0), withFuture: count((r) => r.futureCitations > 0),
      gateViolations: rs.reduce((s, r) => s + r.gateViolations, 0), uncited: count((r) => r.uncited),
      certain: count((r) => r.certainty === "certain"), certainBreaches: count((r) => r.certainBreach !== ""), hedged: count((r) => r.certainty === "hedged"),
      downgraded: joined.length ? joined.filter((r) => r.downgraded).length : null,
      imperativeRemoved: joined.length ? joined.filter((r) => r.imperativeRemoved).length : null,
    };
  });
}

const pct = (n: number, of: number) => (of === 0 ? "—" : `${n} (${((100 * n) / of).toFixed(0)} %)`);
const GROUP = (cell: string) => (cell === "radio" ? "Haku group" : cell === "reasoning_intent" ? "guide group" : cell);

/** The summary as Markdown: one table per group × tool, then each session's counts. */
export function summaryMarkdown(rows: readonly FidelityRow[]): string {
  const groups = summarise(rows);
  const out = [
    "# Guardrail fidelity report", "",
    `${new Set(rows.map((r) => r.sessionId)).size} sessions, ${rows.length} answers. Counts are answers (percentages of the shown answers where a screen applies).`, "",
    "| Group · tool | Sessions | Answers (chip) | Shown | Fallbacks (refusals) | Words, median · mean | Imperative or recommending | Recommending | Unmatched citation | Future citation | Gate violations | Uncited | Haku certain (breach) | Thinker hedged | Downgraded verdicts | Imperatives cut |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const g of groups) {
    const s = g.shown;
    out.push(`| ${GROUP(g.cell)} · ${g.tool} | ${g.sessions} | ${g.answers} (${g.viaChip}) | ${g.shown} | ${g.fallbacks} (${g.refusals}) | ${g.medianWords ?? "—"} · ${g.meanWords === null ? "—" : g.meanWords.toFixed(1)} | ${pct(g.withImperative, s)} | ${pct(g.withRecommendation, s)} | ${pct(g.withUnmatched, s)} | ${pct(g.withFuture, s)} | ${g.gateViolations} | ${pct(g.uncited, s)} | ${g.tool === "haku" ? `${pct(g.certain, s)} (${g.certainBreaches})` : "—"} | ${g.tool === "thinker" ? pct(g.hedged, s) : "—"} | ${g.downgraded ?? "n/a"} | ${g.imperativeRemoved ?? "n/a"} |`);
  }
  out.push("", "## Per session", "", "| Session | Participant | Group | Tool | Answers | Imperative | Unmatched | Future | Gate | Fallbacks |", "|---|---|---|---|---|---|---|---|---|---|");
  const sessions = [...new Set(rows.map((r) => `${r.sessionId}|${r.tool}`))];
  for (const k of sessions) {
    const rs = rows.filter((r) => `${r.sessionId}|${r.tool}` === k);
    const r0 = rs[0]!;
    const n = (f: (r: FidelityRow) => boolean) => rs.filter(f).length;
    out.push(`| ${r0.sessionId} | ${r0.participant} | ${GROUP(r0.cell)} | ${r0.tool} | ${rs.length} | ${n((r) => r.imperativeSentences > 0)} | ${n((r) => r.unmatchedCitations > 0)} | ${n((r) => r.futureCitations > 0)} | ${rs.reduce((s, r) => s + r.gateViolations, 0)} | ${n((r) => r.fallback)} |`);
  }
  out.push("", "Downgraded verdicts and cut imperatives need the Thinker server's log (`--server-logs`); \"n/a\" without it. Every screen is a wording or time check, not a judgement of the answer's correctness.", "");
  return out.join("\n");
}
