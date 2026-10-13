/**
 * Shared plumbing for the Thinker retrieval evaluations (`eval-neutral.ts`, `probe-planted.ts`):
 * the scenario, the interaction-log corpus, the time gate at a view's start, the frozen index and
 * the local e5 query embedder. Retrieval runs exactly as the proxy runs it (`hybridRetrieve`).
 *
 * Language (SPEC/14 revision (v)): every evaluation runs in one retrieval language. English uses
 * the English passages and tokeniser and `content/thinker/index.en.json`; while that file is absent
 * the run is lexical-only and says so. The index is read lazily, per language, so nothing here
 * needs the English index to load.
 */

import { existsSync, readFileSync } from "node:fs";
import {
  hybridRetrieve, roundVector, vectorIndexOf, type Embedder, type HybridConfig, type RetrievalLang, type RetrievedRecord, type VectorIndex, type VectorIndexFile,
} from "../../app/retrieval/hybrid.js";
import { reachableAtoms, stepAtVirtualTime } from "../../app/retrieval/time-gate.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import type { InteractionEvent } from "../../app/scenario/types.js";
import { indexFileOf, repoPath } from "../../server/thinker/config.js";
import { loadE5Embedder } from "../../server/thinker/e5-embedder.js";

export const CORPUS_FILE = "content/corpus/interaction-log.jsonl";

export const scenario = buildDemoScenario();

export function loadCorpus(): InteractionEvent[] {
  return readFileSync(repoPath(CORPUS_FILE), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "").map((l) => JSON.parse(l) as InteractionEvent);
}

/** `--lang en` (or `--lang=en`) selects English; anything else, or nothing, is Finnish. */
export function langArg(args: readonly string[]): RetrievalLang {
  const i = args.indexOf("--lang");
  const value = i >= 0 ? args[i + 1] : args.find((a) => a.startsWith("--lang="))?.slice("--lang=".length);
  if (value === undefined || value === "fi") return "fi";
  if (value === "en") return "en";
  throw new Error(`--lang must be fi or en, not "${value}"`);
}

/** The step the proxy computes for a view at its start (the clock at view entry). */
export function gateStepOfView(view: number): number {
  const spec = scenario.cycles.find((c) => c.index === view);
  const step = spec ? stepAtVirtualTime(spec, spec.startsAtVirtual) : null;
  if (step === null) throw new Error(`no view ${view} in the scenario`);
  return step;
}

export interface QueryEmbedding {
  /** "hybrid" when the e5 model ran, "lexical_only" when it could not be loaded. */
  readonly mode: "hybrid" | "lexical_only";
  readonly reason: string | null;
  /** The retrieval language. */
  readonly lang: RetrievalLang;
  /** The language's frozen index; null in lexical-only mode. */
  readonly index: VectorIndex | null;
  vectorOf(question: string): Promise<readonly number[] | null>;
}

/** Reads a language's frozen index file, or null when it is absent. */
export function readIndexFile(lang: RetrievalLang): VectorIndexFile | null {
  const path = repoPath(indexFileOf(lang));
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as VectorIndexFile) : null;
}

const lexical = (lang: RetrievalLang, reason: string): QueryEmbedding => ({ mode: "lexical_only", reason, lang, index: null, vectorOf: async () => null });

/** A query embedding over a given embedder and index (also what tests use with a stub embedder). */
export function embeddingWith(embedder: Embedder, index: VectorIndex, lang: RetrievalLang): QueryEmbedding {
  if (index.language !== lang) throw new Error(`the ${index.language} index cannot serve ${lang} retrieval`);
  if (index.embedderId !== embedder.id) throw new Error(`embedder ${embedder.id} does not match the index (${index.embedderId})`);
  const cache = new Map<string, readonly number[]>();
  return {
    mode: "hybrid",
    reason: null,
    lang,
    index,
    async vectorOf(question) {
      let v = cache.get(question);
      if (!v) cache.set(question, (v = roundVector(await embedder.embed(question, "query"))));
      return v;
    },
  };
}

/** Loads the pinned e5 model from the local cache and the language's index; falls back to lexical-only, and says so. */
export async function loadQueryEmbedding(
  forceLexical: boolean,
  lang: RetrievalLang = "fi",
  readIndex: (lang: RetrievalLang) => VectorIndexFile | null = readIndexFile,
): Promise<QueryEmbedding> {
  if (forceLexical) return lexical(lang, "--lexical given");
  const file = readIndex(lang);
  if (!file) return lexical(lang, `${indexFileOf(lang)} is absent; run \`npm run thinker:index\``);
  let embedder: Embedder;
  try {
    embedder = await loadE5Embedder({ allowRemote: false });
  } catch (e) {
    return lexical(lang, `e5 could not be loaded: ${(e as Error).message.split("\n")[0]}`);
  }
  return embeddingWith(embedder, vectorIndexOf(file), lang);
}

/** Hybrid retrieval at a view's start, as the proxy runs it, in the embedding's language. */
export async function retrieveAtView(
  question: string,
  view: number,
  embedding: QueryEmbedding,
  config: HybridConfig,
): Promise<RetrievedRecord[]> {
  const candidates = reachableAtoms(scenario.atoms, gateStepOfView(view));
  const queryVector = await embedding.vectorOf(question);
  return hybridRetrieve(question, candidates, queryVector && embedding.index ? { queryVector, index: embedding.index } : null, config, embedding.lang);
}
