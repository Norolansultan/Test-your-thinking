/**
 * SPEC/18 revision (m): where ground units can physically be. An engine or tanker stays on a road a
 * truck can drive and clear of the fire; its crew works the edge on foot, supplied through a hose
 * line of plausible length. Guards a regenerated `site-scenario.json` against engines parked in
 * the forest again.
 */

import { describe, expect, it } from "vitest";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { wgs84ToTm35 } from "../../tools/fire-ca/tm35.js";
import { ROADS } from "../../tools/topo-map/roads.js";
import { HOSE_TASKS, MAX_HOSE_M, TRUCK_ROADS, UNIT_PLAN } from "../../tools/fire-ca/deployment.js";
import type { LatLon } from "../../app/engine/primitives.js";

const ign = wgs84ToTm35(SITE_SCENARIO.ignition);
const toSite = (p: LatLon) => { const q = wgs84ToTm35(p); return { x: q.eastM - ign.eastM, y: q.northM - ign.northM }; };

function distanceToTruckRoad(p: { x: number; y: number }): number {
  let best = Infinity;
  for (const r of ROADS) {
    if (!TRUCK_ROADS.has(r.cls)) continue;
    for (let i = 1; i < r.line.length; i++) {
      const a = r.line[i - 1]!, b = r.line[i]!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y));
    }
  }
  return best;
}

const access = (id: string) => UNIT_PLAN[id]?.access ?? "road";

describe("ground unit deployment (SPEC/18 revision (m))", () => {
  it("gives every unit on the map a task, and nothing else", () => {
    for (const c of SITE_SCENARIO.steps) expect(Object.keys(c.unitWork).sort()).toEqual(Object.keys(c.units).sort());
  });

  it("keeps every road vehicle on a road a truck can drive", () => {
    for (const c of SITE_SCENARIO.steps) {
      for (const [id, w] of Object.entries(c.unitWork)) {
        if (access(id) !== "road") continue;
        // Crew and vehicle together: the unit itself is on the road; otherwise the parked vehicle is.
        const vehicle = w.vehicle ?? c.units[id]!;
        expect(distanceToTruckRoad(toSite(vehicle)), `${id} step ${c.index}`).toBeLessThan(15);
      }
    }
  });

  it("lays a hose line exactly when the task takes water from the vehicle, never longer than the limit", () => {
    for (const c of SITE_SCENARIO.steps) {
      for (const [id, w] of Object.entries(c.unitWork)) {
        const expectsHose = w.vehicle !== null && HOSE_TASKS.has(w.task);
        expect(w.hoseM !== null, `${id} step ${c.index}`).toBe(expectsHose);
        if (w.hoseM !== null) expect(w.hoseM).toBeLessThanOrEqual(MAX_HOSE_M);
      }
    }
  });

  it("shows the robot laying hose and the forest-fire unit's terrain vehicle beside its crew", () => {
    const last = SITE_SCENARIO.steps.find((s) => s.index === 20)!;
    expect(last.unitWork["UGV1"]!.task).toBe("hose_laying");
    for (const c of SITE_SCENARIO.steps) {
      const w = c.unitWork["EK14"];
      if (w?.vehicle) expect(Math.hypot(toSite(w.vehicle).x - toSite(c.units["EK14"]!).x, toSite(w.vehicle).y - toSite(c.units["EK14"]!).y)).toBeLessThanOrEqual(81);
    }
  });
});
