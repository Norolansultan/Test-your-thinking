/**
 * Game mode, SPEC/34 §3: the small criterion builders of the training course's exercises. Each judges the final
 * state and the run's trace (`tasks/contracts.ts`) and says why, in Finnish and English. Pure: no clock, no randomness.
 *
 * The course's exercises play on the game's one world, so a criterion that asks "where" reads the grid from it when
 * it judges (`getWorld`, decoded once). The decision tasks keep a richer set in `tasks/`; the two are to be
 * consolidated later.
 */

import { CELL, type GameState, type XY } from "../contracts.js";
import type { TaskCriterion, TaskTrace } from "../tasks/contracts.js";
import { cellsInCircle } from "../world/grid.js";
import { getWorld } from "../world/load.js";

/** Strain at or above this is a crew pushed too far (the game warns at 0.4, `sim/hazards.ts` `HARM_WARN`). */
export const STRAIN_LIMIT = 0.4;

const ha = (n: number): string => n.toFixed(1);

function count(final: GameState, states: readonly number[]): number {
  let n = 0;
  const s = final.fire.state;
  for (let c = 0; c < s.length; c++) if (states.includes(s[c]!)) n++;
  return n;
}

/** The burned area at the end is at most `maxHa`. */
export function burnedAtMost(maxHa: number): TaskCriterion {
  return {
    id: "burned_at_most",
    labelFi: `Paloala enintään ${maxHa} ha`,
    labelEn: `Burned area at most ${maxHa} ha`,
    judge: (final) => {
      const b = final.score.burnedHa;
      return { met: b <= maxHa, detailFi: `Paloala ${ha(b)} ha (raja ${maxHa} ha).`, detailEn: `Burned ${ha(b)} ha (limit ${maxHa} ha).` };
    },
  };
}

/** No flaming front left at the end (smouldering ground may remain). */
export function noFlamesAtEnd(): TaskCriterion {
  return {
    id: "no_flames",
    labelFi: "Liekehtivä reuna sammutettu lopussa",
    labelEn: "No flaming edge left at the end",
    judge: (final) => {
      const n = count(final, [CELL.burning]);
      return n === 0
        ? { met: true, detailFi: "Liekkejä ei enää ollut.", detailEn: "No flames were left." }
        : { met: false, detailFi: `Liekehtiviä soluja jäi ${n}.`, detailEn: `${n} cells were still flaming.` };
    },
  };
}

/** Nothing burns or smoulders at the end: the fire is out, mopped up. */
export function fireOut(): TaskCriterion {
  return {
    id: "fire_out",
    labelFi: "Palo sammunut: ei liekkejä eikä kytevää maata",
    labelEn: "The fire is out: no flames and no smouldering ground",
    judge: (final) => {
      const flaming = count(final, [CELL.burning]);
      const smoulder = count(final, [CELL.smouldering]);
      return flaming + smoulder === 0
        ? { met: true, detailFi: "Mikään ei palanut eikä kytenyt.", detailEn: "Nothing was burning or smouldering." }
        : { met: false, detailFi: `Liekehti ${flaming} solua, kyti ${smoulder} solua.`, detailEn: `${flaming} cells flaming, ${smoulder} smouldering.` };
    },
  };
}

/** No crew strained to `STRAIN_LIMIT` or hurt during the run. */
export function crewsSafe(): TaskCriterion {
  return {
    id: "crews_safe",
    labelFi: "Kukaan ei kuormittunut vaarallisesti eikä loukkaantunut",
    labelEn: "No crew dangerously strained or hurt",
    judge: (final, trace) => {
      let worst = 0;
      let who = "";
      for (const s of trace.samples) for (const u of s.units) if (u.harm > worst) { worst = u.harm; who = u.id; }
      for (const u of final.units) if (u.harm > worst) { worst = u.harm; who = u.id; }
      const met = worst < STRAIN_LIMIT && final.score.casualties === 0;
      return met
        ? { met, detailFi: "Miehistöt pysyivät turvassa.", detailEn: "The crews stayed safe." }
        : { met, detailFi: `${who}: kuormitus ${Math.round(worst * 100)} %.`, detailEn: `${who}: strain ${Math.round(worst * 100)} %.` };
    },
  };
}

