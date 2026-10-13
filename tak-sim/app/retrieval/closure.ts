/**
 * Retrieval closure — invariant I6 (SPEC/00_README.md §3): "The query
 * subsystem can only return authored corpus content. It is structurally
 * incapable of generating text. There is no language model in the
 * instrument." SPEC/05 §7: "The retrieval function's return type is
 * `readonly InfoAtom[]`, drawn from the loaded corpus. There is no code
 * path that constructs a novel string from atom content."
 *
 * `RetrievalFunction`'s return type is the static half of the guard — it
 * cannot return `string`, only `readonly InfoAtom[]`, so a caller
 * literally cannot receive generated prose from it. `assertClosedOverCorpus`
 * is the runtime half: every returned atom must be the *same object
 * reference* as one already in the corpus array, never a copy or a
 * synthesised object that merely looks like one.
 *
 * `retrieveClosed` is a closed, deterministic *baseline* — sparse
 * token-overlap ranking over `retrievalKeys`, ties broken by atom id
 * (I1). It is not the hybrid sparse+dense engine SPEC/14 §5 specifies
 * (BM25 fused with embedding similarity); that needs an embedding model
 * choice SPEC/11 §7.1 lists as still open. What's here is real and
 * closed, and satisfies I6 regardless of what ranking algorithm
 * eventually replaces it — closure is a property of the *type*, not the
 * ranking quality.
 *
 * English sessions (SPEC/14 revision (v), 5 Oct 2026): `retrieveClosedEn` ranks the same way over
 * keys drawn from the record's English text and the codes ({@link englishKeysOf}); the Finnish
 * search (`retrieveClosed`) keeps the authored keys. `retrieveClosedIn(lang)` picks by session language.
 *
 * Finnish prefix stem (researcher decision, 7 Oct 2026): the Finnish search cuts every word token
 * of the query and of the keys to Thinker's fixed prefix ({@link PREFIX_STEM_LENGTH}, `hybrid.ts`);
 * codes (a token with a digit) stay whole. Inflected forms then meet ("pohjoisreunalla" and
 * "pohjoisreuna"), as the English keys do through whole English words.
 *
 * Precision (fix pass 3, 7 Oct 2026): a long word (a compound, {@link FINNISH_LONG_WORD} letters or
 * more) keeps a longer stem ({@link FINNISH_LONG_STEM}), so "pohjoisreuna" no longer meets every
 * "pohjoi-" word; and records are ranked first by the query's words found whole in their keys, then
 * by the stem and gradation matches, then by id.
 */

import { compareStrings } from "../engine/deterministic-object.js";
import { recordIn } from "../i18n/text.js";
import { PREFIX_STEM_LENGTH } from "./hybrid.js";
import type { InfoAtom } from "../scenario/types.js";
import { recordText } from "../session/template-answer.js";

export type RetrievalFunction = (query: string, corpus: readonly InfoAtom[]) => readonly InfoAtom[];

export class RetrievalClosureViolationError extends Error {
  constructor(readonly offendingAtomId: string) {
    super(`Retrieval result contains an atom not present by reference in the corpus (id "${offendingAtomId}") — closure violated (I6)`);
    this.name = "RetrievalClosureViolationError";
  }
}

/** Throws if any result is not the same object reference as one already in `corpus`. */
export function assertClosedOverCorpus(results: readonly InfoAtom[], corpus: readonly InfoAtom[]): void {
  const corpusByReference = new Set(corpus);
  for (const atom of results) {
    if (!corpusByReference.has(atom)) {
      throw new RetrievalClosureViolationError(atom.id);
    }
  }
}

