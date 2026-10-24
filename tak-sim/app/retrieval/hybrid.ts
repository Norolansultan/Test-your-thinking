/**
 * Thinker's deterministic hybrid retrieval — SPEC/14 revision (q), pipeline step 2. Pure TypeScript
 * with no I/O, so the proxy (`server/thinker/`) and the browser's local fallback run the same code.
 *
 * - **Candidates** are the time-gated atoms (`time-gate.ts`): exactly what Haku can reach.
 * - **Lexical half:** BM25 over each record as the model sees it (source and text, {@link passageText};
 *   the authored `retrievalKeys` are not used — Thinker retrieves over the raw records). Tokens are
 *   lowercased; codes with a digit (`EK11`, `L3`, `TOIMINTA-2`, `110`) are kept whole, a Finnish
 *   case ending after a colon (`KY21:n`, `L1:lle`) is dropped, and every other word is cut to a
 *   fixed prefix ({@link PREFIX_STEM_LENGTH}) as a deterministic stand-in for stemming.
 * - **Vector half:** exact cosine (brute force) between the query vector and each candidate's frozen
 *   vector from the build-time index (`npm run thinker:index`). No approximate index.
 * - **Fusion:** each half is min-max normalised over the candidates and combined with the declared
 *   weights. Top-k is fixed; scores equal to {@link SCORE_DECIMALS} places are ties, broken newer
 *   observation first (the declared recency tie-break), then by atom id (I1).
 * - **Routine-line collapse** (1 Oct 2026, `routine-collapse.ts`): before scoring, each periodic
 *   family of logged or asked-for lines (same source, tier and labelled header, numbers masked)
 *   is reduced to its newest gated member. Families are found by structure, never by content.
 * - **Recency boost** (8 Oct 2026, D2(a), {@link HybridConfig.recencyBoost}): a small additive score for the
 *   newest candidate of each source and of each sector (a `L1`–`L4` code in its text), so the newest
 *   status of a unit outranks its older ones. Applied only to candidates the question already
 *   matched (a base score above 0); the tie-break below is unchanged.
 * - **Query-aware recency and the clock** (24 Oct 2026, the researcher's decision D10, SPEC/14
 *   revision D10; `query-cues.ts`): a question that asks for the latest state ("viimeisin", "uutta",
 *   "nyt", "latest", "now" …) adds a graded recency score among its relevant records
 *   ({@link LatestRecencyConfig}); a clock it names ("klo 17.24", "at 17:24") is matched against each
 *   record's clock ({@link ClockMatchConfig}), more strongly for a record of a source the question
 *   names, and exempts that minute's records from the routine collapse. The cue words and clocks used
 *   leave the LEXICAL query, so "17.24" no longer meets "17.24" in an unrelated record's text. The
 *   vector half and the embedded passage are unchanged.
 * - **Diversity** (optional, {@link HybridConfig.maxPerSource}): at most N records per source in
 *   top-k, taken in rank order. No other re-ranking.
 *
 * - **Language** (SPEC/14 revision (v), 5 Oct 2026): the retrieval language is the session's. In
 *   Finnish everything above is unchanged. In English the passage is the source and the record's
 *   English text (`recordIn`, {@link passageText}), the lexical half uses the English tokeniser
 *   ({@link EN_TOKENISER_RULE}), and the vector half uses a separate English index
 *   (`content/thinker/index.en.json`). The routine-line collapse is computed on the Finnish source
 *   text in both languages (the record's structure), so the same records compete in both. A
 *   language's index is never used with the other language's passages: each index file names its
 *   language, every lookup checks the passage hash in that language, and a mix is refused.
 *
 * Nothing here knows about any particular record (no rule mentions a designed event).
 */

import { compareStrings } from "../engine/deterministic-object.js";
import { hashString64 } from "../engine/prng.js";
import { recordIn, sourceName } from "../i18n/text.js";
import type { InfoAtom } from "../scenario/types.js";
import { clockAt, recordText } from "../session/template-answer.js";
import { queryCues } from "./query-cues.js";
import { collapseRoutine, type RoutineCollapseConfig } from "./routine-collapse.js";

