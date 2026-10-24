/**
 * What a question says about time (SPEC/14 revision D10, 24 Oct 2026: the researcher's decision D10
 * after the play-test of 23 Oct 2026, `docs/audits/2026-10-23-playtest/analysis.md` §4): whether it
 * asks for the latest state ("viimeisin", "uutta", "latest", "now" …), and the clock times it names
 * ("klo 17.24", "at 17:24", "17.24"). Pure and deterministic; the retrieval (`hybrid.ts`) uses it to
 * apply the query-aware recency preference and the clock match, and to keep the words it used as a
 * signal out of the lexical half.
 *
 * - **Recency cues** are whole words (or fixed phrases) of the question, lowercased, by the declared
 *   patterns {@link RECENCY_CUES_FI} / {@link RECENCY_CUES_EN} (Finnish inflections included).
 *   A **previous cue** ("edellinen", "aiemmin", "previous", "earlier") cancels them: the question then
 *   asks for an older record, and no latest-state preference is applied.
 * - **Clocks** are hh.mm or hh:mm (00–23, two-digit minutes), optionally after "klo", "kello" or "at";
 *   a number followed by a unit ("12.50 ha") is not a clock. A clock after "before", "after", "since",
 *   "until", "by" or "ennen", or before "jälkeen", "lähtien", "alkaen", "asti", "saakka" or "mennessä",
 *   is RELATIVE: it is removed from the lexical query but names no record time.
 * - **Lexical query:** the question with every cue and clock expression it used removed, so a clock
 *   in the question no longer meets clock-like numbers inside unrelated records' text. When nothing
 *   would be left and the question names no clock, the question is kept as it was.
 *
 * Nothing here knows about any record, source or designed event.
 */

import type { RetrievalLang } from "./hybrid.js";

/** A declared cue: a name for the manifest and SPEC, and the pattern a lowercased word (or phrase) must match. */
export interface CuePattern {
  readonly cue: string;
  readonly pattern: RegExp;
}

/**
 * Finnish recency cues. "viimeistään" (at the latest, a deadline) and "viimeistely" are not cues;
 * "uusi"/"uusia" ("uusi palo", a new fire) are not cues; "nykyinen" (current) is, as the Finnish of "current".
 */
export const RECENCY_CUES_FI: readonly CuePattern[] = [
  { cue: "viimeisin, viimeinen, viime, viimeksi (all inflections)", pattern: /^viime(?:ksi|inen|is(?!t(?:ään|el))\p{L}*)?$/u },
  { cue: "uusin (uusimman, uusinta, uusimpia …)", pattern: /^uusi(?:n|mm|mp)\p{L}*$/u },
  { cue: "tuore, tuorein (all inflections)", pattern: /^tuore\p{L}*$/u },
  { cue: "uutta", pattern: /^uutta(?:kin|ko|kaan)?$/u },
  { cue: "nyt (nytkin, nythän …)", pattern: /^nyt(?:kin|kään|hän|pä)?$/u },
  { cue: "nykyinen, nykytilanne (nyky-)", pattern: /^nyky\p{L}*$/u },
  { cue: "tämänhetkinen", pattern: /^tämänhetki\p{L}*$/u },
  { cue: "tällä hetkellä", pattern: /^tällä hetkellä$/u },
];

