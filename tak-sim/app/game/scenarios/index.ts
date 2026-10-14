/**
 * Game mode scenarios, easiest first. Each is data only (local metres, named settlements), so it
 * plays on any `GameWorld`; `createGame` resolves names against the world.
 */

import type { GameScenario } from "../contracts.js";
import { EVENING_WIND } from "./evening-wind.js";
import { SUMMER_AFTERNOON } from "./summer-afternoon.js";
import { TRAINING } from "./training.js";

export const GAME_SCENARIOS: readonly GameScenario[] = [TRAINING, SUMMER_AFTERNOON, EVENING_WIND];

export function gameScenario(id: string): GameScenario | undefined {
  return GAME_SCENARIOS.find((s) => s.id === id);
}

export { EVENING_WIND, SUMMER_AFTERNOON, TRAINING };