/** The declared retrieval parameters (mirrored in `content/thinker/manifest.json`). */
export interface HybridConfig {
  readonly lexicalWeight: number;
  readonly vectorWeight: number;
  readonly topK: number;
  readonly bm25: { readonly k1: number; readonly b: number };
  /** Routine-line collapse before scoring; null scores every gated candidate. */
  readonly routineCollapse: RoutineCollapseConfig | null;
  /** At most this many records per source in top-k; null for no cap. */
  readonly maxPerSource: number | null;
  /**
   * Additive boost for the newest candidate of each source (`source`) and of each sector code its text
   * mentions (`sector`); null or absent: none. A candidate gets each boost at most once.
   */
  readonly recencyBoost?: RecencyBoostConfig | null;
  /** D10 (24 Oct 2026): the clock a question names matched against the record's clock; null or absent: none. */
  readonly clockMatch?: ClockMatchConfig | null;
}

export interface RecencyBoostConfig {
  readonly source: number;
  readonly sector: number;
  /** D10 (24 Oct 2026): the stronger preference when the question asks for the latest state; null or absent: none. */
  readonly latest?: LatestRecencyConfig | null;
}

/**
 * The latest-state preference (`query-cues.ts` decides when a question asks for it): every RELEVANT
 * candidate — a base score of at least `relevance` × the best base score — gets up to `graded` by its
 * observation time, linearly from 0 (the oldest relevant record) to `graded` (the newest). Added to
 * the ordinary boost, which still applies.
 */
export interface LatestRecencyConfig {
  readonly relevance: number;
  readonly graded: number;
}

/**
 * A record whose clock is within `nearMinutes` of a clock the question names gets `near`, and `namedSource`
 * more when the question also names its source ({@link namesSource}); within `farMinutes`, `far`.
 */
export interface ClockMatchConfig {
  readonly nearMinutes: number;
  readonly near: number;
  readonly namedSource: number;
  readonly farMinutes: number;
  readonly far: number;
}

/**
 * SPEC/14 revision (q): declared weights 0.5/0.5, top-k 8; BM25's textbook k1 and b. FROZEN
 * 2026-10-01: routine-line collapse (families spanning at least 3 steps), no per-source cap,
 * chosen by the neutral evaluation alone, re-run by the same declared rule on the final corpus (`npm run thinker:eval`; results in
 * `content/thinker/manifest.json`, retrieval.neutralEval). The designed items (SPEC/26 §5, F7) took no part in the choice.
 */
export const THINKER_RETRIEVAL_CONFIG: HybridConfig = {
  lexicalWeight: 0.5,
  vectorWeight: 0.5,
  topK: 8,
  bm25: { k1: 1.2, b: 0.75 },
  routineCollapse: { minDistinctSteps: 3 },
  maxPerSource: null,
  // 8 Oct 2026 (D2(a)): the newest record per source and per sector gets a small boost (fusion is on a 0-1 scale).
  // 24 Oct 2026 (D10): a question asking for the latest state adds up to 0.3 by recency among its relevant records.
  recencyBoost: { source: 0.05, sector: 0.03, latest: { relevance: 0.5, graded: 0.3 } },
  // 24 Oct 2026 (D10): a record at a clock the question names (±2 min; ±10 min weaker), more when it also names the source.
  clockMatch: { nearMinutes: 2, near: 0.5, namedSource: 0.5, farMinutes: 10, far: 0.15 },
};

/**
 * The English retrieval configuration (SPEC/14 revision (v)). PROVISIONAL until the researcher runs
 * the English neutral evaluation (`npm run thinker:eval -- --lang en --write`), which applies the
 * same candidates and the same selection rule; it starts as the Finnish one. If the rule selects
 * another candidate, this constant is changed to it in a dated amendment before the freeze is
 * recorded (the evaluation does not record "frozen" while they differ).
 */
export const THINKER_RETRIEVAL_CONFIG_EN: HybridConfig = THINKER_RETRIEVAL_CONFIG;

/** The retrieval language: the session's (`app/i18n/lang.ts`). */
export type RetrievalLang = "fi" | "en";

/** The declared configuration of a retrieval language. */
export function retrievalConfigOf(lang: RetrievalLang): HybridConfig {
  return lang === "en" ? THINKER_RETRIEVAL_CONFIG_EN : THINKER_RETRIEVAL_CONFIG;
}

