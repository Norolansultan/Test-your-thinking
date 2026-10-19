/**
 * `npm run thinker:index` — freezes Thinker's retrieval inputs at build time (SPEC/14 revisions (q)
 * and (v)):
 *
 * - `content/thinker/index.json`: one vector per atom over the Finnish passage, from the pinned
 *   embedder, rounded to fixed precision and sorted by atom id, so two builds are byte-identical;
 * - `content/thinker/authored-queries.json`: the query vectors of the authored test questions;
 * - `content/thinker/index.en.json` and `authored-queries.en.json` (SPEC/14 revision (v)): the same
 *   over the English passages (source + the record's English text) and the English questions;
 * - `content/thinker/manifest.json`: the model id, effort, prompt hash, embedder, fusion weights,
 *   top-k, routine collapse, diversity cap and the index hash — the declared treatment — plus
 *   `indexEn` and `retrievalEn` for English. The neutral evaluation blocks (`npm run thinker:eval --
 *   --write`, and `-- --lang en --write`) are carried over from the previous manifest.
 *
 *   npm run thinker:index                 # both languages
 *   npm run thinker:index -- --lang en    # English only: the Finnish files and manifest blocks are kept as they are
 *
 * Downloads the embedding model into `.cache/thinker-models` on first run.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { THINKER_CLIENT_TIMEOUT_MS, THINKER_LATENCY_FLOOR_MS, THINKER_MODEL_TIMEOUT_MS } from "../../app/session/thinker-protocol.js";
import {
  AUTHORED_QUERIES_FILE, AUTHORED_QUERIES_FILE_EN, INDEX_FILE, INDEX_FILE_EN, loadSystemPrompt, MANIFEST_FILE, PROMPT_FILE, PROMPT_FILE_EN, PROMPT_FILE_INTENT, PROMPT_FILE_INTENT_EN, repoPath, sha256Hex,
  INTENT_PROMPT_NOTE, OPEN_ONCE_PROMPT_NOTE, OPEN_PROMPT_NOTE, PROMPT_FILE_OPEN, PROMPT_FILE_OPEN_EN, PROMPT_FILE_OPEN_ONCE, PROMPT_FILE_OPEN_ONCE_EN, THINKER_OUTPUT_NOTE,
  THINKER_MAX_RETRIES, THINKER_MAX_TOKENS, THINKER_MODEL_ID, THINKER_OPEN_MAX_TOKENS, THINKER_OPEN_PARSE_RETRIES, THINKER_SEED,
} from "../../server/thinker/config.js";
import { E5_DIM, E5_DTYPE, E5_EMBEDDER_ID, E5_LICENCE, E5_MODEL, E5_REVISION, loadE5Embedder } from "../../server/thinker/e5-embedder.js";
import { ALL_AUTHORED_QUESTIONS, ALL_AUTHORED_QUESTIONS_EN } from "./authored-questions.js";
import { langArg } from "./eval-common.js";
import { buildIndexText, buildQueriesText } from "./index-build.js";
import { declaredRetrievalBlock, englishRetrievalBlock, readManifest, recordedNeutralEval, recordedNeutralEvalEn } from "./retrieval-manifest.js";
import { DIRECTIVE_PREMISES_FILE, loadDirectivePremises } from "../../server/thinker/directive-premises.js";
import { loadPremiseEvidence, PREMISE_EVIDENCE_FILE } from "../../server/thinker/premise-check.js";
const DIRECTIVE_PREMISES_NOTE = "the directive's authored premises (SPEC/14 revision (ar), 11 Oct 2026): DRAFT study material, to be checked by instructors and a native Finnish speaker before the pilot; appended to the Open Thinker's system instruction after the directive in the reasoning_intent cell from V8; since SPEC/30 §3 (19 Oct 2026) each with the server's premise check (premiseEvidence), the model no longer rates them and cannot add or reword them";
const PREMISE_EVIDENCE_NOTE = "SPEC/30 §3 (19 Oct 2026): the guide's rule-based premise check (server/thinker/premise-check.ts): per phase-B view V8-V14 and authored premise P1, P2, contradicted or not_contradicted, with the deciding records' atom ids and the records-clock time from which a contradiction holds; the server overwrites any premise status with it and shows it in a fixed template in reasoning_intent options answers while the directive is in force";

function write(relative: string, text: string): void {
  const path = repoPath(relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

/** The manifest's model block: the pinned model and the fixed settings, Haku's and the Open Thinker's. */
function modelBlock() {
  return {
    id: THINKER_MODEL_ID, maxTokens: THINKER_MAX_TOKENS, openMaxTokens: THINKER_OPEN_MAX_TOKENS, timeoutMs: THINKER_MODEL_TIMEOUT_MS, maxRetries: THINKER_MAX_RETRIES,
    openParseRetries: THINKER_OPEN_PARSE_RETRIES, seed: THINKER_SEED,
    samplingParameters: "none: temperature 0 is used for Google GenAI",
    output: THINKER_OUTPUT_NOTE,
  };
}

