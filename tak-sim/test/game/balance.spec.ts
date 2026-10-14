/**
 * Game mode balance regression (SPEC/29; the full table over seeds 1–5 and the `competent` bot is
 * `npm run game:balance`): one seed of each scenario played by the `idle` and `naive` bots
 * (tools/game/bots.ts) on the real world and fire model, at 60 s ticks, against the coarse targets —
 * doing nothing never grades above D, the naive player gets B or better in training, and in the summer
 * afternoon the naive player is not done before the scripted 17:00 rekindle and grades C or worse. Also
 * the summer afternoon's pre-burn on the real map: a fire of hectares at noon, known only from the first
 * report.
 */

import { describe, expect, it } from "vitest";
import { CELL, FIRST_REPORT_M } from "../../app/game/contracts.js";
import { defaultDeps } from "../../app/game/sim/default-deps.js";
import { createGame } from "../../app/game/sim/game.js";
import { UNIT_SPECS } from "../../app/game/sim/unit-specs.js";
import { at } from "../../app/game/scenarios/places.js";
import { GAME_SCENARIOS, gameScenario } from "../../app/game/scenarios/index.js";
import { cellCentre } from "../../app/game/world/grid.js";
import { getWorld } from "../../app/game/world/load.js";
import { playGame } from "../../tools/game/bots.js";

const world = getWorld();
const SEED = 1;
const GRADES = ["S", "A", "B", "C", "D", "F"];
const atLeast = (grade: string, floor: string): boolean => GRADES.indexOf(grade) <= GRADES.indexOf(floor);
const LIMIT_MS = 20_000;

describe("game balance on the real world (one seed, 60 s ticks)", () => {
  it.each(GAME_SCENARIOS.map((s) => [s.id, s] as const))("%s: doing nothing grades D at best", (_id, s) => {
    const r = playGame(s, world, defaultDeps, SEED, "idle", { tickS: 60 });
    expect(r.phase).not.toBe("running");
    expect(r.commands).toBe(0);
    expect(["D", "F"]).toContain(r.grade);
    if (s.difficulty === "hard") expect(r.phase).toBe("lost");
  }, LIMIT_MS);

  it("training: the naive player gets B or better", () => {
    const r = playGame(gameScenario("training")!, world, defaultDeps, SEED, "naive", { tickS: 60 });
    expect(r.phase).toBe("won");
    expect(atLeast(r.grade, "B")).toBe(true);
  }, LIMIT_MS);

  it("summer afternoon: the naive player is not done before 17:00 and grades C or worse", () => {
    const s = gameScenario("summer-afternoon")!;
    const r = playGame(s, world, defaultDeps, SEED, "naive", { tickS: 60 });
    if (r.phase === "won") expect(r.tS).toBeGreaterThanOrEqual(at(s.startClockMin, "17:00"));
    expect(r.tS).toBeGreaterThanOrEqual(at(s.startClockMin, "17:00"));
    expect(atLeast(r.grade, "B")).toBe(false);
  }, LIMIT_MS);

  it("evening wind: the naive player loses or grades D at best", () => {
    const r = playGame(gameScenario("evening-wind")!, world, defaultDeps, SEED, "naive", { tickS: 60 });
    expect(r.phase === "lost" || ["D", "F"].includes(r.grade)).toBe(true);
  }, LIMIT_MS);

  it("summer afternoon starts from a pre-burned fire the player knows only from the first report", () => {
    const s = gameScenario("summer-afternoon")!;
    const g = createGame(s, world, SEED, defaultDeps);
    const st = g.state;
    expect(st.tS).toBe(0);
    expect(st.fire.tS).toBe(0);
    expect(st.score.burnedHa).toBeGreaterThan(1);
    const ign = s.ignitions[0]!;
    const onScene = s.units.filter((u) => u.arriveAtS === 0).map((u) => UNIT_SPECS[u.kind].sensorM);
    const sensor = Math.max(...onScene);
    let unknownBurning = 0;
    for (let c = 0; c < st.known.length; c++) {
      const p = cellCentre(world, c);
      if (st.known[c] !== 255) {
        const near = Math.hypot(p.x - ign.x, p.y - ign.y) <= FIRST_REPORT_M + 1 || Math.hypot(p.x - world.commandPost.x, p.y - world.commandPost.y) <= sensor + 1;
        expect(near).toBe(true);
      } else if (st.fire.state[c] === CELL.burning) {
        unknownBurning++;
      }
      if (st.fire.state[c] === CELL.burning || st.fire.state[c] === CELL.smouldering) expect(st.fire.ignitedAtS[c]).toBeLessThan(0);
    }
    // the head has run beyond what the caller could say
    expect(unknownBurning).toBeGreaterThan(0);
  }, LIMIT_MS);
});