/** Words (no digit) are cut to this many characters: a fixed prefix stem for Finnish inflection. */
export const PREFIX_STEM_LENGTH = 5;
/** Fused scores are compared, and logged, to this many decimal places. */
export const SCORE_DECIMALS = 6;
/** Stored vectors are rounded to this many decimals so the index file is byte-stable. */
export const VECTOR_DECIMALS = 6;

/**
 * An embedding model behind a fixed interface (SPEC/11 §7.9). The default is the local
 * multilingual-e5-small in `server/thinker/e5-embedder.ts`; tests use a deterministic stub.
 */
export interface Embedder {
  /** Identifies model, revision and settings; the index records it, and a mismatch is refused. */
  readonly id: string;
  embed(text: string, role: "query" | "passage"): Promise<readonly number[]>;
}

/** The frozen atom vectors (`content/thinker/index.json`; English: `index.en.json`). */
export interface VectorIndexFile {
  readonly embedderId: string;
  /** The passages' language; absent means Finnish (the Finnish index predates the field). */
  readonly language?: RetrievalLang;
  readonly dim: number;
  readonly precision: number;
  readonly atoms: readonly { readonly id: string; readonly textHash: string; readonly v: readonly number[] }[];
}

export interface VectorIndex {
  readonly embedderId: string;
  /** The language of the passages the vectors were built from. */
  readonly language: RetrievalLang;
  vectorOf(atom: InfoAtom): readonly number[];
}

export class StaleIndexError extends Error {
  constructor(readonly atomId: string, reason: string) {
    super(`Thinker index is stale for atom "${atomId}" (${reason}); run \`npm run thinker:index\``);
    this.name = "StaleIndexError";
  }
}

/**
 * What is embedded and lexically indexed: the source, then the text — the Finnish record, or in
 * English the record's English text (`app/i18n/text.ts`; the Finnish where a record has none).
 * Unchanged by D10 (24 Oct 2026), so the frozen vectors' passage hashes stay valid: the lexical half's
 * two further fields, the record's clock ({@link recordClockMinutes}) and its source's shown name
 * ({@link namesSource}), are matched by the clock rule only and are not part of the passage.
 */
export function passageText(atom: InfoAtom, lang: RetrievalLang = "fi"): string {
  const fi = recordText(atom.record);
  return `${atom.provenance.sourceId}: ${lang === "en" ? recordIn("en", atom.id, fi) : fi}`;
}

/** FNV-1a 64 of the passage text, so a changed record is caught against the frozen index. */
export function passageHash(atom: InfoAtom, lang: RetrievalLang = "fi"): string {
  return hashString64(passageText(atom, lang)).toString(16).padStart(16, "0");
}

const SECTOR_CODE = /\bL[1-4]\b/g;

/** Newer observation first, then the larger id: the same total order as the ranking's tie-break. */
function isNewer(a: InfoAtom, b: InfoAtom): boolean {
  return a.provenance.observedAt !== b.provenance.observedAt ? a.provenance.observedAt > b.provenance.observedAt : compareStrings(a.id, b.id) > 0;
}

/** The recency boost of each candidate (by position): the newest of its source and the newest of each sector it names. */
export function recencyBoosts(candidates: readonly InfoAtom[], boost: RecencyBoostConfig): number[] {
  const newestOfSource = new Map<string, number>();
  const newestOfSector = new Map<string, number>();
  const sectorsOf = candidates.map((a) => [...new Set(recordText(a.record).match(SECTOR_CODE) ?? [])]);
  const consider = (map: Map<string, number>, key: string, i: number) => {
    const held = map.get(key);
    if (held === undefined || isNewer(candidates[i]!, candidates[held]!)) map.set(key, i);
  };
  candidates.forEach((a, i) => {
    consider(newestOfSource, a.provenance.sourceId, i);
    for (const sec of sectorsOf[i]!) consider(newestOfSector, sec, i);
  });
  const out = candidates.map(() => 0);
  for (const i of newestOfSource.values()) out[i]! += boost.source;
  const sectorWinners = new Set<number>();
  for (const i of newestOfSector.values()) sectorWinners.add(i);
  for (const i of sectorWinners) out[i]! += boost.sector;
  return out;
}

