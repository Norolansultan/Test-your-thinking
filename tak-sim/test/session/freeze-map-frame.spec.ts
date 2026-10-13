/**
 * The memory-check map's frame (SPEC/12 revision (aj), 9 Oct 2026): the whole scenario extent, the same neutral
 * frame the live map opens on, derived from no view — and every map item's key lies inside it, with room for the
 * item's tolerance, so no answer is cut off by the frame. (From 2 Oct to 9 Oct 2026 the map was framed on the fire
 * as last reported; that frame was derived from the view and is gone.)
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { insideExtent } from "../../app/session/freeze-answers.js";
import { boxAroundCentre, extentSizeM, OPENING_BOX_M } from "../../app/render/map-frame.js";

const scenario = buildDemoScenario();

describe("the freeze map's frame", () => {
  it("shows every map key of every freeze, at least a tolerance inside the edge of the extent", () => {
    const extent = scenario.extent;
    for (const f of [scenario.practice.freeze, ...scenario.freezes]) {
      for (const it of f.items.filter((i) => i.kind === "map_point")) {
        const { point, toleranceM } = it.mapKey!;
        const dLat = toleranceM / 111_320, dLon = toleranceM / (111_320 * Math.cos((point.lat * Math.PI) / 180));
        const inset = { south: extent.south + dLat, north: extent.north - dLat, west: extent.west + dLon, east: extent.east - dLon };
        expect(insideExtent(point, inset), `${it.id} (V${f.cycle}) inside the frame`).toBe(true);
      }
    }
  });

  it("opens on the live map's 5 km box (revision (ap)), and every map key lies a tolerance inside it", () => {
    const box = boxAroundCentre(scenario.extent, OPENING_BOX_M);
    for (const f of [scenario.practice.freeze, ...scenario.freezes]) {
      for (const it of f.items.filter((i) => i.kind === "map_point")) {
        const { point, toleranceM } = it.mapKey!;
        const dLat = toleranceM / 111_320, dLon = toleranceM / (111_320 * Math.cos((point.lat * Math.PI) / 180));
        const inset = { south: box.south + dLat, north: box.north - dLat, west: box.west + dLon, east: box.east - dLon };
        expect(insideExtent(point, inset), `${it.id} (V${f.cycle}) inside the opening box`).toBe(true);
      }
    }
  });

  it("is the study area, about 7 km across, not a frame around the fire", () => {
    const { widthM, heightM } = extentSizeM(scenario.extent);
    expect(widthM).toBeGreaterThan(6_500);
    expect(heightM).toBeGreaterThan(6_500);
    expect(Math.abs(widthM - heightM) / widthM).toBeLessThan(0.05); // square enough for a square box
  });
});
