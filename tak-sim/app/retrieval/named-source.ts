/**
 * The named-source rule (SPEC/14 revision (bo), 25 Oct 2026; the independent review's finding B2): a question that names a source as
 * Haku shows it — a unit's call sign ("EK12", "EK12:n", "DR3:lta", "VPK") or a source's shown name ("sääennuste", "sääennusteen",
 * "weather forecast") — prefers that source's records. Before it, "Mitä EK12 ilmoitti?" ranked EK12's reports below a lateral line
 * that happened to say "ilmoitamme" and the 12.00 alarm (both name EK12), and "Mikä on viimeisin sääennuste?" ranked radio lines
 * with "Mikä on" first: the forecast records say "Ennuste", their source is SÄÄENNUSTE.
 *
 * - **Naming** ({@link namesSource}; D10's clock-rule check, shared by both rules): every word of the source's shown name in the
 *   session language (`sourceName`), or a code in it. Whole words, lowercased, a case ending after a colon dropped ("EK12:n",
 *   "VPK:lta"). A Finnish word may be inflected: it keeps the name word less its last two letters ("sääennusteesta", "johtopaikalta",
 *   "hätäkeskuksen", "vesihuollon"); a name word of five letters or fewer, and a code, must be whole. An English word may be a plural
 *   or a possessive (the English tokeniser's S-stemmer). Not the lexical half's five-letter prefix, which would let "metsäautotie"
 *   name METSÄKESKUS, "tilanne" TILANNEKUVA and "droonien" the Drooniryhmä.
 * - **Boost** (`HybridConfig.namedSource.boost`): every record of a named source gets an additive score and counts as matched.
 * - **Newest first** ({@link namedSourceCue}): with no clock (a named clock is the clock rule's), when the question's other words
 *   (the names, cue words and clocks taken out) are only reporting verbs ({@link REPORTING_FI} / {@link REPORTING_EN}) or words that
 *   name no topic (`TOPIC_FREE_FI` / `TOPIC_FREE_EN`), the named sources' records — gated and collapsed — are returned newest first,
 *   and only they: D10's topic-free rule restricted to the named source. "Mitä EK12 ilmoitti?", "What has EK12 reported?",
 *   "Mikä on viimeisin sääennuste?" (the cue word is out), "Mikä on sääennuste?", "EK11". A question with a topic ("Mitä EK12
 *   ilmoitti kärjestä?", "Mikä on viimeisin sääennuste illaksi?") is ranked as before, with the boost and, after a recency cue, D10's
 *   latest-state preference: newest first for every recency cue was the alternative, and the play-test development set chose this.
 *
 * Nothing here knows about any record, unit or designed event: the names are the sources' shown names, whatever they are.
 */

import { compareStrings } from "../engine/deterministic-object.js";
import { sourceName } from "../i18n/text.js";
import { sStem, type RetrievalLang } from "./hybrid.js";
import { TOPIC_FREE_EN, TOPIC_FREE_FI, type CuePattern, type QueryCues } from "./query-cues.js";

/**
 * Reporting verbs (Finnish): what a source said, in any tense or person, and the words joining two names. "Raportti", "ilmoitus",
 * "kirjattu" are already topic-free words (D10 addendum); "sanoma" (a message) and "kerros" (a layer) are not verbs here.
 */
export const REPORTING_FI: readonly CuePattern[] = [
  { cue: "ilmoittaa (ilmoitti, ilmoittanut, ilmoittavat …)", pattern: /^ilmoit\p{L}*$/u },
  { cue: "raportoida (raportoi, raportoinut …)", pattern: /^raportoi\p{L}*$/u },
  { cue: "kertoa (kertoi, kertonut, kertoo, kerro, kerrottu …)", pattern: /^(?:kerto\p{L}*|kerro|kerrot\p{L}*)$/u },
  { cue: "sanoa (sanoi, sanonut, sanoo, sanottu …)", pattern: /^sano(?:a|i|o|t|mme|tte|vat|ivat|nut|neet|ttu|taan|ttiin)?$/u },
  { cue: "kuulua (kuulunut, kuuluu: what has been heard from)", pattern: /^kuulu(?:u|i|nut|neet|vat|ivat)?$/u },
  { cue: "ja, tai, sekä (between two names: 'Mitä EK11 ja EK12 ilmoittivat?')", pattern: /^(?:ja|tai|sekä)$/u },
];

/** Reporting verbs (English), with the auxiliaries of a question about them and "from" ("What did EK12 say?", "the latest from EK12"). */
export const REPORTING_EN: readonly CuePattern[] = [
  { cue: "report (reported, reports, reporting)", pattern: /^report(?:s|ed|ing)?$/u },
  { cue: "say (says, said, saying)", pattern: /^(?:say|says|said|saying)$/u },
  { cue: "tell (tells, told, telling)", pattern: /^(?:tell|tells|told|telling)$/u },
  { cue: "hear (heard)", pattern: /^(?:hear|heard)$/u },
  { cue: "do, does, did (the question's auxiliary)", pattern: /^(?:do|does|did)$/u },
  { cue: "from (the latest from …)", pattern: /^from$/u },
  { cue: "and, or (between two names)", pattern: /^(?:and|or)$/u },
];

