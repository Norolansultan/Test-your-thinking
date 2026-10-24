/**
 * Haku's stated certainty audited against what it rests on (SPEC/32 §5, extended 24 Oct 2026, SPEC/09 revision (bf)): the pure core of
 * `npm run review:uncertainty -- --haku …` (`tools/review/thinker-uncertainty-audit.ts`), shared with the fidelity report
 * (`tools/review/fidelity-lib.ts`). Analysis only, never called at runtime and never stored (SPEC/07 §1).
 *
 * - **The stated level** is Haku's `varmuus` field, read by its first level word (the prompt's four, `prompt.{fi,en}.md` rule 6):
 *   certain / varma, probable / todennäköinen, uncertain / epävarma, not known / ei tiedossa — at the start of a word, so "uncertain"
 *   is never "certain" and "epävarma" never "varma"; the earliest word wins ("probable (two reports)"). Nothing found: `unparsed`.
 * - **The records it rests on** are the records the model was given (`retrieved` ∪ `recentAtomIds` ∪ `digestAtomIds`) whose clock
 *   time the answer cites — in Haku's `perusteet` (basis: "KY21 at 16.35", "KY21 klo 16.35"), in the Thinker's bracketed citations
 *   ("[T2, 15.40]"). Their certainty is the scenario's `provenance.certainty` (confirmed 3, probable 2, uncertain 1, unknown 0); the
 *   answer's record level is the weakest of them. `overstated`: the stated level ranks above it. `conflict`: two of them contradict each
 *   other (`provenance.contradicts`), where the prompt forbids "certain" (rule 5).
 * - **What it touches**: the planted record (H9, `DESIGNED_EVENT_IDS.planted`) — `cited`, `given` (in the model's context, not cited) or
 *   `no`; the spread projection — the question or the answer names it (fi "leviämisennuste…", en "projection", "projected"; a weather
 *   forecast is not the projection); and a scripted AI error — the projection named in a view whose projection is wrong (the canonical
 *   flag sequence: `breach_quantitative` or `breach_categorical`).
 * - **The report** (`certaintyReport`) is by group (the Haku group's Haku answers; the guide group's Haku and Thinker answers): Haku's
 *   level distribution, how many answers rest on cited records and how many overstate them, "certain" despite a conflict; and, for both
 *   tools, the certainty (Haku: share "certain", mean level; the Thinker: share hedged) by what the answer touched.
 * Deterministic: lexicons and the scenario's data only.
 */

import { CANONICAL_FLAG_SEQUENCE, DESIGNED_EVENT_IDS } from "../scenario/types.js";
import { clockAt } from "../session/template-answer.js";
import type { AiChatAnswerReceivedDetail } from "./record-kinds.js";

export type HakuCertaintyLevel = "certain" | "probable" | "uncertain" | "not_known";
export type StatedLevel = HakuCertaintyLevel | "unparsed";
export const LEVEL_RANK: Readonly<Record<HakuCertaintyLevel, number>> = { not_known: 0, uncertain: 1, probable: 2, certain: 3 };
const RECORD_RANK = { unknown: 0, uncertain: 1, probable: 2, confirmed: 3 } as const;
const RANK_LEVEL: readonly HakuCertaintyLevel[] = ["not_known", "uncertain", "probable", "certain"];

const W = "(?<![\\p{L}\\p{N}])";
const LEVEL_WORDS: readonly { readonly level: HakuCertaintyLevel; readonly re: RegExp }[] = [
  { level: "not_known", re: new RegExp(`${W}(?:not\\s+known|unknown|ei\\s+tiedossa|ei\\s+tiedetä|tuntematon)`, "iu") },
  { level: "uncertain", re: new RegExp(`${W}(?:uncertain|epävarm)`, "iu") },
  { level: "probable", re: new RegExp(`${W}(?:probabl|likely|todennäköi)`, "iu") },
  { level: "certain", re: new RegExp(`${W}(?:certain|varma)`, "iu") },
];

