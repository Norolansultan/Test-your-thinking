/**
 * The projection-direction reading of the plan (SPEC/16 revision (x), built in fix pass 7, 9 Oct 2026, revision (ad); exploratory): in each
 * breach view whose key discriminates (`PROJECTION_DIRECTION_KEYS`, `app/scenario/demo-directive.ts`, truth, passed in), whether the final plan's
 * main effort lies in a sector the projection's head points into (`projection`), in the sector of the reported development the projection
 * missed (`reported`), or in neither. A pure fold over the log (SPEC/07 §1); the keys are content, never read from a global here.
 */

import { finalPlanPerView } from "./derived-measures.js";
import type { LogRecord } from "./log.js";

export interface ProjectionDirectionKeyLike {
  readonly view: number;
  readonly projected: readonly string[];
  readonly reported: readonly string[];
  readonly discriminates: boolean;
}

export interface ProjectionDirectionReading {
  readonly view: number;
  readonly mainEffort: string;
  readonly reading: "projection" | "reported" | "neither";
}

/** One reading per discriminating view with a final plan (a replayed view's plan is its replay's, as `finalPlanPerView`). */
export function projectionDirectionReading(records: readonly LogRecord[], keys: readonly ProjectionDirectionKeyLike[]): ProjectionDirectionReading[] {
  const plans = new Map(finalPlanPerView(records).map((p) => [p.view, p]));
  const out: ProjectionDirectionReading[] = [];
  for (const k of keys) {
    const plan = plans.get(k.view);
    if (!k.discriminates || !plan) continue;
    const reading = k.projected.includes(plan.mainEffort) ? "projection" : k.reported.includes(plan.mainEffort) ? "reported" : "neither";
    out.push({ view: k.view, mainEffort: plan.mainEffort, reading });
  }
  return out;
}
