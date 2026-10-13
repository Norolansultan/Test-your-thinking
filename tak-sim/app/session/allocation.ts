/**
 * The decision step as the session runs it (SPEC/16 revision (s), 2 Oct 2026): what the panel
 * offers in a view (the four sectors, and who is on scene, for orientation), the input validation
 * of the sector plan, and the drone-tasking records a plan produces. Split out
 * of `orchestrator.ts`. No truth crosses here: the allocation space carries none.
 */

import { isCrew, rosterForView } from "../scenario/allocation.js";
import type { AllocationSpace } from "../scenario/types.js";
import { DEPARTURE_NOTE_FROM_VIEW, DEPARTURE_REASONS, MAIN_EFFORT_POSTURES, PLAN_DRONE_TASK_IDS, SECONDARY_TASK_IDS, type SectorPlan } from "../scenario/plan-types.js";
import type { DroneTaskedDetail, TelemetryEvent } from "../telemetry/record-kinds.js";

/** What the decision panel offers in one view. */
export interface AllocationView {
  readonly sectors: readonly { readonly id: string; readonly labelFi: string }[]; // "L1 Pohjoinen"
  /** On scene in this view, for orientation only: the plan is by sector, not by unit. */
  readonly crews: readonly string[];
  /** The observation drone teams on scene; none, and the plan has no drone part. */
  readonly droneTeams: readonly string[];
}

function observationDrones(space: AllocationSpace, view: number) {
  return rosterForView(space, view).filter((a) => a.type === "drone");
}

export function allocationViewOf(space: AllocationSpace, view: number): AllocationView {
  return {
    sectors: space.sectors.map((s) => ({ id: s.id, labelFi: `${s.id} ${s.label}` })),
    crews: rosterForView(space, view).filter(isCrew).map((a) => a.id),
    droneTeams: observationDrones(space, view).map((a) => a.id),
  };
}

/** Input validation at the boundary: known sectors, a main-effort posture from its list (required, 4 Oct 2026), a secondary sector other than the main effort, tasks from their own lists, drones only if on scene. */
export function assertValidPlan(space: AllocationSpace, view: number, plan: SectorPlan): void {
  const sector = (id: unknown) => typeof id === "string" && space.sectors.some((s) => s.id === id);
  if (!plan || !sector(plan.mainEffort)) throw new RangeError(`plan: unknown main-effort sector ${String(plan?.mainEffort)}`);
  if (!(MAIN_EFFORT_POSTURES as readonly unknown[]).includes(plan.posture)) throw new RangeError(`plan: unknown main-effort posture ${String(plan.posture)}`);
  if (plan.secondary !== null) {
    if (!sector(plan.secondary?.sectorId)) throw new RangeError(`plan: unknown secondary sector ${String(plan.secondary?.sectorId)}`);
    if (plan.secondary.sectorId === plan.mainEffort) throw new RangeError("plan: the secondary sector is the main effort's");
    if (!(SECONDARY_TASK_IDS as readonly string[]).includes(plan.secondary.taskId)) throw new RangeError(`plan: ${plan.secondary.taskId} is not a secondary task`);
  }
  if (plan.drones !== null) {
    if (observationDrones(space, view).length === 0) throw new RangeError(`plan: no drone team on scene in view ${view}`);
    if (!sector(plan.drones?.sectorId)) throw new RangeError(`plan: unknown drone sector ${String(plan.drones?.sectorId)}`);
    if (!(PLAN_DRONE_TASK_IDS as readonly string[]).includes(plan.drones.taskId)) throw new RangeError(`plan: ${plan.drones.taskId} is not a drone task`);
  }
  // The departure note (D5): offered from V8; a reason only with the box ticked, one of the closed reasons (revision (ai)).
  if (plan.departureNoted !== undefined && typeof plan.departureNoted !== "boolean") throw new RangeError("plan: departureNoted is not a boolean");
  if (plan.departureNoted === true && view < DEPARTURE_NOTE_FROM_VIEW) throw new RangeError(`plan: no departure note before V${DEPARTURE_NOTE_FROM_VIEW}`);
  if (plan.departureReason !== undefined) {
    if (plan.departureNoted !== true) throw new RangeError("plan: a departure reason needs the departure note");
    if (!(DEPARTURE_REASONS as readonly unknown[]).includes(plan.departureReason)) throw new RangeError(`plan: "${String(plan.departureReason)}" is not a departure reason`);
  }
}

/** The plan as logged: only its own fields, whatever the caller passed. */
export function copyPlan(p: SectorPlan): SectorPlan {
  const reason = p.departureNoted === true ? p.departureReason : undefined;
  return {
    mainEffort: p.mainEffort, posture: p.posture, secondary: p.secondary && { sectorId: p.secondary.sectorId, taskId: p.secondary.taskId }, drones: p.drones && { sectorId: p.drones.sectorId, taskId: p.drones.taskId },
    ...(p.departureNoted === undefined ? {} : { departureNoted: p.departureNoted }), ...(reason ? { departureReason: reason } : {}),
  };
}

/** One `drone_tasked` record per observation drone team on scene when the plan tasks the drones (`droneSurveyTiming` reads these). */
export function droneTaskingEvents(space: AllocationSpace, view: number, clockLabel: string, plan: SectorPlan): TelemetryEvent[] {
  const drones = plan.drones;
  if (!drones) return [];
  return observationDrones(space, view).map((a) => ({
    kind: "drone_tasked" as const,
    detail: { view, assetId: a.id, assetType: a.type as DroneTaskedDetail["assetType"], targetSectorId: drones.sectorId, taskId: drones.taskId, clockLabel },
  }));
}
