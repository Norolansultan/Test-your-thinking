/**
 * Game mode, SPEC/34 §4: helpers for the decision tasks' situations (`app/game/scenarios/tasks/*`). Each task lives on
 * its own part of the map and in the morning, away from every keyed moment of the study (`test/game/study-keyed-moments.ts`:
 * its incident runs 11:20–20:00 round the point of origin, Honkaharju, Rahkasuo and Lahdenkylä).
 */

import type { GameCommand, Order, XY } from "../../contracts.js";

/** A command at a game second. */
export function cmd(atS: number, unitId: string, order: Order): GameCommand {
  return { atS, unitId, order };
}

/** A point in local metres. */
export function pt(x: number, y: number): XY {
  return { x, y };
}
