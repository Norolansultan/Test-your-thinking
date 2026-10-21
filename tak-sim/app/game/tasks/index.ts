/**
 * Game mode, SPEC/34 §4: the decision tasks, in the order the start page lists them. Each is a fixed situation on its
 * own part of the map, in the morning, away from every keyed moment of the study (`test/game/study-separation.spec.ts`
 * checks them); the situations live in `app/game/scenarios/tasks/`.
 */

import { TASK_FIRE } from "../scenarios/tasks/fire.js";
import { TASK_MOPUP } from "../scenarios/tasks/mopup.js";
import { TASK_ORDERS } from "../scenarios/tasks/orders.js";
import { TASK_PROTECT } from "../scenarios/tasks/protect.js";
import { TASK_RECON } from "../scenarios/tasks/recon.js";
import { TASK_SAFETY } from "../scenarios/tasks/safety.js";
import { TASK_WATER } from "../scenarios/tasks/water.js";
import type { DecisionTask } from "./contracts.js";

export const DECISION_TASKS: readonly DecisionTask[] = [TASK_ORDERS, TASK_WATER, TASK_SAFETY, TASK_RECON, TASK_FIRE, TASK_PROTECT, TASK_MOPUP];

export function decisionTask(id: string): DecisionTask | undefined {
  return DECISION_TASKS.find((t) => t.id === id);
}
