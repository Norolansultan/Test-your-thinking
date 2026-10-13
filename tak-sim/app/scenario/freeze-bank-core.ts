/**
 * The goal-based freeze item bank's building blocks (SPEC/08 amendment 2 Oct 2026): the item
 * definitions, the draft goal set, and the build-time option arrangement that balances the
 * correct option's position. The items themselves are in `freeze-bank.ts` (VP and phase A) and
 * `freeze-bank-b.ts` (phase B); the infrastructure slot and F7 stay in `demo-probes.ts`.
 *
 * Draft goal set (before a proper GDTA with rescue officers, which comes later):
 * - safety: crew positions against the fire, escape routes, spotting, crown-fire danger, fatigue;
 * - values: the Mökkiranta cabins, Lahdenkylä village, the 110 kV line;
 * - containment: the head, the flanks, lines holding, wind, fuel ahead;
 * - resources: water points, roads, arrivals, availability.
 */

import type { LatLon } from "../engine/primitives.js";
import { deriveSeed, Xorshift64Star } from "../engine/prng.js";
import type { FreezeItem, FreezeItemLevel } from "./types.js";
import { MAIN_VIEWS } from "./views.js";

export type FreezeGoal = NonNullable<FreezeItem["goal"]>;

/** How an item's key was obtained: computed from the CA bundle or corpus by a `freeze-keys.ts` rule, or authored with a cited basis. */
export type KeyRule = "computed" | "cited";

interface BaseDef {
  /** The id's last part: the item id is `freeze.<view>.<slug>` (or `freeze.practice.<slug>`). */
  readonly slug: string;
  readonly level: FreezeItemLevel;
  readonly goal: FreezeGoal;
  readonly promptFi: string;
  /** TRUTH: the corpus atoms the key rests on (empty for an L3 key, which rests on the CA's future). */
  readonly keyAtomIds: readonly string[];
  readonly rule: KeyRule;
  /** Where the key comes from, for the SPEC/08 table and the reviewer. */
  readonly basis: string;
  /**
   * TRUTH, L3 items (fix pass 4, 7 Oct 2026): the first and last step of the interval the key forecasts. The first is
   * always the freeze's now step (`minutesAhead`: the view's last step, the clock on screen at the freeze).
   */
  readonly keySteps?: readonly [number, number];
}

export interface ChoiceDef extends BaseDef {
  readonly kind: "choice";
  /** [id, Finnish label] pairs, as authored; the build reorders them (`arrangeOptions`). */
  readonly options: readonly (readonly [string, string])[];
  readonly key: string;
  /** TRUTH, analysis only (fix pass 7, 9 Oct 2026): the option the view's projection implies, where it differs from `key` (`PROJECTION_DIRECTION_KEYS` in `demo-directive.ts`). */
  readonly projectionOption?: string;
}

export interface PointDef extends BaseDef {
  readonly kind: "map_point";
  readonly point: LatLon;
  readonly toleranceM: number;
  /** TRUTH, analysis only: the projection's head at the item's clock (`head_later` items). */
  readonly projectionPoint?: LatLon;
}

export type ItemDef = ChoiceDef | PointDef;

/**
 * map_point tolerance rule: 200 m for an L1 item (where something is NOW: the map symbol plus
 * recall error at the session map's scale, about 3 % of the 7 km map width), 300 m for an L3 item
 * (where the head WILL BE: about 30 minutes of head travel at phase A's typical 7–10 m/min). An item may set its own
 * `toleranceM` where its target is small: V10's south front (fix pass 6, ≤ 100 m: a 0.8 ha patch, so 200 m would take the whole sector).
 */
export const MAP_TOLERANCE_M: Readonly<Record<"L1" | "L3", number>> = { L1: 200, L3: 300 };

export const choice = (d: Omit<ChoiceDef, "kind">): ChoiceDef => ({ kind: "choice", ...d });
export const point = (d: Omit<PointDef, "kind" | "toleranceM"> & { readonly level: "L1" | "L3"; readonly toleranceM?: number }): PointDef => ({ kind: "map_point", toleranceM: MAP_TOLERANCE_M[d.level], ...d });

/**
 * Minutes from the freeze's "now" to the END of `step` (fix pass 3, researcher decision 7 Oct 2026: projection
 * items are worded relative to now, not by clock). "Now" is the start of the view's LAST step, the clock the
 * participant sees at the freeze: every merged view's freeze falls after its step boundary (`freeze-bank.spec.ts`).
 */
