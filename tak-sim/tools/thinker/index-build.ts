/**
 * The index and query-vector files as text (SPEC/14 revisions (q) and (v)), from any embedder: the
 * build (`build-index.ts`) passes the pinned e5 model, tests a deterministic stub. One vector per
 * atom over the language's passage, rounded and sorted by atom id, one entry per line, so two builds
 * are byte-identical. The Finnish file has no `language` field (it predates it); the English one
 * says `"language":"en"`, and every lookup checks the passage hash in that language.
 */

import { compareStrings } from "../../app/engine/deterministic-object.js";
import { passageHash, passageText, roundVector, VECTOR_DECIMALS, type Embedder, type RetrievalLang } from "../../app/retrieval/hybrid.js";
import type { InfoAtom } from "../../app/scenario/types.js";

/** One entry per line, so the file diffs by atom. */
export function linesJson(head: Readonly<Record<string, unknown>>, listKey: string, entries: readonly unknown[]): string {
  const open = JSON.stringify(head).slice(0, -1);
  return `${open},"${listKey}":[\n${entries.map((e) => JSON.stringify(e)).join(",\n")}\n]}\n`;
}

/** The index file of a language (vectors rounded here too, so a stub embedder gives a stable file; rounding is idempotent for e5's). */
export async function buildIndexText(atoms: readonly InfoAtom[], embedder: Embedder, lang: RetrievalLang, dim: number): Promise<{ text: string; count: number }> {
  const sorted = [...atoms].sort((a, b) => compareStrings(a.id, b.id));
  const vectors = [];
  for (const atom of sorted) {
    const v = roundVector(await embedder.embed(passageText(atom, lang), "passage"));
    if (v.length !== dim) throw new Error(`expected ${dim} dimensions, got ${v.length}`);
    vectors.push({ id: atom.id, textHash: passageHash(atom, lang), v });
  }
  const head = lang === "en" ? { embedderId: embedder.id, language: "en", dim, precision: VECTOR_DECIMALS } : { embedderId: embedder.id, dim, precision: VECTOR_DECIMALS };
  return { text: linesJson(head, "atoms", vectors), count: vectors.length };
}

/** The authored questions' query vectors of a language. */
export async function buildQueriesText(questions: readonly string[], embedder: Embedder, lang: RetrievalLang): Promise<{ text: string; count: number }> {
  const queries = [];
  for (const text of questions) queries.push({ text, v: roundVector(await embedder.embed(text, "query")) });
  const head = lang === "en" ? { embedderId: embedder.id, language: "en", precision: VECTOR_DECIMALS } : { embedderId: embedder.id, precision: VECTOR_DECIMALS };
  return { text: linesJson(head, "queries", queries), count: queries.length };
}
