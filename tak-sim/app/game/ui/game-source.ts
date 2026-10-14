/**
 * Game mode screen: the ONE place that creates a `Game` and lists the scenarios. Everything else in `ui/` is built
 * against the `Game` contract only (`contracts.ts`), so the screen never reaches into the game loop's internals.
 */

import type { Game, GameScenario, GameWorld } from "../contracts.js";
import { GAME_SCENARIOS } from "../scenarios/index.js";
import { defaultDeps } from "../sim/default-deps.js";
import { createGame } from "../sim/game.js";
import { getWorld } from "../world/load.js";

/** The game's world (decoded once). */
export function gameWorld(): GameWorld {
  return getWorld();
}

/** The scenarios, easiest first. */
export function gameScenarios(): readonly GameScenario[] {
  return GAME_SCENARIOS;
}

/** A new game of `scenario` on the real world, fire and weather. The same scenario, seed and orders replay the same game. */
export function startGame(scenario: GameScenario, seed: number): Game {
  return createGame(scenario, getWorld(), seed, defaultDeps);
}