/** The latest-state preference ({@link LatestRecencyConfig}) of each candidate (by position), from the base scores. */
export function latestBoosts(candidates: readonly InfoAtom[], base: readonly number[], latest: LatestRecencyConfig): number[] {
  const top = Math.max(0, ...base);
  const relevant = base.map((b) => top > 0 && b > 0 && b >= latest.relevance * top);
  const times = candidates.filter((_, i) => relevant[i]).map((a) => a.provenance.observedAt);
  const lo = Math.min(...times);
  const hi = Math.max(...times);
  return candidates.map((a, i) => (relevant[i] && hi > lo ? (latest.graded * (a.provenance.observedAt - lo)) / (hi - lo) : 0));
}

/** A record's clock as Haku and the model show it (`clockAt`, floored to the minute), in minutes after midnight. */
export function recordClockMinutes(atom: InfoAtom): number {
  const [h, m] = clockAt(atom.provenance.observedAt).split(".").map(Number) as [number, number];
  return h * 60 + m;
}

/**
 * Whether the question's lexical tokens name the record's source as Haku shows it in the session
 * language (`sourceName`: "VPK", "Sääasema", "Water supply", "Volunteer fire brigade VOL1"):
 * every word of the shown name, or a code in it ("VOL1", "EK11"). The shown name, not the id, so the
 * Finnish verb "saa" does not name the weather station (SAA).
 */
export function namesSource(queryTokens: ReadonlySet<string>, sourceId: string, lang: RetrievalLang): boolean {
  const shown = tokenise(sourceName(lang, sourceId), lang);
  const words = shown.filter((t) => !/\p{N}/u.test(t));
  return (words.length > 0 && words.every((t) => queryTokens.has(t))) || shown.some((t) => /\p{N}/u.test(t) && queryTokens.has(t));
}

/** The clock match of each candidate: the nearest of the question's clocks decides ({@link ClockMatchConfig}). */
export function clockBoosts(candidates: readonly InfoAtom[], clocks: readonly number[], match: ClockMatchConfig, lexicalQuery: string, lang: RetrievalLang): number[] {
  const queryTokens = new Set(tokenise(lexicalQuery, lang));
  const named = new Map<string, boolean>();
  return candidates.map((a) => {
    if (clocks.length === 0) return 0;
    const t = recordClockMinutes(a);
    const d = Math.min(...clocks.map((c) => Math.abs(t - c)));
    if (d > match.farMinutes) return 0;
    if (d > match.nearMinutes) return match.far;
    const id = a.provenance.sourceId;
    if (!named.has(id)) named.set(id, namesSource(queryTokens, id, lang));
    return match.near + (named.get(id) ? match.namedSource : 0);
  });
}

export function roundTo(x: number, decimals: number): number {
  const f = 10 ** decimals;
  const r = Math.round(x * f) / f;
  return r === 0 ? 0 : r; // no negative zero in the file
}

export function roundVector(v: readonly number[], decimals = VECTOR_DECIMALS): number[] {
  return v.map((x) => roundTo(x, decimals));
}

/**
 * Wraps the index file; every lookup checks the atom's passage, in the file's language, against the
 * hash it was built from.
 */
export function vectorIndexOf(file: VectorIndexFile): VectorIndex {
  const byId = new Map(file.atoms.map((a) => [a.id, a] as const));
  const language = file.language ?? "fi";
  return {
    embedderId: file.embedderId,
    language,
    vectorOf(atom) {
      const entry = byId.get(atom.id);
      if (!entry) throw new StaleIndexError(atom.id, "no vector");
      if (entry.textHash !== passageHash(atom, language)) throw new StaleIndexError(atom.id, "text changed");
      return entry.v;
    },
  };
}

// --- lexical half ---------------------------------------------------------------------------------

const TOKEN = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu;

/** The Finnish tokeniser's declared id. */
export const FI_TOKENISER_ID = "fi-prefix5-v1";
/** The English tokeniser's declared id (manifest `retrievalEn.lexical`; SPEC/14 revision (v)). */
export const EN_TOKENISER_ID = "en-sstem-prefix5-v1";
/** The English tokeniser, as declared in the manifest and SPEC/14 revision (v). */
export const EN_TOKENISER_RULE =
  "lowercase; an English possessive ('s or \u2019s, or a bare apostrophe after s) is dropped; a code's case ending after a colon is dropped (as in Finnish); " +
  "tokens are runs of letters and digits joined by inner hyphens; a token with a digit (EK11, L3, TOIMINTA-2, 110) is kept whole; " +
  "every other word is reduced by Harman's S-stemmer (ies->y unless eies/aies; es->e unless aes/ees/oes; s->'' unless us/ss) " +
  `and then cut to its first ${PREFIX_STEM_LENGTH} characters (the Finnish prefix rule)`;