function normaliseToken(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** An English possessive (`EK11's`, `units'`) is not part of the word (English Haku only). */
function dropPossessive(s: string): string {
  return s.replace(/['\u2019]s$/u, "").replace(/(s)['\u2019]$/u, "$1");
}

function tokenise(text: string): string[] {
  return text
    .split(/\s+/)
    .map(normaliseToken)
    .filter((t) => t.length > 0);
}

/**
 * Consonant gradation (fix pass 2, 7 Oct 2026): the prefix stems of the inflected forms whose stem
 * changes (vesi : veden, vettä; kärki : kärjen, kärkeen; tie : tien; suo : suon), each mapped to its
 * base form, applied to query and keys alike. Authored from the retrieval keys; a stem that also
 * begins another word ("suost-uttelu", "tiedon") is left out.
 */
export const HAKU_FI_GRADATION_STEMS: ReadonlyMap<string, string> = new Map([
  ["veden", "vesi"], ["vedet", "vesi"], ["vedes", "vesi"], ["vedel", "vesi"], ["vettä", "vesi"],
  ["kärje", "kärki"], ["kärke", "kärki"],
  ["tien", "tie"], ["tiell", "tie"], ["tiele", "tie"], ["tiest", "tie"], ["tietä", "tie"],
  ["suon", "suo"], ["suoll", "suo"], ["suole", "suo"], ["suota", "suo"],
]);

/** A word this long is taken as a compound and keeps {@link FINNISH_LONG_STEM} letters. */
export const FINNISH_LONG_WORD = 10;
/** The stem of a long word: its first part and the start of the second, room left for a case ending. */
export const FINNISH_LONG_STEM = 8;

/** A Finnish word token cut to its prefix stem and read through the gradation table; a code (a token with a digit) is kept whole. */
function prefixStem(t: string): string {
  if (/\p{N}/u.test(t)) return t;
  if (t.length >= FINNISH_LONG_WORD) return t.slice(0, FINNISH_LONG_STEM);
  const stem = t.slice(0, PREFIX_STEM_LENGTH);
  return HAKU_FI_GRADATION_STEMS.get(stem) ?? stem;
}

/** Finnish Haku tokens: {@link tokenise}, then the prefix stem. */
function tokeniseFinnish(text: string): string[] {
  return tokenise(text).map(prefixStem);
}

/**
 * A short Finnish word meets its case forms (fix pass 2): a query or key stem of exactly four
 * letters (palo, savu, vesi) also matches a stem that begins with it (paloa, palon, savua), either
 * way round. Longer stems and codes match only whole (fix pass 3: "pohjo" no longer meets "pohjoisr").
 */
const FINNISH_SHORT_STEM = 4;
function finnishMatch(query: string, key: string): boolean {
  if (query === key) return true;
  if (/\p{N}/u.test(query) || /\p{N}/u.test(key)) return false;
  const [short, long] = query.length <= key.length ? [query, key] : [key, query];
  return short.length === FINNISH_SHORT_STEM && long.startsWith(short);
}

function overlapScore(queryTokens: ReadonlySet<string>, retrievalKeys: readonly string[], tokens: (text: string) => string[]): number {
  const keyTokens = new Set(retrievalKeys.flatMap(tokens));
  let score = 0;
  for (const t of keyTokens) if (queryTokens.has(t)) score += 1;
  return score;
}

/** The Finnish score: the query's words found whole in the keys, then its stems matched ({@link finnishMatch}). */
function finnishScore(queryWords: ReadonlySet<string>, queryStems: readonly string[], retrievalKeys: readonly string[]): readonly [number, number] {
  const words = retrievalKeys.flatMap(tokenise);
  const whole = new Set(words.filter((w) => queryWords.has(w))).size;
  const stems = new Set(words.map(prefixStem));
  let matched = 0;
  for (const k of stems) if (queryStems.some((q) => finnishMatch(q, k))) matched += 1;
  return [whole, matched];
}

/**
 * Ranks `corpus` by the query's words found whole in each atom's `retrievalKeys`, then by
 * the prefix-stem matches ({@link finnishScore}). Returns
 * references into `corpus`, unmodified — never a clone, never a
 * synthesised object. Deterministic: ties broken by atom id (I1,
 * "iteration order is sorted, never insertion order").
 */
export const retrieveClosed: RetrievalFunction = (query, corpus) => {
  const words = new Set(tokenise(query));
  const stems = [...new Set(tokeniseFinnish(query))];
  return corpus
    .map((atom) => ({ atom, score: finnishScore(words, stems, atom.retrievalKeys) }))
    .filter((s) => s.score[1] > 0)
    .sort((a, b) => b.score[0] - a.score[0] || b.score[1] - a.score[1] || compareStrings(a.atom.id, b.atom.id))
    .map((s) => s.atom);
};

function rankByKeys(
  queryTokens: ReadonlySet<string>,
  corpus: readonly InfoAtom[],
  keysOf: (atom: InfoAtom) => readonly string[],
  keyTokens: (text: string) => string[] = tokenise,
): readonly InfoAtom[] {
  return corpus
    .map((atom) => ({ atom, score: overlapScore(queryTokens, keysOf(atom), keyTokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : compareStrings(a.atom.id, b.atom.id)))
    .map((s) => s.atom);
}

/**
 * English function words of four letters or more, which the key rule (words of four letters or
 * more) would otherwise keep: without them every English question matches most records. Declared
 * (SPEC/14 revision (v)); the Finnish keys have no stop list and are unchanged.
 */
export const HAKU_EN_STOP_WORDS: ReadonlySet<string> = new Set([
  "about", "after", "again", "also", "been", "before", "being", "does", "doing", "done", "each", "from", "have", "having",
  "here", "into", "just", "more", "most", "much", "only", "other", "over", "same", "should", "some", "such", "than", "that",
  "their", "them", "then", "there", "these", "they", "this", "those", "very", "were", "what", "when", "where", "which",
  "while", "will", "with", "would", "your",
]);

/** A token of a code: it has a digit (`EK11`, `L3`, `W3`, `TOIMINTA-2` normalised to `toiminta2`). */
const isCode = (t: string) => /\p{N}/u.test(t);

/**
 * The English search keys of an atom (SPEC/14 revision (v)): the Finnish key rule applied to the
 * record's English text — the source id and every word of four letters or more, possessives
 * dropped, the stop words above removed — plus every code among the authored Finnish keys (a token
 * with a digit), so place and sector codes still match. Records without English text use their
 * Finnish text (`recordIn`).
 */
export function englishKeysOf(atom: InfoAtom): readonly string[] {
  const cached = englishKeyCache.get(atom);
  if (cached) return cached;
  const en = recordIn("en", atom.id, recordText(atom.record));
  const words = tokeniseEnglish(en).filter((w) => (w.length >= 4 || isCode(w)) && !HAKU_EN_STOP_WORDS.has(w));
  const codes = atom.retrievalKeys.flatMap(tokenise).filter(isCode);
  const keys = [...new Set([atom.provenance.sourceId.toLowerCase(), ...words, ...codes])];
  englishKeyCache.set(atom, keys);
  return keys;
}

/** Keys depend only on the atom (an immutable corpus object), so they are computed once per atom. */
const englishKeyCache = new WeakMap<InfoAtom, readonly string[]>();

/** Whitespace-split, trailing punctuation and possessives dropped, then normalised as in Finnish. */
function tokeniseEnglish(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => normaliseToken(dropPossessive(w.replace(/[^\p{L}\p{N}'\u2019]+$/u, ""))))
    .filter((t) => t.length > 0);
}

/**
 * Haku's free-text search in an English session (SPEC/14 revision (v)): the same closed ranking
 * (token overlap, ties by atom id) over {@link englishKeysOf}; the query is tokenised the same way
 * (possessives dropped). Returns references into `corpus` (I6).
 */
export const retrieveClosedEn: RetrievalFunction = (query, corpus) => rankByKeys(new Set(tokeniseEnglish(query)), corpus, englishKeysOf);

/** Haku's free-text search in the session language. */
export function retrieveClosedIn(lang: "fi" | "en"): RetrievalFunction {
  return lang === "en" ? retrieveClosedEn : retrieveClosed;
}
