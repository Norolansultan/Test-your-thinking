/**
 * The time gate — the one definition of what the query tools can reach (SPEC/14 revision (q),
 * pipeline step 1: "the records released by the current virtual time: the same set Haku can
 * reach"). Atoms carry their world-state STEP (SPEC/26 §2); an atom is reachable once its step has
 * been reached. Haku (`app/session/queries.ts`), Thinker's local fallback and the Thinker proxy
 * (`server/thinker/handler.ts`) all call this, so the three cannot drift apart.
 */

import type { InfoAtom } from "../scenario/types.js";
import { STEP_SECONDS } from "../scenario/views.js";

/** The atoms of every step up to and including `step` — references into `atoms`, order kept. */
export function reachableAtoms(atoms: readonly InfoAtom[], step: number): readonly InfoAtom[] {
  return atoms.filter((a) => a.cycle <= step);
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