export function minutesAhead(view: number, step: number): number {
  const v = MAIN_VIEWS.find((x) => x.index === view);
  if (!v) throw new RangeError(`no main view ${view}`);
  const m = (step - v.steps.at(-1)! + 1) * 20;
  if (m <= 0) throw new RangeError(`V${view}: step ${step} is not after the freeze`);
  return m;
}

/** "20 minuutin kuluttua", "tunnin kuluttua", "tunnin ja 20 minuutin kuluttua" … (whole 20-minute steps). */
export function inMinutesFi(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  const hours = h === 0 ? "" : h === 1 ? "tunnin" : h === 2 ? "kahden tunnin" : `${h} tunnin`;
  return h === 0 ? `${m} minuutin kuluttua` : m === 0 ? `${hours} kuluttua` : `${hours} ja ${m} minuutin kuluttua`;
}

/** The head-later map prompt (fix pass 3: relative to the freeze's now, was "klo 14.40" etc.). */
export const headLaterFi = (view: number, step: number) => `Merkitse kartalle, missä palon kärki on ${inMinutesFi(minutesAhead(view, step))}.`;

/** The clock at the END of a step ("14.40"), as a Finnish prompt writes it: step 1 starts at 13:20. */
export function stepEndClockFi(step: number): string {
  const minutes = 13 * 60 + 20 + step * 20;
  return `${Math.floor(minutes / 60)}.${String(minutes % 60).padStart(2, "0")}`;
}

/** The FreezeItem a definition stands for, its options in authored order. */
export function toItem(idPrefix: string, d: ItemDef): FreezeItem {
  const base = { id: `${idPrefix}.${d.slug}`, level: d.level, promptFi: d.promptFi, goal: d.goal, keyAtomIds: d.keyAtomIds };
  if (d.kind === "map_point") return { ...base, kind: "map_point", options: [], mapKey: { point: d.point, toleranceM: d.toleranceM }, ...(d.projectionPoint ? { projectionPoint: d.projectionPoint } : {}) };
  if (!d.options.some(([id]) => id === d.key)) throw new Error(`${base.id}: key ${d.key} is not an option`);
  if (d.projectionOption !== undefined && (d.projectionOption === d.key || !d.options.some(([id]) => id === d.projectionOption))) throw new Error(`${base.id}: projection option ${d.projectionOption} must be another option than the key`);
  return { ...base, kind: "choice", options: d.options.map(([id, labelFi]) => ({ id, labelFi, correct: id === d.key })), ...(d.projectionOption ? { projectionOptionId: d.projectionOption } : {}) };
}

const LEVEL_ORDER: Readonly<Record<FreezeItemLevel, number>> = { L1: 0, L2: 1, L3: 2 };
/** A freeze's items in presentation order: L1, then L2, then L3 (stable within a level). */
export const byLevel = (items: readonly FreezeItem[]): FreezeItem[] => [...items].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);

/**
 * The correct option's position, balanced at build time (identical for every participant): the
 * freezes are visited in the given order (phase A first, so its balance is the tightest), and
 * each choice item's correct option goes to the position used least so far by items of its
 * level, ties broken by one seeded stream; the distractors are shuffled by the same stream.
 * Positions therefore differ by at most one between any two slots within a level.
 */
export function arrangeOptions(freezes: readonly { readonly key: number; readonly items: readonly FreezeItem[] }[], seed: bigint): Map<number, FreezeItem[]> {
  const rng = new Xorshift64Star(deriveSeed(seed, "freeze-bank", "option-order"));
  const used: Record<FreezeItemLevel, number[]> = { L1: [0, 0, 0, 0], L2: [0, 0, 0, 0], L3: [0, 0, 0, 0] };
  const out = new Map<number, FreezeItem[]>();
  for (const f of freezes) {
    out.set(f.key, f.items.map((it) => {
      if ((it.kind ?? "choice") !== "choice") return it;
      const n = it.options.length;
      const counts = used[it.level].slice(0, n);
      const least = Math.min(...counts);
      const slots = counts.flatMap((c, i) => (c === least ? [i] : []));
      const at = slots[rng.nextInt(slots.length)]!;
      used[it.level][at] = (used[it.level][at] ?? 0) + 1;
      const key = it.options.find((o) => o.correct)!;
      const rest = rng.shuffle(it.options.filter((o) => !o.correct));
      return { ...it, options: [...rest.slice(0, at), key, ...rest.slice(at)] };
    }));
  }
  return out;
}

/** The scenario seed (`demo-scenario.ts`, `buildDemoScenario`), which the option arrangement draws from. */
export const FREEZE_BANK_SEED = 20260917n;
