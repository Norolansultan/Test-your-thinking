/**
 * SPEC/34 §3–§4 and §7: every course exercise's reference command list meets all its criteria on its fixed seed, and
 * doing nothing fails at least one, on the real world and fire model. The runner here is a small local one (the task
 * screen's runner lives in the tasks work package; the two are to be consolidated): the game paused to the planning
 * moment, the reference issued there, then run to the horizon with a trace sample every `TRACE_EVERY_S`.
 */

import { describe, expect, it } from "vitest";
import { CELL, POWER_LINE_SAFE_M, type GameCommand, type GameState } from "../../app/game/contracts.js";
import { COURSE_EXERCISES } from "../../app/game/course/exercises/index.js";
import { defaultDeps } from "../../app/game/sim/default-deps.js";
import { createGame } from "../../app/game/sim/game.js";
import { polylineDist } from "../../app/game/sim/geom.js";
import { TRACE_EVERY_S, type DecisionTask, type TaskTrace, type TraceSample } from "../../app/game/tasks/contracts.js";
import { getWorld } from "../../app/game/world/load.js";

const world = getWorld();
const LIMIT_MS = 30_000;

/** Plays `task` with `commands` (issued when the clock reaches each `atS`, never before the planning moment). */
function runTask(task: DecisionTask, commands: readonly GameCommand[]): { final: GameState; trace: TaskTrace; refused: string[] } {
  const g = createGame(task.scenario, world, task.seed, defaultDeps);
  const planAt = task.planAtS ?? 0;
  if (planAt > 0) g.tick(planAt);
  const samples: TraceSample[] = [];
  const waterNearLiveLine: { tS: number; unitId: string }[] = [];
  const everObserved = new Set<number>();
  const refused: string[] = [];
  const queue = commands.map((c, i) => ({ c, i })).sort((a, b) => a.c.atS - b.c.atS || a.i - b.i).map((x) => x.c);
  let next = 0;
  const issueDue = () => {
    while (next < queue.length && Math.max(planAt, queue[next]!.atS) <= g.state.tS) {
      const c = queue[next++]!;
      const r = g.issue(c.unitId, c.order);
      if (!r.ok) refused.push(`${c.unitId}: ${r.reasonEn}`);
    }
  };
  const sample = () => {
    const st = g.state;
    let flaming = 0;
    let smouldering = 0;
    for (let c = 0; c < st.fire.state.length; c++) {
      if (st.fire.state[c] === CELL.burning) flaming++;
      else if (st.fire.state[c] === CELL.smouldering) smouldering++;
      if (st.known[c] !== 255) everObserved.add(c);
    }
    const prev = samples[samples.length - 1];
    for (const u of st.units) {
      const before = prev?.units.find((p) => p.id === u.id);
      // A crew that used water while standing within the safe distance of the live line.
      if (st.powerLineLive && before && u.waterL < before.waterL - 1 && polylineDist(u.pos, world.powerLine) <= POWER_LINE_SAFE_M) waterNearLiveLine.push({ tS: st.tS, unitId: u.id });
    }
    samples.push({
      tS: st.tS, burnedHa: st.score.burnedHa, flamingCells: flaming, smoulderingCells: smouldering, powerLineLive: st.powerLineLive,
      units: st.units.map((u) => ({ id: u.id, pos: u.pos, status: u.status, waterL: u.waterL, harm: u.harm })),
    });
  };
  issueDue();
  sample();
  const end = planAt + task.horizonS;
  while (g.state.tS < end - 1e-6) {
    const before = g.state.tS;
    g.tick(Math.min(TRACE_EVERY_S, end - before));
    issueDue();
    sample();
    if (g.state.tS <= before) break; // the game is over (won or lost): the state is final
  }
  return { final: g.state, trace: { samples, waterNearLiveLine, everObserved }, refused };
}

const judge = (task: DecisionTask, r: ReturnType<typeof runTask>) => task.criteria.map((c) => ({ id: c.id, ...c.judge(r.final, r.trace) }));

describe.each(COURSE_EXERCISES.map((t) => [t.id, t] as const))("exercise %s", (_id, task) => {
  it("the reference is accepted and meets every criterion on the fixed seed", () => {
    const r = runTask(task, task.reference.commands);
    expect(r.refused).toEqual([]);
    const results = judge(task, r);
    expect(results.filter((x) => !x.met)).toEqual([]);
  }, LIMIT_MS);

  it("doing nothing fails at least one criterion", () => {
    const results = judge(task, runTask(task, []));
    expect(results.some((x) => !x.met)).toBe(true);
  }, LIMIT_MS);

  it("plans at the start, issues the reference at the planning moment and keeps the horizon inside the scenario", () => {
    expect(task.reference.commands.every((c) => c.atS === (task.planAtS ?? 0))).toBe(true);
    expect(task.scenario.endAtS).toBeGreaterThanOrEqual((task.planAtS ?? 0) + task.horizonS);
    expect(task.allowLaterOrders ?? false).toBe(false);
  });

  it("is deterministic: the same seed and orders give the same outcome", () => {
    const a = runTask(task, task.reference.commands).final;
    const b = runTask(task, task.reference.commands).final;
    expect(b.score.burnedHa).toBe(a.score.burnedHa);
    expect(b.units.map((u) => [u.id, u.pos.x, u.pos.y, u.waterL])).toEqual(a.units.map((u) => [u.id, u.pos.x, u.pos.y, u.waterL]));
  }, LIMIT_MS);
});
