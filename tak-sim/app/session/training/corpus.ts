/**
 * PLACEHOLDER (bp integration stub): work package A replaces this file with the training's corpus (twelve records, `trn.r..` ids)
 * and its log rows. Same exports.
 */

import type { InfoAtom } from "../../scenario/types";
import type { RadioLogEntry } from "../snapshot";

/** The training's view: before the main session's practice view, one step. */
export const TRAINING_VIEW = { startsAtVirtual: -12_000, steps: 1 } as const;
/** The training's world-state step (never a main-session step). */
export const TRAINING_STEP = -9;
/** The training's "now", 10.18. */
export const TRAINING_NOW_S = -10_920;

export const TRAINING_ATOMS: readonly InfoAtom[] = [];

/** The log rows shown up to a clock ("10.18"). */
export function trainingLogRows(_untilHhmm: string): RadioLogEntry[] {
  return [];
}