const WORD = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu;

/**
 * A text's words as the rule reads them: lowercased; a case ending after a colon dropped ("EK12:n" → "ek12", "VPK:lta" → "vpk");
 * in English a possessive dropped ("EK12's" → "ek12").
 */
export function sourceWords(text: string, lang: RetrievalLang): string[] {
  const lowered = text.toLowerCase().replace(/’/gu, "'").replace(/([\p{L}\p{N}]):\p{L}+/gu, "$1");
  const ws = [...lowered.matchAll(WORD)].map((m) => m[0]);
  return lang === "en" ? ws.map((w) => w.replace(/'s$/u, "").replace(/(?<=s)'$/u, "")) : ws;
}

/** A word as written in the question (for taking reporting words out of the lexical query). */
const WORD_AS_WRITTEN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

const hasDigit = (w: string) => /\p{N}/u.test(w);

/** Whether a question word names a word of a shown name ({@link namesSource}). */
function namesWord(w: string, name: string, lang: RetrievalLang): boolean {
  if (w === name) return true;
  if (hasDigit(name)) return false;
  if (lang === "en") return sStem(w) === sStem(name);
  return name.length > 5 && w.startsWith(name.slice(0, -2));
}

/** The question words that name the source (empty when it is not named): every word of its shown name, or a code in it. */
function namingWords(words: readonly string[], sourceId: string, lang: RetrievalLang): string[] {
  const shown = sourceWords(sourceName(lang, sourceId), lang);
  const codes = shown.filter(hasDigit);
  const nameWords = shown.filter((w) => !hasDigit(w));
  const byCode = words.filter((w) => codes.includes(w));
  if (byCode.length > 0) return byCode;
  if (nameWords.length === 0 || !nameWords.every((n) => words.some((w) => namesWord(w, n, lang)))) return [];
  return words.filter((w) => nameWords.some((n) => namesWord(w, n, lang)));
}

/**
 * Whether the question names the record's source as Haku shows it in the session language (`sourceName`: "VPK", "Sääasema",
 * "SÄÄENNUSTE", "Water supply", "Volunteer fire brigade VOL1"): every word of the shown name, or a code in it ("VOL1", "EK11").
 * The shown name, not the id, so the Finnish verb "saa" does not name the weather station (SAA).
 */
export function namesSource(question: string, sourceId: string, lang: RetrievalLang): boolean {
  return namingWords(sourceWords(question, lang), sourceId, lang).length > 0;
}

/** What a question says about the sources it names. */
export interface NamedSourceCue {
  /** The named sources' ids, sorted. */
  readonly sources: readonly string[];
  /** Return the named sources' records newest first, and only them. */
  readonly newestFirst: boolean;
  /**
   * The question for the lexical half: `queryCues`'s, and when a source is named, its reporting words taken out as D10 takes out its cue
   * words ("Mitä EK12 ilmoitti kärjestä?" → "Mitä EK12 kärjestä?"): they say how the source spoke, not what about, and "ilmoitti" met
   * "ilmoitamme" in a lateral line.
   */
  readonly lexicalQuery: string;
}

/**
 * The sources among `sourceIds` the question names, and whether it asks for their records newest first: no clock, and its other
 * words — the lexical query (`queryCues`: cue words and clocks taken out) less the words naming a source — are reporting verbs or
 * name no topic. A question that is only a name ("EK11") asks for the source's records.
 */
export function namedSourceCue(sourceIds: Iterable<string>, lang: RetrievalLang, cues: QueryCues): NamedSourceCue {
  const words = sourceWords(cues.lexicalQuery, lang);
  const sources: string[] = [];
  const naming = new Set<string>();
  for (const id of new Set(sourceIds)) {
    const ws = namingWords(words, id, lang);
    if (ws.length === 0) continue;
    sources.push(id);
    for (const w of ws) naming.add(w);
  }
  sources.sort(compareStrings);
  if (sources.length === 0) return { sources, newestFirst: false, lexicalQuery: cues.lexicalQuery };
  const topicFree = lang === "en" ? TOPIC_FREE_EN : TOPIC_FREE_FI;
  const reporting = lang === "en" ? REPORTING_EN : REPORTING_FI;
  const isReporting = (w: string) => reporting.some((r) => r.pattern.test(w));
  const rest = words.filter((w) => !naming.has(w));
  const asksForRecords = rest.every((w) => topicFree.test(w) || isReporting(w));
  const lexicalQuery = cues.lexicalQuery.replace(WORD_AS_WRITTEN, (w) => (isReporting(w.toLowerCase()) ? " " : w)).replace(/\s+/gu, " ").trim();
  return { sources, newestFirst: cues.clocks.length === 0 && asksForRecords, lexicalQuery };
}
