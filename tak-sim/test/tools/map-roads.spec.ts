/**
 * The generated site's named roads (SPEC/33 §3): the scenario finds the Honkaharju forest road by its stable id, not by an index the
 * rebuilt network renumbers; the designed roads keep their order (crossings.ts names them by index) and pass their unit anchors.
 */

import { describe, expect, it } from "vitest";
import { FIXED_ROADS, roadById, roadIndexById, ROADS } from "../../tools/topo-map/roads.js";
import { ROAD_INDEX } from "../../tools/topo-map/checks/contract-map.js";
import { FEATURES } from "../../tools/fire-ca/deployment.js";
import { distToPolyline } from "../../tools/topo-map/terrain.js";

describe("named roads (SPEC/33 §3)", () => {
  it("finds the Honkaharju forest road by id, through its four anchors", () => {
    const r = roadById("honkaharju");
    expect(r.cls).toBe("forest");
    for (const a of ["FR_W", "FR_MID", "FR_E", "R2_FR"] as const) expect(distToPolyline(FEATURES[a].x, FEATURES[a].y, r.line), a).toBeLessThan(30);
    expect(ROAD_INDEX.HONKAHARJU_ROAD).toBe(ROADS.indexOf(r));
    expect(ROADS[roadIndexById("honkaharju")]).toBe(r);
  });

  it("throws on an unknown id instead of returning another road", () => {
    expect(() => roadById("no-such-road")).toThrow(/no road with id/);
  });

  it("keeps the designed roads first, in the order crossings.ts names them, each with its id", () => {
    expect(FIXED_ROADS.map((r) => r.id)).toEqual(["maantie_s", "maantie_n", "r3_w", "r1", "r3_e", "r2", "karhu", "peat", "hiekkala", "pirttilampi"]);
    FIXED_ROADS.forEach((r, i) => expect(ROADS[i]).toBe(r));
  });

  it("runs R1 and R2 through their unit anchors (within 30 m)", () => {
    const r1 = roadById("r1").line;
    const r2 = roadById("r2").line;
    for (const a of ["R1_W", "R1_MID", "R1_BLACK", "R1_BLACK_MID", "R1_R2"] as const) expect(distToPolyline(FEATURES[a].x, FEATURES[a].y, r1), a).toBeLessThan(30);
    for (const a of ["R1_R2", "R2_BOG", "R2_FR", "R2_MID", "R2_S"] as const) expect(distToPolyline(FEATURES[a].x, FEATURES[a].y, r2), a).toBeLessThan(30);
  });
}, 120_000);
