/**
 * Game mode, SPEC/34 §3: the course's exercises, one per module, in module order. Never listed in free play.
 */

import type { DecisionTask } from "../../tasks/contracts.js";
import { FIRE_EXERCISE } from "./fire.js";
import { MAP_EXERCISE } from "./map.js";
import { MOPUP_EXERCISE } from "./mopup.js";
import { ORDERS_EXERCISE } from "./orders.js";
import { RECON_EXERCISE } from "./recon.js";
import { SAFETY_EXERCISE } from "./safety.js";
import { WATER_EXERCISE } from "./water.js";

export const COURSE_EXERCISES: readonly DecisionTask[] = [
  MAP_EXERCISE, FIRE_EXERCISE, RECON_EXERCISE, ORDERS_EXERCISE, WATER_EXERCISE, SAFETY_EXERCISE, MOPUP_EXERCISE,
];

export { FIRE_EXERCISE, MAP_EXERCISE, MOPUP_EXERCISE, ORDERS_EXERCISE, RECON_EXERCISE, SAFETY_EXERCISE, WATER_EXERCISE };