/** The manifest's prompt blocks: each frozen prompt's file and hash (the server refuses to start on a mismatch). */
function promptBlocks() {
  const prompt = loadSystemPrompt();
  const promptEn = loadSystemPrompt("en");
  const promptIntent = loadSystemPrompt("fi", "intent");
  const promptIntentEn = loadSystemPrompt("en", "intent");
  // The Open Thinker's system prompts (app2, F3, 8 Oct 2026); revision (al): one per Thinker cell (no order block in the once cell's).
  const promptOpen = loadSystemPrompt("fi", "open");
  const promptOpenEn = loadSystemPrompt("en", "open");
  const promptOpenOnce = loadSystemPrompt("fi", "open_once");
  const promptOpenOnceEn = loadSystemPrompt("en", "open_once");
  const premises = loadDirectivePremises();
  const evidence = loadPremiseEvidence();
  return {
    prompt: { file: PROMPT_FILE, sha256: prompt.sha256, newlineNormalisation: "LF" },
    promptEn: { file: PROMPT_FILE_EN, sha256: promptEn.sha256, newlineNormalisation: "LF" },
    promptIntent: { file: PROMPT_FILE_INTENT, sha256: promptIntent.sha256, newlineNormalisation: "LF", ...INTENT_PROMPT_NOTE },
    promptIntentEn: { file: PROMPT_FILE_INTENT_EN, sha256: promptIntentEn.sha256, newlineNormalisation: "LF", ...INTENT_PROMPT_NOTE },
    promptOpen: { file: PROMPT_FILE_OPEN, sha256: promptOpen.sha256, newlineNormalisation: "LF", ...OPEN_PROMPT_NOTE },
    promptOpenEn: { file: PROMPT_FILE_OPEN_EN, sha256: promptOpenEn.sha256, newlineNormalisation: "LF", ...OPEN_PROMPT_NOTE },
    promptOpenOnce: { file: PROMPT_FILE_OPEN_ONCE, sha256: promptOpenOnce.sha256, newlineNormalisation: "LF", ...OPEN_ONCE_PROMPT_NOTE },
    promptOpenOnceEn: { file: PROMPT_FILE_OPEN_ONCE_EN, sha256: promptOpenOnceEn.sha256, newlineNormalisation: "LF", ...OPEN_ONCE_PROMPT_NOTE },
    // Revision (ar), 11 Oct 2026: the directive's authored premises are frozen like a prompt.
    directivePremises: { file: DIRECTIVE_PREMISES_FILE, sha256: premises.sha256, newlineNormalisation: "LF", directiveSha256: premises.directiveSha256, usedFor: DIRECTIVE_PREMISES_NOTE },
    // SPEC/30 §3, 19 Oct 2026: the premise-evidence table is frozen like the premises (the server refuses to start on a mismatch).
    premiseEvidence: {
      file: PREMISE_EVIDENCE_FILE, sha256: evidence.sha256, newlineNormalisation: "LF", version: evidence.version, directivePremisesSha256: evidence.directivePremisesSha256,
      status: evidence.draft ? "DRAFT study content, the expert panel to confirm (SPEC/30 §8)" : "confirmed", usedFor: PREMISE_EVIDENCE_NOTE,
    },
  };
}

