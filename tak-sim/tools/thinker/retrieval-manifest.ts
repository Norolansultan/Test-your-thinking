/**
 * The `retrieval` block of `content/thinker/manifest.json`, built from the code's declared
 * constants so the manifest mirrors what runs. Shared by `npm run thinker:index` (which rewrites
 * the whole manifest; `-- --manifest-only` rewrites this block too, keeping its neutral evaluation)
 * and `npm run thinker:eval -- --write` (which records the neutral evaluation).
 */

import { readFileSync, existsSync } from "node:fs";
import {
  EN_TOKENISER_ID, EN_TOKENISER_RULE, PREFIX_STEM_LENGTH, SCORE_DECIMALS, THINKER_RETRIEVAL_CONFIG, THINKER_RETRIEVAL_CONFIG_EN, VECTOR_DECIMALS, type HybridConfig,
} from "../../app/retrieval/hybrid.js";
import { FUNCTION_WORDS_EN, FUNCTION_WORDS_FI } from "../../app/retrieval/function-words.js";
import { REPORTING_EN, REPORTING_FI } from "../../app/retrieval/named-source.js";
import { PREVIOUS_CUES_EN, PREVIOUS_CUES_FI, RECENCY_CUES_EN, RECENCY_CUES_FI, TOPIC_FREE_EN, TOPIC_FREE_FI } from "../../app/retrieval/query-cues.js";
import { MAX_HEADER_LENGTH } from "../../app/retrieval/routine-collapse.js";
import { INDEX_FILE_EN, MANIFEST_FILE, repoPath } from "../../server/thinker/config.js";

export const ROUTINE_COLLAPSE_RULE =
  "retrieval-only, before scoring: a gated record of tier T2/T3 (not lateral traffic) whose text opens with a header " +
  `(before the first ': ', at most ${MAX_HEADER_LENGTH} chars) carrying a label word (no digit, not the record's source id) ` +
  "belongs to the family (source id, tier, header with digit runs masked to '#'); a family spanning at least minDistinctSteps " +
  "distinct gated steps keeps only its newest member (observedAt, then step, then id). Haku is unchanged.";

export const RECENCY_BOOST_RULE =
  "after fusion (0-1 scale), the newest candidate of each source gets +source and the newest naming each sector code (L1-L4) +sector, once each; only candidates the question matched (base score above 0, or a clock match)";

export const LATEST_RULE =
  "D10 (24 Oct 2026), when the question asks for the latest state (a recency cue and no previous cue, app/retrieval/query-cues.ts): " +
  "every relevant candidate (base score at least relevance x the best base score) gets graded x its observation time scaled 0-1 between the oldest and the newest relevant candidate; " +
  "added to the ordinary boost; the cue words are removed from the lexical query; the vector half and the query vector are unchanged; " +
  "addendum (24 Oct 2026): a latest-state question with no clock whose other words all name no topic (topicFreeWords) returns the gated, collapsed candidates newest first; " +
  "B5 (25 Oct 2026, SPEC/14 (bi)): cue phrases of up to four words; a previous word inside a recency phrase ('since my last plan', 'edellisen suunnitelmani jälkeen') cancels nothing";

export const CLOCK_RULE =
  "D10 (24 Oct 2026): clocks hh.mm / hh:mm (00-23, two-digit minutes; optional 'klo', 'kello', 'at'; not before a unit such as 'ha') in the question; " +
  "one after before/after/since/until/by/ennen or before jälkeen/lähtien/alkaen/asti/saakka/mennessä is relative and names no record time; " +
  "every clock expression is removed from the lexical query; a candidate whose clock as shown (observedAt, floored to the minute) is within nearMinutes of a named clock gets +near, " +
  "+namedSource more when the question names its source as Haku shows it in the session language (every word of the shown name, or a code in it; " +
  "the named-source rule's check since (bo), 25 Oct 2026), within farMinutes +far; " +
  "gated records within nearMinutes of a named clock are exempt from the routine collapse; a clock-matched candidate counts as matched";

export const NAMED_SOURCE_RULE =
  "(bo) 25 Oct 2026 (SPEC/14 revision (bo), the review's B2; app/retrieval/named-source.ts): a source is named when the question has every word of its shown name " +
  "in the session language (sourceName: 'EK12', 'VPK', 'SÄÄENNUSTE', 'Weather forecast', 'Volunteer fire brigade VOL1') or a code in it; words are whole, lowercased, " +
  "a case ending after a colon dropped ('EK12:n', 'VPK:lta'); a Finnish word may be inflected: it begins with the name word less its last two letters " +
  "('sääennusteesta', 'johtopaikalta'), a name word of five letters or fewer and a code must be whole; an English word may be a plural or a possessive (S-stemmer); " +
  "the clock rule's namedSource uses the same check. Every gated, collapsed candidate of a named source gets +boost and counts as matched. " +
  "With no clock naming a record time, when the question's other words (the lexical query less the words naming a source) are all reportingVerbs or topicFreeWords, " +
  "the named sources' candidates alone are returned newest first (then by id), as the D10 topic-free rule; otherwise the ranking is as before plus the boost, " +
  "and the question's reportingVerbs words leave the lexical query (as cue words do). " +
  "Chosen on the play-test development set (haku.csv, MRR@8) among newest-first {only for a topic-free rest, for any recency cue too} x boost {0.1, 0.25, 0.5, 1.0} " +
  "x contentMatch {on, off}; the replay set (haku-replay.csv) held out";