/** Haku's stated level from its `varmuus` text: the earliest level word (see the module note), else `unparsed`. */
export function hakuCertaintyLevel(varmuus: string): StatedLevel {
  let best: { level: HakuCertaintyLevel; at: number } | null = null;
  for (const { level, re } of LEVEL_WORDS) {
    const m = re.exec(varmuus);
    if (m && (best === null || m.index < best.at)) best = { level, at: m.index };
  }
  return best?.level ?? "unparsed";
}

/** The scenario's view of a record the audit needs (an `InfoAtom` fits). */
export interface AuditAtom {
  readonly id: string;
  /** Its world-state step: reachable from step `cycle` on. */
  readonly cycle: number;
  readonly provenance: {
    readonly observedAt: number;
    readonly certainty: { readonly kind: keyof typeof RECORD_RANK };
    readonly contradicts: readonly string[];
  };
}

const TIME = /(?<!\d)(\d{1,2})[.:](\d{2})(?!\d)/g;
const BRACKET_CITATION = /\[([^[\]]*\bT\d{1,3}\b[^[\]]*)\]/g;

/** The clock times an answer cites, "hh.mm", in order and without repeats: Haku's basis field, the Thinker's bracketed citations. */
export function citedTimes(tool: "haku" | "thinker", answer: AiChatAnswerReceivedDetail["answer"]): string[] {
  const sources = tool === "haku" ? [answer.perusteet] : [...answer.vastaus.matchAll(BRACKET_CITATION)].map((m) => m[1]!);
  const out: string[] = [];
  for (const s of sources) for (const m of s.matchAll(TIME)) {
    const t = `${m[1]!.padStart(2, "0")}.${m[2]}`;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

/** The record ids the model was given with an answer: retrieved, then the recent matches and the digest (browser log 0.11.0). */
export function givenAtomIds(d: Pick<AiChatAnswerReceivedDetail, "retrieved" | "recentAtomIds" | "digestAtomIds">): string[] {
  const ids = [...d.retrieved.map((r) => r.id), ...(d.recentAtomIds ?? []), ...(d.digestAtomIds ?? [])];
  return ids.filter((id, i) => ids.indexOf(id) === i);
}

const PROJECTION = new RegExp(`${W}(?:leviämisennust|projection|projected)`, "iu");

/** The question or the answer names the spread projection (see the module note). */
export function mentionsProjection(question: string, answerText: string): boolean {
  return PROJECTION.test(question) || PROJECTION.test(answerText);
}

/** The view's projection is wrong by the scripted schedule (V1–V14; the practice view and unknown views: false). */
export function projectionWrongIn(view: number): boolean {
  const flag = CANONICAL_FLAG_SEQUENCE[view - 1];
  return view >= 1 && flag !== undefined && flag !== "holds";
}

export interface AnswerGrounds {
  /** Given records whose clock time the answer cites. */
  readonly basisAtomIds: readonly string[];
  /** The weakest certainty among them (null: none cited, or none matched). */
  readonly recordLevel: HakuCertaintyLevel | null;
  readonly conflict: boolean;
  readonly planted: "cited" | "given" | "no";
  readonly projection: boolean;
  readonly aiError: boolean;
}

/** What an answer rests on and touches, from its log detail and the scenario's records. */
export function answerGrounds(d: AiChatAnswerReceivedDetail, tool: "haku" | "thinker", atoms: ReadonlyMap<string, AuditAtom>): AnswerGrounds {
  const given = givenAtomIds(d).map((id) => atoms.get(id)).filter((a): a is AuditAtom => a !== undefined);
  const times = new Set(citedTimes(tool, d.answer));
  const basis = given.filter((a) => times.has(clockAt(a.provenance.observedAt)));
  const rank = basis.length === 0 ? null : Math.min(...basis.map((a) => RECORD_RANK[a.provenance.certainty.kind]));
  const ids = new Set(basis.map((a) => a.id));
  const conflict = basis.some((a) => a.provenance.contradicts.some((c) => ids.has(c)));
  const plantedId = DESIGNED_EVENT_IDS.planted;
  const planted = ids.has(plantedId) ? "cited" : given.some((a) => a.id === plantedId) ? "given" : "no";
  const text = [d.answer.vastaus, d.answer.perusteet, d.answer.varmuus, d.answer.muuttaisi].join("\n");
  const projection = mentionsProjection(d.text, text);
  return {
    basisAtomIds: basis.map((a) => a.id), recordLevel: rank === null ? null : RANK_LEVEL[rank]!, conflict, planted,
    projection, aiError: projection && projectionWrongIn(d.view),
  };
}

/** The stated level ranks above the weakest record it rests on (false when either is unknown to the audit). */
export function overstated(stated: StatedLevel, recordLevel: HakuCertaintyLevel | null): boolean {
  return stated !== "unparsed" && recordLevel !== null && LEVEL_RANK[stated] > LEVEL_RANK[recordLevel];
}

// ---- Rows and the report by group -----------------------------------------------------------------

/** One answer of either tool, audited: its stated certainty (Haku's level, the Thinker's hedging) and its grounds. */
export interface CertaintyAuditRow extends AnswerGrounds {
  readonly sessionId: string;
  readonly participant: string;
  readonly cell: string;
  readonly view: number;
  readonly queryId: string;
  readonly tool: "haku" | "thinker";
  readonly fallback: boolean;
  /** Haku: its level; the Thinker: `hedged` / `unhedged` (the SPEC/32 lexicon, `uncertainty-audit.ts`). */
  readonly stated: StatedLevel | "hedged" | "unhedged";
  readonly overstated: boolean;
  /** Haku said "certain" over cited records that contradict each other (its rule 5). */
  readonly certainDespiteConflict: boolean;
}

/**
 * Every Haku and Thinker answer of one session (the practice view left out unless asked for). A Thinker fallback ("unavailable") is
 * left out; Haku's fallback is the template, shown, and kept (`fallback` true). `hedged` reads the Thinker's text (`hedgeOf`).
 */
export function certaintyAuditRows(
  records: readonly { readonly kind: string; readonly detail: unknown }[], meta: { readonly sessionId: string; readonly participant: string; readonly cell: string },
  atoms: ReadonlyMap<string, AuditAtom>, hedgeOf: (text: string) => boolean, opts: { readonly includePractice?: boolean } = {},
): CertaintyAuditRow[] {
  return records.flatMap((r): CertaintyAuditRow[] => {
    if (r.kind !== "ai_chat_answer_received") return [];
    const d = r.detail as AiChatAnswerReceivedDetail;
    const tool = d.tool === "haku" ? "haku" : "thinker";
    if ((tool === "thinker" && d.fallback) || (d.view === 0 && opts.includePractice !== true)) return [];
    const g = answerGrounds(d, tool, atoms);
    const stated = tool === "haku" ? hakuCertaintyLevel(d.answer.varmuus) : hedgeOf(d.answer.vastaus) ? "hedged" : "unhedged";
    return [{
      ...meta, view: d.view, queryId: d.queryId, tool, fallback: d.fallback, stated, ...g,
      overstated: tool === "haku" && overstated(stated as StatedLevel, g.recordLevel), certainDespiteConflict: stated === "certain" && g.conflict,
    }];
  });
}

const GROUP_NAME = (cell: string) => (cell === "radio" ? "Haku group" : cell === "reasoning_intent" ? "guide group" : cell);
const ORDER = (cell: string) => { const i = ["radio", "reasoning_intent", "reasoning_once"].indexOf(cell); return i < 0 ? 99 : i; };
const share = (n: number, of: number) => (of === 0 ? "—" : `${((100 * n) / of).toFixed(0)} %`);

/** The touches the report splits by, in order, with their test on a row. */
const TOUCHES: readonly { readonly label: string; readonly is: (r: CertaintyAuditRow) => boolean }[] = [
  { label: "planted record cited (H9)", is: (r) => r.planted === "cited" },
  { label: "planted record given, not cited", is: (r) => r.planted === "given" },
  { label: "projection named, wrong-projection view (scripted AI error)", is: (r) => r.aiError },
  { label: "projection named, projection right", is: (r) => r.projection && !r.aiError },
  { label: "none of these", is: (r) => r.planted === "no" && !r.projection },
];

/** The report by group (Markdown): Haku's stated level and its grounds; Haku's and the Thinker's certainty by what the answer touched. */
export function certaintyReport(rows: readonly CertaintyAuditRow[]): string {
  const cells = [...new Set(rows.map((r) => r.cell))].sort((a, b) => ORDER(a) - ORDER(b) || a.localeCompare(b));
  const out = [
    "# Certainty audit: Haku's stated certainty and the Thinker's hedging", "",
    "## Haku's stated level against the records it cites", "",
    "| Group | Haku answers | certain | probable | uncertain | not known | unparsed | rests on cited records | overstated | certain despite conflict |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const cell of cells) {
    const h = rows.filter((r) => r.cell === cell && r.tool === "haku");
    const n = (f: (r: CertaintyAuditRow) => boolean) => h.filter(f).length;
    const lv = (l: StatedLevel) => `${n((r) => r.stated === l)} (${share(n((r) => r.stated === l), h.length)})`;
    const grounded = h.filter((r) => r.recordLevel !== null);
    out.push(`| ${GROUP_NAME(cell)} | ${h.length} | ${lv("certain")} | ${lv("probable")} | ${lv("uncertain")} | ${lv("not_known")} | ${lv("unparsed")} | ${grounded.length} | ${n((r) => r.overstated)} (${share(n((r) => r.overstated), grounded.length)}) | ${n((r) => r.certainDespiteConflict)} |`);
  }
  out.push("", "## By what the answer touched", "", "| Group | Tool | Touched | Answers | Haku: certain · mean level (0–3) | Thinker: hedged |", "|---|---|---|---|---|---|");
  for (const cell of cells) for (const tool of ["haku", "thinker"] as const) {
    const t = rows.filter((r) => r.cell === cell && r.tool === tool);
    if (t.length === 0) continue;
    for (const touch of TOUCHES) {
      const s = t.filter(touch.is);
      const ranks = s.flatMap((r) => (r.stated in LEVEL_RANK ? [LEVEL_RANK[r.stated as HakuCertaintyLevel]] : []));
      const haku = tool === "haku" ? `${share(s.filter((r) => r.stated === "certain").length, s.length)} · ${ranks.length ? (ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(2) : "—"}` : "—";
      const thinker = tool === "thinker" ? share(s.filter((r) => r.stated === "hedged").length, s.length) : "—";
      out.push(`| ${GROUP_NAME(cell)} | ${tool} | ${touch.label} | ${s.length} | ${haku} | ${thinker} |`);
    }
  }
  out.push("", "The touch rows overlap (an answer may cite the planted record and name the projection). Descriptive only: the levels are wording, the record certainty the scenario's, and no row is a judgement of the answer's correctness (the coded sheet's AUROC is).", "");
  return out.join("\n");
}

export const CERTAINTY_COLUMNS = [
  "session_id", "participant", "cell", "view", "tool", "query_id", "fallback", "stated", "record_level", "overstated", "conflict", "certain_despite_conflict",
  "planted", "projection", "ai_error", "basis_atom_ids",
] as const;

/** The per-answer rows as CSV (for the researcher: it carries session ids). */
export function certaintyRowsCsv(rows: readonly CertaintyAuditRow[]): string {
  const cell = (v: unknown) => { const s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join(";") : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [CERTAINTY_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push([r.sessionId, r.participant, r.cell, r.view, r.tool, r.queryId, r.fallback, r.stated, r.recordLevel, r.overstated, r.conflict, r.certainDespiteConflict,
      r.planted, r.projection, r.aiError, r.basisAtomIds].map(cell).join(","));
  }
  return `${lines.join("\n")}\n`;
}
