/**
 * Game mode, SPEC/34 §3: the training course — seven modules, in the order the start page lists them. Each is 2–4
 * short pages, one hands-on exercise (a small decision task) and 2–3 check questions. Part of the lazily loaded game
 * chunk; the study build never loads it.
 */

import type { CourseModule } from "../tasks/contracts.js";
import { FIRE_MODULE } from "./modules/fire.js";
import { MAP_MODULE } from "./modules/map.js";
import { MOPUP_MODULE } from "./modules/mopup.js";
import { ORDERS_MODULE } from "./modules/orders.js";
import { RECON_MODULE } from "./modules/recon.js";
import { SAFETY_MODULE } from "./modules/safety.js";
import { WATER_MODULE } from "./modules/water.js";

export const COURSE_MODULES: readonly CourseModule[] = [
  MAP_MODULE, FIRE_MODULE, RECON_MODULE, ORDERS_MODULE, WATER_MODULE, SAFETY_MODULE, MOPUP_MODULE,
];

export function courseModule(id: string): CourseModule | undefined {
  return COURSE_MODULES.find((m) => m.id === id);
}
