/**
 * Game mode, SPEC/34 §4 and §7: every decision task on the real world and fire model — the situation is well formed
 * (both languages, 2–4 criteria and teaching points, the game ends at the horizon, the expert's orders at the planning
 * moment, the drawn places on burnable fuel); the expert reference meets every criterion on the task's seed; doing
 * nothing meets fewer than all; the same commands give the same outcome; and the plan is made on a paused game.
 */

import { describe, expect, it } from "vitest";
import type { GameCommand } from "../../app/game/contracts.js";
import { isBurnable } from "../../app/game/fire/fuels.js";
import { defaultDeps } from "../../app/game/sim/default-deps.js";
import type { DecisionTask } from "../../app/game/tasks/contracts.js";
import { DECISION_TASKS, decisionTask } from "../../app/game/tasks/index.js";
import { horizonAt, planAt, runReference, runTask, startTask, type TaskOutcome } from "../../app/game/tasks/runner.js";
import { cellOf } from "../../app/game/world/grid.js";
import { getWorld } from "../../app/game/world/load.js";

const world = getWorld();
const env = { world, deps: defaultDeps };
const LIMIT_MS = 30_000;

/** Each task's reference and idle runs, computed once. */
const cache = new Map<string, { ref: TaskOutcome; idle: TaskOutcome }>();
function outcomes(t: DecisionTask): { ref: TaskOutcome; idle: TaskOutcome } {
  let o = cache.get(t.id);
  if (o === undefined) {
    o = { ref: runReference(t, env), idle: runTask(t, env, []) };
    cache.set(t.id, o);
  }
  return o;
}

describe("the decision tasks (SPEC/34 §4)", () => {
  it("are the seven of the table, one per topic, with unique ids and seeds", () => {
    expect(DECISION_TASKS.map((t) => t.topic)).toEqual(["orders", "water", "safety", "recon", "fire", "protect", "mopup"]);
    expect(new Set(DECISION_TASKS.map((t) => t.id)).size).toBe(DECISION_TASKS.length);
    expect(new Set(DECISION_TASKS.map((t) => t.seed)).size).toBe(DECISION_TASKS.length);
    for (const t of DECISION_TASKS) expect(decisionTask(t.id)).toBe(t);
  });
});

describe.each(DECISION_TASKS.map((t) => [t.id, t] as const))("task %s", (_id, t) => {
  it("is well formed: texts in both languages, 2–4 criteria and teaching points, the game ending at the horizon", () => {
    for (const s of [t.titleFi, t.titleEn, t.promptFi, t.promptEn, t.reference.explanationFi, t.reference.explanationEn]) expect(s.trim().length).toBeGreaterThan(20);
    expect(t.promptFi).not.toBe(t.promptEn);
    expect(t.criteria.length).toBeGreaterThanOrEqual(2);
    expect(t.criteria.length).toBeLessThanOrEqual(4);
    expect(new Set(t.criteria.map((c) => c.id)).size).toBe(t.criteria.length);
    for (const c of t.criteria) for (const s of [c.labelFi, c.labelEn]) expect(s.trim().length).toBeGreaterThan(0);
    expect(t.debriefFi.length).toBeGreaterThanOrEqual(2);
    expect(t.debriefFi.length).toBeLessThanOrEqual(4);
    expect(t.debriefEn.length).toBe(t.debriefFi.length);
    expect(t.scenario.endAtS).toBe(horizonAt(t));
    expect(t.allowLaterOrders ?? false).toBe(false);
    const ids = new Set(t.scenario.units.map((u) => u.id));
    for (const c of t.reference.commands) {
      expect(c.atS).toBe(planAt(t));
      expect(ids.has(c.unitId)).toBe(true);
    }
    for (const c of t.setup ?? []) {
      expect(c.atS).toBeLessThan(planAt(t));
      expect(ids.has(c.unitId)).toBe(true);
    }
    const texts = [t.promptFi, t.promptEn, t.scenario.briefingFi, t.scenario.briefingEn, ...t.scenario.events.flatMap((e) => (e.message ? [e.message.textFi, e.message.textEn] : []))];
    for (const s of texts) expect(s).not.toMatch(/110 ?kV|Fingrid|kantaverk|national grid/i);
  });

  it("lights its fires on burnable fuel of the real map", () => {
    const fires = [...t.scenario.ignitions, ...t.scenario.events.flatMap((e) => (e.kind === "ignite" && e.at ? [e.at] : []))];
    for (const p of fires) expect([p, isBurnable(world.fuel[cellOf(world.grid, p)]!)]).toEqual([p, true]);
  });

  it("is planned on a paused game: orders at the planning moment change nothing until the commit", () => {
    const tg = startTask(t, env);
    expect(tg.game.state.tS).toBe(planAt(t));
    const fire = tg.game.state.fire.state.slice();
    const ha = tg.game.state.score.burnedHa;
    for (const c of t.reference.commands) tg.game.issue(c.unitId, c.order);
    expect(tg.game.state.tS).toBe(planAt(t));
    expect(tg.game.state.score.burnedHa).toBe(ha);
    expect(Array.from(tg.game.state.fire.state)).toEqual(Array.from(fire));
  });

  it("the expert reference meets every criterion on the task's seed", () => {
    const { ref } = outcomes(t);
    expect(ref.result.criteria.filter((c) => !c.met).map((c) => `${c.id}: ${c.detailEn}`)).toEqual([]);
    expect(ref.result.allMet).toBe(true);
    expect(ref.final.tS).toBeLessThanOrEqual(horizonAt(t));
    expect(ref.result.commands.length).toBe(t.reference.commands.length);
  }, LIMIT_MS);

  it("doing nothing meets fewer than all", () => {
    const { idle } = outcomes(t);
    expect(idle.result.allMet).toBe(false);
    expect(idle.result.commands).toEqual([]);
  }, LIMIT_MS);

  it("plays the same twice: the same commands give the same result and trace", () => {
    const { ref } = outcomes(t);
    const again = runTask(t, env, t.reference.commands as GameCommand[]);
    expect(again.result).toEqual(ref.result);
    expect(again.trace.samples).toEqual(ref.trace.samples);
    expect(again.trace.waterNearLiveLine).toEqual(ref.trace.waterNearLiveLine);
    expect(again.trace.everObserved.size).toBe(ref.trace.everObserved.size);
  }, LIMIT_MS);
});
