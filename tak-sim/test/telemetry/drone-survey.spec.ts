/**
 * The drone-survey measure (SPEC/16 revision 1 Oct 2026): whether and when a drone was tasked to
 * survey the target sector inside the declared view window, from `drone_tasked` records only.
 */

import { describe, expect, it } from "vitest";
import { asSeq, asVirtualTime } from "../../app/engine/primitives.js";
import { droneSurveyTiming, REKINDLE_DRONE_SURVEY, type DroneSurveyWindowSpec } from "../../app/telemetry/derived-measures.js";
import type { LogRecord } from "../../app/telemetry/log.js";
import type { DroneTaskedDetail } from "../../app/telemetry/record-kinds.js";

let seq = 0;
function tasked(view: number, targetSectorId: string, taskId = "task.thermal-survey", assetId = "DR2"): LogRecord {
  const detail: DroneTaskedDetail = { view, assetId, assetType: "drone", targetSectorId, taskId, clockLabel: "16:30" };
  seq += 1;
  return { seq: asSeq(seq), tVirtual: asVirtualTime(view * 1000), tWallOffsetMs: seq * 10, kind: "drone_tasked", detail };
}
const other = (kind: string): LogRecord => ({ seq: asSeq(++seq), tVirtual: asVirtualTime(0), tWallOffsetMs: 0, kind, detail: {} });

describe("the rekindle drone survey (L3, V7–V8, before the V9 report)", () => {
  it("declares its window as a constant", () => {
    expect(REKINDLE_DRONE_SURVEY).toMatchObject({ targetSectorId: "L3", fromView: 7, beforeView: 9 });
  });

  it("tasked in the window: V7 and V8 both count; the first one is reported with its view and time", () => {
    const v7 = tasked(7, "L3");
    const r = droneSurveyTiming([other("cycle_start"), tasked(6, "L1"), v7, tasked(8, "L3", "task.watch", "DR3")], REKINDLE_DRONE_SURVEY);
    expect(r.outcome).toBe("in_window");
    expect(r.firstInWindow).toMatchObject({ view: 7, assetId: "DR2", seq: v7.seq, tVirtual: v7.tVirtual, clockLabel: "16:30" });
    expect(r.orders).toHaveLength(2);
    expect(droneSurveyTiming([tasked(8, "L3", "task.perimeter-map")], REKINDLE_DRONE_SURVEY).outcome).toBe("in_window");
  });

  it("not tasked: no drone order, another sector, or a non-survey task", () => {
    expect(droneSurveyTiming([other("allocation_submitted")], REKINDLE_DRONE_SURVEY)).toEqual({ outcome: "never", firstInWindow: null, orders: [] });
    expect(droneSurveyTiming([tasked(7, "L1"), tasked(8, "L4")], REKINDLE_DRONE_SURVEY).outcome).toBe("never");
    expect(droneSurveyTiming([tasked(8, "L3", "task.water-drop", "VD1")], REKINDLE_DRONE_SURVEY).outcome).toBe("never");
  });

  it("late: first surveyed in V9 or after, once the rekindle is reported", () => {
    const r = droneSurveyTiming([tasked(9, "L3"), tasked(11, "L3")], REKINDLE_DRONE_SURVEY);
    expect(r.outcome).toBe("late");
    expect(r.firstInWindow).toBeNull();
    expect(r.orders.map((o) => o.view)).toEqual([9, 11]);
  });

  it("before the window only (and the practice view never counts)", () => {
    expect(droneSurveyTiming([tasked(3, "L3"), tasked(10, "L3")], REKINDLE_DRONE_SURVEY).outcome).toBe("before_window");
    expect(droneSurveyTiming([tasked(0, "L3")], REKINDLE_DRONE_SURVEY).outcome).toBe("never");
  });

  it("is generic: another sector and window", () => {
    const spec: DroneSurveyWindowSpec = { targetSectorId: "L1", taskIds: ["task.watch"], fromView: 2, beforeView: 4 };
    expect(droneSurveyTiming([tasked(3, "L1", "task.watch")], spec).outcome).toBe("in_window");
    expect(droneSurveyTiming([tasked(3, "L1", "task.thermal-survey")], spec).outcome).toBe("never");
  });
});

describe("afterFreeze (fix pass 6, H10): an order logged after the view's freeze was shown", () => {
  const freeze = (cycle: number): LogRecord => ({ seq: asSeq(++seq), tVirtual: asVirtualTime(0), tWallOffsetMs: 0, kind: "freeze_started", detail: { cycle, atViewSeconds: 100, decisionCommittedBeforeFreeze: false, decisionStep: "x" } });

  it("flags each order against the first freeze of its own view; null where the view has no freeze", () => {
    const before = tasked(7, "L3");
    const f7 = freeze(7);
    const after = tasked(7, "L3", "task.watch", "DR3");
    const noFreeze = tasked(8, "L3");
    const r = droneSurveyTiming([before, f7, after, noFreeze], REKINDLE_DRONE_SURVEY);
    expect(r.orders.map((o) => [o.view, o.assetId, o.afterFreeze])).toEqual([[7, "DR2", false], [7, "DR3", true], [8, "DR2", null]]);
    expect(r.firstInWindow).toMatchObject({ seq: before.seq, afterFreeze: false });
  });
});
