/**
 * The structured query builder — SPEC/25. A query is three slots, KUKA × MITÄ × MILLOIN
 * (source × topic × time window), answered from the same closed corpus the free-text search and
 * the AI drawer read (I6). It is offered identically to every group (SPEC/02 revision (h)):
 * the Radio group finds information by navigating these categories, and the AI group has the
 * same builder plus the AI drawer, so the only difference between the groups is the AI.
 *
 * Adapted from the Harjula instrument's query engine (Norolansultan/PHD_test_Metacognition_
 * papers2and3, branch `claude/pelastuslaitos-simulaatio-docs-pz1wiy`): slot-built query key,
 * time-indexed corpus (nothing from the future exists), decoys in every result set, a fixed
 * response delay, and the observation time always shown.
 */

import { compareStrings } from "../engine/deterministic-object.js";
import type { VirtualTime } from "../engine/primitives.js";
import type { InfoAtom, NavCategoryId } from "../scenario/types.js";

export interface NavCategory {
  readonly id: NavCategoryId;
  readonly labelFi: string;
}

/** Fixed order — the order the builder shows them in, in every cycle. */
export const NAV_CATEGORIES: readonly NavCategory[] = [
  { id: "palo", labelFi: "Palo ja leviäminen" },
  { id: "saa", labelFi: "Sää" },
  { id: "yksikot", labelFi: "Yksiköt ja miehistö" },
  { id: "vesi_reitit", labelFi: "Vesi, tiet ja reitit" },
  { id: "maasto", labelFi: "Maasto ja metsävarat" },
  { id: "kohteet", labelFi: "Kohteet ja väestö" },
  { id: "ilma", labelFi: "Ilma-alukset ja dronet" },
  { id: "johto", labelFi: "Johto ja ohjeet" },
];

export type NavTimeWindow = "latest" | "last_cycle" | "whole_incident";

export const NAV_TIME_WINDOWS: readonly { readonly id: NavTimeWindow; readonly labelFi: string }[] = [
  { id: "latest", labelFi: "Viimeisin" },
  { id: "last_cycle", labelFi: "Viimeiset 20 min" },
  { id: "whole_incident", labelFi: "Koko tehtävä" },
];

/** `null` source = "Kaikki" (all sources). */
export interface NavQuery {
  readonly category: NavCategoryId;
  readonly sourceId: string | null;
  readonly window: NavTimeWindow;
}

/**
 * Fixed response delay, identical for the builder and the AI drawer so response time is not a
 * difference between groups (SPEC/25 §5; Harjula uses 2.5 s).
 */
export const NAV_RESPONSE_DELAY_MS = 2500;

/** At least this many non-load-bearing items per load-bearing item in its category (SPEC/25 §6). */
export const NAV_MIN_DECOYS_PER_LOAD_BEARING = 3;

const CYCLE_SECONDS = 1200;

function isStatic(atom: InfoAtom): boolean {
  return atom.record.kind === "reference";
}

/**
 * The KUKA list, sorted. Without `untilVirtual`: every source in the whole corpus. With it (the
 * session, researcher decision 2 Oct 2026, superseding SPEC/25 §2's whole-incident list): the
 * sources known by then — any item observed at or before `untilVirtual`, and register data. The
 * session passes the end of the current view, so the list changes only when a view opens, never
 * mid-view, and never names a unit or organisation that has not yet appeared (the whole-incident
 * list gave away the helicopter, the power company and the late reinforcements from the start).
 */
export function navigationSources(corpus: readonly InfoAtom[], untilVirtual?: number): readonly string[] {
  const set = new Set<string>();
  for (const a of corpus) if (untilVirtual === undefined || isStatic(a) || a.provenance.observedAt <= untilVirtual) set.add(a.provenance.sourceId);
  return [...set].sort(compareStrings);
}

/**
 * Answers a query at scenario time `now`. Returns references into `corpus` (closed, I6), newest
 * observation first, ties by id (I1). Nothing observed after `now` exists; register data
 * (`reference` records) is static and passes every time window.
 *
 * - `latest`: the most recent matching item from each source;
 * - `last_cycle`: items observed within the last twenty minutes;
 * - `whole_incident`: everything so far.
 */
export function navigate(query: NavQuery, corpus: readonly InfoAtom[], now: VirtualTime): readonly InfoAtom[] {
  const inScope = corpus.filter(
    (a) =>
      a.navCategory === query.category &&
      (query.sourceId === null || a.provenance.sourceId === query.sourceId) &&
      a.provenance.observedAt <= now,
  );
  const newestFirst = inScope.sort((a, b) =>
    a.provenance.observedAt !== b.provenance.observedAt ? b.provenance.observedAt - a.provenance.observedAt : compareStrings(a.id, b.id),
  );
  if (query.window === "whole_incident") return newestFirst;
  if (query.window === "last_cycle") return newestFirst.filter((a) => isStatic(a) || a.provenance.observedAt > now - CYCLE_SECONDS);
  const seen = new Set<string>();
  return newestFirst.filter((a) => {
    if (seen.has(a.provenance.sourceId)) return false;
    seen.add(a.provenance.sourceId);
    return true;
  });
}

export interface NavigationCoverageFailure {
  readonly atomId: string;
  readonly message: string;
}

/**
 * SPEC/25 §6: a load-bearing item must never be findable just because its category is otherwise
 * empty — every load-bearing item has at least NAV_MIN_DECOYS_PER_LOAD_BEARING non-load-bearing
 * items in the same category already visible by its cycle. This is what stops a category from
 * existing only for a load-bearing item and so giving it away.
 */
export function checkNavigationCoverage(corpus: readonly InfoAtom[]): readonly NavigationCoverageFailure[] {
  const valid = new Set<string>(NAV_CATEGORIES.map((c) => c.id));
  const failures: NavigationCoverageFailure[] = [];
  for (const a of corpus) {
    if (!valid.has(a.navCategory)) failures.push({ atomId: a.id, message: `unknown navigation category "${a.navCategory}"` });
  }
  for (const lb of corpus) {
    if (!lb.loadBearing) continue;
    const decoys = corpus.filter((a) => !a.loadBearing && a.navCategory === lb.navCategory && a.cycle <= lb.cycle).length;
    if (decoys < NAV_MIN_DECOYS_PER_LOAD_BEARING) {
      failures.push({
        atomId: lb.id,
        message: `load-bearing item in category "${lb.navCategory}" has ${decoys} non-load-bearing items beside it by cycle ${lb.cycle} (need ${NAV_MIN_DECOYS_PER_LOAD_BEARING})`,
      });
    }
  }
  return failures;
}

/** Scenario time used for queries during cycle `index`: the end of its working period. */
export function navigationNow(cycleIndex: number): VirtualTime {
  return (cycleIndex * CYCLE_SECONDS) as VirtualTime;
}
