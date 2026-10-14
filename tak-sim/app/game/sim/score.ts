/**
 * Game mode: score, objectives and grade.
 *
 * points = 1000 − 2 × burned ha − Σ value of buildings lost − 300 × casualties − 200 × settlements lost
 *          + containment bonus (300 × the share of the game still left when the flaming front was
 *            gone, while it stays gone) + 50 × each objective met; never below 0.
 * grade  = S ≥ 1100 with every objective met, no casualty and no building lost; else A ≥ 950,
 *          B ≥ 800, C ≥ 600, D ≥ 400, F below; a lost game is at best D.
 */

import type { GamePhase, Objective, Score } from "../contracts.js";

export const START_POINTS = 1000;
export const POINTS_PER_HA = 2;
export const POINTS_PER_CASUALTY = 300;
export const POINTS_PER_SETTLEMENT = 200;
export const CONTAIN_BONUS = 300;
export const POINTS_PER_OBJECTIVE = 50;
/** The flaming front must stay out this long before a contained fire wins the game, s. */
export const CONTAIN_CONFIRM_S = 600;

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
  return Math.max(0, Math.round(p));
}

export interface GradeInput {
  readonly points: number;
  readonly allObjectivesMet: boolean;
  readonly casualties: number;
  readonly assetsLost: number;
  readonly phase: GamePhase;
}

const ORDER: readonly Grade[] = ["S", "A", "B", "C", "D", "F"];

export function gradeFor(g: GradeInput): Grade {
  let grade: Grade;
  if (g.points >= 1100 && g.allObjectivesMet && g.casualties === 0 && g.assetsLost === 0) grade = "S";
  else if (g.points >= 950) grade = "A";
  else if (g.points >= 800) grade = "B";
  else if (g.points >= 600) grade = "C";
  else if (g.points >= 400) grade = "D";
  else grade = "F";
  if (g.phase === "lost" && ORDER.indexOf(grade) < ORDER.indexOf("D")) grade = "D";
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
 * Updates objective statuses in place. An objective is decided `false` as soon as it fails for good
 * (settlement lost, a casualty, the area exceeded, the contain deadline passed with a front burning)
 * and `true` only when the game ends (`final`) — or for `contain`, at its deadline if the front is out.
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

/** Objectives whose failure ends the game at once. */
export function failedForGood(list: readonly ObjectiveStatus[]): ObjectiveStatus | undefined {
  return list.find((o) => o.met === false && o.objective.kind !== "contain");
}

export function objectiveWhy(o: Objective, nameOf: (id: string) => { fi: string; en: string }): { fi: string; en: string } {
  switch (o.kind) {
    case "protect_settlement": {
      const n = nameOf(o.settlementId);
      return { fi: `${n.fi} menetetty`, en: `${n.en} lost` };
    }
    case "no_casualties": return { fi: "miehistöä loukkaantunut", en: "a crew has casualties" };
    case "limit_area": return { fi: `paloala yli ${o.maxHa} ha`, en: `burned area over ${o.maxHa} ha` };
    case "contain": return { fi: "paloa ei saatu rajattua ajoissa", en: "the fire was not contained in time" };
  }
}