/** Lowercased tokens in the language's tokeniser. Finnish: codes kept whole, words cut to the prefix stem. */
export function tokenise(text: string, lang: RetrievalLang = "fi"): string[] {
  if (lang === "en") return tokeniseEn(text);
  const lowered = text.toLowerCase().replace(/([\p{L}\p{N}]*\p{N}[\p{L}\p{N}]*):\p{L}+/gu, "$1");
  const out: string[] = [];
  for (const m of lowered.matchAll(TOKEN)) {
    const t = m[0];
    out.push(/\p{N}/u.test(t) ? t : t.slice(0, PREFIX_STEM_LENGTH));
  }
  return out;
}

/** Harman's (1991) S-stemmer: English plural endings only; deterministic. */
export function sStem(word: string): string {
  if (word.endsWith("ies") && !word.endsWith("eies") && !word.endsWith("aies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("es") && !word.endsWith("aes") && !word.endsWith("ees") && !word.endsWith("oes")) return word.slice(0, -1);
  if (word.endsWith("s") && !word.endsWith("us") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** The English tokeniser ({@link EN_TOKENISER_RULE}). */
export function tokeniseEn(text: string): string[] {
  const lowered = text
    .toLowerCase()
    .replace(/([\p{L}\p{N}])['\u2019]s(?![\p{L}\p{N}])/gu, "$1")
    .replace(/s['\u2019](?![\p{L}\p{N}])/gu, "s")
    .replace(/([\p{L}\p{N}]*\p{N}[\p{L}\p{N}]*):\p{L}+/gu, "$1");
  const out: string[] = [];
  for (const m of lowered.matchAll(TOKEN)) {
    const t = m[0];
    out.push(/\p{N}/u.test(t) ? t : sStem(t).slice(0, PREFIX_STEM_LENGTH));
  }
  return out;
}

/** Okapi BM25 of `query` against each document, in document order, with the language's tokeniser. */
export function bm25Scores(query: string, documents: readonly string[], params: HybridConfig["bm25"], lang: RetrievalLang = "fi"): number[] {
  const docs = documents.map((d) => tokenise(d, lang));
  const n = docs.length;
  if (n === 0) return [];
  const avgdl = docs.reduce((s, d) => s + d.length, 0) / n || 1;
  const terms = [...new Set(tokenise(query, lang))];
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  return docs.map((d) => {
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const t of terms) {
      const f = tf.get(t);
      if (!f) continue;
      const nt = df.get(t)!;
      const idf = Math.log(1 + (n - nt + 0.5) / (nt + 0.5));
      score += (idf * f * (params.k1 + 1)) / (f + params.k1 * (1 - params.b + (params.b * d.length) / avgdl));
    }
    return score;
  });
}

// --- vector half ----------------------------------------------------------------------------------

export function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) throw new RangeError(`vector length mismatch: ${a.length} vs ${b.length}`);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

// --- fusion ---------------------------------------------------------------------------------------

function minMax(xs: readonly number[]): number[] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of xs) {
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  return xs.map((x) => (hi > lo ? (x - lo) / (hi - lo) : 0));
}

export interface RetrievedRecord {
  readonly atom: InfoAtom;
  /** The fused score, rounded to {@link SCORE_DECIMALS}. */
  readonly score: number;
}

/**
 * The vector half's inputs; null runs the lexical half alone (the browser's local fallback). The
 * index must be in the retrieval language: {@link hybridRetrieve} refuses a mix.
 */
export interface VectorQuery {
  readonly queryVector: readonly number[];
  readonly index: VectorIndex;
}

/**
 * Ranks the time-gated candidates (`gated`) for `query` and returns the top k (references into
 * `gated`, I6). With a routine collapse configured, only each routine family's newest member is
 * scored; normalisation and BM25 statistics are over the scored set. Candidates with a fused
 * score of 0 are dropped. With `vector` null only the lexical half runs, at full weight.
 *
 * `lang` is the retrieval language (passages and tokeniser); `config` defaults to that language's
 * declared configuration. The routine collapse is computed on the Finnish structure in both.
 */
export function hybridRetrieve(
  query: string,
  gated: readonly InfoAtom[],
  vector: VectorQuery | null,
  config?: HybridConfig,
  lang: RetrievalLang = "fi",
): RetrievedRecord[] {
  const cfg = config ?? retrievalConfigOf(lang);
  if (vector && vector.index.language !== lang) {
    throw new RangeError(`a ${vector.index.language} vector index cannot serve ${lang} retrieval (no mixing; SPEC/14 revision (v))`);
  }
  // D10: what the question says about time; a rule the configuration does not declare changes nothing.
  const cues = queryCues(query, lang, { latest: Boolean(cfg.recencyBoost?.latest), clocks: Boolean(cfg.clockMatch) });
  const clocks = cfg.clockMatch ? cues.clocks : [];
  const collapsed = cfg.routineCollapse ? collapseRoutine(gated, cfg.routineCollapse) : gated;
  // A record at a clock the question names is exempt from the routine collapse: it was asked for by its time.
  const candidates = clocks.length > 0 && collapsed !== gated ? withRecordsAtClock(gated, collapsed, clocks, cfg.clockMatch!.nearMinutes) : collapsed;
  const lexical = minMax(bm25Scores(cues.lexicalQuery, candidates.map((a) => passageText(a, lang)), cfg.bm25, lang));
  const dense = vector ? minMax(candidates.map((a) => cosine(vector.queryVector, vector.index.vectorOf(a)))) : null;
  const base = candidates.map((_, i) => (dense ? cfg.lexicalWeight * lexical[i]! + cfg.vectorWeight * dense[i]! : lexical[i]!));
  const clockScore = cfg.clockMatch && clocks.length > 0 ? clockBoosts(candidates, clocks, cfg.clockMatch, cues.lexicalQuery, lang) : null;
  // A record the question matched: by its words or meaning (a base score above 0), or by its clock.
  const matched = base.map((b, i) => b > 0 || (clockScore !== null && clockScore[i]! > 0));
  const boosts = cfg.recencyBoost ? recencyBoosts(candidates, cfg.recencyBoost) : null;
  const latest = cfg.recencyBoost?.latest && cues.latest ? latestBoosts(candidates, base, cfg.recencyBoost.latest) : null;
  const scored = candidates.map((atom, i) => {
    const extra = matched[i] ? (boosts?.[i] ?? 0) + (latest?.[i] ?? 0) + (clockScore?.[i] ?? 0) : 0;
    return { atom, score: roundTo(base[i]! + extra, SCORE_DECIMALS) };
  });
  const ranked = scored
    .filter((s) => s.score > 0)
    .sort((a, b) =>
      b.score !== a.score
        ? b.score - a.score
        : a.atom.provenance.observedAt !== b.atom.provenance.observedAt
          ? b.atom.provenance.observedAt - a.atom.provenance.observedAt
          : compareStrings(a.atom.id, b.atom.id),
    );
  return cfg.maxPerSource === null ? ranked.slice(0, cfg.topK) : capPerSource(ranked, cfg.maxPerSource, cfg.topK);
}

/** The collapsed candidates plus every gated record within `minutes` of a named clock, in the gated order. */
function withRecordsAtClock(gated: readonly InfoAtom[], collapsed: readonly InfoAtom[], clocks: readonly number[], minutes: number): InfoAtom[] {
  const kept = new Set(collapsed);
  return gated.filter((a) => kept.has(a) || clocks.some((c) => Math.abs(recordClockMinutes(a) - c) <= minutes));
}

/** The first `topK` of `ranked`, skipping any record whose source already has `max` in the list. */
export function capPerSource(ranked: readonly RetrievedRecord[], max: number, topK: number): RetrievedRecord[] {
  const out: RetrievedRecord[] = [];
  const perSource = new Map<string, number>();
  for (const r of ranked) {
    if (out.length >= topK) break;
    const n = perSource.get(r.atom.provenance.sourceId) ?? 0;
    if (n >= max) continue;
    perSource.set(r.atom.provenance.sourceId, n + 1);
    out.push(r);
  }
  return out;
}
