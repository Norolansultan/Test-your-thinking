/**
 * The goal-based freeze item bank's building blocks (SPEC/08 amendment 2 Oct 2026): the item
 * definitions, the draft goal set, and the build-time option arrangement that balances the
 * correct option's position. The items themselves are in `freeze-bank.ts` (VP and phase A) and
 * `freeze-bank-b.ts` (phase B); the infrastructure slot and F7 stay in `demo-probes.ts`.
 *
 * Draft goal set (before a proper GDTA with rescue officers, which comes later):
 * - safety: crew positions against the fire, escape routes, spotting, crown-fire danger, fatigue;
 * - values: the Mökkiranta cabins, Lahdenkylä village, the 20 kV line (110 kV before SPEC/33 (bc));
 * - containment: the head, the flanks, lines holding, wind, fuel ahead;
 * - resources: water points, roads, arrivals, availability.
 *
 * `31` (19 Oct 2026, the SA probe audit decided): "now" is the screen's clock at the freeze — the start of the view's last step, or,
 * for a freeze at the view's end (`FREEZE_AT_VIEW_END`: V10, V12, V14), the view's end (`nowStepOf`); every L3 stem names its horizon
 * from it (`inMinutesFi`, `withinMinutesFi`); ordinal bands are shown in ascending order and left out of the position balance
 * (`isOrdinal`); L3 items carry `basisKind` and `basisAtomIds` (analysis only, never on screen).
 *
 * Play-test D1 (researcher, 24 Oct 2026, option (a): one definition of "now"): the freeze header names the span of the period's latest
 * reports (the view's last step, `freezeNowClock`) and defines "now" as the situation they give; a phase-A L1/L2 stem whose key rests on
 * that step's later-stamped records says "viimeisimpien tietojen mukaan" for "nyt"; the L3 horizons stay counted from `nowStepOf`, and
 * each stem states its target clock next to the horizon (`horizonFi`, `withinHorizonFi`: "40 minuutin kuluttua (klo 14.40)"), the clock the
 * key is read at (`stepEndClockFi`), so no horizon is ambiguous.
 *
 * Play-test R1 (researcher, 25 Oct 2026; SPEC/08 (bh)): every L3 stem states the clock only ("klo 14.40", "klo 15.40 mennessä"). The
 * minutes counted from `nowStepOf` (the START of the header's span in phase A, its END in phase B) contradicted the header's "now" (the
 * span's end) by one step in phase A. No key changes: the clock is the one the key is read at. `minutesAhead` still gives the interval the
 * key reads (analysis); the horizon from the header's "now" is the audit's `horizon_min` (`difficulty-audit.ts`).
 */

import type { LatLon } from "../engine/primitives.js";
import { deriveSeed, Xorshift64Star } from "../engine/prng.js";
import type { FreezeItem, FreezeItemLevel } from "./types.js";
import { FREEZE_AT_VIEW_END, MAIN_VIEWS, PRACTICE_STEP, PRACTICE_VIEW_INDEX } from "./views.js";
import { withKeyStatements } from "./freeze-key-statements.js";

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
  /** Where the key comes from, for the SPEC/08 table and the reviewer; its figures are computed at build time (`31` F22). */
  readonly basis: string;
  /**
   * TRUTH, L3 items (fix pass 4, 7 Oct 2026): the first and last step of the interval the key forecasts. The first is always the freeze's
   * now step (`nowStepOf`), the last the step whose end is the stated horizon (`minutesAhead`).
   */
  readonly keySteps?: readonly [number, number];
  /** TRUTH, analysis only, L3 items (`31` §3.9): what the key rests on (`FreezeItem.basisKind`). */
  readonly basisKind?: NonNullable<FreezeItem["basisKind"]>;
  /** TRUTH, analysis only, L3 items (`31` §3.9): the delivered records the key rests on (`FreezeItem.basisAtomIds`). */
  readonly basisAtomIds?: readonly string[];
  /**
   * TRUTH, report-keyed items (`31` §3.5 rule (1)): the steps whose reported fire the key's extrapolation reads. Each is drawn on the map of
   * the freeze's view or an earlier one, or delivered by a pushed record in `basisAtomIds` (`test/scenario/freeze-rules.spec.ts`).
   */
  readonly basisSteps?: readonly number[];
  /** Analysis only (`31` proposal (a)): `FreezeItem.family`. */
  readonly family?: NonNullable<FreezeItem["family"]>;
  /** Analysis only (play-test R2, 25 Oct 2026): `FreezeItem.scoredFor` — scored outside H2 and every SA composite. */
  readonly scoredFor?: NonNullable<FreezeItem["scoredFor"]>;
}

