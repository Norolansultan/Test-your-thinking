/**
 * Option order for the closed items that list parts or sources (revision (ai), 9 Oct 2026): V13's area
 * item and the post-session questionnaire's multi-select items. The order is drawn ONCE from the
 * scenario's seed (the project's PRNG, `app/engine/prng.ts`, a stream of its own per item) and is the
 * same for every participant — the researcher's rule that everything a participant sees is identical
 * (SPEC/11 §7.25: the SA reviewer's per-participant randomisation was not adopted; open for the
 * supervisors). "Other"-type options stay last. The order is still logged with the item.
 */

import { deriveSeed, Xorshift64Star } from "../engine/prng.js";

export interface OptionOrderSeed {
  readonly scenarioSeed: bigint;
  readonly scenarioId: string;
  /** Kept for the log's provenance only; it does not change the order. */
  readonly participantCode: string;
}

/**
 * `ids` in the item's order: the ids not in `fixedLast` shuffled, then `fixedLast` in their given order
 * (only those among `ids`). Deterministic in (scenario seed, item id); the same for every participant.
 */
export function participantOptionOrder(ids: readonly string[], fixedLast: readonly string[], seed: OptionOrderSeed, itemId: string): string[] {
  const last = fixedLast.filter((id) => ids.includes(id));
  const free = ids.filter((id) => !last.includes(id));
  const rng = new Xorshift64Star(deriveSeed(seed.scenarioSeed, seed.scenarioId, `option-order\u0000${itemId}`));
  return [...rng.shuffle(free), ...last];
}
