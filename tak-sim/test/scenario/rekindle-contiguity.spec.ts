/**
 * Scenario revision (aj), 9 Oct 2026 (researcher): a rekindle or holdover starts FROM the old fire — its ignition
 * touches the burned area, with no unburned gap between the old and the new fire, in the CA grid and in the
 * polygons the map draws. Spot fires thrown by embers ahead of a running head (steps 3, 6, 7, 8) are a different
 * thing and stay detached.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import type { LatLon, Polygon } from "../../app/engine/primitives.js";
import { loadRealSite } from "../../tools/fire-ca/ascii-grid.js";
import { cellGap } from "../../tools/fire-ca/new-fire.js";
import { DEFAULT_RUN_OPTIONS, runScenario, type ScriptedEvent } from "../../tools/fire-ca/run.js";
import { SCENARIO_18_FORCING } from "../../tools/fire-ca/scenario-18.js";
import { FUEL_CLASSES } from "../../tools/fire-ca/template-site.js";

const PROLOGUE = 5;
const siteJson = JSON.parse(readFileSync("content/site/site.json", "utf8")) as {
  name: string; ignitionTm35: { eastM: number; northM: number }; truthFuel: string; machineFuel: string; elevation: string; legend: { code: number; fuelId: string }[];
};
const site = loadRealSite({
  name: siteJson.name, truthFuelPath: `content/site/${siteJson.truthFuel}`, machineFuelPath: `content/site/${siteJson.machineFuel}`, elevationPath: `content/site/${siteJson.elevation}`,
  legend: siteJson.legend, noFuelId: "water", classes: FUEL_CLASSES, ignitionTm35: siteJson.ignitionTm35, referenceFuelId: "pine_heath",
});
const result = runScenario(site, SCENARIO_18_FORCING, { ...DEFAULT_RUN_OPTIONS, seed: 20080101n, scenarioId: "fin-wildfire-2030" });
const ignitions = SCENARIO_18_FORCING.flatMap((f, k) => (f.events ?? []).filter((e): e is ScriptedEvent => e.kind === "ignite").map((e) => ({ k, step: k - PROLOGUE + 1, id: f.id, rekindle: !!e.rekindle })));

/** The cells burned before the step's ignitions: the previous cycle's truth, plus this report less what was lit before it. */
function burnedBefore(k: number): Uint8Array {
  const c = result.cycles[k]!;
  const prev = k > 0 ? result.cycles[k - 1]!.masks.truthAtEnd : new Uint8Array(c.masks.reported.length);
  const out = new Uint8Array(prev.length);
  for (let i = 0; i < out.length; i++) out[i] = prev[i] || (c.masks.reported[i] && !c.masks.ignited[i]) ? 1 : 0;
  return out;
}

const o = SITE_SCENARIO.ignition;
const R = 6_371_000;
const xy = (p: LatLon) => ({ x: ((p.lon - o.lon) * Math.PI / 180) * R * Math.cos((o.lat * Math.PI) / 180), y: ((p.lat - o.lat) * Math.PI / 180) * R });
const segDist = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};
/** The least distance from any vertex of `a` to the outline of `b` (m). */
function outlineGapM(a: Polygon, b: Polygon): number {
  let best = Infinity;
  const ring = b[0]!.map(xy);
  for (const v of a[0]!.map(xy)) for (let i = 1; i < ring.length; i++) best = Math.min(best, segDist(v, ring[i - 1]!, ring[i]!));
  return best;
}

describe("rekindles and holdovers start from the old fire (revision (aj))", () => {
  it("the scenario has three rekindle ignitions (steps 12, 18, 19) and ember spot fires only in the prologue (W3) and steps 3–8", () => {
    expect(ignitions.filter((e) => e.rekindle).map((e) => e.step)).toEqual([12, 18, 19]);
    expect(new Set(ignitions.filter((e) => !e.rekindle).map((e) => e.step))).toEqual(new Set([-2, 3, 6, 7, 8]));
  });

  it("in the CA grid every rekindle's ignited cells are 8-adjacent to ground burned before it (no unburned gap)", () => {
    for (const e of ignitions.filter((x) => x.rekindle)) {
      const c = result.cycles[e.k]!;
      expect(c.masks.ignited.some((v) => v === 1), `step ${e.step}: nothing caught`).toBe(true);
      expect(cellGap(site.frame, c.masks.ignited, burnedBefore(e.k)), `step ${e.step}`).toBe(1);
    }
  });

  it("a spot fire thrown by embers ahead of the head lands clear of the fire (a gap of two cells or more)", () => {
    for (const e of ignitions.filter((x) => !x.rekindle && x.step !== 8)) { // step 8's ignition is the head crossing Koivuoja into the spots, by design
      const c = result.cycles[e.k]!;
      expect(cellGap(site.frame, c.masks.ignited, burnedBefore(e.k)), `step ${e.step}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("the run traces each new fire as its own front that shares the old fire's edge (the map's detached polygons touch)", () => {
    // From the step after each rekindle's report on, the new fire is in `reportedDetached` / `spotFires` and its outline meets the old one.
    const checks: { step: number; which: "reported" | "truth" }[] = [{ step: 12, which: "truth" }, { step: 13, which: "reported" }, { step: 18, which: "reported" }, { step: 19, which: "reported" }, { step: 20, which: "reported" }];
    for (const { step, which } of checks) {
      const s = SITE_SCENARIO.steps.find((x) => x.index === step)!;
      const main = which === "reported" ? s.reported : s.truthAtEnd;
      const parts = which === "reported" ? s.reportedDetached : s.truthDetached;
      expect(parts.length, `step ${step} ${which}: no new-fire polygon`).toBeGreaterThan(0);
      const gaps = parts.map((p) => outlineGapM(p, main));
      // Every new fire touches the old fire or another new fire (the west flare-up meets the south-east front by 19:40): the outlines
      // share the old edge, so a vertex of one lies on the other's outline (a few metres at most, from the two tracings' rounding).
      for (const [i, g] of gaps.entries()) {
        const toOthers = parts.filter((_, j) => j !== i).map((q) => outlineGapM(parts[i]!, q));
        expect(Math.min(g, ...toOthers), `step ${step} ${which} part ${i}: ${Math.round(g)} m from the old fire`).toBeLessThanOrEqual(5);
      }
    }
  });

  it("the ember spot fires of 15:20 stay detached on the map (a gap of ≥ 50 m from the main fire)", () => {
    const s = SITE_SCENARIO.steps.find((x) => x.index === 7)!;
    expect(s.reportedDetached.length).toBeGreaterThan(0);
    for (const p of s.reportedDetached) expect(outlineGapM(p, s.reported)).toBeGreaterThanOrEqual(50);
  });
});
