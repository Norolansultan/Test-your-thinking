/**
 * Game mode, SPEC/34 §4: the decision-task runner. A task is one fixed game: its scenario on its seed, run with no
 * orders up to the planning moment (`planAtS`), where the clock stops for the player's plan; the commit then runs it
 * in `SIM_STEP_S` steps to `planAtS + horizonS`, taking a `TraceSample` every `TRACE_EVERY_S` and noting every water
 * application near the live 20 kV line; the criteria judge the final state and the trace, and the game's own score
 * gives the points and grade. The task screen drives the same functions frame by frame (`beginRun`, `advanceRun`),
 * so what the player watches is exactly what `runTask` computes. Deterministic: virtual time and the task's seed only.
 */

import { POWER_LINE_SAFE_M, SIM_STEP_S, type Game, type GameCommand, type GameState, type GameWorld } from "../contracts.js";
import { createGame } from "../sim/game.js";
import { polylineDist } from "../sim/geom.js";
import type { GameDeps, WaterEvent } from "../sim/ports.js";
import { TRACE_EVERY_S, type DecisionTask, type TaskResult, type TaskTrace, type TraceSample } from "./contracts.js";
import { fireCounts } from "./criteria.js";

/** The world and the game's ports a task runs on (the real ones in the screen, the same or fakes in tests). */
export interface TaskEnv {
  readonly world: GameWorld;
  readonly deps: GameDeps;
}

/** A task's game and what its runner records while it plays. */
export interface TaskGame {
  readonly task: DecisionTask;
  readonly game: Game;
  /** Water applications (or attempts the line refused) within `POWER_LINE_SAFE_M` of the line while it was live. */
  readonly waterNearLiveLine: { readonly tS: number; readonly unitId: string }[];
  /** How many of the game's logged commands are the situation's own (`setup`); the player's follow. */
  readonly setupCount: number;
}

/** A run from the commit to the horizon. */
export interface TaskRun extends TaskGame {
  readonly startS: number;
  readonly endS: number;
  readonly samples: TraceSample[];
  nextSampleS: number;
}

const UNKNOWN = 255;

/** Commands in time order, log order within a time. */
function sortedByTime(commands: readonly GameCommand[]): GameCommand[] {
  return commands.map((c, i) => ({ c, i })).sort((a, b) => a.c.atS - b.c.atS || a.i - b.i).map((x) => x.c);
}

/** The planning moment, game seconds. */
export function planAt(task: DecisionTask): number {
  return Math.max(0, task.planAtS ?? 0);
}

/** The end of the run, game seconds. */
export function horizonAt(task: DecisionTask): number {
  return planAt(task) + task.horizonS;
}

/**
 * A task's game at its planning moment: the scenario on the task's seed, run to `planAtS` with only the situation's own
 * orders (`setup`; nothing is shown while it runs), then paused for the plan. The deps gain an observer that notes
 * water near the live line.
 */
export function startTask(task: DecisionTask, env: TaskEnv): TaskGame {
  const near: { tS: number; unitId: string }[] = [];
  const line = env.world.powerLine;
  // The line is live from the start until the first `power_line_dead` event (events run before the units each step).
  const deadAtS = Math.min(Infinity, ...task.scenario.events.filter((e) => e.kind === "power_line_dead").map((e) => e.atS));
  const live = (tS: number): boolean => task.scenario.powerLineLiveAtStart && tS < deadAtS;
  const onWater = (e: WaterEvent): void => {
    if (line.length > 0 && live(e.tS) && polylineDist(e.at, line) <= POWER_LINE_SAFE_M) near.push({ tS: e.tS, unitId: e.unitId });
  };
  const game = createGame(task.scenario, env.world, task.seed, { ...env.deps, onWater });
  const plan = planAt(task);
  const setup = sortedByTime((task.setup ?? []).filter((c) => c.atS < plan));
  for (const c of setup) {
    const dt = c.atS - game.state.tS;
    if (dt > 0) game.tick(dt);
    game.issue(c.unitId, c.order);
  }
  const rest = plan - game.state.tS;
  if (rest > 0) game.tick(rest);
  return { task, game, waterNearLiveLine: near, setupCount: game.commands.length };
}