export interface ChoiceDef extends BaseDef {
  readonly kind: "choice";
  /** [id, Finnish label] pairs, as authored; the build reorders them (`arrangeOptions`), except ordinal bands, shown ascending. */
  readonly options: readonly (readonly [string, string])[];
  readonly key: string;
  /** TRUTH, analysis only (fix pass 7, 9 Oct 2026): the option the view's projection implies, where it differs from `key` (`PROJECTION_DIRECTION_KEYS` in `demo-directive.ts`). */
  readonly projectionOption?: string;
  /** TRUTH, analysis only (`31` §3.5): the fire model's band where it differs from a report-keyed key (`FreezeItem.truthOptionId`). */
  readonly truthOption?: string;
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
 * `toleranceM` (V12's `head_later`, 250 m). Play-test D8 (24 Oct 2026): V10's south front takes the L1 200 m like the others (it set
 * 100 m in fix pass 6, for a 0.8 ha patch; on the blank basemap all three play-test players missed it at 112–203 m).
 * `31` rule (2): an L3 map key lies at least 2 × its tolerance from the head drawn at "now" (`freeze-rules.spec.ts`).
 */
export const MAP_TOLERANCE_M: Readonly<Record<"L1" | "L3", number>> = { L1: 200, L3: 300 };

export const choice = (d: Omit<ChoiceDef, "kind">): ChoiceDef => ({ kind: "choice", ...d });
export const point = (d: Omit<PointDef, "kind" | "toleranceM"> & { readonly level: "L1" | "L3"; readonly toleranceM?: number }): PointDef => ({ kind: "map_point", toleranceM: MAP_TOLERANCE_M[d.level], ...d });

/**
 * The freeze's "now" step (`31` §3.8): the step whose START is the clock on screen when the freeze opens — the view's last step for a
 * freeze inside the view (`08` y.1: every merged view's freeze falls after its step boundary), the step after it for a freeze at the
 * view's end (V10 17.40, V12 19.00, V14 20.00; V14's is step 21, beyond the scenario's data: its L3 keys are report-keyed only).
 */
export function nowStepOf(view: number): number {
  if (view === PRACTICE_VIEW_INDEX) return PRACTICE_STEP;
  const v = MAIN_VIEWS.find((x) => x.index === view);
  if (!v) throw new RangeError(`no main view ${view}`);
  return v.steps.at(-1)! + (FREEZE_AT_VIEW_END.has(view) ? 1 : 0);
}

/**
 * Minutes from the freeze's "now" to the END of `step` (fix pass 3, researcher decision 7 Oct 2026: projection items are worded relative
 * to now, not by clock; `31` §3.8: now is `nowStepOf`'s start).
 */
export function minutesAhead(view: number, step: number): number {
  const m = (step - nowStepOf(view) + 1) * 20;
  if (m <= 0) throw new RangeError(`V${view}: step ${step} is not after the freeze`);
  return m;
}

const hoursFi = (h: number) => (h === 1 ? "tunnin" : h === 2 ? "kahden tunnin" : `${h} tunnin`);

/** "20 minuutin kuluttua", "tunnin kuluttua", "tunnin ja 20 minuutin kuluttua" … (whole 20-minute steps). */
export function inMinutesFi(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h === 0 ? `${m} minuutin kuluttua` : m === 0 ? `${hoursFi(h)} kuluttua` : `${hoursFi(h)} ja ${m} minuutin kuluttua`;
}

/** `31` F08: "seuraavan 20 minuutin aikana", "seuraavan tunnin aikana", "seuraavan tunnin ja 20 minuutin aikana" … (whole 20-minute steps). */
export function withinMinutesFi(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h === 0 ? `seuraavan ${m} minuutin aikana` : m === 0 ? `seuraavan ${hoursFi(h)} aikana` : `seuraavan ${hoursFi(h)} ja ${m} minuutin aikana`;
}

/** The clock at the END of a step ("14.40"), as a Finnish prompt writes it: step 1 starts at 13:20. */
export function stepEndClockFi(step: number): string {
  const minutes = 13 * 60 + 20 + step * 20;
  return `${Math.floor(minutes / 60)}.${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * An L3 horizon as the clock the key is read at, the END of `step` (`stepEndClockFi`): "klo 14.40". Play-test R1 (25 Oct 2026): the clock
 * only (D1 had "40 minuutin kuluttua (klo 14.40)", whose minutes ran from the start of the header's span in phase A). `view` is checked: the
 * step must lie after the freeze's now (`minutesAhead` throws otherwise).
 */
export const horizonFi = (view: number, step: number): string => { minutesAhead(view, step); return `klo ${stepEndClockFi(step)}`; };
/** Play-test R1: "klo 15.00 mennessä" (was "seuraavan tunnin aikana (klo 15.00 mennessä)"). */
export const withinHorizonFi = (view: number, step: number): string => `${horizonFi(view, step)} mennessä`;

/** Play-test D1 (24 Oct 2026): the head "now" as the header defines it, the period's latest reports (V5 and V12; VP keeps the plain stem). */
export const HEAD_NOW_LATEST_FI = "Merkitse kartalle palon kärki viimeisimpien tietojen mukaan.";

/** The head-later map prompt (fix pass 3: relative to the freeze's now; play-test R1: the clock only, "… on klo 15.00."). */
export const headLaterFi = (view: number, step: number) => `Merkitse kartalle, missä palon kärki on ${horizonFi(view, step)}.`;

/** An ordinal band id: `lt<n>`, `m<lo>_<hi>` or `gt<n>`. */
const BAND_ID = /^(?:lt\d+|m\d+_\d+|gt\d+)$/;
/** The band's lower bound (−∞ for `lt`). */
function bandLow(id: string): number {
  if (id.startsWith("lt")) return Number.NEGATIVE_INFINITY;
  return Number(/^(?:m|gt)(\d+)/.exec(id)![1]);
}

/**
 * `31` F11 (19 Oct 2026): an item whose every option is an ordinal band (a quantity's ranges). It is shown in ascending order, its key
 * where its value puts it, and left out of the correct position's balance (`arrangeOptions`).
 */
export function isOrdinal(item: Pick<FreezeItem, "options" | "kind">): boolean {
  return (item.kind ?? "choice") === "choice" && item.options.length > 0 && item.options.every((o) => BAND_ID.test(o.id));
}

/** Whether an ordinal item's options stand in ascending order of their bands. */
export function bandsAscending(item: Pick<FreezeItem, "options">): boolean {
  return item.options.every((o, i) => i === 0 || bandLow(o.id) > bandLow(item.options[i - 1]!.id));
}

/**
 * The FreezeItem a definition stands for, its options in authored order, with its authored `keyStatements`
 * (SPEC/30 §5.3, `freeze-key-statements.ts`) and its analysis metadata (`31` §3.9; never sent to the screen).
 */
export function toItem(idPrefix: string, d: ItemDef): FreezeItem {
  const meta = {
    ...(d.basisKind ? { basisKind: d.basisKind } : {}),
    ...(d.basisAtomIds ? { basisAtomIds: d.basisAtomIds } : {}),
    ...(d.family ? { family: d.family } : {}),
    ...(d.scoredFor ? { scoredFor: d.scoredFor } : {}),
  };
  const base = { id: `${idPrefix}.${d.slug}`, level: d.level, promptFi: d.promptFi, goal: d.goal, keyAtomIds: d.keyAtomIds, ...meta };
  if (d.kind === "map_point") return withKeyStatements({ ...base, kind: "map_point", options: [], mapKey: { point: d.point, toleranceM: d.toleranceM }, ...(d.projectionPoint ? { projectionPoint: d.projectionPoint } : {}) });
  if (!d.options.some(([id]) => id === d.key)) throw new Error(`${base.id}: key ${d.key} is not an option`);
  for (const [name, o] of [["projection", d.projectionOption], ["truth", d.truthOption]] as const) {
    if (o !== undefined && (o === d.key || !d.options.some(([id]) => id === o))) throw new Error(`${base.id}: ${name} option ${o} must be another option than the key`);
  }
  return withKeyStatements({
    ...base, kind: "choice", options: d.options.map(([id, labelFi]) => ({ id, labelFi, correct: id === d.key })),
    ...(d.projectionOption ? { projectionOptionId: d.projectionOption } : {}),
    ...(d.truthOption ? { truthOptionId: d.truthOption } : {}),
  });
}

const LEVEL_ORDER: Readonly<Record<FreezeItemLevel, number>> = { L1: 0, L2: 1, L3: 2 };
/** A freeze's items in presentation order: L1, then L2, then L3 (stable within a level). */
export const byLevel = (items: readonly FreezeItem[]): FreezeItem[] => [...items].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);

/**
 * The correct option's position, balanced at build time (identical for every participant): the
 * freezes are visited in the given order (phase A first, so its balance is the tightest), and
 * each choice item's correct option goes to the position used least so far by items of its
 * level, ties broken by one seeded stream; the distractors are shuffled by the same stream.
 * Positions therefore differ by at most one between any two slots within a level. Every item leaves with its
 * authored `keyStatements` (SPEC/30 §5.3; analysis only): the infrastructure slot's F7 item (L2), built in
 * `demo-probes.ts`, gets them here, the bank's items already have them from `toItem`.
 * `31` F11: an ordinal item (`isOrdinal`) keeps its authored, ascending order and takes no part in the balance (no draw is made for it).
 */
export function arrangeOptions(freezes: readonly { readonly key: number; readonly items: readonly FreezeItem[] }[], seed: bigint): Map<number, FreezeItem[]> {
  const rng = new Xorshift64Star(deriveSeed(seed, "freeze-bank", "option-order"));
  const used: Record<FreezeItemLevel, number[]> = { L1: [0, 0, 0, 0], L2: [0, 0, 0, 0], L3: [0, 0, 0, 0] };
  const out = new Map<number, FreezeItem[]>();
  for (const f of freezes) {
    out.set(f.key, f.items.map(withKeyStatements).map((it) => {
      if ((it.kind ?? "choice") !== "choice") return it;
      if (isOrdinal(it)) {
        if (!bandsAscending(it)) throw new Error(`${it.id}: an ordinal item's bands must be authored in ascending order`);
        return it;
      }
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
