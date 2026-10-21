/**
 * Game mode, SPEC/34 §4: the real world and game ports a decision task runs on in the screen (the tests pass their own).
 */

import { defaultDeps } from "../sim/default-deps.js";
import { getWorld } from "../world/load.js";
import type { TaskEnv } from "./runner.js";

export function taskEnv(): TaskEnv {
  return { world: getWorld(), deps: defaultDeps };
}
