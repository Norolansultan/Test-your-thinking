/**
 * Game mode, SPEC/34 §4: the decision tasks, in the order the start page lists them. Filled by the tasks work package.
 */

import type { DecisionTask } from "./contracts.js";

export const DECISION_TASKS: readonly DecisionTask[] = [];

export function decisionTask(id: string): DecisionTask | undefined {
  return DECISION_TASKS.find((t) => t.id === id);
}
