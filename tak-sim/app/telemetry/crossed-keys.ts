/**
 * Crossed two-element keys scored per half (SPEC/31 sagat F32, diagnostics only; 19 Oct 2026). The hinge check (the directive's
 * line × its aim) and V8's SPAM item (whether the cottages' state is known × whether a check was requested) cross two elements in each
 * option, so a wrong answer can still hold one half. The item's own score (`hingeCheckMeasure`, `spamMeasures`) stays the outcome;
 * these half scores are reported beside it. Analysis only: pure folds over the log and the content passed in (the options, their
 * elements and the key option — TRUTH), never called at runtime, never stored (SPEC/07 §1).
 */

import type { LogRecord } from "./log.js";
import type { HingeCheckAnsweredDetail, SpamAnsweredDetail } from "./record-kinds.js";

/** One crossed item: the two halves' names, each option's element per half, and the key option. */
export interface CrossedKeySpec {
  readonly probe: "hinge" | "spam";
  /** The hinge check's item id, or the SPAM probe id. */
  readonly itemId: string;
  readonly halves: readonly [string, string];
  readonly options: readonly { readonly id: string; readonly elements: readonly [string, string] }[];
  readonly keyOptionId: string;
}

/**
 * The elements of the two current crossed items, by their Finnish option label (DRAFT, from the authored items: `demo-probes.ts`
 * `HINGE_CHECK_AUTHORED`, `SPAM_AUTHORED[8]`). The hinge check's halves are the two parts of each label (`; `); V8's are authored, since
 * a "checked" option implies the check was requested.
 */
export const CROSSED_ELEMENTS: Readonly<Record<"hinge" | "spam_v8", { readonly halves: readonly [string, string]; readonly byLabel: readonly { readonly labelFi: string; readonly elements: readonly [string, string] }[] }>> = {
  hinge: {
    halves: ["line", "aim"],
    byLabel: [
      { labelFi: "Linjat teiden ja vesistöjen varaan; suojataan Lahdenkylä ja Mökkiranta", elements: ["roads_and_water", "villages"] },
      { labelFi: "Suora hyökkäys palon reunaan; suojataan Lahdenkylä ja Mökkiranta", elements: ["direct_attack", "villages"] },
      { labelFi: "Linjat teiden ja vesistöjen varaan; suojataan johtopaikka ja vesipisteet", elements: ["roads_and_water", "command_post_and_water"] },
      { labelFi: "Suora hyökkäys palon reunaan; kärjen pysäyttäminen koillisessa", elements: ["direct_attack", "head_north_east"] },
    ],
  },
  spam_v8: {
    halves: ["known", "requested"],
    byLabel: [
      { labelFi: "Ei tiedossa: poliisi on pyydetty tarkistamaan", elements: ["not_known", "requested"] },
      { labelFi: "Ei tiedossa: tarkistusta ei ole vielä pyydetty", elements: ["not_known", "not_requested"] },
      { labelFi: "Tarkistettu: poliisin mukaan mökit ovat tyhjiä", elements: ["checked", "requested"] },
      { labelFi: "Tarkistettu: poliisin mukaan mökeissä on ihmisiä", elements: ["checked", "requested"] },
    ],
  },
};

/** A spec from an item's options (id + Finnish label, as the scenario carries them) and an element table; throws on an unknown label. */
export function crossedSpecOf(
  probe: "hinge" | "spam", itemId: string, options: readonly { readonly id: string; readonly labelFi: string }[], keyOptionId: string,
  table: (typeof CROSSED_ELEMENTS)["hinge"],
): CrossedKeySpec {
  return {
    probe, itemId, halves: table.halves, keyOptionId,
    options: options.map((o) => {
      const row = table.byLabel.find((x) => x.labelFi === o.labelFi);
      if (!row) throw new Error(`crossed key ${itemId}: option ${o.id} "${o.labelFi}" has no elements`);
      return { id: o.id, elements: row.elements };
    }),
  };
}

export interface CrossedHalfScore {
  readonly itemId: string;
  readonly optionId: string;
  readonly halves: readonly [string, string];
  /** Each half right (the chosen option's element equals the key option's). */
  readonly halfCorrect: readonly [boolean, boolean];
  readonly bothCorrect: boolean;
}

/** One answer's half scores; null for no answer or an option the spec does not know. */
export function crossedHalfScore(spec: CrossedKeySpec, optionId: string | null): CrossedHalfScore | null {
  const chosen = spec.options.find((o) => o.id === optionId), key = spec.options.find((o) => o.id === spec.keyOptionId);
  if (optionId === null || !chosen || !key) return null;
  const halfCorrect: [boolean, boolean] = [chosen.elements[0] === key.elements[0], chosen.elements[1] === key.elements[1]];
  return { itemId: spec.itemId, optionId, halves: spec.halves, halfCorrect, bothCorrect: halfCorrect[0] && halfCorrect[1] };
}

/** The first answer to each spec's item in a log (`hinge_check_answered`, or the probe's first non-timed-out `spam_answered`), scored per half. */
export function crossedKeyScores(records: readonly LogRecord[], specs: readonly CrossedKeySpec[]): (CrossedHalfScore | null)[] {
  return specs.map((spec) => {
    if (spec.probe === "hinge") {
      const r = records.find((x) => x.kind === "hinge_check_answered" && (x.detail as HingeCheckAnsweredDetail).itemId === spec.itemId);
      return crossedHalfScore(spec, r ? (r.detail as HingeCheckAnsweredDetail).optionId : null);
    }
    const r = records.find((x) => x.kind === "spam_answered" && (x.detail as SpamAnsweredDetail).probeId === spec.itemId);
    const d = r?.detail as SpamAnsweredDetail | undefined;
    return crossedHalfScore(spec, d && !d.timedOut ? d.response : null);
  });
}
