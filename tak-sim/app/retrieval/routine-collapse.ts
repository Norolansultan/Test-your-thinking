/**
 * Routine-line collapse for Thinker's retrieval candidates (SPEC/14 revision (q), §"Routine-line
 * collapse", 1 Oct 2026). Retrieval-only: Haku, the time gate and the log are unchanged.
 *
 * A generated log repeats some lines every step with only numbers or a place changed: position
 * lines ("AVL EK11: …"), asked-for status lines ("EK11 (kysyttäessä): …"), sensor and system logs
 * ("DR1 anturiloki: …"), the weather station. Twenty near-identical lines from one source crowd a
 * fixed top-k and push single records out. The rule keeps only the NEWEST record of each such
 * family that the time gate has released, so the family competes once, with its current value.
 *
 * A record belongs to a routine family when, by structure alone:
 * 1. it is not pushed and not lateral traffic (tier T2 or T3: logged or asked-for, never a report
 *    the commander was sent and never unit-to-unit talk);
 * 2. its text opens with a header — the part before the first ": " (at most
 *    {@link MAX_HEADER_LENGTH} characters) — that carries a LABEL: a word with no digit that is
 *    not the record's own source id ("AVL", "kysyttäessä", "anturiloki", "Sääasema"). A bare
 *    "EK11: …" has no label and is never a family;
 * 3. its body (the text after the header) says the same thing as the family's first member: the
 *    same named entities (all-caps or letter-digit codes such as "KY21", "W1", "VPK") and a word
 *    overlap (Jaccard, digits masked) of at least {@link BODY_SIMILARITY}. Records that share a
 *    header but say different things (a request and a fire report; one unit's refill and
 *    another's) are different families (fixed 1 Oct 2026 after review: the header alone merged
 *    them);
 * 4. the family — same source, same tier, same masked header, a similar body — has members in at
 *    least {@link RoutineCollapseConfig.minDistinctSteps} distinct steps among the gated
 *    candidates (it is periodic, not a one-off).
 *
 * Nothing here knows about any particular record: no id, no source name, no designed-event text.
 */

import { compareStrings } from "../engine/deterministic-object.js";
import type { InfoAtom } from "../scenario/types.js";
import { recordText } from "../session/template-answer.js";

export interface RoutineCollapseConfig {
  /** A family collapses only when its members span at least this many distinct steps. */
  readonly minDistinctSteps: number;
}

/** A header longer than this is prose with a colon in it, not a label. */
export const MAX_HEADER_LENGTH = 48;

/** Minimum word overlap (Jaccard, digits masked) for two bodies to be the same routine line. */
export const BODY_SIMILARITY = 0.5;

const HEADER = /^([^:\n]+):\s/u;
const WORD = /[\p{L}\p{N}]+/gu;

/** The masked header of a record's text, or null when the text has no labelled header. */
export function labelledHeader(text: string, sourceId: string): string | null {
  const m = HEADER.exec(text);
  if (!m || m[1]!.length > MAX_HEADER_LENGTH) return null;
  const header = m[1]!.trim();
  const source = sourceId.toLowerCase();
  const hasLabel = [...header.matchAll(WORD)].some((w) => !/\p{N}/u.test(w[0]) && w[0].toLowerCase() !== source);
  return hasLabel ? header.replace(/\p{N}+/gu, "#") : null;
}

/** The routine-family key of an atom (source, tier, masked header), or null if it is not eligible. */
export function routineFamilyKey(atom: InfoAtom): string | null {
  if (atom.tier !== "T2_system" && atom.tier !== "T3_person") return null;
  if (atom.record.kind === "lateral_traffic") return null;
  const header = labelledHeader(recordText(atom.record), atom.provenance.sourceId);
  return header === null ? null : `${atom.provenance.sourceId}\u0000${atom.tier}\u0000${header}`;
}

/** Newer observation first; then later step; then the larger id — a total, declared order. */
function newer(a: InfoAtom, b: InfoAtom): boolean {
  if (a.provenance.observedAt !== b.provenance.observedAt) return a.provenance.observedAt > b.provenance.observedAt;
  if (a.cycle !== b.cycle) return a.cycle > b.cycle;
  return compareStrings(a.id, b.id) > 0;
}

interface Body {
  readonly words: ReadonlySet<string>;
  readonly entities: string;
}

/** The text after the header: masked words, and the named entities it mentions (in order). */
export function bodyOf(text: string): Body {
  const body = text.slice((HEADER.exec(text)?.[0].length ?? 0));
  const tokens = [...body.matchAll(WORD)].map((w) => w[0]);
  const entities = tokens.filter((t) => t.length >= 2 && (/^\p{Lu}+$/u.test(t) || (/\p{L}/u.test(t) && /\p{N}/u.test(t))));
  return { words: new Set(tokens.map((t) => (/^\p{N}+$/u.test(t) ? "#" : t.toLowerCase()))), entities: entities.join(" ") };
}

/** Same entities and enough word overlap: the same routine line with its values changed. */
export function sameRoutineBody(a: Body, b: Body): boolean {
  if (a.entities !== b.entities) return false;
  let shared = 0;
  for (const w of a.words) if (b.words.has(w)) shared++;
  const union = a.words.size + b.words.size - shared;
  return union === 0 || shared / union >= BODY_SIMILARITY;
}

/** Older observation first; then earlier step; then the smaller id — the canonical family order. */
function older(a: InfoAtom, b: InfoAtom): number {
  if (a.provenance.observedAt !== b.provenance.observedAt) return a.provenance.observedAt - b.provenance.observedAt;
  if (a.cycle !== b.cycle) return a.cycle - b.cycle;
  return compareStrings(a.id, b.id);
}

/** A routine family among a candidate set: a stable id, its members' steps, and its newest member. */
export interface RoutineFamily {
  readonly id: string;
  readonly steps: ReadonlySet<number>;
  readonly newest: InfoAtom;
}

/**
 * The routine family of each eligible candidate. Within a header group, taken oldest first (so
 * the result does not depend on input order), a record joins the first family whose first
 * member's body it matches, else starts a new one. Pure and deterministic.
 */
export function routineFamilies(candidates: readonly InfoAtom[]): Map<InfoAtom, RoutineFamily> {
  const groups = new Map<string, InfoAtom[]>();
  for (const atom of candidates) {
    const key = routineFamilyKey(atom);
    if (key !== null) groups.set(key, [...(groups.get(key) ?? []), atom]);
  }
  const familyOf = new Map<InfoAtom, RoutineFamily>();
  for (const [key, members] of groups) {
    const families: { id: string; first: Body; newest: InfoAtom; steps: Set<number> }[] = [];
    for (const atom of [...members].sort(older)) {
      const body = bodyOf(recordText(atom.record));
      let f = families.find((g) => sameRoutineBody(g.first, body));
      if (!f) {
        f = { id: `${key}\u0000${families.length}`, first: body, newest: atom, steps: new Set<number>() };
        families.push(f);
      }
      f.steps.add(atom.cycle);
      if (newer(atom, f.newest)) f.newest = atom;
      familyOf.set(atom, f);
    }
  }
  return familyOf;
}

/**
 * The candidates with every routine family reduced to its newest member. Order is kept and the
 * result holds references into `candidates` (I6). Pure and deterministic.
 */
export function collapseRoutine(candidates: readonly InfoAtom[], config: RoutineCollapseConfig): InfoAtom[] {
  const familyOf = routineFamilies(candidates);
  return candidates.filter((atom) => {
    const f = familyOf.get(atom);
    return f === undefined || f.steps.size < config.minDistinctSteps || f.newest === atom;
  });
}
