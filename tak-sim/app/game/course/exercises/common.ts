/**
 * Game mode, SPEC/34 §3: what the course's exercises share. An exercise is a small decision task (`tasks/contracts.ts`)
 * on its own part of the map, in the morning (07:00–11:00 on the game clock) and away from the study's point of
 * origin and Lahdenkylä, so that none touches a keyed moment of the study (SPEC/29 (ay), `test/game/study-keyed-moments.ts`).
 * Its scenario is never listed in free play.
 */

import type { GameCommand, GameScenario, Order, ScenarioEvent, ScenarioUnit, WeatherKey, XY } from "../../contracts.js";
import type { CourseTopic, DecisionTask, TaskCriterion } from "../../tasks/contracts.js";

/** Every exercise's fixed seed (SPEC/34 §4: the same for every player and every replay). */
export const EXERCISE_SEED = 34;

/** Seconds after `startClockMin` for "HH:MM". */
export function atClock(startClockMin: number, hhmm: string): number {
  const [h, m] = hhmm.split(":").map((s) => Number(s));
  return ((h ?? 0) * 60 + (m ?? 0) - startClockMin) * 60;
}

/** A calm-to-moderate morning: wind from `fromDeg` at `ms` (gusts +50 %), 16 °C, 50 % RH, steady through the exercise. */
export function morningWeather(fromDeg: number, ms: number, endS: number, tempC = 16, rh = 50): WeatherKey[] {
  const w = { windFromDeg: fromDeg, windMs: ms, gustMs: Math.round(ms * 15) / 10, tempC, rh };
  return [{ atS: 0, ...w }, { atS: endS, ...w }];
}

export interface ExerciseSpec {
  readonly id: string;
  readonly topic: CourseTopic;
  readonly titleFi: string;
  readonly titleEn: string;
  readonly promptFi: string;
  readonly promptEn: string;
  /** Minutes after midnight; the exercise runs within 07:00–11:00. */
  readonly startClockMin: number;
  readonly horizonS: number;
  readonly ignitions: readonly XY[];
  readonly preBurnS?: number;
  readonly weather: readonly WeatherKey[];
  readonly units: readonly ScenarioUnit[];
  readonly events?: readonly ScenarioEvent[];
  readonly powerLineLiveAtStart?: boolean;
  readonly criteria: readonly TaskCriterion[];
  /** The reference orders, all given at the start of the run. */
  readonly reference: readonly (readonly [unitId: string, order: Order])[];
  readonly explanationFi: string;
  readonly explanationEn: string;
  readonly debriefFi: readonly string[];
  readonly debriefEn: readonly string[];
}

/** An exercise as a decision task: the scenario built from the spec (briefing = prompt), planned at tS 0. */
export function exercise(s: ExerciseSpec): DecisionTask {
  const scenario: GameScenario = {
    id: s.id,
    titleFi: s.titleFi,
    titleEn: s.titleEn,
    briefingFi: s.promptFi,
    briefingEn: s.promptEn,
    startClockMin: s.startClockMin,
    endAtS: s.horizonS,
    difficulty: "easy",
    ignitions: s.ignitions,
    weather: s.weather,
    units: s.units,
    events: s.events ?? [],
    objectives: [{ kind: "no_casualties" }],
    powerLineLiveAtStart: s.powerLineLiveAtStart ?? true,
    ...(s.preBurnS === undefined ? {} : { preBurnS: s.preBurnS }),
  };
  const commands: GameCommand[] = s.reference.map(([unitId, order]) => ({ atS: 0, unitId, order }));
  return {
    id: s.id,
    topic: s.topic,
    titleFi: s.titleFi,
    titleEn: s.titleEn,
    promptFi: s.promptFi,
    promptEn: s.promptEn,
    scenario,
    seed: EXERCISE_SEED,
    horizonS: s.horizonS,
    criteria: s.criteria,
    reference: { commands, explanationFi: s.explanationFi, explanationEn: s.explanationEn },
    debriefFi: s.debriefFi,
    debriefEn: s.debriefEn,
  };
}
