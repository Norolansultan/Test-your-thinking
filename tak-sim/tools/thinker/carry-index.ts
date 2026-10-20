/**
 * `npm run thinker:index -- --carry` (SPEC/31 §7 WP-1, 19 Oct 2026): a PROVISIONAL index for a machine without the embedding model
 * (Hugging Face is blocked in the build container). No vector is computed; every atom gets a vector of the PREVIOUS index:
 *
 * - its own, when its passage is unchanged (the text hash is found in the previous index, whatever the atom's id now is): exact,
 *   unless that previous entry was itself carried, which keeps its `carriedFrom` and counts as carried;
 * - else the vector of the previous atom whose Finnish text is most like it (token overlap), the same id first when it still reads
 *   alike, else the most alike record of the same step: an approximation of a reworded record, marked `carriedFrom` in the entry.
 *
 * The previous texts come from the corpus the previous index was built from (`content/corpus/interaction-log.jsonl` before
 * `npm run corpus:export` rewrites it); each is checked against the previous index's hash, and a text that does not match is not used.
 * The manifest's `index`/`indexEn` blocks say how many vectors were carried. A carried vector belongs to another text: the index is
 * NOT the declared treatment until `npm run thinker:index` (both languages, with the model) rebuilds it — before any session.
 */

import { readFileSync } from "node:fs";
import { compareStrings } from "../../app/engine/deterministic-object.js";
import { hashString64 } from "../../app/engine/prng.js";
import { passageHash, type RetrievalLang, type VectorIndexFile } from "../../app/retrieval/hybrid.js";
import type { InfoAtom } from "../../app/scenario/types.js";
import { linesJson } from "./index-build.js";

/** A previous record: its step and its Finnish passage (source id + ': ' + text), verified against the previous index. */
export interface PreviousText { readonly step: number; readonly passageFi: string }

const fnv = (s: string) => hashString64(s).toString(16).padStart(16, "0");

/** The previous corpus's Finnish passages, by id, kept only where they hash to the previous Finnish index's entry. */
export function previousTexts(corpusPath: string, previousFi: VectorIndexFile): Map<string, PreviousText> {
  const hashById = new Map(previousFi.atoms.map((a) => [a.id, a.textHash] as const));
  const out = new Map<string, PreviousText>();
  for (const line of readFileSync(corpusPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const e = JSON.parse(line) as { id: string; cycle: number; actor: string; content: string };
    const passageFi = `${e.actor}: ${e.content}`;
    if (hashById.get(e.id) === fnv(passageFi)) out.set(e.id, { step: e.cycle, passageFi });
  }
  return out;
}

const TOKEN = /[\p{L}\p{N}]+/gu;
const tokens = (s: string) => new Set((s.toLowerCase().match(TOKEN) ?? []));
function overlap(a: string, b: string): number {
  const x = tokens(a), y = tokens(b);
  let n = 0;
  for (const t of x) if (y.has(t)) n += 1;
  return n / Math.max(1, x.size + y.size - n);
}
/** A reworded record that still reads like its previous self (same id): above this overlap, keep its own previous vector. */
const SAME_ID_OVERLAP = 0.5;

/**
 * The carried index text of a language. `passageFiOf` gives an atom's Finnish passage (for matching; the English index is matched on
 * the Finnish too, so both languages carry from the same previous record). Throws if an atom has no previous record to carry from.
 */
export function carryIndexText(
  atoms: readonly InfoAtom[], lang: RetrievalLang, previous: VectorIndexFile, texts: ReadonlyMap<string, PreviousText>, passageFiOf: (a: InfoAtom) => string,
): { readonly text: string; readonly count: number; readonly carried: number } {
  // A previous entry that was itself carried (a second `--carry` before the model rebuild, 20 Oct 2026) keeps its `carriedFrom`
  // and counts as carried: its vector still belongs to another text, though its passage is unchanged (the first carry's 210/281
  // vectors would otherwise read as exact).
  const prevAtoms = previous.atoms as readonly ((typeof previous.atoms)[number] & { readonly carriedFrom?: string })[];
  const byHash = new Map(prevAtoms.map((a) => [a.textHash, a] as const));
  const byId = new Map(prevAtoms.map((a) => [a.id, a] as const));
  const sorted = [...atoms].sort((a, b) => compareStrings(a.id, b.id));
  let carried = 0;
  const entries = sorted.map((atom) => {
    const textHash = passageHash(atom, lang);
    // Its own previous entry first: two atoms with one passage may carry different vectors (the first carry's), and an unchanged
    // atom keeps its own.
    const mine = byId.get(atom.id);
    const exact = mine?.textHash === textHash ? mine : byHash.get(textHash);
    if (exact?.carriedFrom !== undefined) { carried += 1; return { id: atom.id, textHash, carriedFrom: exact.carriedFrom, v: exact.v }; }
    if (exact) return { id: atom.id, textHash, v: exact.v };
    const fi = passageFiOf(atom);
    const own = texts.get(atom.id);
    let from: string | null = own && byId.has(atom.id) && overlap(own.passageFi, fi) >= SAME_ID_OVERLAP ? atom.id : null;
    if (!from) {
      let best = -1;
      for (const [id, t] of texts) {
        if (t.step !== atom.cycle || !byId.has(id)) continue;
        const o = overlap(t.passageFi, fi);
        if (o > best || (o === best && from !== null && compareStrings(id, from) < 0)) { best = o; from = id; }
      }
    }
    if (!from && byId.has(atom.id)) from = atom.id;
    if (!from) throw new Error(`thinker:index --carry: no previous record to carry a vector from for ${atom.id}`);
    carried += 1;
    return { id: atom.id, textHash, carriedFrom: from, v: byId.get(from)!.v };
  });
  const head = lang === "en"
    ? { embedderId: previous.embedderId, language: "en", dim: previous.dim, precision: previous.precision }
    : { embedderId: previous.embedderId, dim: previous.dim, precision: previous.precision };
  return { text: linesJson(head, "atoms", entries), count: entries.length, carried };
}