async function main(): Promise<void> {
  // Revision (aq): `--manifest-only` re-hashes the prompts and rewrites the model block; the indexes and retrieval blocks are kept (no embedder needed).
  if (process.argv.includes("--manifest-only")) {
    const previous = readManifest();
    if (!previous) throw new Error("no manifest; run `npm run thinker:index` (both languages) first");
    write(MANIFEST_FILE, `${JSON.stringify({ ...previous, model: modelBlock(), ...promptBlocks() }, null, 2)}\n`);
    console.log("thinker:index --manifest-only — prompt hashes and model block rewritten (indexes kept)");
    return;
  }
  const englishOnly = process.argv.includes("--lang") || process.argv.some((a) => a.startsWith("--lang=")) ? langArg(process.argv.slice(2)) === "en" : false;
  const scenario = buildDemoScenario();
  const embedder = await loadE5Embedder({ allowRemote: true });

  // English (SPEC/14 revision (v)).
  const en = await buildIndexText(scenario.atoms, embedder, "en", E5_DIM);
  write(INDEX_FILE_EN, en.text);
  const enQueries = await buildQueriesText(ALL_AUTHORED_QUESTIONS_EN, embedder, "en");
  write(AUTHORED_QUERIES_FILE_EN, enQueries.text);
  const indexEn = {
    file: INDEX_FILE_EN, sha256: sha256Hex(en.text), atomCount: en.count, language: "en", scenarioId: scenario.id, scenarioVersion: scenario.version,
    authoredQueries: AUTHORED_QUERIES_FILE_EN,
  };
  const retrievalEn = englishRetrievalBlock(recordedNeutralEvalEn());

  if (englishOnly) {
    const previous = readManifest();
    if (!previous) throw new Error("no manifest; run `npm run thinker:index` (both languages) first");
    write(MANIFEST_FILE, `${JSON.stringify({ ...previous, retrievalEn, indexEn }, null, 2)}\n`);
    console.log(`thinker:index --lang en — ${en.count} atoms, ${enQueries.count} English authored queries, index.en ${indexEn.sha256.slice(0, 12)}… (Finnish files kept)`);
    return;
  }

  const fi = await buildIndexText(scenario.atoms, embedder, "fi", E5_DIM);
  write(INDEX_FILE, fi.text);
  const queries = await buildQueriesText(ALL_AUTHORED_QUESTIONS, embedder, "fi");
  write(AUTHORED_QUERIES_FILE, queries.text);

  const manifest = {
    manifestVersion: 1,
    model: modelBlock(),
    ...promptBlocks(),
    embedder: { id: E5_EMBEDDER_ID, model: E5_MODEL, revision: E5_REVISION, dtype: E5_DTYPE, dim: E5_DIM, licence: E5_LICENCE, prefixes: { query: "query: ", passage: "passage: " }, batchSize: 1 },
    retrieval: declaredRetrievalBlock(recordedNeutralEval()),
    retrievalEn,
    latency: { floorMs: THINKER_LATENCY_FLOOR_MS, clientTimeoutMs: THINKER_CLIENT_TIMEOUT_MS },
    index: { file: INDEX_FILE, sha256: sha256Hex(fi.text), atomCount: fi.count, scenarioId: scenario.id, scenarioVersion: scenario.version },
    indexEn,
  };
  write(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`thinker:index — ${fi.count} atoms × 2 languages, ${queries.count}+${enQueries.count} authored queries, prompt ${promptBlocks().prompt.sha256.slice(0, 12)}…, index ${manifest.index.sha256.slice(0, 12)}…, index.en ${indexEn.sha256.slice(0, 12)}…`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
