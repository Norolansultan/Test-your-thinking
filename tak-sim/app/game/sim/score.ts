/**
 * Game mode: score, objectives and grade.
 *
 * points = 1000 − 2 × burned ha − Σ value of buildings lost − 300 × casualties − 200 × settlements lost
 *          + containment bonus (300 × the share of the game still left when the last flaming front went
 *            out, while it stays out) + 50 × each objective met
 *          − 200 when the game is over with a fire still burning; never below 0.
 * grade  = S ≥ 1200 for a won game with every objective met, no casualty and no building lost (in
 *          practice: contained early on a small area); else A ≥ 950, B ≥ 800, C ≥ 600, D ≥ 400, F below.
 *          Caps: an unmet objective → at best C; a lost game, or one in which no unit ever put water
 *          on the ground or cut a break (the player did nothing to the fire) → at best D.
 *
 * Objectives: `contain` is decided at its deadline (met when no flaming front is left then) and never
 * ends the game by itself; `limit_area` is unmet once the area exceeds its limit, and the game is lost
 * only beyond the limit plus `AREA_LOSS_MARGIN`; a lost settlement or a casualty loses the game at once.
 */

import type { GamePhase, Objective, Score } from "../contracts.js";

export const START_POINTS = 1000;
export const POINTS_PER_HA = 2;
export const POINTS_PER_CASUALTY = 300;
export const POINTS_PER_SETTLEMENT = 200;
export const CONTAIN_BONUS = 300;
export const POINTS_PER_OBJECTIVE = 50;
/** Taken off when the game is over and a fire still burns. */
export const STILL_BURNING_PENALTY = 200;
/** The fire must stay out — no flaming and no smouldering cell — this long before the game is won early, s. */
export const OUT_CONFIRM_S = 900;
/** @deprecated The early win now waits `OUT_CONFIRM_S` with no flames and no smouldering; kept for older imports. */
export const CONTAIN_CONFIRM_S = OUT_CONFIRM_S;
/** `limit_area` loses the game only beyond its limit by this share (below that it is just unmet). */
export const AREA_LOSS_MARGIN = 0.2;
/** Points for an S (with every objective met, a won game, no casualty and no building lost). */
export const S_POINTS = 1200;

export type Grade = Score["grade"];

export interface ObjectiveStatus { readonly objective: Objective; met: boolean | null }

export interface PointsInput {
  readonly burnedHa: number;
  readonly lostAssetValue: number;
  readonly casualties: number;
  readonly settlementsLost: number;
  readonly containedAtS: number | null;
  /** Whether the front is out now (the bonus holds only while it stays out). */
  readonly containedNow: boolean;
  readonly endAtS: number;
  readonly objectivesMet: number;
  /** The game is over and a fire still burns. */
  readonly burningAtEnd?: boolean;
}

export function pointsFor(i: PointsInput): number {
  let p = START_POINTS;
  p -= POINTS_PER_HA * i.burnedHa;
  p -= i.lostAssetValue;
  p -= POINTS_PER_CASUALTY * i.casualties;
  p -= POINTS_PER_SETTLEMENT * i.settlementsLost;
  if (i.containedAtS !== null && i.containedNow && i.endAtS > 0) {
    p += CONTAIN_BONUS * Math.max(0, Math.min(1, (i.endAtS - i.containedAtS) / i.endAtS));
  }
  p += POINTS_PER_OBJECTIVE * i.objectivesMet;
  if (i.burningAtEnd === true) p -= STILL_BURNING_PENALTY;
  return Math.max(0, Math.round(p));
}

export interface GradeInput {
  readonly points: number;
  readonly allObjectivesMet: boolean;
  /** Some objective is already decided unmet. */
  readonly anyObjectiveUnmet?: boolean;
  readonly casualties: number;
  readonly assetsLost: number;
  readonly phase: GamePhase;
  /** Whether any unit put water on the ground or cut a fire break (false: the player did nothing to the fire). */
  readonly fought?: boolean;
}

const ORDER: readonly Grade[] = ["S", "A", "B", "C", "D", "F"];

function capAt(grade: Grade, cap: Grade): Grade {
  return ORDER.indexOf(grade) < ORDER.indexOf(cap) ? cap : grade;
}

export function gradeFor(g: GradeInput): Grade {
  let grade: Grade;
  const clean = g.allObjectivesMet && g.casualties === 0 && g.assetsLost === 0 && g.phase === "won";
  if (g.points >= S_POINTS && clean) grade = "S";
  else if (g.points >= 950) grade = "A";
  else if (g.points >= 800) grade = "B";
  else if (g.points >= 600) grade = "C";
  else if (g.points >= 400) grade = "D";
  else grade = "F";
  if (g.anyObjectiveUnmet === true || (g.phase !== "running" && g.phase !== "briefing" && !g.allObjectivesMet)) grade = capAt(grade, "C");
  if (g.phase === "lost") grade = capAt(grade, "D");
  if (g.fought === false) grade = capAt(grade, "D");
  return grade;
}

export interface WorldFacts {
  readonly tS: number;
  readonly burnedHa: number;
  readonly casualties: number;
  readonly settlementsLost: readonly string[];
  readonly containedNow: boolean;
}

/**
 * Updates objective statuses in place. An objective is decided `false` as soon as it fails (settlement
 * lost, a casualty, the area over its limit, the contain deadline passed with a front burning) and `true`
 * only when the game ends (`final`) — or for `contain`, at its deadline if the front is out.
 */
export function updateObjectives(list: ObjectiveStatus[], f: WorldFacts, final: boolean): void {
  for (const o of list) {
    if (o.met !== null) continue;
    const ob = o.objective;
    switch (ob.kind) {
      case "protect_settlement":
        if (f.settlementsLost.includes(ob.settlementId)) o.met = false;
        else if (final) o.met = true;
        break;
      case "no_casualties":
        if (f.casualties > 0) o.met = false;
        else if (final) o.met = true;
        break;
      case "limit_area":
        if (f.burnedHa > ob.maxHa) o.met = false;
        else if (final) o.met = true;
        break;
      case "contain":
        if (f.tS >= ob.byS || final) o.met = f.containedNow;
        break;
    }
  }
}

/**
 * The objective whose failure ends the game now: a settlement lost, a casualty, or the burned area
 * beyond its limit by more than `AREA_LOSS_MARGIN`. `contain` never ends the game by itself.
 */
export function failedForGood(list: readonly ObjectiveStatus[], f: Pick<WorldFacts, "burnedHa">): ObjectiveStatus | undefined {
  return list.find((o) => {
    if (o.met !== false) return false;
    switch (o.objective.kind) {
      case "contain": return false;
      case "limit_area": return f.burnedHa > o.objective.maxHa * (1 + AREA_LOSS_MARGIN);
      default: return true;
    }
  });
}

export function objectiveWhy(o: Objective, nameOf: (id: string) => { fi: string; en: string }): { fi: string; en: string } {
  switch (o.kind) {
    case "protect_settlement": {
      const n = nameOf(o.settlementId);
      return { fi: `${n.fi} menetetty`, en: `${n.en} lost` };
    }
    case "no_casualties": return { fi: "miehistöä loukkaantunut", en: "a crew has casualties" };
    case "limit_area": {
      const ha = Math.round(o.maxHa * (1 + AREA_LOSS_MARGIN));
      return { fi: `paloala yli ${ha} ha`, en: `burned area over ${ha} ha` };
    }
    case "contain": return { fi: "paloa ei saatu rajattua ajoissa", en: "the fire was not contained in time" };
  }
}
