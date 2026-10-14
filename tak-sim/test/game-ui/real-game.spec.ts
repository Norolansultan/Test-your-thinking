/**
 * Game mode screen against the real game loop: `game-source.ts` makes real games of every scenario, the player's
 * picture starts fogged (only the first report), the screen's alerts pick the right radio messages and wind changes,
 * and the debrief's points breakdown adds up to the game's own score after whole games played by the balance bots.
 */

import { describe, expect, it } from "vitest";
import { CELL, FIRST_REPORT_M, type Game } from "../../app/game/contracts.js";

import { cellCentre, distance } from "../../app/game/world/grid.js";
import { fireStillBurning } from "../../app/game/ui/controls.js";
import { pointsBreakdown } from "../../app/game/ui/Debrief.js";
import { gameScenarios, gameWorld, startGame } from "../../app/game/ui/game-source.js";
import { NEVER_SEEN } from "../../app/game/ui/fire-colors.js";
import { radioToast, windShift } from "../../app/game/ui/scenario-info.js";
import { makeBot, type StrategyId } from "../../tools/game/bots.js";

/** Plays `game` to its end with a balance bot, through the public API only (as the screen does). */
function playOut(game: Game, strategy: StrategyId): void {
  const bot = makeBot(strategy);
  game.tick(10);
  let next = 0;
  while (game.state.phase === "running") {
    if (game.state.tS >= next) { bot.decide(game); next = game.state.tS + bot.everyS; }
    game.tick(60);
  }
}

describe("the real game through game-source", () => {
  it("lists the game's scenarios and starts each in the briefing phase; the first tick runs it", () => {
    const ids = gameScenarios().map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(["training", "summer-afternoon", "evening-wind"]));
    for (const s of gameScenarios()) {
      const g = startGame(s, 1);
      expect(g.state.phase).toBe("briefing");
      g.tick(1);
      expect(g.state.phase).toBe("running");
    }
  });

  it("the player's picture starts fogged: little is known, and around each reported ignition only the first report", () => {
    const s = gameScenarios().find((x) => x.id === "summer-afternoon")!;
    const g = startGame(s, 1);
    const st = g.state;
    const world = gameWorld();
    let known = 0, unseenFire = 0;
    for (let i = 0; i < st.known.length; i++) {
      if (st.known[i] !== NEVER_SEEN) known++;
      else if (st.fire.state[i] === CELL.burning || st.fire.state[i] === CELL.burnedOut || st.fire.state[i] === CELL.smouldering) unseenFire++;
    }
    expect(known).toBeGreaterThan(0);
    expect(known).toBeLessThan(st.known.length / 20);
    expect(unseenFire).toBeGreaterThan(0); // the pre-burn spread beyond the first report: unknown until someone looks
    // Every known fire cell lies within the first report or a unit's sensor at the start.
    for (let i = 0; i < st.known.length; i++) {
      if (st.known[i] !== CELL.burning) continue;
      const c = cellCentre(world.grid, i);
      const nearIgnition = s.ignitions.some((p) => distance(p, c) <= FIRST_REPORT_M + world.grid.cellM);
      const nearUnit = st.units.some((u) => distance(u.pos, c) <= 1600);
      expect(nearIgnition || nearUnit).toBe(true);
    }
  });

  it("radio pop-ups: urgent always, important from command and support; routine never", () => {
    expect(radioToast({ priority: "urgent", room: "ground" })).toBe("urgent");
    expect(radioToast({ priority: "important", room: "support" })).toBe("warn");
    expect(radioToast({ priority: "important", room: "command" })).toBe("warn");
    expect(radioToast({ priority: "important", room: "ground" })).toBeNull();
    expect(radioToast({ priority: "routine", room: "command" })).toBeNull();
  });

  it("wind alerts fire on a turn of 30° or a change of 3 m/s, across north too", () => {
    expect(windShift({ windFromDeg: 225, windMs: 5 }, { windFromDeg: 240, windMs: 6 })).toBe(false);
    expect(windShift({ windFromDeg: 225, windMs: 5 }, { windFromDeg: 260, windMs: 5 })).toBe(true);
    expect(windShift({ windFromDeg: 350, windMs: 5 }, { windFromDeg: 15, windMs: 5 })).toBe(false);
    expect(windShift({ windFromDeg: 340, windMs: 5 }, { windFromDeg: 15, windMs: 5 })).toBe(true);
    expect(windShift({ windFromDeg: 270, windMs: 6 }, { windFromDeg: 280, windMs: 11 })).toBe(true);
    // The summer scenario's afternoon turn and evening rise are announced.
    const keys = gameScenarios().find((x) => x.id === "summer-afternoon")!.weather;
    let ref = keys[0]!;
    let alerts = 0;
    for (const k of keys) if (windShift(ref, k)) { alerts++; ref = k; }
    expect(alerts).toBeGreaterThanOrEqual(2);
  });

  it.each(["idle", "competent"] as const)("after a whole training game (%s bot) the debrief's breakdown adds up to the game's points", (strategy) => {
    const s = gameScenarios().find((x) => x.id === "training")!;
    const g = startGame(s, 1);
    playOut(g, strategy);
    const st = g.state;
    expect(["won", "lost", "ended"]).toContain(st.phase);
    const world = gameWorld();
    const lost = world.assets.reduce((a, x) => a + (st.assetStatus[x.id] === "burned" ? x.value : 0), 0);
    const rows = pointsBreakdown(st.score, lost, g.scenario.endAtS, st.phase !== "won" && fireStillBurning(st.fire));
    expect(rows.reduce((a, r) => a + r.value, 0)).toBe(st.score.points);
    // Nothing needed reconciling unless the total was clamped at zero.
    // Only rounding is left to reconcile unless the total was clamped at zero.
    if (st.score.points > 0) for (const r of rows.filter((x) => x.key === "other")) expect(Math.abs(r.value)).toBeLessThanOrEqual(1);
  });
});
