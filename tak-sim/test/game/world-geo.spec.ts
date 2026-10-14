/**
 * Game mode (SPEC/29): local metres ↔ TM35FIN ↔ WGS84 (`app/game/world/geo.ts`).
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { GameGrid } from "../../app/game/contracts.js";
import { gridCornersLngLat, lngLatToLocal, lngLatToTm35, localToLngLat, localToTm35, tm35ToLngLat, tm35ToLocal } from "../../app/game/world/geo.js";
import { distance } from "../../app/game/world/grid.js";
import { tm35ToWgs84 } from "../../tools/fire-ca/tm35.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const grid: GameGrid = { cols: 400, rows: 400, cellM: 25, originTm35: { east: 514_000, north: 6_741_000 } };

describe("geo", () => {
  it("round-trips local metres through WGS84 to well under a metre, margin included", () => {
    let worst = 0;
    for (let x = -1500; x <= 11_500; x += 650) {
      for (let y = -1500; y <= 11_500; y += 650) {
        const p = { x, y };
        worst = Math.max(worst, distance(p, lngLatToLocal(grid, localToLngLat(grid, p))));
      }
    }
    expect(worst).toBeLessThan(0.01);
  });

  it("is the same projection as the build tools' (tools/fire-ca/tm35.ts)", () => {
    for (const [e, n] of [[514_000, 6_741_000], [519_000, 6_746_000], [524_000, 6_751_000], [509_000, 6_756_000]] as const) {
      const ll = tm35ToLngLat({ east: e, north: n });
      const ref = tm35ToWgs84(e, n);
      expect(ll[0]).toBeCloseTo(ref.lon, 10);
      expect(ll[1]).toBeCloseTo(ref.lat, 10);
      const back = lngLatToTm35(ll);
      expect(Math.abs(back.east - e)).toBeLessThan(0.01);
      expect(Math.abs(back.north - n)).toBeLessThan(0.01);
    }
  });

  it("offsets local metres from the grid's south-west corner", () => {
    expect(localToTm35(grid, { x: 4000, y: 5400 })).toEqual({ east: 518_000, north: 6_746_400 });
    expect(tm35ToLocal(grid, { east: 519_000, north: 6_746_000 })).toEqual({ x: 5000, y: 5000 });
  });

  it("puts the map's own corners where site-meta.json says (the basemap is TM35 509000–529000 / 6736000–6756000)", () => {
    const meta = JSON.parse(readFileSync(join(ROOT, "app/scenario/site-meta.json"), "utf8")) as { cornersWgs84: [number, number][] };
    const nw = localToLngLat(grid, { x: -5000, y: 15_000 });
    const se = localToLngLat(grid, { x: 15_000, y: -5000 });
    expect(nw[0]).toBeCloseTo(meta.cornersWgs84[0]![0], 5);
    expect(nw[1]).toBeCloseTo(meta.cornersWgs84[0]![1], 5);
    expect(se[0]).toBeCloseTo(meta.cornersWgs84[2]![0], 5);
    expect(se[1]).toBeCloseTo(meta.cornersWgs84[2]![1], 5);
  });

  it("gives the grid's corners in MapLibre image order (NW, NE, SE, SW)", () => {
    const [nw, ne, se, sw] = gridCornersLngLat(grid);
    expect(nw).toEqual(localToLngLat(grid, { x: 0, y: 10_000 }));
    expect(se).toEqual(localToLngLat(grid, { x: 10_000, y: 0 }));
    expect(nw[1]).toBeGreaterThan(sw[1]);
    expect(ne[0]).toBeGreaterThan(nw[0]);
    expect(sw[0]).toBeCloseTo(tm35ToWgs84(514_000, 6_741_000).lon, 10);
    expect(sw[1]).toBeCloseTo(tm35ToWgs84(514_000, 6_741_000).lat, 10);
  });
});