/** English recency cues. "now that" (a conjunction) is not a cue; "new" alone is not, "any new" is. */
export const RECENCY_CUES_EN: readonly CuePattern[] = [
  { cue: "latest", pattern: /^latest$/u },
  { cue: "newest", pattern: /^newest$/u },
  { cue: "most recent, recent, recently", pattern: /^(?:recent|recently|lately)$/u },
  { cue: "current, currently, presently", pattern: /^(?:current|currently|presently)$/u },
  { cue: "last", pattern: /^last$/u },
  { cue: "now (not 'now that')", pattern: /^now$/u },
  { cue: "at the moment, at present", pattern: /^at (?:the moment|present)$/u },
  { cue: "any new, anything new, what's new", pattern: /^(?:any|anything|what's|whats|what is) new$/u },
];

/** Previous cues: the question asks for an earlier record, so the latest-state preference is off. */
export const PREVIOUS_CUES_FI: readonly CuePattern[] = [
  { cue: "edellinen (all inflections)", pattern: /^edelli\p{L}*$/u },
  { cue: "aiempi, aiemmin, aikaisempi", pattern: /^(?:aiem|aikaisem)(?:pi|m)\p{L}*$/u },
];
export const PREVIOUS_CUES_EN: readonly CuePattern[] = [{ cue: "previous, previously, earlier, prior", pattern: /^(?:previous|previously|earlier|prior)$/u }];

/**
 * Words that name no topic (24 Oct 2026, D10 addendum): question words, the period, records, reports and news in general. A
 * latest-state question made only of these and its cue words ("Mitä uutta tällä jaksolla on kirjattu?", "Any new reports?")
 * asks for the newest records, whatever they are about; its words would only match records at random.
 */
export const TOPIC_FREE_FI = /^(?:mitä|mikä|mitkä|onko|ovatko|on|ovat|ollut|olleet|tullut|tapahtunut|kuuluu|tällä|tämän|jakso\p{L}*|kirja\p{L}*|ilmoitu\p{L}*|raport\p{L}*|tieto|tiedot|tietoja|uutisi\p{L}*|mitään|jotain)$/u;
export const TOPIC_FREE_EN = /^(?:what|what's|whats|is|are|was|were|has|have|been|there|in|this|the|a|any|anything|period|period's|periods|record|records|recorded|report|reports|reported|information|update|updates|news|happened|happening)$/u;

const RELATIVE_BEFORE: Readonly<Record<RetrievalLang, RegExp>> = {
  fi: /^ennen$/u,
  en: /^(?:before|after|since|until|till|by)$/u,
};
const RELATIVE_AFTER_FI = /^(?:jälkeen|lähtien|alkaen|asti|saakka|mennessä)$/u;
/** A unit after the number: then it is a quantity, not a clock. */
const UNIT_AFTER = /^\s*(?:ha|m|km|%|m\/s|m\/min|kv|°|astetta|metri\p{L}*|hehtaari\p{L}*|prosentti\p{L}*|hectares?|metres?|meters?|percent)(?![\p{L}\p{N}])/iu;
const CLOCK = /(?<![\p{L}\p{N}.,:])([01]?\d|2[0-3])[.:]([0-5]\d)(?![\p{N}]|[.,:]\p{N})/gu;
const CLOCK_PREFIX = /(?:klo|kello|at|@)\s*$/iu;
const WORD = /[\p{L}\p{N}]+(?:['\u2019][\p{L}]+)?/gu;

/** What a question says about time. */
export interface QueryCues {
  /** The question asks for the latest state (a recency cue and no previous cue). */
  readonly latest: boolean;
  /** The clocks it names as record times, minutes after midnight, in the order written (duplicates dropped). */
  readonly clocks: readonly number[];
  /** The question for the lexical half: the cues and clock expressions it used removed. */
  readonly lexicalQuery: string;
  /** The cue words and phrases found (lowercased; for tests and the evaluation's report). */
  readonly cueWords: readonly string[];
  /** A latest-state question that names no topic (only cue words and {@link TOPIC_FREE_FI} / {@link TOPIC_FREE_EN} words, no clock). */
  readonly topicFree: boolean;
}

interface Span {
  readonly start: number;
  readonly end: number;
}

function words(text: string): { readonly w: string; readonly start: number; readonly end: number }[] {
  return [...text.matchAll(WORD)].map((m) => ({ w: m[0].toLowerCase().replace("\u2019", "'"), start: m.index, end: m.index + m[0].length }));
}

/** The cues of a question, as word spans: three- and two-word phrases are tried before single words. */
function cueSpans(text: string, cues: readonly CuePattern[]): { readonly spans: Span[]; readonly found: string[] } {
  const ws = words(text);
  const spans: Span[] = [];
  const found: string[] = [];
  const matches = (phrase: string) => cues.some((c) => c.pattern.test(phrase));
  for (let i = 0; i < ws.length; i++) {
    let n = 0;
    for (const len of [3, 2, 1]) {
      if (i + len > ws.length) continue;
      const phrase = ws.slice(i, i + len).map((x) => x.w).join(" ");
      // "now that" is a conjunction, not a request for the latest state.
      if (matches(phrase) && !(phrase === "now" && ws[i + 1]?.w === "that")) {
        n = len;
        break;
      }
    }
    if (n === 0) continue;
    spans.push({ start: ws[i]!.start, end: ws[i + n - 1]!.end });
    found.push(ws.slice(i, i + n).map((x) => x.w).join(" "));
    i += n - 1;
  }
  return { spans, found };
}

/** The clock expressions of a question: their spans, and the minutes of those naming a record time. */
export function queryClocks(text: string, lang: RetrievalLang): { readonly spans: readonly Span[]; readonly clocks: readonly number[] } {
  const spans: Span[] = [];
  const clocks: number[] = [];
  for (const m of text.matchAll(CLOCK)) {
    const end = m.index + m[0].length;
    if (UNIT_AFTER.test(text.slice(end))) continue;
    const head = text.slice(0, m.index);
    const prefix = CLOCK_PREFIX.exec(head);
    const start = prefix && (prefix.index === 0 || !/[\p{L}\p{N}]/u.test(head[prefix.index - 1]!)) ? prefix.index : m.index;
    const before = words(text.slice(0, start)).at(-1)?.w ?? "";
    const after = words(text.slice(end)).at(0)?.w ?? "";
    const relative = RELATIVE_BEFORE[lang].test(before) || (lang === "fi" && RELATIVE_AFTER_FI.test(after));
    spans.push({ start, end });
    const minutes = Number(m[1]) * 60 + Number(m[2]);
    if (!relative && !clocks.includes(minutes)) clocks.push(minutes);
  }
  return { spans, clocks };
}

function without(text: string, spans: readonly Span[]): string {
  let out = "";
  let at = 0;
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    if (s.start < at) continue;
    out += `${text.slice(at, s.start)} `;
    at = s.end;
  }
  return (out + text.slice(at)).replace(/\s+/gu, " ").trim();
}

/** Which of the two rules the retrieval configuration declares (`hybrid.ts`); a rule not declared changes nothing. */
export interface CueUse {
  readonly latest: boolean;
  readonly clocks: boolean;
}

/**
 * The question's recency cue, clocks and lexical query in the retrieval language. Only what a declared
 * rule uses is taken out of the lexical query: the cue words when the question asks for the latest
 * state, every clock expression (relative ones too) when the clock rule is declared.
 */
export function queryCues(query: string, lang: RetrievalLang = "fi", use: CueUse = { latest: true, clocks: true }): QueryCues {
  const recency = cueSpans(query, lang === "en" ? RECENCY_CUES_EN : RECENCY_CUES_FI);
  const previous = cueSpans(query, lang === "en" ? PREVIOUS_CUES_EN : PREVIOUS_CUES_FI);
  const clock = queryClocks(query, lang);
  const latest = use.latest && recency.found.length > 0 && previous.found.length === 0;
  const clocks = use.clocks ? clock.clocks : [];
  const spans = [...(latest ? recency.spans : []), ...(use.clocks ? clock.spans : [])];
  const stripped = without(query, spans);
  const nothingLeft = words(stripped).length === 0 && clocks.length === 0;
  const topicWords = lang === "en" ? TOPIC_FREE_EN : TOPIC_FREE_FI;
  const topicFree = latest && clock.clocks.length === 0 && words(stripped).every((x) => topicWords.test(x.w));
  return { latest, clocks, lexicalQuery: spans.length === 0 || nothingLeft ? query : stripped, cueWords: recency.found, topicFree };
}
