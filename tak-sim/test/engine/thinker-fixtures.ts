/**
 * Shared fixtures for the Thinker tests (SPEC/14 revision (q)): the demo scenario, the frozen atom
 * index, and a "frozen" embedder that serves the authored questions' build-time query vectors
 * (`content/thinker/authored-queries.json`). The vector half therefore runs with the real
 * multilingual-e5-small vectors, without loading the model and without network.
 */

import { readFileSync } from "node:fs";
import { hybridRetrieve, vectorIndexOf, type Embedder, type HybridConfig, type RetrievedRecord, type VectorIndexFile } from "../../app/retrieval/hybrid.js";
import { reachableAtoms, stepAtVirtualTime } from "../../app/retrieval/time-gate.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";

export const scenario = buildDemoScenario();

const readJson = <T>(path: string): T => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")) as T;

export const indexFile = readJson<VectorIndexFile>("content/thinker/index.json");
export const vectorIndex = vectorIndexOf(indexFile);
const authored = readJson<{ embedderId: string; queries: { text: string; v: number[] }[] }>("content/thinker/authored-queries.json");

/** Serves only the authored questions; anything else throws (the test would need a new frozen vector). */
export const frozenEmbedder: Embedder = {
  id: authored.embedderId,
  async embed(text, role) {
    const q = authored.queries.find((x) => x.text === text);
    if (role !== "query" || !q) throw new Error(`no frozen query vector for "${text}" — add it to tools/thinker/authored-questions.ts and run \`npm run thinker:index\``);
    return q.v;
  },
};

export function queryVector(text: string): readonly number[] {
  const q = authored.queries.find((x) => x.text === text);
  if (!q) throw new Error(`no frozen query vector for "${text}"`);
  return q.v;
}

/** The step the proxy computes for a view at its start (the clock at view entry). */
export function stepAtViewStart(view: number): number {
  const spec = scenario.cycles.find((c) => c.index === view)!;
  return stepAtVirtualTime(spec, spec.startsAtVirtual)!;
}

/** Hybrid retrieval as the proxy runs it, at a view's start, with the real frozen vectors. */
export function retrieveAt(view: number, question: string, config?: HybridConfig): RetrievedRecord[] {
  return retrieveAtStep(stepAtViewStart(view), question, config);
}

export function retrieveAtStep(step: number, question: string, config?: HybridConfig): RetrievedRecord[] {
  return hybridRetrieve(question, reachableAtoms(scenario.atoms, step), { queryVector: queryVector(question), index: vectorIndex }, config);
}

export const ids = (records: readonly RetrievedRecord[]) => records.map((r) => r.atom.id);
