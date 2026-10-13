/**
 * Route execution — the reachability half of SPEC/02_Conditions_and_Information_Routing.md
 * §4: "Every load-bearing fact must be reachable in every condition, by
 * that condition's own means... A load-bearing fact with fewer than
 * three routes is a scenario defect, not a subtlety."
 *
 * `createScenarioContract` (M2) already checks that a load-bearing
 * atom's route fields are non-null. This module answers the stronger
 * question SPEC/10 M5 asks: given the route an atom declares, does
 * *actually performing* that action (browsing that surface, asking that
 * unit, requesting that traffic selector, submitting that free-text
 * query) surface the atom — not merely "is the field populated."
 *
 * Scope: the four route kinds SPEC/02 revision (g) says are actually in
 * use for this study's two configured conditions — `directed` ->
 * `browse` | `request_traffic` | `ask_unit`; `substitutive` ->
 * `free_text` | `ask_unit`. `pushed`, `ask_duty_officer` and `channel`
 * execute to an empty, always-inconclusive result here (documented,
 * not silently wrong) since nothing in this study's reachability
 * checks needs them; the free-text simulation is deliberately simple
 * (token overlap against `retrievalKeys` and the source unit id) rather
 * than the real hybrid sparse+dense engine SPEC/14 specifies, since that
 * engine needs an embedding model choice SPEC/11 §7.1 lists as still
 * open — not something to guess at here.
 */

import type { InfoAtom, Route } from "../scenario/types.js";

function normaliseToken(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function tokenise(text: string): string[] {
  return text
    .split(/\s+/)
    .map(normaliseToken)
    .filter((t) => t.length > 0);
}

function recordSurfaceOf(atom: InfoAtom): string | null {
  const record = atom.record;
  if (record.kind === "reference") return record.surface;
  return record.kind === "radio_traffic" ? null : record.kind; // record.kind values line up with RecordSurface names except "radio_traffic", which has no browse surface of its own in this scope
}

/** Simulates performing `route` against the whole corpus, returning which atoms it would surface. */
export function executeRoute(route: Route, corpus: readonly InfoAtom[]): readonly InfoAtom[] {
  switch (route.kind) {
    case "browse":
      return corpus.filter((atom) => recordSurfaceOf(atom) === route.surface);

    case "ask_unit":
      return corpus.filter((atom) => atom.provenance.sourceId === route.unitId);

    case "request_traffic":
      return corpus.filter((atom) => {
        if (atom.record.kind !== "lateral_traffic" && atom.record.kind !== "traffic_log") return false;
        const r = atom.record;
        if (route.selector.byUnit) {
          const matchesUnit =
            (r.kind === "lateral_traffic" && (r.speakerUnitId === route.selector.byUnit || r.addresseeUnitId === route.selector.byUnit)) ||
            (r.kind === "traffic_log" && (r.callerId === route.selector.byUnit || r.calleeId === route.selector.byUnit));
          if (!matchesUnit) return false;
        }
        if (route.selector.byTimeWindow) {
          const [from, to] = route.selector.byTimeWindow;
          const at = r.kind === "lateral_traffic" ? r.at : r.startedAt;
          if (at < from || at > to) return false;
        }
        return true;
      });

    case "free_text": {
      const queryTokens = new Set(route.exampleQueries.flatMap(tokenise));
      return corpus.filter((atom) => {
        const keyTokens = atom.retrievalKeys.flatMap(tokenise);
        const sourceToken = normaliseToken(atom.provenance.sourceId);
        return keyTokens.some((k) => queryTokens.has(k)) || queryTokens.has(sourceToken);
      });
    }

    case "pushed":
    case "ask_duty_officer":
    case "channel":
      // Not exercised by this study's reachability checks (see module doc). Returning [] rather
      // than guessing keeps a caller's "was it reached" check honestly `false` instead of a false positive.
      return [];
  }
}

/** Whether executing `atom`'s own declared route for `field` (its own Route, not a route belonging to some other atom) actually surfaces `atom` itself. */
export function isReachableByExecutingItsOwnRoute(atom: InfoAtom, route: Route, corpus: readonly InfoAtom[]): boolean {
  return executeRoute(route, corpus).some((a) => a.id === atom.id);
}
