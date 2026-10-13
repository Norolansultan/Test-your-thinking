/**
 * The allocation space (SPEC/16 revision 1 Oct 2026): crews and drone teams, the assets on scene in
 * each view derived from the frozen deployment, tasks that suit each type, the scenario's sectors.
 */

import { describe, expect, it } from "vitest";
import { ALLOCATION_TASKS, allocationAssets, buildAllocationSpace, HELD_BY_REGION_UNTIL_STEP, isCrew, RELEASED_AFTER_STEP, rosterForView, tasksFor } from "../../app/scenario/allocation.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { SESSION_VIEWS } from "../../app/scenario/views.js";
import { DRONE_SURVEY_TASK_IDS } from "../../app/telemetry/derived-measures.js";

const space = buildAllocationSpace();
const ids = (view: number) => rosterForView(space, view).map((a) => a.id).sort();

describe("the unit roster per view", () => {
  it("matches who is on scene: VP, V1, V2, V3, V7, V8, V12", () => {
    expect(ids(0)).toEqual(["DR1", "EK11", "VPK"]); // VP is W2: EK12 still en route (SPEC/18 §8.2)
    // EK13, the water shuttle, is on scene from the handover (fix pass 2, 7 Oct 2026); DR3 leaves for another fire at 17.59 (step 14).
    expect(ids(1)).toEqual(["DR1", "EK11", "EK12", "EK13", "EK14", "VPK"]);
    expect(ids(2)).toEqual(["DR1", "DR3", "EK11", "EK12", "EK13", "EK14", "KY21", "VPK"]); // KY21 arrives in step 3, inside merged V2
    expect(ids(3)).toEqual(["DR1", "DR2", "DR3", "EK11", "EK12", "EK13", "EK14", "KY21", "VPK"]);
    expect(ids(7)).toEqual(["DR1", "DR2", "DR3", "EK11", "EK12", "EK13", "EK14", "EK15", "KY21", "VPK"]);
    // EK16 and KY23 arrive at step 11 held by the region for another fire: not offered while held (KY23 to step 11, EK16 to 13).
    expect(ids(8)).toEqual(["DR1", "DR2", "DR3", "EK11", "EK12", "EK13", "EK14", "EK15", "KY21", "VD1", "VPK"]);
    expect(ids(9)).toContain("KY23");
    expect(ids(10)).not.toContain("EK16");
    expect(ids(11)).toContain("EK16");
    expect(ids(10)).toContain("DR3");
    expect(ids(11)).not.toContain("DR3");
    expect(ids(12)).toEqual(["DR1", "DR2", "EK11", "EK12", "EK13", "EK14", "EK15", "EK16", "KY21", "KY23", "OUT1", "OUT2", "UGV1", "VD1", "VPK"]);
  });

  it("is derived from the deployment: every asset that has appeared by the view's last step and not left before it, and no other", () => {
    for (const view of SESSION_VIEWS) {
      const lastStep = view.steps[view.steps.length - 1]!;
      const expected = new Set<string>();
      for (const step of SITE_SCENARIO.steps.filter((s) => s.index <= lastStep)) {
        for (const id of Object.keys(step.units)) expected.add(id);
        for (const a of step.aircraft) if (a.kind === "drone" || a.kind === "water_drone") expected.add(a.platformId);
      }
      for (const [id, last] of Object.entries(RELEASED_AFTER_STEP)) if (lastStep > last) expected.delete(id);
      for (const [id, last] of Object.entries(HELD_BY_REGION_UNTIL_STEP)) if (lastStep <= last) expected.delete(id);
      expect(ids(view.index), view.id).toEqual([...expected].sort());
    }
  });

  it("never offers the helicopter or the spotter aircraft (not the participant's to task)", () => {
    expect(space.assets.map((a) => a.id)).not.toContain("HELI1");
    expect(space.assets.map((a) => a.id)).not.toContain("SPOT");
  });

  it("lists crews first", () => {
    const roster = rosterForView(space, 12);
    const firstDrone = roster.findIndex((a) => !isCrew(a));
    expect(roster.slice(firstDrone).every((a) => !isCrew(a))).toBe(true);
  });

  it("is the scenario contract's allocation space", () => {
    expect(buildDemoScenario().allocationSpace.assets).toEqual(allocationAssets());
  });
});

describe("tasks suit each asset type", () => {
  const byId = (id: string) => space.assets.find((a) => a.id === id)!;
  const taskIds = (id: string) => tasksFor(space, byId(id)).map((t) => t.id);

  it("drones survey, map or watch; the water drone and the robot are autonomous and take no tasks (D3); crews fight fire", () => {
    for (const d of ["DR1", "DR2", "DR3"]) expect(taskIds(d)).toEqual(["task.thermal-survey", "task.perimeter-map", "task.watch"]);
    expect(taskIds("VD1")).toEqual([]);
    expect(taskIds("UGV1")).toEqual([]);
    for (const c of ["EK11", "EK14", "VPK", "KY21"]) expect(taskIds(c)).toEqual(["task.direct-attack", "task.hold-line", "task.mopup"]);
  });

  it("every drone-survey task id of the derived measure is a drone task", () => {
    for (const id of DRONE_SURVEY_TASK_IDS) expect(ALLOCATION_TASKS.find((t) => t.id === id)?.appliesToTypes).toEqual(["drone"]);
  });
});

describe("sectors", () => {
  it("are the scenario's L1–L4 with their names, and nothing about protecting a village", () => {
    expect(space.sectors.map((s) => `${s.id} ${s.label}`)).toEqual(["L1 Pohjoinen", "L2 Koillinen", "L3 Etelä", "L4 Länsi"]);
    expect(JSON.stringify(ALLOCATION_TASKS)).not.toMatch(/kylä/i);
  });
});
