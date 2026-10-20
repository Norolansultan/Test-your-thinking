/**
 * Gate A on the built map (SPEC/33 §5): `content/site/build/topo-features.json` as `npm run map:build` wrote it passes the hydro,
 * road and realism checks with no violation. (A rebuild that breaks one fails here as well as in `npm run map:check`.)
 */

import { beforeAll, describe, expect, it } from "vitest";
import { loadLayers, type BuiltLayers } from "../../tools/topo-map/checks/built-layers.js";
import { checkHydro } from "../../tools/topo-map/checks/hydro.js";
import { checkRoads } from "../../tools/topo-map/checks/road.js";
import { checkRealism } from "../../tools/topo-map/checks/realism.js";
import { ROADS } from "../../tools/topo-map/roads.js";

let layers: BuiltLayers;
beforeAll(() => { layers = loadLayers(); }, 120_000);

describe("built map, gate A (SPEC/33 §5)", () => {
  it("is the map the modules generate (same road count: rebuild with npm run map:build)", () => {
    expect(layers.roads.length).toBe(ROADS.length);
  });

  it("hydro: no uphill stream, no lake without an outlet, no sink, no brook ending nowhere", () => {
    expect(checkHydro(layers).violations).toEqual([]);
  }, 120_000);

  it("roads: water crossed only at bridges and culverts, short mire crossings, one network, no closed rectangle", () => {
    expect(checkRoads(layers).violations).toEqual([]);
  }, 120_000);

  it("realism: relief, slopes, mire share and shapes, field parcels, road density and contour shapes within their limits", () => {
    expect(checkRealism(layers).violations).toEqual([]);
  }, 120_000);
});