/** No water put on within the safe distance of the live 20 kV line. */
export function noWaterNearLiveLine(): TaskCriterion {
  return {
    id: "no_water_near_live_line",
    labelFi: "Ei vettä jännitteisen 20 kV johdon lähellä",
    labelEn: "No water near the live 20 kV line",
    judge: (_final, trace) => {
      const n = trace.waterNearLiveLine.length;
      return n === 0
        ? { met: true, detailFi: "Vettä ei käytetty johdon lähellä sen ollessa jännitteinen.", detailEn: "No water was used near the line while it was live." }
        : { met: false, detailFi: `Vettä johdon lähellä ${n} kertaa.`, detailEn: `Water near the line ${n} times.` };
    },
  };
}

/** The player's units saw fire within `radiusM` of `at` (cells observed at least once that burned). */
export function fireSeenNear(id: string, at: XY, radiusM: number, labelFi: string, labelEn: string): TaskCriterion {
  return {
    id,
    labelFi,
    labelEn,
    judge: (final, trace: TaskTrace) => {
      const world = getWorld();
      const burned = (s: number): boolean => s === CELL.burning || s === CELL.smouldering || s === CELL.burnedOut || s === CELL.extinguished;
      const seen = cellsInCircle(world, at, radiusM).some((c) => trace.everObserved.has(c) && burned(final.fire.state[c]!));
      return seen
        ? { met: true, detailFi: "Palo löytyi ja näkyi kartalla.", detailEn: "The fire was found and shown on the map." }
        : { met: false, detailFi: "Palo jäi löytämättä.", detailEn: "The fire was not found." };
    },
  };
}

/** No fire reached within `radiusM` of `at` (a stand, a building, a line to hold). */
export function noFireWithin(id: string, at: XY, radiusM: number, labelFi: string, labelEn: string): TaskCriterion {
  return {
    id,
    labelFi,
    labelEn,
    judge: (final) => {
      const world = getWorld();
      const s = final.fire.state;
      let n = 0;
      for (const c of cellsInCircle(world, at, radiusM)) {
        const v = s[c]!;
        if (v === CELL.burning || v === CELL.smouldering || v === CELL.burnedOut || v === CELL.extinguished) n++;
      }
      return n === 0
        ? { met: true, detailFi: "Palo ei päässyt alueelle.", detailEn: "The fire did not reach the area." }
        : { met: false, detailFi: `Palo eteni alueelle (${n} solua).`, detailEn: `The fire reached the area (${n} cells).` };
    },
  };
}

/** `unitId`'s tank never ran dry during the run (it never had less than 1 l). */
export function neverRanDry(unitId: string): TaskCriterion {
  return {
    id: `never_dry_${unitId}`,
    labelFi: `${unitId}:n säiliö ei tyhjentynyt`,
    labelEn: `${unitId}'s tank never ran dry`,
    judge: (_final, trace) => {
      const dry = trace.samples.find((s) => s.units.some((u) => u.id === unitId && u.waterL < 1));
      return dry === undefined
        ? { met: true, detailFi: `${unitId}:llä oli vettä koko ajan.`, detailEn: `${unitId} had water all the time.` }
        : { met: false, detailFi: `${unitId}:n säiliö tyhjeni ${Math.round(dry.tS / 60)} min kohdalla.`, detailEn: `${unitId}'s tank ran dry at ${Math.round(dry.tS / 60)} min.` };
    },
  };
}

/** `unitId` was working on the fire (status `working`) for at least `minMin` minutes of the run. */
export function unitWorkedAtLeast(unitId: string, minMin: number): TaskCriterion {
  return {
    id: `worked_${unitId}`,
    labelFi: `${unitId} työssä palolla vähintään ${minMin} min`,
    labelEn: `${unitId} working on the fire for at least ${minMin} min`,
    judge: (_final, trace) => {
      const samples = trace.samples.filter((s) => s.units.some((u) => u.id === unitId && u.status === "working"));
      const step = trace.samples.length > 1 ? trace.samples[1]!.tS - trace.samples[0]!.tS : 60;
      const min = Math.round((samples.length * step) / 60);
      return { met: min >= minMin, detailFi: `${unitId} oli työssä noin ${min} min.`, detailEn: `${unitId} worked about ${min} min.` };
    },
  };
}