/** One sample of the game now. */
export function sampleOf(state: GameState): TraceSample {
  const { flaming, smouldering } = fireCounts(state);
  return {
    tS: state.tS,
    burnedHa: state.score.burnedHa,
    flamingCells: flaming,
    smoulderingCells: smouldering,
    units: state.units.map((u) => ({ id: u.id, pos: u.pos, status: u.status, waterL: u.waterL, harm: u.harm })),
    powerLineLive: state.powerLineLive,
  };
}

/** The commit: the run starts from the game as planned (its first sample is the planning moment). */
export function beginRun(tg: TaskGame): TaskRun {
  const startS = tg.game.state.tS;
  return { ...tg, startS, endS: horizonAt(tg.task), samples: [sampleOf(tg.game.state)], nextSampleS: startS + TRACE_EVERY_S };
}

export function runOver(run: TaskRun): boolean {
  const st = run.game.state;
  return st.tS >= run.endS - 1e-6 || st.phase === "won" || st.phase === "lost" || st.phase === "ended";
}

/** Advances the run by up to `dtS` game seconds (whole steps), sampling on the way; stops at the horizon or game over. */
export function advanceRun(run: TaskRun, dtS: number): void {
  let left = Math.round(dtS / SIM_STEP_S);
  while (left > 0 && !runOver(run)) {
    run.game.tick(SIM_STEP_S);
    left--;
    const st = run.game.state;
    if (st.tS >= run.nextSampleS - 1e-6 || runOver(run)) {
      run.samples.push(sampleOf(st));
      run.nextSampleS = st.tS + TRACE_EVERY_S;
    }
  }
}

/** Issues the commands due by now (in log order); later ones wait (`allowLaterOrders`). Returns how many were taken. */
function issueDue(game: Game, commands: readonly GameCommand[], from: number, untilS: number): number {
  let i = from;
  while (i < commands.length && commands[i]!.atS <= untilS + 1e-6) {
    game.issue(commands[i]!.unitId, commands[i]!.order);
    i++;
  }
  return i;
}

/** The trace of a finished run. */
export function traceOf(run: TaskRun, world: GameWorld): TaskTrace {
  const known = run.game.state.known;
  const seen = new Set<number>();
  for (let c = 0; c < known.length; c++) if (known[c] !== UNKNOWN) seen.add(c);
  return { samples: run.samples, waterNearLiveLine: run.waterNearLiveLine, everObserved: seen, grid: world.grid };
}

/** Judges a finished run: each criterion, all met, and the game's points and grade. */
export function judgeRun(run: TaskRun, world: GameWorld): { readonly result: TaskResult; readonly trace: TaskTrace } {
  const final = run.game.state;
  const trace = traceOf(run, world);
  const criteria = run.task.criteria.map((c) => ({ id: c.id, ...c.judge(final, trace) }));
  return {
    trace,
    result: {
      taskId: run.task.id,
      criteria,
      allMet: criteria.every((c) => c.met),
      points: final.score.points,
      grade: final.score.grade,
      commands: run.game.commands.slice(run.setupCount),
    },
  };
}

export interface TaskOutcome {
  readonly result: TaskResult;
  readonly trace: TaskTrace;
  readonly final: GameState;
  readonly game: Game;
}

/**
 * Plays a task through with a command log: the planning-moment commands (atS ≤ `planAtS`) are issued at the planning
 * moment, later ones at their time when the task allows later orders (otherwise they are ignored), and the run goes to
 * the horizon. The same task and commands always give the same outcome.
 */
export function runTask(task: DecisionTask, env: TaskEnv, commands: readonly GameCommand[]): TaskOutcome {
  const tg = startTask(task, env);
  const ordered = sortedByTime(commands);
  const usable = task.allowLaterOrders === true ? ordered : ordered.filter((c) => c.atS <= planAt(task) + 1e-6);
  let next = issueDue(tg.game, usable, 0, planAt(task));
  const run = beginRun(tg);
  while (!runOver(run)) {
    const due = next < usable.length ? usable[next]!.atS : Infinity;
    const st = run.game.state.tS;
    advanceRun(run, Math.max(SIM_STEP_S, Math.min(run.endS, due) - st));
    next = issueDue(run.game, usable, next, run.game.state.tS);
  }
  const { result, trace } = judgeRun(run, env.world);
  return { result, trace, final: run.game.state, game: run.game };
}

/** The expert reference on the same seed with the same runner. */
export function runReference(task: DecisionTask, env: TaskEnv): TaskOutcome {
  return runTask(task, env, task.reference.commands);
}
