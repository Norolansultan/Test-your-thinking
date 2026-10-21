/**
 * Game mode, SPEC/34 §4: the decision-task runner on the small fake world (test/game/fakes.ts) — the plan is made on a
 * paused game, the situation's own orders run before it and are not the player's, the run samples the trace every
 * minute to the horizon, later orders wait for `allowLaterOrders`, and water near the live line is noted.
 */

import { describe, expect, it } from "vitest";
import { CELL, type GameCommand } from "../../app/game/contracts.js";
import { TRACE_EVERY_S, type DecisionTask } from "../../app/game/tasks/contracts.js";
import { maxBurnedHa, noWaterNearLiveLine } from "../../app/game/tasks/criteria.js";
import { advanceRun, beginRun, judgeRun, runOver, runTask, startTask } from "../../app/game/tasks/runner.js";
import { fakeDeps, lightBlock, makeWorld, POWER_X, scenario } from "./fakes.js";

const world = makeWorld();
const PLAN = 300;
const cmd = (atS: number, unitId: string, order: GameCommand["order"]): GameCommand => ({ atS, unitId, order });

function task(over: Partial<DecisionTask> = {}, line = false): DecisionTask {
  return {
    id: "t", topic: "orders", titleFi: "T", titleEn: "T", promptFi: "P", promptEn: "P",
    scenario: scenario({
      units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }, { id: "HELI1", kind: "helicopter", arriveAtS: 0 }],
      ignitions: [{ x: 600, y: 1100 }],
      endAtS: PLAN + 1200,
      powerLineLiveAtStart: line,
    }),
    seed: 7,
    planAtS: PLAN,
    horizonS: 1200,
    criteria: [maxBurnedHa(100), noWaterNearLiveLine(720)],
    reference: { commands: [], explanationFi: "", explanationEn: "" },
    debriefFi: [], debriefEn: [],
    ...over,
  };
}

describe("the decision-task runner", () => {
  it("opens the plan on a paused game at the planning moment: orders change nothing until the commit", () => {
    const deps = fakeDeps({ growEvery: 2, burnOutS: 600 });
    const tg = startTask(task(), { world, deps });
    const st = tg.game.state;
    expect(st.tS).toBe(PLAN);
    const before = st.fire.state.slice();
    expect(before.some((s) => s === CELL.burning)).toBe(true);
    expect(tg.game.issue("EK11", { type: "attack", target: { x: 600, y: 1100 } }).ok).toBe(true);
    expect(tg.game.state.tS).toBe(PLAN);
    expect(Array.from(tg.game.state.fire.state)).toEqual(Array.from(before));
  });

  it("runs the situation's own orders before the plan, and leaves them out of the player's commands", () => {
    const deps = fakeDeps({ growEvery: 0 });
    const t = task({ setup: [cmd(0, "EK11", { type: "move", to: { x: 800, y: 750 } })] });
    const tg = startTask(t, { world, deps });
    expect(tg.setupCount).toBe(1);
    expect(tg.game.state.units.find((u) => u.id === "EK11")!.pos.x).toBeGreaterThan(700);
    const out = runTask(t, { world, deps: fakeDeps({ growEvery: 0 }) }, [cmd(PLAN, "HELI1", { type: "recon", centre: { x: 600, y: 1100 } })]);
    expect(out.result.commands.map((c) => c.unitId)).toEqual(["HELI1"]);
  });

  it("samples the trace every minute from the commit to the horizon, then judges", () => {
    const deps = fakeDeps({ growEvery: 3 });
    const tg = startTask(task(), { world, deps });
    const run = beginRun(tg);
    let frames = 0;
    while (!runOver(run)) { advanceRun(run, 45); frames++; }
    expect(frames).toBeGreaterThan(20);
    expect(run.samples[0]!.tS).toBe(PLAN);
    expect(run.samples.at(-1)!.tS).toBe(PLAN + 1200);
    for (let i = 1; i < run.samples.length; i++) expect(run.samples[i]!.tS - run.samples[i - 1]!.tS).toBe(TRACE_EVERY_S);
    const { result, trace } = judgeRun(run, world);
    expect(result.criteria.map((c) => c.id)).toEqual(["max_burned_ha", "no_water_near_live_line"]);
    expect(result.allMet).toBe(true);
    expect(trace.grid).toBe(world.grid);
    expect(trace.everObserved.size).toBeGreaterThan(0);
  });

  it("issues later orders only when the task allows them", () => {
    const later = [cmd(PLAN, "EK11", { type: "hold" }), cmd(PLAN + 600, "EK11", { type: "move", to: { x: 1400, y: 750 } })];
    const fixed = runTask(task(), { world, deps: fakeDeps({ growEvery: 0 }) }, later);
    expect(fixed.result.commands.map((c) => c.order.type)).toEqual(["hold"]);
    const open = runTask(task({ allowLaterOrders: true }), { world, deps: fakeDeps({ growEvery: 0 }) }, later);
    expect(open.result.commands.map((c) => [c.atS, c.order.type])).toEqual([[PLAN, "hold"], [PLAN + 600, "move"]]);
  });

  it("notes water put (or tried) within 15 m of the line while it is live, and none once the line is dead", () => {
    const onLine = (fireOpts: { growEvery: number }) => fakeDeps(fireOpts, (fire, w) => { lightBlock(fire, w, POWER_X - 25, 1000, POWER_X + 25, 1100); });
    const drop = [cmd(PLAN, "HELI1", { type: "drop", target: { x: POWER_X - 60, y: 1050 } })];
    const t = task({ scenario: { ...task({}, true).scenario, ignitions: [] } });
    const live = runTask(t, { world, deps: onLine({ growEvery: 0 }) }, drop);
    expect(live.trace.waterNearLiveLine.length).toBeGreaterThan(0);
    expect(live.trace.waterNearLiveLine[0]!.unitId).toBe("HELI1");
    expect(live.result.criteria.find((c) => c.id === "no_water_near_live_line")!.met).toBe(false);
    const dead = runTask(task({ scenario: { ...t.scenario, powerLineLiveAtStart: false } }), { world, deps: onLine({ growEvery: 0 }) }, drop);
    expect(dead.trace.waterNearLiveLine).toEqual([]);
  });
});
