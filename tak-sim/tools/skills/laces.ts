/**
 * LACES of the ground placements (`tactical_check.py` reads `escape_route`, `safety_zone`, `comms`; a null fails LACES),
 * read from what each crew itself says in the records (SPEC/31 §5 D8: the LCES lines). Nothing is inferred: an item is
 * the crew's own most recent statement of it, quoted with its record id, or null.
 *
 * Records: the unit's own, as `fire-observations.ts` associates records with units and steps (`recordsOfStep`: the
 * traffic by `actor`, the incident radio by `from`, the story beats by author, the corpus's other atoms by source), logged
 * in the placement's step or before it, in time order. Another crew's words do not count for a crew (EK11's 13:24 line
 * "EK11 vasen ja EK12 oikea laita … Perääntymistie palaneelle alueelle" is EK11's).
 *
 * Postings (the persistence rule): a stated escape route, safety zone or lookout holds for the unit's POSTING, the run of
 * consecutive steps in which it is placed with the same task (`unitWork.task`) and within `SAME_STRETCH_M` of where the
 * posting began (its position in the posting's first step). A step in which the unit is not placed, a different task,
 * or a position farther than that from the posting's first position starts a new posting, and the items must then be
 * stated again: only records logged in the posting's steps (from its first step to the placement's) count. A task
 * changed in place counts as a new task (the generator turns an attack into mop-up when the edge goes cold:
 * conservative, the crew must restate). The steps are the scenario's own (`SITE_SCENARIO.steps`): the practice step
 * (−3) and step 1 are not consecutive.
 *
 * Statements, by clause (a sentence split at ", " and "; " outside parentheses):
 * - escape route: "perääntymistie" (the noun itself, not "perääntymistien"), "pakotie", "vetäytymisreitti", and "Jos
 *   joudumme lähtemään, reitti: …"; not the instruction to other crews "Varmistakaa perääntymistie" (after a wind
 *   shift). The phrase is the clause, or the sentence when the clause points back with "sinne" or is the "Jos …" form;
 * - safety zone: "turva-alue" in any form ("Turva-alue: …", "… (turva-alue)", "palanutta alaa turva-alueena") and
 *   "turvaan" ("Miehet siirtyivät palaneelle alueelle turvaan"); the phrase is the clause;
 * - lookout (not read by the check): any "tähystäjä…" clause ("Tähystäjä nimetty", "meillä tähystäjä itäpuolella",
 *   "tähystäjä ei näe kärkeä").
 * A withdrawal in progress ("EK11 vetäytyy tielle R1 palaneelle alueelle (turva-alue)") states the safety zone, not a route.
 *
 * Comms: the scenario gives every ground unit a VIRVE radio and has no talk-group field, so `comms` is "VIRVE (radio
 * reports in the record)" once the unit has a radio record (any own record but the automatic system log: AVL positions)
 * logged in the placement's step or before; `comms_source` is the latest. A unit that has not spoken stays null. Comms
 * do not depend on the posting. Limitation: the radio dead zone (SPEC/18 §10 F3, EK14 at 16:00) is silent by design, so
 * it does not show here.
 */

import type { InfoAtom } from "../../app/scenario/types.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { recordsOfStep, type StepRecord } from "./fire-observations.js";
import { cycleOfStep, dist, toEN, type EN } from "./geo.js";

/**
 * A crew farther than this from where its posting began has moved to a new position. The generator lets a crew holding
 * its stretch walk along it up to 220 m from where it took it over (`tools/fire-ca/site-export.ts` WALK_RANGE_M); in the
 * scenario, a crew keeping its task drifts at most 206 m from its posting's first position (EK15 cutting its firebreak),
 * and the nearest relocation with the same task is 283 m (EK11 to the esker at 14.00, a logged move).
 */
export const SAME_STRETCH_M = 220;

export const COMMS_VIRVE = "VIRVE (radio reports in the record)";

export interface Laces {
  readonly escape_route: string | null;
  readonly escape_route_source: string | null;
  readonly safety_zone: string | null;
  readonly safety_zone_source: string | null;
  readonly lookout: string | null;
  readonly lookout_source: string | null;
  readonly comms: string | null;
  readonly comms_source: string | null;
  /** The cycle the unit's current posting began in (the statements count from there). */
  readonly posting_from_cycle: number;
}

// ---------------------------------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------------------------------

