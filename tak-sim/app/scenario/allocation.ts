/**
 * The allocation task's space (SPEC/16 revision 1 Oct 2026): the participant commands the human
 * crews AND the drone teams' assets. Each view offers the assets that are on scene by the end of
 * that view (the decision phase comes after a merged view's step boundary, SPEC/26 §2), each with
 * the tasks that suit its type, in the scenario's four sectors L1–L4.
 *
 * Who is on scene is DERIVED from the frozen deployment (`site-scenario.json`, written by
 * `tools/fire-ca/deployment.ts`): a ground unit from the first step that places it on the map, a
 * drone from the first step it flies. The helicopter (state aviation) and the spotter aircraft
 * (volunteer patrol) are not the participant's to task and are not offered.
 *
 * A drone whose battery packs are all empty at a view's decision point (the end of its last step)
 * is not offered in that view: it cannot fly until a pack is charged (consistency review 1 Oct 2026,
 * item 3). A drone on the ground with a charged pack can be relaunched, so it is offered. Both the
 * log's battery lines and this roster read the one battery model (`drone-battery.ts`).
 *
 * Allocations are recorded intentions, logged and scored; the world does not respond to them
 * (identical stimulus, SPEC/26 §5).
 */

import type { CycleIndex } from "../engine/primitives.js";
import { SITE_SCENARIO, type SiteScenarioBundle } from "./site-scenario.js";
import type { AllocationSpace, Asset, AssetType, PracticeViewIndex, TaskOption } from "./types.js";
import { DRONE_BATTERY, batteryTimeline } from "./drone-battery.js";
import { MAIN_VIEWS, viewEndVirtual, viewOfStep } from "./views.js";

const CREW_TYPES: readonly AssetType[] = ["pelastusyksikko", "sailioauto", "maastoyksikko"];

/**
 * The tasks (the drone ones that survey a sector are `DRONE_SURVEY_TASK_IDS` in `derived-measures.ts`), each for the asset types it suits. DRAFT (native and domain review pending).
 * The water drone (VD1) and the hose robot (UGV1) have none (D3, 8 Oct 2026): they work autonomously, the drone on its operator's judgement at the burning edge, the robot with its crew.
 */
export const ALLOCATION_TASKS: readonly TaskOption[] = [
  { id: "task.direct-attack", label: "Sammutus palon reunalla", appliesToTypes: CREW_TYPES },
  { id: "task.hold-line", label: "Linjan pito", appliesToTypes: CREW_TYPES },
  { id: "task.mopup", label: "Jälkisammutus ja varmistus", appliesToTypes: CREW_TYPES },
  { id: "task.thermal-survey", label: "Lämpökuvaus", appliesToTypes: ["drone"] },
  { id: "task.perimeter-map", label: "Palon rajan kartoitus", appliesToTypes: ["drone"] },
  { id: "task.watch", label: "Lohkon tähystys", appliesToTypes: ["drone"] },
];

/** The deployment's unit type (Finnish, `UNIT_PLAN`) as an allocation asset type. */
function groundAssetType(typeFi: string): AssetType {
  if (/robotti/i.test(typeFi)) return "robotti";
  if (/^maastopalo/i.test(typeFi)) return "maastoyksikko";
  if (/säiliöauto/i.test(typeFi)) return "sailioauto";
  return "pelastusyksikko";
}

function viewIndexOfStep(step: number): CycleIndex | PracticeViewIndex {
  const view = viewOfStep(step);
  if (!view) throw new RangeError(`step ${step} is in no view`);
  return view.index as CycleIndex | PracticeViewIndex;
}

/**
 * Assets that leave the incident for good, by the last step they are on scene (fix pass 2, 7 Oct 2026, FC3): the
 * region takes DR3 to another fire at 17.59 (`tools/fire-ca/deployment.ts` AIR_PLAN, its landing line at step 14).
 * From the first view whose decision point is after that step, the asset is not offered.
 */
export const RELEASED_AFTER_STEP: Readonly<Record<string, number>> = { DR3: 14 };