export const CONTENT_MATCH_RULE =
  "(bo) 25 Oct 2026 (app/retrieval/function-words.ts): a word of the question that is a functionWord (as written: lowercased, a case ending after a colon and an English possessive dropped) " +
  "gives function tokens (its tokens that no other word of the question has); a candidate whose BM25 match is only on function tokens scores 0, " +
  "when some candidate matches another token of the question; otherwise nothing changes. The lexical query keeps every word; the vector half and the passage are unchanged";

export function retrievalBlock(config: HybridConfig, neutralEval: unknown): Record<string, unknown> {
  return {
    candidates: "atoms of every step reached (the Haku time gate, app/retrieval/time-gate.ts)",
    passage: "source id + ': ' + record text (retrievalKeys not used)",
    routineCollapse: config.routineCollapse
      ? { minDistinctSteps: config.routineCollapse.minDistinctSteps, maxHeaderLength: MAX_HEADER_LENGTH, rule: ROUTINE_COLLAPSE_RULE }
      : null,
    lexical: { method: "BM25", k1: config.bm25.k1, b: config.bm25.b, prefixStem: PREFIX_STEM_LENGTH },
    vector: { method: "exact cosine (brute force)", precision: VECTOR_DECIMALS },
    fusion: { normalisation: "min-max over candidates", lexicalWeight: config.lexicalWeight, vectorWeight: config.vectorWeight, scoreDecimals: SCORE_DECIMALS, dropZero: true },
    topK: config.topK,
    maxPerSource: config.maxPerSource,
    recencyBoost: config.recencyBoost
      ? {
          source: config.recencyBoost.source, sector: config.recencyBoost.sector, rule: RECENCY_BOOST_RULE,
          latest: config.recencyBoost.latest
            ? {
                ...config.recencyBoost.latest, rule: LATEST_RULE,
                recencyCues: { fi: RECENCY_CUES_FI.map((c) => c.cue), en: RECENCY_CUES_EN.map((c) => c.cue) },
                previousCues: { fi: PREVIOUS_CUES_FI.map((c) => c.cue), en: PREVIOUS_CUES_EN.map((c) => c.cue) },
                topicFreeWords: { fi: TOPIC_FREE_FI.source, en: TOPIC_FREE_EN.source },
              }
            : null,
        }
      : null,
    clockMatch: config.clockMatch ? { ...config.clockMatch, rule: CLOCK_RULE } : null,
    namedSource: config.namedSource
      ? {
          ...config.namedSource, rule: NAMED_SOURCE_RULE,
          reportingVerbs: { fi: REPORTING_FI.map((c) => c.cue), en: REPORTING_EN.map((c) => c.cue) },
          topicFreeWords: { fi: TOPIC_FREE_FI.source, en: TOPIC_FREE_EN.source },
        }
      : null,
    contentMatch: config.contentMatch ? { rule: CONTENT_MATCH_RULE, functionWords: { fi: [...FUNCTION_WORDS_FI].join(" "), en: [...FUNCTION_WORDS_EN].join(" ") } } : null,
    tieBreak: "newer observation first, then atom id",
    ...(neutralEval === undefined ? {} : { neutralEval }),
  };
}

/** The current manifest, or null before the first build. */
export function readManifest(): Record<string, unknown> | null {
  const path = repoPath(MANIFEST_FILE);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>) : null;
}

/** The neutral evaluation recorded in the current manifest, carried over by a rebuild. */
export function recordedNeutralEval(): unknown {
  const retrieval = readManifest()?.["retrieval"] as Record<string, unknown> | undefined;
  return retrieval?.["neutralEval"];
}

export const declaredRetrievalBlock = (neutralEval: unknown) => retrievalBlock(THINKER_RETRIEVAL_CONFIG, neutralEval);

/**
 * The English retrieval block (`retrievalEn`, SPEC/14 revision (v)): the same structure as the
 * Finnish one plus the language, the English passage, the English tokeniser, the collapse's
 * language rule and the index file. Its `neutralEval` is written by `thinker:eval -- --lang en --write`.
 */
export function englishRetrievalBlock(neutralEval: unknown): Record<string, unknown> {
  const block = retrievalBlock(THINKER_RETRIEVAL_CONFIG_EN, undefined);
  return {
    language: "en",
    ...block,
    passage: "source id + ': ' + the record's English text (app/i18n/text.ts recordIn; the Finnish where a record has none); retrievalKeys not used",
    index: INDEX_FILE_EN,
    routineCollapse: block["routineCollapse"] === null ? null : { ...(block["routineCollapse"] as Record<string, unknown>), language: "computed on the Finnish source text (the record's structure), so the same records are collapsed as in Finnish" },
    lexical: { ...(block["lexical"] as Record<string, unknown>), tokeniser: EN_TOKENISER_ID, rule: EN_TOKENISER_RULE },
    status: "provisional (THINKER_RETRIEVAL_CONFIG_EN) until neutralEval.status is frozen",
    ...(neutralEval === undefined ? {} : { neutralEval }),
  };
}

/** The English neutral evaluation recorded in the current manifest, carried over by a rebuild. */
export function recordedNeutralEvalEn(): unknown {
  const retrieval = readManifest()?.["retrievalEn"] as Record<string, unknown> | undefined;
  return retrieval?.["neutralEval"];
}