/** The clauses of a sentence: split at ", " and "; " outside parentheses. */
function clausesOf(sentence: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (let i = 0; i < sentence.length; i++) {
    const c = sentence[i]!;
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && (c === "," || c === ";") && sentence[i + 1] === " ") { out.push(cur.trim()); cur = ""; i++; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const sentencesOf = (text: string): string[] => text.split(/(?<=[.!?])\s+/).map((s) => s.trim().replace(/[.!?]$/, "")).filter((s) => s !== "");

const ESCAPE = /\b(?:perääntymistie|pakotie|vetäytymisreitti)\b/i;
const ESCAPE_ORDER = /\bvarmistakaa perääntymistie\b/i;
const ESCAPE_IF = /^Jos joudumme lähtemään, reitti: \S/i;
const SAFETY = /turva-alue|\bturvaan\b/i;
const LOOKOUT = /tähystäj/i;

export type LacesItem = "escape_route" | "safety_zone" | "lookout";

/** The phrase in `text` that states the item, or null (the first such clause; see the header for the rules). */
export function statedIn(text: string, item: LacesItem): string | null {
  for (const sentence of sentencesOf(text)) {
    if (item === "escape_route" && ESCAPE_IF.test(sentence)) return sentence;
    for (const clause of clausesOf(sentence)) {
      if (item === "escape_route" && ESCAPE.test(clause) && !ESCAPE_ORDER.test(clause)) return /\bsinne\b/i.test(clause) ? sentence : clause;
      if (item === "safety_zone" && SAFETY.test(clause)) return clause;
      if (item === "lookout" && LOOKOUT.test(clause)) return clause;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------
// Postings
// ---------------------------------------------------------------------------------------------------

let postingCache: Map<string, Map<number, number>> | null = null;

/** Unit → step → the step its posting began in (only steps the unit is placed in). */
function postings(): Map<string, Map<number, number>> {
  if (postingCache) return postingCache;
  const out = new Map<string, Map<number, number>>();
  for (const u of SITE_SCENARIO.units) {
    const starts = new Map<number, number>();
    let cur: { start: number; xy: EN; task: string | null; last: number } | null = null;
    for (const s of SITE_SCENARIO.steps) {
      const at = s.units[u.id];
      if (!at) { cur = null; continue; }
      const xy = toEN(at);
      const task = s.unitWork[u.id]?.task ?? null;
      if (!cur || cur.last !== s.index - 1 || cur.task !== task || dist(xy, cur.xy) > SAME_STRETCH_M) cur = { start: s.index, xy, task, last: s.index };
      else cur.last = s.index;
      starts.set(s.index, cur.start);
    }
    out.set(u.id, starts);
  }
  postingCache = out;
  return out;
}

/** The step the unit's posting at `step` began in; null when the unit is not placed in that step. */
export function postingStart(unitId: string, step: number): number | null {
  return postings().get(unitId)?.get(step) ?? null;
}

// ---------------------------------------------------------------------------------------------------
// Per placement
// ---------------------------------------------------------------------------------------------------

const recordCache = new WeakMap<readonly InfoAtom[], Map<string, StepRecord[]>>();

/** Every record of the scenario's steps by its source, in time order (ties: the order `recordsOfStep` gives). */
function recordsBySource(atoms: readonly InfoAtom[]): Map<string, StepRecord[]> {
  const hit = recordCache.get(atoms);
  if (hit) return hit;
  const all = SITE_SCENARIO.steps.flatMap((s) => recordsOfStep(s.index, atoms)).map((r, k) => ({ r, k }));
  all.sort((a, b) => a.r.t - b.r.t || a.k - b.k);
  const out = new Map<string, StepRecord[]>();
  for (const { r } of all) {
    const list = out.get(r.source);
    if (list) list.push(r);
    else out.set(r.source, [r]);
  }
  recordCache.set(atoms, out);
  return out;
}

/** The LACES items of a ground unit placed in `step`, from its own records (`atoms`: the corpus atoms, as `recordsOfStep`). */
export function lacesOf(unitId: string, step: number, atoms: readonly InfoAtom[] = []): Laces {
  const start = postingStart(unitId, step) ?? step;
  const mine = (recordsBySource(atoms).get(unitId) ?? []).filter((r) => r.step <= step);
  const latest = (item: LacesItem): [string | null, string | null] => {
    let found: [string | null, string | null] = [null, null];
    for (const r of mine) {
      if (r.step < start) continue;
      const phrase = statedIn(r.text_fi, item);
      if (phrase !== null) found = [phrase, r.id];
    }
    return found;
  };
  const [escape, escapeId] = latest("escape_route");
  const [zone, zoneId] = latest("safety_zone");
  const [lookout, lookoutId] = latest("lookout");
  const radio = mine.filter((r) => r.channel !== "system_log");
  const lastRadio = radio[radio.length - 1] ?? null;
  return {
    escape_route: escape, escape_route_source: escapeId, safety_zone: zone, safety_zone_source: zoneId,
    lookout, lookout_source: lookoutId,
    comms: lastRadio ? COMMS_VIRVE : null, comms_source: lastRadio?.id ?? null,
    posting_from_cycle: cycleOfStep(start),
  };
}