/**
 * Reinforcements the region holds at the command post for another fire, by the last step they are held (fix pass
 * 2, 7 Oct 2026; `tools/fire-ca/deployment.ts` HELD_FOR_REGION: their arrival and offers say so). A view whose
 * decision point falls in that time does not offer them, as a grounded drone is not offered (`unavailableInViews`).
 */
export const HELD_BY_REGION_UNTIL_STEP: Readonly<Record<string, number>> = { EK16: 13, KY23: 11 };

/** The main views whose decision point (their last step) falls while the region holds the unit. */
function heldViews(id: string): CycleIndex[] {
  const until = HELD_BY_REGION_UNTIL_STEP[id];
  return until === undefined ? [] : MAIN_VIEWS.filter((v) => v.steps[v.steps.length - 1]! <= until).map((v) => v.index as CycleIndex);
}

/** Every asset the participant can task, with the view it is first on scene in. */
export function allocationAssets(bundle: Pick<SiteScenarioBundle, "units" | "steps"> = SITE_SCENARIO): Asset[] {
  const firstStep = new Map<string, { step: number; type: AssetType }>();
  for (const step of bundle.steps) {
    // determinism-lint-allow: an id's first step does not depend on key order, and the result is sorted below with an explicit comparator (I1).
    for (const id of Object.keys(step.units)) {
      if (!firstStep.has(id)) {
        const typeFi = bundle.units.find((u) => u.id === id)?.type ?? "";
        firstStep.set(id, { step: step.index, type: groundAssetType(typeFi) });
      }
    }
    for (const a of step.aircraft) {
      const type: AssetType | null = a.kind === "drone" ? "drone" : a.kind === "water_drone" ? "vesidrooni" : null;
      if (type && !firstStep.has(a.platformId)) firstStep.set(a.platformId, { step: step.index, type });
    }
  }
  return [...firstStep.entries()]
    .map(([id, { step, type }]) => {
      const released = RELEASED_AFTER_STEP[id];
      // The view holding the step after the release ends after it: the asset is offered up to the view before.
      const until = released === undefined ? null : (viewIndexOfStep(released + 1) - 1) as CycleIndex;
      const grounded = [...groundedViews(bundle, id), ...heldViews(id)].filter((v) => v >= viewIndexOfStep(step) && (until === null || v <= until)).sort((a, b) => a - b);
      return { id, label: id, type, availableFromCycle: viewIndexOfStep(step), availableUntilCycle: until, ...(grounded.length > 0 ? { unavailableInViews: grounded } : {}) };
    })
    .sort((a, b) => Number(isCrew(b)) - Number(isCrew(a)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The main views at whose decision point a drone has every battery pack empty (`drone-battery.ts`). */
function groundedViews(bundle: Pick<SiteScenarioBundle, "steps">, id: string): CycleIndex[] {
  if (!DRONE_BATTERY[id]) return [];
  const flown = bundle.steps.filter((s) => s.index >= 1 && s.aircraft.some((a) => a.platformId === id)).map((s) => s.index);
  const battery = batteryTimeline(id, flown);
  return MAIN_VIEWS.filter((v) => !battery.taskableAt(viewEndVirtual(v) - 1)).map((v) => v.index as CycleIndex);
}

export function buildAllocationSpace(): AllocationSpace {
  return {
    sectors: SITE_SCENARIO.sectors.map((s) => ({ id: s.id, label: s.label, geometry: s.geometry })),
    assets: allocationAssets(),
    tasks: ALLOCATION_TASKS,
    viability: [],
  };
}

export function isCrew(asset: Pick<Asset, "type">): boolean {
  return CREW_TYPES.includes(asset.type);
}

/** The assets on scene in a view (0 = the practice view), crews first. */
export function rosterForView(space: Pick<AllocationSpace, "assets">, view: number): Asset[] {
  return space.assets.filter((a) => a.availableFromCycle <= view && (a.availableUntilCycle === null || a.availableUntilCycle >= view) && !a.unavailableInViews?.includes(view as CycleIndex));
}

/** The tasks that suit an asset. */
export function tasksFor(space: Pick<AllocationSpace, "tasks">, asset: Pick<Asset, "type">): TaskOption[] {
  return space.tasks.filter((t) => t.appliesToTypes.includes(asset.type));
}
