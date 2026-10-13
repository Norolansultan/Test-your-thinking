/**
 * The `retrieval` block of `content/thinker/manifest.json`, built from the code's declared
 * constants so the manifest mirrors what runs. Shared by `npm run thinker:index` (which rewrites
 * the whole manifest) and `npm run thinker:eval -- --write` (which records the neutral evaluation).
 */

import { readFileSync, existsSync } from "node:fs";
import {
  EN_TOKENISER_ID, EN_TOKENISER_RULE, PREFIX_STEM_LENGTH, SCORE_DECIMALS, THINKER_RETRIEVAL_CONFIG, THINKER_RETRIEVAL_CONFIG_EN, VECTOR_DECIMALS, type HybridConfig,
} from "../../app/retrieval/hybrid.js";
import { MAX_HEADER_LENGTH } from "../../app/retrieval/routine-collapse.js";
import { INDEX_FILE_EN, MANIFEST_FILE, repoPath } from "../../server/thinker/config.js";

export const ROUTINE_COLLAPSE_RULE =
  "retrieval-only, before scoring: a gated record of tier T2/T3 (not lateral traffic) whose text opens with a header " +
  `(before the first ': ', at most ${MAX_HEADER_LENGTH} chars) carrying a label word (no digit, not the record's source id) ` +
  "belongs to the family (source id, tier, header with digit runs masked to '#'); a family spanning at least minDistinctSteps " +
  "distinct gated steps keeps only its newest member (observedAt, then step, then id). Haku is unchanged.";

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
