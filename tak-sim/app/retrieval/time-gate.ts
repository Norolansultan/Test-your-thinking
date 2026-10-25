/**
 * The time gate — the one definition of what the query tools can reach (SPEC/14 revision (q),
 * pipeline step 1: "the records released by the current virtual time: the same set Haku can
 * reach"). Atoms carry their world-state STEP (SPEC/26 §2); an atom is reachable once its step has
 * been reached. Haku (`app/session/queries.ts`), Thinker's local fallback and the Thinker proxy
 * (`server/thinker/handler.ts`) all call this, so the three cannot drift apart.
 */

import type { InfoAtom } from "../scenario/types.js";
import { STEP_SECONDS } from "../scenario/views.js";

/**
 * The atoms of every step up to and including `step` — references into `atoms`, order kept.
 *
 * Revision (bm), 25 Oct 2026: a "report filed" pointer (`InfoAtom.pointer`, `pointers.ts`) is never reachable. It is a radio line in the
 * message log that says a report exists, not a record of the command post: it holds nothing to retrieve, and as the closest lexical
 * match to its own follow-up question ("EK12:n tilanneilmoitus") it would push the report it points to down the list (the echo of the
 * play-test, `docs/audits/2026-10-23-playtest/analysis.md` §10.3 d). Every other record is reachable exactly as before.
 */
export function reachableAtoms(atoms: readonly InfoAtom[], step: number): readonly InfoAtom[] {
  return atoms.filter((a) => a.cycle <= step && a.pointer === undefined);
}

/** What the gate needs of a view: where it starts and how many steps it covers (SPEC/26 §2). */
export interface GatedView {
  readonly startsAtVirtual: number;
  readonly steps: number;
}

/**
 * The step reached at virtual time `t` inside `view`, or null when `t` lies outside it. The clock
 * sits at the view's start, or at its second step's start after a merged view's step boundary
 * (`orchestrator.ts`); the view's end (its envelope horizon) still counts as its last step.
 */
export function stepAtVirtualTime(view: GatedView, t: number): number | null {
  const end = view.startsAtVirtual + view.steps * STEP_SECONDS;
  if (!Number.isFinite(t) || t < view.startsAtVirtual || t > end) return null;
  const first = view.startsAtVirtual / STEP_SECONDS + 1;
  const offset = Math.min(Math.floor((t - view.startsAtVirtual) / STEP_SECONDS), view.steps - 1);
  return first + offset;
}
