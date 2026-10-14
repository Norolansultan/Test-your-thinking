/**
 * Game mode screen: the forecast outline, the map's vector data, the marker fan-out and the debrief's arithmetic.
 */

import { describe, expect, it } from "vitest";
import type { Score, Unit } from "../../app/game/contracts.js";
import { POINTS_PER_HA, START_POINTS } from "../../app/game/sim/score.js";
import { niceMax, pointsBreakdown } from "../../app/game/ui/Debrief.js";
import { FORECAST_EVERY_S, forecastDue } from "../../app/game/ui/forecast-view.js";
import { fanOffset, fanOut } from "../../app/game/ui/markers.js";
import { fireBreakLines, openingBox, orderTarget, routeLines } from "../../app/game/ui/map-data.js";
import { cellOutline, labelPoint } from "../../app/game/ui/outline.js";
import { gridCornersLngLat } from "../../app/game/world/geo.js";
import { getWorld } from "../../app/game/world/load.js";

const G = { cols: 4, rows: 4, cellM: 10 };

describe("cell outline", () => {
  it("one cell is a closed square on its corners (row 0 is the north edge)", () => {
    const rings = cellOutline(G, (c) => c === 0); // north-west cell
    expect(rings).toHaveLength(1);
    const r = rings[0]!;
    expect(r[0]).toEqual(r[r.length - 1]);
    expect(r).toHaveLength(5);
    const xs = r.map((p) => p.x), ys = r.map((p) => p.y);
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([0, 10, 30, 40]);
  });

  it("a block of cells gives one ring with only its corners (collinear points dropped)", () => {
    const set = new Set([5, 6, 9, 10]); // the middle 2 × 2
    const rings = cellOutline(G, (c) => set.has(c));
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(5);
  });

  it("an L shape has six corners; two separate cells give two rings", () => {
    const l = new Set([0, 4, 5]);
    expect(cellOutline(G, (c) => l.has(c))[0]).toHaveLength(7);
    expect(cellOutline(G, (c) => c === 0 || c === 15)).toHaveLength(2);
    expect(cellOutline(G, () => false)).toEqual([]);
  });

  it("labels go on the north and the south of the outline", () => {
    const rings = cellOutline(G, (c) => c === 5 || c === 9);
    expect(labelPoint(rings, "north")!.y).toBe(30);
    expect(labelPoint(rings, "south")!.y).toBe(10);
    expect(labelPoint([], "north")).toBeNull();
  });
});

describe("forecast refresh", () => {
  it("is due first, then at most every 30 game seconds (and again after a restart)", () => {
    expect(FORECAST_EVERY_S).toBe(30);
    expect(forecastDue(null, 0)).toBe(true);
    expect(forecastDue(100, 120)).toBe(false);
    expect(forecastDue(100, 130)).toBe(true);
    expect(forecastDue(100, 50)).toBe(true);
  });
});

describe("map data", () => {
  const world = getWorld();
  const unit = (over: Partial<Unit>): Unit => ({ id: "EK11", callsign: "EK11", kind: "engine", pos: { x: 4000, y: 5400 }, status: "moving", order: null, waterL: 0, waterMaxL: 3000, energyPct: 100, harm: 0, hoseLine: null, etaS: null, ...over });

  it("the fire raster's corners and the vector data use one projection", () => {
    const [nw, , , sw] = gridCornersLngLat(world.grid);
    const r = routeLines(world, [unit({ pos: { x: 0, y: 0 }, order: { type: "move", to: { x: 0, y: 10_000 } } })], new Set());
    const line = r.features[0]!.geometry.coordinates;
    expect(line[0]![0]).toBeCloseTo(sw[0], 9);
    expect(line[0]![1]).toBeCloseTo(sw[1], 9);
    expect(line[1]![0]).toBeCloseTo(nw[0], 9);
    expect(line[1]![1]).toBeCloseTo(nw[1], 9);
  });

  it("routes are drawn for busy units with a place to go, marked when selected", () => {
    const busy = unit({ order: { type: "attack", target: { x: 5000, y: 5000 } } });
    const idle = unit({ id: "VPK", status: "idle", order: null });
    const r = routeLines(world, [busy, idle], new Set(["EK11"]));
    expect(r.features.map((f) => f.properties)).toEqual([{ id: "EK11", selected: true }]);
  });

  it("an order's place: water for a refill (scoop for aircraft), the settlement for protect, none for hold", () => {
    const w = world.waterPoints[0]!;
    expect(orderTarget({ type: "refill", waterPointId: w.id }, world)).toEqual(w.at);
    expect(orderTarget({ type: "refill", waterPointId: w.id }, world, true)).toEqual(w.scoop);
    const s = world.settlements[0]!;
    expect(orderTarget({ type: "protect", assetOrSettlementId: s.id }, world)).toEqual(s.centre);
    expect(orderTarget({ type: "hold" }, world)).toBeNull();
  });

  it("each ordered fire break is drawn once", () => {
    const o = { type: "fire_break" as const, from: { x: 1, y: 2 }, to: { x: 300, y: 2 } };
    expect(fireBreakLines(world.grid, [{ atS: 0, unitId: "EK14", order: o }, { atS: 60, unitId: "EK14", order: o }]).features).toHaveLength(1);
  });

  it("the game opens on the fire and the command post, inside the grid", () => {
    const box = openingBox(world, [{ x: 5000, y: 5000 }], []);
    expect(box.min.x).toBeLessThanOrEqual(world.commandPost.x);
    expect(box.max.x).toBeGreaterThanOrEqual(5000);
    expect(box.min.x).toBeGreaterThanOrEqual(0);
    expect(box.max.y).toBeLessThanOrEqual(world.grid.rows * world.grid.cellM);
  });
});

describe("unit marker fan-out", () => {
  it("leaves a lone marker in place and spreads markers on one spot apart", () => {
    expect(fanOffset(0, 1)).toEqual([0, 0]);
    const off = fanOut([{ id: "A", x: 100, y: 100 }, { id: "B", x: 105, y: 100 }, { id: "C", x: 400, y: 100 }]);
    expect(off.get("C")).toEqual([0, 0]);
    const a = off.get("A")!, b = off.get("B")!;
    expect((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2).toBeGreaterThan(30 * 30);
  });
});

describe("debrief", () => {
  const score = (over: Partial<Score>): Score => ({
    burnedHa: 10, assetsLost: 0, assetsTotal: 121, settlementsLost: [], casualties: 0, containedAtS: null, points: START_POINTS - 10 * POINTS_PER_HA, grade: "A",
    objectives: [], ...over,
  });

  it("the points breakdown adds up to the game's total", () => {
    for (const s of [score({}), score({ casualties: 1, points: 600 }), score({ containedAtS: 3600, points: 1100 })]) {
      const rows = pointsBreakdown(s, 0, 28_800);
      expect(rows[0]).toEqual({ key: "start", value: START_POINTS });
      expect(rows.reduce((a, r) => a + r.value, 0)).toBe(s.points);
    }
  });

  it("a game over with the fire still flaming shows the penalty as its own row", () => {
    const rows = pointsBreakdown(score({ points: START_POINTS - 10 * POINTS_PER_HA - 200 }), 0, 28_800, true);
    expect(rows.find((r) => r.key === "burning")?.value).toBe(-200);
    expect(rows.some((r) => r.key === "other")).toBe(false);
  });

  it("chart axes end on round numbers", () => {
    expect([niceMax(0), niceMax(0.3), niceMax(1.9), niceMax(7), niceMax(42), niceMax(180)]).toEqual([1, 0.5, 2, 10, 50, 200]);
  });
});
